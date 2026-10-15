// Diagramm-Bausteine (D3, SVG). Duenne Markierungen, abgerundete Datenenden, Tooltip auf jeder Markierung.
// Optionen onClick/sel machen ein Diagramm zum Filter: Klick setzt den Filter, die Auswahl bleibt hervorgehoben.
(() => {
  'use strict';
  const Y = window.Y;
  if (!Y.ok) return;
  const { fmt, pct, pctv, esc, showTip, hideTip } = Y;

  const barH = (w, h, r = 4) => { r = Math.min(r, w, h / 2); return `M0,0H${w - r}Q${w},0 ${w},${r}V${h - r}Q${w},${h} ${w - r},${h}H0Z`; };
  const barV = (w, h, r = 4) => { r = Math.min(r, h, w / 2); return `M0,${h}V${r}Q0,0 ${r},0H${w - r}Q${w},0 ${w},${r}V${h}Z`; };
  const legendHtml = (keys, colorOf, labelOf = tv) => keys.map(k => `<span><i style="background:${colorOf(k)}"></i>${esc(labelOf(k))}</span>`).join('');
  const clip = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
  const width = el => el.clientWidth || 480;
  // Klickbare Markierungen per Tastatur erreichbar machen
  const focusable = (sel, onClick) => {
    if (!onClick) return sel;
    return sel.attr('tabindex', 0).attr('role', 'button').style('cursor', 'pointer')
      .on('click', (ev, d) => { hideTip(); onClick(d, ev); })
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick(d, ev); } });
  };

  // Liegende Balken: rows = [{label, value, key?, color?}]
  function hbar(el, rows, { color = () => 'var(--s1)', total = null, labelW = 150, tipFn = null, onClick = null, sel = null, valFn = null } = {}) {
    const W = width(el), bh = 16, gap = 7, valW = total ? 96 : 52;
    labelW = Math.min(labelW, Math.round(W * 0.4));
    const H = rows.length * (bh + gap);
    const max = d3.max(rows, r => r.value) || 1;
    const x = d3.scaleLinear([0, max], [0, Math.max(30, W - labelW - valW)]);
    const maxChars = Math.floor((labelW - 10) / 6.4);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const g = svg.selectAll('g').data(rows).join('g').attr('transform', (d, i) => `translate(0,${i * (bh + gap)})`)
      .attr('class', d => 'row' + (sel != null && d.key === sel ? ' sel' : '') + (sel != null && d.key !== sel ? ' dim' : ''));
    g.append('text').attr('class', 'barlbl').attr('x', labelW - 8).attr('y', bh / 2).attr('dy', '0.35em')
      .attr('text-anchor', 'end').text(d => clip(d.label, maxChars));
    g.append('path').attr('class', 'mark').attr('transform', `translate(${labelW},0)`).attr('d', d => barH(Math.max(2, x(d.value)), bh))
      .attr('fill', d => color(d));
    g.append('text').attr('class', 'val').attr('x', d => labelW + Math.max(2, x(d.value)) + 6).attr('y', bh / 2).attr('dy', '0.35em')
      .text(d => (valFn ? valFn(d) : fmt(d.value) + (total ? `  ·  ${pct(d.value, total)}` : '')));
    const hit = g.append('rect').attr('class', 'hit').attr('width', W).attr('height', bh + gap).attr('y', -gap / 2).attr('fill', 'transparent')
      .on('mousemove', (ev, d) => showTip(ev, tipFn ? tipFn(d) : `<b>${fmt(d.value)}${total ? ' · ' + pct(d.value, total) : ''}</b>${esc(d.label)}`))
      .on('mouseleave', hideTip);
    focusable(hit, onClick);
    if (onClick) svg.classed('clickable', true);
  }

  // Saeulen: rows = [{label, value, key?}]
  function columns(el, rows, { height = 200, color = () => 'var(--s1)', every = 1, tipFn = null, yFmt = fmt, onClick = null, sel = null } = {}) {
    const W = width(el), m = { l: 44, r: 6, t: 8, b: 24 };
    const x = d3.scaleBand(rows.map(r => r.label), [m.l, W - m.r]).paddingInner(rows.length > 40 ? 0.12 : 0.22);
    const y = d3.scaleLinear([0, d3.max(rows, r => r.value) || 1], [height - m.b, m.t]).nice();
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${height}`).attr('height', height);
    const ticks = y.ticks(4);
    svg.append('g').selectAll('line').data(ticks).join('line').attr('class', 'gridline')
      .attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(ticks).join('text').attr('class', 'lbl')
      .attr('x', m.l - 6).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'end').text(yFmt);
    svg.append('g').selectAll('path').data(rows).join('path')
      .attr('class', d => 'mark' + (sel != null && d.key !== sel ? ' dim' : ''))
      .attr('transform', d => `translate(${x(d.label)},${y(d.value)})`)
      .attr('d', d => (d.value > 0 ? barV(x.bandwidth(), y(0) - y(d.value), Math.min(4, x.bandwidth() / 2)) : ''))
      .attr('fill', d => color(d));
    svg.append('g').selectAll('text').data(rows.filter((d, i) => i % every === 0)).join('text').attr('class', 'lbl')
      .attr('x', d => x(d.label) + x.bandwidth() / 2).attr('y', height - 6).attr('text-anchor', 'middle').text(d => d.label);
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--axis)');
    const step = x.step();
    const hit = svg.append('g').selectAll('rect').data(rows).join('rect').attr('class', 'hit')
      .attr('x', d => x(d.label) - (step - x.bandwidth()) / 2).attr('width', step).attr('y', m.t).attr('height', height - m.t - m.b)
      .attr('fill', 'transparent')
      .on('mousemove', (ev, d) => showTip(ev, tipFn ? tipFn(d) : `<b>${fmt(d.value)}</b>${esc(d.label)}`))
      .on('mouseleave', hideTip);
    focusable(hit, onClick);
    if (onClick) svg.classed('clickable', true);
  }

  // Gestapelte 100-%-Saeulen: buckets = [{label, counts: {key: n}}]
  function stacked100(el, buckets, keys, colorOf, { height = 240, onClick = null, labelOf = tv } = {}) {
    const W = width(el), m = { l: 40, r: 6, t: 6, b: 34 };
    d3.select(el).append('div').attr('class', 'legend').html(legendHtml(keys, colorOf, labelOf));
    const x = d3.scaleBand(buckets.map(b => b.label), [m.l, W - m.r]).paddingInner(0.18);
    const y = d3.scaleLinear([0, 1], [height - m.b, m.t]);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${height}`).attr('height', height);
    [0, 0.25, 0.5, 0.75, 1].forEach(v => {
      svg.append('text').attr('class', 'lbl').attr('x', m.l - 6).attr('y', y(v)).attr('dy', '0.35em').attr('text-anchor', 'end').text(pctv(v * 100));
    });
    buckets.forEach(b => {
      const total = d3.sum(keys, k => b.counts[k] || 0) || 1;
      let acc = 0;
      keys.forEach(k => {
        const v = b.counts[k] || 0;
        if (!v) return;
        const y0 = y(acc / total), y1 = y((acc + v) / total);
        acc += v;
        const r = svg.append('rect').datum(k).attr('class', 'mark').attr('x', x(b.label)).attr('width', x.bandwidth()).attr('y', y1).attr('height', Math.max(0, y0 - y1))
          .attr('fill', colorOf(k)).attr('stroke', 'var(--surface-1)').attr('stroke-width', 1.5)
          .on('mousemove', ev => showTip(ev, `<b>${pct(v, total)}</b>${esc(labelOf(k))} · ${esc(b.label)}<br>${t('n_songs', { n: fmt(v) })}`))
          .on('mouseleave', hideTip);
        focusable(r, onClick);
      });
    });
    const every = Math.ceil(buckets.length / Math.max(4, Math.floor(W / 70)));
    buckets.forEach((b, i) => {
      if (i % every) return;
      svg.append('text').attr('class', 'lbl').attr('x', x(b.label) + x.bandwidth() / 2).attr('y', height - 18).attr('text-anchor', 'middle').text(b.label);
    });
  }

  // Liegende 100-%-Balken: rows = [{label, sub, counts, key?}]
  function hstack100(el, rows, keys, colorOf, { labelW = 200, onRow = null, onKey = null, labelOf = tv, unit = 'n_songs' } = {}) {
    d3.select(el).append('div').attr('class', 'legend').html(legendHtml(keys, colorOf, labelOf));
    const W = width(el), bh = 18, gap = 9, valW = 76, H = rows.length * (bh + gap);
    labelW = Math.min(labelW, Math.round(W * 0.34));
    const x = d3.scaleLinear([0, 1], [labelW, Math.max(labelW + 40, W - valW)]);
    const maxChars = Math.floor((labelW - 10) / 6.4);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    rows.forEach((r, i) => {
      const g = svg.append('g').attr('transform', `translate(0,${i * (bh + gap)})`);
      const lbl = g.append('text').datum(r).attr('class', 'barlbl' + (onRow ? ' link' : '')).attr('x', labelW - 8).attr('y', bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
        .text(clip(r.label, maxChars));
      focusable(lbl, onRow);
      const total = d3.sum(keys, k => r.counts[k] || 0) || 1;
      let acc = 0;
      keys.forEach(k => {
        const v = r.counts[k] || 0;
        if (!v) return;
        const rect = g.append('rect').datum(k).attr('class', 'mark').attr('x', x(acc / total)).attr('width', Math.max(0, x((acc + v) / total) - x(acc / total))).attr('height', bh)
          .attr('fill', colorOf(k)).attr('stroke', 'var(--surface-1)').attr('stroke-width', 1.5)
          .on('mousemove', ev => showTip(ev, `<b>${pct(v, total)}</b>${esc(labelOf(k))} · ${esc(r.label)}<br>${t(unit, { n: fmt(v) })}`))
          .on('mouseleave', hideTip);
        focusable(rect, onKey ? k2 => onKey(r, k2) : null);
        acc += v;
      });
      g.append('text').attr('class', 'val').attr('x', x(1) + 8).attr('y', bh / 2).attr('dy', '0.35em').text(r.sub);
    });
  }

  const SEQ = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6', '--seq-7'];
  const seqColor = (v, max) => (!v ? 'var(--seq-0)' : `var(${SEQ[Math.min(6, Math.floor((v / max) * 7))]})`);
  function seqLegend(el, low, high) {
    const lg = d3.select(el).append('div').attr('class', 'legend seq');
    lg.append('span').text(low);
    SEQ.forEach(s => lg.append('i').style('background', `var(${s})`).style('width', '16px').style('height', '10px').style('border-radius', '2px'));
    lg.append('span').text(high);
  }

  // Wochentag x Stunde
  function heatmap(el, matrix, { onClick = null, sel = null } = {}) {
    const days = t('days');
    const W = width(el), m = { l: 34, r: 4, t: 4, b: 22 };
    const cw = (W - m.l - m.r) / 24, ch = Math.min(26, Math.max(16, cw * 0.8)), H = m.t + ch * 7 + m.b;
    const max = d3.max(matrix.flat()) || 1;
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    matrix.forEach((row, d) => {
      svg.append('text').attr('class', 'lbl').attr('x', m.l - 6).attr('y', m.t + d * ch + ch / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(days[d]);
      row.forEach((v, h) => {
        const isSel = sel && sel[0] === d && sel[1] === h;
        const r = svg.append('rect').datum([d, h]).attr('class', 'cell' + (isSel ? ' sel' : '')).attr('x', m.l + h * cw + 1).attr('y', m.t + d * ch + 1)
          .attr('width', cw - 2).attr('height', ch - 2).attr('rx', 3).attr('fill', seqColor(v, max))
          .on('mousemove', ev => showTip(ev, `<b>${t('n_plays', { n: fmt(v) })}</b>${days[d]}, ${t('hour_range', { h, h2: h + 1 })}`))
          .on('mouseleave', hideTip);
        focusable(r, onClick);
      });
    });
    for (let h = 0; h < 24; h += 3) {
      svg.append('text').attr('class', 'lbl').attr('x', m.l + h * cw + cw / 2).attr('y', H - 6).attr('text-anchor', 'middle').text(t('hour_tick', { h }));
    }
    seqLegend(el, t('heat_low'), t('heat_high', { n: fmt(max) }));
  }

  // Kalender: eine Spalte pro Woche, eine Zeile pro Wochentag. counts = Map(Tag -> Wiedergaben)
  function calendar(el, counts, firstDay, lastDay, { onClick = null } = {}) {
    const days = t('days');
    const W = width(el), m = { l: 30, r: 4, t: 18, b: 4 };
    const start = firstDay - ((Y.dayDate(firstDay).getUTCDay() + 6) % 7);
    const weeks = Math.floor((lastDay - start) / 7) + 1;
    const cs = Math.max(6, Math.min(22, (W - m.l - m.r) / weeks));
    const H = m.t + cs * 7 + m.b;
    const max = d3.max([...counts.values()]) || 1;
    const svg = d3.select(el).append('div').attr('class', 'hscroll').append('svg')
      .attr('viewBox', `0 0 ${Math.max(W, m.l + weeks * cs + m.r)} ${H}`).attr('height', H)
      .style('min-width', `${m.l + weeks * cs + m.r}px`);
    [0, 2, 4].forEach(d => svg.append('text').attr('class', 'lbl').attr('x', m.l - 6).attr('y', m.t + d * cs + cs / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(days[d]));
    let lastMonth = -1;
    for (let day = firstDay; day <= lastDay; day++) {
      const w = Math.floor((day - start) / 7), d = (day - start) % 7;
      const v = counts.get(day) || 0;
      const date = Y.dayDate(day);
      if (date.getUTCMonth() !== lastMonth && d < 4) {
        lastMonth = date.getUTCMonth();
        svg.append('text').attr('class', 'lbl').attr('x', m.l + w * cs).attr('y', 11).text(Y.fmtMonth(date.toISOString().slice(0, 7)).replace(/\s?\d{4}$/, ''));
      }
      const r = svg.append('rect').datum(day).attr('class', 'cell').attr('x', m.l + w * cs + 1).attr('y', m.t + d * cs + 1)
        .attr('width', cs - 2).attr('height', cs - 2).attr('rx', 2).attr('fill', seqColor(v, max))
        .on('mousemove', ev => showTip(ev, `<b>${t('n_plays', { n: fmt(v) })}</b>${Y.fmtDay(day)}`))
        .on('mouseleave', hideTip);
      focusable(r, onClick);
    }
    seqLegend(el, t('heat_low'), t('heat_high', { n: fmt(max) }));
  }

  // Matrix mit sequenzieller Farbe; value(r, c) -> {v, share}
  function matrix(el, rows, cols, value, { rowLabel = r => r, colLabel = c => c, labelW = 160, onClick = null, tipFn } = {}) {
    const W = width(el), m = { l: Math.min(labelW, W * 0.36), r: 4, t: 22, b: 4 };
    const cw = (W - m.l - m.r) / cols.length, ch = 22, H = m.t + rows.length * ch + m.b;
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const maxChars = Math.floor((m.l - 10) / 6.4);
    cols.forEach((c, j) => svg.append('text').attr('class', 'lbl').attr('x', m.l + j * cw + cw / 2).attr('y', 12).attr('text-anchor', 'middle').text(colLabel(c)));
    rows.forEach((r, i) => {
      svg.append('text').attr('class', 'barlbl').attr('x', m.l - 8).attr('y', m.t + i * ch + ch / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(clip(rowLabel(r), maxChars));
      cols.forEach((c, j) => {
        const { v, share } = value(r, c);
        const cell = svg.append('rect').datum([r, c]).attr('class', 'cell').attr('x', m.l + j * cw + 1).attr('y', m.t + i * ch + 1)
          .attr('width', cw - 2).attr('height', ch - 2).attr('rx', 3).attr('fill', seqColor(share, 1))
          .on('mousemove', ev => showTip(ev, tipFn(r, c, v, share)))
          .on('mouseleave', hideTip);
        focusable(cell, onClick);
        if (share >= 0.2 && cw > 30) {
          svg.append('text').attr('class', 'cellval' + (share > 0.55 ? ' inv' : '')).attr('x', m.l + j * cw + cw / 2).attr('y', m.t + i * ch + ch / 2)
            .attr('dy', '0.35em').attr('text-anchor', 'middle').attr('pointer-events', 'none').text(Math.round(share * 100));
        }
      });
    });
  }

  // Ein einzelner 100-%-Balken (Musik-DNA): items = [{key, label, value, color}]
  function dna(el, items, { height = 30, onClick = null } = {}) {
    const W = width(el);
    const total = d3.sum(items, d => d.value) || 1;
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${height}`).attr('height', height).attr('class', 'dna');
    let acc = 0;
    items.forEach((d, i) => {
      const x0 = (acc / total) * W, w = (d.value / total) * W;
      acc += d.value;
      const g = svg.append('g').datum(d);
      g.append('rect').attr('class', 'mark').attr('x', x0 + (i ? 1 : 0)).attr('width', Math.max(0, w - (i ? 2 : 0))).attr('height', height)
        .attr('rx', 5).attr('fill', d.color);
      if (w > 64) {
        g.append('text').attr('class', 'dnalbl').attr('x', x0 + 10).attr('y', height / 2).attr('dy', '0.35em').attr('pointer-events', 'none')
          .text(clip(`${d.label} ${Math.round((100 * d.value) / total)}%`, Math.floor((w - 14) / 6.6)));
      }
      g.on('mousemove', ev => showTip(ev, `<b>${pct(d.value, total)}</b>${esc(d.label)} · ${t('n_songs', { n: fmt(d.value) })}`)).on('mouseleave', hideTip);
      focusable(g, onClick);
    });
  }

  // Flaeche mit Fadenkreuz: points = [{x: Tag, y}], fuer Verlaeufe ueber die Zeit
  function area(el, points, { height = 160, tipFn, yFmt = fmt } = {}) {
    if (points.length < 2) return;
    const W = width(el), m = { l: 40, r: 8, t: 8, b: 22 };
    const x = d3.scaleLinear(d3.extent(points, p => p.x), [m.l, W - m.r]);
    const y = d3.scaleLinear([0, d3.max(points, p => p.y) || 1], [height - m.b, m.t]).nice();
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${height}`).attr('height', height);
    y.ticks(4).forEach(v => {
      svg.append('line').attr('class', 'gridline').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v));
      svg.append('text').attr('class', 'lbl').attr('x', m.l - 6).attr('y', y(v)).attr('dy', '0.35em').attr('text-anchor', 'end').text(yFmt(v));
    });
    // Unter einem Jahr Spanne: Tag und Monat, sonst Monat und Jahr (sonst wiederholen sich die Beschriftungen)
    const [d0, d1] = x.domain();
    const short = new Intl.DateTimeFormat(Y.LOC, d1 - d0 < 300 ? { day: 'numeric', month: 'short', timeZone: 'UTC' } : { month: 'short', year: 'numeric', timeZone: 'UTC' });
    x.ticks(Math.max(3, Math.floor(W / 120))).forEach(v => svg.append('text').attr('class', 'lbl').attr('x', x(v)).attr('y', height - 6)
      .attr('text-anchor', 'middle').text(short.format(Y.dayDate(Math.round(v)))));
    svg.append('path').datum(points).attr('fill', 'var(--s1)').attr('fill-opacity', 0.14)
      .attr('d', d3.area().x(p => x(p.x)).y0(y(0)).y1(p => y(p.y)).curve(d3.curveMonotoneX));
    svg.append('path').datum(points).attr('fill', 'none').attr('stroke', 'var(--s1)').attr('stroke-width', 2)
      .attr('d', d3.line().x(p => x(p.x)).y(p => y(p.y)).curve(d3.curveMonotoneX));
    const cross = svg.append('line').attr('class', 'cross').attr('y1', m.t).attr('y2', height - m.b).style('opacity', 0);
    const dot = svg.append('circle').attr('r', 4).attr('fill', 'var(--s1)').attr('stroke', 'var(--surface-1)').attr('stroke-width', 2).style('opacity', 0);
    const bis = d3.bisector(p => p.x).center;
    svg.append('rect').attr('x', m.l).attr('width', W - m.l - m.r).attr('y', m.t).attr('height', height - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', ev => {
        const [px] = d3.pointer(ev);
        const p = points[bis(points, x.invert(px))];
        cross.attr('x1', x(p.x)).attr('x2', x(p.x)).style('opacity', 1);
        dot.attr('cx', x(p.x)).attr('cy', y(p.y)).style('opacity', 1);
        showTip(ev, tipFn(p));
      })
      .on('mouseleave', () => { cross.style('opacity', 0); dot.style('opacity', 0); hideTip(); });
  }

  // Mini-Verlauf ohne Achsen
  function spark(el, values, { height = 36, color = 'var(--s1)' } = {}) {
    if (values.length < 2) return;
    const W = width(el);
    const x = d3.scaleLinear([0, values.length - 1], [1, W - 1]);
    const y = d3.scaleLinear([0, d3.max(values) || 1], [height - 2, 3]);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${height}`).attr('height', height).attr('class', 'spark');
    svg.append('path').datum(values).attr('fill', color).attr('fill-opacity', 0.15)
      .attr('d', d3.area().x((v, i) => x(i)).y0(height).y1(v => y(v)).curve(d3.curveMonotoneX));
    svg.append('path').datum(values).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5)
      .attr('d', d3.line().x((v, i) => x(i)).y(v => y(v)).curve(d3.curveMonotoneX));
  }

  Object.assign(Y, { charts: { hbar, columns, stacked100, hstack100, heatmap, calendar, matrix, dna, area, spark, legendHtml } });
})();
