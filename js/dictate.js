// Diktieren: kleiner Mikrofon-Knopf in jedem Notizfeld. Erkannte Begriffe wie "Nasdaq" oder "Euro Dollar"
// werden mit deinen eigenen Pairs abgeglichen und als NQ / EURUSD eingetragen.
// Nutzt die Spracherkennung des Browsers. Wo sie nicht verfuegbar ist (z. B. manche iPhone-Apps vom Home-Bildschirm),
// bleibt der Knopf weg bzw. verweist auf das Mikrofon der Tastatur.
const Dictate = {
  Rec: window.SpeechRecognition || window.webkitSpeechRecognition,
  active: null,

  // Gesprochene Varianten -> Kuerzel (zusaetzlich zu deinen eigenen Pairs)
  aliases: [
    [/\b(nasdaq|nas\s?dack|nazdak)( 100)?\b/gi, 'NQ'],
    [/\bs\s?(&|und|and)\s?p( 500)?\b/gi, 'ES'],
    [/\beuro\s*(dollar|usd)\b/gi, 'EURUSD'],
    [/\b(pfund|pound|cable)\s*(dollar|usd)?\b/gi, 'GBPUSD'],
    [/\b(us\s?)?(oil|öl|crude)\b/gi, 'USOIL'],
    [/\bdollar\s*index\b/gi, 'DXY'],
    [/\bgold\b/gi, 'GOLD'],
  ],

  fix(text) {
    let out = text;
    const mine = (typeof Options !== 'undefined' && Options.get('pairs')) || [];
    mine.filter((p) => p.length >= 2 && p.length <= 8).forEach((p) => {
      // "n q" / "e s" / "e u r u s d" -> NQ / ES / EURUSD
      const spaced = p.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s');   // nur buchstabiert ("e s"), nie das normale Wort "es"
      out = out.replace(new RegExp('\\b' + spaced + '\\b', 'gi'), p);
    });
    this.aliases.forEach(([re, to]) => { if (mine.length === 0 || mine.includes(to)) out = out.replace(re, to); });
    return out;
  },

  start() {
    if (!this.Rec) return;
    const scan = (root) => (root.querySelectorAll ? root.querySelectorAll('textarea:not([data-dict])') : []).forEach((ta) => this.attach(ta));
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('textarea')) this.attach(n); else scan(n); } }))).observe(document.body, { childList: true, subtree: true });
    scan(document.body);
  },

  attach(ta) {
    if (ta.dataset.dict) return;   // schon bearbeitet (sonst Endlosschleife, weil das Umhaengen den Beobachter erneut ausloest)
    ta.dataset.dict = '1';
    if (!ta.parentNode || ta.closest('.lockscreen') || ta.readOnly) return;
    const wrap = document.createElement('div');
    wrap.className = 'dict-wrap';
    ta.parentNode.insertBefore(wrap, ta);
    wrap.appendChild(ta);
    const btn = App.el('button', { type: 'button', class: 'dict-btn', 'aria-label': 'Diktieren', 'aria-pressed': 'false', html: Icons.mic() });
    btn.addEventListener('click', () => this.toggle(ta, btn));
    wrap.appendChild(btn);
  },

  stop() {
    if (!this.active) return;
    const a = this.active; this.active = null;
    try { a.rec.stop(); } catch (e) {}
    a.btn.classList.remove('live'); a.btn.setAttribute('aria-pressed', 'false');
  },

  toggle(ta, btn) {
    if (this.active && this.active.btn === btn) { this.stop(); return; }
    this.stop();
    const rec = new this.Rec();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = true;
    const base = ta.value && !/\s$/.test(ta.value) ? ta.value + ' ' : ta.value;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += this.fix(r[0].transcript.trim()) + ' '; else interim += r[0].transcript;
      }
      ta.value = base + finalText + this.fix(interim);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      this.stop();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') App.toast('Mikrofon nicht erlaubt. Tipp: Das Mikrofon deiner Tastatur funktioniert auch.');
      else App.toast('Diktieren ist gerade nicht verfügbar.');
    };
    rec.onend = () => { if (this.active && this.active.rec === rec) this.stop(); ta.value = ta.value.trimEnd(); };
    try { rec.start(); } catch (e) { App.toast('Diktieren ist gerade nicht verfügbar.'); return; }
    this.active = { rec, btn };
    btn.classList.add('live'); btn.setAttribute('aria-pressed', 'true');
  },
};

Dictate.start();
