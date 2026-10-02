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
        App.el('div', { class: 'fab-row', style: 'margin-bottom:0' }, [themeBtn('auto', 'Automatisch'), themeBtn('light', 'Hell'), themeBtn('dark', 'Dunkel')]),
      ]),
      this.syncCard(),
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
        App.el('button', { class: 'btn secondary', onclick: () => fileInput.click() }, [App.icon('upload'), 'Backup importieren']),
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
