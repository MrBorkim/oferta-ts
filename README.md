# 📄 Generator Ofert - System zarządzania szablonami DOCX

Profesjonalny system do tworzenia ofert komercyjnych z szablonów DOCX z podglądem w czasie rzeczywistym.

## 🚀 Funkcje

- ✅ **Wybór szablonu** - Obsługa wielu szablonów ofert (jednoplikowe i wielostronicowe)
- ✅ **Dwupanelowy interfejs** - Formularz po lewej, podgląd po prawej
- ✅ **Placeholdery {{}}** - Automatyczne wypełnianie danych w dokumentach
- ✅ **Produkty DOCX** - Dynamiczne wstawianie produktów do oferty
- ✅ **Podgląd w czasie rzeczywistym** - Natychmiastowa wizualizacja PDF/JPG
- ✅ **Auto-zapis** - Automatyczne zapisywanie zmian
- ✅ **Organizacja sekcji** - Rozwijane/zwijane grupy pól formularza
- ✅ **Eksport DOCX/PDF** - Pobieranie gotowych dokumentów
- ✅ **Indywidualne foldery** - Każda oferta w osobnym folderze

## 📁 Struktura projektu

```
oferta-ts/
├── templates/              # Szablony ofert
│   ├── oferta-podstawowa/  # Szablon AIDROPS
│   │   ├── oferta1.docx
│   │   ├── oferta1.json
│   │   └── templates.json
│   └── wolftax-oferta/     # Szablon WolfTax (wielostronicowy)
│       ├── Dok1.docx - Dok6.docx
│       └── ...
├── produkty/               # Pliki produktów DOCX
│   └── 1.docx - 8.docx
├── oferty/                 # Zapisane oferty (generowane)
│   └── [nazwa-oferty]/
│       ├── metadata.json
│       ├── oferta_final.docx
│       ├── oferta_final.pdf
│       └── previews/
├── static-previews/        # Statyczne podglądy szablonów
├── public/                 # Frontend aplikacji
│   └── index.html
├── server.js               # Serwer Express
├── package.json
└── README.md
```

## 🛠️ Instalacja

### 1. Wymagania systemowe

