// Routine-Ansicht: Tagesleiste, Fortschritt, abhakbare Liste, Bearbeiten-Modus, Monat
// (Die Logik fuer XP, Scores und Streaks steht in habits.js)

// Anlegen / Entfernen (mit Rueckgaengig) – gemeinsam fuer alle Dialoge
Object.assign(Habits, {
  // Alle bestehenden Gewohnheiten eines Tages (auch wenn sie dort nicht faellig sind) – fuer die Bearbeiten-Ansicht
  topLevelAll(date) { return this.existingOn(date).filter((h) => !h.parentId); },
  childrenAll(pid, date) { return this.existingOn(date).filter((h) => h.parentId === pid); },

  async add(name, xp, parentId, schedule) {
    const order = this.habits.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
    const rec = { id: DB.uid(), name: name.trim(), xp: Math.max(1, Math.min(10, xp || 3)), order, createdDate: App.todayStr() };
    if (parentId) rec.parentId = parentId;
    if (schedule && schedule.type !== 'daily') rec.schedule = schedule;
    await DB.put('habits', rec);
    this.habits.push(rec);
    return rec;
  },

  // Entfernt ab heute (Verlauf bleibt). Gibt eine Funktion zurueck, die es wiederherstellt.
  async remove(h) {
    const today = App.todayStr();
    const affected = this.habits.filter((x) => x.id === h.id || x.parentId === h.id);
    for (const x of affected) { x.archivedDate = today; await DB.put('habits', x); }
    return async () => { for (const x of affected) { delete x.archivedDate; await DB.put('habits', x); } };
  },
});

// Rhythmus-Auswahl: taeglich, bestimmte Wochentage oder alle N Tage. node.get() liefert das schedule-Objekt.
function scheduleField(init) {
  const s0 = init || { type: 'daily' };
  let type = s0.type || 'daily', days = (s0.days || [0, 2, 4]).slice(), every = s0.every || 2;
  const anchor = s0.type === 'interval' && s0.anchor ? s0.anchor : App.todayStr();
  const labels = { daily: 'Täglich', weekdays: 'Wochentage', interval: 'Alle paar Tage' };
  const names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const wrap = App.el('div');
  const body = App.el('div', { style: 'margin-top:var(--s2)' });
  const typeChips = UI.chips(Object.values(labels), labels[type], { deselect: false, onChange: (v) => { type = Object.keys(labels).find((k) => labels[k] === v) || 'daily'; draw(); } });
  const draw = () => {
    body.innerHTML = '';
    if (type === 'weekdays') {
      body.appendChild(UI.chips(names, days.map((d) => names[d]), { multi: true, onChange: (v) => { days = v.map((n) => names.indexOf(n)).sort(); } }));
      body.appendChild(App.el('div', { class: 'help-hint' }, 'An diesen Tagen erscheint die Gewohnheit, an den anderen ist Ruhetag.'));
    } else if (type === 'interval') {
      const val = App.el('b', {}, String(every));
      const note = App.el('div', { class: 'help-hint' });
      const upd = () => { val.textContent = every; note.textContent = `Alle ${every} Tage, gezählt ab ${App.formatDate(anchor)}.`; };
      const step = (n) => () => { every = Math.max(2, Math.min(30, every + n)); upd(); };
      body.appendChild(App.el('div', { class: 'row', style: 'gap:12px' }, [App.el('span', {}, 'Alle'), App.el('div', { class: 'stepper' }, [App.el('button', { 'aria-label': 'Weniger', onclick: step(-1) }, '−'), val, App.el('button', { 'aria-label': 'Mehr', onclick: step(1) }, '+')]), App.el('span', {}, 'Tage')]));
      body.appendChild(note);
      upd();
    } else body.appendChild(App.el('div', { class: 'help-hint' }, 'Jeden Tag. Sa und So zählen nach deiner Wochenend-Einstellung.'));
  };
  draw();
  wrap.append(typeChips, body);
  wrap.get = () => (type === 'weekdays' ? { type, days: days.slice() } : type === 'interval' ? { type, every, anchor } : { type: 'daily' });
  return wrap;
}

const ROUTINE_IDEAS = ['Pre-Market-Analyse', 'Journal schreiben', 'Gym / Bewegung', '10 Min Meditation', 'Lesen (20 Min)', 'Wasser trinken (2 L)'];

