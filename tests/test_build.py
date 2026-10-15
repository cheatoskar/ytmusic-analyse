"""Prueft die Daten fuer die Seite anhand der Demo: Wiedergaben, Empfehlungen, Cover-Kuerzung.

Ausfuehren:  .venv\\Scripts\\python tests\\test_build.py
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("YTM_LANG", "en")
from ytmlib.build import _local_minutes, _thumb  # noqa: E402
from ytmlib.demo import DEMO_OUT, run  # noqa: E402

assert _thumb(None) is None
assert _thumb("https://yt3.googleusercontent.com/abc=w60-h60-l90-rj") == "~abc"
assert _thumb("https://i.ytimg.com/vi/x/sddefault.jpg") == "https://i.ytimg.com/vi/x/sddefault.jpg"
# Ortszeit ohne Zone: 1970-01-02 01:30 -> 1530 Minuten
assert _local_minutes(datetime(1970, 1, 2, 1, 30, tzinfo=timezone.utc)) == 1530

run()
text = (DEMO_OUT / "data.js").read_text(encoding="utf-8")
d = json.loads(text[len("window.DATA = "):].rstrip().rstrip(";"))
n_songs, n_artists = len(d["songs"]), len(d["artists"])
plays, extra = d["plays"]["p"], d["plays"]["x"]
assert len(plays) == d["stats"]["plays"]["total"], (len(plays), d["stats"]["plays"]["total"])
assert all(-len(extra) <= r < n_songs for r, _ in plays)
assert [m for _, m in plays] == sorted(m for _, m in plays), "Wiedergaben muessen zeitlich sortiert sein"
assert all(-1 <= ai < n_artists for _, _, ai in extra)
assert d["recs"], "Demo sollte Empfehlungen liefern"
for name, rid, score, genre, via in d["recs"]:
    assert len(via) >= 2 and all(0 <= i < n_artists for i in via) and score > 0
assert "Trance" in d["meta"]["electronic"] and "Pop" not in d["meta"]["electronic"]
for f in ("index.html", "core.js", "charts.js", "pages.js", "maps.js", "app.js", "i18n.js", "style.css"):
    assert (DEMO_OUT / f).exists(), f
print("Build OK")
