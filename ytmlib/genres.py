"""Tags (Last.fm/MusicBrainz) auf Stile abbilden.

Die Liste ist fein (v. a. elektronische Unterstile). Welche Stile eine eigene Farbe bekommen,
entscheidet build.py nach Haeufigkeit in der jeweiligen Sammlung (Top 8, Rest = 'Weitere Stile').
"""
from __future__ import annotations

# Pro Tag gewinnt das LAENGSTE passende Stichwort: "melodic techno" -> Melodic House & Techno, nicht Techno.
STYLES: list[tuple[str, list[str]]] = [
    # Deep und Melodic House lassen sich ueber Last.fm-Tags kaum sauber trennen: bewusst eine Gruppe
    ("Deep & Melodic House", ["deep house", "melodic house", "melodic techno", "organic house", "indie dance",
                              "afterlife", "anjunadeep", "chill house", "lounge", "deep tech"]),
    ("Progressive House", ["progressive house", "progressive", "prog house"]),
    ("Trance", ["trance", "uplifting trance", "progressive trance", "vocal trance", "psytrance", "psychedelic trance",
                "goa"]),
    ("Afro House", ["afro house", "afro tech", "amapiano", "afrobeat", "afrobeats", "afro"]),
    ("House", ["house", "tech house", "nu disco", "disco", "french house", "funky house", "garage house"]),
    ("Techno", ["techno", "minimal", "peak time", "dub techno", "acid"]),
    ("Hard Techno & Schranz", ["hard techno", "schranz", "hardstyle", "hardcore", "industrial techno", "rave",
                               "gabber", "hard dance", "hardtekk", "tekk", "hardtek", "raggatek",
                               "tekno", "frenchcore", "hard trance"]),
    ("Drum & Bass / Bass", ["drum and bass", "drum & bass", "drum n bass", "dnb", "liquid funk", "dubstep",
                            "bass music", "jungle", "breakbeat", "breaks", "uk garage", "future garage", "riddim"]),
    ("Phonk", ["phonk", "drift phonk"]),
    ("EDM & Big Room", ["edm", "big room", "electro house", "future house", "future bass", "dance", "electro",
                        "tropical house", "melbourne bounce", "slap house"]),
    ("Synthwave & Retro", ["synthwave", "retrowave", "chillwave", "outrun", "darksynth", "vaporwave", "synthpop",
                           "synth pop", "synth-pop", "new wave", "chillsynth"]),
    ("Chill & Downtempo", ["chillout", "chill out", "downtempo", "ambient", "lo-fi", "lofi", "chill",
                           "trip-hop", "trip hop", "idm", "electronica"]),
    ("Pop", ["pop", "dance pop", "electropop", "schlager", "boy band", "girl group"]),
    ("Hip-Hop/Rap", ["hip hop", "hip-hop", "hiphop", "rap", "trap", "drill", "grime", "boom bap"]),
    ("Rock/Indie", ["rock", "progressive rock", "progressive metal", "metal", "punk", "grunge", "emo", "indie", "alternative", "shoegaze"]),
    ("R&B/Soul", ["r&b", "rnb", "rhythm and blues", "soul", "funk", "motown", "gospel"]),
    ("Latin/Reggae", ["latin", "reggaeton", "reggae", "dancehall", "salsa", "bachata", "baile"]),
    ("Folk/Singer-Songwriter", ["folk", "singer-songwriter", "acoustic", "americana", "country"]),
    ("Jazz/Classical/Film", ["jazz", "classical", "klassik", "soundtrack", "score", "instrumental", "piano",
                           "orchestra", "blues", "video game"]),
    ("Electronic (other)", ["electronic", "elektronisch"]),
]
STYLE_NAMES = [m for m, _ in STYLES]
# Fuer die Kennzahl "elektronischer Anteil" auf der Startseite
ELECTRONIC = STYLE_NAMES[:STYLE_NAMES.index("Chill & Downtempo") + 1] + ["Electronic (other)"]
UNKNOWN = "Unknown"
OTHER = "Other styles"

# Tags ohne Aussage ueber den Stil
TAG_BLOCKLIST = {
    "seen live", "favorites", "favourite", "favorite", "my favorite", "awesome", "love", "beautiful",
    "male vocalists", "female vocalists", "male vocalist", "female vocalist", "spotify", "all",
    "under 2000 listeners", "good", "best", "amazing", "cool", "musician", "artist", "band", "producer",
    "dj", "djs", "remix", "remixer", "german", "deutsch", "british", "american", "dutch", "swedish", "australian",
    "uk", "usa", "us", "england", "english", "scotland", "scottish", "canada", "canadian", "france", "french",
    "germany", "netherlands", "sweden", "norway", "norwegian", "belgian", "italian", "spanish", "irish",
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


# Allgemeine Tags zaehlen nur, wenn kein genauerer Stil-Tag vorhanden ist
# (Lane 8: "house, electronic, deep house, melodic house" -> Deep & Melodic House, nicht House).
GENERIC_TAGS = {"house", "electronic", "electronica", "elektronisch", "dance", "electro", "edm", "club"}


def macro_genre(tags: list[str]) -> str:
    """Gewichtet nach Rang: der erste Tag zaehlt am meisten. Genaue Tags schlagen allgemeine."""
    specific: dict[str, float] = {}
    generic: dict[str, float] = {}
    for rank, tag in enumerate(tags[:8]):
        name = style_of_tag(tag)
        if name:
            target = generic if tag in GENERIC_TAGS else specific
            target[name] = target.get(name, 0) + 1 / (1 + rank)
    scores = specific or generic
    if not scores:
        return UNKNOWN
    # bei Gleichstand gewinnt der in STYLES zuerst genannte (spezifischere) Stil
    return max(scores, key=lambda n: (scores[n], -STYLE_NAMES.index(n)))
