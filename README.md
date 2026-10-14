# YT Music Liked Songs – Export & Auswertung

Exportiert deine „Mag ich“-Songs aus YouTube Music als JSON/CSV, reichert sie mit Jahr, Genre,
Herkunft und Künstler-Beziehungen an und erzeugt eine interaktive Seite mit:

- **Übersicht**: exakte Kennzahlen und Diagramme (Genres, Top-Künstler, Jahre, Songlängen, Länder,
  Geschmacksentwicklung, Mainstream-Index, Kollaborationen …)
- **Netzwerk-Map**: Künstler als Bubbles (Größe = Anzahl Songs), verbunden über Features,
  „verwandte Künstler“ von YT Music und ähnliche Genre-Tags; automatisch gefundene Musik-Welten (Cluster)
- **Bubble-Map**: Genre → Künstler → Song als zoombare, verschachtelte Bubbles
- **Alle Songs**: durchsuch- und sortierbare Tabelle
- Mit Google Takeout zusätzlich: Wiedergaben, Hör-Heatmap, meistgespielt, „oft gehört, nie geliked“

Alles läuft lokal. Es werden keine Daten hochgeladen; abgefragt werden nur YouTube Music,
MusicBrainz und (optional) Last.fm.

Ohne eigene Daten ausprobieren: `.venv\Scripts\python ytm.py demo`

---

## Schritt für Schritt

Alle Befehle in PowerShell im Projektordner (`Desktop\ytmusic-analyse`).

### 1. Google Takeout jetzt schon anfordern (dauert Stunden bis 1 Tag)

1. <https://takeout.google.com> öffnen → **Auswahl aufheben**
2. Nur **YouTube und YouTube Music** anhaken
3. **Mehrere Formate** → bei **Verlauf** auf **JSON** stellen (Standard ist HTML, damit geht es nicht)
4. **Alle YouTube-Daten enthalten** → nur **Verlauf** und **Playlists** anhaken (Videos weglassen, die sind riesig)
5. Weiter → einmalig exportieren → .zip → Export erstellen. Die Mail mit dem Download-Link kommt später.

### 2. Umgebung (einmalig – schon erledigt, falls `.venv` existiert)

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

### 3. Bei YouTube Music anmelden (browser.json erzeugen)

Das machst du selbst; die Datei enthält dein Login-Cookie und bleibt nur auf deinem Rechner
(steht in `.gitignore`).

1. In **Firefox** oder **Chrome** <https://music.youtube.com> öffnen und eingeloggt sein
2. **F12** → Reiter **Netzwerk / Network** → im Filter `browse` eingeben
3. In YT Music auf **Bibliothek** klicken, damit eine Anfrage `browse?...` (POST, Status 200) erscheint
4. Header kopieren:
   - **Firefox**: Rechtsklick auf die Anfrage → *Kopieren* → *Anfrage-Header kopieren*
   - **Chrome**: Anfrage anklicken → *Headers* → bei *Request Headers* auf **Raw** schalten →
     alles ab `accept:` bis zum Ende markieren und kopieren
5. Im Projektordner ausführen:
   ```powershell
   .venv\Scripts\ytmusicapi browser
   ```
   Header einfügen, **Enter**, dann **Strg+Z** und nochmal **Enter**. Danach liegt `browser.json` im Ordner.

**Einfacher:** Liegt schon eine `browser.json` mit `HIER_DEINEN_COOKIE_EINFUEGEN` im Ordner, nur den
Platzhalter durch den Wert des `cookie`-Headers ersetzen (in den DevTools: Rechtsklick auf den
`cookie`-Header → *Wert kopieren*). Eine Zeile, zwischen den Anführungszeichen.

Wichtig: Dich in diesem Browser **nicht bei YouTube abmelden**, sonst wird das Cookie ungültig.
(ytmusicapi markiert diese Methode als „deprecated“, sie funktioniert aber. Wenn sie irgendwann bricht:
Schritt 3 wiederholen.)

### 4. Liked Songs abrufen

```powershell
.venv\Scripts\python ytm.py fetch
```

Ergebnis: `data/liked_songs.json` (bereinigt) und `data/liked_raw.json` (Rohdaten).

### 5. Optional, aber für Genres stark empfohlen: Last.fm-API-Key

MusicBrainz allein liefert für viele Künstler (gerade Deutschrap, neuere Acts) keine Genres.

1. Last.fm-Konto anlegen → <https://www.last.fm/api/account/create> → App anlegen (Name egal)
2. Datei `.env` im Projektordner anlegen (Vorlage: `.env.example`):
   ```
   LASTFM_API_KEY=dein_key
   ```

### 6. Anreichern

```powershell
.venv\Scripts\python ytm.py enrich
```

Dauer: Alben und Künstler ca. 0,3 s pro Stück, Genres/Herkunft ca. 1,4 s pro Künstler
(MusicBrainz erlaubt nur 1 Anfrage pro Sekunde). Bei 1 000 Künstlern also ca. 25 min.
Abbrechen mit Strg+C ist unproblematisch – der nächste Aufruf macht dort weiter.

### 7. Takeout einlesen (sobald die ZIP da ist)

```powershell
.venv\Scripts\python ytm.py takeout "C:\Users\<du>\Downloads\takeout-XXXX.zip"
```

Die ZIP wird direkt gelesen, entpacken ist nicht nötig. Danach zurück zu Schritt 8.

### 8. Auswertung bauen und öffnen

```powershell
.venv\Scripts\python ytm.py build
.venv\Scripts\python ytm.py open
```

Ergebnisse in `out/`:

| Datei | Inhalt |
|---|---|
| `index.html` | Interaktive Seite (braucht Internet für D3 von cdnjs) |
| `report.md` | Alle Kennzahlen als Text |
| `songs.csv` | Alle Songs mit Metadaten, öffnet direkt in Excel |
| `kuenstler_netzwerk.gexf` | Künstler-Graph für [Gephi](https://gephi.org) |

---

## Grenzen (ehrlich)

- **ytmusicapi ist inoffiziell.** Wenn YouTube intern etwas ändert, kann der Abruf brechen
  (`pip install -U ytmusicapi` hilft meistens).
- **Like-Datum** gibt es nur über Takeout und nur, wenn deine Liked-Playlist dort mit Zeitstempeln
  enthalten ist. Ohne Takeout zeigt „Geschmacksentwicklung“ die Like-*Reihenfolge* in 10 Abschnitten.
- **Genres** kommen vom Hauptkünstler, nicht vom einzelnen Song.
- **Wiedergaben**: YT Music spielt manchmal die Video- statt der Audio-Version (andere ID).
  „Nie gespielt“ ist daher eine Obergrenze.
- **BPM/Energie/Tanzbarkeit** gibt es nicht: Spotify hat diese Schnittstelle für neue Apps abgeschaltet.

## Aufbau

```
ytm.py            Kommandozeile (fetch, enrich, takeout, build, open, demo)
ytmlib/fetch.py   Abruf über ytmusicapi
ytmlib/enrich.py  Alben, Künstler, MusicBrainz, Last.fm (mit Cache in data/cache/)
ytmlib/takeout.py Google-Takeout-Parser
ytmlib/build.py   Kennzahlen, Netzwerk + Louvain-Cluster, Ausgabe
ytmlib/genres.py  Tags → 8 Haupt-Genres
web/              Oberfläche (D3), wird nach out/ kopiert
tests/            Parser-Test
```
