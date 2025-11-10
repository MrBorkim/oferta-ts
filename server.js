const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

const execPromise = util.promisify(exec);
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/oferty', express.static('oferty'));
app.use('/static-previews', express.static('static-previews'));

// Struktura katalogów
const DIRS = {
  templates: './templates',
  products: './produkty',
  offers: './oferty',
  staticPreviews: './static-previews'
};

// Inicjalizacja folderów
async function initDirectories() {
  for (const dir of Object.values(DIRS)) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error(`Błąd tworzenia katalogu ${dir}:`, err);
    }
  }
}

// Cache dla szablonów
let templatesCache = null;
let templatesConfigCache = null;

// Ładowanie konfiguracji szablonów
async function loadTemplatesConfig() {
  if (templatesConfigCache) return templatesConfigCache;

  try {
    const configPath = path.join(DIRS.templates, 'oferta-podstawowa', 'templates.json');
    const data = await fs.readFile(configPath, 'utf-8');
    templatesConfigCache = JSON.parse(data);
    return templatesConfigCache;
  } catch (err) {
    console.error('Błąd ładowania templates.json:', err);
    return { templates: [] };
  }
}

// Ładowanie konfiguracji pojedynczego szablonu
async function loadTemplateConfig(templateId) {
  const config = await loadTemplatesConfig();
  const template = config.templates.find(t => t.id === templateId);

  if (!template) {
    throw new Error(`Szablon ${templateId} nie został znaleziony`);
  }

  // Dla szablonów z config_file, załaduj dodatkową konfigurację
  if (template.config_file) {
    const configPath = path.join(
      DIRS.templates,
      template.folder === '.' ? 'oferta-podstawowa' : template.folder,
      template.config_file
    );
    const configData = await fs.readFile(configPath, 'utf-8');
    const detailedConfig = JSON.parse(configData);
    return { ...template, ...detailedConfig };
  }

  return template;
}

// Wczytanie pliku DOCX jako buffer
async function loadDocxBuffer(filePath) {
  return await fs.readFile(filePath);
}

