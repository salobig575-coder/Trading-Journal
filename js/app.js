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
    window.addEventListener('popstate', () => { if (this.stack.length) { this.stack.pop(); this.show({ instant: true }); } });
    window.addEventListener('error', (e) => { console.warn(e.message); });
    window.addEventListener('unhandledrejection', (e) => { console.warn(e.reason); });

    const hash = location.hash.replace('#', '');
    this.navigate(this.routes[hash] ? hash : 'home', { instant: true });

    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    try { Sync.start(); } catch (e) { console.warn(e); }

    const splash = document.getElementById('splash');
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 700);
    }, 1500);
  },

  // ---------- Navigation ----------
  navigate(route, opts = {}) {
    if (!this.routes[route]) route = 'home';
    this.current = route;
    this.stack = [];
    if (route === 'routine' && typeof RoutineView !== 'undefined') { RoutineView.date = null; RoutineView.editing = false; }
    history.replaceState(null, '', '#' + route);
    this.show(opts);
  },

  openPage(title, renderFn) {
    this.stack.push({ title, render: renderFn });
    history.pushState({ page: true }, '', location.href);
    this.show();
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
    document.body.classList.toggle('in-page', !!top);

    document.querySelectorAll('.dock button.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.route === this.current && !top));
    document.getElementById('pageTitle').textContent = top ? top.title : route.title;
    document.getElementById('pageSub').textContent = top ? '' : route.over();

    const renderFn = top ? top.render : route.render;
    const view = document.getElementById('view');
    const token = (this._token = (this._token || 0) + 1);
    const render = async () => {
      let node = null;
      try { node = await renderFn(); } catch (e) { console.warn(e); node = this.empty('alert', 'Das konnte gerade nicht geladen werden.'); }
      if (token !== this._token) return;
      view.innerHTML = '';
      view.classList.remove('leaving');
      if (node) view.appendChild(node);
      this.stagger(view);
      if (!opts.keepScroll) window.scrollTo(0, 0);
    };
    if (opts.instant || !view.hasChildNodes()) render();
    else { view.classList.add('leaving'); setTimeout(render, 110); }
  },

  refresh() {
    const y = window.scrollY;
    this.show({ instant: true, keepScroll: true });
    requestAnimationFrame(() => window.scrollTo(0, y));
  },

  // Gestaffelter Einstieg der ersten Elemente
  stagger(view) {
    const items = [];
    const collect = (el) => {
      for (const c of el.children) {
        if (c.tagName === 'DIV' && !c.className && c.children.length) collect(c);
        else items.push(c);
      }
    };
    collect(view);
    items.slice(0, 10).forEach((el, i) => { el.style.setProperty('--i', i); el.classList.add('rv'); });
  },

  goTab(route, hub, tab) {
    hub.activeTab = tab;
    this.navigate(route);
  },

  // ---------- Schnell-Aktionen (+) ----------
  quickAdd() {
    const fab = document.getElementById('fab');
    fab.classList.add('open');
    const act = (icon, t, s, fn) => App.el('button', { class: 'action-row', onclick: () => { App.closeModal(); setTimeout(fn, 250); } }, [
      App.el('div', { class: 'ic', html: Icons[icon]() }),
      App.el('div', {}, [App.el('div', { class: 't' }, t), App.el('div', { class: 's' }, s)]),
    ]);
    const bd = this.showModal(App.el('div', {}, [
      App.el('h3', {}, 'Neu erfassen'),
      act('trend', 'Trade', 'Einen Trade ins Journal eintragen', () => TradeForm.open()),
      act('analyse', 'Analyse', 'Weekly Outlook, Review oder Daily Log', () => { JournalHub.activeTab = 'analysis'; this.navigate('journal'); setTimeout(() => AnalysisView.chooseTemplate(), 350); }),
      act('review', 'Review', 'Eine Review-Notiz anlegen', () => { JournalHub.activeTab = 'review'; this.navigate('journal'); setTimeout(() => Collections.edit('review'), 350); }),
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
    return node;
  },

  icon(name, size = 16) {
    return this.el('span', { html: Icons[name](), style: `width:${size}px;height:${size}px;display:inline-flex;flex-shrink:0` });
  },

  tabBar(tabs, activeKey, onChange) {
    const bar = this.el('div', { class: 'seg' }, tabs.map((t) =>
      this.el('button', { class: 'seg-tab' + (t.key === activeKey ? ' active' : ''), onclick: () => onChange(t.key) }, t.label)
    ));
    requestAnimationFrame(() => {
      const active = bar.querySelector('.seg-tab.active');
      if (active) bar.scrollTo({ left: active.offsetLeft - 22, behavior: 'auto' });
    });
    return bar;
  },

  switchRow(label, desc, checked, onChange) {
    const sw = this.el('div', { class: 'switch' + (checked ? ' on' : '') });
    sw.addEventListener('click', () => {
      const next = !sw.classList.contains('on');
      sw.classList.toggle('on', next);
      onChange(next);
    });
    const textCol = [this.el('div', { class: 'switch-label' }, label)];
    if (desc) textCol.push(this.el('div', { class: 'switch-desc' }, desc));
    return this.el('div', { class: 'switch-row' }, [this.el('div', { class: 'grow' }, textCol), sw]);
  },

  showModal(contentNode) {
    this.closeModal(true);
    const backdrop = this.el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) App.closeModal(); } });
    backdrop.appendChild(this.el('div', { class: 'modal' }, [contentNode]));
    document.body.appendChild(backdrop);
    this._modal = backdrop;
    return backdrop;
  },

  closeModal(immediate) {
    if (!this._modal) return;
    const m = this._modal;
    this._modal = null;
    if (immediate) { m.remove(); return; }
    m.classList.add('closing');
    setTimeout(() => m.remove(), 240);
  },

  // Bestaetigung als Sheet (statt Browser-Dialog)
  confirm(message, opts = {}) {
    return new Promise((resolve) => {
      const done = (v) => { bd.classList.add('closing'); setTimeout(() => bd.remove(), 240); resolve(v); };
      const bd = this.el('div', { class: 'modal-backdrop', style: 'z-index:95', onclick: (e) => { if (e.target === bd) done(false); } }, [
        this.el('div', { class: 'modal' }, [
          this.el('h3', {}, message),
          opts.text ? this.el('p', { class: 'tag', style: 'margin:-8px 0 18px' }, opts.text) : null,
          this.el('div', { class: 'btn-row', style: 'margin-top:0' }, [
            this.el('button', { class: 'btn secondary', onclick: () => done(false) }, 'Abbrechen'),
            this.el('button', { class: 'btn ' + (opts.danger === false ? '' : 'danger'), onclick: () => done(true) }, opts.ok || 'Löschen'),
          ]),
        ]),
      ]);
      document.body.appendChild(bd);
    });
  },

  toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = this.el('div', { id: 'toast', class: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 2600);
  },

  animateNumber(el, to, opts = {}) {
    if (!el) return;
    const decimals = opts.decimals != null ? opts.decimals : 0;
    const suffix = opts.suffix || '';
    const fmt = (v) => (opts.signed && v > 0.0001 ? '+' : '') + v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (!isFinite(to)) { el.textContent = '∞'; return; }
    const from = opts.from || 0;
    const duration = opts.duration || 900;
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
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#07080a';
  },

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
