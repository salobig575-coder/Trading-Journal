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
  imageField(images) {
    let list = (images || []).slice();
    const wrap = App.el('div', { class: 'thumbs' });
    const input = App.el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
    input.addEventListener('change', async () => {
      for (const f of input.files) {
        try { list.push(await UI.compressImage(f)); } catch (e) { App.toast('Dieses Bild konnte nicht geladen werden.'); }
      }
      input.value = '';
      draw();
    });
    const draw = () => {
      wrap.innerHTML = '';
      list.forEach((src, i) => {
        wrap.appendChild(App.el('div', { class: 'thumb', onclick: () => UI.lightbox(src) }, [
          App.el('img', { src, alt: '' }),
          App.el('button', { type: 'button', class: 'x', html: Icons.close(), onclick: (e) => { e.stopPropagation(); list.splice(i, 1); draw(); } }),
        ]));
      });
      wrap.appendChild(App.el('button', { type: 'button', class: 'add-thumb', html: Icons.plus(), onclick: () => input.click() }));
      wrap.appendChild(input);
    };
    draw();
    wrap.get = () => list;
    return wrap;
  },

  lightbox(src) {
    const box = App.el('div', { class: 'lightbox', onclick: () => box.remove() }, [App.el('img', { src, alt: '' })]);
    document.body.appendChild(box);
  },

  imageViewer(images) {
    return App.el('div', {}, (images || []).map((src) => App.el('img', { class: 'img-big', src, alt: '', onclick: () => UI.lightbox(src) })));
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
      requestAnimationFrame(() => { bar.firstChild.style.width = (t.total ? (t.done / t.total) * 100 : 0) + '%'; });
    };

    const renderItems = (items, parentList, container) => {
      items.forEach((it) => {
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
        container.appendChild(row);
        if (it.children && it.children.length) {
          const kids = App.el('div', { class: 'cl-children' });
          renderItems(it.children, it.children, kids);
          container.appendChild(kids);
        }
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
