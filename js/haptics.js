// Haptisches Feedback in drei Stufen. Android: navigator.vibrate. iPhone (iOS 18+): ein unsichtbarer
// Schalter (<input switch>) loest beim Antippen den System-Tick aus; Staerke ueber die Anzahl der Ticks.
//   light  = Auswahl, Haken, Chips        (1 Tick)
//   medium = Tabs, Plus-Knopf, Speichern  (1 Tick, kraeftiger auf Android)
//   success= Tag komplett, gespeichert    (2 Ticks)
//   heavy  = Loeschen, Warnung            (3 Ticks)
const Haptics = {
  KEY: 'tj_haptics',
  label: null,

  enabled() { try { return localStorage.getItem(this.KEY) !== '0'; } catch (e) { return true; } },
  set(on) { try { localStorage.setItem(this.KEY, on ? '1' : '0'); } catch (e) {} },

  // Nur geraete mit Touch spueren etwas – am PC bleibt alles still
  supported() { return window.matchMedia('(pointer: coarse)').matches || !!navigator.vibrate; },

  start() {
    if (this.supported()) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.body.appendChild(label);
      this.label = label;
    }
    // Ein Zuhoerer fuer die ganze App: jede Art von Element hat ihre Staerke
    const map = [
      ['.icon-btn.del, .btn.danger, .danger', 'heavy'],
      ['.fab, .dock button.tab', 'medium'],
      ['.btn', 'medium'],
      ['.chip, .seg-tab, .checkbox, .habit, .switch, .stepper button, .round-btn, .icon-btn, .wk-day, .action-row, .item.clickable, .g-card, .quick, .text-btn, .habit-add', 'light'],
    ];
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest(map.map((m) => m[0]).join(','));
      if (!t || t.dataset.noHaptic !== undefined) return;
      const hit = map.find((m) => t.matches(m[0]));
      this[hit ? hit[1] : 'light']();
    }, true);
  },

  tick(n = 1, gap = 55) {
    if (!this.label) return;
    for (let i = 0; i < n; i++) setTimeout(() => { try { this.label.click(); } catch (e) {} }, i * gap);
  },

  vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} },

  light() { if (!this.enabled()) return; this.vibrate(8); this.tick(1); },
  medium() { if (!this.enabled()) return; this.vibrate(16); this.tick(1); },
  success() { if (!this.enabled()) return; this.vibrate([14, 50, 22]); this.tick(2, 70); },
  heavy() { if (!this.enabled()) return; this.vibrate([30, 40, 30]); this.tick(3, 55); },
};

Haptics.start();
