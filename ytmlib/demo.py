"""Erzeugt erfundene Beispieldaten, um die Auswertung ohne eigenen Account zu testen."""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from .common import ROOT, save_json

DEMO_DATA = ROOT / "data_demo"
DEMO_OUT = ROOT / "out_demo"

SCENES = {
    "deutschrap": (["german hip hop", "deutschrap", "hip hop", "trap"], "DE", (2012, 2026)),
    "us-rap": (["hip hop", "rap", "trap", "west coast"], "US", (1994, 2026)),
    "pop": (["pop", "dance pop", "electropop"], "US", (2008, 2026)),
    "house": (["house", "deep house", "electronic", "dance"], "GB", (2010, 2026)),
    "techno": (["techno", "electronic", "melodic techno"], "DE", (2014, 2026)),
    "rock": (["rock", "alternative rock", "indie rock"], "GB", (1970, 2020)),
    "rnb": (["r&b", "soul", "neo-soul"], "US", (1998, 2026)),
    "indie": (["indie", "indie pop", "singer-songwriter"], "SE", (2006, 2026)),
    "afro": (["afrobeats", "afro", "dancehall"], "NG", (2015, 2026)),
    "film": (["soundtrack", "score", "instrumental"], "DE", (1980, 2025)),
}
WEIGHTS = {"deutschrap": 26, "us-rap": 16, "pop": 12, "house": 10, "techno": 7, "rock": 8,
           "rnb": 9, "indie": 6, "afro": 4, "film": 2}
SYL = ["ka", "lo", "mi", "ra", "ve", "no", "zu", "fa", "ri", "xo", "ta", "be", "lu", "sa", "do", "ny"]
WORDS = ["Nacht", "Gold", "Neon", "Echo", "Blau", "Rausch", "Fieber", "Ozean", "Beton", "Sterne", "Stille",
         "Feuer", "Signal", "Glas", "Regen", "Ferne", "Puls", "Asphalt", "Mond", "Kristall"]


def _name(rng):
    return "".join(rng.choice(SYL) for _ in range(rng.randint(2, 3))).capitalize() + rng.choice(["", "", " K", " MC", " & Co"])


def run() -> None:
    rng = random.Random(7)
    artists, tags_cache, yt_cache = [], {}, {}
    for scene, (tags, country, _) in SCENES.items():
        for i in range(WEIGHTS[scene] // 2 + 3):
            aid = f"UC{scene[:4]}{i:03d}".ljust(24, "x")
            name = _name(rng)
            tg = tags[:]
            rng.shuffle(tg)
            artists.append({"id": aid, "name": name, "scene": scene, "pop": rng.paretovariate(1.2)})
            tags_cache[name.casefold()] = {"name": name, "lastfm": tg,
                                           "mb": {"found": True, "country": country, "kind": "Person", "tags": tg}}
            yt_cache[aid] = {"name": name, "subscribers": int(rng.lognormvariate(11.5, 2)), "related": []}
    by_scene = {}
    for a in artists:
        by_scene.setdefault(a["scene"], []).append(a)
    for a in artists:
        peers = [p for p in by_scene[a["scene"]] if p is not a]
        if rng.random() < 0.15:  # gelegentlich szeneuebergreifend
            peers += rng.sample(artists, 3)
        yt_cache[a["id"]]["related"] = [{"id": p["id"], "name": p["name"]} for p in rng.sample(peers, min(4, len(peers)))]

    songs, albums = [], {}
    total = 640
    scenes = list(WEIGHTS)
    for pos in range(total):
        # Geschmack verschiebt sich: aeltere Likes (hohe Position) mehr Rock/Indie, neuere mehr Rap/House
        drift = pos / total
        w = [WEIGHTS[s] * (1 + drift * 2 if s in ("rock", "indie", "us-rap") else 1 + (1 - drift)) for s in scenes]
        scene = rng.choices(scenes, w)[0]
        pool = by_scene[scene]
        main = rng.choices(pool, [a["pop"] for a in pool])[0]
        arts = [main] + ([rng.choice(pool)] if rng.random() < 0.18 else [])
        arts = list({a["id"]: a for a in arts}.values())
        lo, hi = SCENES[scene][2]
        year = rng.randint(lo, hi) if rng.random() < 0.3 else max(lo, hi - int(rng.expovariate(1 / 4)))
        alb_id = f"MPREb_{main['id'][:8]}{year}"
        albums[alb_id] = {"title": rng.choice(WORDS), "year": year, "type": rng.choice(["Album", "Single", "EP"])}
        title = f"{rng.choice(WORDS)} {rng.choice(WORDS).lower()}" + rng.choice(["", "", "", " (Remix)", " (Sped Up)", " (Live)"])
        songs.append({
            "videoId": f"d{pos:010d}", "position": pos, "title": title,
            "artists": [{"name": a["name"], "id": a["id"]} for a in arts],
            "album": albums[alb_id]["title"], "albumId": alb_id,
            "duration_s": int(rng.gauss(185 if scene != "film" else 260, 40)),
            "explicit": scene in ("deutschrap", "us-rap") and rng.random() < 0.7,
            "available": rng.random() > 0.02, "type": rng.choices(["Song", "Music video", "Upload"], [85, 12, 3])[0],
            "thumb": None,
        })

    # Wiedergaben: 18 Monate, abends mehr, beliebte Songs oefter
    start = datetime(2025, 4, 1, tzinfo=timezone.utc)
    plays, playlists = [], {"Liked videos": []}
    favs = rng.sample(songs, 120)
    for day in range(560):
        if rng.random() < 0.12:
            continue
        for _ in range(int(rng.gammavariate(2, 9))):
            hour = rng.choices(range(24), [1, 1, 0, 0, 0, 0, 1, 3, 4, 3, 3, 4, 5, 4, 4, 5, 6, 7, 8, 9, 9, 8, 6, 3])[0]
            t = start + timedelta(days=day, hours=hour, minutes=rng.randint(0, 59))
            if rng.random() < 0.12:
                plays.append({"v": f"x{rng.randint(0, 300):010d}", "t": t.isoformat(), "title": f"{rng.choice(WORDS)} Session", "artist": _name(rng)})
                continue
            s = rng.choice(favs) if rng.random() < 0.6 else rng.choice(songs)
            plays.append({"v": s["videoId"], "t": t.isoformat(), "title": s["title"], "artist": s["artists"][0]["name"]})
    plays.sort(key=lambda p: p["t"])
    like_start = datetime(2019, 1, 1, tzinfo=timezone.utc)
    span = (datetime(2026, 10, 1, tzinfo=timezone.utc) - like_start).total_seconds()
    for s in songs:
        ts = like_start + timedelta(seconds=span * (1 - s["position"] / total) ** 0.8)
        playlists["Liked videos"].append([s["videoId"], ts.isoformat()])

    save_json(DEMO_DATA / "liked_songs.json", {"fetched_at": "demo", "count": len(songs), "declared": len(songs), "songs": songs})
    save_json(DEMO_DATA / "cache" / "albums.json", albums)
    save_json(DEMO_DATA / "cache" / "artists.json", yt_cache)
    save_json(DEMO_DATA / "cache" / "tags.json", tags_cache)
    save_json(DEMO_DATA / "plays.json", plays, indent=None)
    save_json(DEMO_DATA / "takeout_playlists.json", playlists, indent=None)

    from .build import build
    build(DEMO_DATA, DEMO_OUT, demo=True)
