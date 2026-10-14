"""Schritt 2: Songs anreichern.

- Alben (ytmusicapi): Erscheinungsjahr, Typ (Album/Single/EP)
- Kuenstler (ytmusicapi): Abonnenten, verwandte Kuenstler (fuer die Map)
- Tags/Genres: Last.fm (wenn LASTFM_API_KEY in .env), sonst nur MusicBrainz
- MusicBrainz: Herkunftsland, Typ (Person/Gruppe), Startjahr, Tags

Alles wird in data/cache/ gespeichert. Ein Abbruch ist unkritisch: der naechste Lauf macht weiter.
"""
from __future__ import annotations

import os
import sys
import time

from .common import DATA, ROOT, Progress, cache_dir, load_env, load_json, parse_count, prepare_songs, save_json, tr

MB_URL = "https://musicbrainz.org/ws/2/artist/"
LASTFM_URL = "https://ws.audioscrobbler.com/2.0/"
USER_AGENT = "ytmusic-analyse/0.2 (personal, non-commercial; https://github.com/)"


def _songs() -> list[dict]:
    liked = load_json(DATA / "liked_songs.json")
    if not liked:
        sys.exit(tr("FEHLT: data/liked_songs.json. Zuerst 'python ytm.py fetch' ausführen.",
                    "MISSING: data/liked_songs.json. Run 'python ytm.py fetch' first."))
    return prepare_songs(liked["songs"])[0]


def _yt():
    from ytmusicapi import YTMusic

    auth = ROOT / "browser.json"
    # Alben- und Kuenstlerseiten sind oeffentlich; Auth nur nutzen, wenn vorhanden.
    return YTMusic(str(auth)) if auth.exists() else YTMusic()


def enrich_albums(songs: list[dict]) -> None:
    path = cache_dir(DATA) / "albums.json"
    cache = load_json(path, {})
    todo = sorted({s["albumId"] for s in songs if s.get("albumId")} - cache.keys())
    print(tr(f"Alben: {len(cache)} im Cache, {len(todo)} offen", f"Albums: {len(cache)} cached, {len(todo)} to do"))
    if not todo:
        return
    yt, prog = _yt(), Progress(len(todo), tr("Alben", "Albums"), every=25)
    for i, album_id in enumerate(todo):
        try:
            a = yt.get_album(album_id)
            cache[album_id] = {
                "title": a.get("title"),
                "year": int(a["year"]) if str(a.get("year") or "").isdigit() else None,
                "type": a.get("type"),
                "trackCount": a.get("trackCount"),
            }
        except Exception as e:  # noqa: BLE001
            cache[album_id] = {"error": str(e)[:200]}
        prog.tick()
        if i % 25 == 0:
            save_json(path, cache)
        time.sleep(0.2)
    save_json(path, cache)


def enrich_artists(songs: list[dict]) -> None:
    path = cache_dir(DATA) / "artists.json"
    cache = load_json(path, {})
    ids = {a["id"] for s in songs for a in s["artists"] if a.get("id")}
    todo = sorted(ids - cache.keys())
    print(tr(f"Künstler (YT Music): {len(cache)} im Cache, {len(todo)} offen", f"Artists (YT Music): {len(cache)} cached, {len(todo)} to do"))
    if not todo:
        return
    yt, prog = _yt(), Progress(len(todo), tr("Künstler", "Artists"), every=25)
    for i, artist_id in enumerate(todo):
        try:
            a = yt.get_artist(artist_id)
            related = (a.get("related") or {}).get("results") or []
            cache[artist_id] = {
                "name": a.get("name"),
                "subscribers": parse_count(a.get("subscribers")),
                "related": [
                    {"id": r.get("browseId"), "name": r.get("title")}
                    for r in related
                    if r.get("browseId")
                ],
                "thumb": ((a.get("thumbnails") or [{}])[0]).get("url"),
            }
        except Exception as e:  # noqa: BLE001 - z.B. Upload-Kanaele ohne Kuenstlerseite
            cache[artist_id] = {"error": str(e)[:200]}
        prog.tick()
        if i % 25 == 0:
            save_json(path, cache)
        time.sleep(0.2)
    save_json(path, cache)


