// Tastenkuerzel (nur mit Maus/Tastatur): H Heute, J Journal, R Routine, S Statistik, N Neuer Trade, / Suche, ? Hilfe
const Shortcuts = {
  list: [
    ['H', 'Heute'],
    ['J', 'Journal'],
    ['R', 'Routine'],
    ['S', 'Statistik'],
    ['N', 'Neuen Trade erfassen'],
    ['/', 'Trades durchsuchen'],
    ['?', 'Diese Übersicht'],
    ['Esc', 'Fenster schließen'],
  ],

  start() {
    document.addEventListener('keydown', (e) => this.onKey(e));
  },

  // Auf Touch-Geraeten ohne Tastatur gibt es nichts zu zeigen
  available() { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; },

  typing(t) {
    return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
  },

  onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || e.repeat) return;
    if (this.typing(e.target) || document.querySelector('.lockscreen')) return;
    const k = e.key;
    const go = (route) => { e.preventDefault(); App.navigate(route); };
    if (k === '?') { e.preventDefault(); this.help(); return; }
    if (document.querySelector('.modal-backdrop')) return;   // in Dialogen keine Navigation
    switch (k.toLowerCase()) {
      case 'h': return go('home');
      case 'j': return go('journal');
      case 'r': return go('routine');
      case 's': return go('stats');
      case 'n': e.preventDefault(); return TradeForm.open();
      case '/': {
        e.preventDefault();
        const focus = () => { const i = document.querySelector('.search-wrap input'); if (i) { i.focus(); i.select(); return true; } return false; };
        if (focus()) return;
        App.navigate('journal');
        setTimeout(focus, 420);
        return;
      }
    }
  },

  help() {
    if (document.querySelector('.modal-backdrop')) App.closeModal(true);
    App.showModal(App.el('div', {}, [
      App.el('h3', {}, 'Tastenkürzel'),
      App.el('div', { class: 'kbd-list' }, this.list.map(([key, label]) => App.el('div', { class: 'kbd-row' }, [App.el('span', {}, label), App.el('kbd', {}, key)]))),
      App.el('div', { class: 'btn-row' }, [App.el('button', { class: 'btn secondary', onclick: () => App.closeModal() }, 'Schließen')]),
    ]));
  },
};

Shortcuts.start();
