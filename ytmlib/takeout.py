"""Schritt 4 (optional): Google-Takeout-Export einlesen.

Liest direkt aus der ZIP-Datei (oder einem entpackten Ordner):
- Wiedergabeverlauf (JSON): jeder YouTube-Music-Abspielvorgang mit Zeitstempel
- Playlist-CSVs: Video-ID + Hinzufuege-Zeitpunkt (daraus: wann du einen Song geliked hast)
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import zipfile
from datetime import datetime
from pathlib import Path

from .common import DATA, save_json, tr

VID_RE = re.compile(r"[?&]v=([A-Za-z0-9_-]{11})")
ID_ONLY = re.compile(r"^[A-Za-z0-9_-]{11}$")
TITLE_PREFIX = re.compile(r"^(Watched|Angesehen:?|Hat .* angesehen)\s+", re.I)
TITLE_SUFFIX = re.compile(r"\s+angesehen$", re.I)


def _iter_files(source: Path):
    """Liefert (Name, Bytes) fuer alle JSON-, CSV- und HTML-Dateien."""
    if source.is_file() and source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as z:
            for info in z.infolist():
                if info.filename.lower().endswith((".json", ".csv", ".html")):
                    yield info.filename, z.read(info)
    elif source.is_dir():
        for p in source.rglob("*"):
            if p.suffix.lower() in (".json", ".csv", ".html"):
                yield str(p.relative_to(source)), p.read_bytes()
    else:
        sys.exit(tr(f"Nicht gefunden oder keine ZIP/kein Ordner: {source}", f"Not found, or not a ZIP/folder: {source}"))


def _parse_time(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return None


def _parse_history(items: list) -> list[dict]:
    plays = []
    for it in items:
        if not isinstance(it, dict):
            continue
        url = it.get("titleUrl") or ""
        # Normale YouTube-Wiedergaben behalten (src=yt); build zaehlt sie nur fuer Liked Songs mit
        src = "music" if it.get("header") == "YouTube Music" or "music.youtube.com" in url else "yt"
        m = VID_RE.search(url)
        t = _parse_time(it.get("time") or "")
        if not m or not t:
            continue
        title = TITLE_SUFFIX.sub("", TITLE_PREFIX.sub("", it.get("title") or ""))
        sub = (it.get("subtitles") or [{}])[0].get("name") or ""
        plays.append({"v": m.group(1), "t": t, "title": title, "artist": sub.removesuffix(" - Topic"), "src": src})
    return plays


def _parse_playlist_csv(raw: bytes) -> list[list[str]]:
    """Findet Video-ID- und Zeitstempel-Spalte heuristisch (Spaltennamen sind je nach Sprache verschieden)."""
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig", errors="replace"))))
    entries = []
    for row in rows:
        vid = next((c.strip() for c in row if ID_ONLY.match(c.strip())), None)
        ts = next((t for t in (_parse_time(c) for c in row if "T" in c or "-" in c) if t), None)
        if vid:
            entries.append([vid, ts])
    return entries


def run(source: str) -> None:
    src = Path(source).expanduser()
    plays: list[dict] = []
    playlists: dict[str, list] = {}
    html_history = False
    for name, raw in _iter_files(src):
        low = name.lower()
        if low.endswith(".html"):
            if "verlauf" in low or "history" in low:
                html_history = True
            continue
        if re.search(r"such|search", Path(low).name):
            continue  # Suchverlauf enthaelt keine Wiedergaben
        if low.endswith(".json"):
            try:
                data = json.loads(raw.decode("utf-8-sig"))
            except (ValueError, UnicodeDecodeError):
                continue
            if isinstance(data, list) and data and isinstance(data[0], dict) and "titleUrl" in data[0]:
                found = _parse_history(data)
                music = sum(1 for p in found if p["src"] == "music")
                print(tr(f"  Verlauf: {name} -> {music} YouTube-Music- und {len(found) - music} YouTube-Wiedergaben",
                         f"  History: {name} -> {music} YouTube Music and {len(found) - music} YouTube plays"))
                plays.extend(found)
        elif low.endswith(".csv"):
            if "/playlists/" not in low.replace("\\", "/") or Path(low).stem == "playlists":
                continue  # nur echte Playlist-Inhalte, nicht Metadaten oder Mediathek
            entries = _parse_playlist_csv(raw)
            if entries:
                pl_name = Path(name).stem.removesuffix("-Videos")
                playlists[pl_name] = entries
                print(tr(f"  Playlist: {pl_name} -> {len(entries)} Einträge", f"  Playlist: {pl_name} -> {len(entries)} entries"))

    if not plays and html_history:
        print(tr("ACHTUNG: Der Verlauf liegt nur als HTML vor. Takeout neu anfordern mit Format JSON (README, Schritt 1).",
                 "WARNING: The history is HTML only. Request Takeout again with JSON format (README, step 1)."))
    plays.sort(key=lambda p: p["t"])
    save_json(DATA / "plays.json", plays, indent=None)
    save_json(DATA / "takeout_playlists.json", playlists, indent=None)
    print(tr(f"OK: {len(plays)} Wiedergaben, {len(playlists)} Playlists gespeichert. Weiter mit: python ytm.py build",
             f"OK: saved {len(plays)} plays and {len(playlists)} playlists. Next: python ytm.py build"))
