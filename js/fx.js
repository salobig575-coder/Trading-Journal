// Feier-Effekte: Konfetti + Meldung (Tag / Woche / Monat geschafft)
const Fx = {
  canvas: null,

  confetti(power = 1) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!this.canvas) {
      this.canvas = App.el('canvas', { id: 'fx' });
      document.body.appendChild(this.canvas);
    }
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const colors = [css.getPropertyValue('--accent').trim(), css.getPropertyValue('--accent-2').trim(), css.getPropertyValue('--win').trim(), '#ffffff'];
    const n = Math.round(70 * power);
    const parts = Array.from({ length: n }, () => ({
      x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * 0.72,
      vx: (Math.random() - .5) * 11, vy: -(Math.random() * 13 + 6),
      s: Math.random() * 6 + 4, r: Math.random() * 6, vr: (Math.random() - .5) * .35,
      col: colors[Math.floor(Math.random() * colors.length)], life: 1,
    }));
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.38; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        p.life = Math.max(0, 1 - t / 2.2);
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      if (t < 2.2) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    requestAnimationFrame(tick);
  },

  celebrate(emoji, title, sub, power = 1) {
    if (typeof Haptics !== "undefined") { Haptics.success(); if (power >= 1.5) setTimeout(() => Haptics.heavy(), 320); }
    this.confetti(power);
    document.querySelectorAll('.celebrate').forEach((n) => n.remove());
    const card = App.el('div', { class: 'celebrate' }, [
      App.el('div', { class: 'em' }, emoji),
      App.el('div', {}, [App.el('div', { class: 't' }, title), App.el('div', { class: 's' }, sub)]),
    ]);
    document.body.appendChild(card);
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
    setTimeout(() => card.classList.remove('show'), 3600);
    setTimeout(() => card.remove(), 4300);
  },
};
