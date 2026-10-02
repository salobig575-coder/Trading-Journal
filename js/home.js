// Home: ruhiger Tagesueberblick – Wochen-Ergebnis, Routine, Schnellzugriffe
const HomeView = {
  async render() {
    const wrap = App.el('div');
    const trades = await DB.getAll('trades');
    await Habits.load();
    const today = App.todayStr();
    const wk = App.weekStart(today);
    const week = trades.filter((t) => t.date >= wk && t.date <= App.addDays(wk, 6));
    const sw = Calc.summary(week);
    const sAll = Calc.summary(trades);
    const curve = Calc.curve(trades).slice(-28).map((p) => p.value);

    // ---- Hero ----
    const net = App.el('div', { class: 'big ' + Calc.rClass(sw.net) }, '0R');
    const hero = App.el('div', { class: 'hero' }, [
      App.el('div', { class: 'cap' }, `${App.greeting()} · Diese Woche`),
      net,
      App.el('div', { class: 'cap' }, week.length ? `${week.length} Trade${week.length === 1 ? '' : 's'} · ${Math.round(sw.winrate)}% Winrate` : 'Noch kein Trade in dieser Woche'),
      curve.length > 1 ? Charts.spark(curve) : App.el('div', { style: 'height:20px' }),
      App.el('div', { class: 'hero-stats' }, [
        App.el('div', {}, [App.el('div', { class: 'v' }, `${Math.round(sAll.winrate)}%`), App.el('div', { class: 'k' }, 'Winrate')]),
        App.el('div', {}, [App.el('div', { class: 'v' }, String(trades.length)), App.el('div', { class: 'k' }, 'Trades gesamt')]),
        App.el('div', {}, [App.el('div', { class: 'v ' + Calc.rClass(sAll.net) }, Calc.fmtR(sAll.net, 1)), App.el('div', { class: 'k' }, 'Gesamt')]),
      ]),
    ]);
    wrap.appendChild(hero);
    App.animateNumber(net, sw.net, { decimals: 1, suffix: 'R', signed: true, duration: 1100 });

    // ---- Backup-Erinnerung (nur ohne Cloud-Abgleich, ab 5 Trades, alle 14 Tage) ----
    const lastBackup = Number(localStorage.getItem('tj_last_backup') || 0);
    const snoozed = Number(localStorage.getItem('tj_backup_snooze') || 0);
    if (!Sync.loggedIn() && trades.length >= 5 && Date.now() - lastBackup > 14 * 86400000 && Date.now() > snoozed) {
      wrap.appendChild(App.el('div', { class: 'card', style: 'border-color:rgba(var(--accent-rgb),.5)' }, [
        App.el('div', { style: 'font-weight:600;font-size:1.0625rem' }, 'Zeit für ein Backup'),
        App.el('div', { class: 'tag', style: 'margin:4px 0 16px' }, lastBackup ? `Dein letztes Backup ist ${Math.floor((Date.now() - lastBackup) / 86400000)} Tage alt.` : 'Du hast noch kein Backup erstellt. Deine Daten liegen nur auf diesem Gerät.'),
        App.el('div', { class: 'btn-row', style: 'margin-top:0' }, [
          App.el('button', { class: 'btn secondary', onclick: () => { localStorage.setItem('tj_backup_snooze', String(Date.now() + 7 * 86400000)); App.refresh(); } }, 'Später'),
          App.el('button', { class: 'btn', onclick: async () => { await SettingsView.exportFile(); App.success('Backup gespeichert'); App.refresh(); } }, [App.icon('download'), 'Backup']),
        ]),
      ]));
    }

    // ---- Wochenrueckblick (ab Freitag 16 Uhr) ----
    const retro = await WeeklyRetro.pending();
    if (retro) {
      wrap.appendChild(App.el('button', { class: 'card row', style: 'width:100%;text-align:left;gap:16px;cursor:pointer;border-color:rgba(var(--accent-rgb),.5)', onclick: () => WeeklyRetro.open(retro) }, [
        App.el('div', { class: 'ic', style: 'width:44px;height:44px;border-radius:14px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0', html: Icons.review() }),
        App.el('div', { class: 'grow' }, [App.el('div', { style: 'font-weight:600;font-size:16px' }, 'Wochenrückblick'), App.el('div', { class: 'tag' }, 'Zwei Minuten: Was lief gut, was änderst du?')]),
        App.el('span', { html: Icons.chevronRight(), style: 'width:18px;height:18px;color:var(--dim)' }),
      ]));
    }

    // ---- Routine heute ----
    const active = Habits.activeOn(today);
    if (active.length) {
      const s = Habits.day(today);
      const ring = Charts.ring(64, 7, s.pct);
      ring.appendChild(App.el('div', { class: 'ring-in' }, [App.el('div', { style: 'font-family:var(--display);font-weight:700;font-size:15px' }, `${Math.round(s.pct * 100)}%`)]));
      const st = Habits.streak(today);
      wrap.appendChild(App.el('button', { class: 'card row', style: 'width:100%;text-align:left;gap:18px;cursor:pointer', onclick: () => App.navigate('routine') }, [
        ring,
        App.el('div', { class: 'grow' }, [
          App.el('div', { style: 'font-weight:600;font-size:16px' }, s.complete ? 'Routine komplett' : 'Deine Routine heute'),
          App.el('div', { class: 'tag', style: 'margin-top:2px' }, `${s.doneCount} von ${s.count} erledigt · ${s.earned}/${s.max} XP`),
        ]),
        st > 0 ? App.el('div', { class: 'streak', style: 'font-size:18px' }, [App.el('span', { html: Icons.flame() }), String(st)]) : App.el('span', { html: Icons.chevronRight(), style: 'width:18px;height:18px;color:var(--dim)' }),
      ]));
    }

    // ---- Schnellzugriff ----
    const quick = (icon, t, s, fn) => App.el('button', { class: 'quick', onclick: fn }, [
      App.el('div', { class: 'ic', html: Icons[icon]() }),
      App.el('div', {}, [App.el('div', { class: 't' }, t), App.el('div', { class: 's' }, s)]),
    ]);
    wrap.appendChild(App.el('div', { class: 'quick-grid' }, [
      quick('target', 'Trading Model', 'Bias · Entry · Risk', () => ChecklistPage.open('tradingModel', 'Trading Model')),
      quick('checklist', 'Checklist', 'Mech & Continuation', () => ChecklistPage.open('modelChecklist', 'Checklist')),
      quick('clipboard', 'Weekly Tracker', 'Wochenplaner', () => WeeklyTracker.open()),
      quick('library', 'Bibliothek', 'Mistakes, Edu, Backtests …', () => LibraryPage.open()),
    ]));
    return wrap;
  },
};

