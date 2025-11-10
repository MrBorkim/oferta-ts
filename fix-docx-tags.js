#!/usr/bin/env node

/**
 * Narzędzie do naprawy rozdzielonych tagów {{}} w plikach DOCX
 * Użycie: node fix-docx-tags.js <ścieżka-do-pliku.docx>
 */

const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

function fixBrokenTagsAdvanced(xmlContent) {
  // Usuń wszystkie elementy które rozbijają tagi
  xmlContent = xmlContent.replace(/<w:proofErr[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:bookmarkStart[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:bookmarkEnd[^>]*\/>/g, '');
  xmlContent = xmlContent.replace(/<w:noBreakHyphen\/>/g, '');

  // Znajdź wszystkie paragrafy i scal <w:t> elementy
  xmlContent = xmlContent.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    // Sprawdź czy zawiera {{ lub }}
    if (!paragraph.includes('{{') && !paragraph.includes('}}')) {
      return paragraph;
    }

    // Ekstrahuj wszystkie teksty z <w:t>
    const texts = [];
    const textRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(paragraph)) !== null) {
      texts.push(match[1]);
    }

    // Połącz wszystkie teksty
    const fullText = texts.join('');

    // Znajdź strukturę paragrafu bez <w:r> elementów
    const beforeRuns = paragraph.match(/^<w:p\b[^>]*>[\s\S]*?(?=<w:r\b)/);
    const afterRuns = paragraph.match(/<\/w:r>[\s\S]*?<\/w:p>$/);

    if (beforeRuns && afterRuns) {
      // Zbuduj nowy paragraf z jednym <w:r> i jednym <w:t>
      const before = beforeRuns[0];
      const after = afterRuns[0].replace(/<\/w:r>/, '');

      return `${before}<w:r><w:t xml:space="preserve">${fullText}</w:t></w:r>${after}`;
    }

    return paragraph;
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
