const DB_NAME = 'trading-journal-db';
const DB_VERSION = 1;
const DB_STORES = ['trades', 'analyses', 'collections', 'checklists', 'weeks', 'settings'];

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const dbPromise = openDB();

const DB = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  async getAll(storeName) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
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
    if (storeName === 'settings') return !!obj && obj.key === 'options';
    return DB_STORES.includes(storeName);
  },

  // Schreiben ohne Sync-Stempel (Seed, Daten aus der Cloud)
  async putRaw(storeName, obj) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(obj);
      tx.oncomplete = () => resolve(obj);
      tx.onerror = () => reject(tx.error);
    });
  },

  async put(storeName, obj) {
    const sync = this.syncable(storeName, obj);
    if (sync) obj._u = Date.now();
    await this.putRaw(storeName, obj);
    if (sync && this.onChange) this.onChange();
    return obj;
  },

  async putMany(storeName, items) {
    const db = await dbPromise;
    const stamp = Date.now();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach((it) => { if (this.syncable(storeName, it)) it._u = stamp; store.put(it); });
      tx.oncomplete = () => resolve(items);
      tx.onerror = () => reject(tx.error);
    });
    if (this.onChange) this.onChange();
    return items;
  },

  // Loeschen ohne Tombstone (wenn die Loeschung aus der Cloud kommt)
  async delete_raw(storeName, key) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(storeName, key) {
    const db = await dbPromise;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (this.syncable(storeName, { key })) {
      const tomb = await this.getSetting('_tomb', []);
      tomb.push({ store: storeName, id: key, u: Date.now() });
      await this.putRaw('settings', { key: '_tomb', value: tomb });
      if (this.onChange) this.onChange();
    }
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
