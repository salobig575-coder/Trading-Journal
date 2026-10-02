// Journal: Trade-Liste (Tabelle/Galerie, Filter), Detail-Ansicht, Formular
// Journal-Hub: Trades | Analysen | Reviews
const JournalHub = {
  activeTab: 'trades',
  tabs: [{ key: 'trades', label: 'Trades' }, { key: 'analysis', label: 'Analysen' }, { key: 'review', label: 'Reviews' }],

  async render() {
    const wrap = App.el('div');
    wrap.appendChild(App.tabBar(this.tabs, this.activeTab, (k) => { this.activeTab = k; App.refresh(); }));
    if (this.activeTab === 'analysis') wrap.appendChild(await AnalysisView.render());
    else if (this.activeTab === 'review') wrap.appendChild(await Collections.listView('review'));
    else wrap.appendChild(await JournalView.render());
    return wrap;
  },
};

const JournalView = {
  range: 'all',      // all | today | week | month
  outcome: 'all',    // all | win | loss | be | tape
  sort: 'new',       // new | old | best | worst
  layout: 'list',    // list | gallery
  q: '',
  filtersOpen: false,
  monthKey: App.todayStr().slice(0, 7),

  async render() {
    const wrap = App.el('div');
    const all = Calc.sort(await DB.getAll('trades')).reverse();

    // Suche + Filter-Knopf + Ansicht; die Filter selbst klappen sanft auf (wenige Optionen pro Screen)
    const chipsFor = (opts, current, set, kinds = {}) => App.el('div', { class: 'chip-group' }, opts.map(([k, label]) => App.el('button', {
      class: `chip ${kinds[k] || ''}` + (current === k ? ' active' : ''), onclick: () => { set(k); App.refresh(); },
    }, label)));
    const activeFilters = (this.range !== 'all' ? 1 : 0) + (this.outcome !== 'all' ? 1 : 0) + (this.sort !== 'new' ? 1 : 0);
    const searchInput = App.el('input', { type: 'text', placeholder: 'Trades durchsuchen…', value: this.q });
    const filterBtn = App.el('button', {
      class: 'round-btn', style: 'position:relative' + (this.filtersOpen || activeFilters ? ';color:var(--accent)' : ''), 'aria-label': 'Filter',
      html: Icons.filter(), onclick: () => { this.filtersOpen = !this.filtersOpen; panel.classList.toggle('open', this.filtersOpen); filterBtn.style.color = this.filtersOpen || activeFilters ? 'var(--accent)' : ''; },
    }, activeFilters ? [App.el('span', { class: 'badge' }, String(activeFilters))] : []);
    const layoutBtn = App.el('button', { class: 'round-btn', 'aria-label': 'Ansicht wechseln', html: Icons[this.layout === 'list' ? 'grid' : 'list'](), onclick: () => { this.layout = this.layout === 'list' ? 'gallery' : 'list'; App.refresh(); } });
    wrap.appendChild(App.el('div', { class: 'row', style: 'margin-bottom:8px;gap:8px' }, [
      App.el('div', { class: 'search-wrap' }, [App.el('span', { html: Icons.search() }), searchInput]), filterBtn, layoutBtn,
    ]));
    const panel = App.el('div', { class: 'filter-panel' + (this.filtersOpen ? ' open' : '') }, [App.el('div', { class: 'inner' }, [
      App.el('div', {}, [App.el('div', { class: 'lbl-up' }, 'Zeitraum'), chipsFor([['all', 'Alle'], ['today', 'Heute'], ['week', 'Woche'], ['month', 'Monat']], this.range, (k) => { this.range = k; })]),
      App.el('div', {}, [App.el('div', { class: 'lbl-up' }, 'Ergebnis'), chipsFor([['all', 'Alle'], ['win', 'Wins'], ['loss', 'Losses'], ['be', 'B/E'], ['tape', 'Tape']], this.outcome, (k) => { this.outcome = k; }, { win: 'win', loss: 'loss', be: 'be' })]),
      App.el('div', {}, [App.el('div', { class: 'lbl-up' }, 'Sortierung'), chipsFor([['new', 'Neueste'], ['old', 'Älteste'], ['best', 'Bestes R'], ['worst', 'Schlechtestes R']], this.sort, (k) => { this.sort = k; })]),
    ])]);
    wrap.appendChild(panel);
    wrap.appendChild(App.el('div', { style: 'height:8px' }));

    if (this.range === 'month') {
      const [y, m] = this.monthKey.split('-').map(Number);
      const shift = (n) => { const d = new Date(y, m - 1 + n, 1); this.monthKey = App.todayStr(d).slice(0, 7); App.refresh(); };
      wrap.appendChild(App.el('div', { class: 'cal-head' }, [
        App.el('button', { class: 'icon-btn', html: Icons.chevronLeft(), onclick: () => shift(-1) }),
        App.el('div', { class: 'ttl' }, `${App.monthName(m - 1)} ${y}`),
        App.el('button', { class: 'icon-btn', html: Icons.chevronRight(), onclick: () => shift(1) }),
      ]));
    }

    const today = App.todayStr();
    const wk = App.weekStart(today);
    let list = all.filter((t) => {
      if (this.outcome !== 'all' && Calc.outcome(t) !== this.outcome) return false;
      if (this.range === 'today') return t.date === today;
      if (this.range === 'week') return t.date >= wk && t.date <= App.addDays(wk, 6);
      if (this.range === 'month') return (t.date || '').startsWith(this.monthKey);
      return true;
    });
    if (this.sort === 'old') list.reverse();
    else if (this.sort === 'best') list.sort((a, b) => Calc.rValue(b) - Calc.rValue(a));
    else if (this.sort === 'worst') list.sort((a, b) => Calc.rValue(a) - Calc.rValue(b));

    const listNode = App.el('div');
    const summaryNode = App.el('div');
    wrap.appendChild(summaryNode);
    wrap.appendChild(listNode);

    const draw = () => {
      const q = this.q.toLowerCase();
      const filtered = q ? list.filter((t) => JSON.stringify([t.trade, t.pair, t.model, t.notes, t.psych, t.result, t.ls, t.timeframes]).toLowerCase().includes(q)) : list;
      summaryNode.innerHTML = '';
      listNode.innerHTML = '';
      if (filtered.length) summaryNode.appendChild(this.summaryStrip(filtered));
      if (!filtered.length) {
        listNode.appendChild(App.empty('journal', all.length ? 'Keine Trades in dieser Auswahl.' : 'Noch keine Trades. Dein erster Eintrag ist der wichtigste.'));
        if (!all.length) listNode.appendChild(App.el('button', { class: 'btn', onclick: () => TradeForm.open() }, [App.icon('plus'), 'Ersten Trade eintragen']));
        return;
      }
      listNode.appendChild(this.tradeList(filtered, this.layout));
    };
    searchInput.addEventListener('input', () => { this.q = searchInput.value; draw(); });
    draw();
    return wrap;
  },

  summaryStrip(trades) {
    const s = Calc.summary(trades);
    const strip = App.el('div', { class: 'stat-grid three' }, [
      App.el('div', { class: 'stat-tile' }, [App.el('div', { class: 'lbl' }, 'Trades'), App.el('div', { class: 'num' }, String(trades.length))]),
      App.el('div', { class: 'stat-tile' }, [App.el('div', { class: 'lbl' }, 'Winrate'), App.el('div', { class: 'num' }, `${Math.round(s.winrate)}%`)]),
      App.el('div', { class: 'stat-tile' }, [App.el('div', { class: 'lbl' }, 'Net R'), App.el('div', { class: 'num ' + Calc.rClass(s.net) }, Calc.fmtR(s.net, 1))]),
    ]);
    return strip;
  },

  tradeList(trades, layout) {
    if (layout === 'gallery') {
      const g = App.el('div', { class: 'gallery' });
      trades.forEach((t, i) => {
        const cover = this.firstImage(t);
        const r = Calc.rValue(t);
        g.appendChild(App.el('div', { class: 'g-card', 'data-fid': t.id, onclick: () => TradeDetail.open(t) }, [
          (() => { const c = App.el('div', { class: 'g-cover' }, t.pair || '·'); if (cover) Img.fillBg(c, cover, t.pair || '·'); return c; })(),
          App.el('div', { class: 'g-body' }, [
            App.el('div', { class: 'tt' }, t.trade || t.pair || 'Trade'),
            App.el('div', { class: 'item-meta' }, `${App.formatDate(t.date)}${t.ls ? ' · ' + t.ls : ''}`),
            App.el('div', { class: 'pills' }, [t.result ? UI.pill(t.result, UI.outcomeKind(t)) : null, Calc.outcome(t) && Calc.outcome(t) !== 'tape' ? UI.pill(Calc.fmtR(r, 1), r > 0 ? 'win' : r < 0 ? 'loss' : 'be') : null]),
          ]),
        ]));
      });
      return g;
    }
    const list = App.el('div', { class: 'list' });
    trades.forEach((t, i) => list.appendChild(this.tradeItem(t, i)));
    return list;
  },

  tradeItem(t, i = 0) {
    const o = Calc.outcome(t);
    const r = Calc.rValue(t);
    const meta = [App.formatDate(t.date), t.pair, t.ls, t.model].filter(Boolean).join(' · ');
    return App.el('div', { class: 'item clickable', 'data-fid': t.id, onclick: () => TradeDetail.open(t) }, [
      App.el('div', { class: 'side-bar ' + (o === 'win' ? 'win' : o === 'loss' ? 'loss' : o === 'be' ? 'be' : '') }),
      App.el('div', { class: 'grow', style: 'padding-left:6px' }, [
        App.el('div', { class: 'item-title' }, t.trade || t.pair || 'Trade'),
        App.el('div', { class: 'item-meta' }, meta),
        t.result ? App.el('div', { class: 'pills' }, [UI.pill(t.result, UI.outcomeKind(t))]) : null,
      ]),
      o && o !== 'tape' ? App.el('div', { class: 'r-val ' + Calc.rClass(r) }, Calc.fmtR(r, 1)) : null,
    ]);
  },

  firstImage(t) {
    const im = t.images || {};
    return (im.ltf && im.ltf[0]) || (im.mtf && im.mtf[0]) || (im.htf && im.htf[0]) || (im.photo && im.photo[0]) || '';
  },
};

