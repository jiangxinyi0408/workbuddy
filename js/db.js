// ============================================================
// db.js - IndexedDB \u5c01\u88c5
// ============================================================

const DB_NAME = 'WorkBuddyDB';
const DB_VERSION = 2;

// \u6570\u636e\u5e93 store \u5b9a\u4e49
const STORES = {
  tasks: { keyPath: 'id', indexes: ['dueDate', 'status', 'type'] },
  workLogs: { keyPath: 'id', indexes: ['date'] },
  pingpongSessions: { keyPath: 'id', indexes: ['date'] },
  freeActivities: { keyPath: 'id', indexes: ['date'] },
  englishProgress: { keyPath: 'id', indexes: ['date', 'type'] },
  englishFavorites: { keyPath: 'id', indexes: ['type'] },
  aiProgress: { keyPath: 'id', indexes: ['date'] },
  aiNotes: { keyPath: 'id', indexes: ['date'] },
  weights: { keyPath: 'id', indexes: ['date', 'time'] },
  meals: { keyPath: 'id', indexes: ['date', 'mealType'] },
  loans: { keyPath: 'id', indexes: ['bank'] },
  incomes: { keyPath: 'id', indexes: ['month'] },
  repayments: { keyPath: 'id', indexes: ['loanId', 'month'] },
  newsCache: { keyPath: 'id' },
  settings: { keyPath: 'key' },
};

let dbInstance = null;

/** \u6253\u5f00\u6570\u636e\u5e93 */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, config] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: config.keyPath });
          (config.indexes || []).forEach(idx => {
            store.createIndex(idx, idx, { unique: false });
          });
        }
      }
    };
    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/** \u6dfb\u52a0/\u66f4\u65b0\u8bb0\u5f55 */
export async function put(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => {
      resolve(data);
      // \u89e6\u53d1\u4e91\u540c\u6b65（\u9632\u6296）
      try { import('./sync.js').then(m => m.scheduleAutoSync()).catch(() => {}); } catch (e) {}
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** \u6279\u91cf\u6dfb\u52a0 */
export async function bulkPut(storeName, dataList) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    dataList.forEach(d => store.put(d));
    tx.oncomplete = () => {
      resolve(dataList);
      // \u89e6\u53d1\u4e91\u540c\u6b65（\u9632\u6296）
      try { import('./sync.js').then(m => m.scheduleAutoSync()).catch(() => {}); } catch (e) {}
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** \u83b7\u53d6\u5355\u6761 */
export async function get(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** \u83b7\u53d6\u5168\u90e8 */
export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      // store \u4e0d\u5b58\u5728\u65f6\u8fd4\u56de\u7a7a\u6570\u7ec4
      resolve([]);
    }
  });
}

/** \u6309\u7d22\u5f15\u67e5\u8be2 */
export async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      resolve([]);
    }
  });
}

/** \u6309\u7d22\u5f15\u8303\u56f4\u67e5\u8be2 */
export async function getByRange(storeName, indexName, lower, upper) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index(indexName);
      const range = IDBKeyRange.bound(lower, upper);
      const req = index.getAll(range);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      resolve([]);
    }
  });
}

/** \u5220\u9664\u8bb0\u5f55 */
export async function del(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => {
      resolve(true);
      try { import('./sync.js').then(m => m.scheduleAutoSync()).catch(() => {}); } catch (e) {}
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** \u6e05\u7a7a store */
export async function clear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/** \u8bbe\u7f6e\u9879 */
export async function setSetting(key, value) {
  return put('settings', { key, value });
}

/** \u83b7\u53d6\u8bbe\u7f6e\u9879 */
export async function getSetting(key, defaultVal = null) {
  const row = await get('settings', key);
  return row ? row.value : defaultVal;
}

/** \u7edf\u8ba1 store \u8bb0\u5f55\u6570 */
export async function count(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      resolve(0);
    }
  });
}
