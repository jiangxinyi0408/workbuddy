// ============================================================
// auth.js - \u8d44\u4ea7\u7ba1\u7406\u5bc6\u7801\u9501
// \u5bc6\u7801：8\u4f4d\u6570\u5b57，SHA-256 \u54c8\u5e0c\u5b58\u50a8（\u4e0d\u5b58\u660e\u6587）
// \u9501\u5b9a\u7b56\u7565：\u9519\u8bef5\u6b21\u950160\u79d2，\u9519\u8bef10\u6b21\u9501300\u79d2
// ============================================================

const PWD_HASH_KEY = 'workbuddy_finance_pwd_hash';
const FAIL_COUNT_KEY = 'workbuddy_finance_fail_count';
const LOCK_UNTIL_KEY = 'workbuddy_finance_lock_until';
const AUTH_OK_KEY = 'workbuddy_finance_authed'; // \u672c\u6b21\u9875\u9762\u5185\u5df2\u9a8c\u8bc1\u6807\u8bb0（\u5bfc\u822a\u79bb\u5f00\u5373\u6e05\u9664）

// \u9501\u5b9a\u9608\u503c
const LOCK_5_TIMES = 5;
const LOCK_10_TIMES = 10;
const LOCK_60_SEC = 60 * 1000;
const LOCK_300_SEC = 300 * 1000;

/**
 * SHA-256 \u54c8\u5e0c
 */
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * \u662f\u5426\u5df2\u8bbe\u7f6e\u5bc6\u7801
 */
export function hasPassword() {
  return !!localStorage.getItem(PWD_HASH_KEY);
}

/**
 * \u8bbe\u7f6e\u5bc6\u7801（8\u4f4d\u6570\u5b57）
 */
export async function setPassword(pwd) {
  if (!/^\d{8}$/.test(pwd)) {
    return { success: false, error: '\u5bc6\u7801\u5fc5\u987b\u662f8\u4f4d\u6570\u5b57' };
  }
  const hash = await sha256(pwd);
  localStorage.setItem(PWD_HASH_KEY, hash);
  return { success: true };
}

/**
 * \u4fee\u6539\u5bc6\u7801（\u9700\u9a8c\u8bc1\u65e7\u5bc6\u7801）
 */
export async function changePassword(oldPwd, newPwd) {
  if (!/^\d{8}$/.test(newPwd)) {
    return { success: false, error: '\u65b0\u5bc6\u7801\u5fc5\u987b\u662f8\u4f4d\u6570\u5b57' };
  }
  const stored = localStorage.getItem(PWD_HASH_KEY);
  const oldHash = await sha256(oldPwd);
  if (oldHash !== stored) {
    return { success: false, error: '\u65e7\u5bc6\u7801\u9519\u8bef' };
  }
  const newHash = await sha256(newPwd);
  localStorage.setItem(PWD_HASH_KEY, newHash);
  return { success: true };
}

/**
 * \u5173\u95ed\u5bc6\u7801\u9501（\u6e05\u9664\u5bc6\u7801）
 */
export async function removePassword(pwd) {
  const stored = localStorage.getItem(PWD_HASH_KEY);
  const hash = await sha256(pwd);
  if (hash !== stored) {
    return { success: false, error: '\u5bc6\u7801\u9519\u8bef' };
  }
  localStorage.removeItem(PWD_HASH_KEY);
  localStorage.removeItem(FAIL_COUNT_KEY);
  localStorage.removeItem(LOCK_UNTIL_KEY);
  localStorage.removeItem(AUTH_OK_KEY);
  return { success: true };
}

/**
 * \u672c\u6b21\u4f1a\u8bdd\u662f\u5426\u5df2\u9a8c\u8bc1
 */
export function isAuthed() {
  return sessionStorage.getItem(AUTH_OK_KEY) === '1';
}

/**
 * \u6e05\u9664\u4f1a\u8bdd\u9a8c\u8bc1\u72b6\u6001（\u9000\u51fa\u767b\u5f55）
 */
export function clearAuth() {
  sessionStorage.removeItem(AUTH_OK_KEY);
}

/**
 * \u83b7\u53d6\u9501\u5b9a\u5269\u4f59\u79d2\u6570（0=\u672a\u9501\u5b9a）
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
 * \u83b7\u53d6\u5f53\u524d\u9519\u8bef\u6b21\u6570
 */
export function getFailCount() {
  return parseInt(localStorage.getItem(FAIL_COUNT_KEY) || '0');
}

/**
 * \u9a8c\u8bc1\u5bc6\u7801
 * @returns {Object} {success, locked, lockRemaining, error}
 */
export async function verifyPassword(pwd) {
  // \u68c0\u67e5\u662f\u5426\u9501\u5b9a\u4e2d
  const lockRemaining = getLockRemaining();
  if (lockRemaining > 0) {
    return { success: false, locked: true, lockRemaining, error: `\u5df2\u9501\u5b9a，\u8bf7\u7b49\u5f85 ${lockRemaining} \u79d2` };
  }

  const stored = localStorage.getItem(PWD_HASH_KEY);
  if (!stored) {
    return { success: false, error: '\u672a\u8bbe\u7f6e\u5bc6\u7801' };
  }

  const hash = await sha256(pwd);
  if (hash === stored) {
    // \u9a8c\u8bc1\u6210\u529f，\u6e05\u96f6\u9519\u8bef\u8ba1\u6570
    localStorage.removeItem(FAIL_COUNT_KEY);
    localStorage.removeItem(LOCK_UNTIL_KEY);
    sessionStorage.setItem(AUTH_OK_KEY, '1');
    return { success: true };
  }

  // \u9a8c\u8bc1\u5931\u8d25，\u7d2f\u52a0\u9519\u8bef\u6b21\u6570
  const failCount = getFailCount() + 1;
  localStorage.setItem(FAIL_COUNT_KEY, String(failCount));

  // \u5224\u65ad\u662f\u5426\u89e6\u53d1\u9501\u5b9a
  if (failCount >= LOCK_10_TIMES) {
    const lockUntil = Date.now() + LOCK_300_SEC;
    localStorage.setItem(LOCK_UNTIL_KEY, String(lockUntil));
    localStorage.removeItem(FAIL_COUNT_KEY);
    return { success: false, locked: true, lockRemaining: 300, error: '\u9519\u8bef10\u6b21，\u9501\u5b9a5\u5206\u949f' };
  } else if (failCount >= LOCK_5_TIMES) {
    const lockUntil = Date.now() + LOCK_60_SEC;
    localStorage.setItem(LOCK_UNTIL_KEY, String(lockUntil));
    localStorage.removeItem(FAIL_COUNT_KEY);
    return { success: false, locked: true, lockRemaining: 60, error: '\u9519\u8bef5\u6b21，\u9501\u5b9a1\u5206\u949f' };
  }

  const remaining = LOCK_5_TIMES - failCount;
  return { success: false, error: `\u5bc6\u7801\u9519\u8bef，\u8fd8\u53ef\u5c1d\u8bd5 ${remaining} \u6b21` };
}
