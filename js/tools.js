// Weekly Tracker, Trading Model, Mistakes
const ChecklistPage = {
  open(key, title, hint) {
    App.openPage(title, async () => {
      const doc = await DB.get('checklists', key);
      const wrap = App.el('div');
      if (hint) wrap.appendChild(App.el('div', { class: 'tag', style: 'margin:0 2px 12px;font-style:italic' }, hint));
      wrap.appendChild(UI.checklist(doc || { key, sections: [{ title: '', items: [] }] }, { progressLabel: title, multiSection: key === 'tradingModel' || key === 'modelChecklist' }));
      return wrap;
    });
  },
};

const WeeklyTracker = {
  openWeeks: null,

  open() {
    App.openPage('Weekly Tracker', () => this.render());
  },

  async render() {
    const wrap = App.el('div');
    const weeks = (await DB.getAll('weeks')).sort((a, b) => b.key.localeCompare(a.key));
    const thisKey = App.weekKey(App.todayStr());
    if (!this.openWeeks) this.openWeeks = new Set([thisKey]);

    wrap.appendChild(App.el('div', { class: 'row', style: 'justify-content:space-between;margin:0 2px 12px' }, [
      App.el('div', { class: 'section-title', style: 'margin:0' }, 'Weekly Planner'),
    ]));
    const addBtn = App.el('button', { class: 'btn', style: 'margin-bottom:14px', onclick: async () => {
      // naechste noch nicht vorhandene Woche anlegen (ab aktueller Woche)
      let start = App.weekStart(App.todayStr());
      const keys = new Set(weeks.map((w) => w.key));
      while (keys.has(App.weekKey(start))) start = App.addDays(start, 7);
      const w = Seed.emptyWeek(App.weekKey(start), start);
      await DB.put('weeks', w);
      this.openWeeks.add(w.key);
      App.refresh();
    } }, [App.icon('plus', 18), 'Neue Woche']);
    wrap.appendChild(addBtn);

    if (!weeks.length) wrap.appendChild(App.empty('clipboard', 'Noch keine Woche angelegt.'));
    weeks.forEach((w) => wrap.appendChild(this.weekCard(w)));
    return wrap;
  },

  weekLabel(w) {
    const n = Number(w.key.split('-W')[1]);
    const s = App.parseDate(w.start), e = App.parseDate(App.addDays(w.start, 6));
    const m1 = s.toLocaleDateString('de-DE', { month: 'short' });
    const m2 = e.toLocaleDateString('de-DE', { month: 'short' });
    return `Week ${n}: ${m1} ${s.getDate()}${m1 === m2 ? '' : ' ' + m2} – ${e.getDate()}`;
  },

  weekCard(w) {
    const save = () => DB.put('weeks', w);
    const card = App.el('div', { class: 'week-card' + (this.openWeeks.has(w.key) ? ' open' : '') });
    const head = App.el('div', { class: 'week-head', onclick: () => {
      card.classList.toggle('open');
      if (card.classList.contains('open')) this.openWeeks.add(w.key); else this.openWeeks.delete(w.key);
    } }, [
      App.el('span', { class: 'chev', html: Icons.chevronDown() }),
      App.el('span', { class: 'grow' }, this.weekLabel(w)),
      App.el('button', { class: 'icon-btn del', html: Icons.trash(), onclick: async (e) => { e.stopPropagation(); if (await App.confirm('Woche löschen?')) { await DB.delete('weeks', w.key); App.refresh(); } } }),
    ]);

    const textInput = (get, set, placeholder) => {
      const i = App.el('input', { type: 'text', value: get() || '', placeholder: placeholder || '' });
      i.addEventListener('input', () => { set(i.value); save(); });
      return i;
    };
    const taskLine = (task, onDelete) => {
      const row = App.el('div', { class: 'cl-item' + (task.checked ? ' done' : '') });
      const cb = App.el('button', { class: 'checkbox' + (task.checked ? ' checked' : ''), html: Icons.check(), onclick: (e) => {
        task.checked = !task.checked;
        e.currentTarget.classList.toggle('checked', task.checked);
        e.currentTarget.classList.add('pop');
        row.classList.toggle('done', task.checked);
        save();
      } });
      const inp = textInput(() => task.text, (v) => { task.text = v; });
      row.append(cb, App.el('div', { class: 'grow' }, [inp]));
      if (onDelete) row.appendChild(App.el('button', { class: 'icon-btn del', style: 'padding:2px', html: Icons.close(), onclick: onDelete }));
      return row;
    };

    const body = App.el('div', { class: 'week-body' });
    body.appendChild(App.el('div', { class: 'callout' }, [
      App.el('span', { html: Icons.sparkles() }),
      App.el('div', { class: 'grow' }, [App.el('div', { class: 'lbl-up', style: 'margin-bottom:2px' }, 'This Week’s Intention'), textInput(() => w.intention, (v) => { w.intention = v; }, 'Meine Absicht für diese Woche…')]),
    ]));
    body.appendChild(App.el('div', { class: 'field-grid', style: 'margin-bottom:12px' }, [
      App.el('div', {}, [App.el('div', { class: 'lbl-up' }, 'Priorities'), ...w.priorities.map((p) => taskLine(p))]),
      App.el('div', {}, [App.el('div', { class: 'lbl-up' }, 'Reminders'), ...w.reminders.map((r, i) => App.el('div', { class: 'cl-item' }, [App.el('div', { class: 'tag', style: 'width:16px;padding-top:6px' }, `${i + 1}.`), App.el('div', { class: 'grow' }, [textInput(() => w.reminders[i], (v) => { w.reminders[i] = v; })])]))]),
    ]));

    const dayBox = (title, content) => App.el('div', { class: 'day-box' }, [App.el('h4', {}, title), ...content]);
    const grid = App.el('div', { class: 'day-grid' });
    grid.appendChild(dayBox('⟐ Affirmation', [textInput(() => w.affirmation, (v) => { w.affirmation = v; }, '…')]));
    [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']].forEach(([k, label]) => {
      const list = App.el('div');
      const drawList = () => {
        list.innerHTML = '';
        w.days[k].forEach((task, idx) => list.appendChild(taskLine(task, () => { w.days[k].splice(idx, 1); save(); drawList(); })));
      };
      drawList();
      const add = App.el('button', { class: 'add-line', onclick: () => { w.days[k].push({ text: '', checked: false }); save(); drawList(); } }, '+ Aufgabe');
      grid.appendChild(dayBox(`⟐ ${label}`, [list, add]));
    });
    body.appendChild(grid);

    card.append(head, body);
    return card;
  },
};
