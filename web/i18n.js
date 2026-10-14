// Texte der Oberflaeche (Deutsch/Englisch). Datenwerte (Stile, Typen ...) kommen sprachneutral
// aus build.py und werden ueber `vals` uebersetzt; fehlt ein Eintrag, wird der Originalwert gezeigt.
(() => {
  const I18N = {
    de: {
      locale: 'de-DE',
      title: 'Deine Liked Songs',
      tab_overview: 'Übersicht', tab_network: 'Netzwerk-Map', tab_bubbles: 'Bubble-Map', tab_table: 'Alle Songs',
      theme_title: 'Hell/Dunkel umschalten', lang_switch: 'EN', lang_title: 'Switch to English',
      load_error: 'Daten oder D3 konnten nicht geladen werden. Internetverbindung prüfen (D3 kommt von cdnjs) und <code>python ytm.py build</code> ausführen.',
      meta: '{songs} Songs · {artists} Künstler · erstellt {date}',
      // Netzwerk-Panel
      search_artist: 'Künstler suchen', search_ph: 'Name …', color_by: 'Farbe nach',
      opt_genre: 'Stil', opt_world: 'Musik-Welt (Cluster)', opt_playlist: 'Deine Playlist',
      connections: 'Verbindungen', e_feat: 'Features (gemeinsame Songs)', e_rel: 'Verwandt laut YT Music', e_tag: 'Ähnliche Stil-Tags',
      min_songs: 'Mindestens <b id="netMinV">1</b> Song(s)', fit: 'Ansicht einpassen',
      net_hint: 'Mausrad: Zoom · Ziehen: verschieben · Klick: Details · Legende anklicken: hervorheben',
      // Bubble-Panel
      group_by: 'Gruppieren nach', g_genre: 'Stil → Künstler → Song', g_world: 'Musik-Welt → Künstler → Song',
      g_playlist: 'Playlist → Künstler → Song', bubble_size: 'Bubble-Größe', s_count: 'Gleich (1 Song = 1)',
      s_plays: 'Wiedergaben', s_dur: 'Songlänge', pack_hint: 'Klick auf eine Bubble: hineinzoomen · Klick auf den Hintergrund: zurück',
      // Tabelle
      table_ph: 'Titel, Künstler, Album, Stil, Playlist …',
      // KPIs
      k_songs: 'Liked Songs', k_declared: 'YT Music meldet {n}', k_dups: '{n} Duplikate entfernt', k_unavail: '{n} nicht verfügbar',
      k_total: 'Gesamtlänge', k_total_sets: 'davon {h} h in {n} DJ-Sets · Song-Ø {avg}', k_total_avg: 'Ø {avg} pro Song',
      k_artists: 'Künstler', k_single: '{p} nur mit einem Song', k_albums: 'Alben', k_top10: 'Anteil Top-10-Künstler',
      k_top10_s: 'an allen Songs', k_year: 'Median-Erscheinungsjahr', k_year_s: 'Jahr bekannt bei {p}', k_explicit: 'Explicit',
      k_collab: 'Kollaborationen', k_collab_s: 'Songs mit mehreren Künstlern', k_main: 'Mainstream-Index',
      k_main_s: 'Median-Abonnenten des Hauptkünstlers', k_genre: 'Stil zugeordnet', k_genre_s: 'Datenabdeckung',
      k_plays: 'Wiedergaben', k_plays_s: '{a} bis {b}', k_hours: 'Hörzeit (geschätzt)', k_hours_s: 'Wiedergaben × Ø-Länge',
      k_streak: 'Längste Hör-Serie', k_days: '{n} Tage', k_streak_s: '{n} aktive Tage', k_likedshare: 'Anteil Liked Songs',
      k_likedshare_s: 'an allen Wiedergaben',
      // Karten
      c_genres: 'Stile', c_genres_s: 'Songs nach Stil des Hauptkünstlers (Last.fm/MusicBrainz-Tags)',
      c_main: 'Mainstream oder Underground?', c_main_s: 'Songs nach YouTube-Abonnenten des Hauptkünstlers',
      c_evo: 'Wie sich dein Geschmack verändert hat', c_evo_order: 'Stil-Anteile nach Like-Reihenfolge (10 gleich große Abschnitte, alt → neu)',
      c_evo_year: 'Stil-Anteile je Jahr (Like-Datum)', c_evo_quarter: 'Stil-Anteile je Quartal (Like-Datum)',
      c_pl: 'Was in deinen Playlists steckt',
      c_pl_s: 'Stil-Mix der Liked Songs je eigener Playlist · rechts: Liked Songs / Einträge gesamt · {n} von {total} Likes stecken in mindestens einer Playlist',
      c_top: 'Top 30 Künstler', c_top_s: 'Anzahl Liked Songs als Hauptkünstler, Farbe = Stil',
      c_tags: 'Top-Tags', c_tags_s: 'Häufigste Tags (Last.fm/MusicBrainz), gezählt pro Song',
      c_years: 'Erscheinungsjahre', c_years_s: 'Songs pro Jahr · Jahrzehnte: {d}', decade: '{d}er',
      c_len: 'Songlängen', c_len_s: 'Verteilung in 30-Sekunden-Schritten · Median {m}', c_len_sets: ' · ohne {n} DJ-Sets über 20 min',
      c_country: 'Herkunft der Künstler', c_country_s: 'Songs nach Land des Hauptkünstlers (MusicBrainz)', unknown_lc: 'unbekannt',
      c_versions: 'Versionen im Titel', c_versions_s: 'Remix, Sped up, Live … (Treffer im Songtitel)',
      c_types: 'Art des Eintrags', c_types_s: 'Song = Audio-Track, Musikvideo, Upload = von Nutzern hochgeladen',
      c_pairs: 'Häufigste Kollaborationen', c_pairs_s: 'Künstlerpaare mit den meisten gemeinsamen Songs', c_pairs_none: 'Keine Songs mit mehreren Künstlern.',
      c_old: 'Älteste Songs', c_old_s: 'Nach Erscheinungsjahr des Albums',
      c_worlds: 'Deine Musik-Welten', c_worlds_s: 'Automatisch gefundene Cluster im Künstler-Netzwerk (Louvain), benannt nach den häufigsten Tags',
      world_line: '{songs} Songs · {artists} Künstler · überwiegend {genre}',
      sec_plays: 'Hörverhalten (aus Google Takeout)',
      c_months: 'Wiedergaben pro Monat', c_months_s: 'Aktivster Tag: {d} mit {n} Wiedergaben',
      c_heat: 'Wann du hörst', c_heat_s: 'Wiedergaben nach Wochentag und Uhrzeit (Ortszeit)',
      c_topplayed: 'Meistgespielt', c_topplayed_s: '★ = in deinen Liked Songs',
      c_notliked: 'Oft gespielt, aber nicht geliked', c_notliked_s: 'Kandidaten für deine Liste',
      c_topartists_p: 'Meistgehörte Künstler', c_topartists_p_s: 'Nach Wiedergaben (alle Songs, nicht nur Liked)',
      c_never: 'Nie gespielt', c_never_s: 'Liked Songs ohne Wiedergabe im Verlaufszeitraum',
      never_l: 'von {total} Liked Songs ({p})',
      never_note: 'Hinweis: YT Music spielt manchmal eine andere Version (Video statt Audio) mit eigener ID ab. Die Zahl ist daher eine Obergrenze.',
      c_noplays: 'Hörverhalten fehlt noch', c_noplays_s: 'Mit Google Takeout kommen Wiedergaben und Hörzeiten dazu (README, Schritt 7).',
      // Diagramm-Texte
      n_songs: '{n} Songs', n_plays: '{n} Wiedergaben', n_artists: '{n} Künstler', played_x: '{n}× gespielt',
      days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], hour_range: '{h}–{h2} Uhr', hour_tick: '{h} h',
      heat_low: 'wenig', heat_high: 'viel (max. {n})',
      // Netzwerk
      other_pl: 'Weitere / ohne Playlist', other_world: 'Weitere / Einzelgänger', subscribers: '{n} Abonnenten',
      world: 'Musik-Welt', none: 'keine', close: 'Schließen', feat_x: '{n}× Feature', related: 'verwandt', similar_tags: 'ähnliche Tags',
      // Bubbles
      all_liked: 'Alle Liked Songs', no_playlist: 'Ohne Playlist', more_worlds: 'Weitere Welten', more: 'Weitere',
      // Tabelle
      col_order_title: 'Like-Reihenfolge (0 = zuletzt geliked)', col_title: 'Titel', col_artist: 'Künstler', col_album: 'Album',
      col_year: 'Jahr', col_len: 'Länge', col_genre: 'Stil', col_plays: 'Plays', col_pls: 'Playlists', col_liked: 'Geliked am',
      rows_info: '{n} von {total} Songs', rows_cut: ' · erste 500 angezeigt',
      vals: {
        'Unknown': 'Unbekannt', 'Other styles': 'Weitere Stile', 'Electronic (other)': 'Elektronisch (sonstige)',
        'Jazz/Classical/Film': 'Jazz/Klassik/Film', 'Music video': 'Musikvideo', 'Acoustic': 'Akustik',
        '<10k': '< 10 Tsd.', '10k-100k': '10–100 Tsd.', '100k-1M': '100 Tsd.–1 Mio.', '1M-10M': '1–10 Mio.', '>10M': '> 10 Mio.',
      },
      mio: ' Mio.', tsd: ' Tsd.', pct_sep: ' %',
    },
    en: {
      locale: 'en-US',
      title: 'Your Liked Songs',
      tab_overview: 'Overview', tab_network: 'Network map', tab_bubbles: 'Bubble map', tab_table: 'All songs',
      theme_title: 'Toggle light/dark', lang_switch: 'DE', lang_title: 'Auf Deutsch umschalten',
      load_error: 'Data or D3 could not be loaded. Check your internet connection (D3 is loaded from cdnjs) and run <code>python ytm.py build</code>.',
      meta: '{songs} songs · {artists} artists · built {date}',
      search_artist: 'Find artist', search_ph: 'Name …', color_by: 'Color by',
      opt_genre: 'Style', opt_world: 'Music world (cluster)', opt_playlist: 'Your playlist',
      connections: 'Connections', e_feat: 'Features (shared songs)', e_rel: 'Related (YT Music)', e_tag: 'Similar style tags',
      min_songs: 'At least <b id="netMinV">1</b> song(s)', fit: 'Fit to view',
      net_hint: 'Wheel: zoom · Drag: pan · Click: details · Click legend: highlight',
      group_by: 'Group by', g_genre: 'Style → artist → song', g_world: 'Music world → artist → song',
      g_playlist: 'Playlist → artist → song', bubble_size: 'Bubble size', s_count: 'Equal (1 song = 1)',
      s_plays: 'Plays', s_dur: 'Song length', pack_hint: 'Click a bubble to zoom in · click the background to go back',
      table_ph: 'Title, artist, album, style, playlist …',
      k_songs: 'Liked songs', k_declared: 'YT Music reports {n}', k_dups: '{n} duplicates removed', k_unavail: '{n} unavailable',
      k_total: 'Total length', k_total_sets: '{h} h of it in {n} DJ sets · song avg {avg}', k_total_avg: 'avg {avg} per song',
      k_artists: 'Artists', k_single: '{p} with a single song', k_albums: 'Albums', k_top10: 'Top-10 artist share',
      k_top10_s: 'of all songs', k_year: 'Median release year', k_year_s: 'year known for {p}', k_explicit: 'Explicit',
      k_collab: 'Collaborations', k_collab_s: 'songs with several artists', k_main: 'Mainstream index',
      k_main_s: 'median subscribers of the main artist', k_genre: 'Style assigned', k_genre_s: 'data coverage',
      k_plays: 'Plays', k_plays_s: '{a} to {b}', k_hours: 'Listening time (est.)', k_hours_s: 'plays × avg length',
      k_streak: 'Longest streak', k_days: '{n} days', k_streak_s: '{n} active days', k_likedshare: 'Liked songs share',
      k_likedshare_s: 'of all plays',
      c_genres: 'Styles', c_genres_s: 'Songs by style of the main artist (Last.fm/MusicBrainz tags)',
      c_main: 'Mainstream or underground?', c_main_s: 'Songs by YouTube subscribers of the main artist',
      c_evo: 'How your taste changed', c_evo_order: 'Style shares by like order (10 equal slices, old → new)',
      c_evo_year: 'Style shares per year (like date)', c_evo_quarter: 'Style shares per quarter (like date)',
      c_pl: 'What is in your playlists',
      c_pl_s: 'Style mix of liked songs per playlist · right: liked songs / total entries · {n} of {total} likes are in at least one playlist',
      c_top: 'Top 30 artists', c_top_s: 'Liked songs as main artist, color = style',
      c_tags: 'Top tags', c_tags_s: 'Most frequent tags (Last.fm/MusicBrainz), counted per song',
      c_years: 'Release years', c_years_s: 'Songs per year · decades: {d}', decade: '{d}s',
      c_len: 'Song lengths', c_len_s: 'Distribution in 30-second steps · median {m}', c_len_sets: ' · excluding {n} DJ sets over 20 min',
      c_country: 'Artist origin', c_country_s: 'Songs by country of the main artist (MusicBrainz)', unknown_lc: 'unknown',
      c_versions: 'Versions in the title', c_versions_s: 'Remix, sped up, live … (matches in the song title)',
      c_types: 'Entry type', c_types_s: 'Song = audio track, music video, upload = user-uploaded',
      c_pairs: 'Top collaborations', c_pairs_s: 'Artist pairs with the most shared songs', c_pairs_none: 'No songs with several artists.',
      c_old: 'Oldest songs', c_old_s: 'By album release year',
      c_worlds: 'Your music worlds', c_worlds_s: 'Clusters found automatically in the artist network (Louvain), named after their top tags',
      world_line: '{songs} songs · {artists} artists · mostly {genre}',
      sec_plays: 'Listening behaviour (from Google Takeout)',
      c_months: 'Plays per month', c_months_s: 'Busiest day: {d} with {n} plays',
      c_heat: 'When you listen', c_heat_s: 'Plays by weekday and hour (local time)',
      c_topplayed: 'Most played', c_topplayed_s: '★ = in your liked songs',
      c_notliked: 'Played a lot, never liked', c_notliked_s: 'Candidates for your list',
      c_topartists_p: 'Most played artists', c_topartists_p_s: 'By plays (all songs, not just liked)',
      c_never: 'Never played', c_never_s: 'Liked songs without a play in the history period',
      never_l: 'of {total} liked songs ({p})',
      never_note: 'Note: YT Music sometimes plays a different version (video instead of audio) with its own ID, so this is an upper bound.',
      c_noplays: 'No listening data yet', c_noplays_s: 'Google Takeout adds plays and listening times (README, step 7).',
      n_songs: '{n} songs', n_plays: '{n} plays', n_artists: '{n} artists', played_x: 'played {n}×',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hour_range: '{h}:00–{h2}:00', hour_tick: '{h}h',
      heat_low: 'few', heat_high: 'many (max {n})',
      other_pl: 'Other / no playlist', other_world: 'Other / loners', subscribers: '{n} subscribers',
      world: 'Music world', none: 'none', close: 'Close', feat_x: '{n}× feature', related: 'related', similar_tags: 'similar tags',
      all_liked: 'All liked songs', no_playlist: 'No playlist', more_worlds: 'Other worlds', more: 'Other',
      col_order_title: 'Like order (0 = most recent)', col_title: 'Title', col_artist: 'Artist', col_album: 'Album',
      col_year: 'Year', col_len: 'Length', col_genre: 'Style', col_plays: 'Plays', col_pls: 'Playlists', col_liked: 'Liked on',
      rows_info: '{n} of {total} songs', rows_cut: ' · first 500 shown',
      vals: {
        '<10k': '< 10k', '10k-100k': '10k–100k', '100k-1M': '100k–1M', '1M-10M': '1M–10M', '>10M': '> 10M',
      },
      mio: 'M', tsd: 'k', pct_sep: '%',
    },
  };

  // Reihenfolge: ?lang=de|en in der URL, gespeicherte Wahl, Browsersprache
  let lang = new URLSearchParams(location.search).get('lang') || '';
  if (!I18N[lang]) { try { lang = localStorage.getItem('ytm-lang') || ''; } catch (e) { /* ohne Speicher */ } }
  if (!I18N[lang]) lang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  const dict = I18N[lang];

  window.LANG = lang;
  window.t = (key, vars = {}) => {
    const s = dict[key] ?? I18N.en[key] ?? key;
    return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
  };
  window.tv = v => (v == null ? v : dict.vals[v] ?? v);
  window.setLang = l => { try { localStorage.setItem('ytm-lang', l); } catch (e) { /* */ } location.reload(); };

  // Statische Texte in index.html
  document.documentElement.lang = lang;
  document.title = window.t('title');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = window.t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = window.t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = window.t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = window.t(el.dataset.i18nTitle); });
})();
