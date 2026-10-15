// Start der Seite: Navigation, Filterleiste, Künstlerprofil, Suche (Strg+K), Theme und Sprache.
(() => {
  'use strict';
  const Y = window.Y;
  if (!Y || !Y.ok) {
    // Ohne data.js wurde meist die Vorlage in web/ statt der fertigen Seite in out/ geoeffnet
    const key = !window.DATA ? 'no_data' : 'load_error';
    document.getElementById('main').innerHTML = `<p style="padding:24px;max-width:640px">${window.t ? t(key) : 'Data or D3 could not be loaded.'}</p>`;
    return;
  }
  const { A, SONGS, COMMS, PLS, PLAYS, PX, HAS_PLAYS, UNKNOWN, F, cur, VIEWS, nav } = Y;
  const { fmt, pct, esc, compact, genreVar, commVar, setFilter, isFiltered, ytArtist, other, debounce, hideTip } = Y;
  const $ = id => document.getElementById(id);

  // ---------- Kopf ----------
  $('demo').hidden = !Y.DEMO;
  $('meta').innerHTML = t('meta', { songs: fmt(SONGS.length), artists: fmt(A.length), date: esc(Y.D.meta.generated.replace('T', ' ')) });
  $('lang').addEventListener('click', () => setLang(LANG === 'de' ? 'en' : 'de'));
  if (!HAS_PLAYS) document.querySelector('[data-view="listen"]').classList.add('nodata');
  try { const th = localStorage.getItem('ytm-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* ohne Speicher */ }
  $('theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('ytm-theme', root.dataset.theme); } catch (e) { /* ohne Speicher */ }
    Object.values(Y.views).forEach(v => v._init && v.retheme?.());
  });
  $('menu').addEventListener('click', () => document.body.classList.toggle('navopen'));

  // ---------- Ansichten ----------
  const dirty = {};
  const sectionOf = name => $('v-' + name);
  function show(name) {
    nav.view = name;
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
    document.querySelectorAll('[data-view]').forEach(b => (b.dataset.view === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    document.querySelectorAll('#main > section').forEach(s => { s.hidden = s.id !== 'v-' + name; });
    document.body.classList.toggle('fullview', name === 'network' || name === 'bubbles');
    document.body.classList.remove('navopen');
    hideTip();
    measureTop();
    const v = Y.views[name], el = sectionOf(name);
    if (!v._init) { v._init = true; if (v.init) { v.init(el); dirty[name] = false; } else dirty[name] = true; }
    if (dirty[name] !== false) { v.render(el); dirty[name] = false; } else v.refresh?.(el);
  }
  function go(name) {
    if (!VIEWS.includes(name)) return;
    if (name !== nav.view) {
      window.scrollTo(0, 0);
      nav.view = name;
      Y.writeHash(true);
    }
    show(name);
  }
  Y.go = go;
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); go(b.dataset.view); }));

  Y.on('filter', () => {
    VIEWS.forEach(n => { dirty[n] = true; });
    const v = Y.views[nav.view];
    if (v._init) { v.render(sectionOf(nav.view)); dirty[nav.view] = false; }
    filterBar();
  });

  // Hoehe der Kopfleiste fuer die Vollbild-Maps
  function measureTop() {
    document.documentElement.style.setProperty('--top-h', document.querySelector('.topbar').offsetHeight + 'px');
  }
  addEventListener('resize', debounce(() => { measureTop(); const v = Y.views[nav.view]; v._init && v.refresh?.(sectionOf(nav.view)); }, 150));

  // ---------- Filterleiste ----------
  const styleOpts = [...d3.rollup(SONGS, v => v.length, s => s.g)].sort((a, b) => b[1] - a[1]);
  const worldOpts = COMMS.filter(c => c.artists > 1).slice(0, 24);
  const decades = [...new Set(SONGS.filter(s => s.y).map(s => Math.floor(s.y / 10) * 10))].sort((a, b) => b - a);
  function filterBar() {
    const el = $('filters');
    const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
    const decadeVal = F.y0 != null && F.y1 === F.y0 + 9 && F.y0 % 10 === 0 ? String(F.y0) : '';
    const html = [
      `<label class="fsel${F.g != null ? ' on' : ''}"><span>${esc(t('f_style'))}</span><select data-k="g">${opt('', t('f_all'))}${styleOpts.map(([g, n]) => opt(g, `${tv(g)} (${fmt(n)})`, F.g === g)).join('')}${F.g === Y.OTHER ? opt(Y.OTHER, tv(Y.OTHER), true) : ''}</select></label>`,
      `<label class="fsel${F.w != null ? ' on' : ''}"><span>${esc(t('f_world'))}</span><select data-k="w">${opt('', t('f_all'))}${worldOpts.map(c => opt(c.id, c.name, F.w === c.id)).join('')}${F.w != null && !worldOpts.some(c => c.id === F.w) ? opt(F.w, COMMS[F.w].name, true) : ''}</select></label>`,
      PLS.length ? `<label class="fsel${F.pl != null ? ' on' : ''}"><span>${esc(t('f_playlist'))}</span><select data-k="pl">${opt('', t('f_all'))}${PLS.map((p, i) => opt(i, p, F.pl === i)).join('')}</select></label>` : '',
      decades.length ? `<label class="fsel${F.y0 != null ? ' on' : ''}"><span>${esc(t('f_years'))}</span><select data-k="dec">${opt('', t('f_all'))}${decades.map(d => opt(d, t('decade', { d }), decadeVal === String(d))).join('')}${F.y0 != null && !decadeVal ? opt('custom', F.y0 === F.y1 ? String(F.y0) : `${F.y0}–${F.y1}`, true) : ''}</select></label>` : '',
      F.a != null ? `<button class="fchip" data-clear="a">${esc(t('f_artist'))}: <b>${esc(A[F.a].n)}</b> ×</button>` : '',
      F.co != null ? `<button class="fchip" data-clear="co">${esc(t('f_country'))}: <b>${esc(F.co === '?' ? t('unknown_lc') : Y.ui.countryName(F.co))}</b> ×</button>` : '',
      isFiltered() ? `<span class="fcount">${t('filter_count', { n: fmt(cur.songs.length), p: pct(cur.songs.length, SONGS.length) })}</span><button class="btn ghost" data-reset>${esc(t('reset'))}</button>` : '',
    ];
    el.innerHTML = html.join('');
    el.querySelectorAll('select').forEach(s => s.addEventListener('change', () => {
      const k = s.dataset.k, v = s.value;
      if (k === 'dec') { if (v !== 'custom') setFilter(v ? { y0: +v, y1: +v + 9 } : { y0: null, y1: null }); } else setFilter({ [k]: v });
    }));
    el.querySelectorAll('[data-clear]').forEach(b => { b.onclick = () => setFilter({ [b.dataset.clear]: null }); });
    document.body.classList.toggle('filtered', isFiltered());
    measureTop();
  }

  // ---------- Verknuepfungen: ein Klick-Handler fuer die ganze Seite ----------
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-ai],[data-f],[data-f2],[data-go],[data-reset]');
    if (!el || el.closest('#netStage canvas')) return;
    if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href') !== '#' && !el.dataset.ai) return;
    ev.preventDefault();
    if (el.dataset.ai != null) openArtist(+el.dataset.ai);
    else if (el.dataset.f) Y.toggleFilter(el.dataset.f, el.dataset.v);
    else if (el.dataset.f2) {
      const patch = Object.fromEntries(el.dataset.f2.split(',').map(kv => kv.split(':')));
      const same = Object.entries(patch).every(([k, v]) => String(F[k]) === v);
      setFilter(same ? Object.fromEntries(Object.keys(patch).map(k => [k, null])) : patch);
    } else if (el.dataset.go) go(el.dataset.go);
    else if (el.dataset.reset != null) setFilter({}, { replace: true });
  });
  document.addEventListener('keydown', ev => {
    const el = ev.target.closest && ev.target.closest('.kpi.link');
    if (el && ev.key === 'Enter') go(el.dataset.go);
  });

  // ---------- Kuenstlerprofil ----------
  const drawer = $('drawer'), scrim = $('scrim');
  function openArtist(ai) {
    if (ai == null || !A[ai]) return;
    nav.artist = ai;
    drawer.hidden = false; scrim.hidden = false;
    renderProfile(ai);
    requestAnimationFrame(() => { drawer.classList.add('open'); scrim.classList.add('open'); });
    drawer.scrollTop = 0;
    drawer.focus({ preventScroll: true });
    Y.writeHash();
  }
  function closeArtist() {
    if (nav.artist == null) return;
    nav.artist = null;
    drawer.classList.remove('open'); scrim.classList.remove('open');
    setTimeout(() => { if (nav.artist == null) { drawer.hidden = true; scrim.hidden = true; } }, 220);
    Y.writeHash();
  }
  Y.openArtist = openArtist;
  scrim.addEventListener('click', closeArtist);

  function renderProfile(ai) {
    const a = A[ai];
    const { ui } = Y;
    const songs = a.songs.map(i => SONGS[i]).sort((x, y) => y.p - x.p || x.o - y.o);
    const rank = 1 + A.filter(b => b.main > a.main).length;
    const link = ytArtist(a.id);
    const world = a.cm >= 0 ? COMMS[a.cm] : null;
    const ps = PLAYS.filter(p => (p.r >= 0 ? SONGS[p.r].a.includes(ai) : PX[-1 - p.r][2] === ai));
    const feats = a.nb.filter(e => e.f).sort((x, y) => y.f - x.f);
    const rel = a.nb.filter(e => e.r && !e.f);
    const tagN = a.nb.filter(e => e.tg && !e.f && !e.r);
    const connected = new Set(a.nb.map(e => other(e, ai)));
    const ts = new Set(a.t);
    const similar = ts.size < 2 ? [] : A.filter(b => b.i !== ai && !connected.has(b.i) && b.t.length >= 2).map(b => {
      const inter = b.t.filter(x => ts.has(x)).length;
      return { b, j: inter / (ts.size + b.t.length - inter) };
    }).filter(x => x.j >= 0.34).sort((x, y) => y.j - x.j || y.b.c - x.b.c).slice(0, 8);
    const recs = (Y.D.recs || []).filter(r => r[4].includes(ai)).slice(0, 6);
    const links = (list, label) => (list.length ? `<div class="pf-l"><span>${esc(label)}</span>${list.slice(0, 14).map(e => ui.artistLink(other(e, ai)) + (e.f ? ` <small>${fmt(e.f)}×</small>` : '')).join(', ')}</div>` : '');

    drawer.innerHTML = `
      <div class="pf-top">
        <button class="iconbtn close" aria-label="${esc(t('close'))}">×</button>
        <div class="pf-head">${ui.cover(Y.artistCoverSong(ai), a.n, a.g, 'xl')}
          <div><div class="eyebrow">${esc(t('artist'))}</div><h2>${esc(a.n)}</h2>
          <div class="pf-sub"><span class="dot" style="background:${genreVar(a.g)}"></span>${esc(tv(a.g))}${a.gi ? ` <span class="muted">(${esc(t('inferred'))})</span>` : ''}${a.co ? ' · ' + esc(ui.countryName(a.co)) : ''}${a.s != null ? ' · ' + esc(t('subscribers', { n: compact(a.s) })) : ''}</div></div>
        </div>
        <div class="pf-actions">
          <button class="btn primary" data-act="filter">${esc(F.a === ai ? t('pf_unfilter') : t('pf_filter'))}</button>
          <button class="btn" data-act="net">${esc(t('pf_network'))}</button>
          ${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">YouTube Music ↗</a>` : ''}
        </div>
      </div>
      <div class="pf-stats">
        <div><b>${fmt(a.c)}</b><span>${esc(t('liked_songs'))}</span></div>
        <div><b>#${fmt(rank)}</b><span>${esc(t('pf_rank'))}</span></div>
        <div><b>${HAS_PLAYS ? fmt(ps.length) : '–'}</b><span>${esc(t('k_plays'))}</span></div>
        <div><b>${fmt(a.nb.length)}</b><span>${esc(t('connections'))}</span></div>
      </div>
      ${a.t.length ? `<div class="pf-tags">${a.t.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
      ${world ? `<a href="#" class="pf-world" data-f="w" data-v="${a.cm}" style="--c:${commVar(a.cm)}"><span class="muted">${esc(t('world'))}</span> <b>${esc(world.name)}</b> <span class="muted">· ${esc(t('n_artists', { n: fmt(world.artists) }))}</span></a>` : ''}
      <h4>${esc(t('pf_timeline'))}</h4><div class="pf-strip"></div>
      ${ps.length > 1 ? `<h4>${esc(t('pf_plays'))}</h4><div class="pf-spark"></div>` : ''}
      <h4>Songs <span class="muted">${fmt(songs.length)}</span></h4>
      <ul class="items compact">${songs.slice(0, 60).map(s => ui.songItem(s, [s.y, s.p ? fmt(s.p) + '×' : ''].filter(Boolean).join(' · '))).join('')}</ul>
      ${a.nb.length ? `<h4>${esc(t('connections'))}</h4>${links(feats, t('pf_feats'))}${links(rel, t('pf_related'))}${links(tagN, t('pf_tagsim'))}` : ''}
      ${similar.length ? `<h4>${esc(t('pf_similar'))}</h4><div class="pf-l">${similar.map(x => ui.artistLink(x.b.i)).join(', ')}</div>` : ''}
      ${recs.length ? `<h4>${esc(t('pf_recs'))}</h4><div class="pf-l">${recs.map(r => { const l = ytArtist(r[1]); return l ? `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(r[0])} ↗</a>` : esc(r[0]); }).join(', ')}</div>` : ''}`;
    drawer.querySelector('.close').onclick = closeArtist;
    drawer.querySelector('[data-act=filter]').onclick = () => { setFilter({ a: F.a === ai ? null : ai }); renderProfile(ai); };
    drawer.querySelector('[data-act=net]').onclick = () => { closeArtist(); go('network'); Y.netFocus(ai); };

    // Like-Verlauf: wo in deiner Like-Liste die Songs liegen (links alt, rechts neu)
    const strip = drawer.querySelector('.pf-strip');
    const maxO = d3.max(SONGS, s => s.o) || 1;
    const W = strip.clientWidth || 360, H = 34;
    const svg = d3.select(strip).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', 14).attr('y2', 14).attr('stroke', 'var(--grid)');
    svg.selectAll('rect').data(songs).join('rect').attr('x', s => (1 - s.o / maxO) * (W - 4)).attr('y', 4).attr('width', 3).attr('height', 20).attr('rx', 1.5)
      .attr('fill', genreVar(a.g)).attr('opacity', 0.85)
      .on('mousemove', (ev, s) => Y.showTip(ev, `<b>${esc(s.t)}</b>${s.l ? esc(s.l) : esc(t('like_pos', { n: fmt(s.o + 1) }))}`)).on('mouseleave', hideTip);
    svg.append('text').attr('class', 'lbl').attr('x', 0).attr('y', H - 1).text(t('older'));
    svg.append('text').attr('class', 'lbl').attr('x', W).attr('y', H - 1).attr('text-anchor', 'end').text(t('newer'));
    if (ps.length > 1) {
      const wk = d3.rollup(PLAYS, v => v.length, p => Math.floor((p.day + 3) / 7));
      const mine = d3.rollup(ps, v => v.length, p => Math.floor((p.day + 3) / 7));
      const w0 = d3.min(wk.keys()), w1 = d3.max(wk.keys());
      Y.charts.spark(drawer.querySelector('.pf-spark'), d3.range(w0, w1 + 1).map(w => mine.get(w) || 0), { height: 44, color: genreVar(a.g) });
      drawer.querySelector('.pf-spark').insertAdjacentHTML('beforeend', `<div class="lblrow"><span>${esc(Y.fmtDay(ps[0].day))}</span><span>${esc(t('last_played', { d: Y.fmtDay(ps[ps.length - 1].day) }))}</span></div>`);
    }
  }

  // ---------- Suche (Strg+K) ----------
  const pal = $('palette'), pin = $('palInput'), pres = $('palResults');
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let IDX = null, hits = [], active = 0;
  function buildIndex() {
    IDX = [
      ...VIEWS.map(v => ({ ty: 'page', label: t('nav_' + v), sub: '', w: 100, act: () => go(v) })),
      ...A.map(a => ({ ty: 'artist', label: a.n, sub: `${t('n_songs', { n: fmt(a.c) })} · ${tv(a.g)}`, w: a.c, color: genreVar(a.g), act: () => openArtist(a.i) })),
      ...styleOpts.map(([g, n]) => ({ ty: 'style', label: tv(g), sub: t('n_songs', { n: fmt(n) }), w: n, color: genreVar(g), act: () => { setFilter({ g }); go('taste'); } })),
      ...worldOpts.map(c => ({ ty: 'world', label: c.name, sub: c.top.slice(0, 3).join(', '), w: c.songs, color: commVar(c.id), act: () => { setFilter({ w: c.id }); go('taste'); } })),
      ...PLS.map((p, i) => ({ ty: 'playlist', label: p, sub: '', w: 50, act: () => { setFilter({ pl: i }); go('songs'); } })),
      ...SONGS.map(s => ({ ty: 'song', label: s.t, sub: s.an, w: 0.5 + Math.min(s.p, 50) / 10, color: genreVar(s.g), act: () => openArtist(s.m), q2: norm(s.an) })),
    ];
    IDX.forEach(x => { x.q = norm(x.label); });
  }
  const TYW = { page: 4, style: 3, world: 2.5, playlist: 2.5, artist: 2, song: 1 };
  function search(q) {
    q = norm(q.trim());
    if (!q) return IDX.filter(x => x.ty === 'page');
    const out = [];
    for (const x of IDX) {
      let s = x.q.startsWith(q) ? 3 : x.q.includes(' ' + q) ? 2 : x.q.includes(q) ? 1 : (x.q2 && x.q2.includes(q) ? 0.5 : 0);
      if (!s) continue;
      out.push([s * TYW[x.ty] + Math.log1p(x.w) * 0.3, x]);
    }
    return out.sort((a, b) => b[0] - a[0]).slice(0, 14).map(d => d[1]);
  }
  function drawHits() {
    pres.innerHTML = hits.map((x, i) => `<li role="option" class="${i === active ? 'on' : ''}" data-i="${i}" aria-selected="${i === active}">
      <span class="pt">${esc(t('ty_' + x.ty))}</span>${x.color ? `<span class="dot" style="background:${x.color}"></span>` : ''}<span class="pl">${esc(x.label)}</span><span class="ps">${esc(x.sub)}</span></li>`).join('')
      || `<li class="none">${esc(t('no_hits'))}</li>`;
    const on = pres.querySelector('.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    if (!IDX) buildIndex();
    pal.hidden = false;
    pin.value = '';
    hits = search(''); active = 0; drawHits();
    pin.focus();
  }
  const closePalette = () => { pal.hidden = true; };
  const pick = i => { const x = hits[i]; if (!x) return; closePalette(); x.act(); };
  pin.addEventListener('input', () => { hits = search(pin.value); active = 0; drawHits(); });
  pin.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') { active = Math.min(hits.length - 1, active + 1); drawHits(); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { active = Math.max(0, active - 1); drawHits(); ev.preventDefault(); }
    else if (ev.key === 'Enter') { pick(active); ev.preventDefault(); }
  });
  pres.addEventListener('click', ev => { const li = ev.target.closest('li[data-i]'); if (li) pick(+li.dataset.i); });
  pal.addEventListener('click', ev => { if (ev.target === pal) closePalette(); });
  $('searchBtn').addEventListener('click', openPalette);
  document.addEventListener('keydown', ev => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((ev.key === 'k' && (ev.ctrlKey || ev.metaKey)) || (ev.key === '/' && !typing)) { ev.preventDefault(); openPalette(); }
    else if (ev.key === 'Escape') { if (!pal.hidden) closePalette(); else closeArtist(); }
  });
  $('kbd').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  // ---------- Start ----------
  function fromHash() {
    const { view, artist } = Y.readHash();
    let v = view;
    if (!v) { try { v = localStorage.getItem('ytm-view'); } catch (e) { /* */ } }
    VIEWS.forEach(n => { dirty[n] = true; });
    filterBar();
    show(VIEWS.includes(v) ? v : 'home');
    if (artist != null) openArtist(artist); else if (nav.artist != null) closeArtist();
  }
  // Zurueck/Vor und von Hand geaenderte Adresse; eigene Aenderungen (nav.hash) nicht doppelt verarbeiten
  const onNav = () => { if (location.hash !== nav.hash) { nav.hash = location.hash; fromHash(); } };
  addEventListener('popstate', onNav);
  addEventListener('hashchange', onNav);
  addEventListener('beforeunload', () => { try { localStorage.setItem('ytm-view', nav.view); } catch (e) { /* */ } });
  fromHash();
  Y.writeHash();
})();