const LibraryPage = {
  open() { App.openPage('Bibliothek', () => this.render()); },

  render() {
    const row = (icon, t, s, fn) => App.el('div', { class: 'item clickable', onclick: fn }, [
      App.el('div', { class: 'ic', style: 'width:40px;height:40px;border-radius:13px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0', html: Icons[icon]() }),
      App.el('div', { class: 'grow' }, [App.el('div', { class: 'item-title' }, t), App.el('div', { class: 'item-meta' }, s)]),
      App.el('span', { html: Icons.chevronRight(), style: 'width:18px;height:18px;color:var(--dim)' }),
    ]);
    const wrap = App.el('div');
    wrap.appendChild(App.el('div', { class: 'section-title', style: 'margin-top:4px' }, 'Tools'));
    wrap.appendChild(App.el('div', { class: 'list' }, [
      row('target', 'Risiko-Rechner', 'Kontrakte aus Konto, Risiko & SL', () => RiskCalc.open()),
    ]));
    wrap.appendChild(App.el('div', { class: 'section-title' }, 'Performance'));
    wrap.appendChild(App.el('div', { class: 'list' }, [
      row('alert', 'Mistakes', 'Typische Fehler vermeiden', () => ChecklistPage.open('mistakes', 'Mistakes', 'Write here your common mistakes, and try to avoid them next time')),
    ]));
    wrap.appendChild(App.el('div', { class: 'section-title' }, 'Resource Vault'));
    wrap.appendChild(App.el('div', { class: 'list' }, [
      row('book', 'Edu Content', 'Lerninhalte', () => Collections.page('edu')),
      row('dna', 'Bio Concepts', 'Konzepte', () => Collections.page('bio')),
      row('flask', 'Backtests', 'Nach Jahr sortiert', () => Collections.page('backtests')),
    ]));
    wrap.appendChild(App.el('div', { class: 'section-title' }, 'Prop Firms'));
    wrap.appendChild(App.el('div', { class: 'list' }, [
      row('wallet', 'Prop-Konten', 'Ziel, Drawdown & Tageslimit', () => PropAccounts.open()),
      row('shield', 'Prop Firms', 'Firmen & Regeln', () => Collections.page('propfirms')),
    ]));
    return wrap;
  },
};
