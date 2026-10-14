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

from .common import DATA, save_json

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
        sys.exit(f"Nicht gefunden oder keine ZIP/kein Ordner: {source}")


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
        if it.get("header") != "YouTube Music" and "music.youtube.com" not in url:
            continue
        m = VID_RE.search(url)
        t = _parse_time(it.get("time") or "")
        if not m or not t:
            continue
        title = TITLE_SUFFIX.sub("", TITLE_PREFIX.sub("", it.get("title") or ""))
        sub = (it.get("subtitles") or [{}])[0].get("name") or ""
        plays.append({"v": m.group(1), "t": t, "title": title, "artist": sub.removesuffix(" - Topic")})
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
        if low.endswith(".json"):
            try:
                data = json.loads(raw.decode("utf-8-sig"))
            except (ValueError, UnicodeDecodeError):
                continue
            if isinstance(data, list) and data and isinstance(data[0], dict) and "titleUrl" in data[0]:
                found = _parse_history(data)
                print(f"  Verlauf: {name} -> {len(found)} YouTube-Music-Wiedergaben")
                plays.extend(found)
        elif low.endswith(".csv"):
            entries = _parse_playlist_csv(raw)
            if entries:
                playlists[Path(name).stem] = entries
                print(f"  Playlist: {Path(name).stem} -> {len(entries)} Eintraege")

    if not plays and html_history:
        print("ACHTUNG: Der Verlauf liegt nur als HTML vor. Takeout neu anfordern mit Format JSON (README, Schritt 4).")
    plays.sort(key=lambda p: p["t"])
    save_json(DATA / "plays.json", plays, indent=None)
    save_json(DATA / "takeout_playlists.json", playlists, indent=None)
    print(f"OK: {len(plays)} Wiedergaben, {len(playlists)} Playlists gespeichert. Weiter mit: python ytm.py build")
