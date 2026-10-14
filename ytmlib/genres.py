"""Tags (Last.fm/MusicBrainz) auf Stile abbilden.

Die Liste ist fein (v. a. elektronische Unterstile). Welche Stile eine eigene Farbe bekommen,
entscheidet build.py nach Haeufigkeit in der jeweiligen Sammlung (Top 8, Rest = 'Weitere Stile').
"""
from __future__ import annotations

# Pro Tag gewinnt das LAENGSTE passende Stichwort: "melodic techno" -> Melodic House & Techno, nicht Techno.
STYLES: list[tuple[str, list[str]]] = [
    ("Melodic House & Techno", ["melodic techno", "melodic house", "organic house", "indie dance", "afterlife",
                                "anjunadeep"]),
    ("Progressive House", ["progressive house", "progressive", "prog house"]),
    ("Trance", ["trance", "uplifting trance", "progressive trance", "vocal trance", "psytrance", "psychedelic trance",
                "goa"]),
    ("Deep House", ["deep house", "chill house", "lounge", "deep tech"]),
    ("Afro House", ["afro house", "afro tech", "amapiano", "afrobeat", "afrobeats", "afro"]),
    ("House", ["house", "tech house", "nu disco", "disco", "french house", "funky house", "garage house"]),
    ("Techno", ["techno", "minimal", "peak time", "dub techno", "acid"]),
    ("Hard Techno & Schranz", ["hard techno", "schranz", "hardstyle", "hardcore", "industrial techno", "rave",
                               "gabber", "hard dance", "hardtekk", "tekk"]),
    ("Drum & Bass / Bass", ["drum and bass", "drum & bass", "drum n bass", "dnb", "liquid funk", "dubstep",
                            "bass music", "jungle", "breakbeat", "breaks", "uk garage", "future garage", "riddim"]),
    ("Phonk", ["phonk", "drift phonk"]),
    ("EDM & Big Room", ["edm", "big room", "electro house", "future house", "future bass", "dance", "electro",
                        "tropical house", "melbourne bounce", "slap house"]),
    ("Chill & Downtempo", ["chillout", "chill out", "downtempo", "ambient", "lo-fi", "lofi", "chillwave", "chill",
                           "trip-hop", "trip hop", "idm", "electronica"]),
    ("Pop", ["pop", "dance pop", "electropop", "schlager", "boy band", "girl group"]),
    ("Hip-Hop/Rap", ["hip hop", "hip-hop", "hiphop", "rap", "trap", "drill", "grime", "boom bap"]),
    ("Rock/Indie", ["rock", "progressive rock", "progressive metal", "metal", "punk", "grunge", "emo", "indie", "alternative", "shoegaze"]),
    ("R&B/Soul", ["r&b", "rnb", "rhythm and blues", "soul", "funk", "motown", "gospel"]),
    ("Latin/Reggae", ["latin", "reggaeton", "reggae", "dancehall", "salsa", "bachata", "baile"]),
    ("Folk/Singer-Songwriter", ["folk", "singer-songwriter", "acoustic", "americana", "country"]),
    ("Jazz/Klassik/Film", ["jazz", "classical", "klassik", "soundtrack", "score", "instrumental", "piano",
                           "orchestra", "blues", "video game"]),
    ("Elektronisch (sonstige)", ["electronic", "elektronisch", "synthwave", "synthpop"]),
]
STYLE_NAMES = [m for m, _ in STYLES]
UNKNOWN = "Unbekannt"
OTHER = "Weitere Stile"

# Tags ohne Aussage ueber den Stil
TAG_BLOCKLIST = {
    "seen live", "favorites", "favourite", "favorite", "my favorite", "awesome", "love", "beautiful",
    "male vocalists", "female vocalists", "male vocalist", "female vocalist", "spotify", "all",
    "under 2000 listeners", "good", "best", "amazing", "cool", "musician", "artist", "band", "producer",
    "dj", "djs", "remix", "remixer", "german", "deutsch", "british", "american", "dutch", "swedish", "australian",
}

_KEYWORDS = sorted(((k, name) for name, ks in STYLES for k in ks), key=lambda x: -len(x[0]))


def clean_tags(tags: list[str]) -> list[str]:
    seen, out = set(), []
    for t in tags or []:
        t = t.strip().lower()
        if t and t not in TAG_BLOCKLIST and t not in seen and not t.isdigit():
            seen.add(t)
            out.append(t)
    return out


def style_of_tag(tag: str) -> str | None:
    for k, name in _KEYWORDS:
        if k in tag:
            return name
    return None


def macro_genre(tags: list[str]) -> str:
    """Gewichtet nach Rang: der erste Tag zaehlt am meisten. Generisches 'electronic' zaehlt nur halb."""
    scores: dict[str, float] = {}
    for rank, tag in enumerate(tags[:8]):
        name = style_of_tag(tag)
        if name:
            w = 1 / (1 + rank) * (0.5 if name == "Elektronisch (sonstige)" else 1)
            scores[name] = scores.get(name, 0) + w
    if not scores:
        return UNKNOWN
    # bei Gleichstand gewinnt der in STYLES zuerst genannte (spezifischere) Stil
    return max(scores, key=lambda n: (scores[n], -STYLE_NAMES.index(n)))
