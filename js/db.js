const DB_NAME = 'trading-journal-db';
const DB_VERSION = 2;
const DB_STORES = ['trades', 'analyses', 'collections', 'checklists', 'weeks', 'settings', 'habits', 'habitLogs'];
// Stores mit "id" als Schluessel (alle anderen nutzen "key")
const DB_ID_STORES = ['trades', 'analyses', 'collections', 'habits', 'habitLogs'];
// Einstellungen, die mit der Cloud abgeglichen werden
const DB_SYNC_SETTINGS = ['options', 'habitSettings', 'riskRules', 'onboarded'];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('trades')) {
        const s = db.createObjectStore('trades', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('analyses')) {
        const s = db.createObjectStore('analyses', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('collections')) {
        const s = db.createObjectStore('collections', { keyPath: 'id' });
        s.createIndex('kind', 'kind');
      }
      if (!db.objectStoreNames.contains('checklists')) db.createObjectStore('checklists', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('weeks')) db.createObjectStore('weeks', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('habits')) db.createObjectStore('habits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('habitLogs')) {
        const s = db.createObjectStore('habitLogs', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
    };
    let blockedTimer = null;
    req.onsuccess = () => {
      clearTimeout(blockedTimer);
      const db = req.result;
      // Aeltere offene Tabs/App-Fenster geben die DB frei, wenn eine neue Version startet
      db.onversionchange = () => { db.close(); location.reload(); };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      // Ein altes Fenster haelt noch die alte DB-Version offen
      blockedTimer = setTimeout(() => { try { document.body.innerHTML = '<p style="font:15px sans-serif;padding:40px;text-align:center;color:#999">Bitte schließe andere Fenster dieser App und lade neu.</p>'; } catch (e) {} }, 8000);
    };
  });
}

const dbPromise = openDB();

const DB_CACHED = ['trades', 'analyses', 'collections', 'habitLogs', 'habits'];

const DB = {
  _cache: {},
  _dirty: true,

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  // Lese-Cache: haeufig gelesene Stores werden bis zur naechsten Aenderung im Speicher gehalten
  async getAll(storeName) {
    if (DB_CACHED.includes(storeName) && this._cache[storeName]) return this._cache[storeName].slice();
    const db = await dbPromise;
    const rows = await new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (DB_CACHED.includes(storeName)) this._cache[storeName] = rows;
    return rows.slice();
  },

  async get(storeName, key) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // Welche Datensaetze werden mit Supabase synchronisiert?
  syncable(storeName, obj) {
    if (storeName === 'settings') return !!obj && DB_SYNC_SETTINGS.includes(obj.key);
    return DB_STORES.includes(storeName);
  },

  // Schreiben ohne Sync-Stempel (Seed, Daten aus der Cloud)
  async putRaw(storeName, obj) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      this._cache[storeName] = null;
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(obj);
      tx.oncomplete = () => { this._cache[storeName] = null; resolve(obj); };
      tx.onerror = () => reject(tx.error);
    });
  },

  async put(storeName, obj) {
    const sync = this.syncable(storeName, obj);
    if (sync) { obj._u = Date.now(); this._dirty = true; }
    await this.putRaw(storeName, obj);
    if (sync && this.onChange) this.onChange();
    return obj;
  },

  async putMany(storeName, items) {
    const db = await dbPromise;
    const stamp = Date.now();
    this._cache[storeName] = null;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach((it) => { if (this.syncable(storeName, it)) it._u = stamp; store.put(it); });
      tx.oncomplete = () => { this._cache[storeName] = null; resolve(items); };
      tx.onerror = () => reject(tx.error);
    });
    this._dirty = true;
    if (this.onChange) this.onChange();
    return items;
  },

  // Loeschen ohne Tombstone (wenn die Loeschung aus der Cloud kommt)
  async delete_raw(storeName, key) {
    const db = await dbPromise;
    this._cache[storeName] = null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => { this._cache[storeName] = null; resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(storeName, key) {
    const db = await dbPromise;
    this._cache[storeName] = null;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => { this._cache[storeName] = null; resolve(); };
      tx.onerror = () => reject(tx.error);
    });
    if (this.syncable(storeName, { key })) {
      const tomb = await this.getSetting('_tomb', []);
      tomb.push({ store: storeName, id: key, u: Date.now() });
      await this.putRaw('settings', { key: '_tomb', value: tomb });
      this._dirty = true;
      if (this.onChange) this.onChange();
    }
  },

  // Rueckgaengig nach dem Loeschen: Tombstone entfernen und Datensatz neu speichern
  async restore(storeName, obj) {
    const key = DB_ID_STORES.includes(storeName) ? obj.id : obj.key;
    const tomb = (await this.getSetting('_tomb', [])).filter((t) => !(t.store === storeName && t.id === key));
    await this.putRaw('settings', { key: '_tomb', value: tomb });
    return this.put(storeName, obj);
  },

  // Alle lokalen Daten entfernen (Einstellungen zum Konto/Theme bleiben nicht erhalten)
  async wipeLocal() {
    const db = await dbPromise;
    for (const s of DB_STORES) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(s, 'readwrite');
        tx.objectStore(s).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    this._cache = {};
    this._dirty = true;
  },

  async getSetting(key, fallback) {
    const row = await this.get('settings', key);
    return row && row.value !== undefined ? row.value : fallback;
  },

  setSetting(key, value) {
    return this.put('settings', { key, value });
  },

  async exportAll() {
    const data = {};
    for (const s of DB_STORES) data[s] = await this.getAll(s);
    return { app: 'trading-journal', exportedAt: new Date().toISOString(), data };
  },

  async importAll(payload) {
    const db = await dbPromise;
    for (const s of Object.keys(payload.data || {})) {
      if (!db.objectStoreNames.contains(s)) continue;
      await this.putMany(s, payload.data[s]);
    }
  },
};
