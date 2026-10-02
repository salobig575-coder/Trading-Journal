// Analyse: Pre-Session Analysis (Weekly Outlook / Weekly Review / Daily Log) + Review-Sammlung
const AnalysisTemplates = {
  'Weekly Outlook': {
    icon: 'sparkles',
    hint: 'Ausblick auf die Woche',
    sections: [
      { key: 'news', title: 'Economic Calendar · News', type: 'text' },
      { key: 'sessions', title: 'Trading Sessions', type: 'days' },
      { key: 'thoughts', title: 'Weekly Thoughts', type: 'text' },
      { key: 'analysis', title: 'Weekly Analysis', type: 'textimg' },
    ],
  },
  'Weekly Review': {
    icon: 'review',
    hint: 'Rückblick auf die Woche',
    sections: [
      { key: 'original', title: 'Original Ideas (Weekly Outlook)', type: 'link' },
      { key: 'outcome', title: 'Outcome', type: 'textimg' },
      { key: 'hl', title: 'When was the high or low of the week made?', type: 'text' },
      { key: 'profile', title: 'What market profile played out?', type: 'text' },
      { key: 'moves', title: 'When did the explosive moves happen? What about the consolidations?', type: 'text' },
      { key: 'trades', title: 'This Week’s Trades', type: 'trades' },
      { key: 'performance', title: 'Performance – How many trades have you made? How would you rate your performance?', type: 'text' },
      { key: 'emotions', title: 'What have been your emotions during the week?', type: 'text' },
      { key: 'done', title: 'What have you done well?', type: 'text' },
      { key: 'improve', title: 'Where could you improve?', type: 'text' },
    ],
  },
  'Daily Log': {
    icon: 'journal',
    hint: 'Tages-Log mit LTF/MTF/HTF',
    sections: [
      { key: 'ltf', title: 'LTF', type: 'images' },
      { key: 'mtf', title: 'MTF', type: 'images' },
      { key: 'htf', title: 'HTF', type: 'images' },
      { key: 'notes', title: 'Notes', type: 'text' },
    ],
  },
};
const DAY_KEYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday']];

const AnalyseHub = {
  activeTab: 'analysis',
  tabs: [{ key: 'analysis', label: 'My Analysis' }, { key: 'review', label: 'Review' }],

  async render() {
    const wrap = App.el('div');
    wrap.appendChild(App.tabBar(this.tabs, this.activeTab, (k) => { this.activeTab = k; App.refresh(); }));
    wrap.appendChild(this.activeTab === 'review' ? await Collections.listView('review') : await AnalysisView.render());
    return wrap;
  },
};

