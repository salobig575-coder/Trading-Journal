const Charts = {
  // Fortschrittsring; node.set(0..1) animiert den Fuellstand
  ring(size, stroke, pct = 0) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const wrap = App.el('div', { class: 'ring', style: `width:${size}px;height:${size}px` });
    wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c}"/>
    </svg>`;
    const fg = wrap.querySelector('.ring-fg');
    let target = pct, ready = false;
    const apply = () => { fg.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, target))); };
    // Wert merken, bis das Element im DOM ist – so startet die Animation immer vom leeren Ring
    wrap.set = (p) => { target = p; if (ready) apply(); };
    requestAnimationFrame(() => requestAnimationFrame(() => { ready = true; apply(); }));
    return wrap;
  },

  // Kleine Verlaufslinie ohne Achsen (Hero)
  spark(values, opts = {}) {
    const w = 320, h = opts.height || 74, pad = 6;
    const wrap = App.el('div', { class: 'spark' });
    if (values.length < 2) { return wrap; }
    const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
    const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (w - pad * 2), pad + (1 - (v - min) / range) * (h - pad * 2)]);
    // weiche Kurve (Catmull-Rom -> Bezier)
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    const gid = 's' + Math.random().toString(36).slice(2, 7);
    const last = pts.at(-1);
    wrap.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;overflow:visible">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
      <path class="sp-area" d="${d} L${last[0]},${h} L${pts[0][0]},${h} Z" fill="url(#${gid})" style="opacity:0"/>
      <path class="sp-line" d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
    requestAnimationFrame(() => {
      const line = wrap.querySelector('.sp-line'), area = wrap.querySelector('.sp-area');
      const len = line.getTotalLength();
      line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset var(--t-slow) var(--ease) 80ms';
      area.style.transition = 'opacity var(--t-slow) var(--ease) 200ms';
      requestAnimationFrame(() => { line.style.strokeDashoffset = 0; area.style.opacity = 1; });
    });
    return wrap;
  },

  // Equity-Kurve (kumulierte R) mit Null-Linie und Touch-Scrubber
  equity(curve, opts = {}) {
    const width = 340, height = opts.height || 170;
    const padX = 8, padY = 16;
    const wrap = App.el('div', { class: 'chart-wrap' });
    if (!curve.length) { wrap.appendChild(App.el('div', { class: 'tag', style: 'padding:30px 0;text-align:center' }, 'Noch keine abgeschlossenen Trades.')); return wrap; }

    const pts = [{ i: 0, value: 0, date: '', trade: null }, ...curve];
    const values = pts.map((p) => p.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const range = max - min || 1;
    const stepX = (width - padX * 2) / (pts.length - 1 || 1);
    const yOf = (v) => padY + (1 - (v - min) / range) * (height - padY * 2);
    const coords = pts.map((p, i) => ({ x: padX + i * stepX, y: yOf(p.value), p }));
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const zeroY = yOf(0);
    const areaPath = `${linePath} L${coords.at(-1).x.toFixed(1)},${zeroY.toFixed(1)} L${coords[0].x.toFixed(1)},${zeroY.toFixed(1)} Z`;
    const gid = 'g' + Math.random().toString(36).slice(2, 8);

    wrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px;overflow:visible">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2)"/></linearGradient>
        <linearGradient id="${gid}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient>
      </defs>
      <line x1="${padX}" x2="${width - padX}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="var(--border)" stroke-dasharray="4 4"/>
      <path d="${areaPath}" fill="url(#${gid}a)" class="chart-area"/>
      <path d="${linePath}" fill="none" stroke="url(#${gid})" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="chart-line"/>
      <line class="cursor" x1="0" x2="0" y1="${padY - 6}" y2="${height - padY + 6}" stroke="var(--text-dim)" stroke-width="1" opacity="0"/>
      <circle class="cursor-dot" r="5" cx="0" cy="0" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
    </svg>`;
    const readout = App.el('div', { class: 'chart-readout' }, [App.el('span', {}, 'Antippen & ziehen für Details'), App.el('span', {})]);
    wrap.appendChild(readout);

    const svg = wrap.querySelector('svg');
    const cursor = wrap.querySelector('.cursor');
    const dot = wrap.querySelector('.cursor-dot');
    const scrub = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * width;
      let idx = Math.round((x - padX) / stepX);
      idx = Math.max(0, Math.min(coords.length - 1, idx));
      const c = coords[idx];
      cursor.setAttribute('x1', c.x); cursor.setAttribute('x2', c.x); cursor.setAttribute('opacity', 1);
      dot.setAttribute('cx', c.x); dot.setAttribute('cy', c.y); dot.setAttribute('opacity', 1);
      const t = c.p.trade;
      readout.innerHTML = '';
      readout.appendChild(App.el('span', {}, t ? `#${c.p.i} · ${App.formatDate(c.p.date)} · ${t.pair || t.trade || ''}` : 'Start'));
      readout.appendChild(App.el('b', { class: Calc.rClass(c.p.value) }, Calc.fmtR(c.p.value)));
    };
    wrap.addEventListener('pointerdown', (e) => { scrub(e.clientX); });
    wrap.addEventListener('pointermove', (e) => { if (e.pressure > 0 || e.pointerType === 'mouse') scrub(e.clientX); });

    requestAnimationFrame(() => {
      const path = wrap.querySelector('.chart-line');
      if (!path) return;
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect();
      path.style.transition = 'stroke-dashoffset var(--t-slow) var(--ease)';
      path.style.strokeDashoffset = '0';
      const area = wrap.querySelector('.chart-area');
      area.style.opacity = 0;
      area.style.transition = 'opacity var(--t-slow) var(--ease) 120ms';
      requestAnimationFrame(() => { area.style.opacity = 1; });
    });
    return wrap;
  },

  // Balken mit Vorzeichen (Net Daily R:R)
  bars(points, opts = {}) {
    const width = 340, height = opts.height || 130;
    const padX = 6, padY = 12;
    const wrap = App.el('div', { class: 'chart-wrap' });
    if (!points.length) { wrap.appendChild(App.el('div', { class: 'tag', style: 'padding:24px 0;text-align:center' }, 'Keine Daten.')); return wrap; }
    const vals = points.map((p) => p.value);
    const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
    const range = max - min || 1;
    const yOf = (v) => padY + (1 - (v - min) / range) * (height - padY * 2);
    const zeroY = yOf(0);
    const slot = (width - padX * 2) / points.length;
    const bw = Math.max(2, Math.min(22, slot * 0.7));
    const rects = points.map((p, i) => {
      const x = padX + i * slot + (slot - bw) / 2;
      const y = Math.min(yOf(p.value), zeroY);
      const h = Math.max(1.5, Math.abs(yOf(p.value) - zeroY));
      const color = p.value >= 0 ? 'var(--win)' : 'var(--loss)';
      return `<rect class="bar" data-i="${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" style="transform-origin:0 ${zeroY}px;transform:scaleY(0);transition:transform var(--t-slow) var(--ease) ${Math.min(i, 12) * 20}ms"/>`;
    }).join('');
    wrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px"><line x1="${padX}" x2="${width - padX}" y1="${zeroY}" y2="${zeroY}" stroke="var(--border)"/>${rects}</svg>`;
    const readout = App.el('div', { class: 'chart-readout' }, [App.el('span', {}, 'Tippe einen Balken an'), App.el('span', {})]);
    wrap.appendChild(readout);
    wrap.querySelectorAll('.bar').forEach((r) => r.addEventListener('click', () => {
      const p = points[Number(r.dataset.i)];
      readout.innerHTML = '';
      readout.appendChild(App.el('span', {}, p.label));
      readout.appendChild(App.el('b', { class: Calc.rClass(p.value) }, Calc.fmtR(p.value)));
    }));
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.querySelectorAll('.bar').forEach((r) => { r.style.transform = 'scaleY(1)'; })));
    return wrap;
  },

  // Donut: segments = [{value, color, label}]
  donut(segments, centerBig, centerSmall) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    const r = 52, c = 2 * Math.PI * r;
    const wrap = App.el('div', { class: 'donut-wrap' });
    const holder = App.el('div', { style: 'position:relative;flex-shrink:0' });
    let offset = 0;
    const circles = segments.map((s) => {
      const len = total ? (s.value / total) * c : 0;
      const html = `<circle class="donut-seg" cx="66" cy="66" r="${r}" stroke="${s.color}" stroke-dasharray="0 ${c}" stroke-dashoffset="${-offset}" data-len="${len}" data-c="${c}"/>`;
      offset += len;
      return html;
    }).join('');
    holder.innerHTML = `<svg viewBox="0 0 132 132" style="width:132px;height:132px;transform:rotate(-90deg)"><circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="14"/>${circles}</svg>`;
    holder.appendChild(App.el('div', { class: 'donut-center' }, [App.el('div', { class: 'big' }, centerBig), App.el('div', { class: 'tag' }, centerSmall || '')]));
    wrap.appendChild(holder);
    wrap.appendChild(App.el('div', { class: 'legend' }, segments.map((s) => App.el('div', {}, [App.el('i', { style: `background:${s.color}` }), `${s.label}: ${s.value}`]))));
    requestAnimationFrame(() => requestAnimationFrame(() => holder.querySelectorAll('.donut-seg').forEach((el) => {
      el.setAttribute('stroke-dasharray', `${Math.max(0, Number(el.dataset.len) - 1.5)} ${el.dataset.c}`);
    })));
    return wrap;
  },

  // Zeilen-Statistik (Winrate-Balken + Net R)
  statRows(rows, opts = {}) {
    const wrap = App.el('div');
    if (!rows.length) { wrap.appendChild(App.el('div', { class: 'tag', style: 'padding:10px 0' }, 'Noch keine Daten.')); return wrap; }
    const sorted = rows.slice();
    if (opts.sort) sorted.sort(opts.sort); else sorted.sort((a, b) => b.n - a.n);
    sorted.forEach((r, i) => {
      const bar = App.el('div', { class: 'wr-bar' }, [App.el('i')]);
      const decided = r.wins + r.losses;
      wrap.appendChild(App.el('div', { class: 'stat-row-line', style: `animation-delay:${i * 30}ms` }, [
        App.el('div', {}, [
          App.el('div', { class: 'nm' }, String(r.key)),
          App.el('div', { class: 'meta' }, `${r.n} Trade${r.n === 1 ? '' : 's'} · ${decided ? Math.round(r.winrate) + '% Winrate' : 'keine Wertung'}`),
        ]),
        App.el('div', { class: 'vals ' + Calc.rClass(r.net) }, Calc.fmtR(r.net)),
        decided ? bar : null,
      ]));
      App.fill(bar.firstChild, r.winrate / 100);
    });
    return wrap;
  },

  // Monatskalender mit Tages-R
  calendar(year, month, dailyMap, onDay) {
    const wrap = App.el('div');
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const grid = App.el('div', { class: 'cal-grid' });
    ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((d) => grid.appendChild(App.el('div', { class: 'cal-dow' }, d)));
    for (let i = 0; i < offset; i++) grid.appendChild(App.el('div', { class: 'cal-day empty' }));
    const today = App.todayStr();
    for (let d = 1; d <= days; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const v = dailyMap[key];
      const has = v !== undefined;
      const cls = 'cal-day' + (has ? (v > 0 ? ' win' : v < 0 ? ' loss' : ' be') : '') + (key === today ? ' today' : '');
      const cell = App.el('div', { class: cls, onclick: has && onDay ? () => onDay(key) : null }, [
        App.el('span', {}, String(d)),
        has ? App.el('span', { class: 'rr' }, (v > 0 ? '+' : '') + (Math.round(v * 10) / 10)) : null,
      ]);
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    return wrap;
  },
};
