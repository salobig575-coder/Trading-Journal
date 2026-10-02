// Generische Sammlungen: Review DB, Prop Firms, Bio Concepts, Backtests, Edu Content
const Collections = {
  kinds: {
    review: { title: 'Review', icon: 'review', empty: 'Noch keine Reviews.', tagLabel: 'Tags' },
    propfirms: { title: 'Prop Firms', icon: 'shield', empty: 'Noch keine Prop Firms eingetragen.', tagLabel: 'Tags' },
    bio: { title: 'Bio Concepts', icon: 'dna', empty: 'Noch keine Konzepte.', tagLabel: 'Tags' },
    backtests: { title: 'Backtests', icon: 'flask', empty: 'Noch keine Backtests.', tagLabel: 'Tags', years: true },
    edu: { title: 'Edu Content', icon: 'book', empty: 'Paste here all your trading content to keep everything organized.', tagLabel: 'Tags' },
  },
  q: {},

  page(kind) {
    App.openPage(this.kinds[kind].title, () => this.listView(kind));
  },

  async listView(kind) {
    const cfg = this.kinds[kind];
    const wrap = App.el('div');
    const items = (await DB.getAll('collections')).filter((c) => c.kind === kind).sort((a, b) => (b.year || '').localeCompare(a.year || '') || b.createdAt - a.createdAt);

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.edit(kind) }, [App.icon('plus', 18), `Neu: ${cfg.title}`]));
    wrap.appendChild(App.el('div', { style: 'height:12px' }));

    const search = App.el('input', { type: 'text', placeholder: 'Durchsuchen…', value: this.q[kind] || '' });
    wrap.appendChild(App.el('div', { class: 'field', style: 'position:relative' }, [App.el('span', { html: Icons.search(), style: 'position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-dim)' }), search]));
    search.style.paddingLeft = '38px';

    const list = App.el('div');
    wrap.appendChild(list);
    const draw = () => {
      list.innerHTML = '';
      const q = (this.q[kind] || '').toLowerCase();
      const rows = items.filter((c) => !q || JSON.stringify([c.name, c.tags, c.body, c.url]).toLowerCase().includes(q));
      if (!rows.length) { list.appendChild(App.empty(cfg.icon, cfg.empty)); return; }
      let lastYear = null;
      const l = App.el('div', { class: 'list' });
      rows.forEach((c, i) => {
        if (cfg.years && c.year !== lastYear) {
          lastYear = c.year;
          l.appendChild(App.el('div', { class: 'section-title' }, `${c.year || 'Ohne Jahr'} Backtests`));
        }
        l.appendChild(App.el('div', { class: 'item clickable', style: `align-items:flex-start;animation-delay:${Math.min(i, 12) * 30}ms`, onclick: () => this.edit(kind, c) }, [
          App.el('span', { html: Icons[cfg.icon](), style: 'width:20px;height:20px;color:var(--accent);flex-shrink:0;margin-top:2px' }),
          App.el('div', { class: 'grow' }, [
            App.el('div', { class: 'item-title' }, c.name || '(ohne Titel)'),
            c.body ? App.el('div', { class: 'item-meta' }, c.body.slice(0, 90)) : null,
            (c.tags && c.tags.length) ? App.el('div', { class: 'pills' }, c.tags.map((t) => UI.pill(t))) : null,
          ]),
          App.el('button', { class: 'icon-btn del', html: Icons.trash(), onclick: async (e) => { e.stopPropagation(); if (UI.confirm('Eintrag löschen?')) { await DB.delete('collections', c.id); App.refresh(); } } }),
        ]));
      });
      list.appendChild(l);
    };
    search.addEventListener('input', () => { this.q[kind] = search.value; draw(); });
    draw();
    return wrap;
  },

  edit(kind, existing) {
    const cfg = this.kinds[kind];
    const c = existing ? { ...existing } : { id: DB.uid(), kind, name: '', tags: [], body: '', url: '', year: String(new Date().getFullYear()), createdAt: Date.now() };
    const name = App.el('input', { type: 'text', value: c.name, placeholder: 'Name' });
    const tags = App.el('input', { type: 'text', value: (c.tags || []).join(', '), placeholder: 'Tag1, Tag2' });
    const url = App.el('input', { type: 'url', value: c.url || '', placeholder: 'https://…' });
    const year = App.el('input', { type: 'number', inputmode: 'numeric', value: c.year || '' });
    const body = App.el('textarea', { style: 'min-height:200px', placeholder: 'Notizen, Ergebnisse, Inhalte…' }, c.body || '');
    const content = App.el('div', {}, [
      App.el('h3', {}, existing ? `${cfg.title} bearbeiten` : `Neu: ${cfg.title}`),
      UI.field('Name', name),
      cfg.years ? UI.field('Jahr', year) : null,
      UI.field(cfg.tagLabel, tags),
      UI.field('Link (optional)', url),
      UI.field('Inhalt', body),
      App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', { class: 'btn', onclick: async () => {
          c.name = name.value.trim();
          c.tags = tags.value.split(',').map((x) => x.trim()).filter(Boolean);
          c.url = url.value.trim();
          if (cfg.years) c.year = year.value.trim();
          c.body = body.value;
          c.updatedAt = Date.now();
          await DB.put('collections', c);
          App.closeModal();
          App.refresh();
        } }, 'Speichern'),
      ]),
    ]);
    App.showModal(content);
    if (!existing) setTimeout(() => name.focus(), 60);
  },
};
