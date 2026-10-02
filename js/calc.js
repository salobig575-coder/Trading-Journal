// Auswertungen: Win/Loss-Klassifizierung, R-Werte, Equity-Kurve, Gruppen-Statistiken
const Calc = {
  outcome(t) {
    const r = (t.result || '').toLowerCase();
    if (r) {
      if (r.includes('tape')) return 'tape';
      if (/win$/.test(r)) return 'win';
      if (/loss$/.test(r)) return 'loss';
    }
    const pl = (t.pl || '').toLowerCase();
    if (pl === 'profit') return 'win';
    if (pl === 'loss') return 'loss';
    if (pl === 'tape') return 'tape';
    if (pl === 'b/e') return 'be';
    return null;
  },

  // R:R wird als positiver Betrag erfasst, das Vorzeichen ergibt sich aus dem Ergebnis
  rValue(t) {
    const o = this.outcome(t);
    const rr = Math.abs(parseFloat(t.rr));
    if (o === 'win') return isNaN(rr) ? 0 : rr;
    if (o === 'loss') return isNaN(rr) ? -1 : -rr;
    return 0;
  },

  sort(trades) {
    return trades.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0));
  },

  summary(trades) {
    const closed = trades.filter((t) => ['win', 'loss', 'be'].includes(this.outcome(t)));
    const wins = closed.filter((t) => this.outcome(t) === 'win');
    const losses = closed.filter((t) => this.outcome(t) === 'loss');
    const be = closed.filter((t) => this.outcome(t) === 'be');
    const tape = trades.filter((t) => this.outcome(t) === 'tape');
    const grossWin = wins.reduce((s, t) => s + this.rValue(t), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + this.rValue(t), 0));
    const decided = wins.length + losses.length;
    const net = grossWin - grossLoss;
    const curve = this.curve(trades);
    return {
      total: trades.length,
      wins: wins.length,
      losses: losses.length,
      be: be.length,
      tape: tape.length,
      winrate: decided ? (wins.length / decided) * 100 : 0,
      net,
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      profitFactor: grossLoss ? grossWin / grossLoss : (grossWin ? Infinity : 0),
      expectancy: decided ? net / decided : 0,
      maxDD: this.maxDrawdown(curve),
      best: closed.length ? Math.max(...closed.map((t) => this.rValue(t))) : 0,
      worst: closed.length ? Math.min(...closed.map((t) => this.rValue(t))) : 0,
    };
  },

  curve(trades) {
    let sum = 0;
    return this.sort(trades)
      .filter((t) => ['win', 'loss', 'be'].includes(this.outcome(t)))
      .map((t, i) => {
        sum += this.rValue(t);
        return { i: i + 1, date: t.date, value: Math.round(sum * 100) / 100, trade: t };
      });
  },

  maxDrawdown(curve) {
    let peak = 0, dd = 0;
    for (const p of curve) {
      if (p.value > peak) peak = p.value;
      dd = Math.max(dd, peak - p.value);
    }
    return dd;
  },

  dailyR(trades) {
    const map = {};
    for (const t of trades) {
      if (!['win', 'loss', 'be'].includes(this.outcome(t))) continue;
      map[t.date] = (map[t.date] || 0) + this.rValue(t);
    }
    return map;
  },

  // keyFn gibt ein Array von Schluesseln zurueck (ein Trade kann in mehreren Gruppen landen)
  group(trades, keyFn) {
    const buckets = new Map();
    for (const t of trades) {
      let keys = keyFn(t);
      if (!Array.isArray(keys)) keys = [keys];
      keys = keys.filter((k) => k !== undefined && k !== null && k !== '');
      for (const k of keys) {
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(t);
      }
    }
    const rows = [];
    for (const [key, list] of buckets) {
      const s = this.summary(list);
      rows.push({ key, n: list.length, wins: s.wins, losses: s.losses, winrate: s.winrate, net: s.net, trades: list });
    }
    return rows;
  },

  fmtR(v, digits = 2) {
    if (!isFinite(v)) return '∞';
    const r = Math.round(v * Math.pow(10, digits)) / Math.pow(10, digits);
    return (r > 0 ? '+' : '') + r.toLocaleString('de-DE', { maximumFractionDigits: digits }) + 'R';
  },

  rClass(v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; },
};
