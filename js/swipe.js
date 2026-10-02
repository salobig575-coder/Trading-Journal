// Wisch-Gesten wie auf dem iPhone (nur Touch-Geraete):
//   links / rechts   auf einem Tab: erst die Unter-Reiter (z. B. Trades · Analysen · Reviews), dann der naechste Haupt-Tab
//   nach rechts      in einer Unterseite: zurueck
//   nach unten       ganz oben auf einem Tab: herunterziehen zum Aktualisieren (Cloud-Abgleich + neu laden)
// Beim Seitenwechsel schiebt sich die NAECHSTE Seite tatsaechlich mit dem Finger herein (beide Seiten laufen Seite an Seite),
// beim Loslassen gleitet alles mit Schwung zu Ende – kein Springen. Die vorab gezeichnete Seite wird uebernommen, nicht neu geladen.
// Sheets (nach unten schliessen) und Bildansicht (nach oben/unten schliessen) stehen in app.js bzw. ui.js.
const Swipe = {
  skip: 'input, textarea, select, .seg, .chip-scroll, .tour-viewport, .lightbox, .modal-backdrop, .lockscreen, canvas, .grip, .chart-wrap, .img-viewer, .week-strip, .sortable-ghost, [data-noswipe]',
  EASE: 'cubic-bezier(0.32, 0.72, 0, 1)',   // iOS-Bremskurve
  DUR: 360,
  s: null,
  ptr: null,
  busy: false,

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
    this.s = {
      x: t.clientX, y: t.clientY, t: performance.now(), lock: null, dx: 0, dy: 0, inPage: App.stack.length > 0,
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

  // Was passiert bei einem Wisch in diese Richtung (dx < 0 = nach links)?
  target(dx, inPage) {
    if (inPage) return dx > 0 ? { type: 'back' } : null;
    const dir = dx < 0 ? 1 : -1;
    const sub = this.subTab(dir);
    if (sub) return { type: 'sub', el: sub };
    const route = this.neighbour(dir);
    return route ? { type: 'tab', route } : null;
  },

  // Einblend-Animation anhalten, sonst haelt sie die Position fest und die Seite folgt dem Finger nicht
  freeze() {
    const v = document.getElementById('view');
    v.className = 'enter-none';
    v.style.transition = 'none';
    return v;
  },

  // ---------- Die naechste Seite vorab zeichnen ----------
  // Gibt { node, undo } zurueck. Zustand (z. B. aktiver Reiter) wird gesetzt, aber nichts neu geladen; undo stellt ihn wieder her.
  async render(tgt) {
    if (tgt.type === 'back') {
      const prev = App.stack[App.stack.length - 2];
      return { node: await (prev ? prev.render() : App.routes[App.current].render()), undo() {} };
    }
    if (tgt.type === 'tab') {
      App.prepare(tgt.route);
      return { node: await App.routes[tgt.route].render(), undo() {} };
    }
    // Unter-Reiter: Klick ohne Neuladen ausloesen, Seite rendern, Zustand merken
    const cur = document.querySelector('#view .seg .seg-tab.active');
    const real = App.refresh;
    const quiet = (fn) => { App.refresh = () => {}; try { fn(); } finally { App.refresh = real; } };
    quiet(() => tgt.el.click());
    let node;
    try { node = await App.routes[App.current].render(); } catch (e) { quiet(() => cur && cur.click()); throw e; }
    return { node, undo: () => quiet(() => cur && cur.click()) };
  },

  makePeek(node) {
    const view = document.getElementById('view');
    const r = view.getBoundingClientRect();
    const el = document.createElement('main');
    el.className = 'peek';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `left:${r.left}px;width:${r.width}px;padding-top:${r.top + window.scrollY}px;visibility:hidden`;
    el.appendChild(node);
    document.body.appendChild(el);
    return { el, w: r.width };
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
      if (s.lock === 'x') {
        s.sign = dx < 0 ? -1 : 1;
        s.tgt = this.target(dx, s.inPage);
        s.W = document.getElementById('view').getBoundingClientRect().width || innerWidth;
        if (s.tgt && !App.reducedMotion()) {
          s.peekP = this.render(s.tgt).then((r) => {
            if (s.dead) { r.undo(); return null; }   // Wisch ist laengst abgebrochen
            s.node = r.node; s.undo = r.undo;
            s.peek = this.makePeek(r.node);
            this.place(s);
            s.peek.el.style.visibility = '';
            return r;
          }).catch(() => null);
        }
      }
    }
    if (e.cancelable) e.preventDefault();
    const view = document.getElementById('view');
    if (s.lock === 'x') {
      s.dx = dx;
      this.place(s);
    } else {
      s.dy = Math.max(0, dy);
      const pull = Math.min(96, s.dy * 0.5);
      view.style.transform = `translateY(${pull}px)`;
      this.showPtr(pull);
    }
  },

  // Seiten an die Fingerposition setzen: aktuelle folgt dem Finger, die naechste schiebt sich von der Seite heran
  place(s) {
    const view = document.getElementById('view');
    const ok = s.tgt && (s.dx * s.sign > 0);                     // Richtung noch passend?
    const x = ok ? s.dx : s.dx * 0.18;                           // ohne Ziel: starker Widerstand wie am Rand
    view.style.transform = `translateX(${x}px)`;
    if (s.peek) s.peek.el.style.transform = `translateX(${ok ? x - s.sign * s.W : -s.sign * s.W}px)`;
    // Titel blendet beim Wechsel weich aus/ein
    const tw = document.querySelector('.title-wrap');
    if (tw && s.tgt && s.tgt.type !== 'sub') { tw.style.transition = 'none'; tw.style.opacity = String(1 - Math.min(Math.abs(x) / s.W * 1.6, 0.85)); }
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
    view.style.transition = `transform var(--t-slow) ${this.EASE}`;
    view.style.transform = 'translateY(56px)';
    this.showPtr(58, 'spin');
    this.ptr.style.transition = `transform var(--t-slow) ${this.EASE}`;
    const wait = new Promise((r) => setTimeout(r, 800));
    try { if (typeof Sync !== 'undefined') await Promise.all([Sync.run({ noRefresh: true }), wait]); else await wait; } catch (e) { await wait; }
    this.ptr.classList.remove('spin'); this.ptr.classList.add('done');
    if (typeof Haptics !== 'undefined') Haptics.success();
    await new Promise((r) => setTimeout(r, 380));
    view.style.transition = `transform var(--t-slow) ${this.EASE}`;
    view.style.transform = '';
    this.hidePtr();
    await App.show({ instant: true, keepScroll: true, dir: 'fade' });
    setTimeout(() => { view.style.transition = ''; this.busy = false; }, 460);
  },

  // ---------- Loslassen ----------
  async up() {
    const s = this.s;
    if (!s || !s.lock || s.lock === 'none') { this.s = null; return; }
    const view = document.getElementById('view');
    if (s.lock === 'y') {
      this.s = null;
      if (s.dy * 0.5 >= 58 && !this.busy) this.refresh(view);
      else { this.hidePtr(); this.settle(view); }
      return;
    }
    s.committed = true;               // laufendes Vorab-Rendern darf noch fertig werden
    this.busy = true;
    const dt = Math.max(1, performance.now() - s.t);
    const fast = Math.abs(s.dx) / dt > 0.5 && Math.abs(s.dx) > 36;
    const far = Math.abs(s.dx) > s.W * 0.33;
    const go = !!s.tgt && s.dx * s.sign > 0 && (fast || far);
    // Seite noch nicht fertig gezeichnet? Kurz warten (max. 1,5 s); dauert es laenger, bleibt alles wo es ist
    let late = false;
    if (go && s.peekP && !s.peek) late = (await Promise.race([s.peekP.then(() => 0), new Promise((r) => setTimeout(() => r(1), 1500))])) === 1;
    this.s = null;
    if (go && !late) await this.commit(s, view); else await this.revert(s, view);
    this.busy = false;
  },

  slide(el, x) {
    el.style.transition = `transform ${this.DUR}ms ${this.EASE}`;
    el.style.transform = `translateX(${x}px)`;
  },

  titleBack() {
    const tw = document.querySelector('.title-wrap');
    if (tw) { tw.style.transition = 'opacity var(--t-base) var(--ease)'; tw.style.opacity = ''; }
  },

  async commit(s, view) {
    if (typeof Haptics !== 'undefined') Haptics.light();
    const tgt = s.tgt;
    if (!s.peek) {
      // Fallback ohne Vorschau: normal wechseln
      view.style.transition = ''; view.style.transform = '';
      this.titleBack();
      if (tgt.type === 'back') App.back(); else if (tgt.type === 'sub') tgt.el.click(); else App.navigate(tgt.route);
      return;
    }
    const peek = s.peek;
    this.slide(view, s.sign * s.W);
    this.slide(peek.el, 0);
    await new Promise((r) => setTimeout(r, this.DUR + 20));
    // Vorab gezeichnete Seite uebernehmen (kein erneutes Laden, kein Flackern)
    App._adopt = {
      node: s.node,
      onShown: () => {
        peek.el.remove();
        view.style.transition = 'none'; view.style.transform = '';
        requestAnimationFrame(() => { view.style.transition = ''; });
        this.titleBack();
      },
    };
    setTimeout(() => { App._adopt = null; }, 1500);
    if (tgt.type === 'back') history.back();
    else if (tgt.type === 'sub') App.show({ instant: true });
    else App.navigate(tgt.route, { instant: true });
  },

  async revert(s, view) {
    this.slide(view, 0);
    if (s.peek) this.slide(s.peek.el, -s.sign * s.W);
    this.titleBack();
    await new Promise((r) => setTimeout(r, this.DUR + 20));
    if (s.peek) s.peek.el.remove();
    s.dead = true;
    if (s.undo) s.undo();
    view.style.transition = ''; view.style.transform = '';
  },

  cancel() {
    const s = this.s; this.s = null;
    if (!s || !s.lock || s.lock === 'none') return;
    this.hidePtr();
    if (s.lock === 'x') { s.committed = true; this.revert(s, document.getElementById('view')); } else this.settle(document.getElementById('view'));
  },

  settle(view) {
    if (!view) return;
    view.style.transition = `transform var(--t-slow) ${this.EASE}`;
    view.style.transform = '';
    setTimeout(() => { view.style.transition = ''; }, 460);
  },
};

Swipe.start();
