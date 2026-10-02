// Willkommens-Tour (einmalig) und Kurzanleitung
const Onboarding = {
  slides: [
    { icon: 'sparkles', art: 'hello', title: 'Willkommen', text: 'Dein Trading-Journal, deine Routine und deine Zahlen – ruhig und an einem Ort.' },
    { icon: 'trend', art: 'journal', title: 'Trades festhalten', text: 'Tippe unten auf das goldene Plus. Gib R:R als positiven Betrag ein, das Vorzeichen ergibt sich aus dem Ergebnis.' },
    { icon: 'routine', art: 'sun', title: 'Routine aufbauen', text: 'Hake täglich deine Gewohnheiten ab. Unterpunkte erscheinen, sobald die Hauptgewohnheit erledigt ist.' },
    { icon: 'shield', art: 'wallet', title: 'Sicher und überall', text: 'Mit dem Cloud-Abgleich bist du am Handy und am PC auf dem gleichen Stand. Eine PIN schützt die App, ein Backup sichert dich ab.' },
  ],

  async maybeShow() {
    if (await DB.getSetting('onboarded', false)) return;
    this.show(true);
  },

  show(first) {
    let i = 0;
    const track = App.el('div', { class: 'tour-track' }, this.slides.map((s) => App.el('div', { class: 'tour-slide' }, [
      s.art ? Art.scene(s.art, 150) : App.el('div', { class: 'ic', html: Icons[s.icon]() }), App.el('h3', {}, s.title), App.el('p', {}, s.text),
    ])));
    const dots = App.el('div', { class: 'tour-dots' }, this.slides.map(() => App.el('i')));
    const next = App.el('button', { class: 'btn' }, 'Weiter');
    const skip = App.el('button', { class: 'btn secondary' }, 'Überspringen');
    const draw = () => {
      track.style.transform = `translateX(${-i * 100}%)`;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
      next.textContent = i === this.slides.length - 1 ? 'Los geht’s' : 'Weiter';
      skip.style.visibility = i === this.slides.length - 1 ? 'hidden' : 'visible';
    };
    const finish = async () => { App.closeModal(); if (first) await DB.setSetting('onboarded', true); };
    next.onclick = () => { if (i < this.slides.length - 1) { i++; draw(); } else finish(); };
    skip.onclick = finish;
    App.showModal(App.el('div', {}, [App.el('div', { class: 'tour-viewport' }, [track]), dots, App.el('div', { class: 'btn-row' }, [skip, next])]));
    draw();
  },
};
