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
  layout: 'list',    // list | gallery
  q: '',
  monthKey: App.todayStr().slice(0, 7),

  async render() {
    const wrap = App.el('div');
    const all = Calc.sort(await DB.getAll('trades')).reverse();

    const chipsFor = (opts, current, set, kinds = {}) => App.el('div', { class: 'chip-scroll' }, opts.map(([k, label]) => App.el('button', {
      class: `chip ${kinds[k] || ''}` + (current === k ? ' active' : ''), onclick: () => { set(k); App.refresh(); },
    }, label)));
    wrap.appendChild(App.el('div', { class: 'filters' }, [
      chipsFor([['all', 'Alle'], ['today', 'Heute'], ['week', 'Woche'], ['month', 'Monat']], this.range, (k) => { this.range = k; }),
      chipsFor([['all', 'Alle Ergebnisse'], ['win', 'Wins'], ['loss', 'Losses'], ['be', 'B/E'], ['tape', 'Tape']], this.outcome, (k) => { this.outcome = k; }, { win: 'win', loss: 'loss', be: 'be' }),
    ]));

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

    const searchInput = App.el('input', { type: 'text', placeholder: 'Trades durchsuchen…', value: this.q });
    const layoutBtn = (key, icon) => App.el('button', {
      class: 'round-btn', style: this.layout === key ? 'color:var(--accent);border-color:rgba(var(--accent-rgb),.6)' : '',
      html: Icons[icon](), onclick: () => { this.layout = key; App.refresh(); },
    });
    wrap.appendChild(App.el('div', { class: 'row', style: 'margin-bottom:16px' }, [
      App.el('div', { class: 'search-wrap' }, [App.el('span', { html: Icons.search() }), searchInput]),
      layoutBtn('list', 'list'), layoutBtn('gallery', 'grid'),
    ]));

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
        g.appendChild(App.el('div', { class: 'g-card', style: `animation-delay:${Math.min(i, 12) * 30}ms`, onclick: () => TradeDetail.open(t) }, [
          App.el('div', { class: 'g-cover', style: cover ? `background-image:url(${cover})` : '' }, cover ? '' : (t.pair || '·')),
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
    return App.el('div', { class: 'item clickable', style: `animation-delay:${Math.min(i, 12) * 30}ms`, onclick: () => TradeDetail.open(t) }, [
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
      cover ? App.el('img', { src: cover, alt: '', style: 'width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;margin-bottom:16px;cursor:zoom-in', onclick: () => UI.lightbox(cover) }) : null,
      App.el('h3', {}, t.trade || t.pair || 'Trade'),
      grid, ...texts, ...imgs,
      App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => { App.closeModal(); TradeForm.open(t); } }, [App.icon('edit'), 'Bearbeiten']),
        App.el('button', { class: 'btn danger', onclick: async () => { if (await App.confirm('Trade löschen?')) { await DB.delete('trades', t.id); App.closeModal(); App.refresh(); } } }, [App.icon('trash'), 'Löschen']),
      ]),
      App.el('button', { class: 'btn secondary', style: 'margin-top:10px', onclick: () => App.closeModal() }, 'Schließen'),
    ]);
    App.showModal(content);
  },
};

const TradeForm = {
  open(existing) {
    App.openPage(existing ? 'Trade bearbeiten' : 'Neuer Trade', () => this.render(existing));
  },

  async render(existing) {
    const t = existing ? { ...existing, images: { ...(existing.images || {}) } } : { id: DB.uid(), createdAt: Date.now(), date: App.todayStr(), images: {} };

    // Pre-Trade-Check (nur bei neuen Trades): Trading Model abhaken + Warnung bei >= 2 Trades heute
    const modelDoc = existing ? null : await DB.get('checklists', 'tradingModel');
    const todayCount = existing ? 0 : (await DB.getAll('trades')).filter((x) => x.date === App.todayStr()).length;
    let checkCard = null;
    if (modelDoc) {
      const cnt = App.el('div', { class: 'tag' });
      const bar = App.el('div', { class: 'progress', style: 'margin-top:12px' }, [App.el('i')]);
      const upd = () => {
        const c = UI.countChecks(modelDoc);
        cnt.textContent = c.total ? `${c.done} von ${c.total} Punkten erfüllt` : 'Noch keine Punkte im Trading Model';
        requestAnimationFrame(() => { bar.firstChild.style.width = (c.total ? (c.done / c.total) * 100 : 0) + '%'; });
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
        todayCount >= 2 ? App.el('div', { class: 'callout', style: 'margin:14px 0 0' }, [App.el('span', { html: Icons.alert(), style: 'color:var(--loss)' }), App.el('div', { class: 'tag', style: 'color:var(--text)' }, `Du hattest heute schon ${todayCount} Trades. Laut deinem Model: max. 2 pro Tag.`)]) : null,
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
    };
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
      moreBtn.lastChild.textContent = open ? 'Weniger Felder' : 'Mehr Felder (Macro, Rating, SL/TP, Idee …)';
    } }, [App.icon('plus'), 'Mehr Felder (Macro, Rating, SL/TP, Idee …)']);

    const save = async () => {
      if (!date.value) { App.toast('Bitte ein Datum wählen.'); return; }
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
      App.closePage();
    };

    const card = (...kids) => App.el('div', { class: 'card' }, kids);
    return App.el('div', {}, [
      checkCard,
      card(
        UI.field('Trade', title),
        App.el('div', { class: 'field-grid' }, [UI.field('Datum', App.el('div', {}, [date, dayLbl])), UI.field('R:R (Betrag)', App.el('div', {}, [rr, App.el('div', { class: 'tag', style: 'margin-top:6px' }, 'Vorzeichen folgt dem Ergebnis')]))]),
        UI.field('Pair', f.pair), UI.field('Long / Short', f.ls),
      ),
      card(UI.field('Model', f.model), UI.field('PO3', f.po3), UI.field('Entry (Setup / Timeframe)', f.timeframes), UI.field('DoL', f.dol)),
      card(UI.field('Ergebnis', f.result), UI.field('Psych', psych), UI.field('Notes', notes)),
      card(UI.field('Chart LTF', img.ltf), UI.field('Chart MTF', img.mtf), UI.field('Chart HTF', img.htf)),
      moreBtn, more,
      App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => App.back() }, 'Abbrechen'),
        App.el('button', { class: 'btn', onclick: save }, [App.icon('check'), 'Speichern']),
      ]),
    ]);
  },
};
