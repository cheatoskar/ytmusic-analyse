"""Prueft den Takeout-Parser mit nachgebauten Eintraegen (deutsch/englisch, altes/neues CSV-Format).

Ausfuehren:  .venv\\Scripts\\python tests\\test_takeout.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ytmlib.takeout import _parse_history, _parse_playlist_csv  # noqa: E402

hist = [
    {"header": "YouTube Music", "title": "Mond feuer angesehen", "titleUrl": "https://music.youtube.com/watch?v=abcdefghijk",
     "subtitles": [{"name": "Xoxodo MC - Topic"}], "time": "2026-03-01T20:15:00.123Z"},
    {"header": "YouTube", "title": "Watched Some video", "titleUrl": "https://www.youtube.com/watch?v=zzzzzzzzzzz",
     "time": "2026-03-01T20:16:00Z"},
    {"header": "YouTube Music", "title": "Watched Echo", "titleUrl": "https://music.youtube.com/watch?v=ABCDEFGHIJK&list=LM",
     "time": "2026-03-02T08:00:00Z"},
]
p = _parse_history(hist)
assert len(p) == 2, p
assert p[0]["v"] == "abcdefghijk" and p[0]["title"] == "Mond feuer" and p[0]["artist"] == "Xoxodo MC", p[0]
assert p[1]["title"] == "Echo", p[1]

old = ("Playlist-ID,Kanal-ID,Erstellt\r\nLMxyz,UC123,2020-01-01T00:00:00+00:00\r\n\r\n"
       "Video-ID,Zeitstempel der Erstellung des Playlist-Videos\r\nabcdefghijk,2024-05-01T10:00:00+00:00\r\n").encode("utf-8-sig")
new = b"Video ID,Playlist Video Creation Timestamp\nABCDEFGHIJK,2025-01-02T03:04:05+00:00\n"
e_old, e_new = _parse_playlist_csv(old), _parse_playlist_csv(new)
assert ["abcdefghijk", "2024-05-01T10:00:00+00:00"] in e_old, e_old
assert e_new == [["ABCDEFGHIJK", "2025-01-02T03:04:05+00:00"]], e_new
print("Takeout-Parser OK")