// Funkcja naprawiająca rozdzielone tagi w XML
// Word często rozbija {{placeholder}} na wiele elementów <w:t>
function fixBrokenTags(xmlContent) {
  // KROK 1: Usuń wszystkie elementy które rozbijają placeholdery
  xmlContent = xmlContent.replace(/<w:proofErr[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:bookmarkStart[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:bookmarkEnd[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:noBreakHyphen\/>/g, '');
  xmlContent = xmlContent.replace(/<w:softHyphen\/>/g, '');

  // KROK 2: Ekstrahuj wszystkie elementy <w:t> i połącz te które tworzą tag
  // Znajdź wszystkie paragrafyy <w:p>...</w:p>
  xmlContent = xmlContent.replace(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g, (match, paragraphContent) => {
    // Wyciągnij całą zawartość tekstową z paragrafu
    let textParts = [];
    let tempContent = paragraphContent;

    // Znajdź wszystkie <w:t>...</w:t>
    const textMatches = tempContent.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g);
    for (const textMatch of textMatches) {
      textParts.push(textMatch[1]);
    }

    // Połącz wszystkie teksty
    const fullText = textParts.join('');

    // Jeśli zawiera placeholdery, uprość strukturę
    if (fullText.includes('{{') || fullText.includes('}}')) {
      // Znajdź pierwszy <w:r> i zastąp całą zawartość jednym tekstem
      const firstRun = paragraphContent.match(/<w:r\b[^>]*>/);
      if (firstRun) {
        const cleanedParagraph = paragraphContent.replace(
          /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g,
          (firstMatch, offset) => {
            if (offset === paragraphContent.indexOf(firstRun[0])) {
              // Pierwszy <w:r> - wstaw cały tekst
              return `<w:r><w:t>${fullText}</w:t></w:r>`;
            }
            // Usuń pozostałe <w:r>
            return '';
          }
        );
        return `<w:p${match.match(/<w:p\b([^>]*)>/)[1]}>${cleanedParagraph}</w:p>`;
      }
    }

    return match;
  });

  return xmlContent;
}

// Naprawa rozdzielonych tagów w całym ZIP (DOCX)
function repairDocxTags(zip) {
  // Pliki XML które mogą zawierać placeholdery
  const xmlFiles = [
    'word/document.xml',
    'word/header1.xml',
    'word/header2.xml',
    'word/footer1.xml',
    'word/footer2.xml'
  ];

  xmlFiles.forEach(fileName => {
    try {
      const content = zip.file(fileName);
      if (content) {
        let xmlContent = content.asText();
        const fixedContent = fixBrokenTags(xmlContent);
        zip.file(fileName, fixedContent);
      }
    } catch (err) {
      // Plik nie istnieje, pomijamy
    }
  });

  return zip;
}

// Przetwarzanie DOCX z placeholderami
async function processDocxTemplate(templateBuffer, data) {
  try {
    const zip = new PizZip(templateBuffer);

    // KLUCZOWE: Napraw rozdzielone tagi przed przetwarzaniem
    // Word często rozbija {{placeholder}} na wiele elementów XML
    const fixedZip = repairDocxTags(zip);

    const doc = new Docxtemplater(fixedZip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      delimiters: {
        start: '{{',
        end: '}}'
      }
    });

    doc.render(data);
    return doc.getZip().generate({ type: 'nodebuffer' });
  } catch (err) {
    console.error('❌ Błąd przetwarzania DOCX:', err.message);

    // Lepsze logowanie błędów
    if (err.properties && err.properties.errors) {
      console.error('\n📋 Szczegóły błędów:');
      err.properties.errors.forEach((error, idx) => {
        console.error(`  ${idx + 1}. ${error.message}`);
        if (error.properties) {
          console.error(`     🏷️  Tag: "${error.properties.xtag}"`);
          console.error(`     📄 Plik: ${error.properties.file}`);
          console.error(`     📍 Pozycja: ${error.properties.offset}`);
        }
      });
      console.error('\n💡 Wskazówka: Sprawdź czy placeholdery w DOCX są poprawne.');
      console.error('   Otwórz plik DOCX i upewnij się że {{tagi}} nie są rozbite przez formatowanie.\n');
    }

    throw err;
  }
}

// Konwersja DOCX do PDF/JPG przez Unoserver
async function convertDocxToPdf(docxPath, outputPdfPath) {
  try {
    // Sprawdź czy unoserver działa
    const command = `unoconvert --convert-to pdf "${docxPath}" "${outputPdfPath}"`;
    await execPromise(command, { timeout: 30000 });
    return outputPdfPath;
  } catch (err) {
    console.error('Błąd konwersji DOCX do PDF:', err);
    throw new Error('Unoserver nie jest dostępny lub wystąpił błąd konwersji');
  }
}

// Konwersja PDF do JPG (pierwsza strona dla podglądu)
async function convertPdfToJpg(pdfPath, outputJpgPath) {
  try {
    // Użyj ImageMagick lub pdftoppm
    const command = `pdftoppm -jpeg -f 1 -singlefile -scale-to 800 "${pdfPath}" "${outputJpgPath.replace('.jpg', '')}"`;
    await execPromise(command, { timeout: 15000 });
    return outputJpgPath;
  } catch (err) {
    console.error('Błąd konwersji PDF do JPG:', err);
    // Fallback - zwróć info że nie udało się
    return null;
  }
}

// Scalanie wielu plików DOCX (dla multi_file templates)
async function mergeDocxFiles(filePaths, outputPath) {
  try {
    // Używamy python-docx-merge lub prostego łączenia przez unoserver
    const tempMergedPdf = outputPath.replace('.docx', '_temp.pdf');

    // Konwertuj wszystkie DOCX do PDF i scal
    const pdfPaths = [];
    for (let i = 0; i < filePaths.length; i++) {
      const pdfPath = filePaths[i].replace('.docx', `_part${i}.pdf`);
      await convertDocxToPdf(filePaths[i], pdfPath);
      pdfPaths.push(pdfPath);
    }

    // Scal PDFy używając pdftk lub pdfjam
    const command = `pdftk ${pdfPaths.map(p => `"${p}"`).join(' ')} cat output "${tempMergedPdf}"`;
    await execPromise(command);

    // Konwertuj z powrotem do DOCX
    await execPromise(`unoconvert --convert-to docx "${tempMergedPdf}" "${outputPath}"`);

    // Cleanup
    for (const pdf of pdfPaths) {
      await fs.unlink(pdf).catch(() => {});
    }
    await fs.unlink(tempMergedPdf).catch(() => {});

    return outputPath;
  } catch (err) {
    console.error('Błąd scalania DOCX:', err);
    throw err;
  }
}

// API Endpoints

// GET /api/templates - Lista wszystkich szablonów
app.get('/api/templates', async (req, res) => {
  try {
    const config = await loadTemplatesConfig();
    res.json({ success: true, templates: config.templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/templates/:id - Szczegóły szablonu
app.get('/api/templates/:id', async (req, res) => {
  try {
    const templateConfig = await loadTemplateConfig(req.params.id);
    res.json({ success: true, template: templateConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products - Lista dostępnych produktów
app.get('/api/products', async (req, res) => {
  try {
    const files = await fs.readdir(DIRS.products);
    const products = files
      .filter(f => f.endsWith('.docx'))
      .map((f, idx) => ({
        id: idx + 1,
        filename: f,
        name: f.replace('.docx', ''),
        path: path.join(DIRS.products, f)
      }));

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/offers - Lista zapisanych ofert
app.get('/api/offers', async (req, res) => {
  try {
    const dirs = await fs.readdir(DIRS.offers);
    const offers = [];

    for (const dir of dirs) {
      const offerPath = path.join(DIRS.offers, dir);
      const stat = await fs.stat(offerPath);

      if (stat.isDirectory()) {
        const metaPath = path.join(offerPath, 'metadata.json');
        try {
          const metaData = await fs.readFile(metaPath, 'utf-8');
          const meta = JSON.parse(metaData);
          offers.push({
            id: dir,
            ...meta,
            created: stat.birthtime
          });
        } catch (err) {
          // Folder bez metadanych
          offers.push({
            id: dir,
            name: dir,
            created: stat.birthtime
          });
        }
      }
    }

    res.json({ success: true, offers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/offers/create - Tworzenie nowej oferty
app.post('/api/offers/create', async (req, res) => {
  try {
    const { offerName, templateId } = req.body;

    if (!offerName || !templateId) {
      return res.status(400).json({
        success: false,
        error: 'Wymagane: offerName i templateId'
      });
    }

    const offerId = `${offerName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const offerDir = path.join(DIRS.offers, offerId);

    await fs.mkdir(offerDir, { recursive: true });
    await fs.mkdir(path.join(offerDir, 'previews'), { recursive: true });

    const metadata = {
      id: offerId,
      name: offerName,
      templateId,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      data: {},
      selectedProducts: [],
      pageHashes: {} // Dla śledzenia zmian
    };

    await fs.writeFile(
      path.join(offerDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    res.json({ success: true, offerId, metadata });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/offers/:id/update - Aktualizacja danych oferty
app.post('/api/offers/:id/update', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, selectedProducts } = req.body;

    const offerDir = path.join(DIRS.offers, id);
    const metaPath = path.join(offerDir, 'metadata.json');

    const metaData = await fs.readFile(metaPath, 'utf-8');
    const metadata = JSON.parse(metaData);

    metadata.data = data || metadata.data;
    metadata.selectedProducts = selectedProducts || metadata.selectedProducts;
    metadata.lastModified = new Date().toISOString();

    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    res.json({ success: true, metadata });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/offers/:id/generate - Generowanie dokumentu DOCX
app.post('/api/offers/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const { changedPages } = req.body; // Opcjonalne - lista zmienionych stron

    const offerDir = path.join(DIRS.offers, id);
    const metaPath = path.join(offerDir, 'metadata.json');
    const metaData = await fs.readFile(metaPath, 'utf-8');
    const metadata = JSON.parse(metaData);

    const templateConfig = await loadTemplateConfig(metadata.templateId);
    const templateFolder = templateConfig.folder === '.'
      ? 'oferta-podstawowa'
      : templateConfig.folder;

    let finalDocxPath = path.join(offerDir, 'oferta_final.docx');

    if (templateConfig.type === 'single_file') {
      // Szablon jednoplikowy
      const templatePath = path.join(DIRS.templates, templateFolder, templateConfig.main_file);
      const templateBuffer = await loadDocxBuffer(templatePath);

      // Przetwórz z danymi
      const processedBuffer = await processDocxTemplate(templateBuffer, metadata.data);
      await fs.writeFile(finalDocxPath, processedBuffer);

    } else if (templateConfig.type === 'multi_file') {
      // Szablon wieloplikowy - scal pliki
      const filesToMerge = [];

      for (const fileInfo of templateConfig.files) {
        const filePath = path.join(DIRS.templates, templateFolder, fileInfo.file);
        const buffer = await loadDocxBuffer(filePath);
        const processed = await processDocxTemplate(buffer, metadata.data);

        const tempPath = path.join(offerDir, `temp_${fileInfo.file}`);
        await fs.writeFile(tempPath, processed);
        filesToMerge.push(tempPath);
      }

      // Wstaw produkty między pliki (jeśli injection_point)
      if (templateConfig.injection_point && metadata.selectedProducts.length > 0) {
        const insertIndex = templateConfig.files.findIndex(
          f => f.file === templateConfig.injection_point.before
        );

        const productFiles = [];
        for (const productId of metadata.selectedProducts) {
          const productPath = path.join(DIRS.products, `${productId}.docx`);
          if (fsSync.existsSync(productPath)) {
            productFiles.push(productPath);
          }
        }

        filesToMerge.splice(insertIndex, 0, ...productFiles);
      }

      // Scal wszystkie pliki
      await mergeDocxFiles(filesToMerge, finalDocxPath);

      // Cleanup temp files
      for (const file of filesToMerge) {
        if (file.includes('temp_')) {
          await fs.unlink(file).catch(() => {});
        }
      }
    }

    // Generuj PDF
    const pdfPath = path.join(offerDir, 'oferta_final.pdf');
    await convertDocxToPdf(finalDocxPath, pdfPath);

    // Generuj JPG podgląd (pierwsza strona)
    const jpgPath = path.join(offerDir, 'previews', 'preview_page1.jpg');
    await convertPdfToJpg(pdfPath, jpgPath);

    res.json({
      success: true,
      docxPath: `/oferty/${id}/oferta_final.docx`,
      pdfPath: `/oferty/${id}/oferta_final.pdf`,
      previewPath: `/oferty/${id}/previews/preview_page1.jpg`
    });

  } catch (err) {
    console.error('Błąd generowania:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/offers/:id/download - Pobieranie gotowej oferty
app.get('/api/offers/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'docx' } = req.query;

    const offerDir = path.join(DIRS.offers, id);
    const filePath = format === 'pdf'
      ? path.join(offerDir, 'oferta_final.pdf')
      : path.join(offerDir, 'oferta_final.docx');

    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Plik nie został jeszcze wygenerowany'
      });
    }

    res.download(filePath);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/offers/:id - Szczegóły oferty
app.get('/api/offers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const metaPath = path.join(DIRS.offers, id, 'metadata.json');
    const metaData = await fs.readFile(metaPath, 'utf-8');
    const metadata = JSON.parse(metaData);

    res.json({ success: true, offer: metadata });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/offers/:id - Usuwanie oferty
app.delete('/api/offers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const offerDir = path.join(DIRS.offers, id);

    await fs.rm(offerDir, { recursive: true, force: true });

    res.json({ success: true, message: 'Oferta usunięta' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Inicjalizacja i start serwera
async function startServer() {
  await initDirectories();

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║   🚀 GENERATOR OFERT - URUCHOMIONY            ║
╠════════════════════════════════════════════════╣
║   Serwer działa na: http://localhost:${PORT}     ║
║   Panel główny: http://localhost:${PORT}/        ║
╠════════════════════════════════════════════════╣
║   Foldery:                                     ║
║   - Szablony: ./templates                      ║
║   - Produkty: ./produkty                       ║
║   - Oferty: ./oferty                           ║
╚════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(err => {
  console.error('Błąd uruchamiania serwera:', err);
  process.exit(1);
});
