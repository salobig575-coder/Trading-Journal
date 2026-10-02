// Layout-Rundgang: oeffnet alle Seiten, Dialoge und Formulare und meldet horizontalen Overflow,
// abgeschnittene Texte und Konsolenfehler. Aufruf in der Browser-Konsole: await __sweep('iPhone 390x844')
(function () {
  const st = document.createElement('style');
  st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}.rv{opacity:1!important;transform:none!important}';
  document.head.appendChild(st);

  window.__sweep = async function (label) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = { label, w: innerWidth, issues: [] }; const errs = [];
    console.warn = (...a) => errs.push(a.map((x) => (x && x.message) || x).join(' '));
    window.addEventListener('error', (e) => errs.push(e.message + '@' + (e.filename || '').split('/').pop() + ':' + e.lineno));
    const skip = '.seg,.chip-scroll,.tour-viewport,.lightbox,.update-bar,.toast,.celebrate,.offline-pill,.lockscreen,svg,#splash,.navbar,.habit-kids';
    const check = (name) => {
      const doc = document.documentElement.scrollWidth > innerWidth + 1;
      const bad = [...document.querySelectorAll('body *')].filter((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest(skip) || getComputedStyle(e).position === 'fixed') return false;
        return r.right > innerWidth + 1 || r.left < -1;
      }).slice(0, 3).map((e) => e.tagName + '.' + String(e.className).slice(0, 30));
      const clipped = [...document.querySelectorAll('.item-title,.nm,.btn,.chip,.pill,.tile .t,.quick .t,.stat-tile .lbl,.hero .cap,.hero-count,.streak-chip,.xp')]
        .filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).textOverflow !== 'ellipsis' && getComputedStyle(e).overflow !== 'visible')
        .slice(0, 3).map((e) => e.className.slice(0, 25) + ':' + e.textContent.slice(0, 20));
      if (doc || bad.length || clipped.length) res.issues.push({ name, doc, bad, clipped });
    };
    const go = async (fn, name, ms = 900) => { try { await fn(); await sleep(ms); check(name); } catch (e) { res.issues.push({ name, err: e.message }); } };
    await go(() => App.navigate('home'), 'home');
    JournalHub.activeTab = 'trades'; JournalView.layout = 'list'; JournalView.filtersOpen = false; await go(() => App.navigate('journal'), 'journal-list');
    await go(() => { JournalView.layout = 'gallery'; App.refresh(); }, 'journal-gallery'); JournalView.layout = 'list';
    await go(() => { JournalView.filtersOpen = true; App.refresh(); }, 'journal-filter'); JournalView.filtersOpen = false;
    JournalHub.activeTab = 'analysis'; await go(() => App.navigate('journal'), 'analysis');
    JournalHub.activeTab = 'review'; await go(() => App.navigate('journal'), 'review'); JournalHub.activeTab = 'trades';
    RoutineView.editing = false; await go(() => App.navigate('routine'), 'routine');
    RoutineView.editing = true; await go(() => App.navigate('routine'), 'routine-edit', 1200); RoutineView.editing = false;
    for (const t of ['overview', 'week', 'equity', 'calendar', 'setups', 'time']) { StatsHub.activeTab = t; await go(() => App.navigate('stats'), 'stats-' + t, 1000); }
    StatsHub.filtersOpen = true; await go(() => App.navigate('stats'), 'stats-filter'); StatsHub.filtersOpen = false;
    await go(() => LibraryPage.open(), 'library'); await go(() => App.back(), 'back', 500);
    await go(() => RiskCalc.open(), 'risk'); await go(() => App.back(), 'back', 500);
    await go(() => WeeklyTracker.open(), 'weekly'); await go(() => App.back(), 'back', 500);
    await go(() => ChecklistPage.open('tradingModel', 'Trading Model'), 'model'); await go(() => App.back(), 'back', 500);
    await go(() => PropAccounts.open(), 'prop'); await go(() => App.back(), 'back', 500);
    await go(() => Collections.page('backtests'), 'backtests'); await go(() => App.back(), 'back', 500);
    await go(() => TradeForm.open(), 'tradeform', 1300); localStorage.removeItem('tj_trade_draft'); await go(() => App.back(), 'back', 500);
    const t = (await DB.getAll('trades'))[0];
    if (t) { await go(() => TradeDetail.open(t), 'trade-detail'); App.closeModal(); await sleep(450); }
    await go(() => SettingsView.open(), 'settings', 1200); App.closeModal(); await sleep(450);
    await go(() => RoutineView.addSheet(), 'routine-add'); App.closeModal(); await sleep(450);
    await go(() => App.quickAdd(), 'quickadd'); App.closeModal(); await sleep(450);
    await go(() => { App.confirm('Test löschen?'); }, 'confirm'); document.querySelectorAll('.modal-backdrop').forEach((e) => e.remove());
    App.navigate('home'); await sleep(500);
    res.errs = errs; return JSON.stringify(res);
  };
})();
