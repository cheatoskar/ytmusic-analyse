// Netzwerk-Map (Canvas + Kraftsimulation) und Bubble-Map (Circle Packing). Beide folgen dem globalen Filter:
// das Netzwerk blendet nicht passende Kuenstler ab, die Bubble-Map zeigt nur die gefilterten Songs.
(() => {
  'use strict';
  const Y = window.Y;
  if (!Y.ok) return;
  const { A, SONGS, COMMS, PLS, GENRES, UNKNOWN, GENRE_KEYS, cur } = Y;
  const { fmt, esc, css, compact, dur, collapse, genreVar, plVar, commVar, showTip, hideTip, isFiltered } = Y;

  // ---------- Netzwerk-Map ----------
  function initNetwork() {
    const stage = document.getElementById('netStage');
    const canvas = document.getElementById('net');
    const ctx = canvas.getContext('2d');
    const detail = document.getElementById('netDetail');
    let W = 0, H = 0, dpr = 1;
    let colorBy = 'genre', minSongs = 1, highlight = null, selected = null, hover = null;
    const show = { f: true, r: true, t: false };
    let transform = d3.zoomIdentity;
    let pal = {};
    let inFilter = null;

    const nodes = A.map((a, i) => ({ i, ...a, r: 3 + Math.sqrt(a.c) * 3.2 }));
    const allEdges = Y.EDGES;
    const R = 140 + Math.sqrt(nodes.length) * 12;
    // Die 12 groessten Musik-Welten bekommen einen eigenen Platz im Kreis, der Rest sammelt sich in der Mitte
    const NA = Math.min(12, COMMS.length);
    const anchors = COMMS.slice(0, NA).map((c, i) => {
      const ang = (i / NA) * 2 * Math.PI - Math.PI / 2;
      return { x: Math.cos(ang) * R, y: Math.sin(ang) * R };
    });
    const pull = nodes.length > 500 ? 0.07 : 0.035;
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
    const off = n => (inFilter && !inFilter.has(n.i)) || (highlight !== null && groupOf(n) !== highlight);

    let vnodes = [], vlinks = [], adj = new Map();
    let fitted = false, userMoved = false;
    const sim = d3.forceSimulation()
      .force('charge', d3.forceManyBody().strength(n => -24 - n.r * 4).distanceMax(450))
      .force('collide', d3.forceCollide(n => n.r + 4))
      .force('x', d3.forceX(n => anchorOf(n).x).strength(pull))
      .force('y', d3.forceY(n => anchorOf(n).y).strength(pull))
      .force('link', d3.forceLink().distance(l => (l.f ? 26 : l.r ? 46 : 64)).strength(l => (l.f ? 0.5 : l.r ? 0.22 : 0.08)))
      .alphaDecay(0.03)
      .on('tick', () => {
        if (!fitted && sim.alpha() < 0.2) { fitted = true; fit(); }
        draw();
      })
      // Am Ende nochmal einpassen, solange niemand selbst gezoomt oder verschoben hat
      .on('end', () => { if (!userMoved) fit(500); });

    function fit(duration = 750, only = null) {
      const set = only || vnodes;
      if (!set.length) return;
      const panelW = W > 860 ? 270 : 0;
      const x0 = d3.min(set, n => n.x - n.r), x1 = d3.max(set, n => n.x + n.r);
      const y0 = d3.min(set, n => n.y - n.r), y1 = d3.max(set, n => n.y + n.r);
      const k = Math.min((W - panelW - 80) / (x1 - x0 || 1), (H - 80) / (y1 - y0 + 40 || 1), 4);
      const tr = d3.zoomIdentity.translate(panelW + (W - panelW) / 2 - ((x0 + x1) / 2) * k, H / 2 - ((y0 + y1) / 2) * k).scale(k);
      d3.select(canvas).transition().duration(duration).call(zoom.transform, tr);
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
        const faded = !on && (off(l.source) || off(l.target));
        ctx.globalAlpha = focus ? (on ? 0.75 : 0.03) : faded ? 0.03 : (l.f ? 0.35 : 0.14);
        ctx.strokeStyle = on ? pal.text : l.f ? pal.text2 : pal.muted;
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
      }
      ctx.lineWidth = 1.5 / k;
      ctx.strokeStyle = pal.surface;
      for (const n of vnodes) {
        const dim = (focus && n !== focus && !nb.has(n)) || off(n);
        ctx.globalAlpha = dim ? 0.1 : 1;
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
      // Beschriftungen in konstanter Bildschirmgroesse
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${11 / k}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.lineJoin = 'round';
      const filtered = !!inFilter;
      for (const n of vnodes) {
        const important = n === focus || (nb && nb.has(n));
        if (!important && (focus || off(n) || n.r * k < (filtered ? 6 : 9))) continue;
        ctx.globalAlpha = 1;
        const y = n.y + n.r + 8 / k;
        ctx.lineWidth = 3 / k; ctx.strokeStyle = pal.surface; ctx.strokeText(n.n, n.x, y);
        ctx.fillStyle = important ? pal.text : pal.text2; ctx.fillText(n.n, n.x, y);
      }
      // Namen der Musik-Welten in der Uebersicht
      if (!focus && !filtered && k < 1.3) {
        ctx.font = `600 ${14 / k}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
        COMMS.slice(0, NA).forEach((c, i) => {
          const mem = vnodes.filter(n => n.cm === i);
          if (mem.length < 3) return;
          // Median statt Mittelwert/Minimum: einzelne Ausreisser ziehen den Namen nicht weg
          const cx = d3.median(mem, n => n.x), cy = d3.quantile(mem.map(n => n.y).sort(d3.ascending), 0.2) - 14 / k;
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
      return bd < 6 / transform.k ? best : null;
    }

    function legend() {
      const el = document.getElementById('netLegend');
      let items;
      if (colorBy === 'genre') {
        const cnt = d3.rollup(vnodes, v => v.length, n => collapse(n.g));
        items = GENRE_KEYS.filter(g => cnt.get(g)).map(g => ({ key: g, label: tv(g), n: cnt.get(g), color: genreVar(g) }));
      } else if (colorBy === 'playlist') {
        const cnt = d3.rollup(vnodes, v => v.length, n => (n.pl >= 0 && n.pl < 8 ? n.pl : 'other'));
        items = PLS.slice(0, 8).map((name, i) => ({ key: i, label: name, n: cnt.get(i), color: plVar(i) })).filter(it => it.n);
        if (cnt.get('other')) items.push({ key: 'other', label: t('other_pl'), n: cnt.get('other'), color: 'var(--other)' });
      } else {
        const cnt = d3.rollup(vnodes, v => v.length, n => (n.cm >= 0 && n.cm < 8 ? n.cm : 'other'));
        items = COMMS.slice(0, 8).filter(c => cnt.get(c.id)).map(c => ({ key: c.id, label: c.name, n: cnt.get(c.id), color: commVar(c.id) }));
        if (cnt.get('other')) items.push({ key: 'other', label: t('other_world'), n: cnt.get('other'), color: 'var(--other)' });
      }
      el.innerHTML = '';
      items.forEach(it => {
        const s = document.createElement('button');
        s.className = 'lg' + (highlight !== null && highlight !== it.key ? ' off' : '');
        s.innerHTML = `<i style="background:${it.color}"></i>${esc(it.label)} <span class="n">${fmt(it.n)}</span>`;
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
        const l = links.find(x => x.source === o || x.target === o);
        return [l.f ? t('feat_x', { n: l.f }) : '', l.r ? t('related') : '', l.tg ? t('similar_tags') : ''].filter(Boolean).join(', ');
      };
      const songs = A[n.i].songs.map(i => SONGS[i]).sort((a, b) => b.p - a.p || a.o - b.o);
      detail.innerHTML = `
        <div class="dh">${Y.ui.cover(Y.artistCoverSong(n.i), n.n, n.g, 'round')}<div><h4>${esc(n.n)}</h4>
        <div class="m">${t('n_songs', { n: fmt(n.c) })} · ${esc(tv(n.g))}${n.gi ? ` (${t('inferred')})` : ''}${n.co ? ' · ' + esc(n.co) : ''}</div></div></div>
        <button class="btn primary" data-ai="${n.i}">${esc(t('open_profile'))}</button>
        ${n.cm >= 0 && COMMS[n.cm] ? `<div class="hint">${t('world')}: <a href="#" data-f="w" data-v="${n.cm}"><b>${esc(COMMS[n.cm].name)}</b></a></div>` : ''}
        <label>${t('connections')} (${nbs.length})</label>
        <ul>${nbs.slice(0, 25).map(o => `<li><a data-i="${o.i}">${esc(o.n)}</a> <span class="muted">${kind(o)}</span></li>`).join('') || `<li class="muted">${t('none')}</li>`}</ul>
        <label>Songs (${songs.length})</label>
        <ul>${songs.slice(0, 30).map(s => `<li><a href="${Y.ytSong(s)}" target="_blank" rel="noopener">${esc(s.t)}</a>${s.y ? ` <span class="muted">${s.y}</span>` : ''}${s.p ? ` <span class="muted">· ${fmt(s.p)}×</span>` : ''}</li>`).join('')}</ul>
        <button class="btn" id="netClose">${t('close')}</button>`;
      detail.hidden = false;
      detail.querySelectorAll('a[data-i]').forEach(a => { a.onclick = () => select(nodes[+a.dataset.i], true); });
      detail.querySelector('#netClose').onclick = () => select(null);
      if (center) {
        const k = Math.max(transform.k, 1.6);
        d3.select(canvas).transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - n.x * k, H / 2 - n.y * k).scale(k));
      }
      draw();
    }

    const zoom = d3.zoom().scaleExtent([0.08, 10]).on('zoom', e => { transform = e.transform; if (e.sourceEvent) userMoved = true; draw(); });
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
      if (n) showTip(ev, `<b>${esc(n.n)}</b><span class="m">${t('n_songs', { n: fmt(n.c) })} · ${esc(tv(n.g))}${n.p ? ' · ' + t('n_plays', { n: fmt(n.p) }) : ''}</span>`);
      else hideTip();
    });
    canvas.addEventListener('mouseleave', () => { hover = null; hideTip(); draw(); });
    canvas.addEventListener('click', ev => select(nodeAt(ev.offsetX, ev.offsetY)));
    canvas.addEventListener('dblclick', ev => { const n = nodeAt(ev.offsetX, ev.offsetY); if (n) Y.openArtist(n.i); });

    // Steuerung
    const dl = document.getElementById('artistList');
    dl.innerHTML = A.slice().sort((a, b) => b.c - a.c).map(a => `<option value="${esc(a.n)}">`).join('');
    const search = document.getElementById('netSearch');
    const slider = document.getElementById('netMin');
    const minLabel = () => { document.getElementById('netMinV').textContent = minSongs; };
    function focusArtist(n) {
      if (n.c < minSongs) { minSongs = 1; slider.value = 1; minLabel(); rebuild(); }
      select(n, true);
    }
    search.addEventListener('change', () => {
      const q = search.value.trim().toLowerCase();
      const n = nodes.find(x => x.n.toLowerCase() === q) || nodes.find(x => x.n.toLowerCase().includes(q));
      if (n) focusArtist(n);
    });
    document.getElementById('netColor').addEventListener('change', e => { colorBy = e.target.value; highlight = null; legend(); draw(); });
    [['eFeat', 'f'], ['eRel', 'r'], ['eTag', 't']].forEach(([id, key]) =>
      document.getElementById(id).addEventListener('change', e => { show[key] = e.target.checked; rebuild(); }));
    slider.max = Math.max(2, Math.min(10, d3.max(A, a => a.c)));
    // Bei sehr grossen Sammlungen standardmaessig ausduennen
    if (A.length > 1500) { minSongs = 2; slider.value = 2; }
    minLabel();
    slider.addEventListener('input', () => { minSongs = +slider.value; minLabel(); if (selected && selected.c < minSongs) select(null); rebuild(); });

    function applyFilter() {
      inFilter = isFiltered() ? new Set(cur.songs.flatMap(s => s.a)) : null;
      const hint = document.getElementById('netFilter');
      hint.hidden = !inFilter;
      if (inFilter) hint.textContent = t('net_filter', { n: fmt(inFilter.size) });
      draw();
    }

    palette();
    resize();
    const k0 = Math.min(W, H) / (2 * (R + 120));
    transform = d3.zoomIdentity.translate(W / 2, H / 2).scale(k0);
    d3.select(canvas).call(zoom.transform, transform);
    rebuild();
    applyFilter();
    document.getElementById('netFit').addEventListener('click', () => fit(750, inFilter ? vnodes.filter(n => inFilter.has(n.i)) : null));
    return {
      render: applyFilter,
      refresh: resize,
      retheme: () => { palette(); draw(); },
      focus: ai => focusArtist(nodes[ai]),
    };
  }

  // ---------- Bubble-Map (Circle Packing) ----------
  function initPack() {
    const stage = document.getElementById('packStage');
    const svg = d3.select('#pack');
    const crumb = document.getElementById('crumb');
    let groupBy = 'genre', sizeBy = 'count', focus, view, root, W, H;

    const value = s => (sizeBy === 'plays' ? Math.max(s.p, 0.3) : sizeBy === 'dur' ? (s.d || 180) : 1);
    const songPl = s => (s.pl && s.pl.length ? Math.max(...s.pl) : -1);

    function hierarchy() {
      const groups = d3.group(cur.songs, s => (groupBy === 'genre' ? s.g : groupBy === 'playlist' ? songPl(s)
        : (s.cm >= 0 && s.cm < 12 ? s.cm : 'other')));
      const children = [...groups].map(([key, ss]) => {
        const color = groupBy === 'genre' ? genreVar(key) : groupBy === 'playlist' ? plVar(key) : commVar(key === 'other' ? -1 : key);
        const name = groupBy === 'genre' ? tv(key) : groupBy === 'playlist' ? (key >= 0 ? PLS[key] : t('no_playlist'))
          : key === 'other' ? t('more_worlds') : COMMS[key].name;
        const byArtist = d3.group(ss, s => s.m);
        return {
          name, kind: 'group', color,
          children: [...byArtist].map(([ai, list]) => ({
            name: ai >= 0 ? A[ai].n : tv(UNKNOWN), kind: 'artist', ai, color,
            children: list.map(s => ({ name: s.t, kind: 'song', song: s, color })),
          })),
        };
      });
      return { name: t('all_liked'), kind: 'root', children };
    }

    function legend() {
      const el = document.getElementById('packLegend');
      const L = cur.songs;
      const item = (color, label, n) => `<span><i style="background:${color}"></i>${esc(label)}${n != null ? ` <span class="n">${fmt(n)}</span>` : ''}</span>`;
      if (groupBy === 'genre') {
        const cnt = d3.rollup(L, v => v.length, s => collapse(s.g));
        el.innerHTML = GENRE_KEYS.filter(g => cnt.get(g)).map(g => item(genreVar(g), tv(g), cnt.get(g))).join('');
      } else if (groupBy === 'playlist') {
        const cnt = d3.rollup(L, v => v.length, songPl);
        el.innerHTML = PLS.slice(0, 8).map((name, i) => (cnt.get(i) ? item(plVar(i), name, cnt.get(i)) : '')).join('')
          + item('var(--other)', t('other_pl'), L.length - d3.sum(PLS.slice(0, 8), (n, i) => cnt.get(i) || 0));
      } else {
        el.innerHTML = COMMS.slice(0, 8).map(c => item(commVar(c.id), c.name)).join('') + item('var(--other)', t('more'));
      }
    }

    function render() {
      W = stage.clientWidth; H = stage.clientHeight;
      svg.selectAll('*').remove();
      svg.attr('viewBox', `${-W / 2} ${-H / 2} ${W} ${H}`);
      legend();
      if (!cur.songs.length) { crumb.textContent = t('empty_filter'); return; }
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
        .on('click', (ev, d) => {
          ev.stopPropagation();
          if (d.depth === 3) { window.open(Y.ytSong(d.data.song), '_blank', 'noopener'); return; }
          zoomTo(focus === d ? (d.parent || root) : d);
        });
      const label = svg.append('g').attr('pointer-events', 'none').attr('text-anchor', 'middle')
        .style('font', '12px Inter, system-ui, -apple-system, "Segoe UI", sans-serif')
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
          .style('display', d => (d.parent === focus && d.r * k > (d.depth === 3 ? 26 : 20) ? null : 'none'))
          .text(d => { const max = Math.floor((d.r * k * 2) / 7); return d.data.name.length > max ? d.data.name.slice(0, Math.max(1, max - 1)) + '…' : d.data.name; });
      }
      function zoomTo(d) {
        focus = d;
        updateCrumb();
        const target = [d.x, d.y, d.r * 2 + 10];
        svg.transition().duration(650).tween('zoom', () => { const i = d3.interpolateZoom(view, target); return tt => apply(i(tt)); });
      }
      function updateCrumb() {
        const path = focus.ancestors().reverse();
        crumb.innerHTML = path.map((p, i) => (i < path.length - 1 ? `<a data-d="${i}">${esc(p.data.name)}</a>` : `<b>${esc(p.data.name)}</b>`)).join(' › ')
          + ` <span class="muted">· ${t('n_songs', { n: fmt(focus.leaves().length) })}</span>`
          + (focus.data.kind === 'artist' && focus.data.ai >= 0 ? ` · <a data-ai="${focus.data.ai}" href="#">${esc(t('open_profile'))}</a>` : '');
        crumb.querySelectorAll('a[data-d]').forEach(a => { a.onclick = () => zoomTo(path[+a.dataset.d]); });
      }
      function tipHtml(d) {
        if (d.depth === 3) {
          const s = d.data.song;
          return `<b>${esc(s.t)}</b><span class="m">${esc(s.an)}</span><br>${esc(s.al || '')}${s.y ? ' · ' + s.y : ''} · ${dur(s.d)}${s.p ? ' · ' + t('played_x', { n: fmt(s.p) }) : ''}`;
        }
        const songs = d.leaves().length;
        const plays = d3.sum(d.leaves(), l => l.data.song.p);
        return `<b>${esc(d.data.name)}</b><span class="m">${t('n_songs', { n: fmt(songs) })}${d.depth === 1 ? ' · ' + t('n_artists', { n: fmt(d.children.length) }) : ''}${plays ? ' · ' + t('n_plays', { n: fmt(plays) }) : ''}</span>`;
      }
      apply([root.x, root.y, root.r * 2 + 10]);
      updateCrumb();
    }

    document.getElementById('packGroup').addEventListener('change', e => { groupBy = e.target.value; render(); });
    const sizeSel = document.getElementById('packSize');
    if (!Y.HAS_PLAYS) sizeSel.querySelector('option[value=plays]').disabled = true;
    sizeSel.addEventListener('change', e => { sizeBy = e.target.value; render(); });
    render();
    return { render, refresh: render };
  }

  let net = null, pack = null, pending = null;
  Object.assign(Y.views, {
    network: {
      init() { net = initNetwork(); if (pending != null) { net.focus(pending); pending = null; } },
      render() { net && net.render(); }, refresh() { net && net.refresh(); }, retheme() { net && net.retheme(); },
    },
    bubbles: { init() { pack = initPack(); }, render() { pack && pack.render(); }, refresh() { pack && pack.refresh(); } },
  });
  // Kuenstler im Netzwerk zeigen (auch bevor die Map aufgebaut ist)
  Y.netFocus = ai => { if (net) net.focus(ai); else pending = ai; };
})();
