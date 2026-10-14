"""Schritt 1: Liked Songs aus YouTube Music abrufen (ytmusicapi, Browser-Auth)."""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from .common import DATA, ROOT, save_json

VIDEO_TYPES = {
    "MUSIC_VIDEO_TYPE_ATV": "Song",
    "MUSIC_VIDEO_TYPE_OMV": "Musikvideo",
    "MUSIC_VIDEO_TYPE_UGC": "Upload",
    "MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC": "Musikvideo",
    "MUSIC_VIDEO_TYPE_PODCAST_EPISODE": "Podcast",
}


def normalize(track: dict, position: int) -> dict:
    album = track.get("album") or {}
    thumbs = track.get("thumbnails") or []
    return {
        "videoId": track.get("videoId"),
        # Position 0 = zuletzt geliked. Die Liste ist neueste zuerst sortiert.
        "position": position,
        "title": track.get("title"),
        "artists": [
            {"name": a.get("name"), "id": a.get("id")}
            for a in (track.get("artists") or [])
            if a.get("name")
        ],
        "album": album.get("name"),
        "albumId": album.get("id"),
        "duration_s": track.get("duration_seconds"),
        "explicit": bool(track.get("isExplicit")),
        "available": track.get("isAvailable", True) is not False,
        "type": VIDEO_TYPES.get(track.get("videoType"), track.get("videoType") or "Unbekannt"),
        "thumb": thumbs[0]["url"] if thumbs else None,
    }


def run(auth_file: str = "browser.json") -> None:
    auth = ROOT / auth_file
    if not auth.exists():
        sys.exit(
            f"FEHLT: {auth.name}\n"
            "Erzeuge sie mit:  .venv\\Scripts\\ytmusicapi browser\n"
            "(Anleitung: README.md, Schritt 3)"
        )
    import json

    from ytmusicapi import YTMusic

    try:
        cookie = json.loads(auth.read_text(encoding="utf-8")).get("cookie", "")
    except ValueError as e:
        sys.exit(f"{auth.name} ist kein gültiges JSON mehr ({e}). Steht der Cookie in einer Zeile zwischen den Anführungszeichen?")
    if "HIER_DEINEN_COOKIE" in cookie:
        sys.exit(f"In {auth.name} steht noch der Platzhalter. Cookie-Wert einfügen (README, Schritt 3).")
    if "__Secure-3PAPISID=" not in cookie:
        sys.exit("Im Cookie fehlt __Secure-3PAPISID. Wahrscheinlich unvollständig kopiert, oder du warst nicht eingeloggt.")

    print("Verbinde mit YouTube Music ...")
    yt = YTMusic(str(auth))
    try:
        playlist = yt.get_liked_songs(limit=None)
    except Exception as e:  # noqa: BLE001 - Fehlermeldung fuer den Nutzer aufbereiten
        sys.exit(
            f"Abruf fehlgeschlagen: {e}\n"
            "Meist ist die Anmeldung abgelaufen. browser.json neu erzeugen (README, Schritt 3)."
        )
    tracks = playlist.get("tracks") or []
    songs = [normalize(t, i) for i, t in enumerate(tracks) if t.get("videoId")]
    save_json(DATA / "liked_raw.json", playlist)
    save_json(
        DATA / "liked_songs.json",
        {
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(songs),
            "declared": playlist.get("trackCount"),
            "songs": songs,
        },
    )
    declared = playlist.get("trackCount")
    print(f"OK: {len(songs)} Songs gespeichert in data/liked_songs.json")
    if declared and abs(int(declared) - len(songs)) > 5:
        print(f"Hinweis: YouTube Music meldet {declared} Songs, abgerufen wurden {len(songs)}.")
