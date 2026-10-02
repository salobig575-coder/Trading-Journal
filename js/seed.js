// Startdaten aus dem Notion "Journal 2026 Community" (Trading Model, Mistakes, Weekly Tracker, Backtest)
const Seed = {
  item(text, children) {
    return { id: DB.uid(), text, checked: false, children: (children || []).map((c) => (typeof c === 'string' ? this.item(c) : c)) };
  },

  async run() {
    if (await DB.getSetting('seeded', false)) return;
    const I = (t, c) => this.item(t, c);

    await DB.putRaw('checklists', {
      key: 'tradingModel',
      sections: [
        { title: 'BIAS', items: [
          I('Are we trading inside / rejecting a HTF PD Array?', ['15m/1h/4h FVG, OB, BRKR']),
          I('Did we sweep prominent HTF liquidity?', ['Previous trading session, previous day, ITH/ITL, inside of a FVG']),
          I('Is time aligned?', ['09:30-11:00']),
        ] },
        { title: 'ENTRY', items: [
          I('Is there EQL/EQH, IRL, data highs/lows, or an unfilled 5m, 15m?'),
          I('Is this the highest TF iFVG?'),
          I('Is there an internal liquidity sweep (TS)/smt?'),
          I('Are we in a premium/discount of the range?'),
        ] },
        { title: '?', items: [
          I('Have we already met the objective of the given trading session?'),
          I('Is there EQL/EQH or IRL where your SL should be?'),
          I('Do we have clear LTF structure confirming bias?'),
          I('Is there news coming up?'),
          I('Am I in a good mental state to be trading?'),
          I('Have I accepted the risk?'),
          I('Have I taken more than 2 trades today?'),
        ] },
        { title: 'RISK', items: [
          I('0.5 - 1% risk per trade on EVAL'),
          I('1 MICRO', ['75$ = 150 ticks', '50$ = 100 ticks']),
          I('2 MICROS', ['75$ = 75 ticks', '50$ = 50 ticks']),
          I('1 MINI', ['750$ = 150 ticks', '500$ = 100 ticks']),
        ] },
      ],
    });

    await DB.putRaw('checklists', {
      key: 'mistakes',
      sections: [{ title: '', items: [I('Risk amounts, $350 mffu, $500 tsx'), I('Patience')] }],
    });

    await DB.putRaw('collections', {
      id: 'seed-backtest-1', kind: 'backtests', name: 'Backtest 1', year: '2024', tags: [], url: '',
      body: 'Put backtest result and notes here', createdAt: Date.now(), updatedAt: Date.now(),
    });

    // Weekly Tracker: Eintraege aus dem Notion in die aktuelle Woche uebernehmen
    const key = App.weekKey(App.todayStr());
    const monday = App.weekStart(App.todayStr());
    const week = this.emptyWeek(key, monday);
    week.reminders[0] = 'BNQ at checkout';
    week.days.mon = ['Gym', 'Finish Homework', 'Backtest 1 week of data', 'USE code BNQ on my new eval'].map((t) => ({ text: t, checked: false }));
    await DB.putRaw('weeks', week);

    await DB.putRaw('settings', { key: 'seeded', value: true });
  },

  emptyWeek(key, start) {
    const blank = () => [{ text: '', checked: false }, { text: '', checked: false }];
    return {
      key, start, intention: '', affirmation: '',
      priorities: [{ text: '', checked: false }, { text: '', checked: false }, { text: '', checked: false }],
      reminders: ['', '', ''],
      days: { mon: blank(), tue: blank(), wed: blank(), thu: blank(), fri: blank(), sat: blank(), sun: blank() },
    };
  },

  // Demo-Trades zum Ausprobieren (mit demo:true markiert, einzeln loeschbar)
  async loadDemo() {
    const pairs = ['NQ', 'MNQ', 'ES'];
    const models = Options.get('models');
    const tfs = Options.get('timeframes');
    const dols = Options.get('dol');
    const macros = Options.get('macro');
    const pos = Options.get('po3');
    const trades = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const d = new Date();
    d.setDate(d.getDate() - 75);
    while (trades.length < 46 && d <= new Date()) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      if (rnd() < 0.35) continue;
      const roll = rnd();
      const result = roll < 0.48 ? 'Win' : roll < 0.58 ? 'Trailing Stop → Win' : roll < 0.64 ? 'BE → Win' : roll < 0.68 ? 'Tape' : roll < 0.9 ? 'Loss' : 'BE → Loss';
      const win = /Win$/.test(result);
      const date = App.todayStr(d);
      trades.push({
        id: DB.uid() + trades.length, demo: true, createdAt: d.getTime(),
        trade: `Demo Trade ${trades.length + 1}`, date, day: App.weekdayName(date), pair: pick(pairs),
        ls: rnd() < 0.5 ? 'Long' : 'Short', model: pick(models), po3: pick(pos),
        timeframes: [pick(tfs), pick(tfs)].filter((v, i, a) => a.indexOf(v) === i), dol: [pick(dols)], macro: [pick(macros)],
        rating: pick(Options.get('ratings')), result,
        rr: win ? Math.round((0.6 + rnd() * 3.4) * 10) / 10 : (result.startsWith('BE') ? 0.1 : 1),
        psych: '', notes: 'Demo-Daten – kannst du in den Einstellungen wieder entfernen.', images: {},
      });
    }
    await DB.putMany('trades', trades);
  },

  async removeDemo() {
    const all = await DB.getAll('trades');
    for (const t of all) if (t.demo) await DB.delete('trades', t.id);
  },
};
