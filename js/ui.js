// Wiederverwendbare Formular-Bausteine
const UI = {
  field(label, node) {
    return App.el('div', { class: 'field' }, [label ? App.el('label', {}, label) : null, node]);
  },

  // Chip-Auswahl (Einzel- oder Mehrfachauswahl). node.get() liefert den Wert.
  chips(options, selected, opts = {}) {
    const multi = !!opts.multi;
    let value = multi ? (selected || []).slice() : (selected || '');
    const group = App.el('div', { class: 'chip-group' });
    const kindOf = opts.kind || (() => '');
    const draw = () => {
      group.innerHTML = '';
      const all = options.slice();
      // Werte, die nicht (mehr) in der Liste stehen, trotzdem anzeigen
      [].concat(value || []).forEach((v) => { if (v && !all.includes(v)) all.push(v); });
      all.forEach((o) => {
        const active = multi ? value.includes(o) : value === o;
        group.appendChild(App.el('button', {
          type: 'button',
          class: 'chip ' + kindOf(o) + (active ? ' active' : ''),
          onclick: () => {
            if (multi) value = value.includes(o) ? value.filter((x) => x !== o) : [...value, o];
            else value = value === o && opts.deselect !== false ? '' : o;
            draw();
            if (opts.onChange) opts.onChange(value);
          },
        }, o));
      });
    };
    draw();
    group.get = () => value;
    return group;
  },

  select(options, value, placeholder = '–') {
    const sel = App.el('select', {}, [App.el('option', { value: '' }, placeholder), ...options.map((o) => App.el('option', { value: o }, o))]);
    if (value && !options.includes(value)) sel.appendChild(App.el('option', { value }, value));
    sel.value = value || '';
    return sel;
  },

  // Bild -> verkleinerter JPEG als Data-URL
  compressImage(file, maxSide = 1400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // Bild-Feld mit Vorschau. node.get() liefert Array von Data-URLs.
  // Bilder lassen sich waehlen, per "Einfügen"-Knopf oder mit Strg/Cmd+V aus der Zwischenablage hinzufuegen.
  imageField(images) {
    let list = (images || []).slice();
    const wrap = App.el('div', { class: 'thumbs' });
    const input = App.el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
    const addFiles = async (files) => {
      let n = 0;
      for (const f of files) {
        try { list.push(await UI.compressImage(f)); n++; } catch (e) { App.toast('Dieses Bild konnte nicht geladen werden.'); }
      }
      if (n) draw();
    };
    input.addEventListener('change', async () => { await addFiles([...input.files]); input.value = ''; });
    wrap.addFiles = addFiles;
    wrap.addEventListener('pointerdown', () => { UI._activeImg = wrap; });
    const pasteBtn = App.el('button', {
      type: 'button', class: 'add-thumb', title: 'Aus Zwischenablage einfügen', html: Icons.copy(),
      onclick: async () => {
        UI._activeImg = wrap;
        try {
          const items = await navigator.clipboard.read();
          const files = [];
          for (const it of items) {
            const type = it.types.find((t) => t.startsWith('image/'));
            if (type) files.push(new File([await it.getType(type)], 'paste.png', { type }));
          }
          if (files.length) await addFiles(files); else App.toast('Keine Grafik in der Zwischenablage.');
        } catch (e) { App.toast('Einfügen nicht erlaubt – nutze Strg+V oder die Auswahl.'); }
      },
    });
    const draw = () => {
      wrap.innerHTML = '';
      list.forEach((src, i) => {
        wrap.appendChild(App.el('div', { class: 'thumb', onclick: () => UI.lightbox(list, i) }, [
          App.el('img', { src, alt: '' }),
          App.el('button', { type: 'button', class: 'x', html: Icons.close(), onclick: (e) => { e.stopPropagation(); list.splice(i, 1); draw(); } }),
        ]));
      });
      wrap.appendChild(App.el('button', { type: 'button', class: 'add-thumb', html: Icons.plus(), onclick: () => input.click() }));
      wrap.appendChild(pasteBtn);
      wrap.appendChild(input);
    };
    draw();
    wrap.get = () => list;
    return wrap;
  },

  // Vollbild-Ansicht; bei mehreren Bildern mit Wischen / Pfeiltasten
  lightbox(src, start = 0) {
    const list = Array.isArray(src) ? src : [src];
    let i = Math.max(0, Math.min(list.length - 1, start));
    const img = App.el('img', { alt: '' });
    const counter = App.el('div', { class: 'lb-count' });
    const show = (dir) => {
      img.style.animation = 'none'; img.offsetWidth; // Animation neu starten
      img.style.animation = dir ? `${dir > 0 ? 'lbNext' : 'lbPrev'} .35s var(--ease) both` : '';
      img.src = list[i];
      counter.textContent = list.length > 1 ? `${i + 1} / ${list.length}` : '';
    };
    const go = (d) => { if (list.length < 2) return; i = (i + d + list.length) % list.length; show(d); };
    const close = () => { document.removeEventListener('keydown', onKey); box.remove(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
    let x0 = null;
    const box = App.el('div', { class: 'lightbox' }, [
      img, counter,
      App.el('button', { class: 'round-btn lb-x', html: Icons.close(), onclick: (e) => { e.stopPropagation(); close(); } }),
      list.length > 1 ? App.el('button', { class: 'round-btn lb-prev', html: Icons.chevronLeft(), onclick: (e) => { e.stopPropagation(); go(-1); } }) : null,
      list.length > 1 ? App.el('button', { class: 'round-btn lb-next', html: Icons.chevronRight(), onclick: (e) => { e.stopPropagation(); go(1); } }) : null,
    ]);
    box.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    box.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      else if (e.target === box) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    show(0);
  },

  imageViewer(images) {
    return App.el('div', {}, (images || []).map((src, i) => App.el('img', { class: 'img-big', src, alt: '', onclick: () => UI.lightbox(images, i) })));
  },

  // Sortierbare Liste per Ziehen am Griff. opts: { item, handle, onDone(elements) }
  sortable(container, opts) {
    container.addEventListener('pointerdown', (e) => {
      const h = e.target.closest(opts.handle);
      if (!h || !container.contains(h)) return;
      const item = h.closest(opts.item);
      if (!item || item.parentElement !== container) return;
      e.preventDefault();
      try { h.setPointerCapture(e.pointerId); } catch (err) {}
      item.classList.add('dragging');
      const move = (ev) => {
        const y = ev.clientY;
        const sibs = [...container.children].filter((c) => c !== item && c.matches(opts.item));
        const next = sibs.find((s) => { const r = s.getBoundingClientRect(); return y < r.top + r.height / 2; });
        if (next) { if (item.nextElementSibling !== next) container.insertBefore(item, next); }
        else if (container.lastElementChild !== item) container.appendChild(item);
      };
      const up = () => {
        h.removeEventListener('pointermove', move);
        h.removeEventListener('pointerup', up);
        h.removeEventListener('pointercancel', up);
        item.classList.remove('dragging');
        opts.onDone([...container.children].filter((c) => c.matches(opts.item)));
      };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });
  },

  // Zaehlt abgehakte Punkte einer Checklisten-Struktur (rekursiv)
  countChecks(doc) {
    const walk = (items) => items.reduce((a, it) => {
      const c = walk(it.children || []);
      return { done: a.done + (it.checked ? 1 : 0) + c.done, total: a.total + 1 + c.total };
    }, { done: 0, total: 0 });
    return (doc.sections || []).reduce((a, s) => { const c = walk(s.items); return { done: a.done + c.done, total: a.total + c.total }; }, { done: 0, total: 0 });
  },

  resetChecks(doc) {
    const walk = (items) => items.forEach((i) => { i.checked = false; walk(i.children || []); });
    (doc.sections || []).forEach((s) => walk(s.items));
  },

  pill(text, kind = '') {
    return App.el('span', { class: 'pill ' + kind }, text);
  },

  outcomeKind(t) {
    const o = Calc.outcome(t);
    return o === 'win' ? 'win' : o === 'loss' ? 'loss' : o === 'be' ? 'be' : o === 'tape' ? 'neutral' : 'neutral';
  },

  // Rekursive Checkliste. doc = { key, sections:[{title, items:[{id,text,checked,children}]}] }
  checklist(doc, opts = {}) {
    const wrap = App.el('div');
    let editMode = false;
    const save = () => DB.put('checklists', doc);

    const countAll = (items) => items.reduce((acc, it) => {
      const c = countAll(it.children || []);
      return { done: acc.done + (it.checked ? 1 : 0) + c.done, total: acc.total + 1 + c.total };
    }, { done: 0, total: 0 });

    const progressNode = App.el('div', { class: 'card' });
    const cnt = App.el('div', { class: 'tag' });
    const bar = App.el('div', { class: 'progress' }, [App.el('i')]);
    progressNode.append(App.el('div', { class: 'row between', style: 'margin-bottom:12px' }, [App.el('div', { class: 'item-title' }, opts.progressLabel || 'Fortschritt'), cnt]), bar);
    const updateProgress = () => {
      const t = doc.sections.reduce((acc, s) => { const c = countAll(s.items); return { done: acc.done + c.done, total: acc.total + c.total }; }, { done: 0, total: 0 });
      cnt.textContent = `${t.done} / ${t.total}`;
      App.fill(bar.firstChild, t.total ? t.done / t.total : 0);
    };

    const renderItems = (items, parentList, container) => {
      if (editMode) {
        UI.sortable(container, { item: '.cl-group', handle: '.grip', onDone: (els) => {
          parentList.splice(0, parentList.length, ...els.map((g) => g._item));
          save();
        } });
      }
      items.forEach((it) => {
        const group = App.el('div', { class: 'cl-group' });
        group._item = it;
        const row = App.el('div', { class: 'cl-item' + (it.checked ? ' done' : '') });
        const cb = App.el('button', {
          class: 'checkbox' + (it.checked ? ' checked' : ''), html: Icons.check(),
          onclick: (e) => {
            it.checked = !it.checked;
            const btn = e.currentTarget;
            btn.classList.toggle('checked', it.checked);
            if (it.checked) { btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 650); }
            row.classList.toggle('done', it.checked);
            save(); updateProgress();
          },
        });
        if (editMode) row.appendChild(App.el('button', { class: 'grip', 'aria-label': 'Verschieben', html: Icons.grip() }));
        row.appendChild(cb);
        if (editMode) {
          const inp = App.el('input', { type: 'text', value: it.text });
          inp.addEventListener('change', () => { it.text = inp.value; save(); });
          row.appendChild(App.el('div', { class: 'grow' }, [inp]));
          row.appendChild(App.el('button', { class: 'icon-btn', title: 'Unterpunkt', html: Icons.plus(), onclick: () => { (it.children = it.children || []).push({ id: DB.uid(), text: '', checked: false, children: [] }); save(); draw(); } }));
          row.appendChild(App.el('button', { class: 'icon-btn del', html: Icons.trash(), onclick: () => { parentList.splice(parentList.indexOf(it), 1); save(); draw(); } }));
        } else {
          row.appendChild(App.el('div', { class: 'txt' }, it.text));
        }
        group.appendChild(row);
        if (it.children && it.children.length) {
          const kids = App.el('div', { class: 'cl-children' });
          renderItems(it.children, it.children, kids);
          group.appendChild(kids);
        }
        container.appendChild(group);
      });
    };

    const draw = () => {
      wrap.innerHTML = '';
      updateProgress();
      wrap.appendChild(progressNode);
      doc.sections.forEach((sec) => {
        const card = App.el('div', { class: 'card' });
        if (sec.title || editMode) {
          const titleRow = App.el('div', { class: 'cl-title' });
          if (editMode) {
            const ti = App.el('input', { type: 'text', value: sec.title || '', placeholder: 'Abschnitt' });
            ti.addEventListener('change', () => { sec.title = ti.value; save(); });
            titleRow.appendChild(App.el('div', { class: 'grow' }, [ti]));
            titleRow.appendChild(App.el('button', { class: 'icon-btn del', html: Icons.trash(), onclick: async () => { if (await App.confirm('Abschnitt löschen?')) { doc.sections.splice(doc.sections.indexOf(sec), 1); save(); draw(); } } }));
          } else titleRow.appendChild(App.el('span', {}, sec.title));
          card.appendChild(titleRow);
        }
        renderItems(sec.items, sec.items, card);
        if (!sec.items.length && !editMode) card.appendChild(App.el('div', { class: 'tag' }, 'Noch keine Punkte – im Bearbeiten-Modus hinzufügen.'));
        if (editMode) {
          card.appendChild(App.el('button', { class: 'add-line', onclick: () => { sec.items.push({ id: DB.uid(), text: '', checked: false, children: [] }); save(); draw(); } }, '+ Punkt hinzufügen'));
        }
        wrap.appendChild(card);
      });
      if (editMode && opts.multiSection !== false) {
        wrap.appendChild(App.el('button', { class: 'btn secondary', style: 'margin-bottom:10px', onclick: () => { doc.sections.push({ title: 'Neuer Abschnitt', items: [] }); save(); draw(); } }, '+ Abschnitt'));
      }
      const resetAll = (items) => items.forEach((i) => { i.checked = false; resetAll(i.children || []); });
      wrap.appendChild(App.el('div', { class: 'btn-row' }, [
        App.el('button', { class: 'btn secondary', onclick: () => { editMode = !editMode; draw(); } }, [App.icon('edit'), editMode ? 'Fertig' : 'Bearbeiten']),
        App.el('button', { class: 'btn secondary', onclick: () => { doc.sections.forEach((s) => resetAll(s.items)); save(); draw(); } }, 'Alle zurücksetzen'),
      ]));
    };
    draw();
    return wrap;
  },
};

// Strg/Cmd+V: Bild aus der Zwischenablage in das zuletzt benutzte Bild-Feld einfuegen
document.addEventListener('paste', (e) => {
  const field = UI._activeImg;
  if (!field || !document.body.contains(field) || !e.clipboardData) return;
  const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  field.addFiles(files);
});
