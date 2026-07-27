// ============================================================
// sync.js - GitHub 仓库云同步
// 数据存在用户 GitHub 仓库的 sync-data.json 文件中
// 使用 GitHub Contents API 读写，多设备自动同步
// ============================================================

import { getAll, bulkPut } from './db.js';

const SYNC_FILE = 'sync-data.json';
const REPO = 'jiangxinyi0408/workbuddy';
const TOKEN_KEY = 'workbuddy_sync_token';
const SYNC_ENABLED_KEY = 'workbuddy_sync_enabled';
const LAST_SYNC_TIME_KEY = 'workbuddy_last_sync_time';
const SHA_KEY = 'workbuddy_sync_sha'; // GitHub 文件 SHA，用于更新

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
  if (!ts) return '从未同步';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚同步';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前同步`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前同步`;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min} 同步`;
}

function getApiBase() {
  const token = getSyncToken();
  // 从 token 中无法直接提取用户名，用固定的仓库地址
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
 * 推送数据到 GitHub 仓库
 */
export async function pushToCloud() {
  if (isSyncing) return { success: false, error: '正在同步中' };
  const token = getSyncToken();
  if (!token) return { success: false, error: '未设置Token' };

  isSyncing = true;
  try {
    const { data, count } = await collectAllData();
    const content = btoa(unescape(encodeURIComponent(JSON.stringify({
      version: '1.0',
      updatedAt: new Date().toISOString(),
      data,
    }, null, 2))));

    // 先获取当前文件的 SHA（如果存在）
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

    // 创建或更新文件
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
      // SHA 过期，重新获取
      if (resp.status === 409 || resp.status === 422) {
        localStorage.removeItem(SHA_KEY);
        isSyncing = false;
        // 重试一次
        return await pushToCloud();
      }
      throw new Error(`上传失败: ${resp.status} ${err.message || ''}`);
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
 * 从 GitHub 仓库拉取数据
 */
export async function pullFromCloud() {
  if (isSyncing) return { success: false, error: '正在同步中' };
  const token = getSyncToken();
  if (!token) return { success: false, error: '未设置Token' };

  isSyncing = true;
  try {
    const resp = await fetch(getApiBase(), { headers: getHeaders() });
    if (resp.status === 404) {
      isSyncing = false;
      return { success: false, error: '云端尚无数据，请先上传' };
    }
    if (!resp.ok) {
      throw new Error(`拉取失败: ${resp.status}`);
    }

    const file = await resp.json();
    if (file.sha) localStorage.setItem(SHA_KEY, file.sha);

    // 解码 base64
    const content = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
    const payload = JSON.parse(content);

    if (!payload.data) {
      isSyncing = false;
      return { success: false, error: '云端数据格式错误' };
    }

    // 恢复数据到 IndexedDB
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
 * 自动同步（防抖 5 秒）
 */
export function scheduleAutoSync() {
  if (!isSyncEnabled()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const result = await pushToCloud();
    if (!result.success && result.error !== '未启用同步' && result.error !== '未设置Token') {
      console.warn('自动同步失败:', result.error);
    }
  }, 5000);
}

/**
 * 启动时自动拉取
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
 * 验证 Token
 */
export async function verifyToken(token) {
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });
    if (!resp.ok) return { success: false, error: 'Token无效或无仓库权限' };
    const repo = await resp.json();
    return { success: true, username: repo.owner.login, repo: repo.name };
  } catch (e) {
    return { success: false, error: '网络错误：' + e.message };
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
