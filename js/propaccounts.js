// Prop-Firm-Konten: Profit-Ziel, Drawdown- und Tageslimit-Puffer aus den eingetragenen $-Ergebnissen
const PropAccounts = {
  open() { App.openPage('Prop-Konten', () => this.render()); },

  async render() {
    const wrap = App.el('div');
    const accounts = (await DB.getAll('collections')).filter((c) => c.kind === 'account').sort((a, b) => (a.closed ? 1 : 0) - (b.closed ? 1 : 0) || b.createdAt - a.createdAt);
    const trades = await DB.getAll('trades');

    wrap.appendChild(App.el('button', { class: 'btn', onclick: () => this.edit() }, [App.icon('plus'), 'Neues Konto']));
    wrap.appendChild(App.el('div', { style: 'height:16px' }));
    if (!accounts.length) {
      wrap.appendChild(App.empty('wallet', 'Lege dein Eval- oder Funded-Konto an, dann siehst du hier Ziel und Limits auf einen Blick. Beim Trade wählst du das Konto aus und trägst das Ergebnis in $ ein.'));
      return wrap;
    }
    accounts.forEach((a) => wrap.appendChild(this.card(a, trades)));
    return wrap;
  },

  stats(a, trades) {
    const mine = Calc.sort(trades.filter((t) => t.account === a.id && ['win', 'loss', 'be'].includes(Calc.outcome(t))));
    const start = Number(a.start) || 0;
    let bal = start, peak = start, maxDDseen = 0;
    mine.forEach((t) => {
      bal += Calc.pnl(t);
      peak = Math.max(peak, bal);
      maxDDseen = Math.max(maxDDseen, (a.trailing ? peak : start) - bal);
    });
    const profit = bal - start;
    const dd = Math.max(0, (a.trailing ? peak : start) - bal);
    const today = App.todayStr();
    const todayPnl = mine.filter((t) => t.date === today).reduce((s, t) => s + Calc.pnl(t), 0);
    return { n: mine.length, bal, profit, dd, todayPnl, peak };
  },

  card(a, trades) {
    const s = this.stats(a, trades);
    const money = (v) => (v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('de-DE') + ' $';
    const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('de-DE') + ' $';
    const line = (label, text, pct, cls = '') => {
      const bar = App.el('div', { class: 'progress ' + cls, style: 'margin:8px 0 18px' }, [App.el('i')]);
      App.fill(bar.firstChild, pct);
      return App.el('div', {}, [App.el('div', { class: 'row between' }, [App.el('div', { class: 'tag' }, label), App.el('div', { style: 'font-weight:600;font-size:13.5px' }, text)]), bar]);
    };
    const target = Number(a.target) || 0, maxDD = Number(a.maxDD) || 0, daily = Number(a.dailyLoss) || 0;
    const kids = [];
    if (target) kids.push(line('Profit-Ziel', `${signed(s.profit)} von ${money(target)}`, s.profit / target));
    if (maxDD) kids.push(line(a.trailing ? 'Drawdown (trailing)' : 'Drawdown', `${money(s.dd)} von ${money(maxDD)} · Puffer ${money(Math.max(0, maxDD - s.dd))}`, s.dd / maxDD, 'loss'));
    if (daily) kids.push(line('Heute', `${signed(s.todayPnl)} · Limit ${money(daily)}`, s.todayPnl < 0 ? Math.abs(s.todayPnl) / daily : 0, 'loss'));
    const breached = (maxDD && s.dd >= maxDD) || (daily && -s.todayPnl >= daily);
    return App.el('div', { class: 'card' + (a.closed ? ' dim' : '') }, [
      App.el('div', { class: 'row between', style: 'margin-bottom:14px' }, [
        App.el('div', {}, [App.el('div', { style: 'font-family:var(--display);font-weight:700;font-size:18px' }, a.name), App.el('div', { class: 'tag' }, `${s.n} Trade${s.n === 1 ? '' : 's'}${a.closed ? ' · abgeschlossen' : ''}`)]),
        App.el('button', { class: 'icon-btn', html: Icons.edit(), 'aria-label': 'Bearbeiten', onclick: () => this.edit(a) }),
      ]),
      App.el('div', { style: 'margin-bottom:18px' }, [
        App.el('div', { class: 'tag' }, 'Kontostand'),
        App.el('div', { class: 'num', style: 'font-family:var(--display);font-weight:800;font-size:34px;letter-spacing:-.04em' }, money(s.bal)),
      ]),
      ...kids,
      breached ? App.el('div', { class: 'tag neg', style: 'font-weight:600' }, 'Limit erreicht – Regeln deiner Prop Firm prüfen.') : null,
    ]);
  },

  edit(existing) {
    const a = existing ? { ...existing } : { id: DB.uid(), kind: 'account', name: '', start: 50000, target: 3000, maxDD: 2500, dailyLoss: '', trailing: true, closed: false, createdAt: Date.now() };
    const num = (v, ph) => App.el('input', { type: 'number', inputmode: 'decimal', value: v === undefined || v === null ? '' : v, placeholder: ph || '' });
    const name = App.el('input', { type: 'text', value: a.name, placeholder: 'z. B. MFFU 50k Eval' });
    const start = num(a.start), target = num(a.target), maxDD = num(a.maxDD), daily = num(a.dailyLoss, 'optional');
    let trailing = !!a.trailing, closed = !!a.closed;
    const sheet = App.el('div', {}, [
      App.el('h3', {}, existing ? 'Konto bearbeiten' : 'Neues Konto'),
      UI.field('Name', name),
      App.el('div', { class: 'field-grid' }, [UI.field('Startkapital ($)', start), UI.field('Profit-Ziel ($)', target)]),
      App.el('div', { class: 'field-grid' }, [UI.field('Max. Drawdown ($)', maxDD), UI.field('Tageslimit ($)', daily)]),
      App.switchRow('Trailing Drawdown', 'Der Drawdown wird vom höchsten Kontostand gemessen (statt vom Start).', trailing, (v) => { trailing = v; }),
      App.switchRow('Konto abgeschlossen', 'Blendet das Konto in der Trade-Auswahl aus.', closed, (v) => { closed = v; }),
      App.el('div', { class: 'btn-row' }, [
        existing ? App.el('button', { class: 'btn danger', onclick: async () => {
          if (!(await App.confirm('Konto löschen?', { text: 'Die Trades bleiben im Journal erhalten.' }))) return;
          await DB.delete('collections', a.id); App.closeModal(); App.refresh();
        } }, 'Löschen') : App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Abbrechen'),
        App.el('button', { class: 'btn', onclick: async () => {
          if (!name.value.trim()) { App.toast('Gib dem Konto einen Namen.'); return; }
          Object.assign(a, { name: name.value.trim(), start: parseFloat(start.value) || 0, target: parseFloat(target.value) || 0, maxDD: parseFloat(maxDD.value) || 0, dailyLoss: parseFloat(daily.value) || 0, trailing, closed, updatedAt: Date.now() });
          await DB.put('collections', a);
          App.success('Konto gespeichert');
          App.closeModal(); App.refresh();
        } }, 'Speichern'),
      ]),
    ]);
    App.showModal(sheet);
  },
};
