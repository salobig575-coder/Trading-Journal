// Wischen zwischen den Haupt-Tabs (Heute · Journal · Routine · Statistik) – nur auf Touch-Geraeten.
// Die Seite folgt dem Finger mit Widerstand; ab ~28 % Bildschirmbreite (oder schnellem Wisch) wechselt der Tab,
// sonst federt sie zurueck. Nicht aktiv in Unterseiten, Dialogen, scrollbaren Leisten, Diagrammen und Eingabefeldern.
const Swipe = {
  skip: 'input, textarea, select, .seg, .chip-scroll, .tour-viewport, .lightbox, .modal-backdrop, .lockscreen, canvas, .grip, .chart-wrap, .img-viewer, .week-strip, .sortable-ghost, [data-noswipe]',
  s: null,

  start() {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    document.addEventListener('touchstart', (e) => this.down(e), { passive: true });
    document.addEventListener('touchmove', (e) => this.move(e), { passive: false });
    document.addEventListener('touchend', (e) => this.up(e), { passive: true });
    document.addEventListener('touchcancel', () => this.reset(false), { passive: true });
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
    if (e.touches.length !== 1 || App.stack.length || document.querySelector('.modal-backdrop, .lockscreen, .lightbox')) return;
    const t = e.touches[0];
    // Rand-Bereiche gehoeren dem System (iOS-Zurueck-Geste)
    if (t.clientX < 24 || t.clientX > innerWidth - 24) return;
    if (e.target.closest(this.skip) || this.scrollable(e.target)) return;
    this.s = { x: t.clientX, y: t.clientY, t: performance.now(), lock: null, dx: 0 };
  },

  neighbour(dir) {
    const order = Object.keys(App.routes);
    const i = order.indexOf(App.current) + dir;
    return order[i] || null;
  },

  move(e) {
    const s = this.s;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (s.lock === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      s.lock = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
      if (s.lock === 'x') {
        const v = document.getElementById('view');
        v.className = v.className.replace(/\benter-\S+/g, '').trim();   // sonst haelt die Einblend-Animation die Position fest
        v.style.transition = 'none';
      }
    }
    if (s.lock !== 'x') return;
    if (e.cancelable) e.preventDefault();
    s.dx = dx;
    const view = document.getElementById('view');
    const has = !!this.neighbour(dx < 0 ? 1 : -1);
    const pull = dx * (has ? 0.5 : 0.18);   // am Rand (kein weiterer Tab) deutlich mehr Widerstand
    view.style.transform = `translateX(${pull}px)`;
    view.style.opacity = String(1 - Math.min(Math.abs(pull) / 420, 0.35));
  },

  up() {
    const s = this.s;
    this.s = null;
    if (!s || s.lock !== 'x') return;
    const dt = Math.max(1, performance.now() - s.t);
    const fast = Math.abs(s.dx) / dt > 0.55 && Math.abs(s.dx) > 40;
    const far = Math.abs(s.dx) > innerWidth * 0.28;
    const next = (fast || far) ? this.neighbour(s.dx < 0 ? 1 : -1) : null;
    if (next) {
      this.reset(false);
      if (typeof Haptics !== 'undefined') Haptics.medium();
      App.navigate(next);
    } else {
      this.reset(true);
    }
  },

  // animated: Seite federt weich zurueck; sonst sofort (vor dem Tab-Wechsel)
  reset(animated) {
    const view = document.getElementById('view');
    if (!view) return;
    if (animated) {
      view.style.transition = 'transform var(--t-slow) var(--spring), opacity var(--t-base) var(--ease)';
      view.style.transform = '';
      view.style.opacity = '';
      setTimeout(() => { view.style.transition = ''; }, 460);
    } else {
      view.style.transition = '';
      view.style.transform = '';
      view.style.opacity = '';
    }
    this.s = null;
  },
};

Swipe.start();
