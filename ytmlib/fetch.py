"""Schritt 1: Liked Songs aus YouTube Music abrufen (ytmusicapi, Browser-Auth)."""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from .common import DATA, ROOT, save_json, tr

VIDEO_TYPES = {
    "MUSIC_VIDEO_TYPE_ATV": "Song",
    "MUSIC_VIDEO_TYPE_OMV": "Music video",
    "MUSIC_VIDEO_TYPE_UGC": "Upload",
    "MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC": "Music video",
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
        "type": VIDEO_TYPES.get(track.get("videoType"), track.get("videoType") or "Unknown"),
        "thumb": thumbs[0]["url"] if thumbs else None,
    }


def run(auth_file: str = "browser.json") -> None:
    auth = ROOT / auth_file
    if not auth.exists():
        sys.exit(tr(
            f"FEHLT: {auth.name}. Anleitung: README.de.md, Schritt 3.",
            f"MISSING: {auth.name}. See README.md, step 3."))
    import json

    from ytmusicapi import YTMusic

    try:
        cookie = json.loads(auth.read_text(encoding="utf-8")).get("cookie", "")
    except ValueError as e:
        sys.exit(tr(f"{auth.name} ist kein gültiges JSON mehr ({e}). Steht der Cookie in einer Zeile zwischen den Anführungszeichen?",
                    f"{auth.name} is no longer valid JSON ({e}). Is the cookie on one line between the quotes?"))
    if "HIER_DEINEN_COOKIE" in cookie or "PASTE_YOUR_COOKIE" in cookie:
        sys.exit(tr(f"In {auth.name} steht noch der Platzhalter. Cookie-Wert einfügen (README, Schritt 3).",
                    f"{auth.name} still contains the placeholder. Paste your cookie value (README, step 3)."))
    if "__Secure-3PAPISID=" not in cookie:
        sys.exit(tr("Im Cookie fehlt __Secure-3PAPISID. Wahrscheinlich unvollständig kopiert, oder du warst nicht eingeloggt.",
                    "The cookie lacks __Secure-3PAPISID. It was probably copied incompletely, or you were not logged in."))

    print(tr("Verbinde mit YouTube Music ...", "Connecting to YouTube Music ..."))
    yt = YTMusic(str(auth))
    try:
        playlist = yt.get_liked_songs(limit=None)
    except Exception as e:  # noqa: BLE001 - Fehlermeldung fuer den Nutzer aufbereiten
        sys.exit(tr(
            f"Abruf fehlgeschlagen: {e}\nMeist ist die Anmeldung abgelaufen. browser.json neu erzeugen (README, Schritt 3).",
            f"Fetch failed: {e}\nUsually the login expired. Recreate browser.json (README, step 3)."))
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
    print(tr(f"OK: {len(songs)} Songs gespeichert in data/liked_songs.json", f"OK: saved {len(songs)} songs to data/liked_songs.json"))
    if declared and abs(int(declared) - len(songs)) > 5:
        print(tr(f"Hinweis: YouTube Music meldet {declared} Songs, abgerufen wurden {len(songs)}.",
                 f"Note: YouTube Music reports {declared} songs, {len(songs)} were returned."))
