// Supabase-Sync (nur fetch, keine Abhaengigkeiten). Lokal bleibt IndexedDB der Hauptspeicher (offline-faehig),
// Supabase ist der Abgleich zwischen Geraeten. Konflikte: letzte Aenderung pro Datensatz gewinnt.
const SYNC_STORES = DB_STORES;

const Sync = {
  running: false,
  timer: null,
  last: null,
  error: '',
  info: '',

  // ---------- Konfiguration & Session ----------
  config() {
    const d = window.SUPABASE_CONFIG || {};
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('sb_cfg') || '{}'); } catch (e) {}
    const url = (d.url || saved.url || '').replace(/\/+$/, '');
    return { url, anonKey: d.anonKey || saved.anonKey || '', fromFile: !!(d.url && d.anonKey) };
  },
  saveConfig(url, anonKey) {
    localStorage.setItem('sb_cfg', JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
  },
  configured() { const c = this.config(); return !!(c.url && c.anonKey); },

  session() { try { return JSON.parse(localStorage.getItem('sb_session') || 'null'); } catch (e) { return null; } },
  setSession(s) {
    if (s) {
      const expiresAt = s.expires_at ? s.expires_at * 1000 : Date.now() + (s.expires_in || 3600) * 1000;
      localStorage.setItem('sb_session', JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, expiresAt, user: s.user }));
    } else localStorage.removeItem('sb_session');
  },
  loggedIn() { return !!this.session(); },
  email() { const s = this.session(); return s && s.user ? s.user.email : ''; },

  // ---------- HTTP ----------
  async http(path, opts = {}, token) {
    const c = this.config();
    const headers = { apikey: c.anonKey, 'Content-Type': 'application/json', ...(opts.headers || {}) };
    headers.Authorization = 'Bearer ' + (token || c.anonKey);
    const res = await fetch(c.url + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || res.statusText;
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return data;
  },

  async signIn(email, password) {
    const data = await this.http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    this.setSession(data);
  },

  async signUp(email, password) {
    const data = await this.http('/auth/v1/signup', { method: 'POST', body: { email, password } });
    if (data && data.access_token) { this.setSession(data); return 'in'; }
    return 'confirm';
  },

  signOut() {
    this.setSession(null); this.last = null;
    try { if (this.rt.ws) this.rt.ws.close(); } catch (e) {}
  },

  async token() {
    const s = this.session();
    if (!s) throw new Error('Nicht angemeldet');
    if (s.expiresAt - 60000 > Date.now()) return s.access_token;
    const data = await this.http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } });
    this.setSession(data);
    return data.access_token;
  },

  // ---------- Status ----------
  state: 'off',
  setStatus(s) {
    this.state = s;
    if (typeof App !== 'undefined' && App.onSyncStatus) App.onSyncStatus(s);
  },

  // ---------- Konto: Passwort zuruecksetzen, Cloud-Daten loeschen ----------
  async recover(email) {
    await this.http('/auth/v1/recover', { method: 'POST', body: { email, redirect_to: location.origin + location.pathname } });
  },

  // Aus dem Link der Reset-Mail: #access_token=...&type=recovery
  recoveryFromHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    return h.get('type') === 'recovery' && h.get('access_token') ? { token: h.get('access_token') } : null;
  },

  async setPassword(token, password) {
    await this.http('/auth/v1/user', { method: 'PUT', body: { password } }, token);
  },

  async deleteCloudData() {
    const token = await this.token();
    const uid = this.session().user.id;
    await this.http('/rest/v1/journal_data?user_id=eq.' + uid, { method: 'DELETE' }, token);
    // lokale Sync-Markierungen zuruecksetzen, damit ein spaeterer Abgleich wieder alles hochlaedt
    for (const s of DB_STORES) {
      for (const it of await DB.getAll(s)) { if (it._s !== undefined) { const { _s, ...rest } = it; await DB.putRaw(s, rest); } }
    }
    await DB.putRaw('settings', { key: '_pullCursor', value: '' });
    await DB.putRaw('settings', { key: '_tomb', value: [] });
    this._pushedOnce = false; DB._dirty = true;
  },

  // ---------- Abgleich ----------
  schedule() {
    if (!this.configured() || !this.loggedIn()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), 2500);
  },

  start() {
    DB.onChange = () => this.schedule();
    window.addEventListener('online', () => { this.run(); this.realtimeStart(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { this.run(); this.realtimeStart(); } });
    // Fallback, falls Realtime nicht verbunden ist
    setInterval(() => { if (document.visibilityState === 'visible' && this.rt.status !== 'ok') this.run({ quiet: true }); }, 60000);
    this.run();
  },

  // ---------- Realtime (Aenderungen anderer Geraete erscheinen sofort) ----------
  rt: { ws: null, status: 'off', retry: 0, hb: null, timer: null },

  realtimeStart() {
    if (!this.configured() || !this.loggedIn() || !('WebSocket' in window)) return;
    const rt = this.rt;
    if (rt.ws && rt.ws.readyState <= 1) return;
    const c = this.config();
    let ws;
    try { ws = new WebSocket(c.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(c.anonKey) + '&vsn=1.0.0'); } catch (e) { return; }
    rt.ws = ws; rt.status = 'connecting';
    let n = 1;
    const send = (o) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} };
    const topic = 'realtime:journal-' + (this.session().user.id || '').slice(0, 8);
    ws.onopen = async () => {
      const token = await this.token().catch(() => null);
      if (!token) { ws.close(); return; }
      send({ topic, event: 'phx_join', ref: String(n), join_ref: String(n), payload: { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table: 'journal_data' }] }, access_token: token } });
      let beats = 0;
      rt.hb = setInterval(async () => {
        send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++n) });
        if (++beats % 20 === 0) { const t = await this.token().catch(() => null); if (t) send({ topic, event: 'access_token', payload: { access_token: t }, ref: String(++n) }); }
      }, 25000);
    };
    ws.onmessage = (m) => {
      let d; try { d = JSON.parse(m.data); } catch (e) { return; }
      if (d.event === 'phx_reply' && d.topic === topic) {
        rt.status = d.payload && d.payload.status === 'ok' ? 'ok' : 'error';
        if (rt.status === 'ok') rt.retry = 0;
      } else if (d.event === 'postgres_changes') {
        clearTimeout(rt.timer);
        rt.timer = setTimeout(() => this.run(), 350);
      } else if (d.event === 'phx_error' || d.event === 'phx_close') rt.status = 'error';
    };
    ws.onclose = () => {
      clearInterval(rt.hb);
      if (rt.ws === ws) { rt.ws = null; rt.status = 'off'; }
      if (this.configured() && this.loggedIn()) {
        const wait = Math.min(30000, 1500 * Math.pow(2, rt.retry++));
        setTimeout(() => this.realtimeStart(), wait);
      }
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  },

  async run(opts = {}) {
    if (this.running) { this._again = true; return { skipped: true }; }
    if (!this.configured() || !this.loggedIn()) return { skipped: true };
    this.realtimeStart();
    if (!navigator.onLine) { this.error = 'Offline – Abgleich folgt, sobald du wieder online bist.'; return { skipped: true }; }
    this.running = true;
    this.error = '';
    let pulled = 0, pushed = 0;
    try {
      const token = await this.token();
      const uid = this.session().user.id;
      pulled = await this.pull(token);
      pushed = await this.push(token, uid);
      this.last = Date.now();
      localStorage.setItem('sb_last', String(this.last));
      this.info = `↓ ${pulled} · ↑ ${pushed}`;
      this.setStatus('ok');
      if (pulled > 0) {
        await Options.load();
        if (!App.stack.length && !App._modal && !opts.noRefresh) App.refresh();
      }
    } catch (e) {
      this.error = e.status === 401 ? 'Anmeldung abgelaufen – bitte neu anmelden.' : e.message;
      if (e.status === 401) this.setSession(null);
      this.setStatus('error');
    } finally {
      this.running = false;
      if (this._again) { this._again = false; setTimeout(() => this.run(), 400); }
    }
    return { pulled, pushed, error: this.error };
  },

  async pull(token) {
    const cursor = await DB.getSetting('_pullCursor', '');
    let maxSeen = cursor, applied = 0, offset = 0;
    const tomb = await DB.getSetting('_tomb', []);
    const since = cursor ? `&synced_at=gt.${encodeURIComponent(cursor)}` : '';
    for (;;) {
      const rows = await this.http(`/rest/v1/journal_data?select=store,id,data,deleted,updated_at,synced_at&order=synced_at.asc${since}&limit=200&offset=${offset}`, {}, token);
      if (!rows.length) break;
      for (const row of rows) {
        if (row.synced_at > maxSeen) maxSeen = row.synced_at;
        if (!SYNC_STORES.includes(row.store)) continue;
        const keyField = DB_ID_STORES.includes(row.store) ? 'id' : 'key';
        const local = await DB.get(row.store, row.id);
        const localU = local ? (local._u || 0) : 0;
        const t = tomb.find((x) => x.store === row.store && x.id === row.id);
        if (t && t.u >= row.updated_at) continue; // lokal geloescht & neuer
        if (row.updated_at <= localU) continue;   // lokale Version ist neuer/gleich
        if (row.deleted) {
          if (local) { await DB.delete_raw(row.store, row.id); applied++; }
        } else if (row.data) {
          const obj = { ...row.data, [keyField]: row.id, _u: row.updated_at, _s: row.updated_at };
          await DB.putRaw(row.store, obj);
          applied++;
        }
      }
      if (rows.length < 200) break;
      offset += 200;
    }
    await DB.putRaw('settings', { key: '_pullCursor', value: maxSeen });
    return applied;
  },

  // Nur lesen/senden, wenn sich lokal etwas geaendert hat (spart bei vielen Screenshots viel Arbeit)
  async push(token, uid) {
    if (!DB._dirty && this._pushedOnce) return 0;
    DB._dirty = false;
    try {
      const n = await this._push(token, uid);
      this._pushedOnce = true;
      return n;
    } catch (e) { DB._dirty = true; throw e; }
  },

  async _push(token, uid) {
    const rows = [];
    const marks = [];
    for (const store of SYNC_STORES) {
      const items = await DB.getAll(store);
      for (const it of items) {
        if (!DB.syncable(store, it)) continue;
        const u = it._u === undefined ? 1 : it._u;
        if (u <= (it._s || 0)) continue;
        const id = DB_ID_STORES.includes(store) ? it.id : it.key;
        const { _s, ...data } = it;
        rows.push({ user_id: uid, store, id, data: { ...data, _u: u }, deleted: false, updated_at: u });
        marks.push({ store, item: it, u });
      }
    }
    const tomb = await DB.getSetting('_tomb', []);
    tomb.forEach((t) => rows.push({ user_id: uid, store: t.store, id: t.id, data: null, deleted: true, updated_at: t.u }));

    for (let i = 0; i < rows.length; i += 15) {
      const chunk = rows.slice(i, i + 15);
      await this.http('/rest/v1/journal_data?on_conflict=user_id,store,id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: chunk,
      }, token);
    }
    for (const m of marks) {
      const fresh = await DB.get(m.store, DB_ID_STORES.includes(m.store) ? m.item.id : m.item.key);
      if (fresh && (fresh._u === undefined ? 1 : fresh._u) === m.u) await DB.putRaw(m.store, { ...fresh, _s: m.u });
    }
    if (tomb.length) {
      const now = await DB.getSetting('_tomb', []);
      const sent = new Set(tomb.map((t) => t.store + '|' + t.id + '|' + t.u));
      await DB.putRaw('settings', { key: '_tomb', value: now.filter((t) => !sent.has(t.store + '|' + t.id + '|' + t.u)) });
    }
    return rows.length;
  },
};
