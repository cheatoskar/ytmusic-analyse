"""Schritt 5: Alles zusammenfuehren, exakte Kennzahlen berechnen, Graph bauen, Seite erzeugen."""
from __future__ import annotations

import csv
import json
import re
import shutil
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from itertools import combinations
from pathlib import Path

from .common import DATA, OUT, WEB, artist_from_title, cache_dir, load_json, prepare_songs
from .genres import OTHER, UNKNOWN, clean_tags, macro_genre

LIKED_PLAYLIST_NAME = re.compile(r"lik|mag|gef[aä]ll|favorit", re.I)
WATCH_LATER = re.compile(r"watch later|sp[aä]ter ansehen", re.I)
VERSION_TAGS = {
    "Remix": r"\bremix\b|\brmx\b",
    "Sped up": r"sped[\s-]?up|nightcore",
    "Slowed": r"slowed|reverb",
    "Live": r"\blive\b",
    "Akustik": r"acoustic|akustik|unplugged",
    "Remaster": r"remaster",
    "Instrumental": r"instrumental",
    "Cover": r"\bcover\b",
    "feat.": r"\bfeat\.?|\bft\.|featuring|\bwith\b",
}
SET_SECONDS = 20 * 60
SUB_BUCKETS = [(0, "< 10 Tsd."), (10_000, "10–100 Tsd."), (100_000, "100 Tsd.–1 Mio."),
               (1_000_000, "1–10 Mio."), (10_000_000, "> 10 Mio.")]


def _tz():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo("Europe/Berlin")
    except Exception:  # noqa: BLE001 - ohne tzdata: UTC
        return timezone.utc


def _top(counter: Counter, n: int) -> list[list]:
    return [[k, v] for k, v in counter.most_common(n)]


def _share(part: float, whole: float) -> float:
    return round(100 * part / whole, 1) if whole else 0.0


def _liked_timestamps(playlists: dict, liked_ids: set[str]) -> tuple[dict[str, str], str | None]:
    best, best_key = None, None
    for name, entries in playlists.items():
        ids = {e[0] for e in entries}
        overlap = len(ids & liked_ids) / max(1, len(liked_ids))
        has_ts = sum(1 for e in entries if e[1]) > 0.5 * len(entries)
        if not has_ts or overlap < 0.2:
            continue
        key = (bool(LIKED_PLAYLIST_NAME.search(name)), overlap)
        if best_key is None or key > best_key:
            best, best_key = name, key
    if not best:
        return {}, None
    out = {}
    for vid, ts in playlists[best]:
        if ts and (vid not in out or ts < out[vid]):
            out[vid] = ts
    return out, best


def _artist_tags(name: str, tag_cache: dict) -> tuple[list[str], dict]:
    entry = tag_cache.get(name.casefold()) or {}
    mb = entry.get("mb") or {}
    tags = clean_tags(entry.get("lastfm") or []) or clean_tags(mb.get("tags") or [])
    return tags, mb


