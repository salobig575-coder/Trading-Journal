const App = {
  routes: {
    home: { title: 'Heute', icon: 'home', over: () => App.longDate(), render: () => HomeView.render() },
    journal: { title: 'Journal', icon: 'journal', over: () => 'Trades · Analysen · Reviews', render: () => JournalHub.render() },
    routine: { title: 'Routine', icon: 'routine', over: () => App.longDate(), render: () => RoutineView.render() },
    stats: { title: 'Statistik', icon: 'stats', over: () => 'Performance', render: () => StatsHub.render() },
  },

  current: 'home',
  stack: [],

  async init() {
    try {
      await Options.load();
      await Seed.run();
    } catch (e) { console.warn(e); }
    try { Privacy.start(); } catch (e) { console.warn(e); }
    const recovery = (typeof Sync !== 'undefined' && Sync.recoveryFromHash) ? Sync.recoveryFromHash() : null;

    document.getElementById('settingsBtn').innerHTML = Icons.settings();
    document.getElementById('backBtn').innerHTML = Icons.back();
    document.querySelectorAll('.dock button.tab').forEach((btn) => {
      btn.querySelector('.ic').innerHTML = Icons[this.routes[btn.dataset.route].icon]();
      btn.addEventListener('click', () => this.navigate(btn.dataset.route));
    });
    const fab = document.getElementById('fab');
    fab.innerHTML = Icons.plus();
    fab.addEventListener('click', () => this.quickAdd());
    document.getElementById('settingsBtn').addEventListener('click', () => SettingsView.open());
    document.getElementById('backBtn').addEventListener('click', () => this.back());
    document.getElementById('navBack').innerHTML = Icons.chevronLeft();
    document.getElementById('navBack').addEventListener('click', () => this.back());
    this.setupNavbar();
    window.addEventListener('popstate', () => { if (this.stack.length) { this.stack.pop(); this.show({ instant: true, dir: 'pop' }); } });
    window.addEventListener('error', (e) => { this.logError(e.message); });
    window.addEventListener('unhandledrejection', (e) => {
      const r = e.reason || {};
      this.logError(r.message || r);
      if (r.name === 'QuotaExceededError') this.toast('Speicher voll – exportiere ein Backup und entferne alte Screenshots.');
      else if (r.name === 'DataError' || r.name === 'TransactionInactiveError' || r.name === 'AbortError') this.toast('Das hat gerade nicht geklappt. Bitte versuche es nochmal.');
    });
    window.addEventListener('offline', () => this.setOffline(true));
    window.addEventListener('online', () => this.setOffline(false));
    if (!navigator.onLine) this.setOffline(true);
    this.applyTextScale();
    this._day = this.todayStr();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.applyTextScale();
      // Tageswechsel bei laufender App: Routine und Startseite springen auf den neuen Tag
      const d = this.todayStr();
      if (d !== this._day) { this._day = d; if (typeof RoutineView !== 'undefined') RoutineView.date = null; if (!this.stack.length) this.refresh(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const sheets = [...document.querySelectorAll('.modal-backdrop')];
      if (sheets.length) sheets.at(-1).click();
    });

    const hash = location.hash.replace('#', '');
    this.navigate(this.routes[hash] ? hash : 'home', { instant: true });

    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) this.registerSW();
    try { Sync.start(); } catch (e) { console.warn(e); }

    const splash = document.getElementById('splash');
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 480);
      setTimeout(() => {
        if (recovery) this.recoverySheet(recovery);
        else Onboarding.maybeShow().catch(() => {});
      }, 700);
    }, 1200);
  },

  // Neues Passwort setzen, nachdem du den Link aus der Reset-Mail geoeffnet hast
  recoverySheet(rec) {
    const pw = this.el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Neues Passwort (mind. 6 Zeichen)' });
    const msg = this.el('div', { class: 'tag neg', style: 'min-height:1.3em;margin-bottom:8px' });
    this.showModal(this.el('div', {}, [
      this.el('h3', {}, 'Neues Passwort'),
      this.el('div', { class: 'field' }, [this.el('label', {}, 'Passwort'), pw]), msg,
      this.el('button', { class: 'btn', onclick: async () => {
        if (pw.value.length < 6) { msg.textContent = 'Mindestens 6 Zeichen.'; return; }
        try { await Sync.setPassword(rec.token, pw.value); this.closeModal(); this.success('Passwort geändert – bitte melde dich an'); } catch (e) { msg.textContent = 'Das hat nicht geklappt: ' + e.message; }
      } }, 'Speichern'),
    ]));
  },

  // ---------- Fehler, Offline, Textgroesse ----------
  logError(msg) {
    console.warn(msg);
    try {
      const list = JSON.parse(localStorage.getItem('tj_errors') || '[]');
      list.push({ t: new Date().toISOString(), m: String(msg).slice(0, 300) });
      localStorage.setItem('tj_errors', JSON.stringify(list.slice(-20)));
    } catch (e) {}
  },

  setOffline(off) {
    let pill = document.getElementById('offlinePill');
    if (!pill) {
      pill = this.el('div', { id: 'offlinePill', class: 'offline-pill', role: 'status' }, 'Offline – Änderungen werden später abgeglichen');
      document.body.appendChild(pill);
    }
    setTimeout(() => pill.classList.toggle('show', !!off), 30);
  },

  // Sync-Status: roter Punkt am Zahnrad, wenn der letzte Abgleich fehlgeschlagen ist
  onSyncStatus(state) {
    const btn = document.getElementById('settingsBtn');
    if (btn) btn.classList.toggle('has-alert', state === 'error');
  },

  // iOS "Textgroesse" (Dynamic Type) respektieren: Wurzel-Schriftgroesse skaliert, alles in rem folgt
  applyTextScale() {
    try {
      if (!(window.CSS && CSS.supports && CSS.supports('font', '-apple-system-body'))) return;
      const probe = document.createElement('span');
      probe.style.cssText = 'font:-apple-system-body;position:absolute;visibility:hidden';
      probe.textContent = 'A';
      document.body.appendChild(probe);
      const px = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      if (px > 0) document.documentElement.style.fontSize = Math.min(135, Math.max(90, (px / 17) * 100)) + '%';
    } catch (e) {}
  },

  // ---------- Bewegung: zentrale Tokens ----------
  reducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); },
  tok(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v.endsWith('ms') ? parseFloat(v) : (parseFloat(v) || fallback);
  },
  // Fuellstand per transform (kein Layout): 0..1
  fill(el, p) {
    if (!el) return;
    const v = Math.max(0, Math.min(1, p || 0));
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `scaleX(${v})`; }));
  },

  // ---------- Updates ----------
  registerSW() {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const offer = () => this.updateBar(reg);
      if (reg.waiting && navigator.serviceWorker.controller) offer();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(); });
      });
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      window.addEventListener('online', check);
      setInterval(check, 20 * 60 * 1000);
    }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !this._updating) return;
      reloading = true;
      location.reload();
    });
  },

  updateBar(reg) {
    if (document.getElementById('updateBar')) return;
    const bar = this.el('div', { id: 'updateBar', class: 'update-bar' }, [
      this.el('div', { class: 'ic', html: Icons.sparkles() }),
      this.el('div', { class: 'grow' }, [this.el('div', { class: 't' }, 'Neue Version verfügbar'), this.el('div', { class: 's' }, 'Kurz neu laden, um sie zu nutzen.')]),
      this.el('button', { class: 'btn small', onclick: (e) => {
        e.currentTarget.textContent = 'Lädt …';
        this._updating = true;
        const w = reg.waiting;
        if (w) w.postMessage({ type: 'SKIP_WAITING' }); else location.reload();
      } }, 'Neu laden'),
      this.el('button', { class: 'icon-btn', 'aria-label': 'Später', html: Icons.close(), onclick: () => { bar.classList.remove('show'); setTimeout(() => bar.remove(), 440); } }),
    ]);
    document.body.appendChild(bar);
    setTimeout(() => bar.classList.add('show'), 80);
  },

  // ---------- Navigation ----------
  navigate(route, opts = {}) {
    if (!this.routes[route]) route = 'home';
    this.current = route;
    this.stack = [];
    if (route === 'routine' && typeof RoutineView !== 'undefined') { RoutineView.date = null; RoutineView.editing = false; }
    history.replaceState(null, '', '#' + route);
    this.show({ dir: 'tab', ...opts });
  },

  openPage(title, renderFn) {
    this.stack.push({ title, render: renderFn });
    history.pushState({ page: true }, '', location.href);
    this.show({ dir: 'push' });
  },

  back() {
    if (this.stack.length) history.back();
  },

  closePage() {
    if (!this.stack.length) return this.refresh();
    history.back();
  },

  show(opts = {}) {
    const top = this.stack.at(-1);
    const route = this.routes[this.current];
    const inPage = !!top;
    document.body.classList.toggle('in-page', inPage);
    document.body.classList.toggle('on-home', this.current === 'home');

    document.querySelectorAll('.dock button.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.route === this.current && !inPage));
    const title = top ? top.title : route.title;
    document.title = title + ' · Trading Journal';
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSub').textContent = top ? '' : route.over();
    document.getElementById('navTitle').textContent = title;
    document.getElementById('navBack').classList.toggle('hidden', !inPage);

    const renderFn = top ? top.render : route.render;
    const view = document.getElementById('view');
    const token = (this._token = (this._token || 0) + 1);
    const dir = opts.dir || 'tab';
    const swapIn = !opts.instant && view.hasChildNodes() && dir !== 'fade';
    const t0 = performance.now();
    let ready = false;

    // Skeleton nur, wenn das Laden spuerbar dauert (verhindert Flackern)
    const sk = setTimeout(() => {
      if (ready || token !== this._token) return;
      view.className = '';
      view.innerHTML = '';
      view.appendChild(this.skeleton());
    }, 140);

    if (swapIn) view.classList.add('leaving');

    const finish = (node) => {
      if (token !== this._token) return;
      ready = true;
      clearTimeout(sk);
      const y = window.scrollY;
      view.className = '';
      view.innerHTML = '';
      if (node) view.appendChild(node);
      void view.offsetWidth;
      view.classList.add('enter-' + dir);
      if (dir !== 'fade') this.stagger(view);
      if (opts.keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    };
    Promise.resolve().then(() => renderFn()).catch((e) => { console.warn(e); return this.empty('alert', 'Das konnte gerade nicht geladen werden.'); }).then((node) => {
      const wait = swapIn ? Math.max(0, 140 - (performance.now() - t0)) : 0;
      setTimeout(() => finish(node), wait);
    });
  },

  // Inhalt innerhalb derselben Seite aktualisieren: kein Springen, keine erneute Einblend-Choreografie
  refresh() {
    this.show({ instant: true, keepScroll: true, dir: 'fade' });
  },

  skeleton() {
    const box = (h, r) => this.el('div', { class: 'sk', style: `height:${h}px${r ? `;border-radius:${r}px` : ''}` });
    return this.el('div', { class: 'sk-stack' }, [
      box(176, 28), box(88, 20), this.el('div', { class: 'row', style: 'gap:16px' }, [box(112, 20), box(112, 20)]),
      this.el('div', { class: 'sk sk-line', style: 'width:42%' }), this.el('div', { class: 'sk sk-line', style: 'width:68%' }),
    ]);
  },

  // Kompakte Glas-Leiste, sobald der grosse Titel aus dem Bild scrollt
  setupNavbar() {
    const bar = document.getElementById('navbar');
    const h1 = document.getElementById('pageTitle');
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(([e]) => { bar.classList.toggle('show', !e.isIntersecting && window.scrollY > 8); }, { rootMargin: '-56px 0px 0px 0px', threshold: 0 });
    obs.observe(h1);
  },

  setSub(text) {
    document.getElementById('pageSub').textContent = text;
  },

  // Gestaffelter Einstieg der ersten Elemente (max. 8, je 48 ms Versatz)
  stagger(view) {
    if (this.reducedMotion()) return;
    const items = [];
    const collect = (el) => {
      for (const c of el.children) {
        if (c.tagName === 'DIV' && !c.className && c.children.length) collect(c);
        else items.push(c);
      }
    };
    collect(view);
    items.slice(0, 8).forEach((el, i) => { el.style.setProperty('--i', i); el.classList.add('rv'); });
  },

  goTab(route, hub, tab) {
    hub.activeTab = tab;
    this.navigate(route);
  },

  // ---------- Schnell-Aktionen (+) ----------
  quickAdd() {
    const fab = document.getElementById('fab');
    fab.classList.add('open');
    const act = (icon, t, s, fn) => App.el('button', { class: 'action-row', onclick: () => { App.closeModal(); setTimeout(fn, 280); } }, [
      App.el('div', { class: 'ic', html: Icons[icon]() }),
      App.el('div', {}, [App.el('div', { class: 't' }, t), App.el('div', { class: 's' }, s)]),
    ]);
    const bd = this.showModal(App.el('div', {}, [
      App.el('h3', {}, 'Neu erfassen'),
      act('trend', 'Trade', 'Einen Trade ins Journal eintragen', () => TradeForm.open()),
      act('analyse', 'Analyse', 'Weekly Outlook, Review oder Daily Log', () => { JournalHub.activeTab = 'analysis'; this.navigate('journal'); setTimeout(() => AnalysisView.chooseTemplate(), 380); }),
      act('review', 'Review', 'Eine Review-Notiz anlegen', () => { JournalHub.activeTab = 'review'; this.navigate('journal'); setTimeout(() => Collections.edit('review'), 380); }),
    ]));
    const obs = new MutationObserver(() => { if (!document.body.contains(bd)) { fab.classList.remove('open'); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
  },

  // ---------- Bausteine ----------
  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'value') node.value = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (typeof v === 'boolean') { if (v) node.setAttribute(k, ''); else node.removeAttribute(k); }
      else if (v != null) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    this.a11y(node, tag, attrs);
    return node;
  },

  // Barrierefreiheit automatisch: anklickbare Flaechen per Tastatur bedienbar, Icon-Knoepfe beschriftet
  a11y(node, tag, attrs) {
    if (tag === 'div' && typeof attrs.onclick === 'function' && !/modal-backdrop|lightbox/.test(node.className) && !node.hasAttribute('role')) {
      node.setAttribute('role', 'button');
      node.tabIndex = 0;
      node.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === node) { e.preventDefault(); node.click(); } });
    }
    if (tag === 'button' && attrs.html && !node.getAttribute('aria-label') && !node.textContent.trim()) {
      const label = this.iconLabel(attrs.html);
      if (label) node.setAttribute('aria-label', label);
    }
  },

  _iconLabels: null,
  iconLabel(html) {
    if (!this._iconLabels) {
      const names = { trash: 'Löschen', edit: 'Bearbeiten', plus: 'Hinzufügen', close: 'Schließen', back: 'Zurück', chevronLeft: 'Zurück', chevronRight: 'Weiter', chevronDown: 'Aufklappen', search: 'Suchen', settings: 'Einstellungen', filter: 'Filter', grid: 'Galerie', list: 'Liste', copy: 'Einfügen', check: 'Erledigt', download: 'Herunterladen', upload: 'Hochladen', grip: 'Verschieben' };
      this._iconLabels = {};
      for (const [k, label] of Object.entries(names)) { try { this._iconLabels[Icons[k]()] = label; } catch (e) {} }
    }
    return this._iconLabels[html] || '';
  },

  icon(name, size = 16) {
    return this.el('span', { html: Icons[name](), style: `width:${size}px;height:${size}px;display:inline-flex;flex-shrink:0` });
  },

  tabBar(tabs, activeKey, onChange) {
    const bar = this.el('div', { class: 'seg', role: 'tablist' }, tabs.map((t) =>
      this.el('button', { class: 'seg-tab' + (t.key === activeKey ? ' active' : ''), role: 'tab', 'aria-selected': String(t.key === activeKey), onclick: () => onChange(t.key) }, t.label)
    ));
    requestAnimationFrame(() => {
      const active = bar.querySelector('.seg-tab.active');
      if (active) bar.scrollTo({ left: active.offsetLeft - 24, behavior: 'auto' });
    });
    return bar;
  },

  switchRow(label, desc, checked, onChange) {
    const sw = this.el('div', { class: 'switch' + (checked ? ' on' : ''), role: 'switch', tabindex: '0', 'aria-checked': String(!!checked), 'aria-label': label });
    const toggle = () => {
      const next = !sw.classList.contains('on');
      sw.classList.toggle('on', next);
      sw.setAttribute('aria-checked', String(next));
      onChange(next);
    };
    sw.addEventListener('click', toggle);
    sw.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
    const textCol = [this.el('div', { class: 'switch-label' }, label)];
    if (desc) textCol.push(this.el('div', { class: 'switch-desc' }, desc));
    return this.el('div', { class: 'switch-row' }, [this.el('div', { class: 'grow' }, textCol), sw]);
  },

  // Sheet mit Griff: per Ziehen nach unten schliessbar (wie iOS)
  makeSheet(contentNode, z, dismiss) {
    const backdrop = this.el('div', { class: 'modal-backdrop', style: z ? `z-index:${z}` : '', onclick: (e) => { if (e.target === backdrop) dismiss(); } });
    const modal = this.el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
    backdrop._prevFocus = document.activeElement;
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    setTimeout(() => { try { modal.focus({ preventScroll: true }); } catch (err) {} }, 60);
    const grab = this.el('div', { class: 'grab', 'aria-hidden': 'true' });
    modal.append(grab, contentNode);
    backdrop.appendChild(modal);
    let y0 = null, dy = 0, t0 = 0;
    grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; t0 = performance.now(); modal.style.animation = 'none'; modal.style.transition = 'none'; try { grab.setPointerCapture(e.pointerId); } catch (err) {} });
    grab.addEventListener('pointermove', (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      modal.style.transform = `translateY(${dy}px)`;
      backdrop.style.opacity = String(1 - Math.min(0.7, dy / 420));
    });
    const end = () => {
      if (y0 === null) return;
      const fast = dy / Math.max(1, performance.now() - t0) > 0.6;
      y0 = null;
      if (dy > 110 || (fast && dy > 30)) { dismiss(); return; }
      modal.style.transition = 'transform var(--t-base) var(--ease)';
      modal.style.transform = '';
      backdrop.style.transition = 'opacity var(--t-base) var(--ease)';
      backdrop.style.opacity = '';
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
    return backdrop;
  },

  showModal(contentNode) {
    this.closeModal(true);
    const backdrop = this.makeSheet(contentNode, 0, () => this.closeModal());
    document.body.appendChild(backdrop);
    this._modal = backdrop;
    return backdrop;
  },

  closeModal(immediate) {
    if (!this._modal) return;
    const m = this._modal;
    this._modal = null;
    const prev = m._prevFocus;
    if (immediate) { m.remove(); return; }
    m.style.opacity = '';
    m.classList.add('closing');
    setTimeout(() => { m.remove(); try { if (prev && document.body.contains(prev)) prev.focus({ preventScroll: true }); } catch (err) {} }, 340);
  },

  // Bestaetigung als Sheet (statt Browser-Dialog)
  confirm(message, opts = {}) {
    return new Promise((resolve) => {
      let bd;
      const done = (v) => { bd.style.opacity = ''; bd.classList.add('closing'); setTimeout(() => bd.remove(), 340); resolve(v); };
      const body = this.el('div', {}, [
        this.el('h3', {}, message),
        opts.text ? this.el('p', { class: 'tag', style: 'margin:-12px 0 24px' }, opts.text) : null,
        this.el('div', { class: 'btn-row', style: 'margin-top:0' }, [
          this.el('button', { class: 'btn secondary', onclick: () => done(false) }, 'Abbrechen'),
          this.el('button', { class: 'btn ' + (opts.danger === false ? '' : 'danger'), onclick: () => done(true) }, opts.ok || 'Löschen'),
        ]),
      ]);
      bd = this.makeSheet(body, 95, () => done(false));
      document.body.appendChild(bd);
    });
  },

  toast(msg) { this._toast(msg, false); },

  // Hinweis mit "Rueckgaengig" (z. B. nach dem Loeschen)
  undoToast(msg, undo) {
    this._toast(msg, false);
    const t = document.getElementById('toast');
    t.classList.add('act');
    t.appendChild(this.el('button', { class: 'toast-act', onclick: async () => { t.classList.remove('show'); try { await undo(); this.refresh(); } catch (e) { this.logError(e.message); } } }, 'Rückgängig'));
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 5200);
  },
  // Erfolgsmoment: kurzer Haken, der sich zeichnet
  success(msg) { this._toast(msg, true); },
  _toast(msg, ok) {
    let t = document.getElementById('toast');
    if (!t) { t = this.el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
    t.className = 'toast' + (ok ? '' : ' plain');
    t.innerHTML = `<span class="ok">${Icons.check()}</span>`;
    t.appendChild(document.createTextNode(msg));
    t.classList.remove('show');
    void t.offsetWidth;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 2400);
  },

  animateNumber(el, to, opts = {}) {
    if (!el) return;
    const decimals = opts.decimals != null ? opts.decimals : 0;
    const suffix = opts.suffix || '';
    const fmt = (v) => (opts.signed && v > 0.0001 ? '+' : '') + v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (!isFinite(to)) { el.textContent = '∞'; return; }
    if (this.reducedMotion()) { el.textContent = fmt(to); return; }
    const from = opts.from || 0;
    const duration = Math.min(opts.duration || 440, 440);
    const start = performance.now();
    if (el._raf) cancelAnimationFrame(el._raf);
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = fmt(from + (to - from) * eased);
      if (t < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  },

  applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    else { document.documentElement.removeAttribute('data-theme'); theme = 'auto'; }
    try { localStorage.setItem('theme', theme); } catch (e) {}
  },

  // Farbschema: 'warm' (Standard) oder 'classic' (das vorherige Schema)
  applyPalette(p) {
    if (p === 'classic') document.documentElement.setAttribute('data-palette', 'classic');
    else document.documentElement.removeAttribute('data-palette');
    try { localStorage.setItem('palette', p === 'classic' ? 'classic' : 'warm'); } catch (e) {}
    const colors = p === 'classic' ? ['#f2f2f7', '#000000'] : ['#f6f3ee', '#0b0a08'];
    document.querySelectorAll('meta[name="theme-color"]').forEach((m, i) => { m.content = colors[i] || colors[0]; });
  },
  currentPalette() { try { return localStorage.getItem('palette') === 'classic' ? 'classic' : 'warm'; } catch (e) { return 'warm'; } },

  currentTheme() {
    try { return localStorage.getItem('theme') || 'auto'; } catch (e) { return 'auto'; }
  },

  // ---------- Datum ----------
  todayStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  parseDate(str) { return new Date(str + 'T00:00:00'); },
  formatDate(str) {
    if (!str) return '';
    return this.parseDate(str).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  longDate() {
    return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  },
  weekdayName(str) { return this.parseDate(str).toLocaleDateString('en-US', { weekday: 'long' }); },
  addDays(str, n) {
    const d = this.parseDate(str);
    d.setDate(d.getDate() + n);
    return this.todayStr(d);
  },
  weekStart(str) {
    const d = this.parseDate(str);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return this.todayStr(d);
  },
  isoWeek(str) {
    const d = this.parseDate(str);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - yearStart) / 86400000 + 1) / 7) };
  },
  weekKey(str) {
    const w = this.isoWeek(str);
    return `${w.year}-W${String(w.week).padStart(2, '0')}`;
  },
  monthName(i) { return new Date(2000, i, 1).toLocaleDateString('de-DE', { month: 'long' }); },
  greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Noch wach';
    if (h < 11) return 'Guten Morgen';
    if (h < 17) return 'Guten Tag';
    if (h < 22) return 'Guten Abend';
    return 'Noch wach';
  },

  empty(iconName, text) {
    return this.el('div', { class: 'empty' }, [this.el('div', { class: 'empty-icon', html: Icons[iconName]() }), text]);
  },
};
