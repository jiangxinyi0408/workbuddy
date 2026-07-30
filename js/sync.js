// ============================================================
// sync.js - GitHub \u4ed3\u5e93\u4e91\u540c\u6b65
// \u6570\u636e\u5b58\u5728\u7528\u6237 GitHub \u4ed3\u5e93\u7684 sync-data.json \u6587\u4ef6\u4e2d
// \u4f7f\u7528 GitHub Contents API \u8bfb\u5199，\u591a\u8bbe\u5907\u81ea\u52a8\u540c\u6b65
// ============================================================

import { getAll, bulkPut } from './db.js';

const SYNC_FILE = 'sync-data.json';
const REPO = 'jiangxinyi0408/workbuddy';
const TOKEN_KEY = 'workbuddy_sync_token';
const SYNC_ENABLED_KEY = 'workbuddy_sync_enabled';
const LAST_SYNC_TIME_KEY = 'workbuddy_last_sync_time';
const SHA_KEY = 'workbuddy_sync_sha'; // GitHub \u6587\u4ef6 SHA，\u7528\u4e8e\u66f4\u65b0

const SYNC_STORES = [
  'tasks', 'workLogs', 'pingpongSessions', 'englishProgress',
  'weights', 'meals', 'loans', 'incomes', 'repayments', 'settings',
];

let syncTimer = null;
let isSyncing = false;

export function getSyncToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setSyncToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isSyncEnabled() {
  return localStorage.getItem(SYNC_ENABLED_KEY) === '1' && !!getSyncToken();
}

export function setSyncEnabled(enabled) {
  localStorage.setItem(SYNC_ENABLED_KEY, enabled ? '1' : '0');
}

export function getLastSyncTime() {
  return parseInt(localStorage.getItem(LAST_SYNC_TIME_KEY) || '0');
}

export function formatLastSync() {
  const ts = getLastSyncTime();
  if (!ts) return '\u4ece\u672a\u540c\u6b65';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '\u521a\u521a\u540c\u6b65';
  if (diff < 3600) return `${Math.floor(diff / 60)}\u5206\u949f\u524d\u540c\u6b65`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}\u5c0f\u65f6\u524d\u540c\u6b65`;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min} \u540c\u6b65`;
}

function getApiBase() {
  const token = getSyncToken();
  // \u4ece token \u4e2d\u65e0\u6cd5\u76f4\u63a5\u63d0\u53d6\u7528\u6237\u540d，\u7528\u56fa\u5b9a\u7684\u4ed3\u5e93\u5730\u5740
  return `https://api.github.com/repos/${REPO}/contents/${SYNC_FILE}`;
}

