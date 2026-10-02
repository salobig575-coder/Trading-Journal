const App = {
  routes: {
    home: { title: 'Journal 2026', icon: 'home', render: () => HomeView.render() },
    journal: { title: 'Journal', icon: 'journal', render: () => JournalView.render() },
    analyse: { title: 'Analyse', icon: 'analyse', render: () => AnalyseHub.render() },
    stats: { title: 'Statistik', icon: 'stats', render: () => StatsHub.render() },
  },
  routeOrder: ['home', 'journal', 'analyse', 'stats'],

  current: 'home',
  stack: [],

  async init() {
    await Options.load();
    await Seed.run();

    document.getElementById('settingsBtn').innerHTML = Icons.settings();
    document.getElementById('backBtn').innerHTML = Icons.back();
    document.querySelectorAll('nav.bottomnav button').forEach((btn) => {
      const route = btn.dataset.route;
      btn.querySelector('.ic').innerHTML = Icons[this.routes[route].icon]();
      btn.addEventListener('click', () => this.navigate(route));
    });
    document.getElementById('settingsBtn').addEventListener('click', () => SettingsView.open());
    document.getElementById('backBtn').addEventListener('click', () => this.back());
    window.addEventListener('popstate', () => { if (this.stack.length) { this.stack.pop(); this.show({ instant: true }); } });

    const hash = location.hash.replace('#', '');
    this.navigate(this.routes[hash] ? hash : 'home', { instant: true });

    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    Sync.start();

    const splash = document.getElementById('splash');
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 550);
    }, 1100);
  },

  navigate(route, opts = {}) {
    if (!this.routes[route]) route = 'home';
    this.current = route;
    this.stack = [];
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

  // Zurueck + Seite darunter neu rendern (nach Speichern)
  closePage() {
    if (!this.stack.length) return this.refresh();
    history.back();
  },

  show(opts = {}) {
    const top = this.stack.at(-1);
    const route = this.routes[this.current];
    document.body.classList.toggle('in-page', !!top);

    document.querySelectorAll('nav.bottomnav button').forEach((btn) => btn.classList.toggle('active', btn.dataset.route === this.current));
    const indicator = document.getElementById('navIndicator');
    if (indicator) indicator.style.transform = `translateX(${this.routeOrder.indexOf(this.current) * 100}%)`;

    document.getElementById('pageTitle').textContent = top ? top.title : route.title;
    document.getElementById('pageSub').textContent = '';

    const renderFn = top ? top.render : route.render;
    const view = document.getElementById('view');
    const render = () => {
      view.innerHTML = '';
      view.classList.remove('leaving');
      Promise.resolve(renderFn()).then((node) => {
        if (node) view.appendChild(node);
        window.scrollTo(0, 0);
      });
    };
    if (opts.instant || !view.hasChildNodes()) render();
    else { view.classList.add('leaving'); setTimeout(render, 150); }
  },

  refresh() {
    this.show({ instant: true });
  },

  setSub(text) {
    document.getElementById('pageSub').textContent = text;
  },

  // Zu einem Tab eines Hubs springen
  goTab(route, hub, tab) {
    hub.activeTab = tab;
    this.navigate(route);
  },

  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'value') node.value = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (typeof v === 'boolean') { if (v) node.setAttribute(k, ''); else node.removeAttribute(k); }
      else node.setAttribute(k, v);
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
    const bar = this.el('div', { class: 'tab-bar' }, tabs.map((t) =>
      this.el('button', { class: 'tab-pill' + (t.key === activeKey ? ' active' : ''), onclick: () => onChange(t.key) }, t.label)
    ));
    requestAnimationFrame(() => {
      const active = bar.querySelector('.tab-pill.active');
      if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
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
    return this.el('div', { class: 'switch-row' }, [this.el('div', { style: 'flex:1;min-width:0' }, textCol), sw]);
  },

  showModal(contentNode) {
    const backdrop = this.el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) App.closeModal(); } });
    backdrop.appendChild(this.el('div', { class: 'modal' }, [contentNode]));
    document.body.appendChild(backdrop);
    this._modal = backdrop;
    return backdrop;
  },

  closeModal() {
    if (this._modal) {
      const m = this._modal;
      this._modal = null;
      m.classList.add('closing');
      setTimeout(() => m.remove(), 200);
    }
  },

  animateNumber(el, to, opts = {}) {
    if (!el) return;
    const decimals = opts.decimals != null ? opts.decimals : 0;
    const suffix = opts.suffix || '';
    const signed = !!opts.signed;
    const fmt = (v) => (signed && v > 0 ? '+' : '') + v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (!isFinite(to)) { el.textContent = '∞'; return; }
    const from = 0;
    const duration = opts.duration || 700;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    else { document.documentElement.removeAttribute('data-theme'); theme = 'auto'; }
    try { localStorage.setItem('theme', theme); } catch (e) {}
  },

  currentTheme() {
    try { return localStorage.getItem('theme') || 'auto'; } catch (e) { return 'auto'; }
  },

  // ---- Datum ----
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

  weekdayName(str) {
    return this.parseDate(str).toLocaleDateString('en-US', { weekday: 'long' });
  },

  addDays(str, n) {
    const d = this.parseDate(str);
    d.setDate(d.getDate() + n);
    return this.todayStr(d);
  },

  // Montag der Woche
  weekStart(str) {
    const d = this.parseDate(str);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return this.todayStr(d);
  },

  isoWeek(str) {
    const d = this.parseDate(str);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - yearStart) / 86400000 + 1) / 7) };
  },

  weekKey(str) {
    const w = this.isoWeek(str);
    return `${w.year}-W${String(w.week).padStart(2, '0')}`;
  },

  monthName(i) {
    return new Date(2000, i, 1).toLocaleDateString('de-DE', { month: 'long' });
  },

  greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Noch spät wach';
    if (h < 11) return 'Guten Morgen';
    if (h < 17) return 'Guten Tag';
    if (h < 22) return 'Guten Abend';
    return 'Noch spät wach';
  },

  empty(iconName, text) {
    return this.el('div', { class: 'empty' }, [this.el('div', { class: 'empty-icon', html: Icons[iconName]() }), text]);
  },
};
