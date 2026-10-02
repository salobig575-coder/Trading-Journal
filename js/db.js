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

  async put(storeName, obj) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(obj);
      tx.oncomplete = () => resolve(obj);
      tx.onerror = () => reject(tx.error);
    });
  },

  async putMany(storeName, items) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach((it) => store.put(it));
      tx.oncomplete = () => resolve(items);
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(storeName, key) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
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
