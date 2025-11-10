#!/usr/bin/env node

/**
 * Skrypt pomocniczy do instalacji i konfiguracji Unoserver
 * Uruchom: node setup-unoserver.js
 */

const { exec } = require('child_process');
const util = require('util');
const os = require('os');

const execPromise = util.promisify(exec);

const platform = os.platform();

console.log(`
╔════════════════════════════════════════════════╗
║   INSTALATOR UNOSERVER                        ║
║   System: ${platform.padEnd(36)}║
╚════════════════════════════════════════════════╝
`);

async function checkCommand(command) {
  try {
    await execPromise(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

async function checkUnoserver() {
  try {
    const { stdout } = await execPromise('unoconvert --version');
    console.log('✅ Unoserver jest zainstalowany:', stdout.trim());
    return true;
  } catch {
    console.log('❌ Unoserver NIE jest zainstalowany');
    return false;
  }
}

async function checkLibreOffice() {
  try {
    const commands = ['libreoffice', 'soffice'];
    for (const cmd of commands) {
      if (await checkCommand(cmd)) {
        console.log(`✅ LibreOffice jest zainstalowany (${cmd})`);
        return true;
      }
    }
    console.log('❌ LibreOffice NIE jest zainstalowany');
    return false;
  } catch {
    return false;
  }
}

async function checkPoppler() {
  if (await checkCommand('pdftoppm')) {
    console.log('✅ Poppler (pdftoppm) jest zainstalowany');
    return true;
  }
  console.log('❌ Poppler (pdftoppm) NIE jest zainstalowany');
  return false;
}

async function checkPdfTk() {
  if (await checkCommand('pdftk')) {
    console.log('✅ PDFtk jest zainstalowany');
    return true;
  }
  console.log('⚠️  PDFtk NIE jest zainstalowany (opcjonalne, dla multi_file)');
  return false;
}

function getInstallInstructions() {
  const instructions = {
    linux: `
╔════════════════════════════════════════════════╗
║   INSTRUKCJE INSTALACJI - LINUX               ║
╚════════════════════════════════════════════════╝

Uruchom następujące komendy:

1. Aktualizuj system:
   sudo apt update

2. Zainstaluj LibreOffice i narzędzia:
   sudo apt install -y libreoffice python3-pip poppler-utils pdftk

3. Zainstaluj Unoserver:
   pip3 install unoserver

4. Uruchom Unoserver:
   unoserver &

5. Uruchom ponownie ten skrypt aby sprawdzić instalację:
   node setup-unoserver.js
`,
    darwin: `
╔════════════════════════════════════════════════╗
║   INSTRUKCJE INSTALACJI - macOS               ║
╚════════════════════════════════════════════════╝

Uruchom następujące komendy:

1. Zainstaluj Homebrew (jeśli nie masz):
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

2. Zainstaluj wymagane narzędzia:
   brew install libreoffice poppler pdftk-java python3

3. Zainstaluj Unoserver:
   pip3 install unoserver

4. Uruchom Unoserver:
   unoserver &

5. Uruchom ponownie ten skrypt aby sprawdzić instalację:
   node setup-unoserver.js
`,
    win32: `
╔════════════════════════════════════════════════╗
║   INSTRUKCJE INSTALACJI - WINDOWS             ║
╚════════════════════════════════════════════════╝

1. Zainstaluj LibreOffice:
   https://www.libreoffice.org/download/download/

2. Zainstaluj Python:
   https://www.python.org/downloads/

3. Zainstaluj Poppler:
   https://github.com/oschwartz10612/poppler-windows/releases/
   Rozpakuj i dodaj bin/ do PATH

4. Zainstaluj Unoserver (w PowerShell/CMD):
   pip install unoserver

5. Uruchom Unoserver (w osobnym terminalu):
   unoserver

6. Uruchom ponownie ten skrypt aby sprawdzić instalację:
   node setup-unoserver.js
`
  };

  return instructions[platform] || instructions.linux;
}

async function startUnoserver() {
  console.log('\n🚀 Próba uruchomienia Unoserver...');

  try {
    // Sprawdź czy już działa
    const { stdout } = await execPromise('ps aux | grep unoserver | grep -v grep');
    if (stdout) {
      console.log('✅ Unoserver już działa!');
      return true;
    }
  } catch {
    // Nie działa, spróbuj uruchomić
  }

  try {
    if (platform === 'win32') {
      console.log('⚠️  Na Windows musisz uruchomić Unoserver ręcznie w osobnym terminalu:');
      console.log('   unoserver');
    } else {
      await execPromise('unoserver > /dev/null 2>&1 &');
      console.log('✅ Unoserver uruchomiony w tle');

      // Poczekaj chwilę i sprawdź
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { stdout } = await execPromise('ps aux | grep unoserver | grep -v grep');
      if (stdout) {
        console.log('✅ Unoserver działa poprawnie!');
        return true;
      }
    }
  } catch (err) {
    console.log('❌ Nie udało się uruchomić Unoserver automatycznie');
    console.log('   Uruchom ręcznie: unoserver &');
  }

  return false;
}

async function main() {
  console.log('Sprawdzanie wymaganych komponentów...\n');

  const hasLibreOffice = await checkLibreOffice();
  const hasUnoserver = await checkUnoserver();
  const hasPoppler = await checkPoppler();
  const hasPdfTk = await checkPdfTk();

  console.log('\n═══════════════════════════════════════════════\n');

  const allRequired = hasLibreOffice && hasUnoserver && hasPoppler;

  if (allRequired) {
    console.log('✅ Wszystkie wymagane komponenty są zainstalowane!');
    console.log('⚠️  PDFtk jest opcjonalny (tylko dla szablonów multi_file)');

    // Spróbuj uruchomić Unoserver
    console.log('\n═══════════════════════════════════════════════\n');
    await startUnoserver();

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 GOTOWE! Możesz uruchomić aplikację:');
    console.log('   npm install');
    console.log('   npm start');
    console.log('\n   Aplikacja będzie dostępna na: http://localhost:3000');
    console.log('═══════════════════════════════════════════════\n');
  } else {
    console.log('❌ Brakuje wymaganych komponentów!\n');
    console.log(getInstallInstructions());
  }
}

main().catch(err => {
  console.error('Błąd:', err);
  process.exit(1);
});
