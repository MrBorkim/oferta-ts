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
  // KROK 1: Usuń wszystkie elementy które rozbijają tagi
  xmlContent = xmlContent.replace(/<w:proofErr[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:bookmarkStart[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:bookmarkEnd[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:noBreakHyphen\/>/g, '');
  xmlContent = xmlContent.replace(/<w:softHyphen\/>/g, '');

  // KROK 2: Scal wszystkie <w:t> elementy w ramach jednego paragrafu
  xmlContent = xmlContent.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (fullMatch, pAttrs, pContent) => {
    // Sprawdź czy zawiera {{ lub }}
    if (!pContent.includes('{{') && !pContent.includes('}}')) {
      return fullMatch;
    }

    // Ekstrahuj wszystkie <w:r> bloki
    const runs = [];
    const runRegex = /<w:r\b([^>]*)>([\s\S]*?)<\/w:r>/g;
    let runMatch;

    while ((runMatch = runRegex.exec(pContent)) !== null) {
      const runContent = runMatch[2];

      // Wyciągnij wszystkie teksty z <w:t>
      const texts = [];
      const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let textMatch;

      while ((textMatch = textRegex.exec(runContent)) !== null) {
        texts.push(textMatch[1]);
      }

      runs.push({ text: texts.join('') });
    }

    // Połącz wszystkie teksty ze wszystkich runs
    const allText = runs.map(r => r.text).join('');

    // Znajdź elementy przed runs (np. <w:pPr>)
    const beforeRuns = pContent.match(/^[\s\S]*?(?=<w:r\b)/);
    const before = beforeRuns ? beforeRuns[0] : '';

    // Znajdź elementy po runs
    const afterRunsMatch = pContent.match(/<\/w:r>([\s\S]*)$/);
    const after = afterRunsMatch ? afterRunsMatch[1] : '';

    // Zbuduj nowy paragraf z jednym run i jednym text
    return `<w:p${pAttrs}>${before}<w:r><w:t xml:space="preserve">${allText}</w:t></w:r>${after}</w:p>`;
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
  // STRATEGIA: Używamy prostego zastępowania tekstu
  // Nasze pliki DOCX mają bardzo rozdzielone/zduplikowane tagi, więc docxtemplater nie działa

  console.log('📝 Przetwarzanie DOCX metodą prostego zastępowania...');

  try {
    const zip = new PizZip(templateBuffer);
    const docXml = zip.file('word/document.xml');

    if (!docXml) {
      throw new Error('Brak word/document.xml w pliku DOCX');
    }

    let xmlContent = docXml.asText();

    // Zastąp każdy placeholder wartością
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;

      const stringValue = String(value);

      // Wszystkie możliwe warianty tagu (rozbite, ze spacjami, etc.)
      const variants = [
        `{{${key}}}`,           // normalny
        `{{ ${key} }}`,         // ze spacjami
        `{{  ${key}  }}`,       // z większymi spacjami
        `{${key}}`,             // brakujący {
        `${key}}}`,             // brakujący {{
        `{{${key}`,             // brakujący }}
      ];

      for (const variant of variants) {
        // Escape special regex characters
        const escaped = variant.replace(/[{}]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        const matches = xmlContent.match(regex);
        if (matches) {
          console.log(`   ✓ Zastępuję "${variant}" → "${stringValue}" (${matches.length}x)`);
          xmlContent = xmlContent.replace(regex, stringValue);
        }
      }
    }

    // Zaktualizuj plik XML w ZIP
    zip.file('word/document.xml', xmlContent);

    console.log('✅ Dokument przetworzony pomyślnie');
    return zip.generate({ type: 'nodebuffer' });

  } catch (err) {
    console.error('❌ Błąd przetwarzania DOCX:', err.message);
    throw err;
  }
}

// Konwersja DOCX do PDF/JPG przez Unoserver
async function convertDocxToPdf(docxPath, outputPdfPath) {
  try {
    // Sprawdź czy unoserver działa
    const command = `unoconvert --convert-to pdf "${docxPath}" "${outputPdfPath}"`;
    await execPromise(command, { timeout: 30000 });
    console.log('✅ PDF wygenerowany:', outputPdfPath);
    return outputPdfPath;
  } catch (err) {
    console.warn('⚠️  Unoserver niedostępny - pomijam konwersję do PDF');
    // NIE rzucaj błędu - zwróć null
    return null;
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
// UWAGA: Funkcja uproszczona - obecnie KOPIUJE tylko pierwszy plik
// Pełne scalanie wymaga Unoserver lub python-docx
async function mergeDocxFiles(filePaths, outputPath) {
  try {
    console.log(`📦 Scalanie ${filePaths.length} plików DOCX...`);

    // PROSTE ROZWIĄZANIE: Skopiuj pierwszy plik jako wynik
    // (Pełne scalanie wielostronicowych szablonów będzie dodane później)
    if (filePaths.length > 0) {
      const firstFile = filePaths[0];
      await fs.copyFile(firstFile, outputPath);
      console.log(`✅ Plik główny skopiowany: ${firstFile} → ${outputPath}`);

      // Cleanup temp files
      for (const file of filePaths) {
        if (file.includes('temp_')) {
          await fs.unlink(file).catch(() => {});
        }
      }

      return outputPath;
    }

    throw new Error('Brak plików do scalenia');
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

    // Generuj PDF (opcjonalnie - jeśli Unoserver działa)
    const pdfPath = path.join(offerDir, 'oferta_final.pdf');
    const pdfResult = await convertDocxToPdf(finalDocxPath, pdfPath);

    let jpgPath = null;
    if (pdfResult) {
      // Generuj JPG podgląd (pierwsza strona) - tylko jeśli PDF istnieje
      jpgPath = path.join(offerDir, 'previews', 'preview_page1.jpg');
      await convertPdfToJpg(pdfResult, jpgPath);
    }

    res.json({
      success: true,
      docxPath: `/oferty/${id}/oferta_final.docx`,
      pdfPath: pdfResult ? `/oferty/${id}/oferta_final.pdf` : null,
      previewPath: jpgPath ? `/oferty/${id}/previews/preview_page1.jpg` : null,
      message: pdfResult ? 'Dokument wygenerowany z PDF' : 'Dokument wygenerowany (DOCX) - Unoserver niedostępny'
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
