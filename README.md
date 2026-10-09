# Website Networkcity Heidelberg

Eine eigene Webseite für das **Networkcity** in Heidelberg – Internetcafé,
Handy-Verkauf (neu & gebraucht), Reparatur und Zubehör.

Die Seite besteht nur aus HTML, CSS und JavaScript und läuft kostenlos über
**GitHub Pages**. Inhalte (Produkte, Preise, Texte, Öffnungszeiten, Bilder)
pflegt der Inhaber selbst über den eingebauten **Verwaltungsbereich**. Es gibt
keinen Onlineshop mit Zahlung: Interessenten rufen an oder schreiben per
WhatsApp.

## Aufbau

| Datei / Ordner | Inhalt |
| --- | --- |
| `index.html` | Die öffentliche Website (Start, Internetcafé, Handy-Shop, Reparatur, Kontakt) |
| `admin.html` | Verwaltungsbereich (nicht im Menü verlinkt) |
| `assets/` | Gestaltung (CSS), Programmcode (JS) und die lokal eingebundene Symbolschrift |
| `data/settings.json` | Stammdaten, Texte, Öffnungszeiten, Preise, Werbung, Design |
| `data/products.json` | Produkte |
| `data/images/` | Alle Bilder |

## Veröffentlichen mit GitHub Pages

1. Im Repository auf **Settings → Pages** gehen.
2. Unter „Build and deployment“: Source **Deploy from a branch**,
   Branch **main**, Ordner **/ (root)** → **Save**.
3. Nach 1–2 Minuten ist die Seite erreichbar unter
   `https://<github-name>.github.io/networkcity/`.

## Verwaltung

Adresse: `https://<github-name>.github.io/networkcity/admin.html`

Die Anmeldung erfolgt mit einem persönlichen **GitHub-Token**. Gespeichert wird
direkt in diesem Repository; GitHub Pages veröffentlicht die Änderung danach
automatisch (ca. 1–2 Minuten). Ohne gültigen Token kann niemand etwas ändern,
auch wenn er die Adresse der Verwaltung kennt.

**Token erstellen** (einmalig):

1. Auf GitHub: Profilbild → **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**.
2. Repository access: **Only select repositories** → `networkcity`.
3. Permissions → Repository permissions → **Contents: Read and write**.
4. Token erzeugen, kopieren und in der Verwaltung einfügen.

Den Token wie ein Passwort behandeln. Läuft er ab, einfach einen neuen erstellen.

### Was kann der Betreiber selbst ändern?

- **Werbung** – große Bildergalerie oben auf der Startseite: Bilder mit Label,
  Überschrift, Beschreibung und optionalem Link; Reihenfolge, Wechselzeit und
  Höhe einstellbar.
- **Produkte** – anlegen, bearbeiten, löschen, mit Bild. Kategorie, Zustand
  (Neu/Gebraucht), Preis, alter Preis (zeigt Streichpreis und Rabatt
  automatisch), Beschreibung, „Angebot“ auf der Startseite, sichtbar ja/nein,
  „online verkaufbar“ (Button „Online kaufen / anfragen“ per WhatsApp) und
  erlaubte Zahlungsarten je Produkt. Verkaufte Produkte bleiben einige Tage mit
  Hinweis „Verkauft“ sichtbar und verschwinden dann automatisch.
- **Stammdaten** – Name, Adresse, Telefon, WhatsApp, E-Mail, Karten-URL,
  Öffnungszeiten und Sonderöffnungszeiten (z. B. Feiertage).
- **Texte** – Startseite, Internetcafé und Reparatur.
- **Preise & Services** – Leistungen und Preise für Internetcafé und Reparatur,
  weitere Partner-Services (z. B. Hermes, Western Union).
- **Bezahlung** – Zahlungsarten für Kaufanfragen.
- **Design** – Farbschema (Orange & Schwarz, Blau, Dunkel).
- **Logo & Bilder** – Logo, Titelbild und Ladenfotos.

Große Bilder werden beim Hochladen automatisch auf max. 1600 px Breite
verkleinert.

## Variante mit eigener Domain über Cloudflare (Anmeldung mit Benutzername + Passwort)

Wird die Seite über **Cloudflare Pages** ausgeliefert, meldet man sich in der
Verwaltung mit **Benutzername und Passwort** an. Der GitHub-Token liegt dann
geheim bei Cloudflare; die Verwaltung erkennt das automatisch.

Dafür sorgen `server/worker.js`, die Dateien in `functions/api/` (kleine
Server-Funktionen) und `server/auth.js`. Sie enthalten keine Geheimnisse.
`.assetsignore` legt fest, dass nur die Website-Dateien öffentlich ausgeliefert
werden.

**Einrichtung (einmalig, am besten am PC):**

1. Cloudflare → **Workers & Pages → Anwendung erstellen → Continue with GitHub**
   → Repository `networkcity` wählen.
2. Build-Befehl **leer**, Bereitstellungsbefehl `npx wrangler deploy`
   (Voreinstellung). Die Einstellungen stehen in `wrangler.jsonc`.
3. Im Worker unter **Einstellungen → Variablen und Geheimnisse** als
   *Geheimnis* anlegen:
   - `ADMIN_USER` – Benutzername für die Verwaltung
   - `ADMIN_PASSWORD` – starkes Passwort (mind. 12 Zeichen)
   - `SESSION_SECRET` – zufällige Zeichenkette, mind. 32 Zeichen
   - `GITHUB_TOKEN` – Fine-grained Token, nur für dieses Repo,
     *Contents: Read and write*
4. Neu bereitstellen (Bereitstellungen → erneut ausführen).
5. Unter **Einstellungen → Domains & Routen** die benutzerdefinierte Domain
   `networkcity-heidelberg.com` hinzufügen.

Die Verwaltung ist dann unter `https://networkcity-heidelberg.com/admin.html`
erreichbar. Die Server-Funktion erlaubt nur das Lesen und Schreiben von
`data/settings.json`, `data/products.json` und Bildern in `data/images/` –
keinen Zugriff auf Code oder andere Repositories.

## Datenschutz

- Schrift und Symbole sind lokal eingebunden – es werden keine Google Fonts
  geladen.
- Die Google-Maps-Karte auf der Kontaktseite wird erst geladen, wenn der
  Besucher auf „Karte laden“ klickt.

## Lokal ansehen

Im Projektordner einen einfachen Webserver starten, z. B.:

```
python -m http.server 8000
```

und `http://localhost:8000` im Browser öffnen.

## Alte Streamlit-Version

Die frühere Python/Streamlit-Version liegt im Ordner `alt-streamlit/`. Sie wird
für die Website nicht mehr gebraucht. (Zum Starten müsste sie wieder ins
Hauptverzeichnis verschoben werden, weil sie die Dateien in `data/` nutzt.)

## Lizenzhinweis

Die Symbole stammen aus „Material Symbols Rounded“ von Google
(Apache License 2.0); im Projekt ist nur eine kleine Teilmenge enthalten.

Für das Einlesen von PDF-Ausweiskopien im Kaufvertrag wird pdf.js 3.2.146
von Mozilla (Apache License 2.0, `assets/vendor/pdfjs/`) lokal eingebunden.
Die PDF wird nur im Browser verarbeitet und nicht hochgeladen.