- **Node.js** (v16 lub nowszy) - [Pobierz tutaj](https://nodejs.org/)
- **Unoserver** - do konwersji DOCX → PDF
- **pdftoppm** (część poppler-utils) - do konwersji PDF → JPG
- **pdftk** - do scalania plików PDF (opcjonalne, dla szablonów wieloplikowych)

### 2. Instalacja Unoserver i narzędzi

#### Linux (Ubuntu/Debian)

```bash
# Zainstaluj LibreOffice i Python
sudo apt update
sudo apt install -y libreoffice python3-pip poppler-utils pdftk

# Zainstaluj Unoserver
pip3 install unoserver

# Uruchom Unoserver w tle
unoserver &
```

#### macOS

```bash
# Zainstaluj Homebrew (jeśli nie masz)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Zainstaluj wymagane narzędzia
brew install libreoffice poppler pdftk-java python3

# Zainstaluj Unoserver
pip3 install unoserver

# Uruchom Unoserver
unoserver &
```

#### Windows

```powershell
# 1. Zainstaluj LibreOffice: https://www.libreoffice.org/download/download/
# 2. Zainstaluj Python: https://www.python.org/downloads/
# 3. Zainstaluj poppler: https://github.com/oschwartz10612/poppler-windows/releases/

# Zainstaluj Unoserver
pip install unoserver

# Uruchom Unoserver w osobnym terminalu
unoserver
```

### 3. Instalacja projektu

```bash
# Sklonuj repozytorium (jeśli jeszcze tego nie zrobiłeś)
cd oferta-ts

# Zainstaluj zależności Node.js
npm install

# Uruchom serwer
npm start
```

Serwer uruchomi się na **http://localhost:3000**

### 4. Tryb deweloperski (z auto-restartowaniem)

```bash
npm run dev
```

## 📖 Jak używać?

### Krok 1: Uruchom aplikację

```bash
npm start
```

Otwórz w przeglądarce: **http://localhost:3000**

### Krok 2: Utwórz nową ofertę

1. Kliknij przycisk **"Nowa Oferta"**
2. Podaj nazwę oferty (np. "Oferta dla Klienta ABC")
3. Wybierz szablon (AIDROPS lub WolfTax)
4. Kliknij **"Utwórz ofertę"**

### Krok 3: Wypełnij dane

1. **Lewa strona** - Wypełnij pola formularza:
   - Dane podstawowe (NIP, nazwa firmy, daty)
   - Szczegóły zlecenia (temat, opis)
   - Dane finansowe (cena, limit RBG)
   - Produkty (zaznacz z listy)

2. **Sekcje rozwijane** - Kliknij nagłówek sekcji aby zwinąć/rozwinąć

3. **Auto-zapis** - Dane zapisują się automatycznie

### Krok 4: Generuj podgląd

1. Kliknij **"🔄 Generuj podgląd"**
2. **Prawa strona** - Pojawi się podgląd PDF dokumentu
3. Sprawdź poprawność danych

### Krok 5: Pobierz dokument

- **💾 Pobierz DOCX** - Edytowalny dokument Word
- **📄 Pobierz PDF** - Dokument do druku/wysyłki

## 🎨 Dodawanie nowych szablonów

### Szablon jednoplikowy (jak AIDROPS)

1. **Stwórz plik DOCX** z placeholderami `{{nazwa_pola}}`
   ```
   Przykład: NIP: {{KLIENT(NIP)}}
   Data: {{Oferta z dnia}}
   ```

2. **Dodaj folder w `templates/`**
   ```
   templates/
   └── moj-szablon/
       ├── szablon.docx
       ├── szablon.json
       └── (opcjonalnie) templates.json
   ```

3. **Stwórz plik `szablon.json`**
   ```json
   {
     "name": "Mój szablon",
     "description": "Opis szablonu",
     "template_file": "szablon.docx",
     "placeholders": {
       "KLIENT(NIP)": {
         "label": "NIP klienta",
         "type": "text",
         "required": true
       },
       "opis": {
         "label": "Opis zlecenia",
         "type": "textarea"
       }
     }
   }
   ```

4. **Dodaj do `templates.json`** (w głównym folderze szablonów)
   ```json
   {
     "templates": [
       {
         "id": "moj-szablon",
         "name": "Mój szablon",
         "description": "Opis szablonu",
         "type": "single_file",
         "folder": "moj-szablon",
         "main_file": "szablon.docx",
         "config_file": "szablon.json",
         "supports_products": true
       }
     ]
   }
   ```

### Szablon wieloplikowy (jak WolfTax)

1. **Stwórz osobne pliki DOCX** dla każdej strony
   ```
   templates/
   └── wielostronicowy/
       ├── strona1.docx  (tytuł)
       ├── strona2.docx  (treść)
       ├── strona3.docx  (podsumowanie)
       └── ...
   ```

2. **Dodaj konfigurację w `templates.json`**
   ```json
   {
     "id": "wielostronicowy",
     "type": "multi_file",
     "folder": "wielostronicowy",
     "files": [
       {"file": "strona1.docx", "order": 1, "name": "Tytuł"},
       {"file": "strona2.docx", "order": 2, "name": "Treść"},
       {"file": "strona3.docx", "order": 3, "name": "Podsumowanie"}
     ],
     "supports_products": true,
     "injection_point": {
       "type": "between_files",
       "after": "strona2.docx",
       "before": "strona3.docx"
     }
   }
   ```

## 🔧 API Endpoints

### Szablony
- `GET /api/templates` - Lista wszystkich szablonów
- `GET /api/templates/:id` - Szczegóły szablonu

### Produkty
- `GET /api/products` - Lista dostępnych produktów

### Oferty
- `GET /api/offers` - Lista zapisanych ofert
- `GET /api/offers/:id` - Szczegóły oferty
- `POST /api/offers/create` - Tworzenie nowej oferty
- `POST /api/offers/:id/update` - Aktualizacja danych
- `POST /api/offers/:id/generate` - Generowanie dokumentu
- `GET /api/offers/:id/download?format=docx|pdf` - Pobieranie
- `DELETE /api/offers/:id` - Usuwanie oferty

## 🔧 Naprawa szablonów DOCX

Jeśli widzisz błędy typu "Duplicate open tag" lub "Duplicate close tag":

### Automatyczna naprawa wszystkich szablonów
```bash
node fix-all-templates.js
```

### Naprawa pojedynczego pliku
```bash
node fix-docx-tags.js templates/oferta-podstawowa/oferta1.docx
```

**Problem:** Word często rozbija placeholdery `{{placeholder}}` na wiele elementów XML podczas edycji.
**Rozwiązanie:** Nasze narzędzie automatycznie łączy rozdzielone tagi.

## 🐛 Rozwiązywanie problemów

### Unoserver nie działa

```bash
# Sprawdź czy Unoserver jest uruchomiony
ps aux | grep unoserver

# Jeśli nie - uruchom ponownie
unoserver &

# Sprawdź port (domyślnie 2002)
lsof -i :2002
```

### Błąd konwersji PDF → JPG

```bash
# Zainstaluj poppler-utils
sudo apt install poppler-utils  # Linux
brew install poppler            # macOS
```

### Błąd scalania plików PDF (multi_file)

```bash
# Zainstaluj pdftk
sudo apt install pdftk          # Linux
brew install pdftk-java         # macOS
```

### Port 3000 zajęty

Zmień port w pliku `server.js`:
```javascript
const PORT = 3001; // Zmień na inny port
```

## 📝 Typy pól formularza

| Typ | Opis | Przykład |
|-----|------|----------|
| `text` | Pole tekstowe | Nazwa firmy |
| `textarea` | Obszar tekstowy (większy) | Opis zlecenia |
| `date` | Data | 2024-01-01 |
| `number` | Liczba | Cena, RBG |
| `list_of_docx` | Lista produktów DOCX | Wybór wielokrotny |

## 🔐 Bezpieczeństwo

- ⚠️ Aplikacja **NIE** jest zabezpieczona autoryzacją
- ⚠️ Nie udostępniaj serwera publicznie bez dodania uwierzytelniania
- ✅ Używaj w sieci lokalnej lub za firewallem
- ✅ W produkcji dodaj JWT/sesje użytkowników

## 🚀 Wdrożenie do produkcji

### Użyj PM2 do zarządzania procesem

```bash
# Zainstaluj PM2
npm install -g pm2

# Uruchom aplikację
pm2 start server.js --name oferta-generator

# Auto-restart przy restarcie systemu
pm2 startup
pm2 save
```

### Użyj Nginx jako reverse proxy

```nginx
server {
    listen 80;
    server_name oferty.twoja-domena.pl;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📦 Integracja z istniejącą aplikacją

System został zaprojektowany jako samodzielny moduł:

1. **Backend** - `server.js` można zaimportować jako middleware Express
2. **Frontend** - `public/index.html` można osadzić w istniejącej aplikacji
3. **API** - RESTful API można konsumować z dowolnego frontendu

Przykład integracji:
```javascript
// app.js - Twoja główna aplikacja
const express = require('express');
const ofertaRouter = require('./oferta-ts/server');

const app = express();
app.use('/oferty', ofertaRouter); // Montuj moduł pod ścieżką /oferty
```

## 🎯 Roadmap / Przyszłe funkcje

- [ ] System użytkowników i autoryzacji
- [ ] Historia wersji dokumentów
- [ ] Szablony email do wysyłki ofert
- [ ] Eksport do innych formatów (ODT, RTF)
- [ ] Masowe generowanie ofert (z CSV)
- [ ] Podpis elektroniczny dokumentów
- [ ] Integracja z systemami CRM

## 📄 Licencja

MIT License - Wolne do użytku komercyjnego i prywatnego.

## 👨‍💻 Wsparcie

W razie problemów:
1. Sprawdź czy Unoserver działa: `ps aux | grep unoserver`
2. Sprawdź logi serwera w konsoli
3. Sprawdź logi przeglądarki (F12 → Console)

---

**Stworzono dla projektu oferta-ts**
Wersja: 1.0.0
Data: 2024
