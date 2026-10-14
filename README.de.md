# YT Music Liked Songs – Export & Auswertung

[English](README.md) · **Deutsch**

Exportiert deine „Mag ich“-Songs aus YouTube Music als JSON/CSV, reichert sie mit Erscheinungsjahr,
Stil, Herkunft und Künstler-Beziehungen an und zeigt alles auf einer interaktiven Seite:

- **Übersicht** – exakte Kennzahlen und Diagramme: Stile, Top-Künstler, Erscheinungsjahre, Songlängen,
  Herkunftsländer, Geschmacksentwicklung, Stil-Mix deiner Playlists, Mainstream oder Underground,
  Kollaborationen, Remix-/Sped-up-Anteil …
- **Netzwerk-Map** – jeder Künstler eine Bubble (Größe = Anzahl Liked Songs), verbunden über Features,
  „verwandte Künstler“ von YT Music und ähnliche Stil-Tags; Musik-Welten (Cluster) werden automatisch erkannt
- **Bubble-Map** – Stil → Künstler → Song als zoombare, verschachtelte Bubbles (oder nach Playlist/Musik-Welt)
- **Alle Songs** – durchsuch- und sortierbare Tabelle
- Mit **Google Takeout** zusätzlich: Wiedergaben pro Monat, Hör-Heatmap, meistgespielt,
  „oft gehört, nie geliked“

Die Seite gibt es auf **Deutsch und Englisch** (Umschalter oben rechts).

![Übersicht](docs/overview.png)
![Netzwerk-Map](docs/network.png)
![Bubble-Map](docs/bubbles.png)

*Die Screenshots zeigen die eingebauten Demo-Daten.*

**Datenschutz:** Alles läuft lokal, deine Daten werden nirgends hochgeladen. Die Skripte sprechen nur mit
YouTube Music (dein Konto), MusicBrainz und optional Last.fm (nur Künstlernamen).

Ohne Konto ausprobieren: `python ytm.py demo`

---

## Voraussetzungen

