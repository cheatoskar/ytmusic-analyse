"""Schritt 2: Songs anreichern.

- Alben (ytmusicapi): Erscheinungsjahr, Typ (Album/Single/EP)
- Kuenstler (ytmusicapi): Abonnenten, verwandte Kuenstler (fuer die Map)
- Last.fm (wenn LASTFM_API_KEY in .env): Stil-Tags, parallel
- MusicBrainz: Herkunftsland, Typ (Person/Gruppe), Startjahr, Tags (1 Anfrage/s)

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


def _migrate_legacy_tags() -> None:
    """Alter gemeinsamer Cache tags.json -> getrennte Caches musicbrainz.json und lastfm.json."""
    cdir = cache_dir(DATA)
    legacy = load_json(cdir / "tags.json")
    if not legacy:
        return
    mb = load_json(cdir / "musicbrainz.json", {})
    lf = load_json(cdir / "lastfm.json", {})
    for k, entry in legacy.items():
        if "mb" in entry and k not in mb:
            mb[k] = entry["mb"]
        if "lastfm" in entry and k not in lf:
            lf[k] = entry["lastfm"]
    save_json(cdir / "musicbrainz.json", mb)
    save_json(cdir / "lastfm.json", lf)
    os.replace(cdir / "tags.json", cdir / "tags.legacy.json")


def _names(songs: list[dict]) -> list[str]:
    return sorted({a["name"] for s in songs for a in s["artists"]})


def enrich_lastfm(songs: list[dict], workers: int = 4) -> None:
    """Stil-Tags von Last.fm. Parallel, aber hoechstens ~4 Anfragen/s (Last.fm erlaubt 5/s)."""
    import threading
    from concurrent.futures import ThreadPoolExecutor

    import requests

    load_env()
    key = os.environ.get("LASTFM_API_KEY", "").strip()
    if not key:
        print(tr("Last.fm: kein LASTFM_API_KEY in .env – übersprungen (Stile dann nur aus MusicBrainz).",
                 "Last.fm: no LASTFM_API_KEY in .env – skipped (styles from MusicBrainz only)."))
        return
    path = cache_dir(DATA) / "lastfm.json"
    cache = load_json(path, {})
    todo = [n for n in _names(songs) if n.casefold() not in cache]
    print(tr(f"Last.fm: {len(cache)} im Cache, {len(todo)} offen (~{len(todo) / 4 / 60:.0f} min)",
             f"Last.fm: {len(cache)} cached, {len(todo)} to do (~{len(todo) / 4 / 60:.0f} min)"))
    if not todo:
        return
    lock = threading.Lock()
    prog = Progress(len(todo), "Last.fm", every=100)
    local = threading.local()

    def fetch(name: str) -> None:
        if not hasattr(local, "s"):
            local.s = requests.Session()
            local.s.headers["User-Agent"] = USER_AGENT
        try:
            tags = _lastfm(local.s, name, key)
        except Exception as e:  # noqa: BLE001
            tags = None
            err = str(e)[:200]
        time.sleep(1.0)  # pro Thread 1/s -> insgesamt ~workers/s
        with lock:
            if tags is not None:
                cache[name.casefold()] = tags
            elif "401" in err or "403" in err:
                print(tr(f"Last.fm lehnt den Key ab: {err}", f"Last.fm rejected the key: {err}"))
            prog.tick()
            if prog.done % 100 == 0:
                save_json(path, cache)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(fetch, todo))
    save_json(path, cache)


def enrich_musicbrainz(songs: list[dict]) -> None:
    """Herkunftsland, Typ, Startjahr und Tags von MusicBrainz (streng 1 Anfrage/s)."""
    import requests

    path = cache_dir(DATA) / "musicbrainz.json"
    cache = load_json(path, {})
    todo = [n for n in _names(songs) if n.casefold() not in cache]
    print(tr(f"MusicBrainz: {len(cache)} im Cache, {len(todo)} offen (~{len(todo) * 1.5 / 60:.0f} min)",
             f"MusicBrainz: {len(cache)} cached, {len(todo)} to do (~{len(todo) * 1.5 / 60:.0f} min)"))
    if not todo:
        return
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    prog = Progress(len(todo), "MusicBrainz", every=50)
    for i, name in enumerate(todo):
        started = time.time()
        try:
            cache[name.casefold()] = _musicbrainz(session, name)
        except Exception as e:  # noqa: BLE001
            cache[name.casefold()] = {"found": False, "error": str(e)[:200]}
        prog.tick()
        if i % 50 == 0:
            save_json(path, cache)
        time.sleep(max(0.0, 1.1 - (time.time() - started)))  # 1 Anfrage pro Sekunde, Antwortzeit eingerechnet
    save_json(path, cache)


def run(albums: bool = True, artists: bool = True, lastfm: bool = True, musicbrainz: bool = True) -> None:
    songs = _songs()
    _migrate_legacy_tags()
    if albums:
        enrich_albums(songs)
    if artists:
        enrich_artists(songs)
    if lastfm:
        enrich_lastfm(songs)
    if musicbrainz:
        enrich_musicbrainz(songs)
    print(tr("Anreicherung fertig. Weiter mit: python ytm.py build", "Enrichment done. Next: python ytm.py build"))
