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

  activeOn(date) {
    return this.habits.filter((h) => (h.createdDate || '0000') <= date && (!h.archivedDate || date < h.archivedDate));
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
    return { date, earned, max, extra, pct: max ? earned / max : 0, complete: max > 0 && earned >= max, count: act.length, doneCount, scored: this.scored(date) };
  },

  range(dates) {
    let earned = 0, max = 0, allDone = true, days = 0;
    dates.forEach((d) => {
      if (!this.scored(d)) return;
      const s = this.day(d);
      if (!s.max) { allDone = false; return; } // Tage ohne aktive Gewohnheit koennen nicht "perfekt" sein
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
        if (s.complete) n++;
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
        if (s.complete) { run++; best = Math.max(best, run); }
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

const RoutineView = {
  month: App.todayStr().slice(0, 7),

  async render() {
    await Habits.load();
    const wrap = App.el('div');
    const today = App.todayStr();
    if (!this.date || this.date > today) this.date = today;
    const date = this.date;

    if (!Habits.habits.filter((h) => !h.archivedDate).length) {
      wrap.appendChild(App.empty('routine', 'Noch keine Gewohnheiten. Lege deine erste an – klein anfangen reicht.'));
      wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.edit() }, [App.icon('plus'), 'Gewohnheit hinzufügen']));
      return wrap;
    }

    // ----- Heute: Ring, XP, Streak -----
    const ring = Charts.ring(132, 11, 0);
    const pctEl = App.el('div', { class: 'big' }, '0%');
    const xpEl = App.el('div', { class: 'small' }, '');
    ring.appendChild(App.el('div', { class: 'ring-in' }, [pctEl, xpEl]));
    const streakEl = App.el('span', {}, '0');
    const streakBox = App.el('div', { class: 'streak' }, [App.el('span', { html: Icons.flame() }), streakEl]);
    const bestEl = App.el('div', { class: 'tag' }, '');
    const msgEl = App.el('div', { style: 'font-weight:600;font-size:15px;line-height:1.35' }, '');
    const extraEl = App.el('div', { class: 'extra-xp', style: 'display:none' }, [App.el('span', { html: Icons.sparkles() }), App.el('span', {})]);
    const dayLabel = date === today ? 'Heute' : date === App.addDays(today, -1) ? 'Gestern' : App.parseDate(date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    const go = (n) => () => { this.date = App.addDays(date, n); this.month = this.date.slice(0, 7); App.refresh(); };
    wrap.appendChild(App.el('div', { class: 'card glow' }, [
      App.el('div', { class: 'cal-head', style: 'margin-bottom:18px' }, [
        App.el('button', { class: 'icon-btn', html: Icons.chevronLeft(), onclick: go(-1), 'aria-label': 'Vorheriger Tag' }),
        App.el('div', { class: 'ttl' }, dayLabel),
        App.el('button', { class: 'icon-btn', style: date >= today ? 'opacity:.25;pointer-events:none' : '', html: Icons.chevronRight(), onclick: go(1), 'aria-label': 'Nächster Tag' }),
      ]),
      App.el('div', { class: 'today-top' }, [
        ring,
        App.el('div', { class: 'grow' }, [streakBox, bestEl, App.el('div', { style: 'height:12px' }), msgEl, extraEl]),
      ]),
    ]));

    // ----- Checkliste -----
    const listCard = App.el('div', { class: 'card', style: 'padding:6px 18px 8px' });
    const editing = !!this.editing;
    const countEl = App.el('div', { class: 'progress-count' }, editing ? 'Tippe auf den Papierkorb zum Löschen' : '');
    listCard.appendChild(App.el('div', { class: 'row between', style: 'padding:8px 4px 0' }, [
      countEl,
      App.el('button', { class: 'btn small secondary', style: 'padding:7px 14px', onclick: () => { this.editing = !editing; App.refresh(); } }, [App.icon(editing ? 'check' : 'edit', 14), editing ? 'Fertig' : 'Bearbeiten']),
    ]));
    const rows = new Map();
    const reorder = async (els) => {
      for (let i = 0; i < els.length; i++) {
        const h = els[i]._habit;
        if (h && h.order !== i + 1) { h.order = i + 1; await DB.put('habits', h); }
      }
    };
    const removeHabit = async (h, el) => {
      if (!(await App.confirm(`„${h.name}“ löschen?`, { text: 'Bisherige Tage bleiben in deinen Scores erhalten, ab heute zählt sie nicht mehr.' }))) return;
      el.classList.add('removing');
      const today = App.todayStr();
      for (const x of Habits.habits.filter((x) => x.id === h.id || x.parentId === h.id)) { x.archivedDate = today; await DB.put('habits', x); }
      setTimeout(() => App.refresh(), 260);
    };
    // Eine Zeile (Hauptgewohnheit oder Unterpunkt)
    const buildRow = (h, isChild) => {
      const done = Habits.isDone(date, h.id);
      const cb = App.el('button', { class: 'checkbox' + (done ? ' checked' : ''), html: Icons.check(), 'aria-label': h.name });
      const row = App.el('div', { class: 'habit' + (isChild ? ' child' : '') + (done ? ' done' : '') + (editing ? ' editing' : ''), onclick: () => { if (!editing) onToggle(h, row, cb, isChild); } });
      row._habit = h;
      if (editing) row.appendChild(App.el('button', { class: 'grip', 'aria-label': 'Verschieben', html: Icons.grip() }));
      row.append(cb, App.el('div', { class: 'nm' }, h.name));
      if (editing) {
        if (!isChild) row.appendChild(App.el('button', { class: 'icon-btn', 'aria-label': 'Unterpunkt hinzufügen', html: Icons.plus(), onclick: (e) => { e.stopPropagation(); this.addSheet(h.id); } }));
        row.appendChild(App.el('button', { class: 'icon-btn del', 'aria-label': 'Löschen', html: Icons.trash(), onclick: (e) => { e.stopPropagation(); removeHabit(h, row); } }));
      } else row.appendChild(App.el('div', { class: 'xp' }, `+${h.xp} XP`));
      rows.set(h.id, row);
      return row;
    };
    const groups = App.el('div', { class: 'habit-groups' });
    Habits.topLevel(date).forEach((h) => {
      const group = App.el('div', { class: 'habit-group' });
      group._habit = h;
      group.appendChild(buildRow(h, false));
      const kids = Habits.childrenOf(h.id, date);
      if (kids.length) {
        const inner = App.el('div', { class: 'inner' }, kids.map((k) => buildRow(k, true)));
        const box = App.el('div', { class: 'habit-kids' + (editing || Habits.isDone(date, h.id) ? ' open' : '') }, [inner]);
        group._kids = box;
        group.appendChild(box);
        if (editing) UI.sortable(inner, { item: '.habit', handle: '.grip', onDone: reorder });
      }
      groups.appendChild(group);
    });
    if (editing) UI.sortable(groups, { item: '.habit-group', handle: '.grip', onDone: reorder });
    listCard.appendChild(groups);
    if (!rows.size) listCard.appendChild(App.el('div', { class: 'tag', style: 'padding:18px 4px 8px;text-align:center' }, 'An diesem Tag gab es noch keine Gewohnheiten.'));
    listCard.appendChild(App.el('button', { class: 'habit-add', onclick: () => this.addSheet() }, [App.icon('plus', 16), 'Eigene Gewohnheit hinzufügen']));
    wrap.appendChild(listCard);

    // ----- Woche -----
    const weekCard = App.el('div', { class: 'card' });
    wrap.appendChild(weekCard);
    // ----- Monat -----
    const monthCard = App.el('div', { class: 'card' });
    wrap.appendChild(monthCard);

    wrap.appendChild(App.el('button', { class: 'btn secondary', onclick: () => this.edit() }, [App.icon('edit'), 'Gewohnheiten & XP bearbeiten']));

    const MSG = [
      [0, 'Ein Haken reicht für den Start.'], [0.01, 'Guter Anfang – bleib dran.'], [0.34, 'Du bist im Flow.'],
      [0.67, 'Fast geschafft – noch ein Stück.'], [1, 'Tag komplett. Stark!'],
    ];

    const drawSummary = (animate) => {
      const s = Habits.day(date);
      if (!editing) countEl.textContent = s.count ? `${s.doneCount} von ${s.count} erledigt` : '';
      extraEl.style.display = s.extra ? 'flex' : 'none';
      extraEl.lastChild.textContent = `+${s.extra} XP on top`;
      ring.set(s.pct);
      App.animateNumber(pctEl, Math.round(s.pct * 100), { suffix: '%', duration: animate ? 900 : 500, from: Number(pctEl.dataset.v || 0) });
      pctEl.dataset.v = Math.round(s.pct * 100);
      xpEl.textContent = `${s.earned} / ${s.max} XP`;
      const st = Habits.streak(today);
      streakEl.textContent = st;
      streakBox.classList.toggle('cold', st === 0);
      bestEl.textContent = st === 1 ? 'Tag in Folge' : 'Tage in Folge';
      bestEl.textContent += ` · Bestwert ${Habits.best()}`;
      msgEl.textContent = s.max ? [...MSG].reverse().find(([t]) => s.pct >= t)[1] : 'Noch nichts geplant.';
    };

    const drawWeek = () => {
      const dates = Habits.weekDates(date);
      const r = Habits.range(dates);
      weekCard.innerHTML = '';
      weekCard.appendChild(App.el('div', { class: 'score-line' }, [
        App.el('div', {}, [App.el('div', { class: 'tag' }, 'Wochen-Score'), App.el('div', { class: 'pct' }, `${Math.round(r.pct * 100)}%`)]),
        App.el('div', { class: 'tag', style: 'text-align:right' }, `${r.earned} / ${r.max} XP`),
      ]));
      const strip = App.el('div', { class: 'week-strip' });
      dates.forEach((d) => {
        const s = Habits.day(d);
        const off = !Habits.scored(d);
        const radius = 15, c = 2 * Math.PI * radius;
        const future = d > today;
        strip.appendChild(App.el('div', { class: 'wk-day' + (off ? ' off' : '') + (d === today ? ' today' : '') + (s.complete ? ' full' : '') }, [
          App.el('div', {}, ['M', 'D', 'M', 'D', 'F', 'S', 'S'][(App.parseDate(d).getDay() + 6) % 7]),
          App.el('div', { class: 'wk-ring', html: `<svg viewBox="0 0 38 38"><circle cx="19" cy="19" r="${radius}" fill="none" stroke="var(--surface-2)" stroke-width="3.5"/><circle cx="19" cy="19" r="${radius}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - (future ? 0 : s.pct))}" style="transition:stroke-dashoffset var(--t-slow) var(--ease)"/></svg><div class="in">${s.complete ? '✓' : App.parseDate(d).getDate()}</div>` }),
        ]));
      });
      weekCard.appendChild(strip);
      weekCard.appendChild(App.switchRow('Wochenende zählt', 'Sa & So fließen in Score und Streak ein.', Habits.weekend, async (on) => { await Habits.setWeekend(on); drawSummary(); drawWeek(); drawMonth(); }));
    };

    const drawMonth = () => {
      const [y, m] = this.month.split('-').map(Number);
      const dates = Habits.monthDates(this.month);
      const r = Habits.range(dates);
      monthCard.innerHTML = '';
      const shift = (n) => { this.month = App.todayStr(new Date(y, m - 1 + n, 1)).slice(0, 7); drawMonth(); };
      monthCard.appendChild(App.el('div', { class: 'cal-head' }, [
        App.el('button', { class: 'icon-btn', html: Icons.chevronLeft(), onclick: () => shift(-1) }),
        App.el('div', { class: 'ttl' }, `${App.monthName(m - 1)} ${y}`),
        App.el('button', { class: 'icon-btn', html: Icons.chevronRight(), onclick: () => shift(1) }),
      ]));
      monthCard.appendChild(App.el('div', { class: 'score-line' }, [
        App.el('div', {}, [App.el('div', { class: 'tag' }, 'Monats-Score'), App.el('div', { class: 'pct' }, `${Math.round(r.pct * 100)}%`)]),
        App.el('div', { class: 'tag', style: 'text-align:right' }, `${r.earned} / ${r.max} XP`),
      ]));
      const grid = App.el('div', { class: 'heat' });
      const offset = (App.parseDate(dates[0]).getDay() + 6) % 7;
      for (let i = 0; i < offset; i++) grid.appendChild(App.el('div'));
      dates.forEach((d) => {
        const s = Habits.day(d);
        const off = !Habits.scored(d);
        const lvl = d > today ? 0 : s.pct;
        const cell = App.el('div', { class: 'heat-d' + (off ? ' off' : '') + (d === today ? ' today' : '') + (s.complete ? ' full' : '') }, String(Number(d.slice(8))));
        if (!off && lvl > 0) cell.style.background = `color-mix(in srgb, var(--accent) ${Math.round(18 + lvl * 82)}%, var(--surface-2))`;
        grid.appendChild(cell);
      });
      monthCard.appendChild(grid);
    };

    const onToggle = async (h, row, cb, isChild) => {
      if (isChild) {
        const d = await Habits.toggle(date, h.id);
        row.classList.toggle('done', d);
        cb.classList.toggle('checked', d);
        if (d) { cb.classList.add('pop'); setTimeout(() => cb.classList.remove('pop'), 650); try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {} }
        drawSummary();
        return;
      }
      const snap = () => ({ day: Habits.day(date).complete, week: Habits.range(Habits.weekDates(date)).complete, month: Habits.range(Habits.monthDates(date.slice(0, 7))).complete });
      const before = snap();
      const done = await Habits.toggle(date, h.id);
      row.classList.toggle('done', done);
      cb.classList.toggle('checked', done);
      if (done) {
        cb.classList.add('pop'); setTimeout(() => cb.classList.remove('pop'), 650);
        try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
      }
      // zugehoerige Unterpunkte erscheinen, sobald die Hauptgewohnheit erledigt ist
      const grp = row.closest('.habit-group');
      if (grp && grp._kids) grp._kids.classList.toggle('open', done);
      drawSummary(); drawWeek(); drawMonth();
      if (!done) return;
      const after = snap();
      const xp = Habits.day(date).earned;
      if (after.month && !before.month) Fx.celebrate('🏆', 'Monat perfekt!', 'Jeder gewertete Tag war komplett. Das machen die wenigsten.', 2);
      else if (after.week && !before.week) Fx.celebrate('🔥', 'Woche perfekt!', 'Alle Tage dieser Woche komplett. Weiter so!', 1.5);
      else if (after.day && !before.day) Fx.celebrate('✨', 'Tag komplett', `${xp} XP heute – Streak: ${Habits.streak(today)}`, 1);
    };

    drawSummary(true); drawWeek(); drawMonth();
    return wrap;
  },

  // Eigene Gewohnheit schnell anlegen (Name, XP, Vorschlaege)
  addSheet(parentId) {
    const taken = new Set(Habits.habits.filter((h) => !h.archivedDate).map((h) => h.name.toLowerCase()));
    const ideas = ['Wasser trinken (2 L)', '10 Min Meditation', 'Lesen (20 Min)', 'Früh aufstehen', 'Spazieren / Schritte', 'Dehnen / Mobility', 'Kein Handy vor dem Schlafen', 'Trading-Plan visualisieren', 'Pause nach 2 Trades']
      .filter((x) => !taken.has(x.toLowerCase()));
    const parents = Habits.habits.filter((h) => !h.archivedDate && !h.parentId);
    const parentChips = UI.chips(parents.map((h) => h.name), (parents.find((h) => h.id === parentId) || {}).name || '', { onChange: (v) => { xp = v ? 1 : 3; val.textContent = xp; } });
    let xp = parentId ? 1 : 3;
    const name = App.el('input', { type: 'text', placeholder: 'z. B. 10 Min Meditation', maxlength: '60' });
    const val = App.el('b', {}, String(xp));
    const step = (n) => () => { xp = Math.max(1, Math.min(10, xp + n)); val.textContent = xp; };
    const save = async () => {
      const t = name.value.trim();
      if (!t) { App.toast('Gib deiner Gewohnheit einen Namen.'); name.focus(); return; }
      const order = Habits.habits.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
      const parent = parents.find((h) => h.name === parentChips.get());
      const rec = { id: DB.uid(), name: t, xp, order, createdDate: App.todayStr() };
      if (parent) rec.parentId = parent.id;
      await DB.put('habits', rec);
      App.closeModal();
      App.refresh();
      App.toast('Hinzugefügt');
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    const sheet = App.el('div', {}, [
      App.el('h3', {}, 'Neue Gewohnheit'),
      UI.field('Name', name),
      ideas.length ? App.el('div', { class: 'field' }, [
        App.el('label', {}, 'Ideen'),
        App.el('div', { class: 'chip-group' }, ideas.slice(0, 8).map((i) => App.el('button', { class: 'chip sm', onclick: () => { name.value = i; name.focus(); } }, i))),
      ]) : null,
      parents.length ? App.el('div', { class: 'field' }, [
        App.el('label', {}, 'Gehört zu (erscheint, sobald diese erledigt ist)'),
        parentChips,
      ]) : null,
      App.el('div', { class: 'field' }, [
        App.el('label', {}, 'Gewicht (XP) – wie wichtig ist sie?'),
        App.el('div', { class: 'stepper' }, [App.el('button', { onclick: step(-1) }, '−'), val, App.el('button', { onclick: step(1) }, '+')]),
      ]),
      App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', { class: 'btn', onclick: save }, [App.icon('plus'), 'Hinzufügen']),
      ]),
    ]);
    App.showModal(sheet);
    setTimeout(() => name.focus(), 350);
  },

  // Bearbeiten: Namen, XP-Gewichtung, Hinzufuegen, Entfernen
  edit() {
    const box = App.el('div');
    const sheet = App.el('div', {}, [App.el('h3', {}, 'Gewohnheiten'), App.el('p', { class: 'tag', style: 'margin:-8px 0 18px' }, 'XP = Gewicht. Wichtige Gewohnheiten bekommen mehr XP.'), box]);
    const draw = () => {
      box.innerHTML = '';
      const act = Habits.habits.filter((h) => !h.archivedDate);
      const ordered = act.filter((h) => !h.parentId).flatMap((h) => [h, ...act.filter((k) => k.parentId === h.id)]);
      ordered.forEach((h) => {
        const name = App.el('input', { type: 'text', value: h.name, placeholder: 'Name' });
        name.addEventListener('change', async () => { h.name = name.value.trim() || h.name; await DB.put('habits', h); });
        const val = App.el('b', {}, String(h.xp));
        const step = (n) => async () => { h.xp = Math.max(1, Math.min(10, (h.xp || 1) + n)); val.textContent = h.xp; await DB.put('habits', h); };
        box.appendChild(App.el('div', { class: 'edit-habit' + (h.parentId ? ' child' : '') }, [
          App.el('div', { class: 'grow' }, [name]),
          App.el('div', { class: 'stepper' }, [App.el('button', { onclick: step(-1) }, '−'), val, App.el('button', { onclick: step(1) }, '+')]),
          App.el('button', { class: 'icon-btn del', html: Icons.trash(), onclick: async () => {
            if (!(await App.confirm(`„${h.name}“ entfernen?`, { text: 'Bisherige Tage bleiben erhalten, ab heute zählt die Gewohnheit nicht mehr.', ok: 'Entfernen' }))) return;
            for (const x of Habits.habits.filter((x) => x.id === h.id || x.parentId === h.id)) { x.archivedDate = App.todayStr(); await DB.put('habits', x); }
            draw();
          } }),
        ]));
      });
      const nu = App.el('input', { type: 'text', placeholder: 'Neue Gewohnheit …' });
      const add = async () => {
        const t = nu.value.trim();
        if (!t) return;
        const order = Habits.habits.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
        const h = { id: DB.uid(), name: t, xp: 3, order, createdDate: App.todayStr() };
        Habits.habits.push(h);
        await DB.put('habits', h);
        draw();
      };
      nu.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
      box.appendChild(App.el('div', { class: 'edit-habit', style: 'margin-top:16px' }, [App.el('div', { class: 'grow' }, [nu]), App.el('button', { class: 'btn small', onclick: add }, [App.icon('plus'), 'Hinzufügen'])]));
    };
    draw();
    sheet.appendChild(App.el('button', { class: 'btn', style: 'margin-top:12px', onclick: () => { App.closeModal(); App.refresh(); } }, 'Fertig'));
    App.showModal(sheet);
  },
};