const TradeDetail = {
  open(t) {
    const prop = (k, v, full) => (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) ? null
      : App.el('div', { class: 'prop' + (full ? ' full' : '') }, [App.el('div', { class: 'k' }, k), Array.isArray(v) ? App.el('div', { class: 'pills', style: 'margin-top:0' }, v.map((x) => UI.pill(x))) : App.el('div', { class: 'v' }, String(v))]);
    const r = Calc.rValue(t);
    const o = Calc.outcome(t);

    const grid = App.el('div', { class: 'prop-grid' }, [
      prop('Datum', `${App.formatDate(t.date)} (${t.day || App.weekdayName(t.date)})`),
      prop('Pair', t.pair), prop('Long/Short', t.ls), prop('Model', t.model), prop('PO3', t.po3),
      prop('Ergebnis', t.result),
      o && o !== 'tape' ? prop('R:R (netto)', Calc.fmtR(r)) : null,
      t.check ? prop('Model-Check', `${t.check.done} / ${t.check.total}`) : null,
      t.pnl !== undefined && t.pnl !== '' && o && o !== 'tape' ? prop('Ergebnis in $', (Calc.pnl(t) > 0 ? '+' : '') + Calc.pnl(t).toLocaleString('de-DE') + ' $') : null,
      prop('Fehler', t.mistakes, true),
      prop('Rating', t.rating), prop('Bias (W/L)', t.bias), prop('P/L', t.pl),
      prop('SL (Punkte)', t.slPoints), prop('TP (Punkte)', t.tpPoints),
      prop('Entry', t.timeframes, true), prop('Entry-Typ', t.entryTypes, true), prop('DoL', t.dol, true), prop('Macro', t.macro, true),
    ]);

    const texts = [['Psych', t.psych], ['Notes', t.notes], ['Trade idea', t.idea], ['What can I improve', t.improve]]
      .filter(([, v]) => v).map(([k, v]) => App.el('div', {}, [App.el('div', { class: 'lbl-up' }, k), App.el('div', { class: 'text-block' }, v)]));

    const imgs = [['LTF', 'ltf'], ['MTF', 'mtf'], ['HTF', 'htf'], ['Foto', 'photo']]
      .filter(([, k]) => t.images && t.images[k] && t.images[k].length)
      .map(([label, k]) => App.el('div', {}, [App.el('div', { class: 'lbl-up' }, label), UI.imageViewer(t.images[k])]));

    const cover = JournalView.firstImage(t);
    const content = App.el('div', {}, [
      cover ? (() => { const im = App.el('img', { alt: '', class: 'cover-img', onclick: () => UI.lightbox([cover]) }); Img.fill(im, cover); return im; })() : null,
      App.el('h3', {}, t.trade || t.pair || 'Trade'),
      grid, ...texts, ...imgs,
      App.el('div', { class: 'btn-row wrap' }, [
        App.el('button', { class: 'btn secondary', onclick: () => { App.closeModal(); TradeForm.open(t); } }, [App.icon('edit'), 'Bearbeiten']),
        App.el('button', { class: 'btn secondary', onclick: () => { App.closeModal(); TradeForm.open(null, TradeForm.templateFrom(t)); } }, [App.icon('copy'), 'Duplizieren']),
        App.el('button', { class: 'btn danger', onclick: async () => { if (await App.confirm('Trade löschen?')) { await DB.delete('trades', t.id); App.closeModal(); App.refresh(); App.undoToast('Trade gelöscht', () => DB.restore('trades', t)); } } }, [App.icon('trash'), 'Löschen']),
      ]),
      App.el('button', { class: 'btn secondary', style: 'margin-top:10px', onclick: () => App.closeModal() }, 'Schließen'),
    ]);
    App.showModal(content);
  },
};

