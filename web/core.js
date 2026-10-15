// Kern: Daten vorbereiten, globaler Filter, Navigation per URL-Hash, Hilfsfunktionen.
// Alle Teile der Seite haengen an window.Y (klassische Skripte, damit out/index.html auch per file:// laeuft).
(() => {
  'use strict';
  const D = window.DATA;
  const Y = window.Y = { ok: !!(D && window.d3) };
  if (!Y.ok) return;

  const A = D.artists, SONGS = D.songs, COMMS = D.communities, PLS = D.meta.playlists || [];
  const GENRES = D.meta.genres, UNKNOWN = D.meta.unknown, OTHER = D.meta.other;
  const ELECTRONIC = new Set(D.meta.electronic || []);
  const DEMO = !!D.meta.demo;

  // ---------- Formatierung ----------
  const LOC = t('locale');
  const nf = new Intl.NumberFormat(LOC);
  const fmt = v => (v == null || Number.isNaN(v) ? '–' : nf.format(v));
  const num1 = v => v.toLocaleString(LOC, { maximumFractionDigits: 1 });
  const pct = (a, b) => (b ? num1(100 * a / b) + t('pct_sep') : '–');
  const pctv = v => (v == null ? '–' : num1(v) + t('pct_sep'));
  const pct0 = (a, b) => (b ? Math.round(100 * a / b) + t('pct_sep') : '–');
  const dur = s => (s == null ? '–' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
  const hours = s => fmt(Math.round(s / 3600)) + ' h';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const compact = v => (v == null ? '–' : v >= 1e6 ? num1(v / 1e6) + t('mio') : v >= 1e3 ? fmt(Math.round(v / 1e3)) + t('tsd') : fmt(v));
  const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
  const dateFmt = new Intl.DateTimeFormat(LOC, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const monthFmt = new Intl.DateTimeFormat(LOC, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dayDate = day => new Date(day * 86400000);
  const fmtDay = day => dateFmt.format(dayDate(day));
  const fmtMonth = mo => monthFmt.format(new Date(mo + '-01T00:00:00Z'));

  // ---------- Farben: Farbe haengt am Stil/an der Welt, nie am Rang ----------
  const GENRE_KEYS = GENRES.concat([OTHER, UNKNOWN]);
  const collapse = g => (GENRES.includes(g) || g === UNKNOWN ? g : OTHER);
  const genreVar = g => { const i = GENRES.indexOf(g); return i >= 0 ? `var(--s${i + 1})` : g === UNKNOWN ? 'var(--unknown)' : 'var(--other)'; };
  const plVar = p => (p >= 0 && p < 8 ? `var(--s${p + 1})` : 'var(--other)');
  const commVar = c => (c >= 0 && c < 8 ? `var(--s${c + 1})` : 'var(--other)');

  // ---------- Daten anreichern ----------
  A.forEach((a, i) => { a.i = i; a.songs = []; a.main = 0; a.nb = []; a.newest = Infinity; a.oldest = -1; });
  SONGS.forEach((s, i) => {
    s.i = i;
    s.m = s.a.length ? s.a[0] : -1;
    s.a.forEach(ai => {
      const a = A[ai];
      a.songs.push(i);
      a.newest = Math.min(a.newest, s.o);
      a.oldest = Math.max(a.oldest, s.o);
    });
    if (s.m >= 0) A[s.m].main++;
    s.cm = s.m >= 0 ? A[s.m].cm : -1;
    s.co = s.m >= 0 ? A[s.m].co : null;
    s.sub = s.m >= 0 ? A[s.m].s : null;
    s.an = s.a.map(ai => A[ai].n).join(', ');
  });
  const EDGES = D.edges.map(([s, tt, f, r, tg]) => ({ s, t: tt, f, r, tg }));
  EDGES.forEach(e => { A[e.s].nb.push(e); A[e.t].nb.push(e); });
  const other = (e, ai) => (e.s === ai ? e.t : e.s);

  // Wiedergaben: r >= 0 ist ein Liked Song, r < 0 verweist auf D.plays.x (Titel, Kuenstler, Kuenstler-Index)
  const PX = (D.plays && D.plays.x) || [];
  const PLAYS = ((D.plays && D.plays.p) || []).map(([r, m]) => {
    const d = new Date(m * 60000);
    return { r, m, day: Math.floor(m / 1440), wd: (d.getUTCDay() + 6) % 7, h: d.getUTCHours(), mo: d.toISOString().slice(0, 7) };
  });
  const HAS_PLAYS = PLAYS.length > 0;
  const playArtist = p => (p.r >= 0 ? SONGS[p.r].m : PX[-1 - p.r][2]);
  const playKey = p => (p.r >= 0 ? 's' + p.r : 'x' + (-1 - p.r));
  const avgDur = d3.median(SONGS.filter(s => s.d && s.d <= 1200), s => s.d) || 210;
  const playDur = p => (p.r >= 0 && SONGS[p.r].d && SONGS[p.r].d <= 1200 ? SONGS[p.r].d : avgDur);

  // Cover: '~' steht fuer den gekuerzten googleusercontent-Praefix (siehe build.py)
  const thumb = (s, size = 120) => (!s || !s.th ? null
    : s.th[0] === '~' ? `https://yt3.googleusercontent.com/${s.th.slice(1)}=w${size}-h${size}-l90-rj` : s.th);
  const artistCoverSong = ai => {
    const a = A[ai];
    return a.songs.map(i => SONGS[i]).find(s => s.th && s.m === ai) || a.songs.map(i => SONGS[i]).find(s => s.th) || null;
  };
  const ytSong = s => `https://music.youtube.com/watch?v=${encodeURIComponent(s.v)}`;
  const ytArtist = id => (id && !DEMO ? `https://music.youtube.com/channel/${encodeURIComponent(id)}` : null);

  // ---------- Globaler Filter ----------
  // g Stil · w Musik-Welt · pl Playlist · y0/y1 Erscheinungsjahre · a Kuenstler · co Land
  const F = { g: null, w: null, pl: null, y0: null, y1: null, a: null, co: null };
  const FKEYS = Object.keys(F);
  const NUMERIC = new Set(['w', 'pl', 'y0', 'y1', 'a']);
  const isFiltered = () => FKEYS.some(k => F[k] != null);
  function match(s) {
    if (F.g != null && (F.g === OTHER ? collapse(s.g) !== OTHER : s.g !== F.g)) return false;
    if (F.w != null && s.cm !== F.w) return false;
    if (F.pl != null && !s.pl.includes(F.pl)) return false;
    if (F.y0 != null && !(s.y >= F.y0)) return false;
    if (F.y1 != null && !(s.y <= F.y1)) return false;
    if (F.a != null && !s.a.includes(F.a)) return false;
    if (F.co != null && (s.co || '?') !== F.co) return false;
    return true;
  }
  const cur = { songs: SONGS, mask: null, plays: PLAYS, version: 0 };
  function recompute() {
    if (!isFiltered()) {
      cur.songs = SONGS; cur.mask = null; cur.plays = PLAYS;
    } else {
      const mask = new Uint8Array(SONGS.length);
      cur.songs = SONGS.filter(s => (match(s) ? (mask[s.i] = 1) : 0));
      cur.mask = mask;
      // Mit Filter zaehlen nur Wiedergaben von Liked Songs, die zum Filter passen
      cur.plays = PLAYS.filter(p => p.r >= 0 && mask[p.r]);
    }
    cur.version++;
  }

  // ---------- Ereignisse ----------
  const handlers = {};
  const on = (ev, fn) => (handlers[ev] = handlers[ev] || []).push(fn);
  const emit = (ev, ...a) => (handlers[ev] || []).forEach(fn => fn(...a));

  function setFilter(patch, { replace = false } = {}) {
    if (replace) FKEYS.forEach(k => { F[k] = null; });
    Object.entries(patch).forEach(([k, v]) => {
      if (!FKEYS.includes(k)) return;
      F[k] = v == null || v === '' ? null : NUMERIC.has(k) ? +v : String(v);
    });
    if (F.y0 != null && F.y1 != null && F.y0 > F.y1) [F.y0, F.y1] = [F.y1, F.y0];
    recompute();
    writeHash();
    emit('filter');
  }
  // Klick auf denselben Wert hebt den Filter wieder auf
  const toggleFilter = (k, v) => setFilter({ [k]: F[k] === (NUMERIC.has(k) ? +v : v) ? null : v });

  // ---------- Navigation ----------
  const VIEWS = ['home', 'taste', 'time', 'listen', 'discover', 'network', 'bubbles', 'artists', 'songs'];
  const LEGACY = { overview: 'home', table: 'songs' };
  const nav = { view: 'home', artist: null };
  function readHash() {
    const [v, q] = location.hash.slice(1).split('?');
    const p = new URLSearchParams(q || '');
    const patch = {};
    FKEYS.forEach(k => { patch[k] = p.get(k); });
    FKEYS.forEach(k => { F[k] = patch[k] == null || patch[k] === '' ? null : NUMERIC.has(k) ? +patch[k] : patch[k]; });
    recompute();
    const view = LEGACY[v] || (VIEWS.includes(v) ? v : null);
    const art = p.get('artist');
    return { view, artist: art != null && A[+art] ? +art : null };
  }
  // Seitenwechsel legen einen Verlaufseintrag an (Zurueck-Taste), Filter und Profil ersetzen ihn nur
  function writeHash(push = false) {
    const p = new URLSearchParams();
    FKEYS.forEach(k => { if (F[k] != null) p.set(k, F[k]); });
    if (nav.artist != null) p.set('artist', nav.artist);
    const q = p.toString();
    const h = '#' + nav.view + (q ? '?' + q : '');
    if (h === location.hash) return;
    nav.hash = h;
    history[push ? 'pushState' : 'replaceState'](null, '', h);
  }

  // ---------- Tooltip ----------
  const tip = document.getElementById('tip');
  function showTip(ev, html) {
    tip.innerHTML = html;
    tip.style.opacity = 1;
    const x = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8);
    const y = ev.clientY + 14 + tip.offsetHeight > innerHeight - 8 ? ev.clientY - tip.offsetHeight - 10 : ev.clientY + 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }
  const hideTip = () => { tip.style.opacity = 0; };

  // ---------- Kleine Auswertungs-Helfer ----------
  const countBy = (list, key) => {
    const m = new Map();
    for (const x of list) { const k = key(x); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); }
    return m;
  };
  const topN = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
  // Effektive Anzahl Stile = exp(Shannon-Entropie): "so viele gleich grosse Stile waeren genauso vielfaeltig"
  const effectiveN = counts => {
    const total = d3.sum(counts);
    if (!total) return 0;
    return Math.exp(-d3.sum(counts, c => (c ? (c / total) * Math.log(c / total) : 0)));
  };
  const shuffle = (arr, n) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return n ? a.slice(0, n) : a;
  };
  const songsOfArtistInCur = ai => (cur.mask ? A[ai].songs.filter(i => cur.mask[i]) : A[ai].songs);
  const refYear = +String(D.meta.generated).slice(0, 4) || new Date().getFullYear();

  Object.assign(Y, {
    D, A, SONGS, COMMS, PLS, GENRES, UNKNOWN, OTHER, ELECTRONIC, DEMO, EDGES, PLAYS, PX, HAS_PLAYS, GENRE_KEYS, LOC,
    fmt, num1, pct, pctv, pct0, dur, hours, esc, css, compact, debounce, fmtDay, fmtMonth, dayDate,
    collapse, genreVar, plVar, commVar, other, playArtist, playKey, playDur, avgDur, thumb, artistCoverSong, ytSong, ytArtist,
    F, FKEYS, isFiltered, match, cur, recompute, on, emit, setFilter, toggleFilter, nav, VIEWS, readHash, writeHash,
    showTip, hideTip, countBy, topN, effectiveN, shuffle, songsOfArtistInCur, refYear,
    views: {},
  });
})();
