#!/usr/bin/env node

/**
 * Skrypt naprawiający wszystkie szablony DOCX w projekcie
 * Uruchom: node fix-all-templates.js
 */

const fs = require('fs');
const path = require('path');
const { fixDocxFile } = require('./fix-docx-tags');

async function findAllDocxFiles(dir) {
  const files = [];

  function scanDir(directory) {
    const items = fs.readdirSync(directory);

    items.forEach(item => {
      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (item.endsWith('.docx') && !item.startsWith('~$') && !item.includes('_FIXED')) {
        files.push(fullPath);
      }
    });
  }

  scanDir(dir);
  return files;
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════╗
║   NAPRAWA WSZYSTKICH SZABLONÓW DOCX           ║
╚════════════════════════════════════════════════╝
  `);

  // Znajdź wszystkie DOCX w templates/
  console.log('🔍 Szukam plików DOCX...\n');

  const templatesDir = './templates';
  const docxFiles = await findAllDocxFiles(templatesDir);

  console.log(`Znaleziono ${docxFiles.length} plików DOCX:\n`);
  docxFiles.forEach((file, idx) => {
    console.log(`  ${idx + 1}. ${file}`);
  });

  console.log('\n' + '═'.repeat(50) + '\n');

  // Napraw każdy plik
  let fixedCount = 0;
  const fixedFiles = [];

  for (const file of docxFiles) {
    const result = fixDocxFile(file);
    if (result) {
      fixedCount++;
      fixedFiles.push({ original: file, fixed: result });
    }
  }

  console.log('\n' + '═'.repeat(50) + '\n');

  if (fixedCount > 0) {
    console.log(`✅ Naprawiono ${fixedCount} plików!\n`);

    console.log('📝 Pliki naprawione:');
    fixedFiles.forEach(({ original, fixed }) => {
      console.log(`   ${fixed}`);
    });

    console.log('\n💡 Aby zastąpić oryginalne pliki, uruchom:\n');
    fixedFiles.forEach(({ original, fixed }) => {
      console.log(`   mv "${fixed}" "${original}"`);
    });

    console.log('\n🚀 Lub wszystkie na raz:\n');
    console.log('   node -e "' +
      fixedFiles.map(({ original, fixed }) =>
        `require('fs').renameSync('${fixed}', '${original}')`
      ).join('; ') +
    '"\n');

  } else {
    console.log('✅ Wszystkie pliki są OK! Nie wymagają naprawy.\n');
  }
}

main().catch(err => {
  console.error('❌ Błąd:', err);
  process.exit(1);
});
