// Auswahllisten (aus dem Notion "Journal 2026 Community" uebernommen, jederzeit in den Einstellungen aenderbar)
const Options = {
  labels: {
    pairs: 'Pairs / Ticker',
    models: 'Models',
    po3: 'PO3',
    ls: 'Long / Short',
    timeframes: 'Entry (Timeframes / Setups)',
    entryTypes: 'Entry-Typen (Archiv)',
    dol: 'DoL (Draw on Liquidity)',
    macro: 'Macro / Killzones',
    ratings: 'Ratings',
    results: 'Ergebnisse (W/L)',
    biases: 'Bias-Ergebnis (W/L Archiv)',
    pl: 'P/L (Archiv)',
    analysisPairs: 'Pairs (Pre-Session Analyse)',
    mistakes: 'Fehler-Tags',
  },

  defaults: {
    pairs: ['NQ', 'MNQ', 'ES', 'MES', 'EURUSD', 'GBPUSD', 'USOIL', 'GOLD', 'DXY'],
    models: ['RBC 5/15m', 'RBC 30m+'],
    po3: ['9:30', '9:30 + 9:45', '10:00', '10:00 + 10:15', '10:00 + 10:30', '10:30', '10:30 + 10:45', 'No Po3'],
    ls: ['Long', 'Short'],
    timeframes: [
      'HTF EQ + FVG', 'HTF OTE + FVG', 'HTF OTE GP + FVG', 'HTF SMT', 'Daily FVG', '4H ITX', '1H ITX', '30M ITX',
      '30m+ FVG', '15m FVG', '5m FVG', '1m RB', '5m RB', '1m RW', '5m RW', '5m RB CE',
      'LTF EQ', 'LTF OTE', 'LTF OTE GP', 'SH', 'TM', 'NO TM',
    ],
    entryTypes: ['🐢', '2022', 'Unicorn', 'Inversion', 'CISD', 'SMT', 'OB', 'FVG', 'RB', 'BRKR', 'Hydra', 'ORG', 'Fail', 'BPR', 'ABS 1:1', '15s/30s Inversion', '1-3M inversion', '5M+ Inversion'],
    dol: [
      'Engineered', 'Swing H/L', 'eng+ERL', 'EQX', 'Imbalance', 'Failure swing X', 'REX', 'HTF allignment', 'High Resistance Liq', 'PD-X', '1:1',
      'Session Liquidity', 'HR', 'REQL', 'LR', 'Range OTE', 'Data X', 'EQ-X', 'Intermediate-X', 'ERL',
    ],
    macro: ['7:20-7:40?', '8:20-8:40', '8:50-9:10', '9:50-10:10', '10:20-10:40', '10:50-11:10', '11:20-11:40', '11:50-12:10', '12:20-12:40', '12:50-13:10', '13:10-13:40', '13:50-14:10', '14:20-14:40', '14:50-15:10', '15:50-16:10', 'EOD macro', 'None'],
    ratings: ['A+', 'A', 'B+', 'B', 'C'],
    results: ['Win', 'Trailing Stop → Win', 'BE → Win', 'Tape', 'Loss', 'Trailing Stop → Loss', 'BE → Loss'],
    biases: ['Win', 'Loss', 'no bias', 'B/E'],
    pl: ['Profit', 'Loss', 'B/E', 'Tape'],
    analysisPairs: ['EURUSD', 'GBPUSD', 'USOIL', 'GOLD', 'DXY', 'NQ', 'ES'],
    mistakes: ['Zu früh rein', 'Zu spät rein', 'SL verschoben', 'Zu früh raus', 'FOMO / Revenge', 'Zu groß gehandelt', 'Kein klares Setup', 'Regeln ignoriert', 'News ignoriert'],
  },

  data: {},

  async load() {
    const saved = await DB.getSetting('options', {});
    this.data = {};
    for (const k of Object.keys(this.defaults)) {
      this.data[k] = Array.isArray(saved[k]) ? saved[k] : this.defaults[k].slice();
    }
  },

  get(key) { return this.data[key] || []; },

  async set(key, list) {
    this.data[key] = list;
    await DB.setSetting('options', this.data);
  },

  async reset(key) {
    await this.set(key, this.defaults[key].slice());
  },
};