def _musicbrainz(session, name: str) -> dict:
    r = session.get(
        MB_URL,
        params={"query": f'artist:"{name}"', "fmt": "json", "limit": 5},
        timeout=20,
    )
    if r.status_code == 503:  # Rate-Limit: kurz warten, einmal wiederholen
        time.sleep(3)
        r = session.get(MB_URL, params={"query": f'artist:"{name}"', "fmt": "json", "limit": 5}, timeout=20)
    r.raise_for_status()
    candidates = r.json().get("artists") or []
    exact = [c for c in candidates if c.get("name", "").casefold() == name.casefold()]
    pool = exact or [c for c in candidates if int(c.get("score", 0)) >= 95]
    if not pool:
        return {"found": False}
    # Bei Namensgleichheit den Eintrag mit den meisten Tags nehmen (meist der bekannte Kuenstler)
    best = max(pool, key=lambda c: (int(c.get("score", 0)), sum(t.get("count", 0) for t in c.get("tags") or [])))
    tags = sorted(best.get("tags") or [], key=lambda t: -t.get("count", 0))
    return {
        "found": True,
        "mbid": best.get("id"),
        "country": best.get("country") or ((best.get("area") or {}).get("iso-3166-1-codes") or [None])[0],
        "area": (best.get("area") or {}).get("name"),
        "kind": best.get("type"),
        "begin": ((best.get("life-span") or {}).get("begin") or "")[:4] or None,
        "tags": [t["name"] for t in tags[:10]],
    }


def _lastfm(session, name: str, key: str) -> list[str]:
    r = session.get(
        LASTFM_URL,
        params={"method": "artist.gettoptags", "artist": name, "api_key": key, "format": "json", "autocorrect": 1},
        timeout=20,
    )
    r.raise_for_status()
    tags = ((r.json().get("toptags") or {}).get("tag")) or []
    return [t["name"].lower() for t in tags if int(t.get("count", 0)) >= 10][:10]


def enrich_tags(songs: list[dict]) -> None:
    import requests

    load_env()
    key = os.environ.get("LASTFM_API_KEY", "").strip()
    path = cache_dir(DATA) / "tags.json"
    cache = load_json(path, {})
    names = sorted({a["name"] for s in songs for a in s["artists"]})
    # Eintraege ohne Last.fm-Tags nachholen, sobald ein Key vorhanden ist
    todo = [n for n in names if n.casefold() not in cache or (key and "lastfm" not in cache[n.casefold()])]
    est = len(todo) * (1.1 + (0.25 if key else 0)) / 60
    print(tr(f"Tags/Herkunft: {len(cache)} im Cache, {len(todo)} offen (~{est:.0f} min)",
             f"Tags/origin: {len(cache)} cached, {len(todo)} to do (~{est:.0f} min)")
          + ("" if key else tr("  [ohne Last.fm-Key: nur MusicBrainz, Stile lückenhafter]",
                               "  [no Last.fm key: MusicBrainz only, styles less complete]")))
    if not todo:
        return
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    prog = Progress(len(todo), "Tags", every=20)
    for i, name in enumerate(todo):
        entry = cache.get(name.casefold(), {"name": name})
        if "mb" not in entry:
            try:
                entry["mb"] = _musicbrainz(session, name)
            except Exception as e:  # noqa: BLE001
                entry["mb"] = {"found": False, "error": str(e)[:200]}
            time.sleep(1.1)  # MusicBrainz erlaubt 1 Anfrage pro Sekunde
        if key and "lastfm" not in entry:
            try:
                entry["lastfm"] = _lastfm(session, name, key)
            except Exception as e:  # noqa: BLE001
                entry["lastfm_error"] = str(e)[:200]
            time.sleep(0.25)
        cache[name.casefold()] = entry
        prog.tick()
        if i % 20 == 0:
            save_json(path, cache)
    save_json(path, cache)


def run(albums: bool = True, artists: bool = True, tags: bool = True) -> None:
    songs = _songs()
    if albums:
        enrich_albums(songs)
    if artists:
        enrich_artists(songs)
    if tags:
        enrich_tags(songs)
    print(tr("Anreicherung fertig. Weiter mit: python ytm.py build", "Enrichment done. Next: python ytm.py build"))
