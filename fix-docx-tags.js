#!/usr/bin/env node

/**
 * Narzędzie do naprawy rozdzielonych tagów {{}} w plikach DOCX
 * Użycie: node fix-docx-tags.js <ścieżka-do-pliku.docx>
 */

const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

function fixBrokenTagsAdvanced(xmlContent) {
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
      const runAttrs = runMatch[1];
      const runContent = runMatch[2];

      // Wyciągnij wszystkie teksty z <w:t>
      const texts = [];
      const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let textMatch;

      while ((textMatch = textRegex.exec(runContent)) !== null) {
        texts.push(textMatch[1]);
      }

      runs.push({
        attrs: runAttrs,
        text: texts.join(''),
        original: runMatch[0]
      });
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

function fixDocxFile(inputPath) {
  try {
    console.log(`\n🔧 Naprawiam plik: ${inputPath}`);

    // Wczytaj DOCX
    const content = fs.readFileSync(inputPath);
    const zip = new PizZip(content);

    let fixed = false;

    // Pliki do naprawy
    const xmlFiles = [
      'word/document.xml',
      'word/header1.xml',
      'word/header2.xml',
      'word/footer1.xml',
      'word/footer2.xml'
    ];

    xmlFiles.forEach(fileName => {
      try {
        const fileContent = zip.file(fileName);
        if (fileContent) {
          const xmlContent = fileContent.asText();

          // Sprawdź czy zawiera rozdzielone tagi
          if (xmlContent.includes('{{') || xmlContent.includes('}}')) {
            console.log(`   ✓ Znaleziono placeholdery w ${fileName}`);

            const fixedContent = fixBrokenTagsAdvanced(xmlContent);
            zip.file(fileName, fixedContent);
            fixed = true;

            console.log(`   ✓ Naprawiono ${fileName}`);
          }
        }
      } catch (err) {
        // Plik nie istnieje
      }
    });

    if (fixed) {
      // Zapisz naprawiony plik
      const outputPath = inputPath.replace('.docx', '_FIXED.docx');
      const newContent = zip.generate({ type: 'nodebuffer' });
      fs.writeFileSync(outputPath, newContent);

      console.log(`\n✅ Plik naprawiony i zapisany jako: ${outputPath}`);
      console.log(`💡 Zastąp oryginalny plik naprawionym:\n`);
      console.log(`   mv "${outputPath}" "${inputPath}"\n`);

      return outputPath;
    } else {
      console.log(`\n⚠️  Nie znaleziono rozdzielonych tagów w pliku.`);
      return null;
    }
  } catch (err) {
    console.error(`\n❌ Błąd: ${err.message}`);
    return null;
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════╗
║   NARZĘDZIE DO NAPRAWY DOCX                   ║
╚════════════════════════════════════════════════╝

Użycie:
  node fix-docx-tags.js <plik.docx>

Przykład:
  node fix-docx-tags.js templates/oferta-podstawowa/oferta1.docx

Narzędzie naprawia rozdzielone placeholdery {{}} w plikach DOCX.
Word często rozbija tagi na wiele elementów XML, co powoduje błędy.
    `);
    process.exit(1);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Plik nie istnieje: ${filePath}`);
    process.exit(1);
  }

  if (!filePath.endsWith('.docx')) {
    console.error(`❌ Plik musi mieć rozszerzenie .docx`);
    process.exit(1);
  }

  fixDocxFile(filePath);
}

module.exports = { fixDocxFile, fixBrokenTagsAdvanced };