const RoutineView = {
  date: null,
  month: null,
  editing: false,
  justAdded: null,

  async render() {
    await Habits.load();
    const today = App.todayStr();
    if (!this.date || this.date > today) this.date = today;
    if (this.editing) this.date = today;           // bearbeitet wird immer "heute"
    const date = this.date;
    if (!this.month) this.month = date.slice(0, 7);
    const wrap = App.el('div');
    const active = Habits.habits.filter((h) => !h.archivedDate);

    // ---------- Leerer Zustand ----------
    if (!active.length) {
      wrap.appendChild(App.el('div', { class: 'card', style: 'text-align:center;padding:var(--s4) var(--s3)' }, [
        App.el('div', { class: 'tour-slide', style: 'padding:0' }, [
          App.el('div', { class: 'ic', html: Icons.routine() }),
          App.el('h3', { style: 'margin:0 0 8px' }, 'Starte deine Routine'),
          App.el('p', { style: 'margin-bottom:var(--s3)' }, 'Kleine tägliche Gewohnheiten, die du abhakst. Fang mit ein oder zwei an – mehr braucht es nicht.'),
        ]),
        App.el('div', { class: 'chip-group', style: 'justify-content:center;margin-bottom:var(--s3)' }, ROUTINE_IDEAS.map((name) => App.el('button', {
          class: 'chip', onclick: async () => { await Habits.add(name, 3); App.success('Hinzugefügt'); App.refresh(); },
        }, '+ ' + name))),
        App.el('button', { class: 'btn', onclick: () => this.addSheet() }, [App.icon('plus'), 'Eigene Gewohnheit']),
      ]));
      return wrap;
    }

    // ---------- Tagesleiste (Woche) ----------
    const dayCard = App.el('div', { class: 'card' });
    wrap.appendChild(dayCard);

    // ---------- Heute: Ring + Fortschritt ----------
    const ring = Charts.ring(104, 10, 0);
    const pctEl = App.el('div', { class: 'big' }, '0%');
    ring.appendChild(App.el('div', { class: 'ring-in' }, [pctEl]));
    const doneEl = App.el('div', { class: 'hero-count' }, '');
    const subEl = App.el('div', { class: 'tag' }, '');
    const xpEl = App.el('div', { class: 'tag' }, '');
    const streakChip = App.el('div', { class: 'streak-chip' }, [App.el('span', { html: Icons.flame() }), App.el('span', { class: 'sv' }, '0')]);
    const extraEl = App.el('div', { class: 'extra-xp', style: 'display:none' }, [App.el('span', { html: Icons.sparkles() }), App.el('span', {})]);
    const dayLabel = date === today ? 'Heute' : date === App.addDays(today, -1) ? 'Gestern' : App.parseDate(date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    wrap.appendChild(App.el('div', { class: 'card glow' }, [
      App.el('div', { class: 'lbl-up', style: 'margin-bottom:var(--s2)' }, dayLabel),
      App.el('div', { class: 'today-top' }, [ring, App.el('div', { class: 'grow' }, [doneEl, subEl, xpEl, App.el('div', { style: 'height:12px' }), streakChip, extraEl])]),
    ]));

    // ---------- Liste ----------
    const editing = this.editing;
    const listCard = App.el('div', { class: 'card', style: 'padding:var(--s2) var(--s3) var(--s1)' });
    wrap.appendChild(listCard);

    const reorder = async (els) => {
      for (let i = 0; i < els.length; i++) {
        const h = els[i]._habit;
        if (h && h.order !== i + 1) { h.order = i + 1; await DB.put('habits', h); }
      }
    };
    const remove = async (h, el) => {
      if (!(await App.confirm(`„${h.name}“ löschen?`, { text: 'Bisherige Tage bleiben in deinen Scores erhalten, ab heute zählt sie nicht mehr.' }))) return;
      el.classList.add('removing');
      const undo = await Habits.remove(h);
      setTimeout(() => { App.refresh(); App.undoToast(`„${h.name}“ gelöscht`, undo); }, 300);
    };

    const scheduled = (h) => !!(h.schedule && h.schedule.type !== 'daily');

    // Zeile im Ansichtsmodus: ganze Zeile antippen = abhaken
    const viewRow = (h, isChild) => {
      const done = Habits.isDone(date, h.id);
      const cb = App.el('button', { class: 'checkbox' + (done ? ' checked' : ''), html: Icons.check(), tabindex: '-1', 'aria-hidden': 'true' });
      const row = App.el('div', {
        class: 'habit' + (isChild ? ' child' : '') + (done ? ' done' : '') + (this.justAdded === h.id ? ' fresh' : ''),
        'aria-pressed': String(done), 'aria-label': h.name,
        onclick: () => onToggle(h, row, cb, isChild),
      }, [cb, App.el('div', { class: 'nm' }, [h.name, scheduled(h) ? App.el('span', { class: 'sched' }, Habits.scheduleLabel(h)) : null]), App.el('div', { class: 'xp' }, `+${h.xp} XP`)]);
      row._habit = h;
      return row;
    };

    // Zeile im Bearbeiten-Modus: Name, XP, Unterpunkt, Loeschen, Verschieben
    const editRow = (h, isChild) => {
      const name = App.el('input', { type: 'text', value: h.name, 'aria-label': 'Name', maxlength: '60' });
      name.addEventListener('change', async () => { const v = name.value.trim(); if (v) { h.name = v; await DB.put('habits', h); } else name.value = h.name; });
      const val = App.el('b', {}, String(h.xp));
      const step = (n) => async () => { h.xp = Math.max(1, Math.min(10, (h.xp || 1) + n)); val.textContent = h.xp; await DB.put('habits', h); };
      const row = App.el('div', { class: 'habit-edit' + (isChild ? ' child' : '') + (this.justAdded === h.id ? ' fresh' : '') });
      row._habit = h;
      row.append(
        App.el('div', { class: 'he-line' }, [
          App.el('button', { class: 'grip ' + (isChild ? 'g-kid' : 'g-parent'), 'aria-label': 'Verschieben', html: Icons.grip() }),
          App.el('div', { class: 'grow' }, [name]),
          App.el('button', { class: 'icon-btn del', 'aria-label': `„${h.name}“ löschen`, html: Icons.trash(), onclick: () => remove(h, row) }),
        ]),
        App.el('div', { class: 'he-line sub' }, [
          App.el('div', { class: 'row', style: 'gap:8px' }, [App.el('span', { class: 'tag' }, 'XP'), App.el('div', { class: 'stepper' }, [App.el('button', { 'aria-label': 'Weniger XP', onclick: step(-1) }, '−'), val, App.el('button', { 'aria-label': 'Mehr XP', onclick: step(1) }, '+')])]),
          isChild ? null : App.el('button', { class: 'text-btn', onclick: () => this.addSheet(h.id) }, '+ Unterpunkt'),
        ]),
        App.el('div', { class: 'he-line sub' }, [
          App.el('span', { class: 'tag' }, 'Rhythmus'),
          App.el('button', { class: 'text-btn', 'aria-label': `Rhythmus von „${h.name}“ ändern`, onclick: () => this.scheduleSheet(h) }, Habits.scheduleLabel(h)),
        ]),
      );
      return row;
    };

    listCard.appendChild(App.el('div', { class: 'row between', style: 'margin-bottom:var(--s1)' }, [
      App.el('div', { class: 'list-title' }, editing ? 'Bearbeiten' : 'Gewohnheiten'),
      App.el('button', { class: 'btn small secondary', onclick: () => { this.editing = !editing; App.refresh(); } }, [App.icon(editing ? 'check' : 'edit', 14), editing ? 'Fertig' : 'Bearbeiten']),
    ]));
    // Bearbeiten zeigt alle Gewohnheiten (auch die, die heute nicht faellig sind), Ansicht nur die faelligen
    const tops = editing ? Habits.topLevelAll(date) : Habits.topLevel(date);
    const kidsOf = (id) => (editing ? Habits.childrenAll(id, date) : Habits.childrenOf(id, date));
    if (!tops.length) listCard.appendChild(App.el('div', { class: 'tag', style: 'padding:var(--s2) 0;text-align:center' }, Habits.day(date).rest ? 'Heute ist nichts geplant – genieß den Ruhetag.' : 'An diesem Tag gab es noch keine Gewohnheiten.'));
    const groups = App.el('div', { class: 'habit-groups' });
    tops.forEach((h) => {
      const group = App.el('div', { class: 'habit-group' });
      group._habit = h;
      group.appendChild(editing ? editRow(h, false) : viewRow(h, false));
      const kids = kidsOf(h.id);
      if (kids.length) {
        const inner = App.el('div', { class: 'inner' }, kids.map((k) => (editing ? editRow(k, true) : viewRow(k, true))));
        const box = App.el('div', { class: 'habit-kids' + (editing || Habits.isDone(date, h.id) ? ' open' : '') }, [inner]);
        group._kids = box;
        group.appendChild(box);
        if (editing) UI.sortable(inner, { item: '.habit-edit', handle: '.g-kid', onDone: reorder });
      }
      groups.appendChild(group);
    });
    if (editing) UI.sortable(groups, { item: '.habit-group', handle: '.g-parent', onDone: reorder });
    listCard.appendChild(groups);
    listCard.appendChild(App.el('button', { class: 'habit-add', onclick: () => this.addSheet() }, [App.icon('plus', 16), 'Neue Gewohnheit']));
    this.justAdded = null;

    // ---------- Monat ----------
    const monthCard = App.el('div', { class: 'card' });
    wrap.appendChild(monthCard);

    const caption = (s) => (!s.max ? 'Noch nichts geplant' : s.pct >= 1 ? 'Alles geschafft – stark!' : s.pct >= 0.67 ? 'Fast geschafft' : s.pct > 0 ? 'Guter Anfang' : 'Ein Haken reicht für den Start');

    const drawSummary = () => {
      const s = Habits.day(date);
      ring.set(s.pct);
      pctEl.textContent = s.rest ? '–' : Math.round(s.pct * 100) + '%';
      doneEl.textContent = s.rest ? 'Ruhetag' : s.count ? `${s.doneCount} von ${s.count} erledigt` : '–';
      subEl.textContent = s.rest ? 'Heute ist nichts geplant.' : caption(s);
      xpEl.textContent = s.count ? `${s.earned} von ${s.max} XP` : '';
      const st = Habits.streak(today);
      streakChip.querySelector('.sv').textContent = st === 1 ? '1 Tag in Folge' : `${st} Tage in Folge`;
      streakChip.classList.toggle('cold', st === 0);
      extraEl.style.display = s.extra ? 'flex' : 'none';
      extraEl.lastChild.textContent = `+${s.extra} XP on top`;
    };

    const drawDays = () => {
      const start = App.weekStart(date);
      const dates = Habits.weekDates(date);
      const r = Habits.range(dates);
      const weekday = (App.parseDate(date).getDay() + 6) % 7;
      dayCard.innerHTML = '';
      const prev = () => { this.date = App.addDays(start, -7 + weekday); this.month = null; App.refresh(); };
      const next = () => { const d = App.addDays(start, 7 + weekday); this.date = d > today ? today : d; this.month = null; App.refresh(); };
      dayCard.appendChild(App.el('div', { class: 'row between', style: 'margin-bottom:var(--s2)' }, [
        App.el('button', { class: 'icon-btn', 'aria-label': 'Vorherige Woche', html: Icons.chevronLeft(), onclick: prev }),
        App.el('div', { style: 'text-align:center' }, [App.el('div', { style: 'font-weight:600' }, `KW ${App.isoWeek(start).week}`), App.el('div', { class: 'tag' }, r.max ? `Wochen-Score ${Math.round(r.pct * 100)}% · ${r.earned}/${r.max} XP` : 'Noch keine Wertung')]),
        App.el('button', { class: 'icon-btn', style: App.addDays(start, 7) > today ? 'opacity:.25;pointer-events:none' : '', 'aria-label': 'Nächste Woche', html: Icons.chevronRight(), onclick: next }),
      ]));
      const strip = App.el('div', { class: 'week-strip' });
      const names = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      dates.forEach((d) => {
        const s = Habits.day(d);
        const off = !Habits.scored(d), future = d > today;
        const radius = 15, c = 2 * Math.PI * radius;
        const wd = (App.parseDate(d).getDay() + 6) % 7;
        strip.appendChild(App.el('div', {
          class: 'wk-day' + (off ? ' off' : '') + (s.rest && !off ? ' rest' : '') + (d === date ? ' sel' : '') + (d === today ? ' today' : '') + (s.complete ? ' full' : '') + (future ? ' future' : ''),
          'aria-label': `${names[wd]} ${App.parseDate(d).getDate()}. – ${future ? 'liegt in der Zukunft' : s.rest ? 'Ruhetag' : Math.round(s.pct * 100) + ' Prozent erledigt'}`,
          onclick: () => { if (future || d === date) return; this.date = d; this.month = null; App.refresh(); },
        }, [
          App.el('div', {}, ['M', 'D', 'M', 'D', 'F', 'S', 'S'][wd]),
          App.el('div', { class: 'wk-ring', html: `<svg viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="${radius}" fill="none" stroke="var(--fill)" stroke-width="3.5"/><circle cx="19" cy="19" r="${radius}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - (future ? 0 : s.pct))}" style="transition:stroke-dashoffset var(--t-slow) var(--ease)"/></svg><div class="in">${s.complete ? '✓' : App.parseDate(d).getDate()}</div>` }),
        ]));
      });
      dayCard.appendChild(strip);
      dayCard.appendChild(App.switchRow('Wochenende zählt', 'Sa & So fließen in Score und Streak ein.', Habits.weekend, async (on) => { await Habits.setWeekend(on); drawSummary(); drawDays(); drawMonth(); }));
    };

    const drawMonth = () => {
      const [y, m] = this.month.split('-').map(Number);
      const dates = Habits.monthDates(this.month);
      const r = Habits.range(dates);
      monthCard.innerHTML = '';
      const shift = (n) => { this.month = App.todayStr(new Date(y, m - 1 + n, 1)).slice(0, 7); drawMonth(); };
      monthCard.appendChild(App.el('div', { class: 'cal-head' }, [
        App.el('button', { class: 'icon-btn', 'aria-label': 'Vorheriger Monat', html: Icons.chevronLeft(), onclick: () => shift(-1) }),
        App.el('div', { class: 'ttl' }, `${App.monthName(m - 1)} ${y}`),
        App.el('button', { class: 'icon-btn', 'aria-label': 'Nächster Monat', html: Icons.chevronRight(), onclick: () => shift(1) }),
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
        const cell = App.el('div', { class: 'heat-d' + (off ? ' off' : '') + (s.rest && !off ? ' rest' : '') + (d === today ? ' today' : '') + (s.complete ? ' full' : '') }, String(Number(d.slice(8))));
        if (!off && lvl > 0) cell.style.background = `color-mix(in srgb, var(--accent) ${Math.round(18 + lvl * 82)}%, var(--fill))`;
        grid.appendChild(cell);
      });
      monthCard.appendChild(grid);
    };

    const onToggle = async (h, row, cb, isChild) => {
      const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
      if (isChild) {
        const d = await Habits.toggle(date, h.id);
        row.classList.toggle('done', d); row.setAttribute('aria-pressed', String(d)); cb.classList.toggle('checked', d);
        if (d) { cb.classList.add('pop'); setTimeout(() => cb.classList.remove('pop'), 460); buzz(10); }
        drawSummary();
        return;
      }
      const snap = () => ({ day: Habits.day(date).complete, week: Habits.range(Habits.weekDates(date)).complete, month: Habits.range(Habits.monthDates(date.slice(0, 7))).complete });
      const before = snap();
      const done = await Habits.toggle(date, h.id);
      row.classList.toggle('done', done); row.setAttribute('aria-pressed', String(done)); cb.classList.toggle('checked', done);
      if (done) { cb.classList.add('pop'); setTimeout(() => cb.classList.remove('pop'), 460); buzz(14); }
      const grp = row.closest('.habit-group');
      if (grp && grp._kids) grp._kids.classList.toggle('open', done);   // Unterpunkte gleiten auf
      drawSummary(); drawDays(); drawMonth();
      if (!done) return;
      const after = snap();
      const xp = Habits.day(date).earned;
      const st = Habits.streak(today);
      if (after.month && !before.month) Fx.celebrate('🏆', 'Monat perfekt!', 'Jeder gewertete Tag war komplett.', 2);
      else if (after.week && !before.week) Fx.celebrate('🔥', 'Woche perfekt!', 'Alle Tage dieser Woche komplett.', 1.5);
      else if (after.day && !before.day) Fx.celebrate('✨', 'Tag komplett', `${xp} XP heute · ${st} ${st === 1 ? 'Tag' : 'Tage'} in Folge`, 1);
    };

    drawSummary(); drawDays(); drawMonth();
    return wrap;
  },

  // Rhythmus einer bestehenden Gewohnheit aendern
  scheduleSheet(h) {
    const field = scheduleField(h.schedule);
    const save = async () => {
      const s = field.get();
      if (s.type === 'weekdays' && !s.days.length) { App.toast('Wähle mindestens einen Wochentag.'); return; }
      if (s.type === 'daily') delete h.schedule; else h.schedule = s;
      await DB.put('habits', h);
      App.closeModal();
      App.refresh();
      App.success('Rhythmus gespeichert');
    };
    App.showModal(App.el('div', {}, [
      App.el('h3', {}, 'Rhythmus'),
      App.el('p', { class: 'tag', style: 'margin:0 0 var(--s2)' }, `„${h.name}“`),
      field,
      App.el('div', { class: 'btn-row', style: 'margin-top:var(--s3)' }, [App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'), App.el('button', { class: 'btn', onclick: save }, 'Speichern')]),
    ]));
  },

  // Neue Gewohnheit (oder Unterpunkt): Name, Gewicht, optionale Zuordnung
  addSheet(parentId) {
    const taken = new Set(Habits.habits.filter((h) => !h.archivedDate).map((h) => h.name.toLowerCase()));
    const ideas = ['Wasser trinken (2 L)', '10 Min Meditation', 'Lesen (20 Min)', 'Früh aufstehen', 'Spazieren / Schritte', 'Dehnen / Mobility', 'Kein Handy vor dem Schlafen', 'Trading-Plan visualisieren', 'Pause nach 2 Trades'].filter((x) => !taken.has(x.toLowerCase()));
    const parents = Habits.habits.filter((h) => !h.archivedDate && !h.parentId);
    let xp = parentId ? 1 : 3;
    const val = App.el('b', {}, String(xp));
    const parentChips = UI.chips(parents.map((h) => h.name), (parents.find((h) => h.id === parentId) || {}).name || '', { onChange: (v) => { xp = v ? 1 : 3; val.textContent = xp; } });
    const name = App.el('input', { type: 'text', placeholder: 'z. B. 10 Min Meditation', maxlength: '60', 'aria-label': 'Name' });
    const step = (n) => () => { xp = Math.max(1, Math.min(10, xp + n)); val.textContent = xp; };
    const schedule = scheduleField();
    const save = async () => {
      const t = name.value.trim();
      if (!t) { App.toast('Gib deiner Gewohnheit einen Namen.'); name.focus(); return; }
      const parent = parents.find((h) => h.name === parentChips.get());
      const sched = schedule.get();
      if (sched.type === 'weekdays' && !sched.days.length) { App.toast('Wähle mindestens einen Wochentag.'); return; }
      const rec = await Habits.add(t, xp, parent && parent.id, sched);
      this.justAdded = rec.id;
      App.closeModal();
      App.refresh();
      App.success('Hinzugefügt');
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    App.showModal(App.el('div', {}, [
      App.el('h3', {}, parentId ? 'Neuer Unterpunkt' : 'Neue Gewohnheit'),
      UI.field('Name', name),
      ideas.length ? App.el('div', { class: 'field' }, [App.el('label', {}, 'Ideen'), App.el('div', { class: 'chip-group' }, ideas.slice(0, 8).map((i) => App.el('button', { class: 'chip sm', onclick: () => { name.value = i; name.focus(); } }, i)))]) : null,
      parents.length ? App.el('div', { class: 'field' }, [App.el('label', {}, 'Gehört zu (erscheint, sobald diese erledigt ist)'), parentChips]) : null,
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Gewicht (XP) – wie wichtig ist sie?'), App.el('div', { class: 'stepper' }, [App.el('button', { 'aria-label': 'Weniger XP', onclick: step(-1) }, '−'), val, App.el('button', { 'aria-label': 'Mehr XP', onclick: step(1) }, '+')])]),
      App.el('div', { class: 'field' }, [App.el('label', {}, 'Rhythmus'), schedule]),
      App.el('div', { class: 'btn-row' }, [App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'), App.el('button', { class: 'btn', onclick: save }, [App.icon('plus'), 'Hinzufügen'])]),
    ]));
    setTimeout(() => name.focus(), 380);
  },
};