const TradeForm = {
  // existing: Trade bearbeiten · template: Felder eines frueheren Trades als Vorlage uebernehmen
  open(existing, template) {
    App.openPage(existing ? 'Trade bearbeiten' : 'Neuer Trade', () => this.render(existing, template));
  },

  // Vorlage aus einem Trade: nur die Setup-Felder, keine Ergebnisse/Notizen/Bilder
  templateFrom(t) {
    const keep = ['pair', 'ls', 'model', 'po3', 'timeframes', 'dol', 'macro', 'entryTypes', 'account'];
    return Object.fromEntries(keep.filter((k) => t[k] !== undefined).map((k) => [k, Array.isArray(t[k]) ? t[k].slice() : t[k]]));
  },

  async render(existing, template) {
    const t = existing ? { ...existing, images: { ...(existing.images || {}) } } : { ...(template || {}), id: DB.uid(), createdAt: Date.now(), date: App.todayStr(), images: {} };

    // Entwurf: ein halb ausgefuellter neuer Trade bleibt erhalten, falls du unterbrochen wirst
    const DRAFT_KEY = 'tj_trade_draft';
    let draft = null;
    if (!existing && !template) { try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) {} }
    if (draft && draft.fields) Object.assign(t, draft.fields);

    // Pre-Trade-Check (nur bei neuen Trades): Trading Model abhaken + Warnung bei >= 2 Trades heute
    const modelDoc = existing ? null : await DB.get('checklists', 'tradingModel');
    const allTrades = existing ? [] : await DB.getAll('trades');
    const rules = await DB.getSetting('riskRules', { maxTrades: 2, lossStreak: 2, dailyLossR: 2 });
    const accounts = (await DB.getAll('collections')).filter((c) => c.kind === 'account' && !c.closed);
    // Kleine Ueberraschung: Pair und Konto sind vorausgewaehlt, wenn du sie fast immer nimmst (jederzeit abwaehlbar)
    let autoPair = false;
    if (!existing && !template && !draft && allTrades.length >= 3) {
      const recent = Calc.sort(allTrades).slice(-12);
      const top = (key) => {
        const n = {}; recent.forEach((x) => { if (x[key]) n[x[key]] = (n[x[key]] || 0) + 1; });
        const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
        return best && best[1] / recent.length >= 0.6 ? best[0] : '';
      };
      const p = top('pair');
      if (p && !t.pair && Options.get('pairs').includes(p)) { t.pair = p; autoPair = true; }
      const acc = top('account');
      if (acc && !t.account && accounts.some((a) => a.id === acc)) t.account = acc;
    }
    const warnings = [];
    if (!existing) {
      const todayTrades = allTrades.filter((x) => x.date === App.todayStr());
      if (rules.maxTrades && todayTrades.length >= rules.maxTrades) warnings.push(`Du hattest heute schon ${todayTrades.length} Trades (Limit: ${rules.maxTrades}).`);
      const closed = Calc.sort(allTrades).filter((x) => ['win', 'loss', 'be'].includes(Calc.outcome(x)));
      const n = rules.lossStreak;
      if (n && closed.length >= n && closed.slice(-n).every((x) => Calc.outcome(x) === 'loss')) warnings.push(`Deine letzten ${n} Trades waren Verluste. Kurze Pause einlegen?`);
      const dayR = todayTrades.reduce((s, x) => s + Calc.rValue(x), 0);
      if (rules.dailyLossR && dayR <= -rules.dailyLossR) warnings.push(`Heute stehst du bei ${Calc.fmtR(dayR, 1)} – dein Tageslimit ist −${rules.dailyLossR}R.`);
    }
    const warnCard = warnings.length ? App.el('div', { class: 'card warn' }, warnings.map((w) => App.el('div', { class: 'row', style: 'align-items:flex-start;gap:12px;padding:3px 0' }, [
      App.el('span', { html: Icons.alert(), style: 'width:20px;height:20px;color:var(--loss);flex-shrink:0;margin-top:1px' }), App.el('div', { style: 'font-weight:500;font-size:14px' }, w),
    ]))) : null;
    let checkCard = null;
    if (modelDoc) {
      const cnt = App.el('div', { class: 'tag' });
      const bar = App.el('div', { class: 'progress', style: 'margin-top:12px' }, [App.el('i')]);
      const upd = () => {
        const c = UI.countChecks(modelDoc);
        cnt.textContent = c.total ? `${c.done} von ${c.total} Punkten erfüllt` : 'Noch keine Punkte im Trading Model';
        App.fill(bar.firstChild, c.total ? c.done / c.total : 0);
      };
      upd();
      const open = () => {
        const bd = App.showModal(App.el('div', {}, [
          App.el('h3', {}, 'Pre-Trade-Check'),
          UI.checklist(modelDoc, { progressLabel: 'Trading Model', multiSection: false }),
          App.el('button', { class: 'btn', style: 'margin-top:12px', onclick: () => App.closeModal() }, 'Fertig'),
        ]));
        const obs = new MutationObserver(() => { if (!document.body.contains(bd)) { upd(); obs.disconnect(); } });
        obs.observe(document.body, { childList: true });
      };
      checkCard = App.el('div', { class: 'card' }, [
        App.el('div', { class: 'row between' }, [
          App.el('div', {}, [App.el('div', { style: 'font-weight:600;font-size:16px' }, 'Pre-Trade-Check'), cnt]),
          App.el('button', { class: 'btn small secondary', onclick: open }, [App.icon('target', 15), 'Öffnen']),
        ]),
        bar,
      ]);
    }

    const title = App.el('input', { type: 'text', value: t.trade || '', placeholder: 'z. B. NQ Long 9:45' });
    const date = App.el('input', { type: 'date', value: t.date });
    const dayLbl = App.el('div', { class: 'tag', style: 'margin-top:6px' }, App.weekdayName(t.date));
    date.addEventListener('change', () => { dayLbl.textContent = date.value ? App.weekdayName(date.value) : ''; });
    const rr = App.el('input', { type: 'number', inputmode: 'decimal', step: '0.1', min: '0', value: t.rr !== undefined && t.rr !== '' ? t.rr : '', placeholder: '2.5' });
    const resultKind = (o) => /Win$/.test(o) ? 'win' : /Loss$/.test(o) ? 'loss' : 'be';

    const f = {
      pair: UI.chips(Options.get('pairs'), t.pair, {}),
      ls: UI.chips(Options.get('ls'), t.ls, { kind: (o) => (o === 'Long' ? 'win' : 'loss') }),
      model: UI.chips(Options.get('models'), t.model, {}),
      po3: UI.chips(Options.get('po3'), t.po3, {}),
      timeframes: UI.chips(Options.get('timeframes'), t.timeframes || [], { multi: true }),
      dol: UI.chips(Options.get('dol'), t.dol || [], { multi: true }),
      result: UI.chips(Options.get('results'), t.result, { kind: resultKind }),
      macro: UI.chips(Options.get('macro'), t.macro || [], { multi: true }),
      rating: UI.chips(Options.get('ratings'), t.rating, {}),
      entryTypes: UI.chips(Options.get('entryTypes'), t.entryTypes || [], { multi: true }),
      bias: UI.chips(Options.get('biases'), t.bias, {}),
      pl: UI.chips(Options.get('pl'), t.pl, {}),
      mistakes: UI.chips(Options.get('mistakes'), t.mistakes || [], { multi: true }),
      account: UI.chips(accounts.map((a) => a.name), (accounts.find((a) => a.id === t.account) || {}).name || '', {}),
    };
    const pnl = App.el('input', { type: 'number', inputmode: 'decimal', step: '1', min: '0', value: t.pnl !== undefined && t.pnl !== '' ? t.pnl : '', placeholder: '350' });
    const psych = App.el('textarea', { placeholder: 'Wie war dein mentaler Zustand?' }, t.psych || '');
    const notes = App.el('textarea', { placeholder: 'Notizen zum Trade…', style: 'min-height:120px' }, t.notes || '');
    const idea = App.el('textarea', { placeholder: 'Trade-Idee…' }, t.idea || '');
    const improve = App.el('textarea', { placeholder: 'Was kann ich verbessern?' }, t.improve || '');
    const sl = App.el('input', { type: 'number', inputmode: 'decimal', value: t.slPoints !== undefined ? t.slPoints : '', placeholder: 'SL' });
    const tp = App.el('input', { type: 'number', inputmode: 'decimal', value: t.tpPoints !== undefined ? t.tpPoints : '', placeholder: 'TP' });
    const img = {
      ltf: UI.imageField(t.images.ltf), mtf: UI.imageField(t.images.mtf), htf: UI.imageField(t.images.htf), photo: UI.imageField(t.images.photo),
    };

    // Zusatzfelder (Archiv-Journal) einklappbar
    const more = App.el('div', { class: 'card', style: 'display:none' }, [
      UI.field('Macro (Killzone)', f.macro), UI.field('Rating', f.rating), UI.field('Entry-Typ', f.entryTypes),
      UI.field('Bias-Ergebnis (W/L)', f.bias), UI.field('P/L', f.pl),
      App.el('div', { class: 'field-grid' }, [UI.field('SL (Punkte)', sl), UI.field('TP (Punkte)', tp)]),
      UI.field('Trade idea', idea), UI.field('What can I improve', improve), UI.field('Foto', img.photo),
    ]);
    const moreBtn = App.el('button', { type: 'button', class: 'btn secondary', style: 'margin-bottom:16px', onclick: () => {
      const open = more.style.display === 'none';
      more.style.display = open ? 'block' : 'none';
      if (open) more.style.animation = 'fade .4s var(--ease) both';
      moreBtn.lastChild.textContent = open ? 'Weniger Felder' : 'Mehr Felder';
    } }, [App.icon('plus'), 'Mehr Felder']);

    const save = async () => {
      if (!date.value) { App.toast('Bitte ein Datum wählen.'); return false; }
      const out = {
        ...t,
        trade: title.value.trim(), date: date.value, day: App.weekdayName(date.value),
        pair: f.pair.get(), ls: f.ls.get(), model: f.model.get(), po3: f.po3.get(),
        timeframes: f.timeframes.get(), dol: f.dol.get(), result: f.result.get(),
        rr: rr.value === '' ? '' : Math.abs(parseFloat(rr.value)),
        psych: psych.value, notes: notes.value,
        macro: f.macro.get(), rating: f.rating.get(), entryTypes: f.entryTypes.get(), bias: f.bias.get(), pl: f.pl.get(),
        slPoints: sl.value === '' ? '' : parseFloat(sl.value), tpPoints: tp.value === '' ? '' : parseFloat(tp.value),
        idea: idea.value, improve: improve.value,
        mistakes: f.mistakes.get(), pnl: pnl.value === '' ? '' : Math.abs(parseFloat(pnl.value)),
        account: (accounts.find((a) => a.name === f.account.get()) || {}).id || '',
        images: { ltf: img.ltf.get(), mtf: img.mtf.get(), htf: img.htf.get(), photo: img.photo.get() },
        updatedAt: Date.now(),
      };
      if (modelDoc) {
        const c = UI.countChecks(modelDoc);
        if (c.done > 0) {
          out.check = { done: c.done, total: c.total };
          UI.resetChecks(modelDoc); // naechster Trade startet mit leerer Checkliste
          await DB.put('checklists', modelDoc);
        }
      }
      await DB.put('trades', out);
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      App.justSaved = out.id;   // Eintrag bekommt in der Liste einen kurzen Lichtstreifen
      return true;
    };
    const finish = () => { App.success('Trade gespeichert'); App.closePage(); };

    const card = (...kids) => App.el('div', { class: 'card' }, kids);
    const lastTrade = !existing && !template ? Calc.sort(allTrades).at(-1) : null;
    const snapshot = () => ({
      trade: title.value, date: date.value, pair: f.pair.get(), ls: f.ls.get(), model: f.model.get(), po3: f.po3.get(),
      timeframes: f.timeframes.get(), dol: f.dol.get(), result: f.result.get(), rr: rr.value, pnl: pnl.value,
      psych: psych.value, notes: notes.value, macro: f.macro.get(), rating: f.rating.get(), entryTypes: f.entryTypes.get(),
      bias: f.bias.get(), pl: f.pl.get(), idea: idea.value, improve: improve.value, mistakes: f.mistakes.get(),
      account: (accounts.find((a) => a.name === f.account.get()) || {}).id || '', slPoints: sl.value, tpPoints: tp.value,
    });
    const draftBanner = draft && draft.fields ? App.el('div', { class: 'card', style: 'padding:var(--s2) var(--s3)' }, [
      App.el('div', { class: 'row between', style: 'flex-wrap:wrap;gap:12px' }, [
        App.el('div', {}, [App.el('div', { style: 'font-weight:600' }, 'Entwurf wiederhergestellt'), App.el('div', { class: 'tag' }, `Gespeichert um ${new Date(draft.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`)]),
        App.el('button', { class: 'btn small secondary', onclick: () => { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} draft = null; App.stack[App.stack.length - 1].render = () => TradeForm.render(null); App.show({ instant: true, dir: 'fade' }); } }, 'Verwerfen'),
      ]),
    ]) : null;
    const root = App.el('div', {}, [
      draftBanner,
      warnCard,
      checkCard,
      lastTrade ? App.el('button', { class: 'btn secondary', style: 'margin-bottom:16px', onclick: () => { const tpl = TradeForm.templateFrom(lastTrade); App.stack[App.stack.length - 1].render = () => TradeForm.render(null, tpl); App.show({ instant: true }); } }, [App.icon('copy'), 'Setup vom letzten Trade']) : null,
      card(
        UI.field('Trade', title),
        App.el('div', { class: 'field-grid' }, [UI.field('Datum', App.el('div', {}, [date, dayLbl])), UI.field('R:R (Betrag)', App.el('div', {}, [rr, App.el('div', { class: 'tag', style: 'margin-top:6px' }, 'Vorzeichen folgt dem Ergebnis')]))]),
        UI.field('Pair', autoPair ? App.el('div', {}, [f.pair, App.el('div', { class: 'tag', style: 'margin-top:6px' }, 'Vorausgewählt: dein häufigstes Pair der letzten Trades')]) : f.pair), UI.field('Long / Short', f.ls),
      ),
      card(UI.field('Model', f.model), UI.field('PO3', f.po3), UI.field('Entry (Setup / Timeframe)', f.timeframes), UI.field('DoL', f.dol)),
      card(
        UI.field('Ergebnis', f.result),
        App.el('div', { class: 'field-grid' }, [UI.field('Ergebnis in $ (Betrag)', pnl), accounts.length ? UI.field('Konto', f.account) : null]),
        UI.field('Fehler', f.mistakes), UI.field('Psych', psych), UI.field('Notes', notes),
      ),
      card(UI.field('Chart LTF', img.ltf), UI.field('Chart MTF', img.mtf), UI.field('Chart HTF', img.htf)),
      moreBtn, more,
      App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.back() }, 'Abbrechen'),
        App.el('button', { class: 'btn', onclick: (e) => UI.morph(e.currentTarget, save, finish) }, [App.icon('check'), 'Speichern']),
      ]),
    ]);
    // Entwurf alle 3 Sekunden sichern, solange das Formular offen ist (nur neue Trades, ohne Bilder)
    if (!existing && !template) {
      let last = '';
      const timer = setInterval(() => {
        if (!document.body.contains(root)) { clearInterval(timer); return; }
        const snap = snapshot();
        const meaningful = snap.trade.trim() || snap.pair || snap.result || snap.notes.trim() || snap.psych.trim() || snap.timeframes.length;
        const json = JSON.stringify(snap);
        if (!meaningful || json === last) return;
        last = json;
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), fields: snap })); } catch (e) {}
      }, 3000);
    }
    return root;
  },
};
