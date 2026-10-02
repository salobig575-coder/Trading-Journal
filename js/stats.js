// Statistik-Hub: Uebersicht, Equity Curve, Monthly Performance, Kalender, Setup Stats, Zeit-Stats, W/L/B
const StatsHub = {
  activeTab: 'overview',
  year: new Date().getFullYear(),
  calMonth: App.todayStr().slice(0, 7),
  wlb: 'win',
  tabs: [
    { key: 'overview', label: 'Übersicht' },
    { key: 'week', label: 'Woche' },
    { key: 'equity', label: 'Equity' },
    { key: 'calendar', label: 'Kalender' },
    { key: 'setups', label: 'Setups' },
    { key: 'time', label: 'Zeit' },
  ],

  async render() {
    const wrap = App.el('div');
    wrap.appendChild(App.tabBar(this.tabs, this.activeTab, (k) => { this.activeTab = k; App.refresh(); }));
    const trades = await DB.getAll('trades');
    if (!trades.length) {
      wrap.appendChild(App.empty('stats', 'Sobald du Trades einträgst, entstehen hier deine Statistiken.'));
      wrap.appendChild(App.el('button', { class: 'btn secondary', onclick: async () => { await Seed.loadDemo(); App.refresh(); } }, [App.icon('sparkles'), 'Mit Demo-Daten ausprobieren']));
      return wrap;
    }
    const tab = this.tabs.some((t) => t.key === this.activeTab) ? this.activeTab : 'overview';
    if (tab === 'calendar') {
      wrap.appendChild(this.calendar(trades));
      wrap.appendChild(this.months(trades));
    } else wrap.appendChild(await this[tab](trades));
    return wrap;
  },

  card(title, icon, ...children) {
    return App.el('div', { class: 'card' }, [App.el('h2', {}, [App.icon(icon, 14), title]), ...children]);
  },

  tile(label, value, cls = '') {
    return App.el('div', { class: 'stat-tile' }, [App.el('div', { class: 'lbl' }, label), App.el('div', { class: 'num ' + cls }, value)]);
  },

  overview(trades) {
    const s = Calc.summary(trades);
    const wrap = App.el('div');
    const mk = (label, to, opts, cls) => {
      const t = this.tile(label, '0', cls);
      App.animateNumber(t.querySelector('.num'), to, opts);
      return t;
    };
    wrap.appendChild(App.el('div', { class: 'stat-grid' }, [
      mk('Trades', s.total, {}),
      mk('Winrate', s.winrate, { suffix: '%' }),
      mk('Net R', s.net, { decimals: 1, suffix: 'R', signed: true }, Calc.rClass(s.net)),
      mk('Profit Factor', s.profitFactor, { decimals: 2 }),
    ]));
    wrap.appendChild(App.el('div', { class: 'stat-grid three' }, [
      mk('Ø Win', s.avgWin, { decimals: 1, suffix: 'R' }, 'pos'),
      mk('Ø Loss', s.avgLoss, { decimals: 1, suffix: 'R' }, 'neg'),
      mk('Max DD', s.maxDD, { decimals: 1, suffix: 'R' }, 'neg'),
    ]));
    wrap.appendChild(this.card('Win / Loss / B/E', 'trophy', Charts.donut([
      { value: s.wins, color: 'var(--win)', label: 'Wins' },
      { value: s.losses, color: 'var(--loss)', label: 'Losses' },
      { value: s.be, color: 'var(--be)', label: 'B/E' },
      { value: s.tape, color: 'var(--text-dim)', label: 'Tape' },
    ], `${Math.round(s.winrate)}%`, 'Winrate')));
    wrap.appendChild(this.card('Equity Curve (kumulierte R)', 'trend', Charts.equity(Calc.curve(trades), { height: 150 })));
    wrap.appendChild(this.card('Erwartungswert', 'target',
      App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num ' + Calc.rClass(s.expectancy) }, Calc.fmtR(s.expectancy)), App.el('div', { class: 'lbl' }, 'pro Trade')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num pos' }, Calc.fmtR(s.best, 1)), App.el('div', { class: 'lbl' }, 'Bester Trade')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num neg' }, Calc.fmtR(s.worst, 1)), App.el('div', { class: 'lbl' }, 'Schlechtester')]),
      ])));
    return wrap;
  },

  // Wochen-Auswertung: Ergebnis, beste/schlechteste Trades, Routine und deren Zusammenhang mit deinem R
  async week(trades) {
    await Habits.load();
    const wrap = App.el('div');
    const today = App.todayStr();
    if (!this.weekStart) this.weekStart = App.weekStart(today);
    const start = this.weekStart, end = App.addDays(start, 6);
    const w = App.isoWeek(start).week;
    const shift = (n) => { this.weekStart = App.addDays(start, n * 7); App.refresh(); };
    wrap.appendChild(App.el('div', { class: 'cal-head' }, [
      App.el('button', { class: 'icon-btn', html: Icons.chevronLeft(), onclick: () => shift(-1) }),
      App.el('div', { class: 'ttl' }, `KW ${w} · ${App.formatDate(start).slice(0, 5)} – ${App.formatDate(end).slice(0, 5)}`),
      App.el('button', { class: 'icon-btn', style: end >= today ? 'opacity:.25;pointer-events:none' : '', html: Icons.chevronRight(), onclick: () => shift(1) }),
    ]));

    const wt = Calc.sort(trades.filter((t) => t.date >= start && t.date <= end));
    const s = Calc.summary(wt);
    wrap.appendChild(App.el('div', { class: 'stat-grid three' }, [
      this.tile('Trades', String(wt.length)), this.tile('Winrate', `${Math.round(s.winrate)}%`), this.tile('Net R', Calc.fmtR(s.net, 1), Calc.rClass(s.net)),
    ]));

    const closed = wt.filter((t) => ['win', 'loss', 'be'].includes(Calc.outcome(t)));
    if (closed.length) {
      const byR = closed.slice().sort((a, b) => Calc.rValue(b) - Calc.rValue(a));
      const line = (label, t, cls) => App.el('div', { class: 'row between', style: 'padding:6px 0' }, [
        App.el('div', {}, [App.el('div', { class: 'tag' }, label), App.el('div', { style: 'font-weight:600' }, t.trade || t.pair || 'Trade')]),
        App.el('div', { class: 'r-val ' + cls }, Calc.fmtR(Calc.rValue(t), 1)),
      ]);
      wrap.appendChild(this.card('Highlights', 'trophy', line('Bester Trade', byR[0], 'pos'), line('Schwächster Trade', byR.at(-1), Calc.rClass(Calc.rValue(byR.at(-1))))));
      const daily = Calc.dailyR(wt);
      wrap.appendChild(this.card('Ergebnis pro Tag', 'stats', Charts.bars(Habits.weekDates(start).filter((d) => daily[d] !== undefined).map((d) => ({ label: App.formatDate(d), value: Math.round(daily[d] * 100) / 100 })), { height: 110 })));
    } else {
      wrap.appendChild(App.empty('journal', 'Keine abgeschlossenen Trades in dieser Woche.'));
    }

    // Routine dieser Woche
    const r = Habits.range(Habits.weekDates(start));
    if (r.max) {
      const bar = App.el('div', { class: 'progress' }, [App.el('i')]);
      wrap.appendChild(this.card('Routine in dieser Woche', 'routine',
        App.el('div', { class: 'score-line' }, [App.el('div', { class: 'pct' }, `${Math.round(r.pct * 100)}%`), App.el('div', { class: 'tag' }, `${r.earned} / ${r.max} XP`)]), bar));
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.firstChild.style.width = r.pct * 100 + '%'; }));
    }

    // Zusammenhang Routine <-> Ergebnis (alle Tage)
    const dailyAll = Calc.dailyR(trades);
    const hi = [], lo = [];
    Object.keys(dailyAll).forEach((d) => {
      const ds = Habits.day(d);
      if (!ds.max) return;
      (ds.pct >= 0.8 ? hi : lo).push(dailyAll[d]);
    });
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const insight = (hi.length >= 3 && lo.length >= 3)
      ? App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num ' + Calc.rClass(avg(hi)) }, Calc.fmtR(avg(hi), 1)), App.el('div', { class: 'lbl' }, `Routine ≥ 80 % (${hi.length} Tage)`)]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num ' + Calc.rClass(avg(lo)) }, Calc.fmtR(avg(lo), 1)), App.el('div', { class: 'lbl' }, `Routine < 80 % (${lo.length} Tage)`)]),
      ])
      : App.el('div', { class: 'tag' }, 'Sobald du an mindestens je 3 Tagen mit und ohne starke Routine getradet hast, siehst du hier, wie sich deine Routine auf dein Ø-Tagesergebnis auswirkt.');
    wrap.appendChild(this.card('Routine & Ergebnis', 'sparkles', insight));

    if (wt.length) wrap.appendChild(App.el('div', { class: 'list' }, wt.slice().reverse().map((t, i) => JournalView.tradeItem(t, i))));
    return wrap;
  },

  equity(trades) {
    const wrap = App.el('div');
    const curve = Calc.curve(trades);
    const s = Calc.summary(trades);
    wrap.appendChild(this.card('Cumulative R:R', 'trend', Charts.equity(curve, { height: 200 }),
      App.el('div', { class: 'stat-row', style: 'margin-top:12px' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num ' + Calc.rClass(s.net) }, Calc.fmtR(s.net, 1)), App.el('div', { class: 'lbl' }, 'Gesamt')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num neg' }, Calc.fmtR(-s.maxDD, 1)), App.el('div', { class: 'lbl' }, 'Max Drawdown')]),
      ])));
    const daily = Calc.dailyR(trades);
    const days = Object.keys(daily).sort().slice(-30);
    wrap.appendChild(this.card('Net Daily R:R (letzte 30 Handelstage)', 'stats', Charts.bars(days.map((d) => ({ label: App.formatDate(d), value: Math.round(daily[d] * 100) / 100 })))));
    return wrap;
  },

  months(trades) {
    const wrap = App.el('div');
    const years = [...new Set(trades.map((t) => (t.date || '').slice(0, 4)).filter(Boolean))].sort();
    if (!years.includes(String(this.year))) this.year = Number(years.at(-1));
    wrap.appendChild(App.el('div', { class: 'cal-head' }, [
      App.el('button', { class: 'icon-btn', html: Icons.chevronLeft(), onclick: () => { this.year--; App.refresh(); } }),
      App.el('div', { class: 'ttl' }, String(this.year)),
      App.el('button', { class: 'icon-btn', html: Icons.chevronRight(), onclick: () => { this.year++; App.refresh(); } }),
    ]));
    const inYear = trades.filter((t) => (t.date || '').startsWith(String(this.year)));
    const rows = Calc.group(inYear, (t) => Number(t.date.slice(5, 7)) - 1).map((r) => ({ ...r, key: r.key }));
    const byMonth = new Map(rows.map((r) => [r.key, r]));
    const full = Array.from({ length: 12 }, (_, m) => byMonth.get(m) || { key: m, n: 0, wins: 0, losses: 0, winrate: 0, net: 0 });
    wrap.appendChild(this.card('Monthly Performance', 'calendar', Charts.bars(full.map((r) => ({ label: App.monthName(r.key), value: Math.round(r.net * 100) / 100 })), { height: 120 })));
    wrap.appendChild(this.card('Monate', 'calendar', Charts.statRows(full.filter((r) => r.n).map((r) => ({ ...r, key: App.monthName(r.key) + ' ' + this.year })), { sort: (a, b) => 0 })));
    return wrap;
  },

  calendar(trades) {
    const wrap = App.el('div');
    const [y, m] = this.calMonth.split('-').map(Number);
    const shift = (n) => { this.calMonth = App.todayStr(new Date(y, m - 1 + n, 1)).slice(0, 7); App.refresh(); };
    const daily = Calc.dailyR(trades);
    const monthTrades = trades.filter((t) => (t.date || '').startsWith(this.calMonth));
    const s = Calc.summary(monthTrades);
    wrap.appendChild(App.el('div', { class: 'cal-head' }, [
      App.el('button', { class: 'icon-btn', html: Icons.chevronLeft(), onclick: () => shift(-1) }),
      App.el('div', { class: 'ttl' }, `${App.monthName(m - 1)} ${y}`),
      App.el('button', { class: 'icon-btn', html: Icons.chevronRight(), onclick: () => shift(1) }),
    ]));
    wrap.appendChild(App.el('div', { class: 'card' }, [Charts.calendar(y, m - 1, daily, (day) => this.dayTrades(trades, day))]));
    wrap.appendChild(App.el('div', { class: 'stat-grid three' }, [
      this.tile('Trades', String(s.total)), this.tile('Winrate', `${Math.round(s.winrate)}%`), this.tile('Net R', Calc.fmtR(s.net, 1), Calc.rClass(s.net)),
    ]));
    return wrap;
  },

  dayTrades(trades, day) {
    const list = Calc.sort(trades).filter((t) => t.date === day);
    const content = App.el('div', {}, [
      App.el('h3', {}, `${App.weekdayName(day)}, ${App.formatDate(day)}`),
      App.el('div', { class: 'list' }, list.map((t, i) => JournalView.tradeItem(t, i))),
      App.el('button', { class: 'btn secondary', style: 'margin-top:12px', onclick: () => App.closeModal() }, 'Schließen'),
    ]);
    App.showModal(content);
  },

  setups(trades) {
    const wrap = App.el('div');
    wrap.appendChild(this.card('Setup Stats – Entry (Timeframes)', 'target', Charts.statRows(Calc.group(trades, (t) => t.timeframes || []))));
    wrap.appendChild(this.card('Setup Type – Long / Short', 'trend', Charts.statRows(Calc.group(trades, (t) => t.ls))));
    wrap.appendChild(this.card('Models', 'shield', Charts.statRows(Calc.group(trades, (t) => t.model))));
    wrap.appendChild(this.card('PO3', 'clipboard', Charts.statRows(Calc.group(trades, (t) => t.po3))));
    wrap.appendChild(this.card('DoL', 'flag', Charts.statRows(Calc.group(trades, (t) => t.dol || []))));
    wrap.appendChild(this.card('Entry-Typen', 'sparkles', Charts.statRows(Calc.group(trades, (t) => t.entryTypes || []))));
    wrap.appendChild(this.card('Rating', 'trophy', Charts.statRows(Calc.group(trades, (t) => t.rating), { sort: (a, b) => String(a.key).localeCompare(String(b.key)) })));
    wrap.appendChild(this.card('Tickers', 'journal', Charts.statRows(Calc.group(trades, (t) => t.pair))));
    wrap.appendChild(this.card('Results', 'check', Charts.statRows(Calc.group(trades, (t) => t.result))));
    return wrap;
  },

  time(trades) {
    const wrap = App.el('div');
    const order = Options.get('macro');
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    wrap.appendChild(this.card('Weekdays – Daily Stats', 'calendar', Charts.statRows(Calc.group(trades, (t) => t.day || (t.date ? App.weekdayName(t.date) : '')), { sort: (a, b) => dayOrder.indexOf(a.key) - dayOrder.indexOf(b.key) })));
    wrap.appendChild(this.card('Killzones / Macros', 'review', Charts.statRows(Calc.group(trades, (t) => t.macro || []), { sort: (a, b) => order.indexOf(a.key) - order.indexOf(b.key) })));
    wrap.appendChild(this.card('Years', 'calendar', Charts.statRows(Calc.group(trades, (t) => (t.date || '').slice(0, 4)), { sort: (a, b) => String(b.key).localeCompare(String(a.key)) })));
    wrap.appendChild(this.card('Monate im Jahr', 'calendar', Charts.statRows(Calc.group(trades, (t) => t.date ? App.monthName(Number(t.date.slice(5, 7)) - 1) : ''), {
      sort: (a, b) => Array.from({ length: 12 }, (_, i) => App.monthName(i)).indexOf(a.key) - Array.from({ length: 12 }, (_, i) => App.monthName(i)).indexOf(b.key),
    })));
    return wrap;
  },

  wlb(trades) {
    const wrap = App.el('div');
    const kinds = [['win', 'Wins', 'win'], ['loss', 'Losses', 'loss'], ['be', 'B/E', 'be'], ['tape', 'Tape', '']];
    const bar = App.el('div', { class: 'chip-group', style: 'margin-bottom:14px' }, kinds.map(([k, label, cls]) => App.el('button', {
      class: `chip ${cls}` + (this.wlb === k ? ' active' : ''), onclick: () => { this.wlb = k; App.refresh(); },
    }, `${label} (${trades.filter((t) => Calc.outcome(t) === k).length})`)));
    wrap.appendChild(bar);
    const list = Calc.sort(trades.filter((t) => Calc.outcome(t) === this.wlb)).reverse();
    if (!list.length) wrap.appendChild(App.empty('trophy', 'Keine Trades in dieser Kategorie.'));
    else wrap.appendChild(JournalView.tradeList(list, 'gallery'));
    return wrap;
  },
};
