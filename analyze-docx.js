#!/usr/bin/env node

/**
 * Narzędzie diagnostyczne do analizy tagów w DOCX
 */

const PizZip = require('pizzip');
const fs = require('fs');

function analyzeDocxTags(filePath) {
  console.log(`\n🔍 Analiza tagów w: ${filePath}\n`);

  const content = fs.readFileSync(filePath);
  const zip = new PizZip(content);

  const docXml = zip.file('word/document.xml');
  if (!docXml) {
    console.error('❌ Nie znaleziono word/document.xml');
    return;
  }

  const xmlContent = docXml.asText();

  // Znajdź wszystkie {{ i }}
  const openTags = [];
  const closeTags = [];

  let idx = 0;
  while ((idx = xmlContent.indexOf('{{', idx)) !== -1) {
    openTags.push(idx);
    idx += 2;
  }

  idx = 0;
  while ((idx = xmlContent.indexOf('}}', idx)) !== -1) {
    closeTags.push(idx);
    idx += 2;
  }

  console.log(`Znaleziono:`);
  console.log(`  {{ : ${openTags.length} wystąpień`);
  console.log(`  }} : ${closeTags.length} wystąpień`);

  if (openTags.length !== closeTags.length) {
    console.log(`\n⚠️  PROBLEM: Nierówna liczba otwierających i zamykających tagów!\n`);
  }

  // Pokaż kontekst każdego tagu
  console.log(`\n📋 Szczegóły tagów:\n`);

  const allPositions = [
    ...openTags.map(pos => ({ pos, type: 'open' })),
    ...closeTags.map(pos => ({ pos, type: 'close' }))
  ].sort((a, b) => a.pos - b.pos);

  allPositions.forEach(({ pos, type }, idx) => {
    const start = Math.max(0, pos - 50);
    const end = Math.min(xmlContent.length, pos + 50);
    const context = xmlContent.substring(start, end);
    const marker = type === 'open' ? '{{' : '}}';

    console.log(`${idx + 1}. [${type.toUpperCase()}] Pozycja: ${pos}`);
    console.log(`   Kontekst: ...${context}...`);
    console.log('');
  });

  // Wyciągnij wszystkie <w:t> elementy
  console.log(`\n📄 Wszystkie elementy <w:t> zawierające {{ lub }}:\n`);

  const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  let wtIdx = 1;

  while ((match = wtRegex.exec(xmlContent)) !== null) {
    const text = match[1];
    if (text.includes('{{') || text.includes('}}')) {
      console.log(`${wtIdx}. "${text}" (pozycja: ${match.index})`);
      wtIdx++;
    }
  }

  // Zapisz XML do pliku dla ręcznej analizy
  const outputPath = filePath.replace('.docx', '_document.xml');
  fs.writeFileSync(outputPath, xmlContent);
  console.log(`\n💾 XML zapisany do: ${outputPath}`);
}

if (require.main === module) {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log('Użycie: node analyze-docx.js <plik.docx>');
    process.exit(1);
  }

  analyzeDocxTags(filePath);
}

module.exports = { analyzeDocxTags };
