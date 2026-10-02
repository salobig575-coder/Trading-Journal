// CSV-Import: liest das eigene Export-Format und gaengige Spaltennamen (Datum, Pair, Ergebnis, R, $ ...)
const Importer = {
  // Einfacher CSV-Parser (Trennzeichen ; oder , automatisch, Anfuehrungszeichen)
  parse(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur.length || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ''));
  },

  toDate(v) {
    v = (v || '').trim();
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return '';
  },

  num(v) {
    const n = parseFloat(String(v || '').replace(/\s/g, '').replace('$', '').replace(',', '.'));
    return isNaN(n) ? null : n;
  },

  map(rows) {
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names) => head.findIndex((h) => names.includes(h));
    const idx = {
      date: col('datum', 'date', 'entry date', 'time'), trade: col('trade', 'name', 'titel'), pair: col('pair', 'symbol', 'instrument', 'ticker'),
      ls: col('long/short', 'side', 'richtung', 'direction'), model: col('model'), po3: col('po3'), entry: col('entry'), dol: col('dol'), macro: col('macro'),
      result: col('ergebnis', 'result'), rr: col('r:r (betrag)', 'r:r', 'rr'), pnl: col('$ netto', 'pnl', 'profit', 'p/l', 'net p&l'),
      rating: col('rating'), mistakes: col('fehler', 'mistakes'), psych: col('psych'), notes: col('notes', 'notizen', 'kommentar'),
    };
    const out = [];
    for (const r of rows.slice(1)) {
      const get = (k) => (idx[k] >= 0 ? (r[idx[k]] || '').trim() : '');
      const date = this.toDate(get('date'));
      if (!date) continue;
      let pnl = this.num(get('pnl'));
      let result = get('result');
      if (!result && pnl !== null && pnl !== 0) result = pnl > 0 ? 'Win' : 'Loss';
      let ls = get('ls'); const l = ls.toLowerCase();
      ls = /^(long|buy|l)$/.test(l) ? 'Long' : /^(short|sell|s)$/.test(l) ? 'Short' : ls;
      const list = (k) => get(k).split('|').map((x) => x.trim()).filter(Boolean);
      const rr = this.num(get('rr'));
      out.push({
        id: DB.uid() + out.length, createdAt: Date.now() + out.length, imported: true,
        date, day: App.weekdayName(date), trade: get('trade'), pair: get('pair'), ls, model: get('model'), po3: get('po3'),
        timeframes: list('entry'), dol: list('dol'), macro: list('macro'), result, rr: rr === null ? '' : Math.abs(rr),
        pnl: pnl === null ? '' : Math.abs(pnl), rating: get('rating'), mistakes: list('mistakes'), psych: get('psych'), notes: get('notes'), images: {},
      });
    }
    return out;
  },

  open() {
    const input = App.el('input', { type: 'file', accept: '.csv,text/csv,text/plain', style: 'display:none' });
    const info = App.el('div', { class: 'tag', style: 'margin:0 0 var(--s2)' }, 'Wähle eine CSV-Datei. Erkannt werden die Spalten Datum, Pair, Long/Short, Ergebnis, R:R, $ und Notizen (auch aus dem eigenen Export).');
    const go = App.el('button', { class: 'btn', style: 'display:none' }, 'Importieren');
    let parsed = [];
    input.addEventListener('change', async () => {
      const f = input.files[0]; if (!f) return;
      try {
        const rows = this.parse(await f.text());
        parsed = rows.length > 1 ? this.map(rows) : [];
        info.textContent = parsed.length ? `${parsed.length} Trades erkannt – bereit zum Import.` : 'Keine Trades erkannt. Prüfe, ob eine Spalte „Datum“ (TT.MM.JJJJ oder JJJJ-MM-TT) vorhanden ist.';
        go.style.display = parsed.length ? 'flex' : 'none';
      } catch (e) { info.textContent = 'Die Datei konnte nicht gelesen werden.'; }
    });
    go.onclick = async () => {
      const existing = new Set((await DB.getAll('trades')).map((t) => [t.date, t.trade, t.pair, t.rr, t.pnl].join('|')));
      const fresh = parsed.filter((t) => !existing.has([t.date, t.trade, t.pair, t.rr, t.pnl].join('|')));
      await DB.putMany('trades', fresh);
      App.closeModal(); App.refresh();
      App.success(`${fresh.length} Trades importiert${parsed.length - fresh.length ? ` (${parsed.length - fresh.length} Duplikate übersprungen)` : ''}`);
    };
    App.showModal(App.el('div', {}, [
      App.el('h3', {}, 'Trades importieren'), info,
      App.el('button', { class: 'btn secondary', style: 'margin-bottom:var(--s1)', onclick: () => input.click() }, [App.icon('upload'), 'CSV-Datei wählen']),
      go, input,
      App.el('button', { class: 'btn secondary', style: 'margin-top:var(--s1)', onclick: () => App.closeModal() }, 'Abbrechen'),
    ]));
  },
};
