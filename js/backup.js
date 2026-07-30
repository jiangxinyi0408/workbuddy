// ============================================================
// backup.js - \u6570\u636e\u5907\u4efd\u4e0e\u6062\u590d（\u9632 iOS Safari \u6e05\u7a7a IndexedDB）
// \u7b56\u7565：localStorage \u5197\u4f59\u5907\u4efd + \u542f\u52a8\u65f6\u81ea\u52a8\u68c0\u6d4b\u6062\u590d
// ============================================================

import { getAll, bulkPut, setSetting, getSetting } from './db.js';

const BACKUP_KEY = 'workbuddy_backup';
const BACKUP_TIME_KEY = 'workbuddy_backup_time';
const BACKUP_VERSION = '1.0';

// \u9700\u8981\u5907\u4efd\u7684 store \u5217\u8868（\u6392\u9664 newsCache \u7b49\u53ef\u91cd\u5efa\u7684\u4e34\u65f6\u6570\u636e）
const BACKUP_STORES = [
  'tasks', 'workLogs', 'pingpongSessions', 'englishProgress',
  'weights', 'meals', 'loans', 'incomes', 'repayments', 'settings',
];

/**
 * \u5168\u91cf\u5907\u4efd：\u628a IndexedDB \u6240\u6709\u6570\u636e\u5b58\u5230 localStorage
 * @returns {Object} \u5907\u4efd\u6458\u8981 {success, count, size}
 */
export async function backupToLocalStorage() {
  try {
    const data = {};
    let totalCount = 0;
    for (const store of BACKUP_STORES) {
      const records = await getAll(store);
      data[store] = records;
      totalCount += records.length;
    }
    const payload = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      data,
    };
    const json = JSON.stringify(payload);
    localStorage.setItem(BACKUP_KEY, json);
    localStorage.setItem(BACKUP_TIME_KEY, payload.createdAt);
    // \u89e6\u53d1\u4e91\u540c\u6b65（\u52a8\u6001import\u907f\u514d\u5faa\u73af\u4f9d\u8d56）
    try {
      const { scheduleAutoSync } = await import('./sync.js');
      scheduleAutoSync();
    } catch (e) {}
    return { success: true, count: totalCount, size: json.length };
  } catch (e) {
    // localStorage \u6ee1\u4e86\u6216\u4e0d\u53ef\u7528，\u9759\u9ed8\u5931\u8d25
    console.warn('\u5907\u4efd\u5931\u8d25:', e);
    return { success: false, count: 0, size: 0, error: e.message };
  }
}

/**
 * \u4ece localStorage \u8bfb\u53d6\u5907\u4efd
 * @returns {Object|null}
 */
export function readBackup() {
  try {
    const json = localStorage.getItem(BACKUP_KEY);
    if (!json) return null;
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * \u83b7\u53d6\u4e0a\u6b21\u5907\u4efd\u65f6\u95f4
 * @returns {string|null} ISO \u65f6\u95f4\u5b57\u7b26\u4e32
 */
export function getLastBackupTime() {
  return localStorage.getItem(BACKUP_TIME_KEY);
}

/**
 * \u6062\u590d\u5907\u4efd\u5230 IndexedDB
 * @param {Object} [backupData] \u53ef\u9009，\u4e0d\u4f20\u5219\u7528 localStorage \u91cc\u7684
 * @returns {Object} {success, restored}
 */
export async function restoreFromBackup(backupData) {
  const payload = backupData || readBackup();
  if (!payload || !payload.data) {
    return { success: false, restored: 0 };
  }
  let restored = 0;
  for (const store of BACKUP_STORES) {
    const records = payload.data[store];
    if (Array.isArray(records) && records.length > 0) {
      await bulkPut(store, records);
      restored += records.length;
    }
  }
  return { success: true, restored };
}

/**
 * \u68c0\u6d4b IndexedDB \u662f\u5426\u88ab\u6e05\u7a7a（\u6838\u5fc3\u6570\u636e store \u4e3a\u7a7a）
 * @returns {boolean}
 */
export async function isIndexedDBEmpty() {
  // \u68c0\u67e5\u51e0\u4e2a\u6838\u5fc3 store：\u53ea\u8981\u6709\u6570\u636e\u5c31\u4e0d\u7b97\u7a7a
  for (const store of ['incomes', 'loans', 'weights', 'meals', 'tasks']) {
    const records = await getAll(store);
    if (records.length > 0) return false;
  }
  return true;
}

/**
 * \u542f\u52a8\u65f6\u81ea\u52a8\u68c0\u6d4b\u5e76\u6062\u590d（\u5173\u952e\u9632\u7ebf）
 * \u5982\u679c IndexedDB \u5168\u7a7a\u4f46 localStorage \u6709\u5907\u4efd → \u81ea\u52a8\u6062\u590d
 * @returns {Object} {restored, count} restored=true \u8868\u793a\u6267\u884c\u4e86\u6062\u590d
 */
export async function autoRestoreIfNeeded() {
  try {
    const empty = await isIndexedDBEmpty();
    if (!empty) return { restored: false, count: 0 };

    const backup = readBackup();
    if (!backup || !backup.data) return { restored: false, count: 0 };

    // IndexedDB \u7a7a\u4e14\u6709\u5907\u4efd → \u6062\u590d
    const result = await restoreFromBackup(backup);
    return { restored: result.success, count: result.restored };
  } catch (e) {
    console.warn('\u81ea\u52a8\u6062\u590d\u5931\u8d25:', e);
    return { restored: false, count: 0 };
  }
}

/**
 * \u5bfc\u51fa\u5907\u4efd\u4e3a JSON \u6587\u4ef6（\u624b\u52a8\u4e0b\u8f7d\u5230\u624b\u673a）
 */
export async function exportBackupFile() {
  const data = {};
  for (const store of BACKUP_STORES) {
    data[store] = await getAll(store);
  }
  const payload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `workbuddy-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return payload;
}

/**
 * \u4ece JSON \u6587\u4ef6\u5bfc\u5165\u5907\u4efd
 * @param {File} file
 * @returns {Object} {success, restored}
 */
export async function importBackupFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload.data) throw new Error('\u5907\u4efd\u6587\u4ef6\u683c\u5f0f\u9519\u8bef');
  return await restoreFromBackup(payload);
}

/**
 * \u683c\u5f0f\u5316\u5907\u4efd\u65f6\u95f4\u7528\u4e8e\u663e\u793a
 * @returns {string}
 */
export function formatBackupTime() {
  const time = getLastBackupTime();
  if (!time) return '\u4ece\u672a\u5907\u4efd';
  const d = new Date(time);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '\u521a\u521a\u5907\u4efd';
  if (diff < 3600) return `${Math.floor(diff / 60)}\u5206\u949f\u524d\u5907\u4efd`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}\u5c0f\u65f6\u524d\u5907\u4efd`;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min} \u5907\u4efd`;
}
