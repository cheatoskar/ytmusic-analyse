"""Tags (Last.fm/MusicBrainz) auf wenige Haupt-Genres abbilden."""
from __future__ import annotations

# Reihenfolge = feste Farbreihenfolge in der Oberflaeche. Nicht umsortieren.
MACROS: list[tuple[str, list[str]]] = [
    ("Hip-Hop/Rap", ["hip hop", "hip-hop", "hiphop", "rap", "trap", "drill", "grime", "boom bap", "phonk"]),
    ("Pop", ["pop", "schlager", "boy band", "girl group"]),
    ("Elektronisch", ["electronic", "electro", "edm", "house", "techno", "trance", "dubstep", "drum and bass",
                      "dnb", "drum & bass", "hardstyle", "dance", "garage", "synthwave", "ambient", "lo-fi",
                      "lofi", "idm", "downtempo", "breakbeat", "jungle"]),
    ("Rock/Metal", ["rock", "metal", "punk", "grunge", "hardcore", "emo", "screamo", "shoegaze"]),
    ("R&B/Soul", ["r&b", "rnb", "rhythm and blues", "soul", "funk", "motown", "gospel"]),
    ("Indie/Folk", ["indie", "alternative", "singer-songwriter", "folk", "acoustic", "americana", "country"]),
    ("Latin/Afro/Reggae", ["latin", "reggaeton", "reggae", "dancehall", "afrobeat", "afro", "amapiano", "salsa",
                           "bachata", "dembow", "brazil", "baile"]),
    ("Jazz/Klassik/Film", ["jazz", "classical", "klassik", "soundtrack", "score", "instrumental", "piano",
                           "orchestra", "blues", "video game"]),
]
MACRO_NAMES = [m for m, _ in MACROS]
UNKNOWN = "Unbekannt"

# Tags ohne Aussage ueber den Stil
TAG_BLOCKLIST = {
    "seen live", "favorites", "favourite", "favorite", "my favorite", "awesome", "love", "beautiful",
    "male vocalists", "female vocalists", "male vocalist", "female vocalist", "spotify", "all",
    "under 2000 listeners", "good", "best", "amazing", "cool", "musician", "artist", "band", "producer",
}


def clean_tags(tags: list[str]) -> list[str]:
    seen, out = set(), []
    for t in tags or []:
        t = t.strip().lower()
        if t and t not in TAG_BLOCKLIST and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def macro_genre(tags: list[str]) -> str:
    """Gewichtet nach Rang: der erste Tag zaehlt am meisten."""
    scores = dict.fromkeys(MACRO_NAMES, 0.0)
    for rank, tag in enumerate(tags[:8]):
        weight = 1 / (1 + rank)
        for name, keywords in MACROS:
            if any(k in tag for k in keywords):
                scores[name] += weight
    best = max(MACRO_NAMES, key=lambda n: scores[n])  # bei Gleichstand gewinnt die fruehere Kategorie
    return best if scores[best] > 0 else UNKNOWN
