// Routine: taegliche Gewohnheiten mit XP, Tages-/Wochen-/Monatsscore, Streak und Feier-Effekten
//
// Datenmodell
//   habits    { id, name, xp (1-10), order, createdDate 'YYYY-MM-DD', archivedDate? }
//   habitLogs { id: 'datum|habitId', date, habitId, done }
//   settings  habitSettings { weekend: false }   -> zaehlen Sa/So mit?
//
// Scoring
//   Tag      = Summe XP der erledigten Gewohnheiten / Summe XP aller aktiven Gewohnheiten dieses Tages
//   Woche    = XP aller gewerteten Tage der Woche / moegliche XP dieser Tage (Mo-Fr, optional Sa+So)
//   Monat    = wie Woche ueber alle gewerteten Tage des Monats
//   Streak   = Anzahl gewerteter Tage in Folge mit 100 %. Der heutige Tag bricht den Streak nicht, solange er offen ist.
//              Nicht gewertete Tage (Wochenende aus) werden uebersprungen.
//   Fertig   = Tag 100 %, Woche/Monat: alle gewerteten Tage 100 %
const Habits = {
  habits: [],
  logs: new Map(),   // 'datum|habitId' -> log
  weekend: false,

  async load() {
    const all = await DB.getAll('habits');
    this.habits = all.sort((a, b) => (a.order || 0) - (b.order || 0));
    this.logs = new Map((await DB.getAll('habitLogs')).map((l) => [l.id, l]));
    const s = await DB.getSetting('habitSettings', { weekend: false });
    this.weekend = !!s.weekend;
  },

  logId(date, hid) { return `${date}|${hid}`; },
  isDone(date, hid) { const l = this.logs.get(this.logId(date, hid)); return !!(l && l.done); },

  // Bestehende (nicht entfernte) Gewohnheiten an einem Tag – unabhaengig vom Rhythmus
  existingOn(date) {
    return this.habits.filter((h) => (h.createdDate || '0000') <= date && (!h.archivedDate || date < h.archivedDate));
  },

  // Gewohnheiten, die an diesem Tag faellig sind (Rhythmus beachtet)
  activeOn(date) {
    return this.existingOn(date).filter((h) => this.appliesOn(h, date));
  },

  // Rhythmus: schedule = { type: 'daily' | 'weekdays' | 'interval', days: [0..6 (Mo=0)], every: N, anchor: 'JJJJ-MM-TT' }
  appliesOn(h, date) {
    const s = h.schedule;
    if (!s || s.type === 'daily') return true;
    if (s.type === 'weekdays') {
      const wd = (App.parseDate(date).getDay() + 6) % 7;
      return (s.days || []).includes(wd);
    }
    if (s.type === 'interval') {
      const every = Math.max(1, Number(s.every) || 1);
      const anchor = s.anchor || h.createdDate || date;
      const diff = Math.round((App.parseDate(date) - App.parseDate(anchor)) / 86400000);
      return diff >= 0 && diff % every === 0;
    }
    return true;
  },

  scheduleLabel(h) {
    const s = h.schedule;
    if (!s || s.type === 'daily') return 'Täglich';
    if (s.type === 'weekdays') {
      const names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
      const days = [...(s.days || [])].sort();
      if (days.length === 5 && days.join() === '0,1,2,3,4') return 'Mo–Fr';
      if (days.length === 2 && days.join() === '5,6') return 'Sa, So';
      return days.length ? days.map((d) => names[d]).join(', ') : 'Keine Tage';
    }
    const n = Math.max(1, Number(s.every) || 1);
    return n === 1 ? 'Täglich' : `Alle ${n} Tage`;
  },

  scored(date) {
    const d = App.parseDate(date).getDay();
    return this.weekend || (d >= 1 && d <= 5);
  },

  topLevel(date) { return this.activeOn(date).filter((h) => !h.parentId); },
  childrenOf(pid, date) { return this.activeOn(date).filter((h) => h.parentId === pid); },

  // Unterpunkte zaehlen nicht zum Tagesziel; erledigte bringen zusaetzliche XP (nur wenn die Hauptgewohnheit erledigt ist)
  day(date) {
    const act = this.topLevel(date);
    const max = act.reduce((s, h) => s + (h.xp || 1), 0);
    const earned = act.reduce((s, h) => s + (this.isDone(date, h.id) ? (h.xp || 1) : 0), 0);
    const doneCount = act.filter((h) => this.isDone(date, h.id)).length;
    const extra = act.filter((h) => this.isDone(date, h.id)).reduce((s, h) => s + this.childrenOf(h.id, date).reduce((a, k) => a + (this.isDone(date, k.id) ? (k.xp || 1) : 0), 0), 0);
    const first = this.firstDate();
    // Ruhetag: nichts geplant, obwohl es Gewohnheiten gibt (zaehlt weder fuer noch gegen den Streak)
    const rest = max === 0 && !!first && date >= first;
    return { date, earned, max, extra, rest, pct: max ? earned / max : 0, complete: max > 0 && earned >= max, count: act.length, doneCount, scored: this.scored(date) };
  },

  range(dates) {
    let earned = 0, max = 0, allDone = true, days = 0;
    dates.forEach((d) => {
      if (!this.scored(d)) return;
      const s = this.day(d);
      if (!s.max) { if (!s.rest) allDone = false; return; } // vor der ersten Gewohnheit: nicht "perfekt"; Ruhetage: neutral
      days++; earned += s.earned; max += s.max;
      if (!s.complete) allDone = false;
    });
    return { earned, max, pct: max ? earned / max : 0, complete: days > 0 && allDone, days };
  },

  weekDates(date) {
    const start = App.weekStart(date);
    return Array.from({ length: 7 }, (_, i) => App.addDays(start, i));
  },

  monthDates(ym) {
    const [y, m] = ym.split('-').map(Number);
    const n = new Date(y, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
  },

  streak(today = App.todayStr()) {
    let n = 0, d = today, first = true, guard = 0;
    while (guard++ < 800) {
      if (this.scored(d)) {
        const s = this.day(d);
        if (s.rest) { /* Ruhetag: weder Streak noch Bruch */ }
        else if (s.complete) n++;
        else if (!(first && d === today)) break;
      }
      first = false;
      d = App.addDays(d, -1);
      if (this.habits.length && d < this.firstDate()) break;
    }
    return n;
  },

  best() {
    const start = this.firstDate();
    if (!start) return 0;
    let best = 0, run = 0, d = start;
    const today = App.todayStr();
    while (d <= today) {
      if (this.scored(d)) {
        const s = this.day(d);
        if (s.rest) { /* neutral */ }
        else if (s.complete) { run++; best = Math.max(best, run); }
        else if (d !== today) run = 0;
      }
      d = App.addDays(d, 1);
    }
    return best;
  },

  firstDate() {
    return this.habits.reduce((m, h) => (!m || (h.createdDate || m) < m ? (h.createdDate || m) : m), '');
  },

  async toggle(date, hid) {
    const id = this.logId(date, hid);
    const cur = this.logs.get(id);
    const log = { id, date, habitId: hid, done: !(cur && cur.done) };
    this.logs.set(id, log);
    await DB.put('habitLogs', log);
    return log.done;
  },

  async setWeekend(on) {
    this.weekend = on;
    await DB.setSetting('habitSettings', { weekend: on });
  },
};
