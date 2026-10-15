# YT Music Liked Songs – Export & Analysis

**English** · [Deutsch](README.de.md)

Export your YouTube Music liked songs to JSON/CSV, enrich them with release years, styles, artist
origin and artist relationships, and explore them in an interactive page:

- **Home** – your music DNA: style mix, key numbers and automatically detected highlights
  (electronic share, diversity, explorer or fan, underground share, listening time, all-time favourite …)
- **Taste** – styles, top artists, music worlds (clusters), style mix of your playlists, tags,
  mainstream vs. underground, origin, collaborations, feature kings
- **Time travel** – release years, how your taste changed, style × decade, how fresh you listen,
  new artists over time, song lengths
- **Listening** (with Google Takeout) – listening calendar, weekly trend, weekday × hour with details per slot,
  style by time of day, sessions, on repeat, artist of the month, forgotten favourites, "played a lot, never liked"
- **Discover** – recommendations from your own network (related artists you don't have yet),
  bridge artists between your worlds, second chance, hidden gems, random find
- **Network map** and **bubble map** – artist network with automatically found music worlds and
  zoomable style → artist → song bubbles
- **Artists** and **All songs** – searchable, sortable tables, CSV export of the current selection

Everything is linked: one **global filter** (style, world, playlist, years, artist, country) applies to every page,
every bar and name is clickable, every artist has a **profile** (songs, like timeline, plays, connections,
similar artists) and **Ctrl+K** searches everything. The page is available in **English and German**.

![Home](docs/overview.png)
![Listening](docs/listening.png)
![Discover](docs/discover.png)
![Artist profile](docs/profile.png)
![Network map](docs/network.png)
![Bubble map](docs/bubbles.png)

*Screenshots use the built-in demo data.*

**Privacy:** everything runs locally. Your data is never uploaded anywhere. The scripts only talk to
YouTube Music (your account), MusicBrainz and – optionally – Last.fm (artist names only). The page itself loads
D3 from cdnjs and cover images from YouTube's image servers.

Try it without an account: `python ytm.py demo`

---

## Requirements

- Python **3.10+**
- A YouTube Music account with liked songs
- Optional: a free [Last.fm API key](https://www.last.fm/api/account/create) (much better styles)
- Optional: a [Google Takeout](https://takeout.google.com) export (plays and listening times)

## Installation

```bash
git clone https://github.com/<you>/ytmusic-analyse.git
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

In the commands below, `python` means `.venv\Scripts\python` (Windows) or `.venv/bin/python`.

## Step by step

### 1. Request Google Takeout now (optional, takes hours to a day)

1. Open <https://takeout.google.com> → **Deselect all**
2. Tick only **YouTube and YouTube Music**
3. **Multiple formats** → set **History** to **JSON** (the default HTML does not work)
4. **All YouTube data included** → keep only **history**, **playlists** and **music (library and uploads)**
   (leave out *videos*, they can be huge)
5. Export once, as .zip

### 2. Log in to YouTube Music (create `browser.json`)

The file holds your login cookie. It stays on your machine and is listed in `.gitignore` –
**never share or commit it.**

1. Copy the template: `browser.example.json` → `browser.json`
2. Open <https://music.youtube.com> in Chrome/Edge/Firefox while logged in
3. Press **F12** → **Network** tab → reload the page
4. Click a request such as `browse?…`, `account_menu?…` or `guide?…` (method POST)
5. In **Request headers**, right-click `cookie` → **Copy value**
6. In `browser.json`, replace `PASTE_YOUR_COOKIE_HERE` with that value – one line, between the quotes

Alternative: run `ytmusicapi browser` (installed with the requirements) and paste all request headers.

Do not log out of YouTube in that browser, otherwise the cookie becomes invalid.

### 3. Fetch your liked songs

```bash
python ytm.py fetch
```

### 4. Last.fm API key (optional, recommended)

Without it, styles come from MusicBrainz only and many artists stay "Unknown".
Create a key at <https://www.last.fm/api/account/create> (name and description are free text,
callback and homepage can stay empty; the key is shown immediately and is free for personal use).
Copy `.env.example` to `.env` and fill in:

```
LASTFM_API_KEY=your_key
```

### 5. Enrich

```bash
python ytm.py enrich
```

Runtime grows with the number of artists and albums: roughly 1 s per album and artist (YT Music),
0.25 s per artist (Last.fm) and 1.1 s per artist (MusicBrainz allows one request per second).
For ~3,000 artists expect 1–2 hours. Interrupting with Ctrl+C is safe – the next run continues
where it stopped. Tip: run the services in parallel in separate terminals:

```bash
python ytm.py enrich --no-lastfm --no-mb
```
```bash
python ytm.py enrich --no-albums --no-artists --no-mb
```
```bash
python ytm.py enrich --no-albums --no-artists --no-lastfm
```

### 6. Import Takeout (when the ZIP has arrived)

```bash
python ytm.py takeout "path/to/takeout-XXXX.zip"
```

The ZIP is read directly – no need to unpack it.

### 7. Build and open

```bash
python ytm.py build
python ytm.py open
```

| File in `out/` | Content |
|---|---|
| `index.html` | the interactive page (needs internet once for D3 from cdnjs) |
| `report.md` | all key numbers as text |
| `songs.csv` | all songs with metadata (opens in Excel) |
| `kuenstler_netzwerk.gexf` | artist graph for [Gephi](https://gephi.org) |

Deep links: `out/index.html#home`, `#taste`, `#time`, `#listen`, `#discover`, `#network`, `#bubbles`, `#artists`,
`#songs`, and `?lang=en` / `?lang=de`. Filters and open profiles are part of the address too
(e.g. `#taste?g=Trance&y0=2010&y1=2019`), so you can bookmark them.

## Language

- **Page:** button in the header; default is the browser language.
- **Command line and `report.md`:** system language, override with `YTM_LANG=en` or `YTM_LANG=de`.
- **Time zone** for the listening heatmap: system time zone, override with e.g. `YTM_TZ=Europe/Berlin`.

## Limitations

- **ytmusicapi is unofficial.** If YouTube changes its internals, fetching can break
  (`pip install -U ytmusicapi` usually helps). Cookie-based login is marked as deprecated in ytmusicapi
  but works as of version 1.12.
- YouTube Music sometimes reports more liked songs than it returns (deleted/blocked tracks) and
  lists some songs twice; duplicates are removed and the gap is shown.
- **Like dates** are only available if your Takeout contains the liked list with timestamps (often it
  does not). Otherwise "how your taste changed" uses the like order.
- **Plays** only cover the period your YouTube history keeps (auto-delete settings).
  YT Music sometimes plays a different version (video instead of audio) with its own ID, so
  "never played" is an upper bound.
- **Styles** belong to the main artist, not to the individual song.
- For **uploads** (user-uploaded videos) the artist is read from "Artist - Title"; otherwise the
  channel name is used.
- BPM/energy/danceability are not available (Spotify closed that API for new apps).

## Project layout

```
ytm.py             command line (fetch, enrich, takeout, build, open, demo)
ytmlib/fetch.py    fetching via ytmusicapi
ytmlib/enrich.py   albums, artists, Last.fm, MusicBrainz (cached in data/cache/)
ytmlib/takeout.py  Google Takeout parser
ytmlib/build.py    statistics, network + Louvain clusters, output
ytmlib/genres.py   tags → styles
ytmlib/demo.py     made-up demo data
web/               page (D3, DE/EN), copied to out/:
                   core.js (data, filter, address), charts.js (charts), pages.js (pages),
                   maps.js (network, bubbles), app.js (navigation, profile, search), i18n.js (texts)
tests/             parser and build test
```

## Disclaimer

Not affiliated with Google, YouTube, Last.fm or MusicBrainz. For personal use with your own account.
Respect the terms of the services you query.

## License

[MIT](LICENSE)
