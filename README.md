# Website Networkcity Heidelberg

Eine einfache, eigene Webseite für das **Networkcity** in Heidelberg – 
Internetcafé, Handy-Verkauf (neu & gebraucht), Reparatur und Zubehör.

Die Seite läuft mit **Streamlit** und kann komplett selbst über den
eingebauten **Verwaltungsbereich** gepflegt werden (Produkte, Preise, Texte,
Öffnungszeiten, Kontaktdaten, Logo). Es gibt keinen Onlineshop mit Zahlung:
Interessenten rufen an oder schreiben per WhatsApp.

## Starten

Auf dem Rechner einmalig:

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

Danach startet die Seite mit:

```powershell
.venv\Scripts\streamlit run streamlit_app.py
```

Browser öffnen und auf `http://localhost:8501` gehen.

## Zugangsdaten für die Verwaltung

Der Verwaltungsbereich ist **für Besucher nicht sichtbar**. Der Inhaber erreicht
ihn über einen geheimen Link (Untermenüpunkt **„Verwaltung"** erscheint dann im
Menü):

```
http://localhost:8501/?admin=networkcity-2026
```

Vor der Freischaltung bitte unbedingt das Passwort ändern:

1. Datei `.streamlit/secrets.toml` öffnen.
2. Unter `[admin]` Benutzername und Passwort anpassen.
3. Speichern – gilt sofort, Server muss nicht neu gestartet werden.

Tipp: Den geheimen Link (mit `?admin=networkcity-2026`) als Lesezeichen speichern.
Nur wer diesen Link kennt, bekommt den Verwaltungsbereich zu sehen; ohne den Link
und das Passwort ist er nicht zugänglich.

## Was kann der Betreiber selbst ändern (Verwaltung)?

- **Produkte** – neue Produkte bequem über das **„Neues Produkt hinzufügen"**-
  Formular anlegen (mit Bild). Vorhandene Produkte in der Tabelle bearbeiten:
  Kategorie (Smartphone, Zubehör …), Zustand (Neu/Gebraucht), Preis, Beschreibung,
  ob das Produkt als „Angebot" auf der Startseite erscheint und ob es verfügbar
  ist. Für jedes Produkt kann ein Bild hochgeladen werden.
  - **Alter Preis / Rabatt:** Sobald bei einem Produkt ein „Alter Preis" eingetragen
    ist, zeigt die Website automatisch den durchgestrichenen alten Preis **und** den
    Rabatt in Euro und Prozent an (z. B. ~~379,00 €~~ −50,00 € (−13 %)).
  - **Online-Verkauf:** Mit dem Schalter „Direkt online verkaufbar" bzw. der
    Spalte „Online" entscheidet man pro Produkt, ob Kunden einen Button
    **„Online kaufen / anfragen"** (Anfrage per WhatsApp) sehen. Ohne Häkchen
    erscheint „Nur im Laden erhältlich".
- **Stammdaten** – Ladenname, Adresse, Telefon, WhatsApp, E-Mail, Karten-URL
  und Öffnungszeiten.
- **Sonderöffnungszeiten** – einmalige Änderungen mit Datum (z. B. Feiertage
  oder verkürzte Zeiten). Einfach eine Zeile mit Datum, Zeiten und optionalem
  Hinweis anlegen. Die Einträge erscheinen automatisch auf der Start- und
  Kontaktseite (bis 35 Tage voraus). „Öffnet" leer lassen = an diesem Tag
  geschlossen.
- **Texte** – Startseite (Titel, Untertitel, Über-uns-Text), Texte und
  Stichpunkte für Internetcafé und Reparatur.
- **Preise & Services** – die Leistungstabelle für Internetcafé und Reparatur
  (Leistung, Preis, Beschreibung).
- **Weitere Services** – Partner-/Zusatzleistungen als Karten auf der
  Startseite (z. B. Hermes Paketshop, Ria Money Transfer, Western Union,
  Amazon Paketabgabe). Symbol, Name und Beschreibung sind pflegbar.
- **Logo & Bilder** – Logo oben links hochladen, ein Titelbild für die
  Startseite und beliebig viele Fotos vom Laden als Galerie auf der Startseite.
- **Werbung & Angebote** – die große Bildergalerie oben auf der Startseite
  (wie eine Werbetafel). Beliebig viele Bilder mit Überschrift, Label (z. B.
  „Angebot") und Beschreibung anlegen; die Bilder wechseln automatisch. Die
  Reihenfolge und die Anzeigedauer lassen sich einstellen.
- **Bezahlung** – welche Zahlungsarten Kunden beim Online-Kauf wählen können
  (z. B. PayPal, Karte, Überweisung, Bar). Bestellungen gehen per WhatsApp an
  den Laden; ein echter Online-Bezahlvorgang ist nicht enthalten.
- **Design** – Farbschema der Website umschalten (Modern Orange & Schwarz,
  Modern & hell (Blau), Dunkel & edel).

## Erste Schritte für den echten Betrieb

1. **Kontaktdaten prüfen**: Adresse (`Plöck 12, 69117 Heidelberg-Altstadt`) und
   Telefon (`0163 0300050`) sind bereits eingetragen; prüfen Sie in der
   Verwaltung → Stammdaten, ob alles stimmt. Die WhatsApp-Nummer braucht den
   Ländercode ohne führende Null, z. B. `491630300050` für `0163 0300050`.
2. **Öffnungszeiten** anpassen (Mo–Sa 09:00–22:00, So 12:00–20:00 sind hinterlegt).
3. **Beispielprodukte ersetzen bzw. anpassen** und echte Fotos hochladen.
4. **Logo, Titelbild und Ladenfotos** unter Verwaltung → „Logo & Bilder" hochladen.
5. **Sonderöffnungszeiten** (z. B. Feiertage) in Verwaltung → Stammdaten anlegen.
6. **Google-Maps-Karte**: In den Stammdaten liegt eine Embed-URL vor. Wer eine
   bessere Karte mit exakter Adresse möchte, sucht in Google Maps nach dem
   Laden, klickt auf „Teilen" → „Karte einbetten" und kopiert die Embed-URL
   (beginnt mit `https://www.google.com/maps/embed?...`) in das Feld.
7. **Passwort ändern** (siehe oben).

## Hinweise zur Technik

- Alle Inhalte liegen in `data/settings.json` und `data/products.json`,
  hochgeladene Bilder in `data/images/`. Diese Dateien sind das „Herz“ der
  Seite – bitte regelmäßig sichern (kopieren reicht) und vor Neuinstallation
  aufbewahren.
- Der Verwaltungsbereich ist mit einem einfachen Passwort geschützt
  (`.streamlit/secrets.toml`). Das reicht für einen kleinen Laden, ist aber
  bewusst simpel gehalten – keine Zwei-Faktor-Absicherung, keine
  Benutzerverwaltung.

## Veröffentlichen (optional)

- **Einfach lokal**: Die Seite kann dauerhaft auf einem Rechner im Laden laufen
  (z. B. am Internetcafé-PC). Dazu den Befehl zum Starten in einen Autostart
  eintragen. Besucher erreichen die Seite dann über `http://<rechner-ip>:8501`.
- **Im Internet**: z. B. Streamlit Community Cloud (hostet die Seite kostenlos)
  oder ein kleiner Server mit Docker. Dafür werden die Daten in ein Git-Repo
  gelegt, `.streamlit/secrets.toml` mit dem echten Passwort wird nur auf dem
  Server hinterlegt (nicht mit einchecken – die Datei steht bereits in
  `.gitignore`).