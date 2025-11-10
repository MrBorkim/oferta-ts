# Instrukcja użytkowania - Offer Rendering API

## Wymagania systemowe

### Python
- Python 3.9 lub nowszy
- pip (menedżer pakietów Python)

### LibreOffice
LibreOffice jest wymagany do konwersji DOCX → PDF.

**macOS:**
```bash
brew install libreoffice
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install libreoffice
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install libreoffice
```

## Instalacja

### 1. Klonowanie repozytorium
```bash
git clone <repository-url>
cd oferta-ts
```

### 2. Utworzenie środowiska wirtualnego (opcjonalnie, ale zalecane)
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# lub
venv\Scripts\activate  # Windows
```

### 3. Instalacja zależności Python
```bash
pip install -r requirements.txt
```

### 4. Konfiguracja zmiennych środowiskowych
Skopiuj plik `.env.example` do `.env` i dostosuj wartości:

```bash
cp .env.example .env
```

Edytuj `.env`:
```bash
API_KEY=twoj_tajny_klucz_api
PORT=7077
HOST=0.0.0.0
TEMPLATES_ROOT=templates
PRODUCTS_ROOT=products
DPI=100
JPEG_QUALITY=85
```

## Uruchomienie serwera

### Metoda 1: Bezpośrednio
```bash
python3 offer_api.py
```

### Metoda 2: Przez uvicorn (zalecane dla produkcji)
```bash
uvicorn offer_api:app --host 0.0.0.0 --port 7077 --reload
```

Serwer uruchomi się na `http://localhost:7077`

## Sprawdzenie stanu serwera

Endpoint health check:
```bash
curl http://localhost:7077/health
```

Odpowiedź:
```json
{
  "status": "ok",
  "libreoffice_available": true,
  "templates_root": "/path/to/templates",
  "products_root": "/path/to/products",
  "dpi": 100,
  "jpeg_quality": 85
}
```

## Użycie API

### Renderowanie oferty - zwrot ZIP

```bash
curl -X POST http://localhost:7077/render \
  -H "X-API-Key: devkey" \
  -H "Content-Type: application/json" \
  -d @examples/request_oferta_podstawowa.json \
  -o oferta.zip
```

### Renderowanie oferty - tylko pierwsza strona jako JPG

```bash
curl -X POST http://localhost:7077/render \
  -H "X-API-Key: devkey" \
  -H "Content-Type: application/json" \
  -d @examples/request_first_page_only.json \
  -o pierwsza_strona.jpg
```

### Przykładowy request w Python

```python
import requests
import json

url = "http://localhost:7077/render"
headers = {
    "X-API-Key": "devkey",
    "Content-Type": "application/json"
}

payload = {
    "template": "oferta-podstawowa",
    "placeholders": {
        "KLIENT(NIP)": "1234567890",
        "Oferta z dnia": "10.11.2024",
        "waznado": "24.11.2024",
        "firmaM": "Moja Firma Sp. z o.o.",
        "temat": "Wdrożenie CRM",
        "kategoria": "IT",
        "opis": "Opis projektu...",
        "cena": 50000,
        "RBG": 100,
        "uzasadnienie": "Uzasadnienie..."
    },
    "products": [
        {
            "product_id": "1",
            "page": 1,
            "slot": "hero",
            "sequence": 1,
            "data": {
                "product_name": "Analiza przedwdrożeniowa",
                "product_price": 10000
            }
        }
    ],
    "return_mode": "zip"  # lub "first_page_inline"
}

response = requests.post(url, headers=headers, json=payload)

if response.status_code == 200:
    # Zapisz ZIP
    with open("oferta.zip", "wb") as f:
        f.write(response.content)
    print("Oferta wygenerowana pomyślnie!")
else:
    print(f"Błąd: {response.status_code}")
    print(response.json())
```

## Struktura projektu

```
oferta-ts/
├── offer_api.py              # Główny serwer FastAPI
├── requirements.txt          # Zależności Python
├── .env.example             # Przykładowa konfiguracja
├── .env                     # Twoja konfiguracja (nie commitowana)
├── README.md                # Instrukcje techniczne
├── USAGE.md                 # Instrukcje użytkowania
│
├── templates/               # Szablony ofert
│   ├── oferta-podstawowa/
│   │   ├── oferta1.docx
│   │   ├── oferta1.json     # Konfiguracja placeholders
│   │   └── templates.json   # Metadane szablonu
│   └── wolftax-oferta/
│       ├── Dok1.docx        # Strona tytułowa
│       ├── Doc2.docx        # Wprowadzenie
│       ├── doc3.docx        # Spis treści
│       ├── doc4.docx        # Podsumowanie
│       ├── Dok5.docx        # Warunki
│       ├── Dok6.docx        # Strona końcowa
│       └── wolftax.json     # Konfiguracja placeholders
│
├── products/                # Produkty/usługi
│   ├── 1/
│   │   ├── 1.docx
│   │   └── config.json
│   ├── 2/
│   │   ├── 2.docx
│   │   └── config.json
│   └── ... (3-8)
│
└── examples/                # Przykładowe requesty
    ├── request_oferta_podstawowa.json
    ├── request_wolftax.json
    └── request_first_page_only.json
```

