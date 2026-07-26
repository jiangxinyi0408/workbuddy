// ============================================================
// backup.js - 数据备份与恢复（防 iOS Safari 清空 IndexedDB）
// 策略：localStorage 冗余备份 + 启动时自动检测恢复
// ============================================================

import { getAll, bulkPut, setSetting, getSetting } from './db.js';

const BACKUP_KEY = 'workbuddy_backup';
const BACKUP_TIME_KEY = 'workbuddy_backup_time';
const BACKUP_VERSION = '1.0';

// 需要备份的 store 列表（排除 newsCache 等可重建的临时数据）
const BACKUP_STORES = [
  'tasks', 'workLogs', 'pingpongSessions', 'englishProgress',
  'weights', 'meals', 'loans', 'incomes', 'repayments', 'settings',
];

/**
 * 全量备份：把 IndexedDB 所有数据存到 localStorage
 * @returns {Object} 备份摘要 {success, count, size}
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
    return { success: true, count: totalCount, size: json.length };
  } catch (e) {
    // localStorage 满了或不可用，静默失败
    console.warn('备份失败:', e);
    return { success: false, count: 0, size: 0, error: e.message };
  }
}

/**
 * 从 localStorage 读取备份
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
 * 获取上次备份时间
 * @returns {string|null} ISO 时间字符串
 */
export function getLastBackupTime() {
  return localStorage.getItem(BACKUP_TIME_KEY);
}

/**
 * 恢复备份到 IndexedDB
 * @param {Object} [backupData] 可选，不传则用 localStorage 里的
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
 * 检测 IndexedDB 是否被清空（核心数据 store 为空）
 * @returns {boolean}
 */
export async function isIndexedDBEmpty() {
  // 检查几个核心 store：只要有数据就不算空
  for (const store of ['incomes', 'loans', 'weights', 'meals', 'tasks']) {
    const records = await getAll(store);
    if (records.length > 0) return false;
  }
  return true;
}

/**
 * 启动时自动检测并恢复（关键防线）
 * 如果 IndexedDB 全空但 localStorage 有备份 → 自动恢复
 * @returns {Object} {restored, count} restored=true 表示执行了恢复
 */
export async function autoRestoreIfNeeded() {
  try {
    const empty = await isIndexedDBEmpty();
    if (!empty) return { restored: false, count: 0 };

    const backup = readBackup();
    if (!backup || !backup.data) return { restored: false, count: 0 };

    // IndexedDB 空且有备份 → 恢复
    const result = await restoreFromBackup(backup);
    return { restored: result.success, count: result.restored };
  } catch (e) {
    console.warn('自动恢复失败:', e);
    return { restored: false, count: 0 };
  }
}

/**
 * 导出备份为 JSON 文件（手动下载到手机）
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
 * 从 JSON 文件导入备份
 * @param {File} file
 * @returns {Object} {success, restored}
 */
export async function importBackupFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload.data) throw new Error('备份文件格式错误');
  return await restoreFromBackup(payload);
}

/**
 * 格式化备份时间用于显示
 * @returns {string}
 */
export function formatBackupTime() {
  const time = getLastBackupTime();
  if (!time) return '从未备份';
  const d = new Date(time);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚备份';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前备份`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前备份`;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min} 备份`;
}
