// Wisch-Gesten wie auf dem iPhone (nur Touch-Geraete):
//   links / rechts   auf einem Tab: erst die Unter-Reiter (z. B. Trades · Analysen · Reviews), dann der naechste Haupt-Tab
//   nach rechts      in einer Unterseite: zurueck (die Seite folgt dem Finger)
//   nach unten       ganz oben auf einem Tab: herunterziehen zum Aktualisieren (Cloud-Abgleich + neu laden)
// Sheets (nach unten schliessen) und Bildansicht (nach oben/unten schliessen) stehen in app.js bzw. ui.js.
// Nicht aktiv in Dialogen, scrollbaren Leisten, Diagrammen und Eingabefeldern.
const Swipe = {
  skip: 'input, textarea, select, .seg, .chip-scroll, .tour-viewport, .lightbox, .modal-backdrop, .lockscreen, canvas, .grip, .chart-wrap, .img-viewer, .week-strip, .sortable-ghost, [data-noswipe]',
  s: null,
  ptr: null,

  start() {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    document.addEventListener('touchstart', (e) => this.down(e), { passive: true });
    document.addEventListener('touchmove', (e) => this.move(e), { passive: false });
    document.addEventListener('touchend', () => this.up(), { passive: true });
    document.addEventListener('touchcancel', () => this.cancel(), { passive: true });
  },

  // Liegt zwischen Finger und Seitenrand ein horizontal scrollbarer Bereich?
  scrollable(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 4) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
    }
    return false;
  },

  down(e) {
    this.s = null;
    if (this.busy || e.touches.length !== 1 || document.querySelector('.modal-backdrop, .lockscreen, .lightbox')) return;
    const t = e.touches[0];
    if (e.target.closest(this.skip)) return;
    const inPage = App.stack.length > 0;
    this.s = {
      x: t.clientX, y: t.clientY, t: performance.now(), lock: null, dx: 0, dy: 0, inPage,
      // Randbereiche gehoeren dem System (iOS-Zurueck-Geste); scrollbare Leisten behalten ihr Wischen
      hOK: !(t.clientX < 24 || t.clientX > innerWidth - 24) && !this.scrollable(e.target),
      top: window.scrollY <= 0,
    };
  },

  neighbour(dir) {
    const order = Object.keys(App.routes);
    return order[order.indexOf(App.current) + dir] || null;
  },

  // Naechster Unter-Reiter in dieser Richtung (falls die Seite Reiter hat)
  subTab(dir) {
    const bar = document.querySelector('#view .seg');
    const cur = bar && bar.querySelector('.seg-tab.active');
    const n = cur && (dir > 0 ? cur.nextElementSibling : cur.previousElementSibling);
    return n && n.classList.contains('seg-tab') ? n : null;
  },

  // Gibt es in dieser Richtung ueberhaupt etwas zu tun?
  target(dx, s = this.s) {
    if (s.inPage) return dx > 0 ? { type: 'back' } : null;
    const dir = dx < 0 ? 1 : -1;
    const sub = this.subTab(dir);
    if (sub) return { type: 'sub', el: sub };
    const route = this.neighbour(dir);
    return route ? { type: 'tab', route } : null;
  },

  freeze() {
    const v = document.getElementById('view');
    v.className = v.className.replace(/\benter-\S+/g, '').trim();   // sonst haelt die Einblend-Animation die Position fest
    v.style.transition = 'none';
    return v;
  },

  move(e) {
    const s = this.s;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (s.lock === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.4) s.lock = s.hOK ? 'x' : 'none';
      else s.lock = (dy > 0 && s.top && !s.inPage && Math.abs(dy) > Math.abs(dx) * 1.4) ? 'y' : 'none';
      if (s.lock === 'none') { this.s = null; return; }
      this.freeze();
    }
    if (e.cancelable) e.preventDefault();
    const view = document.getElementById('view');
    if (s.lock === 'x') {
      s.dx = dx;
      const has = !!this.target(dx);
      const pull = s.inPage ? Math.max(0, dx) * 0.9 : dx * (has ? 0.5 : 0.18);   // am Rand deutlich mehr Widerstand
      view.style.transform = `translateX(${pull}px)`;
      view.style.opacity = String(1 - Math.min(Math.abs(pull) / 420, 0.35));
    } else {
      s.dy = Math.max(0, dy);
      const pull = Math.min(96, s.dy * 0.5);
      view.style.transform = `translateY(${pull}px)`;
      this.showPtr(pull);
    }
  },

  // ---------- Herunterziehen zum Aktualisieren ----------
  showPtr(pull, state) {
    if (!this.ptr) {
      this.ptr = document.createElement('div');
      this.ptr.className = 'ptr';
      this.ptr.innerHTML = '<div class="ptr-ring"></div>';
      this.ptr.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.ptr);
    }
    const p = this.ptr, ready = pull >= 58;
    p.style.transition = 'none';
    p.style.opacity = String(Math.min(1, pull / 40));
    p.style.transform = `translate(-50%, ${pull - 44}px) scale(${0.6 + Math.min(pull / 58, 1) * 0.4})`;
    p.firstChild.style.transform = `rotate(${pull * 5}deg)`;
    if (ready && !p.classList.contains('ready') && typeof Haptics !== 'undefined') Haptics.light();
    p.classList.toggle('ready', ready);
    if (state) p.classList.toggle('spin', state === 'spin');
  },

  hidePtr() {
    const p = this.ptr;
    if (!p) return;
    p.style.transition = 'opacity var(--t-base) var(--ease), transform var(--t-base) var(--ease)';
    p.style.opacity = '0';
    p.style.transform = 'translate(-50%, -44px) scale(0.6)';
    p.classList.remove('ready', 'spin', 'done');
  },

  async refresh(view) {
    this.busy = true;
    if (typeof Haptics !== 'undefined') Haptics.medium();
    view.style.transition = 'transform var(--t-slow) var(--spring)';
    view.style.transform = 'translateY(56px)';
    this.showPtr(58, 'spin');
    this.ptr.style.transition = 'transform var(--t-slow) var(--spring)';
    const wait = new Promise((r) => setTimeout(r, 800));
    try { if (typeof Sync !== 'undefined') await Promise.all([Sync.run({ noRefresh: true }), wait]); else await wait; } catch (e) { await wait; }
    this.ptr.classList.remove('spin'); this.ptr.classList.add('done');
    if (typeof Haptics !== 'undefined') Haptics.success();
    await new Promise((r) => setTimeout(r, 380));
    view.style.transition = 'transform var(--t-slow) var(--ease)';
    view.style.transform = '';
    this.hidePtr();
    await App.show({ instant: true, keepScroll: true, dir: 'fade' });
    setTimeout(() => { view.style.transition = ''; this.busy = false; }, 460);
  },

  up() {
    const s = this.s;
    this.s = null;
    if (!s || !s.lock || s.lock === 'none') return;
    const view = document.getElementById('view');
    const dt = Math.max(1, performance.now() - s.t);
    if (s.lock === 'y') {
      if (s.dy * 0.5 >= 58 && !this.busy) this.refresh(view);
      else { this.hidePtr(); this.settle(view); }
      return;
    }
    const fast = Math.abs(s.dx) / dt > 0.55 && Math.abs(s.dx) > 40;
    const far = Math.abs(s.dx) > innerWidth * 0.28;
    const tgt = (fast || far) ? this.target(s.dx, s) : null;
    if (!tgt) { this.settle(view); return; }
    if (typeof Haptics !== 'undefined') Haptics.medium();
    if (tgt.type === 'back') {
      // Seite ganz hinausgleiten lassen, dann zurueck
      view.style.transition = 'transform var(--t-base) var(--ease), opacity var(--t-base) var(--ease)';
      view.style.transform = `translateX(${innerWidth}px)`;
      view.style.opacity = '0';
      setTimeout(() => { this.settle(view, true); App.back(); }, 200);
    } else {
      this.settle(view, true);
      if (tgt.type === 'sub') tgt.el.click(); else App.navigate(tgt.route);
    }
  },

  cancel() {
    const s = this.s; this.s = null;
    if (s && s.lock && s.lock !== 'none') { this.hidePtr(); this.settle(document.getElementById('view')); }
  },

  // instant: sofort zuruecksetzen (vor dem Wechsel); sonst weich zurueckfedern
  settle(view, instant) {
    if (!view) return;
    if (instant) { view.style.transition = ''; view.style.transform = ''; view.style.opacity = ''; return; }
    view.style.transition = 'transform var(--t-slow) var(--spring), opacity var(--t-base) var(--ease)';
    view.style.transform = '';
    view.style.opacity = '';
    setTimeout(() => { view.style.transition = ''; }, 460);
  },
};

Swipe.start();
