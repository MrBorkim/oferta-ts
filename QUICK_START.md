# ⚡ SZYBKI START - Generator Ofert

## 1️⃣ Instalacja (5 minut)

```bash
# Zainstaluj zależności
npm install

# Sprawdź i zainstaluj Unoserver
node setup-unoserver.js
```

Jeśli `setup-unoserver.js` zgłosi braki, zainstaluj komponenty według instrukcji na ekranie.

## 2️⃣ Uruchomienie

```bash
# Uruchom serwer
npm start

# Otwórz w przeglądarce
# http://localhost:3000
```

## 3️⃣ Pierwsze kroki

### Krok 1: Nowa oferta
- Kliknij **"Nowa Oferta"**
- Wpisz nazwę (np. "Oferta ABC")
- Wybierz szablon (AIDROPS lub WolfTax)
- Kliknij **"Utwórz ofertę"**

### Krok 2: Wypełnij dane
**Lewa strona** - Formularz:
- 📋 **Dane podstawowe**: NIP, nazwa firmy, daty
- 📝 **Szczegóły zlecenia**: temat, opis
- 💰 **Finansowe**: cena, RBG, uzasadnienie
- 📦 **Produkty**: zaznacz z listy

**Wskazówka**: Kliknij nagłówek sekcji aby zwinąć/rozwinąć

### Krok 3: Podgląd
- Kliknij **"🔄 Generuj podgląd"**
- **Prawa strona** - Pojawi się PDF

### Krok 4: Pobierz
- **💾 Pobierz DOCX** - Edytowalny Word
- **📄 Pobierz PDF** - Do druku

## 📁 Gdzie są pliki?

```
templates/              ← Twoje szablony DOCX
produkty/               ← Pliki produktów DOCX
oferty/                 ← Wygenerowane oferty
  └── [nazwa-oferty]/
      ├── oferta_final.docx
      ├── oferta_final.pdf
      └── previews/
```

## 🎨 Dodaj nowy szablon

1. Stwórz plik DOCX z placeholderami: `{{nazwa_pola}}`
2. Dodaj folder w `templates/`
3. Stwórz plik JSON z konfiguracją
4. Gotowe! Szablon pojawi się w aplikacji

**Przykład placeholdera:**
```
Klient: {{firmaM}}
NIP: {{KLIENT(NIP)}}
Data: {{Oferta z dnia}}
```

## 🔧 Problemy?

### Unoserver nie działa
```bash
# Sprawdź
ps aux | grep unoserver

# Uruchom ponownie
unoserver &
```

### Port 3000 zajęty
W `server.js` zmień:
```javascript
const PORT = 3001; // Inny port
```

### Więcej pomocy
Zobacz pełną dokumentację: **README.md**

---

## 📚 Dokumentacja

- 📖 **README.md** - Pełna dokumentacja
- 🛠️ **setup-unoserver.js** - Instalator Unoserver
- 💻 **server.js** - API serwera
- 🎨 **public/index.html** - Frontend

## 🎯 Szybkie polecenia

```bash
npm start              # Uruchom serwer
npm run dev            # Tryb developerski (auto-restart)
node setup-unoserver   # Sprawdź Unoserver
```

---

**Gotowe! 🚀**
Otwórz http://localhost:3000 i zacznij tworzyć oferty!
