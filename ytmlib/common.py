"""Gemeinsame Pfade und Hilfsfunktionen."""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "out"
WEB = ROOT / "web"


def cache_dir(data_dir: Path) -> Path:
    return data_dir / "cache"


def load_json(path: Path, default=None):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, obj, indent: int | None = 1) -> None:
    """Schreibt atomar: erst Temp-Datei, dann ersetzen. Abbruch mit Strg+C zerstoert so keinen Cache."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
    os.replace(tmp, path)


def load_env() -> None:
    """Liest ROOT/.env (KEY=VALUE) in os.environ, ohne gesetzte Werte zu ueberschreiben."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_COUNT_RE = re.compile(r"([\d.,]+)\s*([KMB]?)", re.I)


def parse_count(text) -> int | None:
    """'1.23M subscribers' -> 1230000, '845K' -> 845000, '12,345' -> 12345."""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return int(text)
    m = _COUNT_RE.search(str(text))
    if not m:
        return None
    num, suffix = m.group(1), m.group(2).upper()
    if suffix:
        value = float(num.replace(",", "."))
    else:
        value = float(num.replace(",", "").replace(".", ""))
    return int(value * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9}[suffix])


_TITLE_SEP = re.compile(r"\s+[-–—]\s+")
_ARTIST_SPLIT = re.compile(r"\s*,\s*|\s+(?:feat\.?|ft\.?|featuring)\s+", re.I)


def artist_from_title(title: str) -> str | None:
    """'Luttrell, X - Song (Remix)' -> 'Luttrell'; None, wenn der Titel kein 'Kuenstler - Titel' ist."""
    parts = _TITLE_SEP.split(title or "", maxsplit=1)
    if len(parts) != 2:
        return None
    names = [n.strip() for n in _ARTIST_SPLIT.split(parts[0]) if n.strip()]
    return names[0] if names else None


def prepare_songs(songs: list[dict]) -> tuple[list[dict], dict]:
    """Bereinigt die Rohliste fuer die Auswertung.

    - Doppelte videoIds entfernen (die neueste Position bleibt).
    - Uploads ('Kuenstler - Titel' im Titel): Kuenstler aus dem Titel statt Upload-Kanal.
      Der Kanal bleibt als 'uploader' erhalten. Bei '&' wird nicht getrennt (Above & Beyond).
    """
    seen, out = set(), []
    info = {"duplicates_removed": 0, "uploads_parsed": 0, "uploads_unparsed": 0}
    for s in songs:
        if s["videoId"] in seen:
            info["duplicates_removed"] += 1
            continue
        seen.add(s["videoId"])
        if s.get("type") == "Upload":
            parts = _TITLE_SEP.split(s.get("title") or "", maxsplit=1)
            names = [n.strip() for n in _ARTIST_SPLIT.split(parts[0]) if n.strip()] if len(parts) == 2 else []
            if names and parts[1].strip():
                s = {**s, "uploader": s["artists"][0]["name"] if s["artists"] else None,
                     "artists": [{"name": n, "id": None} for n in names], "title": parts[1].strip()}
                info["uploads_parsed"] += 1
            else:
                info["uploads_unparsed"] += 1
        out.append(s)
    return out, info


class Progress:
    """Einfache Fortschrittsanzeige mit Restzeit."""

    def __init__(self, total: int, label: str, every: int = 10):
        self.total, self.label, self.every = total, label, every
        self.start = time.time()
        self.done = 0

    def tick(self) -> None:
        self.done += 1
        if self.done % self.every == 0 or self.done == self.total:
            elapsed = time.time() - self.start
            rest = elapsed / self.done * (self.total - self.done)
            print(f"  {self.label}: {self.done}/{self.total}  (noch ~{rest/60:.1f} min)", flush=True)
