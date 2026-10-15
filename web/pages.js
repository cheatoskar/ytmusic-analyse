// Seiten: Start, Geschmack, Zeitreise, Hören, Entdecken, Künstler, Songs. Jede Seite rechnet aus Y.cur
// (der gefilterten Auswahl) und baut sich bei jeder Filteraenderung neu auf.
(() => {
  'use strict';
  const Y = window.Y;
  if (!Y.ok) return;
  const { A, SONGS, COMMS, PLS, GENRES, UNKNOWN, OTHER, ELECTRONIC, PLAYS, PX, HAS_PLAYS, GENRE_KEYS, LOC, F, cur, charts: C } = Y;
  const { fmt, num1, pct, pctv, pct0, dur, hours, esc, compact, collapse, genreVar, plVar, commVar, countBy, topN, effectiveN,
    shuffle, thumb, ytSong, ytArtist, artistCoverSong, toggleFilter, setFilter, isFiltered, fmtDay, fmtMonth, playArtist, playKey, playDur } = Y;

  // ---------- Bausteine ----------
  const initials = name => (String(name).replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();
  function cover(s, label, g, cls = '') {
    const src = thumb(s);
    return `<span class="cv ${cls}" style="--c:${genreVar(g)}" aria-hidden="true"><b>${esc(initials(label))}</b>${src ? `<img src="${esc(src)}" loading="lazy" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
  }
  const artistLink = ai => (ai >= 0 ? `<a class="al" data-ai="${ai}" href="#">${esc(A[ai].n)}</a>` : '');
  const artistLinks = s => s.a.map(artistLink).join(', ');
  const songTitle = s => `<a class="st" href="${ytSong(s)}" target="_blank" rel="noopener" title="${esc(t('open_ytm'))}">${esc(s.t)}</a>${s.e ? ' <span class="ex" title="Explicit">E</span>' : ''}`;
  function songItem(s, right = '', sub = null) {
    return `<li class="item">${cover(s, s.an, s.g)}<div class="it-main"><div class="it-t">${songTitle(s)}</div><div class="it-s">${sub ?? artistLinks(s)}</div></div>${right ? `<div class="it-r">${right}</div>` : ''}</li>`;
  }
  // Wiedergabe-Schluessel ('s12' Liked Song, 'x3' anderer Titel) als Listeneintrag
  function playItem(key, right = '', sub = null) {
    if (key[0] === 's') return songItem(SONGS[+key.slice(1)], right, sub);
    const [title, artist, ai] = PX[+key.slice(1)];
    return `<li class="item">${cover(null, artist || title, UNKNOWN)}<div class="it-main"><div class="it-t">${esc(title)}</div><div class="it-s">${ai >= 0 ? artistLink(ai) : esc(artist)}${sub ? ' · ' + sub : ''}</div></div>${right ? `<div class="it-r">${right}</div>` : ''}</li>`;
  }
  function artistItem(ai, right = '', sub = null) {
    const a = A[ai];
    return `<li class="item">${cover(artistCoverSong(ai), a.n, a.g, 'round')}<div class="it-main"><div class="it-t">${artistLink(ai)}</div><div class="it-s">${sub ?? esc(tv(a.g))}</div></div>${right ? `<div class="it-r">${right}</div>` : ''}</li>`;
  }
  const list = (el, items, cls = '') => { el.insertAdjacentHTML('beforeend', `<ul class="items ${cls}">${items.join('')}</ul>`); };
  const bar = (v, max) => `<span class="minibar"><i style="width:${Math.max(3, (100 * v) / (max || 1))}%"></i></span>`;
  const chip = (label, attrs, on = false) => `<button class="chip${on ? ' on' : ''}" ${attrs}>${esc(label)}</button>`;

  function header(root, key, extra = '') {
    const n = cur.songs.length;
    root.insertAdjacentHTML('beforeend', `<div class="pagehead"><div><h2>${esc(t('h_' + key))}</h2><p>${esc(t('h_' + key + '_s'))}</p></div>${extra}</div>`);
    if (isFiltered()) root.insertAdjacentHTML('beforeend', `<div class="filternote">${t('filter_note', { n: fmt(n), total: fmt(SONGS.length), p: pct(n, SONGS.length) })}</div>`);
  }
  const grid = (root, cls = '') => d3.select(root).append('div').attr('class', 'grid ' + cls).node();
  function card(g, title, sub, { wide = false, cls = '', info = null } = {}) {
    const c = d3.select(g).append('div').attr('class', 'card' + (wide ? ' wide' : '') + (cls ? ' ' + cls : ''));
    const h = c.append('div').attr('class', 'card-h');
    h.append('h3').text(title);
    if (info) h.append('span').attr('class', 'info').attr('title', info).text('i');
    if (sub) c.append('p').attr('class', 'sub').text(sub);
    return c.append('div').attr('class', 'card-b').node();
  }
  function kpis(root, items) {
    root.insertAdjacentHTML('beforeend', '<div class="kpis">' + items.filter(Boolean).map(([v, l, s, go]) =>
      `<div class="kpi${go ? ' link' : ''}"${go ? ` data-go="${go}" tabindex="0" role="link"` : ''}><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}</div>`).join('') + '</div>');
  }
  const empty = (el, title, text) => el.insertAdjacentHTML('beforeend', `<div class="empty"><b>${esc(title)}</b><p>${esc(text)}</p></div>`);
  function noSongs(root) {
    empty(root, t('empty_filter'), t('empty_filter_s'));
    root.lastElementChild.insertAdjacentHTML('beforeend', `<button class="btn" data-reset>${esc(t('reset'))}</button>`);
  }

  // ---------- gemeinsame Auswertungen ----------
  const SUB_BUCKETS = [[0, '<10k'], [1e4, '10k-100k'], [1e5, '100k-1M'], [1e6, '1M-10M'], [1e7, '>10M']];
  const VERSION_TAGS = [['Remix', /\bremix\b|\brmx\b/i], ['Sped up', /sped[\s-]?up|nightcore/i], ['Slowed', /slowed|reverb/i],
    ['Live', /\blive\b/i], ['Acoustic', /acoustic|akustik|unplugged/i], ['Remaster', /remaster/i], ['Instrumental', /instrumental/i],
    ['Cover', /\bcover\b/i], ['feat.', /\bfeat\.?|\bft\.|featuring|\bwith\b/i]];
  const DAYPARTS = [['dp_morning', 5, 11], ['dp_day', 11, 17], ['dp_evening', 17, 22], ['dp_night', 22, 29]];
  const daypart = h => DAYPARTS.findIndex(([, a, b]) => (h >= a && h < b) || (h + 24 >= a && h + 24 < b));
  const styleRows = L => {
    const c = countBy(L, s => s.g);
    return [...c].filter(([g]) => g !== UNKNOWN).sort((a, b) => b[1] - a[1]).concat(c.get(UNKNOWN) ? [[UNKNOWN, c.get(UNKNOWN)]] : []);
  };
  const mainArtistCounts = L => countBy(L, s => (s.m >= 0 ? s.m : null));
  const datedShare = L => L.filter(s => s.l).length / (L.length || 1);

  function playAgg(P) {
    const per = new Map();
    for (const p of P) {
      const k = playKey(p);
      let r = per.get(k);
      if (!r) per.set(k, r = { k, n: 0, first: p.m, last: p.m, times: [] });
      r.n++; r.last = p.m; r.times.push(p.m);
    }
    return per;
  }
  function sessions(P) {
    const out = [];
    let s = null;
    for (const p of P) {
      if (!s || p.m - s.end > 30) { s = { start: p.m, end: p.m, n: 0, dur: 0 }; out.push(s); }
      s.end = p.m; s.n++; s.dur += playDur(p);
    }
    return out.map(x => ({ ...x, len: Math.max(x.end - x.start + 3, x.dur / 60) }));
  }
  function streak(daysSorted) {
    let best = 0, run = 0, prev = null;
    for (const d of daysSorted) { run = prev != null && d - prev === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
    return best;
  }
  const subsKnown = L => L.filter(s => s.sub != null);

  // ================= Start =================
  function home(root) {
    const L = cur.songs, n = L.length;
    if (!n) return noSongs(root);
    const P = cur.plays;
    const artistsIn = new Set(L.flatMap(s => s.a));
    const total = d3.sum(L, s => s.d || 0);
    const styles = styleRows(L).filter(([g]) => g !== UNKNOWN);
    const known = d3.sum(styles, d => d[1]);
    const elec = L.filter(s => ELECTRONIC.has(s.g)).length;
    const top3 = styles.slice(0, 3).map(([g]) => `<a href="#" data-f="g" data-v="${esc(g)}"><b>${esc(tv(g))}</b></a>`);
    const styleText = top3.length > 1 ? top3.slice(0, -1).join(', ') + ' ' + t('and') + ' ' + top3[top3.length - 1] : top3.join('');
    const topArtists = topN(mainArtistCounts(L), 12);

    // Hero
    root.insertAdjacentHTML('beforeend', `<section class="hero">
      <div class="hero-txt">
        <div class="eyebrow">${esc(isFiltered() ? t('hero_eyebrow_f') : t('hero_eyebrow'))}</div>
        <h1>${t('hero_title', { songs: `<em>${fmt(n)}</em>`, artists: `<em>${fmt(artistsIn.size)}</em>`, hours: `<em>${fmt(Math.round(total / 3600))}</em>` })}</h1>
        <p>${styles.length ? t('hero_line', { styles: styleText, p: pct0(elec, known || n) }) : ''}</p>
      </div>
      <div class="mosaic">${topArtists.map(([ai]) => `<a href="#" data-ai="${ai}" title="${esc(A[ai].n)}">${cover(artistCoverSong(ai), A[ai].n, A[ai].g)}</a>`).join('')}</div>
    </section>`);

    // Musik-DNA
    const dnaEl = d3.select(root).append('div').attr('class', 'dnawrap').node();
    const cc = countBy(L.filter(s => s.g !== UNKNOWN), s => collapse(s.g));
    const items = GENRE_KEYS.filter(g => cc.get(g)).map(g => ({ key: g, label: tv(g), value: cc.get(g), color: genreVar(g) }));
    dnaEl.insertAdjacentHTML('beforeend', `<div class="dnahead"><b>${esc(t('dna'))}</b><span>${esc(t('dna_s'))}</span></div>`);
    C.dna(dnaEl, items, { onClick: d => toggleFilter('g', d.key) });

    // Kennzahlen
    const subs = subsKnown(L);
    const under = subs.filter(s => s.sub < 1e5).length;
    const eff = effectiveN(styles.map(d => d[1]));
    const years = L.filter(s => s.y).map(s => s.y);
    kpis(root, [
      [fmt(n), t('k_songs'), isFiltered() ? t('k_of', { n: fmt(SONGS.length) }) : t('k_songs_s', { n: fmt(new Set(L.map(s => s.al).filter(Boolean)).size) }), 'songs'],
      [fmt(artistsIn.size), t('k_artists'), t('k_single', { p: pct0([...artistsIn].filter(ai => A[ai].c === 1).length, artistsIn.size) }), 'artists'],
      [hours(total), t('k_total'), t('k_total_avg', { avg: dur(Math.round(d3.median(L.filter(s => s.d && s.d <= 1200), s => s.d) || 0)) })],
      [years.length ? String(Math.round(d3.median(years))) : '–', t('k_year'), t('k_year_s', { p: pct0(years.length, n) }), 'time'],
      [num1(eff), t('k_diversity'), t('k_diversity_s', { n: fmt(styles.length) }), 'taste'],
      [pct0(under, subs.length), t('k_under'), t('k_under_s'), 'taste'],
      HAS_PLAYS ? [fmt(P.length), t('k_plays'), P.length ? t('k_plays_s', { a: fmtDay(P[0].day), b: fmtDay(P[P.length - 1].day) }) : '', 'listen'] : null,
      HAS_PLAYS ? [`~${hours(d3.sum(P, playDur))}`, t('k_hours'), t('k_hours_s'), 'listen'] : null,
    ]);

    // Erkenntnisse
    d3.select(root).append('h3').attr('class', 'sec').text(t('sec_insights'));
    const ins = [];
    if (known) {
      ins.push({ k: t('i_elec_k'), v: pct0(elec, known), x: t(elec / known > 0.5 ? 'i_elec_hi' : 'i_elec_lo', { s: tv(styles[0][0]), p: pct0(styles[0][1], n) }), go: 'taste' });
      ins.push({ k: t('i_div_k'), v: num1(eff), x: t(eff >= 8 ? 'i_div_hi' : eff >= 4 ? 'i_div_mid' : 'i_div_lo', { n: fmt(styles.length) }), go: 'taste' });
    }
    const single = [...artistsIn].filter(ai => songsOfArtist(ai) === 1).length;
    const top10 = d3.sum(topArtists.slice(0, 10), d => d[1]);
    ins.push({ k: t('i_loyal_k'), v: pct0(single, artistsIn.size), x: t(single / artistsIn.size > 0.6 ? 'i_loyal_explorer' : 'i_loyal_fan', { p: pct0(top10, n) }), go: 'artists' });
    if (subs.length > 20) {
      ins.push({ k: t('i_under_k'), v: pct0(under, subs.length), x: t(under / subs.length > 0.5 ? 'i_under_hi' : 'i_under_lo', { m: compact(d3.median(subs, s => s.sub)) }), go: 'taste' });
    }
    if (years.length > 20) {
      const fresh = years.filter(y => Y.refYear - y <= 2).length;
      const peak = topN(countBy(years, y => y), 1)[0];
      ins.push({ k: t('i_fresh_k'), v: pct0(fresh, years.length), x: t('i_fresh', { y: peak[0], n: fmt(peak[1]) }), go: 'time' });
    }
    if (HAS_PLAYS && P.length > 30) {
      const parts = DAYPARTS.map(() => 0);
      P.forEach(p => { parts[daypart(p.h)]++; });
      const best = parts.indexOf(Math.max(...parts));
      const we = P.filter(p => p.wd >= 5).length;
      ins.push({ k: t('i_time_k'), v: t(DAYPARTS[best][0]), x: t('i_time', { p: pct0(parts[best], P.length), w: pct0(we, P.length) }), go: 'listen' });
      const per = [...playAgg(P).values()].sort((a, b) => b.n - a.n)[0];
      if (per) {
        const label = per.k[0] === 's' ? SONGS[+per.k.slice(1)].t : PX[+per.k.slice(1)][0];
        ins.push({ k: t('i_top_k'), v: `${fmt(per.n)}×`, x: t('i_top', { s: label }), go: 'listen' });
      }
      const never = L.filter(s => !s.p).length;
      ins.push({ k: t('i_never_k'), v: pct0(never, n), x: t('i_never', { n: fmt(never) }), go: 'discover' });
    }
    const rec = recsFor()[0];
    if (rec) ins.push({ k: t('i_rec_k'), v: rec[0], x: t('i_rec', { n: fmt(rec[4].length), a: rec[4].slice(0, 2).map(i => A[i].n).join(', ') }), go: 'discover', small: true });
    const pairs = topPairs(L, 1)[0];
    if (pairs) ins.push({ k: t('i_pair_k'), v: `${fmt(pairs[2])}×`, x: t('i_pair', { a: A[pairs[0]].n, b: A[pairs[1]].n }), ai: pairs[0] });
    const ig = grid(root, 'insights');
    ig.innerHTML = ins.map(i => `<a class="insight" href="#" ${i.ai != null ? `data-ai="${i.ai}"` : `data-go="${i.go}"`}>
      <span class="ik">${esc(i.k)}</span><span class="iv${i.small ? ' small' : ''}">${esc(i.v)}</span><span class="ix">${esc(i.x)}</span><span class="more">${esc(t('more_link'))} →</span></a>`).join('');

    // Untere Reihe
    const g = grid(root, 'three');
    list(card(g, t('c_top_short'), t('c_top_short_s')), topArtists.slice(0, 8).map(([ai, c]) => artistItem(ai, `${fmt(c)}`)));
    const wc = card(g, t('c_worlds'), t('c_worlds_home_s'));
    const worldCounts = countBy(L, s => (s.cm >= 0 ? s.cm : null));
    const worlds = topN(worldCounts, 6).filter(([w]) => COMMS[w]);
    wc.insertAdjacentHTML('beforeend', '<ul class="items">' + worlds.map(([w, c]) =>
      `<li class="item"><span class="sw" style="background:${commVar(w)}"></span><div class="it-main"><div class="it-t"><a href="#" data-f="w" data-v="${w}">${esc(COMMS[w].name)}</a></div><div class="it-s">${esc(COMMS[w].top.slice(0, 3).join(', '))}</div></div><div class="it-r">${pct0(c, n)}</div></li>`).join('') + '</ul>');
    if (HAS_PLAYS && P.length) {
      const lc = card(g, t('c_recent'), t('c_recent_s'));
      const byWeek = d3.rollup(P, v => v.length, p => Math.floor(p.day / 7));
      const wk = d3.range(d3.min(byWeek.keys()), d3.max(byWeek.keys()) + 1).map(w => byWeek.get(w) || 0);
      C.spark(lc, wk, { height: 48 });
      const top = [...playAgg(P).values()].sort((a, b) => b.n - a.n).slice(0, 5);
      list(lc, top.map(r => playItem(r.k, `${fmt(r.n)}×`)), 'compact');
    } else {
      list(card(g, t('c_newest'), t('c_newest_s')), L.slice().sort((a, b) => a.o - b.o).slice(0, 7).map(s => songItem(s)));
    }
  }

  const songsOfArtist = ai => Y.songsOfArtistInCur(ai).length;
  function topPairs(L, n) {
    const c = new Map();
    for (const s of L) {
      const ks = [...new Set(s.a)].sort((a, b) => a - b);
      for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
        const k = ks[i] + ',' + ks[j];
        c.set(k, (c.get(k) || 0) + 1);
      }
    }
    return topN(c, n).map(([k, v]) => [...k.split(',').map(Number), v]);
  }
  function recsFor() {
    const R = Y.D.recs || [];
    return R.filter(r => (F.g == null || (F.g === OTHER ? collapse(r[3]) === OTHER : r[3] === F.g))
      && (F.a == null || r[4].includes(F.a))
      && (F.w == null || r[4].some(i => A[i].cm === F.w))
      && (F.co == null || r[4].some(i => (A[i].co || '?') === F.co)));
  }

  // ================= Geschmack =================
  function taste(root) {
    const L = cur.songs, n = L.length;
    if (!n) return noSongs(root);
    const g = grid(root);
    C.hbar(card(g, t('c_genres'), t('c_genres_s')), styleRows(L).map(([k, v]) => ({ label: tv(k), key: k, value: v })),
      { color: d => genreVar(d.key), total: n, labelW: 170, sel: F.g, onClick: d => toggleFilter('g', d.key) });
    const subs = subsKnown(L);
    if (subs.length) {
      const b = countBy(subs, s => SUB_BUCKETS.filter(([lim]) => s.sub >= lim).pop()[1]);
      C.hbar(card(g, t('c_main'), t('c_main_s', { m: compact(d3.median(subs, s => s.sub)) })),
        SUB_BUCKETS.map(([, l], i) => ({ label: tv(l), value: b.get(l) || 0, i })),
        { total: subs.length, labelW: 120, color: d => `var(--seq-${d.i + 3})` });
    }
    const top = topN(mainArtistCounts(L), 25);
    C.hbar(card(g, t('c_top'), t('c_top_s')), top.map(([ai, v]) => ({ label: A[ai].n, key: ai, value: v, g: A[ai].g })),
      { color: d => genreVar(d.g), labelW: 150, onClick: d => Y.openArtist(d.key),
        tipFn: d => `<b>${t('n_songs', { n: fmt(d.value) })}</b>${esc(d.label)} · ${esc(tv(d.g))}` });

    const tags = countBy(L.flatMap(s => (s.m >= 0 ? A[s.m].t : [])), x => x);
    C.hbar(card(g, t('c_tags'), t('c_tags_s')), topN(tags, 20).map(([k, v]) => ({ label: k, value: v })), { labelW: 150 });
    // Musik-Welten
    const wc = card(g, t('c_worlds'), t('c_worlds_s'), { wide: true });
    const worldCounts = countBy(L, s => (s.cm >= 0 ? s.cm : null));
    const maxW = d3.max(worldCounts.values()) || 1;
    wc.innerHTML = '<div class="worlds">' + COMMS.filter(c => c.artists > 1 && worldCounts.get(c.id)).sort((a, b) => worldCounts.get(b.id) - worldCounts.get(a.id)).slice(0, 12).map(c => {
      const v = worldCounts.get(c.id);
      const tops = A.filter(a => a.cm === c.id).sort((a, b) => b.c - a.c).slice(0, 5);
      return `<div class="world${F.w === c.id ? ' on' : ''}" style="--c:${commVar(c.id)}">
        <a href="#" class="wn" data-f="w" data-v="${c.id}">${esc(c.name)}</a>
        <small>${esc(t('world_line', { songs: fmt(v), artists: fmt(c.artists), genre: tv(c.genre) }))}</small>
        ${bar(v, maxW)}
        <div class="wa">${tops.map(a => artistLink(a.i)).join(', ')}</div></div>`;
    }).join('') + '</div>';

    // Playlists
    const plRows = PLS.map((name, i) => ({ i, name, songs: L.filter(s => s.pl.includes(i)) })).filter(r => r.songs.length);
    if (plRows.length) {
      const st = (Y.D.stats.playlists || []);
      const keys = GENRE_KEYS.filter(k => plRows.some(r => r.songs.some(s => collapse(s.g) === k)));
      C.hstack100(card(g, t('c_pl'), t('c_pl_s', { n: fmt(L.filter(s => s.pl.length).length), total: fmt(n) }), { wide: true }),
        plRows.map(r => ({ label: r.name, key: r.i, sub: `${fmt(r.songs.length)} / ${fmt((st[r.i] || {}).total || r.songs.length)}`, counts: Object.fromEntries(countBy(r.songs, s => collapse(s.g))) })),
        keys, genreVar, { onRow: r => toggleFilter('pl', r.key), onKey: (r, k) => setFilter({ pl: r.key, g: k }) });
    }

    const co = countBy(L, s => s.co || '?');
    C.hbar(card(g, t('c_country'), t('c_country_s')), topN(co, 15).map(([k, v]) => ({ label: k === '?' ? t('unknown_lc') : countryName(k), key: k, value: v })),
      { total: n, labelW: 130, sel: F.co, onClick: d => toggleFilter('co', d.key) });
    const ver = new Map(VERSION_TAGS.map(([k]) => [k, 0]));
    L.forEach(s => VERSION_TAGS.forEach(([k, rx]) => { if (rx.test(s.t || '')) ver.set(k, ver.get(k) + 1); }));
    C.hbar(card(g, t('c_versions'), t('c_versions_s')), [...ver].filter(d => d[1]).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: tv(k), value: v })), { total: n, labelW: 100 });

    // Kollaborationen
    const pc = card(g, t('c_pairs'), t('c_pairs_s'));
    const pairs = topPairs(L, 12);
    pairs.length ? list(pc, pairs.map(([a, b, c]) => `<li class="item"><div class="it-main"><div class="it-t">${artistLink(a)} × ${artistLink(b)}</div></div><div class="it-r">${fmt(c)}</div></li>`))
      : empty(pc, t('c_pairs_none'), '');
    const kc = card(g, t('c_hubs'), t('c_hubs_s'));
    const partners = new Map();
    L.forEach(s => s.a.forEach(x => s.a.forEach(y => { if (x !== y) (partners.get(x) || partners.set(x, new Set()).get(x)).add(y); })));
    const hubs = [...partners].sort((a, b) => b[1].size - a[1].size).slice(0, 10);
    hubs.length ? list(kc, hubs.map(([ai, set]) => artistItem(ai, t('n_partners', { n: fmt(set.size) }), [...set].slice(0, 3).map(artistLink).join(', '))))
      : empty(kc, t('c_pairs_none'), '');
    const ty = countBy(L, s => s.ty);
    C.hbar(card(g, t('c_types'), t('c_types_s')), topN(ty, 6).map(([k, v]) => ({ label: tv(k), value: v })), { total: n, labelW: 100 });
    const ex = L.filter(s => s.e).length;
    const ec = card(g, t('c_explicit'), t('c_explicit_s'));
    ec.insertAdjacentHTML('beforeend', `<div class="bignum">${pct(ex, n)}</div><p class="sub">${esc(t('n_songs', { n: fmt(ex) }))}</p>`);
  }
  const regionNames = (() => { try { return new Intl.DisplayNames([LOC], { type: 'region' }); } catch (e) { return null; } })();
  const countryName = c => { try { return (regionNames && regionNames.of(c)) || c; } catch (e) { return c; } };

  // ================= Zeitreise =================
  function evolution(L) {
    if (datedShare(L) > 0.5) {
      const dated = L.filter(s => s.l);
      const quarters = new Set(dated.map(s => s.l.slice(0, 4) + Math.floor((+s.l.slice(5, 7) - 1) / 3)));
      const byYear = quarters.size > 16;
      const key = s => (byYear ? s.l.slice(0, 4) : `${s.l.slice(0, 4)} Q${Math.floor((+s.l.slice(5, 7) - 1) / 3) + 1}`);
      const groups = d3.group(dated, key);
      const minN = Math.max(5, Math.round(0.01 * dated.length));
      return { mode: byYear ? 'liked_year' : 'liked_quarter', buckets: [...groups].sort((a, b) => d3.ascending(a[0], b[0])).filter(([, v]) => v.length >= minN).map(([label, v]) => ({ label, songs: v })) };
    }
    if (L.length < 20) return { mode: null, buckets: [] };
    const ordered = L.slice().sort((a, b) => b.o - a.o);
    const size = ordered.length / 10;
    return { mode: 'order', buckets: d3.range(10).map(i => ({ label: `${i * 10}–${(i + 1) * 10}%`, songs: ordered.slice(Math.round(i * size), Math.round((i + 1) * size)) })) };
  }

  function time(root) {
    const L = cur.songs, n = L.length;
    if (!n) return noSongs(root);
    const g = grid(root);
    const ys = L.filter(s => s.y);
    if (ys.length) {
      const yc = countBy(ys, s => s.y);
      const all = d3.range(d3.min(ys, s => s.y), d3.max(ys, s => s.y) + 1);
      const el = card(g, t('c_years'), t('c_years_s'), { wide: true });
      const decades = topN(countBy(ys, s => Math.floor(s.y / 10) * 10), 20).sort((a, b) => a[0] - b[0]);
      el.insertAdjacentHTML('beforeend', '<div class="chips">' + decades.map(([d, v]) =>
        chip(`${t('decade', { d })} · ${fmt(v)}`, `data-f2="y0:${d},y1:${d + 9}"`, F.y0 === d && F.y1 === d + 9)).join('') + '</div>');
      C.columns(el, all.map(y => ({ label: String(y), key: y, value: yc.get(y) || 0 })), {
        every: Math.ceil(all.length / 16), sel: F.y0 != null && F.y0 === F.y1 ? F.y0 : null,
        tipFn: d => `<b>${t('n_songs', { n: fmt(d.value) })}</b>${d.label}`,
        onClick: d => setFilter(F.y0 === d.key && F.y1 === d.key ? { y0: null, y1: null } : { y0: d.key, y1: d.key }),
      });
    }

    const evo = evolution(L);
    if (evo.buckets.length) {
      const keys = GENRE_KEYS.filter(k => evo.buckets.some(b => b.songs.some(s => collapse(s.g) === k)));
      C.stacked100(card(g, t('c_evo'), t({ order: 'c_evo_order', liked_year: 'c_evo_year', liked_quarter: 'c_evo_quarter' }[evo.mode]), { wide: true }),
        evo.buckets.map(b => ({ label: b.label, counts: Object.fromEntries(countBy(b.songs, s => collapse(s.g))) })), keys, genreVar,
        { onClick: k => toggleFilter('g', k) });
    }

    // Stil x Jahrzehnt
    if (ys.length > 30) {
      const decs = topN(countBy(ys, s => Math.floor(s.y / 10) * 10), 20).filter(([, v]) => v >= Math.max(3, ys.length * 0.01)).map(d => d[0]).sort((a, b) => a - b);
      const rows = topN(countBy(ys.filter(s => s.g !== UNKNOWN), s => s.g), 12).map(d => d[0]);
      const cnt = d3.rollup(ys, v => v.length, s => s.g, s => Math.floor(s.y / 10) * 10);
      if (decs.length > 1 && rows.length) {
        C.matrix(card(g, t('c_era'), t('c_era_s'), { wide: true }), rows, decs, (r, c) => {
          const row = cnt.get(r) || new Map();
          const v = row.get(c) || 0;
          return { v, share: v / (d3.sum(row.values()) || 1) };
        }, {
          rowLabel: r => tv(r), colLabel: c => t('decade', { d: c }), labelW: 170,
          tipFn: (r, c, v, share) => `<b>${pct(share * 100, 100)}</b>${esc(t('era_tip', { s: tv(r), d: t('decade', { d: c }), n: fmt(v) }))}`,
          onClick: ([r, c]) => setFilter({ g: r, y0: c, y1: c + 9 }),
        });
      }
    }

    // Wie frisch
    if (ys.length) {
      const B = [[0, '0'], [1, '1'], [2, '2'], [3, '3–5'], [6, '6–10'], [11, '11–20'], [21, '21+']];
      const age = s => Math.max(0, (s.l ? +s.l.slice(0, 4) : Y.refYear) - s.y);
      const ac = countBy(ys, s => B.filter(([lim]) => age(s) >= lim).pop()[1]);
      C.columns(card(g, t('c_fresh'), t(datedShare(L) > 0.5 ? 'c_fresh_liked' : 'c_fresh_now', { y: Y.refYear })),
        B.map(([, l]) => ({ label: l, value: ac.get(l) || 0 })), { tipFn: d => `<b>${t('n_songs', { n: fmt(d.value) })}</b>${t('age_years', { a: d.label })} · ${pct(d.value, ys.length)}` });
    }

    // Neue Kuenstler
    if (evo.buckets.length) {
      const seen = new Set();
      const rows = evo.buckets.map(b => {
        let fresh = 0;
        const inSlice = new Set();
        b.songs.forEach(s => s.a.forEach(ai => { inSlice.add(ai); if (!seen.has(ai)) { seen.add(ai); fresh++; } }));
        return { label: b.label, value: fresh, share: fresh / (inSlice.size || 1) };
      });
      C.columns(card(g, t('c_discovery'), t('c_discovery_s')), rows, {
        every: Math.ceil(rows.length / 8),
        tipFn: d => `<b>${t('n_new_artists', { n: fmt(d.value) })}</b>${esc(d.label)} · ${t('new_share', { p: pct(d.share * 100, 100) })}`,
      });
    }

    const durs = L.filter(s => s.d && s.d <= 1200).map(s => s.d);
    const sets = L.filter(s => s.d > 1200);
    if (durs.length) {
      const hc = countBy(durs, d => Math.min(Math.floor(d / 30), 20));
      C.columns(card(g, t('c_len'), t('c_len_s', { m: dur(Math.round(d3.median(durs))) }) + (sets.length ? t('c_len_sets', { n: fmt(sets.length) }) : '')),
        d3.range(21).map(i => ({ label: i >= 20 ? '10+' : dur(i * 30), value: hc.get(i) || 0 })),
        { every: 2, tipFn: d => `<b>${t('n_songs', { n: fmt(d.value) })}</b>${d.label}${d.label === '10+' ? ' min' : ''}` });
    }
    list(card(g, t('c_longest'), t('c_longest_s')), L.filter(s => s.d).sort((a, b) => b.d - a.d).slice(0, 8).map(s => songItem(s, dur(s.d))));
    list(card(g, t('c_old'), t('c_old_s')), ys.slice().sort((a, b) => a.y - b.y).slice(0, 8).map(s => songItem(s, String(s.y))));
    if (datedShare(L) > 0.5) {
      const mc = countBy(L.filter(s => s.l), s => s.l.slice(0, 7));
      const months = [...mc.keys()].sort();
      C.columns(card(g, t('c_likes_month'), t('c_likes_month_s')), months.map(mo => ({ label: mo, value: mc.get(mo) })),
        { every: Math.ceil(months.length / 10), tipFn: d => `<b>${t('n_songs', { n: fmt(d.value) })}</b>${fmtMonth(d.label)}` });
    }
  }

  // ================= Hören =================
  let slot = null;
  function listen(root) {
    if (!HAS_PLAYS) {
      empty(root, t('c_noplays'), t('c_noplays_s'));
      return;
    }
    const P = cur.plays;
    if (!P.length) return empty(root, t('empty_plays'), t('empty_plays_s'));
    const days = countBy(P, p => p.day);
    const dayList = [...days.keys()].sort((a, b) => a - b);
    const S = sessions(P);
    const per = playAgg(P);
    const likedPlays = P.filter(p => p.r >= 0).length;
    kpis(root, [
      [fmt(P.length), t('k_plays'), t('k_plays_s', { a: fmtDay(P[0].day), b: fmtDay(P[P.length - 1].day) })],
      [`~${hours(d3.sum(P, playDur))}`, t('k_hours'), t('k_hours_s')],
      [fmt(days.size), t('k_active'), t('k_active_s', { n: num1(P.length / days.size) })],
      [t('k_days', { n: fmt(streak(dayList)) }), t('k_streak'), ''],
      [fmt(S.length), t('k_sessions'), t('k_sessions_s', { m: fmt(Math.round(d3.median(S, s => s.len))) })],
      [fmt(per.size), t('k_unique'), t('k_unique_s', { p: pct(per.size, P.length) })],
      isFiltered() ? null : [pct(likedPlays, P.length), t('k_likedshare'), t('k_likedshare_s')],
    ]);
    const g = grid(root);

    // Kalender + Tagesdetail
    const cal = card(g, t('c_calendar'), t('c_calendar_s'), { wide: true });
    const dayBox = document.createElement('div');
    const showDay = day => {
      const ps = P.filter(p => p.day === day);
      const agg = [...playAgg(ps).values()].sort((a, b) => b.n - a.n);
      dayBox.innerHTML = `<div class="daybox"><b>${esc(fmtDay(day))}</b> · ${esc(t('n_plays', { n: fmt(ps.length) }))}</div>`;
      list(dayBox, agg.slice(0, 12).map(r => playItem(r.k, `${fmt(r.n)}×`)), 'cols');
    };
    C.calendar(cal, days, dayList[0], dayList[dayList.length - 1], { onClick: showDay });
    cal.appendChild(dayBox);
    showDay(topN(days, 1)[0][0]);

    // Verlauf pro Woche
    const wk = d3.rollup(P, v => v.length, p => Math.floor((p.day + 3) / 7));
    const w0 = d3.min(wk.keys()), w1 = d3.max(wk.keys());
    C.area(card(g, t('c_weekly'), t('c_weekly_s'), { wide: true }), d3.range(w0, w1 + 1).map(w => ({ x: w * 7 - 3, y: wk.get(w) || 0 })),
      { tipFn: p => `<b>${t('n_plays', { n: fmt(p.y) })}</b>${t('week_of', { d: fmtDay(p.x) })}` });

    // Wochentag x Stunde mit Detail
    const heat = d3.range(7).map(() => d3.range(24).map(() => 0));
    P.forEach(p => { heat[p.wd][p.h]++; });
    if (!slot) { let best = [0, 0]; heat.forEach((r, d) => r.forEach((v, h) => { if (v > heat[best[0]][best[1]]) best = [d, h]; })); slot = best; }
    const hc = card(g, t('c_heat'), t('c_heat_s'), { cls: 'span2' });
    const sc = card(g, t('c_slot'), '', { cls: 'slot' });
    const drawSlot = () => {
      const [d, h] = slot;
      const ps = P.filter(p => p.wd === d && p.h === h);
      sc.innerHTML = `<div class="slothead">${esc(t('days')[d])}, ${esc(t('hour_range', { h, h2: h + 1 }))} · ${esc(t('n_plays', { n: fmt(ps.length) }))}</div>`;
      const st = topN(countBy(ps.filter(p => p.r >= 0), p => collapse(SONGS[p.r].g)), 4);
      sc.insertAdjacentHTML('beforeend', '<div class="legend">' + st.map(([k, v]) => `<span><i style="background:${genreVar(k)}"></i>${esc(tv(k))} ${pct0(v, ps.length)}</span>`).join('') + '</div>');
      list(sc, [...playAgg(ps).values()].sort((a, b) => b.n - a.n).slice(0, 6).map(r => playItem(r.k, `${fmt(r.n)}×`)), 'compact');
    };
    const onCell = ([d, h]) => { slot = [d, h]; hc.innerHTML = ''; C.heatmap(hc, heat, { sel: slot, onClick: onCell }); drawSlot(); };
    C.heatmap(hc, heat, { sel: slot, onClick: onCell });
    drawSlot();

    // Stil nach Tageszeit
    const lp = P.filter(p => p.r >= 0);
    if (lp.length > 20) {
      const rows = DAYPARTS.map(([key], i) => ({ label: t(key), sub: t('n_plays', { n: fmt(lp.filter(p => daypart(p.h) === i).length) }), counts: Object.fromEntries(countBy(lp.filter(p => daypart(p.h) === i), p => collapse(SONGS[p.r].g))) }));
      const keys = GENRE_KEYS.filter(k => rows.some(r => r.counts[k]));
      C.hstack100(card(g, t('c_daypart'), t('c_daypart_s'), { wide: true }), rows, keys, genreVar, { labelW: 110, unit: 'n_plays', onKey: (r, k) => toggleFilter('g', k) });
    }

    const top = [...per.values()].sort((a, b) => b.n - a.n);
    const mx = top.length ? top[0].n : 1;
    list(card(g, t('c_topplayed'), t('c_topplayed_s')), top.slice(0, 15).map(r => playItem(r.k, `${bar(r.n, mx)}<span>${fmt(r.n)}×</span>`)));
    const ap = new Map();
    P.forEach(p => { const ai = playArtist(p); const k = ai >= 0 ? ai : 'n:' + PX[-1 - p.r][1]; ap.set(k, (ap.get(k) || 0) + 1); });
    C.hbar(card(g, t('c_topartists_p'), t('c_topartists_p_s')), topN(ap, 15).map(([k, v]) => ({ label: typeof k === 'number' ? A[k].n : k.slice(2), key: k, value: v })),
      { labelW: 150, onClick: d => (typeof d.key === 'number' ? Y.openArtist(d.key) : null) });

    // Kuenstler des Monats
    const months = d3.group(P, p => p.mo);
    const mc = card(g, t('c_aotm'), t('c_aotm_s'));
    list(mc, [...months].sort((a, b) => d3.descending(a[0], b[0])).slice(0, 12).map(([mo, ps]) => {
      const c = new Map();
      ps.forEach(p => { const ai = playArtist(p); if (ai >= 0) c.set(ai, (c.get(ai) || 0) + 1); });
      const best = topN(c, 1)[0];
      return best ? artistItem(best[0], `${fmt(best[1])}×`, `${esc(fmtMonth(mo))} · ${esc(pct0(best[1], ps.length))}`) : '';
    }));

    // On Repeat: meiste Wiedergaben innerhalb von 7 Tagen
    const rep = [];
    per.forEach(r => {
      if (r.n < 3) return;
      let best = 0, at = 0;
      for (let i = 0, j = 0; j < r.times.length; j++) {
        while (r.times[j] - r.times[i] > 10080) i++;
        if (j - i + 1 > best) { best = j - i + 1; at = r.times[i]; }
      }
      rep.push({ k: r.k, best, at });
    });
    list(card(g, t('c_repeat'), t('c_repeat_s')), rep.sort((a, b) => b.best - a.best).slice(0, 10)
      .map(r => playItem(r.k, `${fmt(r.best)}×`, null)));

    // Vergessene Lieblinge
    const end = P[P.length - 1].m, span = end - P[0].m;
    const cut = end - Math.max(30 * 1440, span * 0.25);
    const forgotten = [...per.values()].filter(r => r.n >= 3 && r.last < cut).sort((a, b) => b.n - a.n).slice(0, 10);
    const fc = card(g, t('c_forgotten'), t('c_forgotten_s', { d: fmt(Math.round((end - cut) / 1440)) }));
    forgotten.length ? list(fc, forgotten.map(r => playItem(r.k, `${fmt(r.n)}×`, t('last_played', { d: fmtDay(Math.floor(r.last / 1440)) }))))
      : empty(fc, t('none_yet'), '');

    if (!isFiltered()) {
      const nl = top.filter(r => r.k[0] === 'x').slice(0, 10);
      const nc = card(g, t('c_notliked'), t('c_notliked_s'));
      nl.length ? list(nc, nl.map(r => playItem(r.k, `${fmt(r.n)}×`))) : empty(nc, t('none_yet'), '');
    }
    const sc2 = card(g, t('c_sessions'), t('c_sessions_s'));
    list(sc2, S.slice().sort((a, b) => b.n - a.n).slice(0, 8).map(s => {
      const d = new Date(s.start * 60000);
      return `<li class="item"><div class="it-main"><div class="it-t">${esc(fmtDay(Math.floor(s.start / 1440)))}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}</div><div class="it-s">${esc(t('session_len', { m: fmt(Math.round(s.len)) }))}</div></div><div class="it-r">${esc(t('n_plays', { n: fmt(s.n) }))}</div></li>`;
    }));
  }

  // ================= Entdecken =================
  function discover(root) {
    const L = cur.songs;
    if (!L.length) return noSongs(root);
    const g = grid(root);
    const R = recsFor();
    const rc = card(g, t('c_recs'), t('c_recs_s'), { wide: true, info: t('c_recs_info') });
    if (R.length) {
      const max = R[0][2];
      rc.innerHTML = '<div class="recs">' + R.slice(0, 18).map(([name, id, score, genre, via]) => {
        const link = Y.ytArtist(id);
        return `<div class="rec" style="--c:${genreVar(genre)}">
          <div class="rec-h">${cover(null, name, genre, 'round')}<div><div class="rec-n">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(name)} ↗</a>` : esc(name)}</div><div class="it-s">${esc(tv(genre))}</div></div></div>
          ${bar(score, max)}
          <div class="rec-v">${esc(t('rec_via', { n: fmt(via.length) }))} ${via.slice(0, 4).map(artistLink).join(', ')}</div></div>`;
      }).join('') + '</div>';
    } else empty(rc, t('none_yet'), t('c_recs_none'));

    // Brueckenkuenstler: verbinden mehrere Musik-Welten
    const inCur = new Set(L.flatMap(s => s.a));
    const bridges = [...inCur].map(ai => {
      const worlds = new Set(A[ai].nb.map(e => A[Y.other(e, ai)].cm).filter(w => w >= 0 && w < 12 && w !== A[ai].cm));
      return { ai, worlds };
    }).filter(b => b.worlds.size >= 2).sort((a, b) => b.worlds.size - a.worlds.size || A[b.ai].c - A[a.ai].c).slice(0, 10);
    const bc = card(g, t('c_bridges'), t('c_bridges_s'));
    bridges.length ? list(bc, bridges.map(b => artistItem(b.ai, t('n_worlds', { n: b.worlds.size + 1 }),
      [...b.worlds].slice(0, 3).map(w => `<a href="#" data-f="w" data-v="${w}">${esc(COMMS[w].name)}</a>`).join(' · ')))) : empty(bc, t('none_yet'), '');

    // Zweite Chance: ein Song, aber viele verwandte Lieblinge
    const second = [...inCur].filter(ai => A[ai].c === 1).map(ai => ({ ai, n: A[ai].nb.filter(e => A[Y.other(e, ai)].c >= 3).length }))
      .filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 10);
    const scd = card(g, t('c_second'), t('c_second_s'));
    second.length ? list(scd, second.map(x => artistItem(x.ai, t('n_links', { n: x.n }), A[x.ai].nb.map(e => Y.other(e, x.ai)).filter(o => A[o].c >= 3).slice(0, 3).map(artistLink).join(', '))))
      : empty(scd, t('none_yet'), '');

    const shuffleCard = (title, sub, pool, n, right) => {
      const el = card(g, title, sub);
      const draw = () => {
        el.innerHTML = '';
        if (!pool.length) return empty(el, t('none_yet'), '');
        list(el, shuffle(pool, n).map(s => songItem(s, right ? right(s) : '')));
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = '↻ ' + t('reshuffle');
        b.onclick = draw;
        el.appendChild(b);
      };
      draw();
    };
    shuffleCard(t('c_random'), t('c_random_s'), L, 8, s => (s.y ? String(s.y) : ''));
    shuffleCard(t('c_gems'), t('c_gems_s'), L.filter(s => s.sub != null && s.sub < 1e4), 8, s => compact(s.sub));
    if (HAS_PLAYS) {
      const never = L.filter(s => !s.p);
      shuffleCard(t('c_never'), t('c_never_s', { n: fmt(never.length), p: pct(never.length, L.length) }), never, 8, null);
    }
  }

  // ================= Tabellen (Künstler, Songs) =================
  function table(root, { rows, cols, initial, searchKey, csv = null, onRow = null, ph }) {
    let sortK = initial[0], dir = initial[1], shown = 100, term = '';
    root.insertAdjacentHTML('beforeend', `<div class="tablebar"><input type="search" placeholder="${esc(ph)}"><span class="meta"></span>${csv ? `<button class="btn" data-csv>⤓ CSV</button>` : ''}</div><div class="tablewrap"><table></table></div><div class="tablemore"></div>`);
    const q = root.querySelector('.tablebar input'), info = root.querySelector('.tablebar .meta'), tbl = root.querySelector('table'), more = root.querySelector('.tablemore');
    let current = rows;
    function render() {
      current = rows.filter(r => !term || r[searchKey].includes(term)).sort((a, b) => {
        const x = a[sortK], y = b[sortK];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), LOC)) * dir;
      });
      info.textContent = t('rows_info', { n: fmt(current.length), total: fmt(rows.length) });
      tbl.innerHTML = '<thead><tr>' + cols.map(c => `<th class="${c.num ? 'num' : ''}" data-k="${c.k}" title="${esc(c.title || '')}" aria-sort="${sortK === c.k ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${esc(c.l)}${sortK === c.k ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr></thead><tbody>'
        + current.slice(0, shown).map(r => `<tr${onRow ? ` data-row="${r._id}"` : ''}>` + cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.html ? c.html(r) : esc(r[c.k] ?? '')}</td>`).join('') + '</tr>').join('') + '</tbody>';
      tbl.querySelectorAll('th').forEach(th => {
        th.onclick = () => {
          const k = th.dataset.k;
          if (sortK === k) dir = -dir; else { sortK = k; dir = cols.find(c => c.k === k).num ? -1 : 1; }
          render();
        };
      });
      if (onRow) tbl.querySelectorAll('tr[data-row]').forEach(tr => { tr.onclick = ev => { if (!ev.target.closest('a')) onRow(+tr.dataset.row); }; });
      more.innerHTML = current.length > shown ? `<button class="btn">${esc(t('show_more', { n: fmt(Math.min(current.length - shown, 200)) }))}</button>` : '';
      if (more.firstChild) more.firstChild.onclick = () => { shown += 200; render(); };
    }
    q.addEventListener('input', Y.debounce(() => { term = q.value.trim().toLowerCase(); shown = 100; render(); }, 120));
    if (csv) root.querySelector('[data-csv]').onclick = () => csv(current);
    render();
  }

  function artists(root) {
    const L = cur.songs;
    if (!L.length) return noSongs(root);
    const cnt = new Map();
    L.forEach(s => s.a.forEach(ai => cnt.set(ai, (cnt.get(ai) || 0) + 1)));
    const rows = [...cnt].map(([ai, c]) => {
      const a = A[ai];
      return { _id: ai, n: a.n, c, m: L.filter(s => s.m === ai).length, p: a.p, g: tv(a.g), raw_g: a.g, w: a.cm >= 0 && COMMS[a.cm] ? COMMS[a.cm].name : '', co: a.co || '', s: a.s, nb: a.nb.length, _q: (a.n + ' ' + tv(a.g) + ' ' + a.t.join(' ')).toLowerCase() };
    });
    table(root, {
      rows, initial: ['c', -1], searchKey: '_q', ph: t('artists_ph'), onRow: ai => Y.openArtist(ai),
      cols: [
        { k: 'n', l: t('col_artist'), html: r => `<span class="cell-a">${cover(artistCoverSong(r._id), r.n, r.raw_g, 'round sm')}${artistLink(r._id)}</span>` },
        { k: 'c', l: t('col_songs'), num: true, html: r => fmt(r.c) },
        { k: 'm', l: t('col_main'), num: true, title: t('col_main_title'), html: r => fmt(r.m) },
        HAS_PLAYS ? { k: 'p', l: t('col_plays'), num: true, html: r => (r.p ? fmt(r.p) : '') } : null,
        { k: 'g', l: t('col_genre'), html: r => `<span class="dot" style="background:${genreVar(r.raw_g)}"></span>${esc(r.g)}` },
        { k: 'w', l: t('world'), html: r => esc(r.w) },
        { k: 'co', l: t('col_country'), html: r => esc(r.co) },
        { k: 's', l: t('col_subs'), num: true, html: r => (r.s != null ? compact(r.s) : '') },
        { k: 'nb', l: t('connections'), num: true, html: r => fmt(r.nb) },
      ].filter(Boolean),
    });
  }

  function songs(root) {
    const L = cur.songs;
    if (!L.length) return noSongs(root);
    const rows = L.map(s => ({ ...s, _id: s.i, artist: s.an, gl: tv(s.g), pls: s.pl.map(i => PLS[i]).join(', '), _q: [s.t, s.an, s.al, tv(s.g), s.y, s.pl.map(i => PLS[i]).join(' ')].join(' ').toLowerCase() }));
    const dated = datedShare(L) > 0;
    table(root, {
      rows, initial: ['o', 1], searchKey: '_q', ph: t('table_ph'), csv: exportCsv,
      cols: [
        { k: 'o', l: '#', num: true, title: t('col_order_title'), html: r => fmt(r.o) },
        { k: 't', l: t('col_title'), html: r => `<span class="cell-a">${cover(r, r.an, r.g, 'sm')}<span>${songTitle(r)}</span></span>` },
        { k: 'artist', l: t('col_artist'), html: r => artistLinks(r) },
        { k: 'al', l: t('col_album') },
        { k: 'y', l: t('col_year'), num: true, html: r => r.y ?? '' },
        { k: 'd', l: t('col_len'), num: true, html: r => (r.d ? dur(r.d) : '') },
        { k: 'gl', l: t('col_genre'), html: r => `<a href="#" data-f="g" data-v="${esc(r.g)}" class="plain"><span class="dot" style="background:${genreVar(r.g)}"></span>${esc(r.gl)}</a>` },
        HAS_PLAYS ? { k: 'p', l: t('col_plays'), num: true, html: r => (r.p ? fmt(r.p) : '') } : null,
        { k: 'pls', l: t('col_pls') },
        dated ? { k: 'l', l: t('col_liked') } : null,
      ].filter(Boolean),
    });
  }

  function exportCsv(rows) {
    const sep = LOC.startsWith('de') ? ';' : ',';
    const q = v => { const s = String(v ?? ''); return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ['position', 'title', 'artists', 'album', 'year', 'duration_s', 'style', 'plays', 'playlists', 'likedAt', 'url'];
    const lines = [head.join(sep)].concat(rows.map(r => [r.o, r.t, r.an, r.al, r.y, r.d, r.g, r.p, r.pls, r.l, ytSong(r)].map(q).join(sep)));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'liked-songs' + (isFiltered() ? '-filter' : '') + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Seiten registrieren: render(root) baut den Inhalt; header kommt automatisch davor
  const page = (key, fn, extra) => ({ render(root) { root.innerHTML = ''; header(root, key, extra ? extra() : ''); fn(root); } });
  Object.assign(Y.views, {
    home: { render(root) { root.innerHTML = ''; if (isFiltered()) header(root, 'home'); home(root); } },
    taste: page('taste', taste), time: page('time', time), listen: page('listen', listen), discover: page('discover', discover),
    artists: page('artists', artists), songs: page('songs', songs),
  });
  Object.assign(Y, { ui: { cover, artistLink, artistLinks, songItem, playItem, artistItem, list, bar, empty, initials, countryName, playAgg } });
})();