## Format requestu

### Pełny schemat JSON

```json
{
  "template": "nazwa-folderu-szablonu",
  "placeholders": {
    "placeholder_key": "wartość",
    "data_oferty": "10.11.2024",
    "cena": 50000
  },
  "products": [
    {
      "product_id": "1",
      "page": 1,
      "slot": "hero",
      "sequence": 1,
      "image": "cover.jpg",
      "data": {
        "product_name": "Nazwa produktu",
        "product_price": 10000,
        "quantity": 1,
        "custom_field": "wartość"
      }
    }
  ],
  "return_mode": "zip"
}
```

### Parametry

- **template** (wymagane) - nazwa folderu w `templates/`
- **placeholders** (opcjonalne) - słownik z wartościami do podstawienia w szablonie głównym
- **products** (opcjonalne) - lista produktów do wstawienia
  - **product_id** - ID produktu (folder w `products/`)
  - **page** - numer strony (do warunkowania w Jinja)
  - **slot** - slot pozycji (hero, main, grid_1, etc.)
  - **sequence** - kolejność
  - **image** - nazwa pliku obrazu (domyślnie cover.jpg)
  - **data** - dane specyficzne dla produktu
- **return_mode** - tryb zwracania:
  - `"zip"` (domyślnie) - ZIP z wszystkimi stronami
  - `"first_page_inline"` - tylko pierwsza strona jako JPG

## Tworzenie szablonów DOCX

### Placeholders (zmienne)
W DOCX używaj składni Jinja2:

```
{{ data.client_name }}
{{ data.offer_date }}
{{ data.total_price }}
```

### Pętle po produktach
```
{% for p in products if p.page == 1 and p.slot == "hero" %}
  Nazwa: {{ p.data.product_name }}
  Cena: {{ p.data.product_price }} PLN
{% endfor %}
```

### Wstawianie obrazów
```
{% if p.image_abs %}
  {% set img = InlineImage(doc, p.image_abs, width=Mm(120)) %}
  {{ img }}
{% endif %}
```

### Warunki
```
{% if data.total_price > 50000 %}
  Oferta premium
{% else %}
  Oferta standardowa
{% endif %}
```

## Rozwiązywanie problemów

### LibreOffice nie znaleziony
```
LibreOffice not found. Install: brew install libreoffice (macOS) or apt-get install libreoffice (Linux)
```
**Rozwiązanie:** Zainstaluj LibreOffice zgodnie z instrukcjami powyżej.

### Błąd 401 - Invalid API Key
```
{"detail": "Invalid or missing X-API-Key"}
```
**Rozwiązanie:** Dodaj header `X-API-Key` z wartością z pliku `.env`

### Szablon nie znaleziony
```
{"detail": "Template folder not found: nazwa-szablonu"}
```
**Rozwiązanie:** Sprawdź czy folder z szablonem istnieje w `templates/`

### Produkt nie znaleziony
```
{"detail": "Product directory not found: product_id"}
```
**Rozwiązanie:** Sprawdź czy folder produktu istnieje w `products/`

## Testowanie

### Test 1: Health check
```bash
curl http://localhost:7077/health
```

### Test 2: Podstawowa oferta (ZIP)
```bash
curl -X POST http://localhost:7077/render \
  -H "X-API-Key: devkey" \
  -H "Content-Type: application/json" \
  -d @examples/request_oferta_podstawowa.json \
  -o test_oferta.zip

# Rozpakuj i zobacz strony
unzip test_oferta.zip -d test_output/
open test_output/page_001.jpg  # macOS
# lub
xdg-open test_output/page_001.jpg  # Linux
```

### Test 3: Tylko pierwsza strona
```bash
curl -X POST http://localhost:7077/render \
  -H "X-API-Key: devkey" \
  -H "Content-Type: application/json" \
  -d @examples/request_first_page_only.json \
  -o first_page.jpg

open first_page.jpg  # Zobacz wygenerowany obraz
```

## Wsparcie

W razie problemów:
1. Sprawdź logi serwera
2. Sprawdź endpoint `/health`
3. Zweryfikuj format JSON requestu
4. Upewnij się że LibreOffice działa: `libreoffice --version`

---

**Wygenerowane przez Claude Code**
https://claude.com/claude-code
