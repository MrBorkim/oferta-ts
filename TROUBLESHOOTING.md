# Rozwiązywanie problemów

## Problem: "Opening and ending tag mismatch" w docxtpl

### Przyczyna
Word rozbija tagi Jinja2 (`{{ }}`, `{% %}`) na wiele fragmentów XML podczas formatowania, co powoduje błędy parsowania.

### Rozwiązanie

#### Opcja 1: Automatyczna naprawa (ZALECANE)

Użyj narzędzia `fix_docx_template.py`:

```bash
# 1. Przeanalizuj szablon
python3 fix_docx_template.py templates/oferta-podstawowa/oferta1.docx --analyze

# 2. Napraw szablon
python3 fix_docx_template.py templates/oferta-podstawowa/oferta1.docx

# 3. Zastąp oryginalny plik naprawionym
cp templates/oferta-podstawowa/oferta1_fixed.docx templates/oferta-podstawowa/oferta1.docx

# 4. Zrestartuj serwer API
pkill -f offer_api.py
python3 offer_api.py
```

#### Opcja 2: Ręczna naprawa w Word

1. Otwórz plik DOCX w Microsoft Word
2. Znajdź tagi Jinja (Ctrl+F, szukaj `{{`)
3. Dla każdego znalezionego tagu:
   - Zaznacz cały tag (np. `{{ data.client_name }}`)
   - Ctrl+Space (wyczyść formatowanie)
   - Usuń tag całkowicie
   - Wpisz tag ponownie **bez żadnego formatowania**
   - Upewnij się, że tag jest w jednym ciągłym tekście
4. Zapisz plik

### Typowe błędy w tagach

❌ **ŹLE** - rozbity tag:
```
{{ data    .client   _name }}
```
(Każda część może mieć inne formatowanie w XML)

✅ **DOBRZE** - ciągły tag:
```
{{ data.client_name }}
```

---

## Problem: "Pydantic deprecated .dict() method"

### Rozwiązanie
Już naprawione w `offer_api.py`. Jeśli nadal występuje:

```bash
git pull  # Pobierz najnowszą wersję
```

Lub ręcznie zmień w linii ~186:
```python
product_dict = product.model_dump()  # zamiast product.dict()
```

---

## Problem: "LibreOffice not found"

### macOS
```bash
brew install libreoffice
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install libreoffice
```

### Sprawdzenie instalacji
```bash
libreoffice --version
```

---

## Problem: "Template not found"

### Sprawdź ścieżki
```bash
ls -la templates/
ls -la products/
```

### Sprawdź zmienne środowiskowe
```bash
cat .env
```

Upewnij się że:
```
TEMPLATES_ROOT=templates
PRODUCTS_ROOT=products
```

---

## Problem: "Product directory not found"

Upewnij się że struktura produktów jest poprawna:

```
products/
├── 1/
│   ├── 1.docx
│   └── config.json
├── 2/
│   ├── 2.docx
│   └── config.json
└── ...
```

**NIE:**
```
products/
├── 1.docx  ❌
├── 2.docx  ❌
```

---

## Testowanie API

### Test 1: Health check
```bash
curl http://localhost:7077/health
```

Oczekiwana odpowiedź:
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

### Test 2: Prosty render
```bash
./test_api.sh
```

Lub ręcznie:
```bash
curl -X POST http://localhost:7077/render \
  -H "X-API-Key: devkey" \
  -H "Content-Type: application/json" \
  -d @examples/test_simple.json \
  -o output.jpg
```

### Test 3: Pełny render z produktami
```bash
curl -X POST http://localhost:7077/render \
  -H "X-API-Key: devkey" \
  -H "Content-Type: application/json" \
  -d @examples/request_oferta_podstawowa.json \
  -o output.zip

unzip output.zip -d output/
open output/page_001.jpg
```

---

## Debugowanie

### Włącz szczegółowe logi

Zmodyfikuj `offer_api.py`:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Sprawdź co jest w REQUEST

Dodaj print w `offer_api.py` w funkcji `render_offer`:
```python
@app.post("/render")
def render_offer(req: RenderRequest):
    print(f"DEBUG: Request = {req.model_dump()}")
    # ... reszta kodu
```

### Sprawdź naprawiony DOCX

Po naprawie szablon jest w temp:
```python
# W render_template(), po fix_jinja_tags_in_docx:
shutil.copy(fixed_docx, "/tmp/debug_fixed.docx")
print(f"DEBUG: Fixed DOCX saved to /tmp/debug_fixed.docx")
```

---

## Częste pytania

### Q: Czy mogę używać obrazów w szablonach?
A: Tak! Użyj w DOCX:
```
{% if p.image_abs %}
  {% set img = InlineImage(doc, p.image_abs, width=Mm(120)) %}
  {{ img }}
{% endif %}
```

### Q: Jak dodać warunki if/else?
A: Standardowa składnia Jinja2:
```
{% if data.total_price > 50000 %}
  Oferta premium
{% else %}
  Oferta standardowa
{% endif %}
```

### Q: Jak zrobić pętlę po produktach?
A:
```
{% for p in products %}
  Produkt: {{ p.data.product_name }}
  Cena: {{ p.data.product_price }} PLN
{% endfor %}
```

Lub z filtrem:
```
{% for p in products if p.page == 1 and p.slot == "hero" %}
  ...
{% endfor %}
```

### Q: Jak zmienić DPI/jakość obrazów?
A: W `.env`:
```
DPI=150
JPEG_QUALITY=90
```

---

## Wsparcie

Jeśli problem nadal występuje:

1. Uruchom diagnostykę:
```bash
python3 fix_docx_template.py <plik.docx> --analyze
```

2. Sprawdź logi serwera

3. Przetestuj z prostym szablonem (test_simple.json)

4. Zgłoś issue z:
   - Komunikatem błędu
   - Wynikiem diagnostyki
   - Przykładowym requestem JSON