- Python **3.10+**
- Ein YouTube-Music-Konto mit Liked Songs
- Optional: ein kostenloser [Last.fm-API-Key](https://www.last.fm/api/account/create) (deutlich bessere Stile)
- Optional: ein [Google-Takeout](https://takeout.google.com)-Export (Wiedergaben und Hörzeiten)

## Installation

```bash
git clone https://github.com/<du>/ytmusic-analyse.git
cd ytmusic-analyse
python -m venv .venv
```

Windows:
```bash
.venv\Scripts\python -m pip install -r requirements.txt
```

macOS/Linux:
```bash
.venv/bin/python -m pip install -r requirements.txt
```

In den Befehlen unten steht `python` für `.venv\Scripts\python` (Windows) bzw. `.venv/bin/python`.

## Schritt für Schritt

### 1. Google Takeout jetzt anfordern (optional, dauert Stunden bis 1 Tag)

1. <https://takeout.google.com> öffnen → **Auswahl aufheben**
2. Nur **YouTube und YouTube Music** anhaken
3. **Mehrere Formate** → bei **Verlauf** auf **JSON** stellen (Standard HTML funktioniert nicht)
4. **Alle YouTube-Daten enthalten** → nur **Verlauf**, **Playlists** und **music (library and uploads)**
   (Videos weglassen, die können riesig sein)
5. Einmalig exportieren, als .zip

### 2. Bei YouTube Music anmelden (`browser.json` anlegen)

Die Datei enthält dein Login-Cookie. Sie bleibt auf deinem Rechner und steht in `.gitignore` –
**niemals teilen oder committen.**

1. Vorlage kopieren: `browser.example.json` → `browser.json`
2. <https://music.youtube.com> in Chrome/Edge/Firefox öffnen und eingeloggt sein
3. **F12** → Reiter **Netzwerk** → Seite neu laden
4. Eine Anfrage wie `browse?…`, `account_menu?…` oder `guide?…` (Methode POST) anklicken
5. Unter **Request Headers** Rechtsklick auf `cookie` → **Wert kopieren**
6. In `browser.json` `PASTE_YOUR_COOKIE_HERE` durch diesen Wert ersetzen – eine Zeile, zwischen den Anführungszeichen

Alternative: `ytmusicapi browser` ausführen (wird mit den Requirements installiert) und alle Request-Header einfügen.

Dich in diesem Browser nicht bei YouTube abmelden, sonst wird das Cookie ungültig.

### 3. Liked Songs abrufen

```bash
python ytm.py fetch
```

### 4. Last.fm-API-Key (optional, empfohlen)

Ohne Key kommen Stile nur von MusicBrainz, und viele Künstler bleiben „Unbekannt“.
Key anlegen unter <https://www.last.fm/api/account/create> (Name und Beschreibung frei wählbar,
Callback und Homepage leer lassen; der Key erscheint sofort und ist für private Nutzung kostenlos).
`.env.example` nach `.env` kopieren und eintragen:

```
LASTFM_API_KEY=dein_key
```

### 5. Anreichern

```bash
python ytm.py enrich
```

Die Dauer wächst mit der Zahl der Künstler und Alben: etwa 1 s pro Album und Künstler (YT Music),
0,25 s pro Künstler (Last.fm) und 1,1 s pro Künstler (MusicBrainz erlaubt eine Anfrage pro Sekunde).
Bei ~3 000 Künstlern 1–2 Stunden. Abbrechen mit Strg+C ist unproblematisch – der nächste Lauf
macht dort weiter. Tipp: die Dienste parallel in getrennten Terminals laufen lassen:

```bash
python ytm.py enrich --no-lastfm --no-mb
```
```bash
python ytm.py enrich --no-albums --no-artists --no-mb
```
```bash
python ytm.py enrich --no-albums --no-artists --no-lastfm
```

### 6. Takeout einlesen (sobald die ZIP da ist)

```bash
python ytm.py takeout "Pfad/zu/takeout-XXXX.zip"
```

Die ZIP wird direkt gelesen, entpacken ist nicht nötig.

### 7. Auswertung bauen und öffnen

```bash
python ytm.py build
python ytm.py open
```

| Datei in `out/` | Inhalt |
|---|---|
| `index.html` | die interaktive Seite (braucht einmal Internet für D3 von cdnjs) |
| `report.md` | alle Kennzahlen als Text |
| `songs.csv` | alle Songs mit Metadaten (öffnet direkt in Excel) |
| `kuenstler_netzwerk.gexf` | Künstler-Graph für [Gephi](https://gephi.org) |

Direktlinks: `out/index.html#network`, `#bubbles`, `#table` sowie `?lang=de` / `?lang=en`.

## Sprache

- **Seite:** Umschalter oben rechts; Standard ist die Browsersprache.
- **Kommandozeile und `report.md`:** Systemsprache, umstellbar mit `YTM_LANG=de` oder `YTM_LANG=en`.
- **Zeitzone** der Hör-Heatmap: Systemzeitzone, umstellbar z. B. mit `YTM_TZ=Europe/Berlin`.

## Grenzen

- **ytmusicapi ist inoffiziell.** Ändert YouTube intern etwas, kann der Abruf brechen
  (`pip install -U ytmusicapi` hilft meistens). Die Anmeldung per Cookie ist in ytmusicapi als
  „deprecated“ markiert, funktioniert aber mit Version 1.12.
- YouTube Music meldet teils mehr Liked Songs, als es liefert (gelöschte/gesperrte Titel), und führt
  manche Songs doppelt; Duplikate werden entfernt, die Lücke wird angezeigt.
- **Like-Datum** gibt es nur, wenn dein Takeout die Liked-Liste mit Zeitstempeln enthält (oft nicht).
  Sonst zeigt „Geschmacksentwicklung“ die Like-Reihenfolge.
- **Wiedergaben** reichen nur so weit zurück, wie dein YouTube-Verlauf gespeichert wird
  (automatisches Löschen). YT Music spielt manchmal eine andere Version (Video statt Audio) mit
  eigener ID ab; „nie gespielt“ ist daher eine Obergrenze.
- **Stile** gehören zum Hauptkünstler, nicht zum einzelnen Song.
- Bei **Uploads** (von Nutzern hochgeladene Videos) wird der Künstler aus „Künstler - Titel“ gelesen,
  sonst steht der Kanalname.
- BPM/Energie/Tanzbarkeit gibt es nicht (Spotify hat diese Schnittstelle für neue Apps geschlossen).

## Aufbau

```
ytm.py             Kommandozeile (fetch, enrich, takeout, build, open, demo)
ytmlib/fetch.py    Abruf über ytmusicapi
ytmlib/enrich.py   Alben, Künstler, Last.fm, MusicBrainz (Cache in data/cache/)
ytmlib/takeout.py  Google-Takeout-Parser
ytmlib/build.py    Kennzahlen, Netzwerk + Louvain-Cluster, Ausgabe
ytmlib/genres.py   Tags → Stile
ytmlib/demo.py     erfundene Demo-Daten
web/               Oberfläche (D3, DE/EN), wird nach out/ kopiert
tests/             Parser-Test
```

## Haftungsausschluss

Kein offizielles Projekt von Google, YouTube, Last.fm oder MusicBrainz. Für die private Nutzung mit dem
eigenen Konto. Die Nutzungsbedingungen der abgefragten Dienste gelten.

## Lizenz

[MIT](LICENSE)
