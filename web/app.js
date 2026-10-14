(() => {
  'use strict';
  const D = window.DATA;
  if (!D || !window.d3) {
    document.getElementById('main').innerHTML =
      '<p style="padding:24px">Daten oder D3 konnten nicht geladen werden. Internetverbindung prüfen (D3 kommt von cdnjs) und <code>python ytm.py build</code> ausführen.</p>';
    return;
  }
  const S = D.stats, A = D.artists, SONGS = D.songs, COMMS = D.communities;
  const GENRES = D.meta.genres, UNKNOWN = D.meta.unknown;

  // ---------- Helfer ----------
  const nf = new Intl.NumberFormat('de-DE');
  const fmt = v => (v == null ? '–' : nf.format(v));
  const pct = (a, b) => (b ? (100 * a / b).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %' : '–');
  const pctv = v => (v == null ? '–' : v.toLocaleString('de-DE') + ' %');
  const dur = s => (s == null ? '–' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const compact = v => v == null ? '–' : v >= 1e6 ? (v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.'
    : v >= 1e3 ? Math.round(v / 1e3).toLocaleString('de-DE') + ' Tsd.' : fmt(v);
  const OTHER = D.meta.other || 'Weitere Stile', PLS = D.meta.playlists || [];
  const GENRE_KEYS = GENRES.concat([OTHER, UNKNOWN]);
  const collapse = g => (GENRES.includes(g) || g === UNKNOWN ? g : OTHER);
  const genreVar = g => { const i = GENRES.indexOf(g); return i >= 0 ? `var(--s${i + 1})` : g === UNKNOWN ? 'var(--unknown)' : 'var(--other)'; };
  const plVar = p => (p >= 0 && p < 8 ? `var(--s${p + 1})` : 'var(--other)');
  // Spezifischste Playlist eines Songs = die kleinste (Liste ist nach Groesse sortiert)
  const songPl = s => (s.pl && s.pl.length ? Math.max(...s.pl) : -1);
  const commVar = c => (c >= 0 && c < 8 ? `var(--s${c + 1})` : 'var(--other)');
  const artistNames = s => s.a.map(i => A[i].n).join(', ');
  const songsByArtist = A.map(() => []);
  SONGS.forEach((s, i) => s.a.forEach(ai => songsByArtist[ai].push(i)));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const tip = document.getElementById('tip');
  function showTip(ev, html) {
    tip.innerHTML = html;
    tip.style.opacity = 1;
    const x = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8);
    const y = Math.min(ev.clientY + 14, innerHeight - tip.offsetHeight - 8);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  const hideTip = () => { tip.style.opacity = 0; };

  // ---------- Kopfzeile, Tabs, Theme ----------
  document.getElementById('demo').hidden = !D.meta.demo;
  document.getElementById('meta').textContent =
    `${fmt(S.songs)} Songs · ${fmt(S.artists)} Künstler · erstellt ${D.meta.generated.replace('T', ' ')}`;

  const views = {};
  let current = 'overview';
  function showTab(name) {
    current = name;
    document.querySelectorAll('nav [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
    document.querySelectorAll('main > section').forEach(s => { s.hidden = s.id !== name; });
    document.getElementById('main').classList.toggle('full', name === 'network' || name === 'bubbles');
    hideTip();
    if (!views[name]) views[name] = { overview: initOverview, network: initNetwork, bubbles: initPack, table: initTable }[name]();
    else views[name].refresh?.();
    try { localStorage.setItem('ytm-tab', name); } catch (e) { /* ohne Speicher */ }
  }
  document.querySelectorAll('nav [role=tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  document.getElementById('theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('ytm-theme', root.dataset.theme); } catch (e) { /* ohne Speicher */ }
    Object.values(views).forEach(v => v.retheme?.());
  });
  try { const t = localStorage.getItem('ytm-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* */ }

  addEventListener('resize', debounce(() => views[current]?.refresh?.(), 150));

  // ---------- Diagramm-Bausteine ----------
  const barH = (w, h, r = 4) => { r = Math.min(r, w, h / 2); return `M0,0H${w - r}Q${w},0 ${w},${r}V${h - r}Q${w},${h} ${w - r},${h}H0Z`; };
  const barV = (w, h, r = 4) => { r = Math.min(r, h, w / 2); return `M0,${h}V${r}Q0,0 ${r},0H${w - r}Q${w},0 ${w},${r}V${h}Z`; };

  function hbar(el, rows, { color = () => 'var(--s1)', total = null, labelW = 150, tipFn = null } = {}) {
    const W = el.clientWidth || 480, bh = 16, gap = 6, valW = total ? 100 : 56;
    const H = rows.length * (bh + gap);
    const max = d3.max(rows, r => r.value) || 1;
    const x = d3.scaleLinear([0, max], [0, Math.max(30, W - labelW - valW)]);
    const maxChars = Math.floor((labelW - 10) / 6.4);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const g = svg.selectAll('g').data(rows).join('g').attr('transform', (d, i) => `translate(0,${i * (bh + gap)})`);
    g.append('text').attr('class', 'barlbl').attr('x', labelW - 8).attr('y', bh / 2).attr('dy', '0.35em')
      .attr('text-anchor', 'end').text(d => (d.label.length > maxChars ? d.label.slice(0, maxChars - 1) + '…' : d.label));
    g.append('path').attr('transform', `translate(${labelW},0)`).attr('d', d => barH(Math.max(2, x(d.value)), bh))
      .attr('fill', d => color(d));
    g.append('text').attr('class', 'val').attr('x', d => labelW + Math.max(2, x(d.value)) + 6).attr('y', bh / 2).attr('dy', '0.35em')
      .text(d => fmt(d.value) + (total ? `  ·  ${pct(d.value, total)}` : ''));
    g.append('rect').attr('width', W).attr('height', bh + gap).attr('y', -gap / 2).attr('fill', 'transparent')
      .on('mousemove', (ev, d) => showTip(ev, tipFn ? tipFn(d) : `<b>${esc(d.label)}</b>${fmt(d.value)}${total ? ' · ' + pct(d.value, total) : ''}`))
      .on('mouseleave', hideTip);
  }

  function columns(el, rows, { height = 200, color = () => 'var(--s1)', every = 1, tipFn = null, yFmt = fmt } = {}) {
    const W = el.clientWidth || 480, m = { l: 44, r: 6, t: 8, b: 24 };
    const x = d3.scaleBand(rows.map(r => r.label), [m.l, W - m.r]).paddingInner(rows.length > 40 ? 0.12 : 0.22);
    const y = d3.scaleLinear([0, d3.max(rows, r => r.value) || 1], [height - m.b, m.t]).nice();
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${height}`).attr('height', height);
    const ticks = y.ticks(4);
    svg.append('g').selectAll('line').data(ticks).join('line').attr('class', 'gridline')
      .attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(ticks).join('text').attr('class', 'lbl')
      .attr('x', m.l - 6).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'end').text(yFmt);
    svg.append('g').selectAll('path').data(rows).join('path')
      .attr('transform', d => `translate(${x(d.label)},${y(d.value)})`)
      .attr('d', d => (d.value > 0 ? barV(x.bandwidth(), y(0) - y(d.value), Math.min(4, x.bandwidth() / 2)) : ''))
      .attr('fill', d => color(d));
    svg.append('g').selectAll('text').data(rows.filter((d, i) => i % every === 0)).join('text').attr('class', 'lbl')
      .attr('x', d => x(d.label) + x.bandwidth() / 2).attr('y', height - 6).attr('text-anchor', 'middle').text(d => d.label);
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--axis)');
    const step = x.step();
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', d => x(d.label) - (step - x.bandwidth()) / 2).attr('width', step).attr('y', m.t).attr('height', height - m.t - m.b)
      .attr('fill', 'transparent')
      .on('mousemove', (ev, d) => showTip(ev, tipFn ? tipFn(d) : `<b>${esc(d.label)}</b>${fmt(d.value)}`))
      .on('mouseleave', hideTip);
  }

  function stacked100(el, buckets, keys, colorOf, height = 240) {
    const W = el.clientWidth || 600, m = { l: 40, r: 6, t: 6, b: 34 };
    const legend = d3.select(el).append('div').attr('class', 'legend');
    keys.forEach(k => legend.append('span').html(`<i style="background:${colorOf(k)}"></i>${esc(k)}`));
    const x = d3.scaleBand(buckets.map(b => b.label), [m.l, W - m.r]).paddingInner(0.18);
    const y = d3.scaleLinear([0, 1], [height - m.b, m.t]);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${height}`).attr('height', height);
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
      svg.append('text').attr('class', 'lbl').attr('x', m.l - 6).attr('y', y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').text(`${t * 100} %`);
    });
    buckets.forEach(b => {
      const total = d3.sum(keys, k => b.counts[k] || 0) || 1;
      let acc = 0;
      keys.forEach(k => {
        const v = b.counts[k] || 0;
        if (!v) return;
        const y0 = y(acc / total), y1 = y((acc + v) / total);
        acc += v;
        svg.append('rect').attr('x', x(b.label)).attr('width', x.bandwidth()).attr('y', y1).attr('height', Math.max(0, y0 - y1))
          .attr('fill', colorOf(k)).attr('stroke', 'var(--surface-1)').attr('stroke-width', 1)
          .on('mousemove', ev => showTip(ev, `<b>${esc(k)}</b>${esc(b.label)}: ${fmt(v)} Songs · ${pct(v, total)}`))
          .on('mouseleave', hideTip);
      });
    });
    const every = Math.ceil(buckets.length / Math.max(4, Math.floor(W / 70)));
    buckets.forEach((b, i) => {
      if (i % every) return;
      svg.append('text').attr('class', 'lbl').attr('x', x(b.label) + x.bandwidth() / 2).attr('y', height - 18).attr('text-anchor', 'middle').text(b.label);
    });
  }

  function heatmap(el, matrix) {
    const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const W = el.clientWidth || 600, m = { l: 28, r: 4, t: 4, b: 22 };
    const cw = (W - m.l - m.r) / 24, ch = Math.min(26, Math.max(16, cw * 0.8)), H = m.t + ch * 7 + m.b;
    const max = d3.max(matrix.flat()) || 1;
    const steps = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6', '--seq-7'];
    const q = v => (v === 0 ? 'var(--seq-0)' : `var(${steps[Math.min(6, Math.floor((v / max) * 7))]})`);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    matrix.forEach((row, d) => {
      svg.append('text').attr('class', 'lbl').attr('x', m.l - 6).attr('y', m.t + d * ch + ch / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(days[d]);
      row.forEach((v, h) => {
        svg.append('rect').attr('x', m.l + h * cw + 1).attr('y', m.t + d * ch + 1).attr('width', cw - 2).attr('height', ch - 2).attr('rx', 3)
          .attr('fill', q(v))
          .on('mousemove', ev => showTip(ev, `<b>${days[d]}, ${h}–${h + 1} Uhr</b>${fmt(v)} Wiedergaben`))
          .on('mouseleave', hideTip);
      });
    });
    for (let h = 0; h < 24; h += 3) {
      svg.append('text').attr('class', 'lbl').attr('x', m.l + h * cw + cw / 2).attr('y', H - 6).attr('text-anchor', 'middle').text(`${h} h`);
    }
    const lg = d3.select(el).append('div').attr('class', 'legend');
    lg.append('span').html('wenig');
    steps.forEach(s => lg.append('i').style('background', `var(${s})`).style('width', '18px').style('height', '10px').style('border-radius', '2px'));
    lg.append('span').html(`viel (max. ${fmt(max)})`);
  }

  function hstack100(el, rows, keys, colorOf, labelW = 200) {
    const legend = d3.select(el).append('div').attr('class', 'legend');
    keys.forEach(k => legend.append('span').html(`<i style="background:${colorOf(k)}"></i>${esc(k)}`));
    const W = el.clientWidth || 600, bh = 18, gap = 8, valW = 70, H = rows.length * (bh + gap);
    const x = d3.scaleLinear([0, 1], [labelW, Math.max(labelW + 40, W - valW)]);
    const maxChars = Math.floor((labelW - 10) / 6.4);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    rows.forEach((r, i) => {
      const g = svg.append('g').attr('transform', `translate(0,${i * (bh + gap)})`);
      g.append('text').attr('class', 'barlbl').attr('x', labelW - 8).attr('y', bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
        .text(r.label.length > maxChars ? r.label.slice(0, maxChars - 1) + '…' : r.label);
      const total = d3.sum(keys, k => r.counts[k] || 0) || 1;
      let acc = 0;
      keys.forEach(k => {
        const v = r.counts[k] || 0;
        if (!v) return;
        g.append('rect').attr('x', x(acc / total)).attr('width', Math.max(0, x((acc + v) / total) - x(acc / total))).attr('height', bh)
          .attr('fill', colorOf(k)).attr('stroke', 'var(--surface-1)').attr('stroke-width', 1)
          .on('mousemove', ev => showTip(ev, `<b>${esc(k)}</b>${esc(r.label)}: ${fmt(v)} Songs · ${pct(v, total)}`))
          .on('mouseleave', hideTip);
        acc += v;
      });
      g.append('text').attr('class', 'val').attr('x', x(1) + 8).attr('y', bh / 2).attr('dy', '0.35em').text(r.sub);
    });
  }

  // ---------- Übersicht ----------
  function initOverview() {
    const root = document.getElementById('overview');
    function render() {
      root.innerHTML = '';
      const kp = [
        [fmt(S.songs), 'Liked Songs', [
          S.cleanup?.declared && S.cleanup.declared !== S.songs ? `YT Music meldet ${fmt(S.cleanup.declared)}` : '',
          S.cleanup?.duplicates_removed ? `${fmt(S.cleanup.duplicates_removed)} Duplikate entfernt` : '',
          S.unavailable ? `${fmt(S.unavailable)} nicht verfügbar` : ''].filter(Boolean).join(' · ')],
        [`${fmt(Math.round(S.total_duration_s / 3600))} h`, 'Gesamtlänge',
          S.sets ? `davon ${fmt(Math.round(S.sets_duration_s / 3600))} h in ${fmt(S.sets)} DJ-Sets · Song-Ø ${dur(S.avg_duration_s)}` : `Ø ${dur(S.avg_duration_s)} pro Song`],
        [fmt(S.artists), 'Künstler', `${pctv(S.single_song_artist_pct)} nur mit einem Song`],
        [fmt(S.albums), 'Alben', ''],
        [pctv(S.top10_artist_pct), 'Anteil Top-10-Künstler', 'an allen Songs'],
        [S.median_year ?? '–', 'Median-Erscheinungsjahr', `Jahr bekannt bei ${pctv(S.year_known_pct)}`],
        [pctv(S.explicit_pct), 'Explicit', ''],
        [pctv(S.collab_pct), 'Kollaborationen', 'Songs mit mehreren Künstlern'],
        [compact(S.median_subs), 'Mainstream-Index', 'Median-Abonnenten des Hauptkünstlers'],
        [pctv(S.genre_known_pct), 'Genre zugeordnet', 'Datenabdeckung'],
      ];
      const P = S.plays;
      if (P) {
        kp.push([fmt(P.total), 'Wiedergaben', `${P.first} bis ${P.last}`],
          [`~${fmt(P.est_hours)} h`, 'Hörzeit (geschätzt)', 'Wiedergaben × Ø-Länge'],
          [`${fmt(P.best_streak_days)} Tage`, 'Längste Hör-Serie', `${fmt(P.active_days)} aktive Tage`],
          [pctv(P.liked_share_pct), 'Anteil Liked Songs', 'an allen Wiedergaben']);
      }
      const k = d3.select(root).append('div').attr('class', 'kpis');
      kp.forEach(([v, l, s]) => k.append('div').attr('class', 'kpi').html(`<div class="v">${esc(v)}</div><div class="l">${esc(l)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}`));

      const grid = d3.select(root).append('div').attr('class', 'grid');
      const card = (title, sub, wide = false) => {
        const c = grid.append('div').attr('class', 'card' + (wide ? ' wide' : ''));
        c.append('h2').text(title);
        if (sub) c.append('p').attr('class', 'sub').text(sub);
        return c.append('div').node();
      };

      hbar(card('Genres', 'Songs nach Genre des Hauptkünstlers'), S.genres.map(([g, v]) => ({ label: g, value: v })),
        { color: d => genreVar(d.label), total: S.songs, labelW: 130 });
      hbar(card('Mainstream oder Underground?', 'Songs nach Abonnenten des Hauptkünstlers auf YouTube'),
        S.subs_buckets.map(([l, v]) => ({ label: l, value: v })), { total: d3.sum(S.subs_buckets, d => d[1]), labelW: 120 });

      if (S.evolution.buckets.length) {
        const keys = GENRE_KEYS.filter(g => S.evolution.buckets.some(b => b.counts[g]));
        stacked100(card('Wie sich dein Geschmack verändert hat', `Genre-Anteile je ${S.evolution.mode}`, true),
          S.evolution.buckets, keys, genreVar);
      }

      if (S.playlists && S.playlists.length) {
        hstack100(card('Was in deinen Playlists steckt',
          `Stil-Mix der Liked Songs je eigener Playlist · rechts: Liked Songs / Einträge gesamt · ${fmt(S.in_playlist)} von ${fmt(S.songs)} Likes stecken in mindestens einer Playlist`, true),
          S.playlists.map(p => ({ label: p.name, sub: `${fmt(p.liked)} / ${fmt(p.total)}`, counts: p.counts })),
          GENRE_KEYS.filter(g => S.playlists.some(p => p.counts[g])), genreVar);
      }

      hbar(card('Top 30 Künstler', 'Anzahl Liked Songs als Hauptkünstler, Farbe = Genre'),
        S.top_artists.map(([n, v, g]) => ({ label: n, value: v, g })), { color: d => genreVar(d.g), labelW: 150 });
      hbar(card('Top-Tags', 'Häufigste Genre-Tags (Last.fm/MusicBrainz), gezählt pro Song'),
        S.tags.map(([n, v]) => ({ label: n, value: v })), { labelW: 150 });

      if (S.years.length) {
        const ys = S.years.map(d => d[0]);
        const all = d3.range(d3.min(ys), d3.max(ys) + 1);
        const map = new Map(S.years);
        columns(card('Erscheinungsjahre', `Songs pro Jahr · Jahrzehnte: ${S.decades.map(([d, v]) => `${d} ${fmt(v)}`).join(' · ')}`, true),
          all.map(y => ({ label: String(y), value: map.get(y) || 0 })),
          { every: Math.ceil(all.length / 16), tipFn: d => `<b>${d.label}</b>${fmt(d.value)} Songs` });
      }

      columns(card('Songlängen', `Verteilung in 30-Sekunden-Schritten · Median ${dur(S.median_duration_s)}${S.sets ? ` · ohne ${fmt(S.sets)} DJ-Sets über 20 min` : ''}`),
        S.duration_hist.map(([s, v]) => ({ label: s >= 600 ? '10+' : dur(s), value: v })),
        { every: 2, tipFn: d => `<b>${d.label}${d.label === '10+' ? ' min' : ''}</b>${fmt(d.value)} Songs` });
      hbar(card('Herkunft der Künstler', 'Songs nach Land des Hauptkünstlers (MusicBrainz)'),
        S.countries.map(([c, v]) => ({ label: c === '?' ? 'unbekannt' : c, value: v })), { total: S.songs, labelW: 80 });

      hbar(card('Versionen im Titel', 'Remix, Sped up, Live … (Treffer im Songtitel)'),
        S.versions.map(([n, v]) => ({ label: n, value: v })), { total: S.songs, labelW: 100 });
      hbar(card('Art des Eintrags', 'Song = Audio-Track, Musikvideo, Upload = von Nutzern hochgeladen'),
        S.types.map(([n, v]) => ({ label: n, value: v })), { total: S.songs, labelW: 100 });

      const pairs = card('Häufigste Kollaborationen', 'Künstlerpaare mit den meisten gemeinsamen Songs');
      pairs.innerHTML = S.top_pairs.length
        ? '<ol class="list">' + S.top_pairs.map(([a, b, c]) => `<li>${esc(a)} × ${esc(b)} <span class="n">${fmt(c)}</span></li>`).join('') + '</ol>'
        : '<p class="sub">Keine Songs mit mehreren Künstlern.</p>';
      const old = card('Älteste Songs', 'Nach Erscheinungsjahr des Albums');
      old.innerHTML = '<ol class="list">' + S.oldest.map(([t, a, y]) => `<li>${esc(t)} – ${esc(a)} <span class="n">${y}</span></li>`).join('') + '</ol>';

      const w = card('Deine Musik-Welten', 'Automatisch gefundene Cluster im Künstler-Netzwerk (Louvain), benannt nach den häufigsten Tags', true);
      w.innerHTML = '<div class="worlds">' + COMMS.filter(c => c.artists > 1).slice(0, 12).map(c =>
        `<div class="world" style="border-left-color:${commVar(c.id)}"><b>${esc(c.name)}</b><small>${fmt(c.songs)} Songs · ${fmt(c.artists)} Künstler · überwiegend ${esc(c.genre)}</small><div>${c.top.map(esc).join(', ')}</div></div>`).join('') + '</div>';

      if (P) {
        d3.select(root).append('h3').attr('class', 'sec').text('Hörverhalten (aus Google Takeout)');
        const g2 = d3.select(root).append('div').attr('class', 'grid');
        const card2 = (title, sub, wide = false) => {
          const c = g2.append('div').attr('class', 'card' + (wide ? ' wide' : ''));
          c.append('h2').text(title);
          if (sub) c.append('p').attr('class', 'sub').text(sub);
          return c.append('div').node();
        };
        columns(card2('Wiedergaben pro Monat', `Aktivster Tag: ${P.busiest_day[0]} mit ${fmt(P.busiest_day[1])} Wiedergaben`, true),
          P.months.map(([mo, v]) => ({ label: mo, value: v })), { every: Math.ceil(P.months.length / 12) });
        heatmap(card2('Wann du hörst', 'Wiedergaben nach Wochentag und Uhrzeit (deutsche Zeit)', true), P.heatmap);
        const ts = card2('Meistgespielt', '★ = in deinen Liked Songs');
        ts.innerHTML = '<ol class="list">' + P.top_songs.map(([t, a, c, l]) => `<li>${l ? '★ ' : ''}${esc(t)} – ${esc(a)} <span class="n">${fmt(c)}×</span></li>`).join('') + '</ol>';
        const nl = card2('Oft gespielt, aber nicht geliked', 'Kandidaten für deine Liste');
        nl.innerHTML = '<ol class="list">' + P.top_not_liked.map(([t, a, c]) => `<li>${esc(t)} – ${esc(a)} <span class="n">${fmt(c)}×</span></li>`).join('') + '</ol>';
        hbar(card2('Meistgehörte Künstler', 'Nach Wiedergaben (alle Songs, nicht nur Liked)'),
          P.top_artists.map(([n, v]) => ({ label: n, value: v })), { labelW: 150 });
        const nv = card2('Nie gespielt', 'Liked Songs ohne Wiedergabe im Verlaufszeitraum');
        nv.innerHTML = `<div class="kpi" style="border:0;padding:0"><div class="v">${fmt(P.liked_never_played)}</div><div class="l">von ${fmt(S.songs)} Liked Songs (${pct(P.liked_never_played, S.songs)})</div><div class="s">Hinweis: YT Music spielt manchmal eine andere Version (Video statt Audio) mit eigener ID ab. Die Zahl ist daher eine Obergrenze.</div></div>`;
      } else {
        card('Hörverhalten fehlt noch', 'Mit Google Takeout kommen Wiedergaben, Hörzeiten und Like-Daten dazu (README, Schritt 4).', true);
      }
    }
    render();
    return { refresh: render, retheme: () => {} };
  }

  // ---------- Netzwerk-Map ----------
  function initNetwork() {
    const stage = document.getElementById('netStage');
    const canvas = document.getElementById('net');
    const ctx = canvas.getContext('2d');
    const detail = document.getElementById('netDetail');
    let W = 0, H = 0, dpr = 1;
    let colorBy = 'genre', minSongs = 1, highlight = null, selected = null, hover = null;
    let show = { f: true, r: true, t: false };
    let transform = d3.zoomIdentity;
    let pal = {};

    const nodes = A.map((a, i) => ({ i, ...a, r: 3 + Math.sqrt(a.c) * 3.2 }));
    const allEdges = D.edges.map(([s, t, f, r, tg]) => ({ s, t, f, r, tg }));
    const R = 140 + Math.sqrt(nodes.length) * 12;
    const anchors = COMMS.slice(0, 8).map((c, i) => {
      const ang = (i / Math.min(8, COMMS.length)) * 2 * Math.PI - Math.PI / 2;
      return { x: Math.cos(ang) * R * 0.75, y: Math.sin(ang) * R * 0.75 };
    });
    const anchorOf = n => anchors[n.cm] || { x: 0, y: 0 };
    nodes.forEach(n => { const a = anchorOf(n); n.x = a.x + (Math.random() - 0.5) * 80; n.y = a.y + (Math.random() - 0.5) * 80; });

    function palette() {
      pal = {
        surface: css('--surface-1'), text: css('--text-primary'), text2: css('--text-secondary'), muted: css('--muted'),
        other: css('--other'), unknown: css('--unknown'), s: d3.range(1, 9).map(i => css(`--s${i}`)),
      };
    }
    const colorOf = n => {
      if (colorBy === 'genre') { const i = GENRES.indexOf(n.g); return i >= 0 ? pal.s[i] : n.g === UNKNOWN ? pal.unknown : pal.other; }
      if (colorBy === 'playlist') return n.pl >= 0 && n.pl < 8 ? pal.s[n.pl] : pal.other;
      return n.cm >= 0 && n.cm < 8 ? pal.s[n.cm] : pal.other;
    };
    const groupOf = n => (colorBy === 'genre' ? collapse(n.g)
      : colorBy === 'playlist' ? (n.pl >= 0 && n.pl < 8 ? n.pl : 'other')
      : (n.cm >= 0 && n.cm < 8 ? n.cm : 'other'));

    let vnodes = [], vlinks = [], adj = new Map();
    const sim = d3.forceSimulation()
      .force('charge', d3.forceManyBody().strength(n => -24 - n.r * 4).distanceMax(450))
      .force('collide', d3.forceCollide(n => n.r + 4))
      .force('x', d3.forceX(n => anchorOf(n).x).strength(0.035))
      .force('y', d3.forceY(n => anchorOf(n).y).strength(0.035))
      .force('link', d3.forceLink().distance(l => (l.f ? 26 : l.r ? 46 : 64)).strength(l => (l.f ? 0.5 : l.r ? 0.22 : 0.08)))
      .alphaDecay(0.03)
      .on('tick', () => {
        if (!fitted && sim.alpha() < 0.2) { fitted = true; fit(); }
        draw();
      });
    let fitted = false;

    function fit(duration = 750) {
      if (!vnodes.length) return;
      const panelW = W > 860 ? 270 : 0;
      const x0 = d3.min(vnodes, n => n.x - n.r), x1 = d3.max(vnodes, n => n.x + n.r);
      const y0 = d3.min(vnodes, n => n.y - n.r), y1 = d3.max(vnodes, n => n.y + n.r);
      const k = Math.min((W - panelW - 80) / (x1 - x0 || 1), (H - 80) / (y1 - y0 + 40 || 1), 4);
      const t = d3.zoomIdentity.translate(panelW + (W - panelW) / 2 - ((x0 + x1) / 2) * k, H / 2 - ((y0 + y1) / 2) * k).scale(k);
      d3.select(canvas).transition().duration(duration).call(zoom.transform, t);
    }

    function rebuild() {
      vnodes = nodes.filter(n => n.c >= minSongs);
      const vis = new Set(vnodes.map(n => n.i));
      vlinks = allEdges.filter(e => vis.has(e.s) && vis.has(e.t) && ((show.f && e.f) || (show.r && e.r) || (show.t && e.tg)))
        .map(e => ({ source: nodes[e.s], target: nodes[e.t], f: e.f, r: e.r, tg: e.tg }));
      adj = new Map(vnodes.map(n => [n, []]));
      vlinks.forEach(l => { adj.get(l.source).push(l.target); adj.get(l.target).push(l.source); });
      sim.nodes(vnodes);
      sim.force('link').links(vlinks);
      sim.alpha(0.6).restart();
      legend();
    }

    function resize() {
      W = stage.clientWidth; H = stage.clientHeight; dpr = devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr;
      draw();
    }

    function draw() {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pal.surface;
      ctx.fillRect(0, 0, W, H);
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);
      const k = transform.k;
      const focus = selected || hover;
      const nb = focus ? new Set(adj.get(focus) || []) : null;

      ctx.lineWidth = 0.8 / k;
      for (const l of vlinks) {
        const on = focus && (l.source === focus || l.target === focus);
        ctx.globalAlpha = focus ? (on ? 0.75 : 0.03) : (l.f ? 0.35 : 0.14);
        ctx.strokeStyle = on ? pal.text : l.f ? pal.text2 : pal.muted;
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
      }
      ctx.lineWidth = 1.5 / k;
      ctx.strokeStyle = pal.surface;
      for (const n of vnodes) {
        const dim = (focus && n !== focus && !nb.has(n)) || (highlight !== null && groupOf(n) !== highlight);
        ctx.globalAlpha = dim ? 0.12 : 1;
        ctx.fillStyle = colorOf(n);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      if (selected) {
        ctx.globalAlpha = 1; ctx.lineWidth = 2.5 / k; ctx.strokeStyle = pal.text;
        ctx.beginPath(); ctx.arc(selected.x, selected.y, selected.r + 3 / k, 0, 2 * Math.PI); ctx.stroke();
      }
      // Beschriftungen in konstanter Bildschirmgröße
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${11 / k}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.lineJoin = 'round';
      for (const n of vnodes) {
        const important = n === focus || (nb && nb.has(n));
        if (!important && (focus || n.r * k < 9)) continue;
        if (highlight !== null && groupOf(n) !== highlight && !important) continue;
        ctx.globalAlpha = 1;
        const y = n.y + n.r + 8 / k;
        ctx.lineWidth = 3 / k; ctx.strokeStyle = pal.surface; ctx.strokeText(n.n, n.x, y);
        ctx.fillStyle = important ? pal.text : pal.text2; ctx.fillText(n.n, n.x, y);
      }
      // Namen der Musik-Welten in der Übersicht
      if (!focus && k < 1.3) {
        ctx.font = `600 ${14 / k}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        COMMS.slice(0, 8).forEach((c, i) => {
          const mem = vnodes.filter(n => n.cm === i);
          if (mem.length < 3) return;
          const cx = d3.mean(mem, n => n.x), cy = d3.min(mem, n => n.y) - 18 / k;
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 4 / k; ctx.strokeStyle = pal.surface; ctx.strokeText(c.name, cx, cy);
          ctx.fillStyle = pal.text; ctx.fillText(c.name, cx, cy);
        });
      }
      ctx.globalAlpha = 1;
    }

    function nodeAt(px, py) {
      const [x, y] = transform.invert([px, py]);
      let best = null, bd = Infinity;
      for (const n of vnodes) {
        const d = Math.hypot(n.x - x, n.y - y) - n.r;
        if (d < bd) { bd = d; best = n; }
      }
      return bd < 4 / transform.k ? best : null;
    }

    function legend() {
      const el = document.getElementById('netLegend');
      let items;
      if (colorBy === 'genre') {
        const cnt = d3.rollup(vnodes, v => v.length, n => collapse(n.g));
        items = GENRE_KEYS.filter(g => cnt.get(g)).map(g => ({ key: g, label: g, n: cnt.get(g), color: genreVar(g) }));
      } else if (colorBy === 'playlist') {
        const cnt = d3.rollup(vnodes, v => v.length, n => (n.pl >= 0 && n.pl < 8 ? n.pl : 'other'));
        items = PLS.slice(0, 8).map((name, i) => ({ key: i, label: name, n: cnt.get(i), color: plVar(i) })).filter(it => it.n);
        if (cnt.get('other')) items.push({ key: 'other', label: 'Weitere / ohne Playlist', n: cnt.get('other'), color: 'var(--other)' });
      } else {
        const cnt = d3.rollup(vnodes, v => v.length, n => (n.cm >= 0 && n.cm < 8 ? n.cm : 'other'));
        items = COMMS.slice(0, 8).filter(c => cnt.get(c.id)).map(c => ({ key: c.id, label: c.name, n: cnt.get(c.id), color: commVar(c.id) }));
        if (cnt.get('other')) items.push({ key: 'other', label: 'Weitere / Einzelgänger', n: cnt.get('other'), color: 'var(--other)' });
      }
      el.innerHTML = '';
      items.forEach(it => {
        const s = document.createElement('span');
        s.className = highlight !== null && highlight !== it.key ? 'off' : '';
        s.innerHTML = `<i style="background:${it.color}"></i>${esc(it.label)} <span style="color:var(--muted)">${fmt(it.n)}</span>`;
        s.onclick = () => { highlight = highlight === it.key ? null : it.key; legend(); draw(); };
        el.appendChild(s);
      });
    }

    function select(n, center = false) {
      selected = n;
      if (!n) { detail.hidden = true; draw(); return; }
      const nbs = (adj.get(n) || []).slice().sort((a, b) => b.c - a.c);
      const links = vlinks.filter(l => l.source === n || l.target === n);
      const kind = o => {
        const l = links.find(l => l.source === o || l.target === o);
        return [l.f ? `${l.f}× Feature` : '', l.r ? 'verwandt' : '', l.tg ? 'ähnliche Tags' : ''].filter(Boolean).join(', ');
      };
      const songs = songsByArtist[n.i].map(i => SONGS[i]).sort((a, b) => b.p - a.p || a.o - b.o);
      detail.innerHTML = `
        <h4>${esc(n.n)}</h4>
        <div class="m" style="color:var(--text-secondary)">${fmt(n.c)} Liked Songs · ${esc(n.g)}${n.co ? ' · ' + esc(n.co) : ''}</div>
        <div style="color:var(--muted);margin-top:2px">${n.s != null ? compact(n.s) + ' Abonnenten' : ''}${n.p ? ' · ' + fmt(n.p) + ' Wiedergaben' : ''}</div>
        <div style="margin-top:6px">${n.t.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        ${n.cm >= 0 && COMMS[n.cm] ? `<div class="hint">Musik-Welt: <b>${esc(COMMS[n.cm].name)}</b></div>` : ''}
        <label>Verbindungen (${nbs.length})</label>
        <ul>${nbs.slice(0, 25).map(o => `<li><a data-i="${o.i}">${esc(o.n)}</a> <span style="color:var(--muted)">${kind(o)}</span></li>`).join('') || '<li style="color:var(--muted)">keine</li>'}</ul>
        <label>Songs (${songs.length})</label>
        <ul>${songs.slice(0, 40).map(s => `<li>${esc(s.t)}${s.y ? ` <span style="color:var(--muted)">${s.y}</span>` : ''}${s.p ? ` <span style="color:var(--muted)">· ${fmt(s.p)}×</span>` : ''}</li>`).join('')}</ul>
        <button class="btn" id="netClose">Schließen</button>`;
      detail.hidden = false;
      detail.querySelectorAll('a[data-i]').forEach(a => a.onclick = () => select(nodes[+a.dataset.i], true));
      detail.querySelector('#netClose').onclick = () => select(null);
      if (center) {
        const k = Math.max(transform.k, 1.6);
        d3.select(canvas).transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - n.x * k, H / 2 - n.y * k).scale(k));
      }
      draw();
    }

    const zoom = d3.zoom().scaleExtent([0.08, 10]).on('zoom', e => { transform = e.transform; draw(); });
    const drag = d3.drag()
      .subject(ev => { const n = nodeAt(ev.x, ev.y); return n ? { n, x: transform.applyX(n.x), y: transform.applyY(n.y) } : null; })
      .on('start', ev => { if (!ev.active) sim.alphaTarget(0.25).restart(); ev.subject.n.fx = ev.subject.n.x; ev.subject.n.fy = ev.subject.n.y; })
      .on('drag', ev => { ev.subject.n.fx = transform.invertX(ev.x); ev.subject.n.fy = transform.invertY(ev.y); })
      .on('end', ev => { if (!ev.active) sim.alphaTarget(0); ev.subject.n.fx = null; ev.subject.n.fy = null; });
    d3.select(canvas).call(drag).call(zoom).on('dblclick.zoom', null);
    canvas.addEventListener('mousemove', ev => {
      const n = nodeAt(ev.offsetX, ev.offsetY);
      canvas.style.cursor = n ? 'pointer' : 'grab';
      if (n !== hover) { hover = n; if (sim.alpha() < sim.alphaMin()) draw(); }
      if (n) showTip(ev, `<b>${esc(n.n)}</b><span class="m">${fmt(n.c)} Songs · ${esc(n.g)}${n.p ? ' · ' + fmt(n.p) + ' Plays' : ''}</span>`);
      else hideTip();
    });
    canvas.addEventListener('mouseleave', () => { hover = null; hideTip(); draw(); });
    canvas.addEventListener('click', ev => select(nodeAt(ev.offsetX, ev.offsetY)));

    // Steuerung
    const dl = document.getElementById('artistList');
    dl.innerHTML = A.map(a => a).sort((a, b) => b.c - a.c).map(a => `<option value="${esc(a.n)}">`).join('');
    const search = document.getElementById('netSearch');
    search.addEventListener('change', () => {
      const q = search.value.trim().toLowerCase();
      const n = nodes.find(n => n.n.toLowerCase() === q) || nodes.find(n => n.n.toLowerCase().includes(q));
      if (!n) return;
      if (n.c < minSongs) { minSongs = 1; slider.value = 1; document.getElementById('netMinV').textContent = 1; rebuild(); }
      select(n, true);
    });
    document.getElementById('netColor').addEventListener('change', e => { colorBy = e.target.value; highlight = null; legend(); draw(); });
    [['eFeat', 'f'], ['eRel', 'r'], ['eTag', 't']].forEach(([id, key]) =>
      document.getElementById(id).addEventListener('change', e => { show[key] = e.target.checked; rebuild(); }));
    const slider = document.getElementById('netMin');
    slider.max = Math.max(2, Math.min(10, d3.max(A, a => a.c)));
    // Bei sehr großen Sammlungen standardmäßig ausdünnen
    if (A.length > 1500) { minSongs = 2; slider.value = 2; }
    document.getElementById('netMinV').textContent = minSongs;
    slider.addEventListener('input', () => { minSongs = +slider.value; document.getElementById('netMinV').textContent = minSongs; if (selected && selected.c < minSongs) select(null); rebuild(); });

    palette();
    resize();
    const k0 = Math.min(W, H) / (2 * (R + 120));
    transform = d3.zoomIdentity.translate(W / 2, H / 2).scale(k0);
    d3.select(canvas).call(zoom.transform, transform);
    rebuild();
    document.getElementById('netFit').addEventListener('click', () => fit());
    return { refresh: () => { resize(); }, retheme: () => { palette(); draw(); } };
  }

  // ---------- Bubble-Map (Circle Packing) ----------
  function initPack() {
    const stage = document.getElementById('packStage');
    const svg = d3.select('#pack');
    const crumb = document.getElementById('crumb');
    let groupBy = 'genre', sizeBy = 'count', focus, view, root, W, H;

    const value = s => (sizeBy === 'plays' ? Math.max(s.p, 0.3) : sizeBy === 'dur' ? (s.d || 180) : 1);
    const commOfSong = s => (s.a.length ? A[s.a[0]].cm : -1);

    function hierarchy() {
      const groups = d3.group(SONGS, s => (groupBy === 'genre' ? s.g : groupBy === 'playlist' ? songPl(s)
        : (commOfSong(s) >= 0 && commOfSong(s) < 12 ? commOfSong(s) : 'other')));
      const children = [...groups].map(([key, ss]) => {
        const color = groupBy === 'genre' ? genreVar(key) : groupBy === 'playlist' ? plVar(key) : commVar(key === 'other' ? -1 : key);
        const name = groupBy === 'genre' ? key : groupBy === 'playlist' ? (key >= 0 ? PLS[key] : 'Ohne Playlist')
          : key === 'other' ? 'Weitere Welten' : COMMS[key].name;
        const byArtist = d3.group(ss, s => (s.a.length ? s.a[0] : -1));
        return {
          name, kind: 'group', color,
          children: [...byArtist].map(([ai, list]) => ({
            name: ai >= 0 ? A[ai].n : 'Unbekannt', kind: 'artist', ai, color,
            children: list.map(s => ({ name: s.t, kind: 'song', song: s, color })),
          })),
        };
      });
      return { name: 'Alle Liked Songs', kind: 'root', children };
    }

    function legend() {
      const el = document.getElementById('packLegend');
      if (groupBy === 'genre') {
        const cnt = d3.rollup(SONGS, v => v.length, s => collapse(s.g));
        el.innerHTML = GENRE_KEYS.filter(g => cnt.get(g)).map(g => `<span><i style="background:${genreVar(g)}"></i>${esc(g)} <span style="color:var(--muted)">${fmt(cnt.get(g))}</span></span>`).join('');
      } else if (groupBy === 'playlist') {
        const cnt = d3.rollup(SONGS, v => v.length, songPl);
        el.innerHTML = PLS.slice(0, 8).map((name, i) => `<span><i style="background:${plVar(i)}"></i>${esc(name)} <span style="color:var(--muted)">${fmt(cnt.get(i) || 0)}</span></span>`).join('')
          + `<span><i style="background:var(--other)"></i>Weitere / ohne Playlist <span style="color:var(--muted)">${fmt(SONGS.length - d3.sum(PLS.slice(0, 8), (n, i) => cnt.get(i) || 0))}</span></span>`;
      } else {
        el.innerHTML = COMMS.slice(0, 8).map(c => `<span><i style="background:${commVar(c.id)}"></i>${esc(c.name)}</span>`).join('') + '<span><i style="background:var(--other)"></i>Weitere</span>';
      }
    }

    function render() {
      W = stage.clientWidth; H = stage.clientHeight;
      svg.selectAll('*').remove();
      svg.attr('viewBox', `${-W / 2} ${-H / 2} ${W} ${H}`);
      root = d3.pack().size([W, H]).padding(d => (d.depth === 0 ? 10 : d.depth === 1 ? 5 : 1.5))(
        d3.hierarchy(hierarchy()).sum(d => (d.kind === 'song' ? value(d.song) : 0)).sort((a, b) => b.value - a.value));
      focus = root;
      svg.append('rect').attr('x', -W / 2).attr('y', -H / 2).attr('width', W).attr('height', H).attr('fill', 'var(--surface-1)')
        .on('click', () => zoomTo(focus.parent || root));
      const node = svg.append('g').selectAll('circle').data(root.descendants().slice(1)).join('circle')
        .attr('fill', d => d.data.color)
        .attr('fill-opacity', d => (d.depth === 1 ? 0.10 : d.depth === 2 ? 0.22 : 0.9))
        .attr('stroke', d => (d.depth < 3 ? d.data.color : 'var(--surface-1)'))
        .attr('stroke-opacity', d => (d.depth === 1 ? 0.6 : d.depth === 2 ? 0.45 : 1))
        .attr('stroke-width', d => (d.depth === 3 ? 0.75 : 1))
        .style('cursor', 'pointer')
        .on('mousemove', (ev, d) => showTip(ev, tipHtml(d)))
        .on('mouseleave', hideTip)
        .on('click', (ev, d) => { ev.stopPropagation(); zoomTo(d.depth === 3 ? d.parent : focus === d ? (d.parent || root) : d); });
      const label = svg.append('g').attr('pointer-events', 'none').attr('text-anchor', 'middle')
        .style('font', '12px system-ui, -apple-system, "Segoe UI", sans-serif')
        .selectAll('text').data(root.descendants().slice(1)).join('text')
        .style('fill', 'var(--text-primary)').style('paint-order', 'stroke').style('stroke', 'var(--surface-1)')
        .style('stroke-width', '3px').style('stroke-linejoin', 'round')
        .style('font-weight', d => (d.depth === 1 ? 650 : 400))
        .text(d => d.data.name);

      function apply(v) {
        const k = Math.min(W, H) / v[2];
        view = v;
        node.attr('transform', d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`).attr('r', d => d.r * k);
        label.attr('transform', d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k + (d.depth === 1 && focus === root ? -d.r * k + 16 : 4)})`)
          .style('display', d => ((d.parent === focus || (d === focus && d.depth > 0 && false)) && d.r * k > (d.depth === 3 ? 26 : 20) ? null : 'none'))
          .text(d => { const max = Math.floor((d.r * k * 2) / 7); return d.data.name.length > max ? d.data.name.slice(0, Math.max(1, max - 1)) + '…' : d.data.name; });
      }
      function zoomTo(d) {
        focus = d;
        updateCrumb();
        const target = [d.x, d.y, d.r * 2 + 10];
        svg.transition().duration(650).tween('zoom', () => { const i = d3.interpolateZoom(view, target); return t => apply(i(t)); });
      }
      function updateCrumb() {
        const path = focus.ancestors().reverse();
        crumb.innerHTML = path.map((p, i) => (i < path.length - 1 ? `<a data-d="${i}">${esc(p.data.name)}</a>` : `<b>${esc(p.data.name)}</b>`)).join(' › ')
          + ` <span style="color:var(--muted)">· ${fmt(focus.leaves().length)} Songs</span>`;
        crumb.querySelectorAll('a').forEach(a => a.onclick = () => zoomTo(path[+a.dataset.d]));
      }
      function tipHtml(d) {
        if (d.depth === 3) {
          const s = d.data.song;
          return `<b>${esc(s.t)}</b><span class="m">${esc(artistNames(s))}</span><br>${esc(s.al || '')}${s.y ? ' · ' + s.y : ''} · ${dur(s.d)}${s.p ? ' · ' + fmt(s.p) + '× gespielt' : ''}`;
        }
        const songs = d.leaves().length;
        const plays = d3.sum(d.leaves(), l => l.data.song.p);
        return `<b>${esc(d.data.name)}</b><span class="m">${fmt(songs)} Songs${d.depth === 1 ? ' · ' + fmt(d.children.length) + ' Künstler' : ''}${plays ? ' · ' + fmt(plays) + ' Wiedergaben' : ''}</span>`;
      }
      apply([root.x, root.y, root.r * 2 + 10]);
      updateCrumb();
      legend();
    }

    document.getElementById('packGroup').addEventListener('change', e => { groupBy = e.target.value; render(); });
    const sizeSel = document.getElementById('packSize');
    if (!S.plays) sizeSel.querySelector('option[value=plays]').disabled = true;
    sizeSel.addEventListener('change', e => { sizeBy = e.target.value; render(); });
    render();
    return { refresh: render, retheme: () => {} };
  }

  // ---------- Tabelle ----------
  function initTable() {
    const rows = SONGS.map(s => ({ ...s, artist: artistNames(s) }));
    rows.forEach(r => { r.pls = (r.pl || []).map(i => PLS[i]).join(', '); r._q = [r.t, r.artist, r.al, r.g, r.y, r.pls].join(' ').toLowerCase(); });
    const cols = [
      { k: 'o', l: '#', num: true, title: 'Like-Reihenfolge (0 = zuletzt geliked)' },
      { k: 't', l: 'Titel' }, { k: 'artist', l: 'Künstler' }, { k: 'al', l: 'Album' },
      { k: 'y', l: 'Jahr', num: true }, { k: 'd', l: 'Länge', num: true, f: dur }, { k: 'g', l: 'Genre' },
      { k: 'p', l: 'Plays', num: true }, { k: 'pls', l: 'Playlists' }, { k: 'l', l: 'Geliked am' },
    ];
    let sortK = 'o', dir = 1;
    const tbl = document.getElementById('tbl'), q = document.getElementById('q'), qn = document.getElementById('qn');
    function render() {
      const term = q.value.trim().toLowerCase();
      const list = rows.filter(r => !term || r._q.includes(term)).sort((a, b) => {
        const x = a[sortK], y = b[sortK];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'de')) * dir;
      });
      qn.textContent = `${fmt(list.length)} von ${fmt(rows.length)} Songs${list.length > 500 ? ' · erste 500 angezeigt' : ''}`;
      tbl.innerHTML = '<thead><tr>' + cols.map(c => `<th class="${c.num ? 'num' : ''}" data-k="${c.k}" title="${c.title || ''}">${c.l}${sortK === c.k ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr></thead><tbody>'
        + list.slice(0, 500).map(r => '<tr>' + cols.map(c => {
          let v = c.f ? c.f(r[c.k]) : r[c.k] ?? '';
          if (c.k === 't') v = `<a href="https://music.youtube.com/watch?v=${encodeURIComponent(r.v)}" target="_blank" rel="noopener" style="color:inherit">${esc(v)}</a>${r.e ? ' <span style="color:var(--muted)">🅴</span>' : ''}`;
          else if (c.k === 'g') v = `<span class="dot" style="background:${genreVar(r.g)}"></span>${esc(v)}`;
          else v = esc(typeof v === 'number' && c.k !== 'y' ? fmt(v) : v);
          return `<td class="${c.num ? 'num' : ''}">${v}</td>`;
        }).join('') + '</tr>').join('') + '</tbody>';
      tbl.querySelectorAll('th').forEach(th => th.onclick = () => {
        const k = th.dataset.k;
        if (sortK === k) dir = -dir; else { sortK = k; dir = ['p', 'y', 'd'].includes(k) ? -1 : 1; }
        render();
      });
    }
    q.addEventListener('input', debounce(render, 120));
    render();
    return { refresh: () => {} };
  }

  let start = 'overview';
  try { start = localStorage.getItem('ytm-tab') || 'overview'; } catch (e) { /* */ }
  showTab(['overview', 'network', 'bubbles', 'table'].includes(start) ? start : 'overview');
})();