function getHeaders() {
  const token = getSyncToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

async function collectAllData() {
  const data = {};
  let count = 0;
  for (const store of SYNC_STORES) {
    data[store] = await getAll(store);
    count += data[store].length;
  }
  return { data, count };
}

/**
 * \u63a8\u9001\u6570\u636e\u5230 GitHub \u4ed3\u5e93
 */
export async function pushToCloud() {
  if (isSyncing) return { success: false, error: '\u6b63\u5728\u540c\u6b65\u4e2d' };
  const token = getSyncToken();
  if (!token) return { success: false, error: '\u672a\u8bbe\u7f6eToken' };

  isSyncing = true;
  try {
    const { data, count } = await collectAllData();
    const content = btoa(unescape(encodeURIComponent(JSON.stringify({
      version: '1.0',
      updatedAt: new Date().toISOString(),
      data,
    }, null, 2))));

    // \u5148\u83b7\u53d6\u5f53\u524d\u6587\u4ef6\u7684 SHA（\u5982\u679c\u5b58\u5728）
    let sha = localStorage.getItem(SHA_KEY) || null;
    if (!sha) {
      try {
        const resp = await fetch(getApiBase(), { headers: getHeaders() });
        if (resp.ok) {
          const file = await resp.json();
          sha = file.sha;
          localStorage.setItem(SHA_KEY, sha);
        }
      } catch (e) {}
    }

    // \u521b\u5efa\u6216\u66f4\u65b0\u6587\u4ef6
    const body = {
      message: `��️ WorkBuddy sync - ${new Date().toLocaleString('zh-CN')}`,
      content,
    };
    if (sha) body.sha = sha;

    const resp = await fetch(getApiBase(), {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json();
      // SHA \u8fc7\u671f，\u91cd\u65b0\u83b7\u53d6
      if (resp.status === 409 || resp.status === 422) {
        localStorage.removeItem(SHA_KEY);
        isSyncing = false;
        // \u91cd\u8bd5\u4e00\u6b21
        return await pushToCloud();
      }
      throw new Error(`\u4e0a\u4f20\u5931\u8d25: ${resp.status} ${err.message || ''}`);
    }

    const result = await resp.json();
    if (result.content && result.content.sha) {
      localStorage.setItem(SHA_KEY, result.content.sha);
    }

    localStorage.setItem(LAST_SYNC_TIME_KEY, String(Date.now()));
    isSyncing = false;
    return { success: true, count };
  } catch (e) {
    isSyncing = false;
    return { success: false, error: e.message };
  }
}

/**
 * \u4ece GitHub \u4ed3\u5e93\u62c9\u53d6\u6570\u636e
 */
export async function pullFromCloud() {
  if (isSyncing) return { success: false, error: '\u6b63\u5728\u540c\u6b65\u4e2d' };
  const token = getSyncToken();
  if (!token) return { success: false, error: '\u672a\u8bbe\u7f6eToken' };

  isSyncing = true;
  try {
    const resp = await fetch(getApiBase(), { headers: getHeaders() });
    if (resp.status === 404) {
      isSyncing = false;
      return { success: false, error: '\u4e91\u7aef\u5c1a\u65e0\u6570\u636e，\u8bf7\u5148\u4e0a\u4f20' };
    }
    if (!resp.ok) {
      throw new Error(`\u62c9\u53d6\u5931\u8d25: ${resp.status}`);
    }

    const file = await resp.json();
    if (file.sha) localStorage.setItem(SHA_KEY, file.sha);

    // \u89e3\u7801 base64
    const content = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
    const payload = JSON.parse(content);

    if (!payload.data) {
      isSyncing = false;
      return { success: false, error: '\u4e91\u7aef\u6570\u636e\u683c\u5f0f\u9519\u8bef' };
    }

    // \u6062\u590d\u6570\u636e\u5230 IndexedDB
    let restored = 0;
    for (const store of SYNC_STORES) {
      const records = payload.data[store];
      if (Array.isArray(records) && records.length > 0) {
        await bulkPut(store, records);
        restored += records.length;
      }
    }

    localStorage.setItem(LAST_SYNC_TIME_KEY, String(Date.now()));
    isSyncing = false;
    return { success: true, count: restored };
  } catch (e) {
    isSyncing = false;
    return { success: false, error: e.message };
  }
}

/**
 * \u81ea\u52a8\u540c\u6b65（\u9632\u6296 5 \u79d2）
 */
export function scheduleAutoSync() {
  if (!isSyncEnabled()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const result = await pushToCloud();
    if (!result.success && result.error !== '\u672a\u542f\u7528\u540c\u6b65' && result.error !== '\u672a\u8bbe\u7f6eToken') {
      console.warn('\u81ea\u52a8\u540c\u6b65\u5931\u8d25:', result.error);
    }
  }, 5000);
}

/**
 * \u542f\u52a8\u65f6\u81ea\u52a8\u62c9\u53d6
 */
export async function autoSyncOnStart() {
  if (!isSyncEnabled()) return { synced: false };

  const lastSync = getLastSyncTime();
  const now = Date.now();
  if (lastSync && (now - lastSync) < 30000) {
    return { synced: false, reason: 'recently_synced' };
  }

  try {
    const result = await pullFromCloud();
    return { synced: result.success, count: result.count, error: result.error };
  } catch (e) {
    return { synced: false, error: e.message };
  }
}

/**
 * \u9a8c\u8bc1 Token
 */
export async function verifyToken(token) {
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });
    if (!resp.ok) return { success: false, error: 'Token\u65e0\u6548\u6216\u65e0\u4ed3\u5e93\u6743\u9650' };
    const repo = await resp.json();
    return { success: true, username: repo.owner.login, repo: repo.name };
  } catch (e) {
    return { success: false, error: '\u7f51\u7edc\u9519\u8bef：' + e.message };
  }
}

export function getSyncStatus() {
  return {
    enabled: isSyncEnabled(),
    hasToken: !!getSyncToken(),
    lastSync: formatLastSync(),
    lastSyncTime: getLastSyncTime(),
  };
}
