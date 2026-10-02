// Illustrationen: "Kerzo", eine kleine Kerze (Candlestick) als Maskottchen fuer leere Zustaende, Tour und Ruhetage.
// Komplett aus SVG + CSS gezeichnet (kein Bild-Download, passt sich Hell/Dunkel und Farbschema an).
// Eigene Illustrationen (z. B. vom Illustrator) lassen sich hier pro Szene ersetzen: Art.custom[name] = '<svg…>'
const Art = {
  n: 0,
  custom: {},

  // Welche Szene zu welchem Icon-Namen aus App.empty() gehoert
  alias: {
    journal: 'journal', clipboard: 'journal', book: 'journal', review: 'journal',
    stats: 'stats', trophy: 'stats', trend: 'stats',
    analyse: 'search', filter: 'search', search: 'search',
    wallet: 'wallet', shield: 'wallet',
    alert: 'oops', routine: 'sun', dna: 'search', flask: 'search',
  },

  has(name) { return !!(this.custom[name] || this.alias[name] || this.scenes[name]); },

  // Gibt ein Element zurueck; size = Breite in px
  scene(name, size = 168) {
    const key = this.scenes[name] ? name : (this.alias[name] || 'hello');
    const id = 'k' + (++this.n);
    const svg = this.custom[key] || this.svg(key, id);
    const box = document.createElement('div');
    box.className = 'art art-' + key;
    box.style.width = size + 'px';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = svg;
    return box;
  },

  svg(key, id) {
    const sc = this.scenes[key];
    return `<svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <defs>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" style="stop-color:var(--btn-from)"/><stop offset="1" style="stop-color:var(--btn-to)"/></linearGradient>
        <radialGradient id="${id}s" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></radialGradient>
      </defs>
      <ellipse cx="100" cy="92" rx="84" ry="70" fill="url(#${id}s)"/>
      ${sc.back ? sc.back(id) : ''}
      <ellipse class="art-shadow" cx="100" cy="164" rx="34" ry="6" style="fill:var(--text);opacity:.12"/>
      <g class="art-body">
        ${this.kerzo(id, sc)}
      </g>
      ${sc.front ? sc.front(id) : ''}
    </svg>`;
  },

  // Die Figur: Docht oben und unten, goldener Koerper, Gesicht (Augen blinzeln), kleine Arme
  kerzo(id, sc) {
    const ink = '#1d1608';
    const eyes = sc.eyes === 'closed'
      ? `<path d="M85 84q5 5 10 0M105 84q5 5 10 0" stroke="${ink}" stroke-width="3.2"/>`
      : `<g class="art-eyes"><ellipse class="art-eye" cx="90" cy="83" rx="4.6" ry="5.4" fill="${ink}"/><ellipse class="art-eye" cx="110" cy="83" rx="4.6" ry="5.4" fill="${ink}"/>
         <circle cx="${91.5 + (sc.look || 0)}" cy="81" r="1.5" fill="#fff"/><circle cx="${111.5 + (sc.look || 0)}" cy="81" r="1.5" fill="#fff"/></g>`;
    const mouth = sc.mouth === 'o' ? `<ellipse cx="100" cy="99" rx="3.4" ry="4" fill="${ink}"/>`
      : sc.mouth === 'flat' ? `<path d="M94 99h12" stroke="${ink}" stroke-width="3"/>`
      : `<path d="M92 96q8 8 16 0" stroke="${ink}" stroke-width="3.2"/>`;
    return `
      <path d="M100 28v22M100 126v20" style="stroke:var(--accent)" stroke-width="4.5"/>
      <rect x="72" y="50" width="56" height="78" rx="22" fill="url(#${id}g)"/>
      <rect x="72" y="50" width="56" height="78" rx="22" style="stroke:var(--accent-ink);opacity:.18" stroke-width="1.5"/>
      <path d="M82 62q3-6 12-7" stroke="#fff" stroke-width="3.4" opacity=".45"/>
      ${eyes}${mouth}
      <circle cx="79" cy="95" r="5" fill="#ff8f7a" opacity=".35"/><circle cx="121" cy="95" r="5" fill="#ff8f7a" opacity=".35"/>
      ${sc.arms ? sc.arms : '<path d="M72 104q-9 4-11 13M128 104q9 4 11 13" style="stroke:var(--accent)" stroke-width="4.5"/>'}
      <path d="M88 128v10M112 128v10" style="stroke:var(--accent)" stroke-width="4.5"/>`;
  },

  sparkle(x, y, s = 1, d = 0) {
    return `<path class="art-spark" style="animation-delay:${d}s;transform-origin:${x}px ${y}px;fill:var(--accent)" stroke="none" d="M${x} ${y - 7 * s}l${1.8 * s} ${5.2 * s} ${5.2 * s} ${1.8 * s}-${5.2 * s} ${1.8 * s}-${1.8 * s} ${5.2 * s}-${1.8 * s}-${5.2 * s}-${5.2 * s}-${1.8 * s} ${5.2 * s}-${1.8 * s}Z"/>`;
  },

  scenes: {
    hello: {
      arms: '<path d="M72 104q-9 4-11 13" style="stroke:var(--accent)" stroke-width="4.5"/><path class="art-wave" d="M128 102q12-4 14-18" style="stroke:var(--accent)" stroke-width="4.5"/>',
      front: () => Art.sparkle(48, 56, 1.2) + Art.sparkle(156, 44, 0.9, 0.8) + Art.sparkle(152, 120, 0.7, 1.4),
    },
    journal: {
      arms: '<path d="M72 106q-6 8 6 16M128 106q6 8-6 16" style="stroke:var(--accent)" stroke-width="4.5"/>',
      front: () => `<g class="art-prop"><rect x="80" y="108" width="40" height="30" rx="6" style="fill:var(--surface);stroke:var(--accent)" stroke-width="3"/><path d="M100 110v26" style="stroke:var(--accent)" stroke-width="2.4"/><path d="M86 118h9M86 125h9M105 118h9M105 125h7" style="stroke:var(--dim)" stroke-width="2.4"/></g>${Art.sparkle(148, 54, 1, 0.3)}${Art.sparkle(52, 70, 0.8, 1.1)}`,
    },
    search: {
      look: 3,
      mouth: 'o',
      arms: '<path d="M72 104q-9 4-11 13" style="stroke:var(--accent)" stroke-width="4.5"/><path d="M128 106q10 0 16-6" style="stroke:var(--accent)" stroke-width="4.5"/>',
      front: () => `<g class="art-lens"><circle cx="152" cy="86" r="16" style="fill:var(--surface);fill-opacity:.55;stroke:var(--text)" stroke-width="4.5"/><path d="m163 98 11 12" style="stroke:var(--text)" stroke-width="5.5"/><path d="M144 80q3-4 8-4" stroke="#fff" stroke-width="3" opacity=".6"/></g>`,
    },
    stats: {
      back: () => `<g class="art-bars" style="fill:var(--accent)"><rect class="art-bar" style="--d:0s" x="140" y="108" width="14" height="30" rx="5" opacity=".55"/><rect class="art-bar" style="--d:.15s" x="158" y="88" width="14" height="50" rx="5" opacity=".75"/><rect class="art-bar" style="--d:.3s" x="176" y="64" width="14" height="74" rx="5"/></g>`,
      front: () => Art.sparkle(40, 60, 1, 0.2) + Art.sparkle(60, 30, 0.7, 0.9),
    },
    wallet: {
      arms: '<path d="M72 106q-6 8 8 14M128 106q6 8-8 14" style="stroke:var(--accent)" stroke-width="4.5"/>',
      front: () => `<g class="art-prop"><rect x="76" y="112" width="48" height="30" rx="8" style="fill:var(--surface);stroke:var(--accent)" stroke-width="3"/><path d="M76 122h48" style="stroke:var(--accent)" stroke-width="3"/><circle cx="114" cy="132" r="3" style="fill:var(--accent)" stroke="none"/></g>`,
    },
    sun: {
      back: () => `<g class="art-sun"><circle cx="100" cy="120" r="48" style="fill:var(--accent);opacity:.18"/><g style="stroke:var(--accent)" stroke-width="4" opacity=".6"><path d="M100 52v-10M54 70l-7-7M146 70l7-7M38 112H26M162 112h12"/></g></g>`,
      front: () => `<g class="art-pop"><circle cx="150" cy="52" r="15" style="fill:var(--surface);stroke:var(--accent)" stroke-width="3"/><path pathLength="1" class="art-check" d="m143 52 5 5 9-10" style="stroke:var(--accent)" stroke-width="3.4"/></g>`,
    },
    rest: {
      eyes: 'closed',
      mouth: 'flat',
      back: () => `<path d="M40 52a14 14 0 1 0 18 18 11 11 0 0 1-18-18Z" style="fill:var(--accent);opacity:.9" stroke="none"/>`,
      front: () => `<g style="fill:var(--dim)" stroke="none" font-weight="700" font-family="inherit"><text class="art-zzz" style="--d:0s" x="134" y="62" font-size="18">z</text><text class="art-zzz" style="--d:.9s" x="148" y="46" font-size="14">z</text><text class="art-zzz" style="--d:1.8s" x="158" y="32" font-size="11">z</text></g>`,
    },
    oops: {
      mouth: 'flat',
      arms: '<path d="M72 104q-9 4-11 13M128 104q9 4 11 13" style="stroke:var(--accent)" stroke-width="4.5"/>',
      front: () => `<g class="art-pop"><circle cx="146" cy="52" r="15" style="fill:var(--surface);stroke:var(--accent)" stroke-width="3"/><path d="M141 48q0-6 6-6t5 6q0 3-5 5v3" style="stroke:var(--accent)" stroke-width="3"/><circle cx="147" cy="62" r="1.4" style="fill:var(--accent)" stroke="none"/></g>`,
    },
  },
};
