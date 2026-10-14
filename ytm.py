"""YT Music Liked Songs – Export & Auswertung.

    python ytm.py fetch               Liked Songs abrufen (braucht browser.json)
    python ytm.py enrich              Jahre, Kuenstler, Genres, Herkunft nachladen
    python ytm.py takeout <zip|ordner>  Google-Takeout einlesen (optional)
    python ytm.py build               Auswertung + interaktive Seite erzeugen
    python ytm.py open                Seite im Browser oeffnen
    python ytm.py demo                Alles mit erfundenen Daten testen
"""
from __future__ import annotations

import argparse
import os
import sys
import webbrowser

from ytmlib.common import OUT, ROOT


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="YT Music Liked Songs – Export & Auswertung")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch", help="Liked Songs abrufen")
    e = sub.add_parser("enrich", help="Metadaten nachladen")
    e.add_argument("--no-albums", action="store_true")
    e.add_argument("--no-artists", action="store_true")
    e.add_argument("--no-tags", action="store_true")
    t = sub.add_parser("takeout", help="Google-Takeout einlesen")
    t.add_argument("source", help="Pfad zur Takeout-ZIP oder zum entpackten Ordner")
    sub.add_parser("build", help="Auswertung erzeugen")
    sub.add_parser("open", help="Ergebnis im Browser oeffnen")
    sub.add_parser("demo", help="Test mit Beispieldaten")
    a = p.parse_args()

    if a.cmd == "fetch":
        from ytmlib.fetch import run
        run()
    elif a.cmd == "enrich":
        from ytmlib.enrich import run
        run(albums=not a.no_albums, artists=not a.no_artists, tags=not a.no_tags)
    elif a.cmd == "takeout":
        from ytmlib.takeout import run
        run(a.source)
    elif a.cmd == "build":
        from ytmlib.build import build
        build()
    elif a.cmd == "open":
        target = OUT / "index.html"
        if not target.exists():
            sys.exit("Noch nichts gebaut. Zuerst: python ytm.py build")
        webbrowser.open(target.as_uri())
    elif a.cmd == "demo":
        from ytmlib.demo import DEMO_OUT, run
        run()
        if not os.environ.get("YTM_NO_OPEN"):
            webbrowser.open((DEMO_OUT / "index.html").as_uri())


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    main()