const AnalysisView = {
  type: 'all',
  q: '',

  async render() {
    const wrap = App.el('div');
    const all = (await DB.getAll('analyses')).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.chooseTemplate() }, [App.icon('plus', 18), 'Neue Analyse']));
    wrap.appendChild(App.el('div', { style: 'height:12px' }));

    const typeBar = UI.chips(['Alle', ...Object.keys(AnalysisTemplates)], this.type === 'all' ? 'Alle' : this.type, {
      deselect: false, onChange: (v) => { this.type = v === 'Alle' ? 'all' : v; draw(); },
    });
    typeBar.style.marginBottom = '12px';
    wrap.appendChild(typeBar);

    const search = App.el('input', { type: 'text', placeholder: 'Analysen durchsuchen…', value: this.q });
    wrap.appendChild(App.el('div', { class: 'field search-wrap', style: 'display:block;position:relative' }, [App.el('span', { html: Icons.search(), style: 'position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-dim)' }), search]));
    search.style.paddingLeft = '38px';

    const list = App.el('div', { class: 'list' });
    wrap.appendChild(list);

    const draw = () => {
      list.innerHTML = '';
      const q = this.q.toLowerCase();
      const rows = all.filter((a) => (this.type === 'all' || a.type === this.type) && (!q || JSON.stringify([a.name, a.fields, a.pairs]).toLowerCase().includes(q)));
      if (!rows.length) { list.appendChild(App.empty('analyse', 'Keine Analysen gefunden.')); return; }
      rows.forEach((a, i) => {
        const tpl = AnalysisTemplates[a.type];
        list.appendChild(App.el('div', { class: 'item clickable', style: `animation-delay:${Math.min(i, 12) * 30}ms`, onclick: () => this.edit(a) }, [
          App.el('span', { html: Icons[tpl ? tpl.icon : 'journal'](), style: 'width:22px;height:22px;color:var(--accent);flex-shrink:0' }),
          App.el('div', { class: 'grow' }, [
            App.el('div', { class: 'item-title' }, a.name || a.type),
            App.el('div', { class: 'item-meta' }, `${a.type} · ${App.formatDate(a.date)}`),
            (a.pairs && a.pairs.length) ? App.el('div', { class: 'pills' }, a.pairs.map((p) => UI.pill(p))) : null,
          ]),
          App.el('button', { class: 'icon-btn del', html: Icons.trash(), onclick: async (e) => { e.stopPropagation(); if (UI.confirm('Analyse löschen?')) { await DB.delete('analyses', a.id); App.refresh(); } } }),
        ]));
      });
    };
    search.addEventListener('input', () => { this.q = search.value; draw(); });
    draw();
    return wrap;
  },

  chooseTemplate() {
    const content = App.el('div', {}, [
      App.el('h3', {}, 'Neue Analyse'),
      App.el('div', { class: 'list' }, Object.entries(AnalysisTemplates).map(([type, tpl]) => App.el('div', {
        class: 'item clickable', onclick: () => { App.closeModal(); this.edit(null, type); },
      }, [
        App.el('span', { html: Icons[tpl.icon](), style: 'width:22px;height:22px;color:var(--accent)' }),
        App.el('div', { class: 'grow' }, [App.el('div', { class: 'item-title' }, type), App.el('div', { class: 'item-meta' }, tpl.hint)]),
        App.el('span', { html: Icons.arrowRight(), style: 'width:16px;height:16px;color:var(--text-dim)' }),
      ]))),
      App.el('button', { class: 'btn secondary', style: 'margin-top:12px', onclick: () => App.closeModal() }, 'Abbrechen'),
    ]);
    App.showModal(content);
  },

  defaultName(type, date) {
    const w = App.isoWeek(date).week;
    if (type === 'Daily Log') return `Daily Log ${App.formatDate(date)}`;
    return `${type} CW${w}`;
  },

  edit(existing, type) {
    App.openPage(existing ? (existing.name || existing.type) : `Neu: ${type}`, () => this.renderEditor(existing, type));
  },

  async renderEditor(existing, newType) {
    const a = existing ? { ...existing, fields: { ...(existing.fields || {}) }, images: { ...(existing.images || {}) } } : {
      id: DB.uid(), type: newType, date: App.todayStr(), pairs: [], fields: {}, images: {}, createdAt: Date.now(),
    };
    if (!a.name) a.name = this.defaultName(a.type, a.date);
    const tpl = AnalysisTemplates[a.type];

    const nameInput = App.el('input', { type: 'text', value: a.name });
    const dateInput = App.el('input', { type: 'date', value: a.date });
    const pairs = UI.chips(Options.get('analysisPairs'), a.pairs, { multi: true });

    const getters = {};
    const body = App.el('div');

    const outlooks = (await DB.getAll('analyses')).filter((x) => x.type === 'Weekly Outlook').sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    const tradesBlock = App.el('div');
    const drawTrades = async () => {
      const wk = App.weekStart(dateInput.value || a.date);
      const trades = Calc.sort(await DB.getAll('trades')).filter((t) => t.date >= wk && t.date <= App.addDays(wk, 6));
      tradesBlock.innerHTML = '';
      if (!trades.length) tradesBlock.appendChild(App.el('div', { class: 'tag' }, 'Keine Trades in dieser Woche.'));
      else {
        tradesBlock.appendChild(JournalView.summaryStrip(trades));
        const l = App.el('div', { class: 'list' });
        trades.forEach((t, i) => l.appendChild(JournalView.tradeItem(t, i)));
        tradesBlock.appendChild(l);
      }
    };

    (tpl ? tpl.sections : [{ key: 'notes', title: 'Notes', type: 'text' }]).forEach((sec) => {
      const card = App.el('div', { class: 'card' }, [App.el('h2', { class: 'h' }, sec.title)]);
      if (sec.type === 'text' || sec.type === 'textimg') {
        const ta = App.el('textarea', {}, a.fields[sec.key] || '');
        getters['f:' + sec.key] = () => ta.value;
        card.appendChild(ta);
      }
      if (sec.type === 'images' || sec.type === 'textimg') {
        const im = UI.imageField(a.images[sec.key]);
        getters['i:' + sec.key] = () => im.get();
        card.appendChild(App.el('div', { style: sec.type === 'textimg' ? 'margin-top:10px' : '' }, [im]));
      }
      if (sec.type === 'days') {
        const v = a.fields[sec.key] || {};
        const inputs = {};
        DAY_KEYS.forEach(([k, label]) => {
          inputs[k] = App.el('input', { type: 'text', value: v[k] || '', placeholder: label });
          card.appendChild(App.el('div', { class: 'field', style: 'margin-bottom:8px' }, [App.el('label', {}, label), inputs[k]]));
        });
        getters['f:' + sec.key] = () => Object.fromEntries(DAY_KEYS.map(([k]) => [k, inputs[k].value]));
      }
      if (sec.type === 'link') {
        const sel = App.el('select', {}, [App.el('option', { value: '' }, '– kein Link –'), ...outlooks.map((o) => App.el('option', { value: o.id }, `${o.name} (${App.formatDate(o.date)})`))]);
        sel.value = a.fields[sec.key] || '';
        getters['f:' + sec.key] = () => sel.value;
        card.appendChild(sel);
        const preview = App.el('div', { style: 'margin-top:10px' });
        const showPreview = () => {
          preview.innerHTML = '';
          const o = outlooks.find((x) => x.id === sel.value);
          if (!o) return;
          const f = o.fields || {};
          [['News', f.news], ['Weekly Thoughts', f.thoughts], ['Weekly Analysis', f.analysis]].filter(([, v]) => v).forEach(([k, v]) => {
            preview.appendChild(App.el('div', { class: 'lbl-up' }, k));
            preview.appendChild(App.el('div', { class: 'text-block' }, v));
          });
          const imgs = (o.images && o.images.analysis) || [];
          if (imgs.length) preview.appendChild(UI.imageViewer(imgs));
        };
        sel.addEventListener('change', showPreview);
        showPreview();
        card.appendChild(preview);
      }
      if (sec.type === 'trades') {
        card.appendChild(tradesBlock);
      }
      body.appendChild(card);
    });
    dateInput.addEventListener('change', drawTrades);
    if (tpl && tpl.sections.some((s) => s.type === 'trades')) drawTrades();

    const save = async () => {
      const out = { ...a, name: nameInput.value.trim() || this.defaultName(a.type, dateInput.value), date: dateInput.value || a.date, pairs: pairs.get(), fields: {}, images: {}, updatedAt: Date.now() };
      Object.entries(getters).forEach(([k, fn]) => { const [kind, key] = k.split(':'); (kind === 'f' ? out.fields : out.images)[key] = fn(); });
      await DB.put('analyses', out);
      App.closePage();
    };

    return App.el('div', {}, [
      App.el('div', { class: 'card' }, [
        UI.field('Name', nameInput),
        UI.field('Datum', dateInput),
        UI.field('Pairs', pairs),
      ]),
      body,
      App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.back() }, 'Abbrechen'),
        App.el('button', { class: 'btn', onclick: save }, [App.icon('check'), 'Speichern']),
      ]),
    ]);
  },
};
