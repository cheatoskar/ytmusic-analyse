"""YT Music liked songs – export & analysis.

    python ytm.py fetch                  fetch liked songs (needs browser.json)
    python ytm.py enrich                 add years, artists, styles, origin
    python ytm.py takeout <zip|folder>   import Google Takeout (optional)
    python ytm.py build                  build the analysis and interactive page
    python ytm.py open                   open the page in the browser
    python ytm.py demo                   try everything with made-up data

Language: YTM_LANG=de or YTM_LANG=en (default: system language).
"""
from __future__ import annotations

import argparse
import os
import sys
import webbrowser

from ytmlib.common import OUT, tr


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description=tr("YT Music Liked Songs – Export & Auswertung",
                                               "YT Music liked songs – export & analysis"))
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch", help=tr("Liked Songs abrufen", "fetch liked songs"))
    e = sub.add_parser("enrich", help=tr("Metadaten nachladen", "add metadata"))
    e.add_argument("--no-albums", action="store_true", help=tr("Alben überspringen", "skip albums"))
    e.add_argument("--no-artists", action="store_true", help=tr("Künstler überspringen", "skip artists"))
    e.add_argument("--no-tags", action="store_true", help=tr("Last.fm und MusicBrainz überspringen", "skip Last.fm and MusicBrainz"))
    e.add_argument("--no-lastfm", action="store_true", help=tr("Last.fm überspringen", "skip Last.fm"))
    e.add_argument("--no-mb", action="store_true", help=tr("MusicBrainz überspringen", "skip MusicBrainz"))
    t = sub.add_parser("takeout", help=tr("Google Takeout einlesen", "import Google Takeout"))
    t.add_argument("source", help=tr("Pfad zur Takeout-ZIP oder zum entpackten Ordner",
                                     "path to the Takeout ZIP or extracted folder"))
    sub.add_parser("build", help=tr("Auswertung erzeugen", "build the analysis"))
    sub.add_parser("open", help=tr("Ergebnis im Browser öffnen", "open the result in the browser"))
    sub.add_parser("demo", help=tr("Test mit Beispieldaten", "try with sample data"))
    a = p.parse_args()

    if a.cmd == "fetch":
        from ytmlib.fetch import run
        run()
    elif a.cmd == "enrich":
        from ytmlib.enrich import run
        run(albums=not a.no_albums, artists=not a.no_artists,
            lastfm=not (a.no_tags or a.no_lastfm), musicbrainz=not (a.no_tags or a.no_mb))
    elif a.cmd == "takeout":
        from ytmlib.takeout import run
        run(a.source)
    elif a.cmd == "build":
        from ytmlib.build import build
        build()
    elif a.cmd == "open":
        target = OUT / "index.html"
        if not target.exists():
            sys.exit(tr("Noch nichts gebaut. Zuerst: python ytm.py build", "Nothing built yet. Run: python ytm.py build"))
        webbrowser.open(target.as_uri())
    elif a.cmd == "demo":
        from ytmlib.demo import DEMO_OUT, run
        run()
        if not os.environ.get("YTM_NO_OPEN"):
            webbrowser.open((DEMO_OUT / "index.html").as_uri())


if __name__ == "__main__":
    main()
