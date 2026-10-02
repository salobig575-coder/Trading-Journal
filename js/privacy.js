// Datenschutz & Sicherheit: App-Sperre per PIN, Datenschutz-Seite, Daten loeschen
// Hinweis: Die PIN schuetzt vor neugierigen Blicken auf dem Geraet. Sie verschluesselt die Daten nicht.
const Privacy = {
  KEY: 'tj_lock',
  hiddenAt: 0,

  cfg() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  enabled() { return !!this.cfg(); },

  async hash(pin, salt) {
    const data = new TextEncoder().encode(salt + ':' + pin);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  async setPin(pin) {
    const salt = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(this.KEY, JSON.stringify({ salt, hash: await this.hash(pin, salt) }));
  },

  async check(pin) {
    const c = this.cfg();
    return !!c && (await this.hash(pin, c.salt)) === c.hash;
  },

  disable() { localStorage.removeItem(this.KEY); },

  // Beim Start sperren und nach 30 s im Hintergrund erneut sperren
  start() {
    if (!window.crypto || !crypto.subtle) return;
    if (this.enabled()) this.lock();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.hiddenAt = Date.now();
      else if (this.enabled() && this.hiddenAt && Date.now() - this.hiddenAt > 30000) this.lock();
    });
  },

  // PIN-Eingabe als Overlay. mode 'unlock' sperrt die App, 'set' fragt eine neue PIN ab (Callback mit PIN)
  pad(title, onDone, opts = {}) {
    let pin = '';
    const dots = App.el('div', { class: 'pin-dots' }, [0, 1, 2, 3].map(() => App.el('i')));
    const sub = App.el('div', { class: 'tag', style: 'min-height:1.3em' }, opts.hint || '');
    const refresh = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < pin.length));
    const key = (label, fn, cls = '') => App.el('button', { class: cls, type: 'button', 'aria-label': label, onclick: fn }, label);
    const press = async (d) => {
      if (pin.length >= 4) return;
      pin += d; refresh();
      if (pin.length === 4) {
        const entered = pin;
        const ok = await onDone(entered, sub);
        if (ok === 'again') { setTimeout(() => { pin = ''; refresh(); }, 160); }
        else if (ok === false) { dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); try { navigator.vibrate && navigator.vibrate(60); } catch (e) {} setTimeout(() => { pin = ''; refresh(); }, 280); }
      }
    };
    const pad = App.el('div', { class: 'keypad' }, [
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => press(d))),
      opts.cancel ? key('Abbrechen', opts.cancel, 'ghost') : App.el('span', { class: 'blank' }),
      key('0', () => press('0')),
      key('⌫', () => { pin = pin.slice(0, -1); refresh(); }, 'ghost'),
    ]);
    const root = App.el('div', { class: 'lockscreen', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      App.el('div', { class: 'lk-logo', html: '<img class="logo-l" src="icons/logo-light.svg" alt=""><img class="logo-d" src="icons/logo-dark.svg" alt="">' }),
      App.el('h2', {}, title), dots, sub, pad,
    ]);
    document.body.appendChild(root);
    document.addEventListener('keydown', function onKey(e) {
      if (!document.body.contains(root)) { document.removeEventListener('keydown', onKey); return; }
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') { pin = pin.slice(0, -1); refresh(); }
    });
    return root;
  },

  lock() {
    if (document.querySelector('.lockscreen')) return;
    const root = this.pad('Trading Journal entsperren', async (pin) => {
      if (await this.check(pin)) { root.classList.add('out'); setTimeout(() => root.remove(), 340); return true; }
      return false;
    }, { hint: 'Gib deine 4-stellige PIN ein' });
  },

  // Neue PIN festlegen (zweimal eingeben)
  setupFlow(done) {
    let first = '';
    const root = this.pad('Neue PIN festlegen', async (pin, sub) => {
      if (!first) { first = pin; sub.textContent = 'Zur Bestätigung noch einmal eingeben'; return 'again'; }
      if (pin !== first) { first = ''; sub.textContent = 'Das passte nicht – bitte neu starten'; return false; }
      await this.setPin(pin);
      root.classList.add('out'); setTimeout(() => root.remove(), 340);
      App.success('PIN aktiv');
      done && done();
      return true;
    }, { hint: '4 Ziffern wählen', cancel: () => { root.classList.add('out'); setTimeout(() => root.remove(), 340); done && done(); } });
  },

  // Eigene PIN zur Bestaetigung abfragen (z. B. vor dem Ausschalten)
  verify(done) {
    const root = this.pad('PIN eingeben', async (pin) => {
      if (await this.check(pin)) { root.classList.add('out'); setTimeout(() => root.remove(), 340); done(); return true; }
      return false;
    }, { cancel: () => { root.classList.add('out'); setTimeout(() => root.remove(), 340); } });
  },

  open() { App.openPage('Datenschutz', () => this.page()); },

  page() {
    const p = (t) => App.el('p', {}, t);
    const wrap = App.el('div', { class: 'card prose' }, [
      App.el('h4', { style: 'margin-top:0' }, 'Wo liegen deine Daten?'),
      p('Alles, was du einträgst (Trades, Notizen, Screenshots, Routine), liegt zuerst nur auf diesem Gerät im Speicher deines Browsers. Es gibt keine Werbung und keine Tracker.'),
      App.el('h4', {}, 'Cloud-Abgleich (optional)'),
      p('Wenn du dich unter Einstellungen → Cloud-Sync anmeldest, werden deine Einträge zusätzlich verschlüsselt übertragen und bei Supabase gespeichert. Jeder Account sieht ausschließlich seine eigenen Daten. Nutzt du keinen Abgleich, verlässt nichts dein Gerät.'),
      App.el('h4', {}, 'Was wird gespeichert?'),
      App.el('ul', {}, [App.el('li', {}, 'E-Mail-Adresse und Passwort (Passwort nur als Hash bei Supabase)'), App.el('li', {}, 'Deine Journal-Einträge, Checklisten, Routine und Einstellungen'), App.el('li', {}, 'Lokal: die App-Sperre (PIN als Hash) und ein kurzes Fehlerprotokoll')]),
      App.el('h4', {}, 'Schriften und Dienste'),
      p('Die Schrift Inter wird lokal von dieser App geladen, es wird nichts bei Google abgerufen.'),
      App.el('h4', {}, 'Deine Kontrolle'),
      p('Du kannst jederzeit ein Backup exportieren, deine Cloud-Daten löschen oder alle lokalen Daten entfernen (Einstellungen → Sicherheit & Daten). Die PIN schützt vor neugierigen Blicken, sie verschlüsselt die Daten nicht.'),
      App.el('div', { class: 'help-hint' }, 'Hinweis: Wenn du die App öffentlich für andere anbietest, braucht sie zusätzlich eine rechtssichere Datenschutzerklärung mit Betreiberangaben.'),
    ]);
    return wrap;
  },
};
