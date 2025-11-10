Rola i cel
Jesteś seniorem Python/DevOps. Zbuduj jednoplikowy serwer FastAPI, który przyjmuje JSON i generuje oferty z szablonów DOCX. Silnik szablonów: docxtpl (Jinja2). Wynik: strony jako JPG 100 dpi.

Wejście (JSON w POST /render):
opracuj JSON dla kazdego folderu z ofertami 

Zasoby w systemie plików:
TEMPLATES_ROOT (env, domyślnie templates) — katalog z DOCX, np. templates/offer_A.docx.
PRODUCTS_ROOT (env, domyślnie products) — produkty w podkatalogach wg product_id, np. products/100045/cover.jpg.
Wymagania funkcjonalne:
Render: docxtpl z kontekstem:
data = placeholders
products = lista product_sequence z dodanym absolutnym image_abs (jeśli image podano; domyślnie cover.jpg).
Szablony DOCX muszą wspierać pętle/warunki Jinja (np. {% for p in products if p.page == 1 and p.slot == "hero" %} ... {% endfor %}) oraz obrazy przez InlineImage.
Konwersja: najpierw libreoffice --headless --convert-to pdf (subprocess). Jeśli brak, zwróć błąd 500 z jasnym komunikatem jak doinstalować.
PDF → JPG: PyMuPDF (matryca dpi/72.0) + zapis JPEG z dpi=(100,100) i quality.
Odpowiedź:
"return":"first_page_inline" → image/jpeg (tylko pierwsza strona),
domyślnie ZIP z plikami page_001.jpg, page_002.jpg, …
Szybkość: wszystko w pamięci/TMP, brak dyskowych artefaktów poza tymczasowymi DOCX/PDF/JPG (usuwaj po zakończeniu).
Bezpieczeństwo: nagłówek X-API-Key (env API_KEY, domyślnie devkey).
Port/host z ENV: PORT (domyślnie 7077), HOST (domyślnie 0.0.0.0).
Wymagania niefunkcjonalne:
Jeden plik offer_api.py, czytelny, z komentarzami.
Precyzyjne komunikaty błędów (brak szablonu, brak produktu/obrazu, brak LibreOffice, błąd docxtpl).
Endpoint /health.
Brak zewnętrznych kolejek — ma być „lekko i płynnie”.
Biblioteki (pip): fastapi, uvicorn[standard], docxtpl, Pillow, pymupdf (PyMuPDF).
Zależności systemowe: libreoffice (do headless DOCX→PDF).
Dodatkowo:
Przykład semantyki Jinja dla DOCX:
pętla po products z if p.page == 1 and p.slot == "hero".
wstawienie obrazu: {% set img = InlineImage(doc, p.image_abs, width=Mm(120)) %} {{ img }}.
Przykładowa odpowiedź błędu: {"detail":"LibreOffice not found. Install: apt-get install libreoffice"}.
Jednoplikowy serwer — offer_api.py
Zapisz poniższy plik jako offer_api.py

Jak przygotować szablon DOCX (docxtpl + Jinja)
Wstaw zmienne „stałe” (placeholders):
{{ data.client_name }}, {{ data.offer_date }} itd.
Pętla po produktach z filtrem „slot” i „page”:

Kolejne strony w DOCX rozdziel jako „Page Break” i powtarzaj sekcje z odpowiednimi warunkami if p.page == 2, slot == 'grid_1', itp.




przygotuj dla kazdego osobne json, wez pod uwage jeszcze folder z produktami bo je bedziemy dodawac do oferty. 

przygotuj to wszytsko jak najbardziej elestycznie 