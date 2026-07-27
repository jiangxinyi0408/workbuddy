// ============================================================
// db.js - IndexedDB 封装
// ============================================================

const DB_NAME = 'WorkBuddyDB';
const DB_VERSION = 1;

// 数据库 store 定义
const STORES = {
  tasks: { keyPath: 'id', indexes: ['dueDate', 'status', 'type'] },
  workLogs: { keyPath: 'id', indexes: ['date'] },
  pingpongSessions: { keyPath: 'id', indexes: ['date'] },
  englishProgress: { keyPath: 'id', indexes: ['date', 'type'] },
  weights: { keyPath: 'id', indexes: ['date', 'time'] },
  meals: { keyPath: 'id', indexes: ['date', 'mealType'] },
  loans: { keyPath: 'id', indexes: ['bank'] },
  incomes: { keyPath: 'id', indexes: ['month'] },
  repayments: { keyPath: 'id', indexes: ['loanId', 'month'] },
  newsCache: { keyPath: 'id' },
  settings: { keyPath: 'key' },
};

let dbInstance = null;

/** 打开数据库 */
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

/** 添加/更新记录 */
export async function put(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(tx.error);
  });
}

/** 批量添加 */
export async function bulkPut(storeName, dataList) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    dataList.forEach(d => store.put(d));
    tx.oncomplete = () => resolve(dataList);
    tx.onerror = () => reject(tx.error);
  });
}

/** 获取单条 */
export async function get(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 获取全部 */
export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      // store 不存在时返回空数组
      resolve([]);
    }
  });
}

/** 按索引查询 */
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

/** 按索引范围查询 */
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

/** 删除记录 */
export async function del(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/** 清空 store */
export async function clear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/** 设置项 */
export async function setSetting(key, value) {
  return put('settings', { key, value });
}

/** 获取设置项 */
export async function getSetting(key, defaultVal = null) {
  const row = await get('settings', key);
  return row ? row.value : defaultVal;
}

/** 统计 store 记录数 */
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
