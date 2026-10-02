// Home = "Menu" aus dem Notion: Heute-Ueberblick, Schnellaktionen, Kachel-Menue
const HomeView = {
  async render() {
    const wrap = App.el('div');
    const trades = await DB.getAll('trades');
    const today = App.todayStr();
    const wk = App.weekStart(today);
    const week = trades.filter((t) => t.date >= wk && t.date <= App.addDays(wk, 6));
    const todays = trades.filter((t) => t.date === today);
    const sw = Calc.summary(week);
    const sAll = Calc.summary(trades);

    const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const netEl = App.el('div', { class: 'num' }, '0R');
    const hero = App.el('div', { class: 'card hero' }, [
      App.el('h2', {}, 'Journal 2026 Community'),
      App.el('div', { style: 'font-size:19px;font-weight:800;margin-bottom:2px' }, `${App.greeting()} 👋`),
      App.el('div', { style: 'font-size:13px;opacity:.85' }, dateLabel),
      App.el('div', { class: 'quote', style: 'margin-bottom:14px' }, '“a Year of Data..”'),
      App.el('div', { class: 'stat-row' }, [
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, String(todays.length)), App.el('div', { class: 'lbl' }, 'Trades heute')]),
        App.el('div', { class: 'stat' }, [netEl, App.el('div', { class: 'lbl' }, 'Woche (Net R)')]),
        App.el('div', { class: 'stat' }, [App.el('div', { class: 'num' }, `${Math.round(sAll.winrate)}%`), App.el('div', { class: 'lbl' }, 'Winrate gesamt')]),
      ]),
    ]);
    wrap.appendChild(hero);
    App.animateNumber(netEl, sw.net, { decimals: 1, suffix: 'R', signed: true });

    // Die drei Schnell-Buttons aus dem Notion
    wrap.appendChild(App.el('div', { class: 'fab-row' }, [
      App.el('button', { class: 'btn', onclick: () => TradeForm.open() }, [App.icon('plus'), 'Trade']),
      App.el('button', { class: 'btn secondary', onclick: () => { App.goTab('analyse', AnalyseHub, 'analysis'); setTimeout(() => AnalysisView.chooseTemplate(), 350); } }, [App.icon('plus'), 'Analyse']),
      App.el('button', { class: 'btn secondary', onclick: () => { App.goTab('analyse', AnalyseHub, 'review'); setTimeout(() => Collections.edit('review'), 350); } }, [App.icon('plus'), 'Review']),
    ]));

    const tile = (name, sub, icon, onclick, i) => App.el('button', { class: 'tile', style: `animation-delay:${i * 35}ms`, onclick }, [
      App.el('div', { class: 't-ic', html: Icons[icon]() }), App.el('div', { class: 't-name' }, name), App.el('div', { class: 't-sub' }, sub),
    ]);
    const section = (title, tiles) => {
      wrap.appendChild(App.el('div', { class: 'section-title' }, title));
      wrap.appendChild(App.el('div', { class: 'tile-grid' }, tiles.map((t, i) => tile(...t, i))));
    };

    section('Daily Essentials', [
      ['Weekly Tracker', 'Wochenplaner', 'clipboard', () => WeeklyTracker.open()],
      ['Review', 'Review DB', 'review', () => App.goTab('analyse', AnalyseHub, 'review')],
      ['My Analysis', 'Pre-Session', 'analyse', () => App.goTab('analyse', AnalyseHub, 'analysis')],
      ['Journal', 'Alle Trades', 'journal', () => App.navigate('journal')],
    ]);
    section('Performance', [
      ['Statistics', 'Setups, Zeiten, Ergebnisse', 'stats', () => App.goTab('stats', StatsHub, 'overview')],
      ['Equity Curve', 'Cumulative R:R', 'trend', () => App.goTab('stats', StatsHub, 'equity')],
      ['W/L/B Trades', 'Wins, Losses, B/E', 'trophy', () => App.goTab('stats', StatsHub, 'wlb')],
      ['Monthly Performance', 'Monat für Monat', 'calendar', () => App.goTab('stats', StatsHub, 'months')],
      ['Mistakes', 'Typische Fehler', 'alert', () => ChecklistPage.open('mistakes', 'Mistakes', 'Write here your common mistakes, and try to avoid them next time')],
      ['Trading Model', 'Checkliste', 'target', () => ChecklistPage.open('tradingModel', 'Trading Model', 'Paste here your trading model')],
    ]);
    section('Resource Vault', [
      ['Edu Content', 'Lerninhalte', 'book', () => Collections.page('edu')],
      ['Bio Concepts', 'Konzepte', 'dna', () => Collections.page('bio')],
      ['Backtests', 'Nach Jahr', 'flask', () => Collections.page('backtests')],
    ]);
    section('Prop Firms', [
      ['Prop Firms', 'Firmen & Regeln', 'shield', () => Collections.page('propfirms')],
    ]);
    return wrap;
  },
};