def build(data_dir: Path = DATA, out_dir: Path = OUT, demo: bool = False) -> Path:
    liked = load_json(data_dir / "liked_songs.json")
    if not liked:
        sys.exit("FEHLT: data/liked_songs.json. Zuerst 'python ytm.py fetch' ausfuehren.")
    songs, cleanup = prepare_songs(liked["songs"])
    cdir = cache_dir(data_dir)
    albums = load_json(cdir / "albums.json", {})
    yt_artists = load_json(cdir / "artists.json", {})
    tag_cache = load_json(cdir / "tags.json", {})
    plays = load_json(data_dir / "plays.json", [])
    playlists = load_json(data_dir / "takeout_playlists.json", {})
    tz = _tz()

    # ---------- Kuenstler zusammenfuehren (ID, sonst Name) ----------
    name_to_id = {}
    for s in songs:
        for a in s["artists"]:
            if a.get("id"):
                name_to_id.setdefault(a["name"].casefold(), a["id"])

    def akey(a: dict) -> str:
        return a.get("id") or name_to_id.get(a["name"].casefold()) or "n:" + a["name"].casefold()

    artists: dict[str, dict] = {}
    for idx, s in enumerate(songs):
        for a in s["artists"]:
            k = akey(a)
            rec = artists.setdefault(k, {"key": k, "name": a["name"], "songs": [], "plays": 0})
            rec["songs"].append(idx)

    for k, rec in artists.items():
        info = yt_artists.get(k) or {}
        tags, mb = _artist_tags(rec["name"], tag_cache)
        rec.update({
            "tags": tags[:8],
            "genre": macro_genre(tags),
            "subs": info.get("subscribers"),
            "country": mb.get("country"),
            "kind": mb.get("kind"),
            "begin": mb.get("begin"),
            "related_raw": [r["id"] for r in info.get("related") or []],
        })

    # ---------- Songs anreichern ----------
    liked_ids_all = {s["videoId"] for s in songs}
    # YT-Music-Wiedergaben immer; normale YouTube-Wiedergaben nur, wenn der Titel in den Likes steht
    plays_yt_liked = sum(1 for p in plays if p.get("src") == "yt" and p["v"] in liked_ids_all)
    plays = [p for p in plays if p.get("src", "music") == "music" or p["v"] in liked_ids_all]
    liked_at, liked_source = _liked_timestamps(playlists, liked_ids_all)
    play_count = Counter(p["v"] for p in plays)
    play_last = {}
    for p in plays:
        play_last[p["v"]] = p["t"]
    for idx, s in enumerate(songs):
        alb = albums.get(s.get("albumId") or "") or {}
        s["year"] = alb.get("year")
        s["albumType"] = alb.get("type")
        keys = [akey(a) for a in s["artists"]]
        s["keys"] = keys
        main = artists[keys[0]] if keys else None
        # Genre: erster Kuenstler mit bekanntem Genre
        s["genre"] = next((artists[k]["genre"] for k in keys if artists[k]["genre"] != UNKNOWN), UNKNOWN)
        s["tags"] = main["tags"][:5] if main else []
        s["plays"] = play_count.get(s["videoId"], 0)
        s["likedAt"] = liked_at.get(s["videoId"])
        for k in keys:
            artists[k]["plays"] += s["plays"]

    # Die 8 haeufigsten Stile bekommen eine Farbe, der Rest wird fuer Farbe/Stapel zu 'Weitere Stile'
    style_counts = Counter(s["genre"] for s in songs if s["genre"] != UNKNOWN)
    color_styles = [g for g, _ in style_counts.most_common(8)]

    def collapse(g: str) -> str:
        return g if g in color_styles or g == UNKNOWN else OTHER

    # Eigene Playlists (ohne 'Spaeter ansehen'): Mitgliedschaft je Song, sortiert nach Anzahl Liked Songs
    by_id = {s["videoId"]: i for i, s in enumerate(songs)}
    pl_members = {name: sorted({by_id[e[0]] for e in entries if e[0] in by_id})
                  for name, entries in playlists.items() if not WATCH_LATER.search(name)}
    pl_names = [name for name, m in sorted(pl_members.items(), key=lambda kv: -len(kv[1])) if m]
    for s in songs:
        s["pl"] = []
    for pi, name in enumerate(pl_names):
        for i in pl_members[name]:
            songs[i]["pl"].append(pi)
    for r in artists.values():
        pc = Counter(pi for i in r["songs"] for pi in songs[i]["pl"])
        r["playlist"] = pc.most_common(1)[0][0] if pc else -1

    n = len(songs)
    all_durations = [s["duration_s"] for s in songs if s.get("duration_s")]
    # DJ-Sets/Mixe (> 20 min) verzerren Durchschnitt und Verteilung: getrennt ausweisen
    durations = [d for d in all_durations if d <= SET_SECONDS]
    sets = [d for d in all_durations if d > SET_SECONDS]
    years = [s["year"] for s in songs if s.get("year")]

    # ---------- Kennzahlen ----------
    artist_song_counts = Counter({k: len(r["songs"]) for k, r in artists.items()})
    main_artist_counts = Counter(s["keys"][0] for s in songs if s["keys"])
    top10 = sum(c for _, c in main_artist_counts.most_common(10))
    singles = sum(1 for c in artist_song_counts.values() if c == 1)

    genre_counts = Counter(s["genre"] for s in songs)
    decade_counts = Counter(f"{y // 10 * 10}er" for y in years)
    year_counts = Counter(years)
    country_counts = Counter()
    for s in songs:
        c = artists[s["keys"][0]]["country"] if s["keys"] else None
        country_counts[c or "?"] += 1
    tag_counts = Counter(t for s in songs for t in s["tags"])
    type_counts = Counter(s["type"] for s in songs)
    album_type_counts = Counter(s.get("albumType") or "?" for s in songs)
    version_counts = Counter()
    for s in songs:
        for label, rx in VERSION_TAGS.items():
            if re.search(rx, s["title"] or "", re.I):
                version_counts[label] += 1

    sub_bucket_counts = Counter()
    weighted_subs = []
    for s in songs:
        subs = artists[s["keys"][0]]["subs"] if s["keys"] else None
        if subs is None:
            continue
        weighted_subs.append(subs)
        label = [lab for lim, lab in SUB_BUCKETS if subs >= lim][-1]
        sub_bucket_counts[label] += 1

    dur_hist = Counter(min(d // 30, 20) for d in durations)  # 30-s-Klassen, alles ab 10 min zusammen
    collab_songs = sum(1 for s in songs if len(s["keys"]) > 1)
    pair_counts = Counter()
    for s in songs:
        for a, b in combinations(sorted(set(s["keys"])), 2):
            pair_counts[(a, b)] += 1

    # Geschmacksentwicklung: nach Like-Datum (Quartale) oder Listenposition (10 Abschnitte)
    evolution = {"mode": None, "buckets": []}
    dated = [s for s in songs if s.get("likedAt")]
    if len(dated) > 0.5 * n:
        dts = [(datetime.fromisoformat(s["likedAt"]).astimezone(tz), collapse(s["genre"])) for s in dated]
        quarters = {(d.year, (d.month - 1) // 3) for d, _ in dts}
        by_year = len(quarters) > 16
        evolution["mode"] = "Jahr (Like-Datum)" if by_year else "Quartal (Like-Datum)"
        groups = defaultdict(Counter)
        for d, g in dts:
            groups[str(d.year) if by_year else f"{d.year} Q{(d.month - 1) // 3 + 1}"][g] += 1
        # Abschnitte mit sehr wenigen Songs verzerren die Anteile: weglassen
        min_n = max(5, round(0.01 * len(dated)))
        evolution["buckets"] = [{"label": k, "counts": dict(groups[k])} for k in sorted(groups)
                                if sum(groups[k].values()) >= min_n]
    elif n >= 20:
        evolution["mode"] = "Like-Reihenfolge (10 gleich große Abschnitte, alt → neu)"
        ordered = sorted(songs, key=lambda s: -s["position"])
        size = n / 10
        for i in range(10):
            chunk = ordered[int(i * size): int((i + 1) * size)]
            evolution["buckets"].append({"label": f"{i * 10}–{(i + 1) * 10} %",
                                         "counts": dict(Counter(collapse(s["genre"]) for s in chunk))})

    pl_stats = []
    for pi, name in enumerate(pl_names):
        members = [songs[i] for i in pl_members[name]]
        pl_stats.append({"name": name, "total": len(playlists[name]), "liked": len(members),
                         "counts": dict(Counter(collapse(s["genre"]) for s in members)),
                         "top": [g for g, _ in Counter(s["genre"] for s in members if s["genre"] != UNKNOWN).most_common(3)]})

    stats = {
        "songs": n,
        "artists": len(artists),
        "albums": len({s["albumId"] for s in songs if s.get("albumId")}),
        "total_duration_s": sum(all_durations),
        "sets": len(sets),
        "sets_duration_s": sum(sets),
        "avg_duration_s": round(statistics.mean(durations)) if durations else None,
        "median_duration_s": round(statistics.median(durations)) if durations else None,
        "explicit_pct": _share(sum(s["explicit"] for s in songs), n),
        "unavailable": sum(not s["available"] for s in songs),
        "top10_artist_pct": _share(top10, n),
        "single_song_artist_pct": _share(singles, len(artists)),
        "collab_pct": _share(collab_songs, n),
        "median_year": int(statistics.median(years)) if years else None,
        "year_known_pct": _share(len(years), n),
        "genre_known_pct": _share(n - genre_counts.get(UNKNOWN, 0), n),
        "median_subs": int(statistics.median(weighted_subs)) if weighted_subs else None,
        "top_artists": [[artists[k]["name"], c, artists[k]["genre"]] for k, c in main_artist_counts.most_common(30)],
        "genres": sorted(([g, c] for g, c in genre_counts.items() if g != UNKNOWN), key=lambda x: -x[1])
                  + ([[UNKNOWN, genre_counts[UNKNOWN]]] if genre_counts.get(UNKNOWN) else []),
        "playlists": pl_stats,
        "in_playlist": sum(1 for s in songs if s["pl"]),
        "decades": sorted(decade_counts.items()),
        "years": sorted(year_counts.items()),
        "countries": _top(country_counts, 20),
        "tags": _top(tag_counts, 25),
        "types": _top(type_counts, 10),
        "album_types": _top(album_type_counts, 10),
        "versions": _top(version_counts, 10),
        "subs_buckets": [[lab, sub_bucket_counts.get(lab, 0)] for _, lab in SUB_BUCKETS],
        "duration_hist": [[i * 30, dur_hist.get(i, 0)] for i in range(21)],
        "top_pairs": [[artists[a]["name"], artists[b]["name"], c] for (a, b), c in pair_counts.most_common(15)],
        "longest": [[s["title"], ", ".join(a["name"] for a in s["artists"]), s["duration_s"]]
                    for s in sorted(songs, key=lambda s: -(s.get("duration_s") or 0))[:5]],
        "oldest": [[s["title"], ", ".join(a["name"] for a in s["artists"]), s["year"]]
                   for s in sorted((s for s in songs if s.get("year")), key=lambda s: s["year"])[:10]],
        "evolution": evolution,
        "liked_source": liked_source,
        "cleanup": {**cleanup, "fetched": len(liked["songs"]),
                    "declared": liked.get("declared") or (load_json(data_dir / "liked_raw.json") or {}).get("trackCount")},
    }

    # ---------- Wiedergaben (Takeout) ----------
    if plays:
        liked_ids = {s["videoId"] for s in songs}
        local = [datetime.fromisoformat(p["t"]).astimezone(tz) for p in plays]
        heat = [[0] * 24 for _ in range(7)]
        months, days = Counter(), Counter()
        for d in local:
            heat[d.weekday()][d.hour] += 1
            months[d.strftime("%Y-%m")] += 1
            days[d.date()] += 1
        streak = best_streak = 0
        prev = None
        for day in sorted(days):
            streak = streak + 1 if prev and day - prev == timedelta(days=1) else 1
            best_streak = max(best_streak, streak)
            prev = day
        meta = {}
        for p in plays:
            meta[p["v"]] = (p["title"], p["artist"])
        song_by_id = {s["videoId"]: s for s in songs}
        # Liked Song: echter Hauptkuenstler. Sonst Kuenstler aus 'Kuenstler - Titel', erst zuletzt der Kanal
        # (der ist oft ein Label wie Anjunadeep).
        def play_artist(p):
            s = song_by_id.get(p["v"])
            if s and s["artists"]:
                return s["artists"][0]["name"]
            return artist_from_title(p["title"]) or p["artist"]

        artist_plays = Counter(a for a in map(play_artist, plays) if a)

        def label(v):
            if v in song_by_id:
                s = song_by_id[v]
                return [s["title"], ", ".join(a["name"] for a in s["artists"])]
            return list(meta.get(v, (v, "")))

        busiest = days.most_common(1)[0]
        stats["plays"] = {
            "total": len(plays),
            "from_youtube": plays_yt_liked,
            "unique": len(play_count),
            "first": local[0].date().isoformat(),
            "last": local[-1].date().isoformat(),
            "active_days": len(days),
            "best_streak_days": best_streak,
            "busiest_day": [busiest[0].isoformat(), busiest[1]],
            "liked_share_pct": _share(sum(c for v, c in play_count.items() if v in liked_ids), len(plays)),
            "liked_never_played": sum(1 for s in songs if s["plays"] == 0),
            "est_hours": round(len(plays) * (stats["avg_duration_s"] or 200) / 3600),
            "months": sorted(months.items()),
            "heatmap": heat,
            "top_songs": [label(v) + [c, v in liked_ids] for v, c in play_count.most_common(25)],
            "top_artists": _top(artist_plays, 20),
            "top_not_liked": [label(v) + [c] for v, c in play_count.most_common() if v not in liked_ids][:15],
        }

    # ---------- Netzwerk ----------
    import networkx as nx

    G = nx.Graph()
    for k, r in artists.items():
        G.add_node(k)
    edges: dict[tuple, dict] = {}

    def add_edge(a, b, kind, w):
        if a == b:
            return
        key = tuple(sorted((a, b)))
        e = edges.setdefault(key, {"feat": 0, "related": 0, "tags": 0.0})
        e[kind] = max(e[kind], w) if kind == "tags" else e[kind] + w

    for (a, b), c in pair_counts.items():
        add_edge(a, b, "feat", c)
    for k, r in artists.items():
        for rid in r["related_raw"]:
            if rid in artists:
                add_edge(k, rid, "related", 1)
    # Tag-Aehnlichkeit (Jaccard), je Kuenstler nur die 2 staerksten, sonst wird es ein Knaeuel
    tagged = {k: set(r["tags"]) for k, r in artists.items() if len(r["tags"]) >= 2}
    by_tag = defaultdict(set)
    for k, ts in tagged.items():
        for t in ts:
            by_tag[t].add(k)
    for k, ts in tagged.items():
        cands = set().union(*(by_tag[t] for t in ts)) - {k}
        scored = sorted(((len(ts & tagged[o]) / len(ts | tagged[o]), o) for o in cands), reverse=True)[:2]
        for j, o in scored:
            if j >= 0.4:
                add_edge(k, o, "tags", round(j, 2))
    for (a, b), e in edges.items():
        G.add_edge(a, b, weight=3 * e["feat"] + 2 * e["related"] + 2 * e["tags"])

    communities = nx.community.louvain_communities(G, weight="weight", seed=42, resolution=1.0)
    communities = sorted(communities, key=lambda c: -sum(len(artists[k]["songs"]) for k in c))
    comm_info = []
    for ci, members in enumerate(communities):
        song_n = sum(len(artists[k]["songs"]) for k in members)
        tc = Counter()
        gc = Counter()
        for k in members:
            w = len(artists[k]["songs"])
            for t in artists[k]["tags"][:3]:
                tc[t] += w
            gc[artists[k]["genre"]] += w
            artists[k]["community"] = ci
        top_members = sorted(members, key=lambda k: -len(artists[k]["songs"]))
        name = " · ".join(t for t, _ in tc.most_common(2)) or artists[top_members[0]]["name"]
        comm_info.append({"id": ci, "name": name, "songs": song_n, "artists": len(members),
                          "genre": gc.most_common(1)[0][0],
                          "top": [artists[k]["name"] for k in top_members[:6]]})

    # ---------- Ausgabe ----------
    out_dir.mkdir(parents=True, exist_ok=True)
    keys = list(artists)
    kidx = {k: i for i, k in enumerate(keys)}
    payload = {
        "meta": {"generated": datetime.now().isoformat(timespec="minutes"), "fetched": liked.get("fetched_at"),
                 "demo": demo, "genres": color_styles, "unknown": UNKNOWN, "other": OTHER,
                 "playlists": pl_names},
        "stats": stats,
        "communities": comm_info,
        "artists": [{"n": r["name"], "c": len(r["songs"]), "g": r["genre"], "t": r["tags"][:5],
                     "s": r["subs"], "co": r["country"], "p": r["plays"], "cm": r.get("community", -1), "pl": r["playlist"]}
                    for r in (artists[k] for k in keys)],
        "edges": [[kidx[a], kidx[b], e["feat"], e["related"], e["tags"]] for (a, b), e in edges.items()],
        "songs": [{"t": s["title"], "a": [kidx[k] for k in s["keys"]], "al": s.get("album"), "y": s.get("year"),
                   "d": s.get("duration_s"), "e": int(s["explicit"]), "g": s["genre"], "p": s["plays"],
                   "l": (s["likedAt"] or "")[:10] or None, "o": s["position"], "ty": s["type"],
                   "v": s["videoId"], "av": int(s["available"]), "pl": s["pl"]}
                  for s in songs],
    }
    for name in ("index.html", "app.js", "style.css"):
        shutil.copy(WEB / name, out_dir / name)
    (out_dir / "data.js").write_text("window.DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
                                     encoding="utf-8")
    _write_csv(out_dir / "songs.csv", songs, artists)
    _write_report(out_dir / "report.md", stats, comm_info)
    nx.write_gexf(_labelled(G, artists), out_dir / "kuenstler_netzwerk.gexf")
    print(f"OK: {out_dir / 'index.html'}")
    return out_dir / "index.html"


def _labelled(G, artists):
    H = G.copy()
    for k in H.nodes:
        r = artists[k]
        H.nodes[k].update({"label": r["name"], "songs": len(r["songs"]), "genre": r["genre"],
                           "community": r.get("community", -1)})
    return H


def _write_csv(path: Path, songs: list[dict], artists: dict) -> None:
    cols = ["position", "title", "artists", "album", "year", "duration_s", "genre", "tags", "explicit",
            "type", "plays", "likedAt", "videoId"]
    # Semikolon + BOM, damit ein deutsches Excel die Datei direkt richtig oeffnet
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(cols)
        for s in songs:
            w.writerow([s["position"], s["title"], ", ".join(a["name"] for a in s["artists"]), s.get("album"),
                        s.get("year"), s.get("duration_s"), s["genre"], ", ".join(s["tags"]), int(s["explicit"]),
                        s["type"], s["plays"], s.get("likedAt"), s["videoId"]])


def _fmt_dur(sec: int) -> str:
    h, rem = divmod(int(sec), 3600)
    return f"{h} h {rem // 60} min"


def _write_report(path: Path, st: dict, comms: list[dict]) -> None:
    L = ["# YT Music Liked Songs – Auswertung", ""]
    c = st["cleanup"]
    L += [f"- Abgerufen: {c['fetched']} Einträge (YouTube Music meldet {c['declared']}), "
          f"{c['duplicates_removed']} Duplikate entfernt; bei {c['uploads_parsed']} Uploads Künstler aus dem Titel gelesen",
          f"- Songs: **{st['songs']}**, Künstler: **{st['artists']}**, Alben: **{st['albums']}**",
          f"- Gesamtlänge: **{_fmt_dur(st['total_duration_s'])}**, davon {st['sets']} DJ-Sets/Mixe (> 20 min) "
          f"mit {_fmt_dur(st['sets_duration_s'])}",
          f"- Songs ohne Sets: Ø {st['avg_duration_s']} s, Median {st['median_duration_s']} s",
          f"- Explicit: {st['explicit_pct']} %, nicht mehr verfügbar: {st['unavailable']}",
          f"- Top-10-Künstler machen {st['top10_artist_pct']} % aller Songs aus; "
          f"{st['single_song_artist_pct']} % der Künstler kommen nur mit einem Song vor",
          f"- Kollaborationen: {st['collab_pct']} % der Songs",
          f"- Median-Erscheinungsjahr: {st['median_year']} (Jahr bekannt bei {st['year_known_pct']} %)",
          f"- Genre bekannt bei {st['genre_known_pct']} %", ""]
    L += ["## Genres", ""] + [f"- {g}: {c} ({_share(c, st['songs'])} %)" for g, c in st["genres"]] + [""]
    L += ["## Top-Künstler", ""] + [f"{i}. {a} – {c}" for i, (a, c, _) in enumerate(st["top_artists"], 1)] + [""]
    L += ["## Musik-Welten (Cluster)", ""] + [f"- **{c['name']}** – {c['songs']} Songs, {c['artists']} Künstler: "
                                               f"{', '.join(c['top'])}" for c in comms[:12]] + [""]
    if "plays" in st:
        p = st["plays"]
        L += ["## Wiedergaben (Takeout)", "",
              f"- {p['total']} Wiedergaben ({p['first']} bis {p['last']}), {p['unique']} verschiedene Titel",
              f"- Aktive Tage: {p['active_days']}, längste Serie: {p['best_streak_days']} Tage",
              f"- {p['liked_share_pct']} % der Wiedergaben sind Liked Songs; "
              f"{p['liked_never_played']} Liked Songs nie gespielt (im Verlaufszeitraum)", ""]
        L += ["### Meistgespielt", ""] + [f"{i}. {t} – {a}: {c}" for i, (t, a, c, _) in enumerate(p["top_songs"], 1)]
    path.write_text("\n".join(L) + "\n", encoding="utf-8")
