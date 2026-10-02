const SettingsView = {
  async open() {
    const fileInput = App.el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    fileInput.addEventListener('change', () => this.importFile(fileInput.files[0]));

    const theme = App.currentTheme();
    const themeBtn = (key, label) => App.el('button', {
      class: 'btn secondary' + (theme === key ? ' selected' : ''),
      onclick: (e) => {
        App.applyTheme(key);
        e.currentTarget.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
      },
    }, label);

    const trades = await DB.getAll('trades');
    const hasDemo = trades.some((t) => t.demo);

    const content = App.el('div', {}, [
      App.el('h3', {}, 'Einstellungen'),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, 'Darstellung'),
        App.el('div', { class: 'fab-row' }, [themeBtn('auto', 'Automatisch'), themeBtn('light', 'Hell'), themeBtn('dark', 'Dunkel')]),
        App.el('div', { class: 'lbl-up', style: 'margin-top:8px' }, 'Farbschema'),
        App.el('div', { class: 'fab-row', style: 'margin-bottom:0' }, [['warm', 'Warm (neu)'], ['classic', 'Klassisch (vorher)']].map(([key, label]) => App.el('button', {
          class: 'btn secondary' + (App.currentPalette() === key ? ' selected' : ''),
          onclick: (e) => {
            App.applyPalette(key);
            e.currentTarget.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
          },
        }, label))),
      ]),
      this.syncCard(),
      await this.rulesCard(),
      this.securityCard(),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.icon('journal', 14), 'Auswahllisten']),
        App.el('p', { class: 'tag' }, 'Pairs, Models, PO3, Entry-Setups, DoL, Macros, Ergebnisse … passe alle Listen an dein Modell an.'),
        App.el('button', { class: 'btn secondary', onclick: () => { App.closeModal(); setTimeout(() => this.manageOptions(), 260); } }, 'Listen verwalten'),
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.icon('sparkles', 14), 'Demo-Daten']),
        App.el('p', { class: 'tag' }, 'Lädt ca. 45 Beispiel-Trades, damit du Statistiken & Charts ausprobieren kannst. Lassen sich jederzeit wieder entfernen.'),
        hasDemo
          ? App.el('button', { class: 'btn secondary', onclick: async () => { await Seed.removeDemo(); App.closeModal(); App.refresh(); } }, 'Demo-Trades entfernen')
          : App.el('button', { class: 'btn secondary', onclick: async () => { await Seed.loadDemo(); App.closeModal(); App.refresh(); } }, 'Demo-Trades laden'),
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.icon('download', 14), 'Backup & Geräte-Wechsel']),
        App.el('p', { class: 'tag' }, 'Alle Daten liegen lokal auf diesem Gerät. Mit dem Backup (.json) kannst du sie sichern oder auf ein anderes Gerät (z. B. PC ↔ Handy) übertragen.'),
        App.el('button', { class: 'btn', style: 'margin-bottom:8px', onclick: () => this.exportFile() }, [App.icon('download'), 'Backup exportieren']),
        App.el('button', { class: 'btn secondary', style: 'margin-bottom:8px', onclick: () => fileInput.click() }, [App.icon('upload'), 'Backup importieren']),
        App.el('button', { class: 'btn secondary', style: 'margin-bottom:8px', onclick: () => this.exportCsv() }, [App.icon('download'), 'Trades als CSV exportieren']),
        App.el('button', { class: 'btn secondary', onclick: () => { App.closeModal(); setTimeout(() => Importer.open(), 340); } }, [App.icon('upload'), 'Trades aus CSV importieren']),
        fileInput,
      ]),
      App.el('div', { class: 'card' }, [
        App.el('h2', {}, [App.icon('sparkles', 14), 'App installieren']),
        App.el('p', { class: 'tag' }, 'Am Handy: Browser-Menü → „Zum Startbildschirm hinzufügen“ (iPhone: Teilen → Zum Home-Bildschirm). Am PC: Install-Symbol in der Adressleiste.'),
      ]),
      App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Schließen'),
    ]);
    App.showModal(content);
  },

  // Cloud-Sync (Supabase) – rendert sich bei Statuswechsel selbst neu
  syncCard() {
    const card = App.el('div', { class: 'card' });
    let msg = '';
    let busy = false;
    const draw = () => {
      card.innerHTML = '';
      card.appendChild(App.el('h2', {}, [App.icon('sparkles', 14), 'Cloud-Sync (Supabase)']));
      const note = (t, cls = 'tag') => card.appendChild(App.el('p', { class: cls, style: 'margin:6px 0' }, t));

      if (!Sync.configured()) {
        const c = Sync.config();
        const url = App.el('input', { type: 'url', value: c.url, placeholder: 'https://xxxx.supabase.co' });
        const key = App.el('input', { type: 'text', value: c.anonKey, placeholder: 'anon / publishable key' });
        note('Trage Project-URL und anon-Key aus Supabase (Project Settings → API) ein. Dieselben Werte brauchst du auf jedem Gerät.');
        card.append(UI.field('Project URL', url), UI.field('Anon Key', key));
        card.appendChild(App.el('button', { class: 'btn', onclick: () => { Sync.saveConfig(url.value, key.value); msg = ''; draw(); } }, 'Speichern'));
        return;
      }
      if (!Sync.loggedIn()) {
        const email = App.el('input', { type: 'text', inputmode: 'email', autocomplete: 'email', placeholder: 'E-Mail' });
        const pw = App.el('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Passwort (min. 6 Zeichen)', style: 'width:100%;background:var(--surface-2);border:1px solid transparent;border-radius:var(--radius-sm);padding:12px 14px;font-size:15px;outline:none' });
        note('Melde dich an, damit dein Journal auf allen Geräten gleich ist. Beim ersten Mal „Registrieren“.');
        card.append(UI.field('E-Mail', email), UI.field('Passwort', pw));
        const go = (fn) => async () => {
          if (busy) return; busy = true; msg = 'Bitte warten …'; draw();
          try {
            const r = await fn(email.value.trim(), pw.value);
            if (r === 'confirm') msg = 'Registriert. Bestätige die E-Mail (Link im Postfach) und melde dich danach an.';
            else { msg = ''; busy = false; await Sync.run(); draw(); return; }
          } catch (e) { msg = e.message; }
          busy = false; draw();
        };
        card.appendChild(App.el('div', { class: 'btn-row' }, [
          App.el('button', { class: 'btn', onclick: go((e, p) => Sync.signIn(e, p)) }, 'Anmelden'),
          App.el('button', { class: 'btn secondary', onclick: go((e, p) => Sync.signUp(e, p)) }, 'Registrieren'),
        ]));
        if (msg) note(msg, 'tag neg');
        card.appendChild(App.el('button', { class: 'add-line', onclick: async () => {
          if (!email.value.trim()) { msg = 'Gib oben deine E-Mail ein, dann sende ich dir einen Link.'; draw(); return; }
          try { await Sync.recover(email.value.trim()); msg = 'Wenn die Adresse existiert, ist ein Link zum Zurücksetzen unterwegs.'; } catch (e) { msg = 'Das hat nicht geklappt: ' + e.message; }
          draw();
        } }, 'Passwort vergessen?'));
        if (!Sync.config().fromFile) card.appendChild(App.el('button', { class: 'add-line', onclick: () => { localStorage.removeItem('sb_cfg'); draw(); } }, 'Projekt-Zugangsdaten ändern'));
        return;
      }
      note(`Angemeldet als ${Sync.email()}`, 'tag');
      const last = Sync.last || Number(localStorage.getItem('sb_last') || 0);
      note(last ? `Letzter Abgleich: ${new Date(last).toLocaleString('de-DE')} ${Sync.info ? '(' + Sync.info + ')' : ''}` : 'Noch nicht abgeglichen.');
      if (Sync.error) note(Sync.error, 'tag neg');
      card.appendChild(App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn', onclick: async () => { card.querySelector('.btn').textContent = 'Synchronisiere …'; await Sync.run(); draw(); } }, [App.icon('upload'), 'Jetzt abgleichen']),
        App.el('button', { class: 'btn secondary', onclick: async () => { if (await App.confirm('Abmelden?', { text: 'Deine Daten bleiben auf diesem Gerät erhalten.', ok: 'Abmelden', danger: false })) { Sync.signOut(); draw(); } } }, 'Abmelden'),
      ]));
    };
    draw();
    return card;
  },

  // Eigene Trading-Regeln: loesen Warnungen beim Anlegen eines Trades aus
  // Sicherheit, Datenschutz, Hilfe
  securityCard() {
    const lockOn = Privacy.enabled();
    const rowBtn = (icon, label, fn, cls = 'secondary') => App.el('button', { class: 'btn ' + cls, style: 'margin-top:8px', onclick: fn }, [App.icon(icon), label]);
    const card = App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.icon('shield', 14), 'Sicherheit & Daten']),
      App.switchRow('App-Sperre (PIN)', 'Fragt beim Öffnen und nach 30 s im Hintergrund nach einer 4-stelligen PIN.', lockOn, (on) => {
        App.closeModal();
        setTimeout(() => {
          if (on) Privacy.setupFlow(() => this.open());
          else if (Privacy.enabled()) Privacy.verify(() => { Privacy.disable(); App.toast('PIN entfernt'); this.open(); });
        }, 340);
      }),
      rowBtn('shield', 'Datenschutz', () => { App.closeModal(); setTimeout(() => Privacy.open(), 340); }),
      Shortcuts.available() ? rowBtn('keyboard', 'Tastenkürzel', () => { App.closeModal(); setTimeout(() => Shortcuts.help(), 340); }) : null,
      rowBtn('sparkles', 'Kurzanleitung', () => { App.closeModal(); setTimeout(() => Onboarding.show(false), 340); }),
      rowBtn('alert', 'Fehlerprotokoll', () => { App.closeModal(); setTimeout(() => this.errorLog(), 340); }),
    ]);
    if (Sync.loggedIn()) card.appendChild(rowBtn('trash', 'Cloud-Daten löschen', async () => {
      if (!(await App.confirm('Cloud-Daten löschen?', { text: 'Alle bei Supabase gespeicherten Einträge werden entfernt. Auf diesem Gerät bleibt alles erhalten.', ok: 'Löschen' }))) return;
      try { await Sync.deleteCloudData(); Sync.signOut(); App.success('Cloud-Daten gelöscht'); App.closeModal(); } catch (e) { App.toast('Das hat nicht geklappt: ' + e.message); }
    }, 'danger'));
    card.appendChild(rowBtn('trash', 'Alle lokalen Daten löschen', async () => {
      if (!(await App.confirm('Alle Daten auf diesem Gerät löschen?', { text: 'Trades, Analysen, Routine und Einstellungen werden entfernt. Erstelle vorher ein Backup, wenn du sie behalten willst.', ok: 'Alles löschen' }))) return;
      if (Sync.loggedIn()) Sync.signOut(); // sonst wuerde der Abgleich alles sofort wiederherstellen
      await DB.wipeLocal();
      ['tj_trade_draft', 'tj_errors', 'tj_last_backup', 'sb_last', 'riskcalc'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
      location.reload();
    }, 'danger'));
    return card;
  },

  errorLog() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('tj_errors') || '[]'); } catch (e) {}
    const text = list.map((e) => `${e.t}  ${e.m}`).join('\n') || 'Keine Fehler protokolliert.';
    App.showModal(App.el('div', {}, [
      App.el('h3', {}, 'Fehlerprotokoll'),
      App.el('p', { class: 'tag', style: 'margin:-12px 0 16px' }, 'Hilfreich, falls etwas nicht klappt. Die letzten 20 Einträge, nur auf diesem Gerät.'),
      App.el('div', { class: 'text-block', style: 'font-size:.75rem;max-height:40vh;overflow:auto' }, text),
      App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => { try { localStorage.removeItem('tj_errors'); } catch (e) {} App.closeModal(); } }, 'Leeren'),
        App.el('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(text); App.success('Kopiert'); } catch (e) { App.toast('Kopieren nicht möglich'); } } }, 'Kopieren'),
      ]),
    ]));
  },

  async rulesCard() {
    const rules = await DB.getSetting('riskRules', { maxTrades: 2, lossStreak: 2, dailyLossR: 2 });
    const mk = (key, label, step) => {
      const i = App.el('input', { type: 'number', inputmode: 'decimal', step: step || '1', min: '0', value: rules[key] || 0 });
      i.addEventListener('change', async () => { rules[key] = Math.max(0, parseFloat(i.value) || 0); await DB.setSetting('riskRules', { ...rules }); });
      return UI.field(label, i);
    };
    return App.el('div', { class: 'card' }, [
      App.el('h2', {}, [App.icon('shield', 14), 'Trading-Regeln']),
      App.el('p', { class: 'tag', style: 'margin:0 0 14px' }, 'Du bekommst einen Hinweis, wenn du beim neuen Trade eine Grenze erreicht hast. 0 = aus.'),
      App.el('div', { class: 'field-grid' }, [mk('maxTrades', 'Max. Trades / Tag'), mk('lossStreak', 'Verluste in Folge')]),
      mk('dailyLossR', 'Tageslimit (R)', '0.5'),
    ]);
  },

  async exportCsv() {
    const trades = Calc.sort(await DB.getAll('trades'));
    const accounts = Object.fromEntries((await DB.getAll('collections')).filter((c) => c.kind === 'account').map((a) => [a.id, a.name]));
    const cols = [
      ['Datum', (t) => t.date], ['Tag', (t) => t.day], ['Trade', (t) => t.trade], ['Pair', (t) => t.pair], ['Long/Short', (t) => t.ls],
      ['Model', (t) => t.model], ['PO3', (t) => t.po3], ['Entry', (t) => (t.timeframes || []).join(' | ')], ['DoL', (t) => (t.dol || []).join(' | ')],
      ['Macro', (t) => (t.macro || []).join(' | ')], ['Ergebnis', (t) => t.result], ['R:R (Betrag)', (t) => t.rr],
      ['R netto', (t) => Calc.rValue(t)], ['$ netto', (t) => (t.pnl === undefined || t.pnl === '' ? '' : Calc.pnl(t))], ['Konto', (t) => accounts[t.account] || ''],
      ['Rating', (t) => t.rating], ['Fehler', (t) => (t.mistakes || []).join(' | ')], ['Psych', (t) => t.psych], ['Notes', (t) => t.notes],
    ];
    const esc = (v) => {
      const s = v === undefined || v === null ? '' : String(v).replace(/\r?\n/g, ' ');
      return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map(([h]) => h).join(';'), ...trades.map((t) => cols.map(([, fn]) => esc(fn(t))).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trading-journal-trades-${App.todayStr()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    App.toast(`${trades.length} Trades exportiert`);
  },

  manageOptions() {
    const keys = Object.keys(Options.labels);
    let current = keys[0];
    const sel = App.el('select', {}, keys.map((k) => App.el('option', { value: k }, Options.labels[k])));
    const ta = App.el('textarea', { style: 'min-height:240px', placeholder: 'Ein Eintrag pro Zeile' });
    const load = () => { ta.value = Options.get(current).join('\n'); };
    sel.addEventListener('change', () => { current = sel.value; load(); });
    load();
    const content = App.el('div', {}, [
      App.el('h3', {}, 'Auswahllisten verwalten'),
      UI.field('Liste', sel),
      UI.field('Einträge (ein Eintrag pro Zeile)', ta),
      App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: async () => { await Options.reset(current); load(); } }, 'Zurücksetzen'),
        App.el('button', { class: 'btn', onclick: async () => {
          const list = ta.value.split('\n').map((x) => x.trim()).filter(Boolean);
          await Options.set(current, [...new Set(list)]);
          sel.style.outline = '2px solid var(--win)';
          setTimeout(() => { sel.style.outline = ''; }, 600);
        } }, 'Speichern'),
      ]),
      App.el('button', { class: 'btn secondary', style: 'margin-top:10px', onclick: () => App.closeModal() }, 'Schließen'),
    ]);
    App.showModal(content);
  },

  async exportFile() {
    const payload = await DB.exportAll();
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-journal-backup-${App.todayStr()}.json`;
    try { localStorage.setItem('tj_last_backup', String(Date.now())); } catch (e) {}
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async importFile(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!payload.data) throw new Error('Keine gültige Backup-Datei.');
      await DB.importAll(payload);
      await Options.load();
      App.closeModal();
      App.refresh();
    } catch (e) {
      App.toast('Diese Backup-Datei konnte nicht gelesen werden.');
    }
  },
};
