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
      alert('Backup konnte nicht gelesen werden: ' + e.message);
    }
  },
};
