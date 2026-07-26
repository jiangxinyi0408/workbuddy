// ============================================================
// auth.js - 资产管理密码锁
// 密码：8位数字，SHA-256 哈希存储（不存明文）
// 锁定策略：错误5次锁60秒，错误10次锁300秒
// ============================================================

const PWD_HASH_KEY = 'workbuddy_finance_pwd_hash';
const FAIL_COUNT_KEY = 'workbuddy_finance_fail_count';
const LOCK_UNTIL_KEY = 'workbuddy_finance_lock_until';
const AUTH_OK_KEY = 'workbuddy_finance_authed'; // 本次会话已验证标记

// 锁定阈值
const LOCK_5_TIMES = 5;
const LOCK_10_TIMES = 10;
const LOCK_60_SEC = 60 * 1000;
const LOCK_300_SEC = 300 * 1000;

/**
 * SHA-256 哈希
 */
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 是否已设置密码
 */
export function hasPassword() {
  return !!localStorage.getItem(PWD_HASH_KEY);
}

/**
 * 设置密码（8位数字）
 */
export async function setPassword(pwd) {
  if (!/^\d{8}$/.test(pwd)) {
    return { success: false, error: '密码必须是8位数字' };
  }
  const hash = await sha256(pwd);
  localStorage.setItem(PWD_HASH_KEY, hash);
  return { success: true };
}

/**
 * 修改密码（需验证旧密码）
 */
export async function changePassword(oldPwd, newPwd) {
  if (!/^\d{8}$/.test(newPwd)) {
    return { success: false, error: '新密码必须是8位数字' };
  }
  const stored = localStorage.getItem(PWD_HASH_KEY);
  const oldHash = await sha256(oldPwd);
  if (oldHash !== stored) {
    return { success: false, error: '旧密码错误' };
  }
  const newHash = await sha256(newPwd);
  localStorage.setItem(PWD_HASH_KEY, newHash);
  return { success: true };
}

/**
 * 关闭密码锁（清除密码）
 */
export async function removePassword(pwd) {
  const stored = localStorage.getItem(PWD_HASH_KEY);
  const hash = await sha256(pwd);
  if (hash !== stored) {
    return { success: false, error: '密码错误' };
  }
  localStorage.removeItem(PWD_HASH_KEY);
  localStorage.removeItem(FAIL_COUNT_KEY);
  localStorage.removeItem(LOCK_UNTIL_KEY);
  localStorage.removeItem(AUTH_OK_KEY);
  return { success: true };
}

/**
 * 本次会话是否已验证
 */
export function isAuthed() {
  return sessionStorage.getItem(AUTH_OK_KEY) === '1';
}

/**
 * 清除会话验证状态（退出登录）
 */
export function clearAuth() {
  sessionStorage.removeItem(AUTH_OK_KEY);
}

/**
 * 获取锁定剩余秒数（0=未锁定）
 */
export function getLockRemaining() {
  const until = parseInt(localStorage.getItem(LOCK_UNTIL_KEY) || '0');
  const now = Date.now();
  if (until > now) {
    return Math.ceil((until - now) / 1000);
  }
  return 0;
}

/**
 * 获取当前错误次数
 */
export function getFailCount() {
  return parseInt(localStorage.getItem(FAIL_COUNT_KEY) || '0');
}

/**
 * 验证密码
 * @returns {Object} {success, locked, lockRemaining, error}
 */
export async function verifyPassword(pwd) {
  // 检查是否锁定中
  const lockRemaining = getLockRemaining();
  if (lockRemaining > 0) {
    return { success: false, locked: true, lockRemaining, error: `已锁定，请等待 ${lockRemaining} 秒` };
  }

  const stored = localStorage.getItem(PWD_HASH_KEY);
  if (!stored) {
    return { success: false, error: '未设置密码' };
  }

  const hash = await sha256(pwd);
  if (hash === stored) {
    // 验证成功，清零错误计数
    localStorage.removeItem(FAIL_COUNT_KEY);
    localStorage.removeItem(LOCK_UNTIL_KEY);
    sessionStorage.setItem(AUTH_OK_KEY, '1');
    return { success: true };
  }

  // 验证失败，累加错误次数
  const failCount = getFailCount() + 1;
  localStorage.setItem(FAIL_COUNT_KEY, String(failCount));

  // 判断是否触发锁定
  if (failCount >= LOCK_10_TIMES) {
    const lockUntil = Date.now() + LOCK_300_SEC;
    localStorage.setItem(LOCK_UNTIL_KEY, String(lockUntil));
    localStorage.removeItem(FAIL_COUNT_KEY);
    return { success: false, locked: true, lockRemaining: 300, error: '错误10次，锁定5分钟' };
  } else if (failCount >= LOCK_5_TIMES) {
    const lockUntil = Date.now() + LOCK_60_SEC;
    localStorage.setItem(LOCK_UNTIL_KEY, String(lockUntil));
    localStorage.removeItem(FAIL_COUNT_KEY);
    return { success: false, locked: true, lockRemaining: 60, error: '错误5次，锁定1分钟' };
  }

  const remaining = LOCK_5_TIMES - failCount;
  return { success: false, error: `密码错误，还可尝试 ${remaining} 次` };
}
