// ============================================================
// app.js - \u4e3b\u5e94\u7528：\u8def\u7531、\u521d\u59cb\u5316、\u5bfc\u822a
// ============================================================

import { getSetting, setSetting, getAll, getByIndex, getByRange } from './db.js';
import { today, tomorrow, weekRange, fmtDate, toast, openBottomSheet, escapeHtml } from './utils.js';
import { initWork, renderWork, dashboardWork } from './modules/work.js';
import { initWeight, renderWeight, dashboardWeight } from './modules/weight.js';
import { initFinance, renderFinance, dashboardFinance } from './modules/finance.js';
import { initEnglish, renderEnglish, dashboardEnglish } from './modules/english.js';
import { initPingpong, renderPingpong, dashboardPingpong } from './modules/pingpong.js';
import { initNews, renderNews, dashboardNews } from './news.js';
import { initAI, renderAI, dashboardAI } from './modules/ai.js';
import { autoRestoreIfNeeded, backupToLocalStorage, formatBackupTime } from './backup.js';
import { hasPassword, isAuthed, verifyPassword, getLockRemaining, getFailCount, setPassword, changePassword, removePassword, clearAuth } from './modules/auth.js';
import { isSyncEnabled, scheduleAutoSync, autoSyncOnStart, getSyncStatus, setSyncToken, setSyncEnabled, pushToCloud, pullFromCloud, verifyToken, formatLastSync } from './sync.js';

// \u9875\u9762\u5b9a\u4e49
const PAGES = {
  home: { title: '\u5f53\u65e5\u5b89\u6392', render: renderHome },
  work: { title: '\u6bcf\u65e5\u4e1a\u52a1\u5b89\u6392', render: renderWork },
  pingpong: { title: '\u6253\u7403\u65f6\u95f4', render: renderPingpong },
  english: { title: '\u82f1\u8bed\u80fd\u529b\u63d0\u5347', render: renderEnglish },
  weight: { title: '\u5065\u5eb7\u7ba1\u7406', render: renderWeight },
  news: { title: '\u6bcf\u65e5\u8d44\u8baf', render: renderNews },
  finance: { title: '\u8d44\u4ea7\u7ba1\u7406', render: renderFinance },
  ai: { title: '\u4e86\u89e3AI', render: renderAI },
  more: { title: '\u8bbe\u7f6e', render: renderMore },
};

let currentPage = 'home';

// ============================================================
// \u4fa7\u8fb9\u680f\u63a7\u5236
// ============================================================

// \u79fb\u52a8\u7aef\u9ed8\u8ba4\u6536\u8d77；\u684c\u9762\u7aef\u9ed8\u8ba4\u5c55\u5f00
function isMobile() {
  return window.innerWidth <= 768;
}

export function toggleSidebar(forceState) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const wrapper = document.getElementById('main-wrapper');

  if (isMobile()) {
    // \u79fb\u52a8\u7aef：\u62bd\u5c49\u5f0f
    const willOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('mobile-open');
    sidebar.classList.remove('mobile-closed');
    sidebar.classList.toggle('mobile-open', willOpen);
    if (!willOpen) sidebar.classList.add('mobile-closed');
    overlay.classList.toggle('show', willOpen);
  } else {
    // \u684c\u9762\u7aef：\u6298\u53e0/\u5c55\u5f00
    const willCollapse = forceState !== undefined ? !forceState : !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', willCollapse);
    wrapper.classList.toggle('expanded', willCollapse);
  }
}

window.__toggleSidebar = toggleSidebar;

// ============================================================
// \u8def\u7531
// ============================================================

export async function navigate(page) {
  if (!PAGES[page]) page = 'home';
  currentPage = page;
  const config = PAGES[page];

  // \u66f4\u65b0\u6807\u9898
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = config.title;

  // \u66f4\u65b0\u4fa7\u8fb9\u5bfc\u822a\u9ad8\u4eae
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // \u79fb\u52a8\u7aef\u70b9\u51fb\u540e\u5173\u95ed\u4fa7\u8fb9\u680f
  if (isMobile()) {
    toggleSidebar(false);
  }

  // \u6e32\u67d3\u9875���\u5185\u5bb9
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  main.scrollTop = 0;

  // 🔒 \u5bfc\u822a\u79bb\u5f00\u8d44\u4ea7\u7ba1\u7406\u65f6\u6e05\u9664\u9a8c\u8bc1\u6807\u8bb0（\u4e0b\u6b21\u8fdb\u5165\u9700\u91cd\u65b0\u89e3\u9501）
  if (page !== 'finance' && isAuthed()) {
    clearAuth();
  }

  // 🔒 \u8d44\u4ea7\u7ba1\u7406\u5bc6\u7801\u9501
  if (page === 'finance' && hasPassword() && !isAuthed()) {
    await showFinanceLock(main);
    window.scrollTo(0, 0);
    return;
  }
  // 🔒 \u9996\u6b21\u8fdb\u5165 finance \u4f46\u672a\u8bbe\u5bc6\u7801 → \u5f15\u5bfc\u8bbe\u7f6e
  if (page === 'finance' && !hasPassword()) {
    await showSetPasswordScreen(main);
    window.scrollTo(0, 0);
    return;
  }

  // \u663e\u793a\u52a0\u8f7d\u72b6\u6001
  main.innerHTML = '<div class="loading"><div class="spinner"></div><p>\u52a0\u8f7d\u4e2d...</p></div>';

  try {
    await config.render(main);
  } catch (err) {
    console.error('\u9875\u9762\u6e32\u67d3\u9519\u8bef:', err);
    main.innerHTML = `<div class="error-page"><p>\u52a0\u8f7d\u5931\u8d25</p><button onclick="location.reload()">\u91cd\u8bd5</button></div>`;
  }

  // \u6eda\u52a8\u6062\u590d
  window.scrollTo(0, 0);
}

// ============================================================
// 🔒 \u8d44\u4ea7\u7ba1\u7406\u5bc6\u7801\u9501\u754c\u9762
// ============================================================

async function showFinanceLock(container) {
  const lockRemaining = getLockRemaining();

  const renderLockScreen = (msg, isError) => {
    const locked = getLockRemaining();
    container.innerHTML = `
      <div class="lock-screen">
        <div class="lock-icon">${locked > 0 ? '⏳' : '🔒'}</div>
        <div class="lock-title">\u8d44\u4ea7\u7ba1\u7406</div>
        ${locked > 0 ? `
          <div class="lock-warning">\u5df2\u9501\u5b9a</div>
          <div class="lock-countdown" id="lock-countdown">${locked} \u79d2\u540e\u53ef\u91cd\u8bd5</div>
          <button class="btn-outline mt-16" onclick="window.__navigate('home')">\u8fd4\u56de\u9996\u9875</button>
        ` : `
          <div class="lock-hint">\u8bf7\u8f93\u51658\u4f4d\u6570\u5b57\u5bc6\u7801</div>
          <input type="password" id="lock-pwd" class="lock-input" maxlength="8" inputmode="numeric" placeholder="••••••••" autocomplete="off">
          <button class="btn-primary btn-full mt-16" onclick="window.__unlockFinance()">\u89e3\u9501</button>
          ${msg ? `<div class="lock-error">${escapeHtml(msg)}</div>` : ''}
          ${isError ? '' : `<div class="text-xs text-gray mt-16">\u63d0\u793a：\u5bc6\u7801\u4e3a8\u4f4d\u7eaf\u6570\u5b57</div>`}
          <button class="btn-outline mt-16" onclick="window.__navigate('home')">\u8fd4\u56de\u9996\u9875</button>
        `}
      </div>
    `;
    const input = document.getElementById('lock-pwd');
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') window.__unlockFinance();
      });
    }
    if (locked > 0) startLockCountdown(locked);
  };

  const startLockCountdown = (seconds) => {
    let remain = seconds;
    const tick = () => {
      const el = document.getElementById('lock-countdown');
      if (!el) return;
      remain = getLockRemaining();
      if (remain <= 0) {
        renderLockScreen();
        return;
      }
      el.textContent = `${remain} \u79d2\u540e\u53ef\u91cd\u8bd5`;
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1000);
  };

  window.__unlockFinance = async () => {
    const input = document.getElementById('lock-pwd');
    if (!input) return;
    const pwd = input.value.trim();
    if (!/^\d{8}$/.test(pwd)) {
      renderLockScreen('\u8bf7\u8f93\u51658\u4f4d\u6570\u5b57\u5bc6\u7801', true);
      return;
    }
    const result = await verifyPassword(pwd);
    if (result.success) {
      toast('\u89e3\u9501\u6210\u529f');
      navigate('finance');
    } else if (result.locked) {
      renderLockScreen(result.error, true);
    } else {
      renderLockScreen(result.error, true);
    }
  };

  renderLockScreen();
}

// ============================================================
// 🔒 \u9996\u6b21\u8bbe\u7f6e\u5bc6\u7801\u754c\u9762
// ============================================================

async function showSetPasswordScreen(container) {
  container.innerHTML = `
    <div class="lock-screen">
      <div class="lock-icon">🔐</div>
      <div class="lock-title">\u8bbe\u7f6e\u8d44\u4ea7\u7ba1\u7406\u5bc6\u7801</div>
      <div class="lock-hint">\u4e3a\u4fdd\u62a4\u8d22\u52a1\u9690\u79c1，\u8bf7\u8bbe\u7f6e8\u4f4d\u6570\u5b57\u5bc6\u7801</div>
      <input type="password" id="set-pwd-1" class="lock-input" maxlength="8" inputmode="numeric" placeholder="\u8f93\u51658\u4f4d\u6570\u5b57\u5bc6\u7801" autocomplete="off">
      <input type="password" id="set-pwd-2" class="lock-input mt-8" maxlength="8" inputmode="numeric" placeholder="\u518d\u6b21\u8f93\u5165\u786e\u8ba4" autocomplete="off">
      <button class="btn-primary btn-full mt-16" onclick="window.__confirmSetPwd()">\u8bbe\u7f6e\u5bc6\u7801</button>
      <button class="btn-outline mt-8" onclick="window.__navigate('home')">\u6682\u4e0d\u8bbe\u7f6e</button>
      <div class="text-xs text-gray mt-16">\u5bc6\u7801\u4e3a8\u4f4d\u7eaf\u6570\u5b57，\u5efa\u8bae\u4e0d\u8981\u7528\u751f\u65e5</div>
    </div>
  `;
  document.getElementById('set-pwd-1').focus();

  window.__confirmSetPwd = async () => {
    const p1 = document.getElementById('set-pwd-1').value.trim();
    const p2 = document.getElementById('set-pwd-2').value.trim();
    if (!/^\d{8}$/.test(p1)) { toast('\u5bc6\u7801\u5fc5\u987b\u662f8\u4f4d\u6570\u5b57'); return; }
    if (p1 !== p2) { toast('\u4e24\u6b21\u8f93\u5165\u4e0d\u4e00\u81f4'); return; }
    const result = await setPassword(p1);
    if (result.success) {
      toast('\u5bc6\u7801\u5df2\u8bbe\u7f6e');
      navigate('finance');
    } else {
      toast(result.error);
    }
  };
}

// ============================================================
// \u9996\u9875 Dashboard
// ============================================================

async function renderHome(container) {
  const [workHTML, weightHTML, financeHTML, englishHTML, pingpongHTML, newsHTML, aiHTML] = await Promise.all([
    dashboardWork(),
    dashboardWeight(),
    dashboardFinance(),
    dashboardEnglish(),
    dashboardPingpong(),
    dashboardNews(),
    dashboardAI(),
  ]);

  container.innerHTML = `
    <div class="dashboard">
      <div class="hero-card">
        <div class="hero-date">${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
        <div class="hero-greeting">${getGreeting()}</div>
      </div>

      ${workHTML}
      ${pingpongHTML}
      ${englishHTML}
      ${aiHTML}
      ${weightHTML}
      ${financeHTML}
      ${newsHTML}
    </div>
  `;
}

function getGreeting() {
  return '\u6b22\u8fce\u5c0f\u59dc\u603b';
}

// ============================================================
// "\u66f4\u591a"\u9875\u9762
// ============================================================

async function renderMore(container) {
  container.innerHTML = `
    <div class="more-page">
      <div class="more-section">
        <h3 class="more-section-title">\u5b66\u4e60\u63d0\u5347</h3>
        <div class="more-item" onclick="window.__navigate('english')">
          <div class="more-icon" style="background:#8b5cf6">📚</div>
          <div class="more-info"><div class="more-name">\u82f1\u8bed\u5b66\u4e60</div><div class="more-desc">90\u5929\u53e3\u8bed\u63d0\u5347\u8ba1\u5212</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.__navigate('news')">
          <div class="more-icon" style="background:#f59e0b">📰</div>
          <div class="more-info"><div class="more-name">\u70ed\u70b9\u8d44\u8baf</div><div class="more-desc">\u56fd\u5185\u5916\u65b0\u95fb\u901f\u89c8</div></div>
          <div class="more-arrow">›</div>
        </div>
      </div>

      <div class="more-section">
        <h3 class="more-section-title">\u751f\u6d3b\u7ba1\u7406</h3>
        <div class="more-item" onclick="window.__navigate('pingpong')">
          <div class="more-icon" style="background:#06b6d4">🏓</div>
          <div class="more-info"><div class="more-name">\u4e52\u4e53\u7403\u65f6\u95f4</div><div class="more-desc">\u6d3b\u52a8\u767b\u8bb0\u4e0e\u7a7a\u95f2\u65f6\u95f4</div></div>
          <div class="more-arrow">›</div>
        </div>
      </div>

      <div class="more-section">
        <h3 class="more-section-title">\u8bbe\u7f6e</h3>
        <div class="more-item" onclick="window.__showSettings()">
          <div class="more-icon" style="background:#6b7280">⚙️</div>
          <div class="more-info"><div class="more-name">\u5e94\u7528\u8bbe\u7f6e</div><div class="more-desc">AI\u914d\u7f6e、\u5b9a\u65f6\u603b\u7ed3、\u6570\u636e\u7ba1\u7406</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.__showAbout()">
          <div class="more-icon" style="background:#6b7280">ℹ️</div>
          <div class="more-info"><div class="more-name">\u5173\u4e8e</div><div class="more-desc">\u7248\u672c\u4fe1\u606f\u4e0e\u4f7f\u7528\u5e2e\u52a9</div></div>
          <div class="more-arrow">›</div>
        </div>
      </div>

      <div class="more-footer">\u4e2a\u4eba\u5de5\u4f5c\u53f0 v1.0 · \u6570\u636e\u672c\u5730\u5b58\u50a8</div>
    </div>
  `;
}

// ============================================================
// \u8bbe\u7f6e\u9762\u677f
// ============================================================

window.__showSettings = async function() {
  const apiKey = await getSetting('geminiApiKey', '');
  const summaryHour = await getSetting('summaryHour', 21);
  const height = await getSetting('height', '');
  const targetWeight = await getSetting('targetWeight', '');

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>🤖 Gemini API Key（\u7528\u4e8e\u98df\u7269\u8bc6\u522b\u548c\u996e\u98df\u63a8\u8350）</label>
        <input type="text" id="set-apikey" value="${apiKey}" placeholder="\u53ef\u9009，\u7559\u7a7a\u5219\u4f7f\u7528\u624b\u52a8\u6a21\u5f0f">
        <div class="form-hint">\u5230 <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> \u514d\u8d39\u83b7\u53d6</div>
      </div>

      <div class="form-group">
        <label>🕐 \u6bcf\u65e5\u5de5\u4f5c\u603b\u7ed3\u65f6\u95f4</label>
        <select id="set-summary-hour">
          ${[18,19,20,21,22,23].map(h => `<option value="${h}" ${h==summaryHour?'selected':''}>${h}:00</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>📏 \u8eab\u9ad8（cm）</label>
        <input type="number" id="set-height" value="${height}" placeholder="\u7528\u4e8e\u8ba1\u7b97BMI">
      </div>

      <div class="form-group">
        <label>⚖️ \u76ee\u6807\u4f53\u91cd（kg）</label>
        <input type="number" id="set-target-weight" value="${targetWeight}" placeholder="\u4f60\u7684\u51cf\u80a5\u76ee\u6807">
      </div>

      <div class="form-group">
        <label>💊 \u5065\u5eb7\u6307\u6807（\u5df2\u9884\u586b）</label>
        <div class="health-tags">
          <span class="health-tag">\u4f4e\u5bc6\u5ea6\u8102\u86cb\u767d\u8fc7\u9ad8</span>
          <span class="health-tag">\u80c6\u56fa\u9187\u8fc7\u9ad8</span>
        </div>
        <div class="form-hint">\u996e\u98df\u63a8\u8350\u5c06\u57fa\u4e8e\u8fd9\u4e9b\u6307\u6807\u751f\u6210</div>
      </div>

      <div class="form-group">
        <label>💾 \u6570\u636e\u5907\u4efd\u4e0e\u6062\u590d</label>
        <div class="backup-status" id="backup-status">⏳ \u8bfb\u53d6\u4e2d...</div>
        <div class="data-actions">
          <button class="btn-outline" onclick="window.__manualBackup()">📥 \u7acb\u5373\u5907\u4efd</button>
          <button class="btn-outline" onclick="window.__exportData()">📤 \u5bfc\u51fa\u6587\u4ef6</button>
        </div>
        <div class="data-actions mt-8">
          <button class="btn-outline" onclick="window.__importData()">📂 \u5bfc\u5165\u6587\u4ef6</button>
          <button class="btn-danger-outline" onclick="window.__clearData()">🗑 \u6e05\u7a7a\u6570\u636e</button>
        </div>
        <input type="file" id="import-file-input" accept=".json" style="display:none">
        <div class="form-hint">\u81ea\u52a8\u5907\u4efd\u6bcf5\u5206\u949f\u6267\u884c\u4e00\u6b21，\u5207\u6362App\u56de\u6765\u65f6\u4e5f\u4f1a\u5907\u4efd</div>
      </div>

      <div class="form-group">
        <label>☁️ \u4e91\u540c\u6b65（\u591a\u8bbe\u5907\u540c\u6b65）</label>
        <div class="sync-status" id="sync-status">⏳ \u8bfb\u53d6\u4e2d...</div>
        <div class="data-actions" id="sync-actions">
          <button class="btn-outline" onclick="window.__setupSync()">⚙️ \u8bbe\u7f6e\u540c\u6b65</button>
        </div>
        <div class="form-hint">\u901a\u8fc7 GitHub Gist \u5728 iPhone/iPad \u95f4\u81ea\u52a8\u540c\u6b65\u6570\u636e</div>
      </div>

      <div class="form-group">
        <label>🔒 \u8d44\u4ea7\u7ba1\u7406\u5bc6\u7801\u9501</label>
        <div class="lock-setting-status" id="lock-status">⏳ \u8bfb\u53d6\u4e2d...</div>
        <div class="data-actions">
          ${hasPassword() ? `
            <button class="btn-outline" onclick="window.__changePwd()">\u4fee\u6539\u5bc6\u7801</button>
            <button class="btn-danger-outline" onclick="window.__removePwd()">\u5173\u95ed\u5bc6\u7801\u9501</button>
          ` : `
            <button class="btn-primary" onclick="window.__setPwd()">\u8bbe\u7f6e\u5bc6\u7801</button>
          `}
        </div>
        <div class="form-hint">\u4fdd\u62a4\u8d44\u4ea7\u7ba1\u7406\u6a21\u5757，\u9519\u8bef5\u6b21\u95011\u5206\u949f，10\u6b21\u95015\u5206\u949f</div>
      </div>

      <div class="form-group">
        <label>🔄 \u68c0\u67e5\u66f4\u65b0</label>
        <div class="form-hint" style="margin-bottom:8px">\u66f4\u65b0\u7248\u672c\u540e\u70b9\u51fb\u5237\u65b0\u5373\u53ef\u52a0\u8f7d\u6700\u65b0\u4ee3\u7801</div>
        <button class="btn-primary btn-full" onclick="window.__refreshApp()">🔄 \u7acb\u5373\u5237\u65b0</button>
      </div>

      <button class="btn-primary btn-full" onclick="window.__saveSettings()">\u4fdd\u5b58\u8bbe\u7f6e</button>
    </div>
  `;

  const sheet = openBottomSheet('\u5e94\u7528\u8bbe\u7f6e', html);
  window.__currentSheet = sheet;

  // \u66f4\u65b0\u5907\u4efd\u72b6\u6001\u663e\u793a
  const updateBackupStatus = () => {
    const el = document.getElementById('backup-status');
    if (el) el.textContent = '✅ ' + formatBackupTime();
  };
  updateBackupStatus();

  // \u66f4\u65b0\u5bc6\u7801\u9501\u72b6\u6001\u663e\u793a
  const updateLockStatus = () => {
    const el = document.getElementById('lock-status');
    if (el) {
      el.textContent = hasPassword() ? '✅ \u5df2\u542f\u7528\u5bc6\u7801\u4fdd\u62a4' : '⚪ \u672a\u8bbe\u7f6e\u5bc6\u7801';
    }
  };
  updateLockStatus();

  // \u66f4\u65b0\u4e91\u540c\u6b65\u72b6\u6001\u663e\u793a
  const updateSyncStatus = () => {
    const statusEl = document.getElementById('sync-status');
    const actionsEl = document.getElementById('sync-actions');
    if (!statusEl || !actionsEl) return;
    const status = getSyncStatus();
    if (status.enabled) {
      statusEl.textContent = '✅ \u5df2\u542f\u7528 · ' + status.lastSync;
      actionsEl.innerHTML = `
        <button class="btn-outline" onclick="window.__syncPush()">⬆️ \u7acb\u5373\u4e0a\u4f20</button>
        <button class="btn-outline" onclick="window.__syncPull()">⬇️ \u7acb\u5373\u62c9\u53d6</button>
        <button class="btn-danger-outline" onclick="window.__disableSync()">\u5173\u95ed\u540c\u6b65</button>
      `;
    } else if (status.hasToken) {
      statusEl.textContent = '⚪ Token\u5df2\u8bbe\u7f6e，\u672a\u542f\u7528\u540c\u6b65';
      actionsEl.innerHTML = `<button class="btn-primary" onclick="window.__enableSync()">\u542f\u7528\u540c\u6b65</button>`;
    } else {
      statusEl.textContent = '⚪ \u672a\u8bbe\u7f6e';
      actionsEl.innerHTML = `<button class="btn-outline" onclick="window.__setupSync()">⚙️ \u8bbe\u7f6e\u540c\u6b65</button>`;
    }
  };
  updateSyncStatus();
};

// ============================================================
// ☁️ \u4e91\u540c\u6b65\u7ba1\u7406\u51fd\u6570
// ============================================================

window.__setupSync = function() {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>GitHub Token</label>
        <input type="password" id="sync-token" class="lock-input" placeholder="ghp_xxxxxxxx" autocomplete="off" value="${getSyncStatus().hasToken ? '(\u5df2\u8bbe\u7f6e，\u8f93\u5165\u65b0Token\u53ef\u66ff\u6362)' : ''}">
        <div class="form-hint">\u9700\u8981\u4e00\u4e2a\u6709 repo \u6743\u9650\u7684 Token<br>\u5230 github.com → \u5934\u50cf → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → \u52fe\u9009 repo → \u751f\u6210\u540e\u590d\u5236\u7c98\u8d34\u5230\u4e0a\u65b9</div>
      </div>
      <button class="btn-primary btn-full" onclick="window.__verifyAndSaveToken()">\u9a8c\u8bc1\u5e76\u4fdd\u5b58</button>
    </div>
  `;
  const sheet = openBottomSheet('\u8bbe\u7f6e\u4e91\u540c\u6b65', html);
  window.__currentSheet = sheet;

  window.__verifyAndSaveToken = async () => {
    const token = document.getElementById('sync-token').value.trim();
    if (!token || token === '(\u5df2\u8bbe\u7f6e，\u8f93\u5165\u65b0Token\u53ef\u66ff\u6362)') { toast('\u8bf7\u8f93\u5165Token'); return; }
    toast('\u9a8c\u8bc1\u4e2d...');
    const result = await verifyToken(token);
    if (result.success) {
      setSyncToken(token);
      setSyncEnabled(true);
      toast(`✅ Token\u9a8c\u8bc1\u6210\u529f，\u6b22\u8fce ${result.username}`);
      sheet.close();
      // \u7acb\u5373\u63a8\u9001\u4e00\u6b21
      const pushResult = await pushToCloud();
      if (pushResult.success) {
        toast(`☁️ \u5df2\u4e0a\u4f20 ${pushResult.count} \u6761\u8bb0\u5f55`);
      }
      window.__showSettings();
    } else {
      toast('❌ ' + result.error);
    }
  };
};

window.__enableSync = function() {
  setSyncEnabled(true);
  toast('\u4e91\u540c\u6b65\u5df2\u542f\u7528');
  pushToCloud().then(r => {
    if (r.success) toast(`☁️ \u5df2\u4e0a\u4f20 ${r.count} \u6761\u8bb0\u5f55`);
  });
  window.__showSettings();
};

window.__disableSync = function() {
  if (!confirm('\u786e\u5b9a\u5173\u95ed\u4e91\u540c\u6b65？\u5173\u95ed\u540e\u591a\u8bbe\u5907\u4e0d\u518d\u81ea\u52a8\u540c\u6b65')) return;
  setSyncEnabled(false);
  toast('\u4e91\u540c\u6b65\u5df2\u5173\u95ed');
  window.__showSettings();
};

window.__syncPush = async function() {
  toast('\u4e0a\u4f20\u4e2d...');
  const result = await pushToCloud();
  if (result.success) {
    toast(`☁️ \u5df2\u4e0a\u4f20 ${result.count} \u6761\u8bb0\u5f55`);
    window.__showSettings();
  } else {
    toast('❌ ' + result.error);
  }
};

window.__syncPull = async function() {
  toast('\u62c9\u53d6\u4e2d...');
  const result = await pullFromCloud();
  if (result.success) {
    toast(`☁️ \u5df2\u62c9\u53d6 ${result.count} \u6761\u8bb0\u5f55`);
    location.reload();
  } else {
    toast('❌ ' + result.error);
  }
};

// ============================================================
// 🔒 \u5bc6\u7801\u9501\u7ba1\u7406\u51fd\u6570
// ============================================================

window.__setPwd = function() {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u8bbe\u7f6e8\u4f4d\u6570\u5b57\u5bc6\u7801</label>
        <input type="password" id="new-pwd-1" class="lock-input" maxlength="8" inputmode="numeric" placeholder="\u8f93\u51658\u4f4d\u6570\u5b57" autocomplete="off">
        <input type="password" id="new-pwd-2" class="lock-input mt-8" maxlength="8" inputmode="numeric" placeholder="\u518d\u6b21\u8f93\u5165\u786e\u8ba4" autocomplete="off">
      </div>
      <button class="btn-primary btn-full" onclick="window.__doSetPwd()">\u786e\u8ba4\u8bbe\u7f6e</button>
    </div>
  `;
  const sheet = openBottomSheet('\u8bbe\u7f6e\u5bc6\u7801', html);
  window.__currentSheet = sheet;
  document.getElementById('new-pwd-1').focus();

  window.__doSetPwd = async () => {
    const p1 = document.getElementById('new-pwd-1').value.trim();
    const p2 = document.getElementById('new-pwd-2').value.trim();
    if (!/^\d{8}$/.test(p1)) { toast('\u5bc6\u7801\u5fc5\u987b\u662f8\u4f4d\u6570\u5b57'); return; }
    if (p1 !== p2) { toast('\u4e24\u6b21\u8f93\u5165\u4e0d\u4e00\u81f4'); return; }
    const result = await setPassword(p1);
    if (result.success) {
      toast('\u5bc6\u7801\u5df2\u8bbe\u7f6e');
      sheet.close();
      window.__showSettings();
    } else {
      toast(result.error);
    }
  };
};

window.__changePwd = function() {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u65e7\u5bc6\u7801</label>
        <input type="password" id="old-pwd" class="lock-input" maxlength="8" inputmode="numeric" placeholder="\u8f93\u5165\u65e7\u5bc6\u7801" autocomplete="off">
      </div>
      <div class="form-group">
        <label>\u65b0\u5bc6\u7801（8\u4f4d\u6570\u5b57）</label>
        <input type="password" id="chg-pwd-1" class="lock-input" maxlength="8" inputmode="numeric" placeholder="\u8f93\u5165\u65b0\u5bc6\u7801" autocomplete="off">
        <input type="password" id="chg-pwd-2" class="lock-input mt-8" maxlength="8" inputmode="numeric" placeholder="\u518d\u6b21\u8f93\u5165\u786e\u8ba4" autocomplete="off">
      </div>
      <button class="btn-primary btn-full" onclick="window.__doChangePwd()">\u786e\u8ba4\u4fee\u6539</button>
    </div>
  `;
  const sheet = openBottomSheet('\u4fee\u6539\u5bc6\u7801', html);
  window.__currentSheet = sheet;
  document.getElementById('old-pwd').focus();

  window.__doChangePwd = async () => {
    const oldP = document.getElementById('old-pwd').value.trim();
    const p1 = document.getElementById('chg-pwd-1').value.trim();
    const p2 = document.getElementById('chg-pwd-2').value.trim();
    if (!/^\d{8}$/.test(p1)) { toast('\u65b0\u5bc6\u7801\u5fc5\u987b\u662f8\u4f4d\u6570\u5b57'); return; }
    if (p1 !== p2) { toast('\u4e24\u6b21\u8f93\u5165\u4e0d\u4e00\u81f4'); return; }
    const result = await changePassword(oldP, p1);
    if (result.success) {
      toast('\u5bc6\u7801\u5df2\u4fee\u6539');
      sheet.close();
    } else {
      toast(result.error);
    }
  };
};

window.__removePwd = function() {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u8f93\u5165\u5bc6\u7801\u4ee5\u5173\u95ed\u5bc6\u7801\u9501</label>
        <input type="password" id="rm-pwd" class="lock-input" maxlength="8" inputmode="numeric" placeholder="\u8f93\u5165\u5f53\u524d\u5bc6\u7801" autocomplete="off">
        <div class="form-hint">\u5173\u95ed\u540e\u8d44\u4ea7\u7ba1\u7406\u4e0d\u518d\u9700\u8981\u5bc6\u7801</div>
      </div>
      <button class="btn-danger-outline btn-full" onclick="window.__doRemovePwd()">\u786e\u8ba4\u5173\u95ed</button>
    </div>
  `;
  const sheet = openBottomSheet('\u5173\u95ed\u5bc6\u7801\u9501', html);
  window.__currentSheet = sheet;
  document.getElementById('rm-pwd').focus();

  window.__doRemovePwd = async () => {
    const pwd = document.getElementById('rm-pwd').value.trim();
    const result = await removePassword(pwd);
    if (result.success) {
      toast('\u5bc6\u7801\u9501\u5df2\u5173\u95ed');
      sheet.close();
      window.__showSettings();
    } else {
      toast(result.error);
    }
  };
};

window.__saveSettings = async function() {
  const apiKey = document.getElementById('set-apikey').value.trim();
  const summaryHour = parseInt(document.getElementById('set-summary-hour').value);
  const height = document.getElementById('set-height').value;
  const targetWeight = document.getElementById('set-target-weight').value;

  await setSetting('geminiApiKey', apiKey);
  await setSetting('summaryHour', summaryHour);
  await setSetting('height', height);
  await setSetting('targetWeight', targetWeight);

  // \u4fdd\u5b58\u5065\u5eb7\u6307\u6807
  await setSetting('healthProfile', {
    height: height,
    targetWeight: targetWeight,
    healthIndicators: ['\u4f4e\u5bc6\u5ea6\u8102\u86cb\u767d\u8fc7\u9ad8', '\u80c6\u56fa\u9187\u8fc7\u9ad8'],
    dietRestrictions: ['\u4f4e\u80c6\u56fa\u9187', '\u4f4e\u9971\u548c\u8102\u80aa', '\u9ad8\u7ea4\u7ef4', '\u5c11\u6cb9\u70b8'],
  });

  toast('\u8bbe\u7f6e\u5df2\u4fdd\u5b58');
  if (window.__currentSheet) window.__currentSheet.close();
};

window.__exportData = async function() {
  const { exportBackupFile } = await import('./backup.js');
  await exportBackupFile();
  toast('\u5907\u4efd\u6587\u4ef6\u5df2\u4e0b\u8f7d\u5230\u624b\u673a');
};

window.__manualBackup = async function() {
  const { backupToLocalStorage } = await import('./backup.js');
  const result = await backupToLocalStorage();
  if (result.success) {
    toast(`\u5df2\u5907\u4efd ${result.count} \u6761\u8bb0\u5f55`);
    const el = document.getElementById('backup-status');
    if (el) el.textContent = '✅ ' + formatBackupTime();
  } else {
    toast('\u5907\u4efd\u5931\u8d25：' + (result.error || '\u5b58\u50a8\u7a7a\u95f4\u4e0d\u8db3'));
  }
};

window.__importData = function() {
  const input = document.getElementById('import-file-input');
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('\u5bfc\u5165\u5907\u4efd\u5c06\u8986\u76d6\u5f53\u524d\u6570\u636e，\u786e\u5b9a\u7ee7\u7eed\u5417？')) return;
    try {
      const { importBackupFile } = await import('./backup.js');
      const result = await importBackupFile(file);
      toast(`\u5df2\u6062\u590d ${result.restored} \u6761\u8bb0\u5f55`);
      if (window.__currentSheet) window.__currentSheet.close();
      location.reload();
    } catch (err) {
      toast('\u5bfc\u5165\u5931\u8d25：' + err.message);
    }
  };
  input.click();
};

window.__clearData = async function() {
  if (!confirm('\u786e\u5b9a\u6e05\u7a7a\u6240\u6709\u6570\u636e\u5417？\u6b64\u64cd\u4f5c\u4e0d\u53ef\u6062\u590d！')) return;
  if (!confirm('\u518d\u6b21\u786e\u8ba4：\u6240\u6709\u4efb\u52a1、\u4f53\u91cd、\u996e\u98df、\u8d37\u6b3e\u6570\u636e\u90fd\u5c06\u5220\u9664！')) return;
  const stores = ['tasks', 'workLogs', 'pingpongSessions', 'englishProgress', 'weights', 'meals', 'loans', 'incomes', 'repayments'];
  for (const s of stores) {
    const { clear } = await import('./db.js');
    await clear(s);
  }
  // \u540c\u6b65\u6e05\u7a7a localStorage \u5907\u4efd
  localStorage.removeItem('workbuddy_backup');
  localStorage.removeItem('workbuddy_backup_time');
  toast('\u6570\u636e\u5df2\u6e05\u7a7a');
  location.reload();
};

window.__showAbout = function() {
  openBottomSheet('\u5173\u4e8e', `
    <div class="about-content">
      <div class="about-logo">💼</div>
      <h3>\u4e2a\u4eba\u5de5\u4f5c\u53f0</h3>
      <p class="about-version">\u7248\u672c 1.0.0</p>
      <p class="about-desc">\u4e13\u4e3a\u4fdd\u9669\u4e1a\u52a1\u5458\u6253\u9020\u7684\u4e00\u7ad9\u5f0f\u79fb\u52a8\u5de5\u4f5c\u53f0</p>
      <div class="about-features">
        <div class="about-feature">📋 \u4fdd\u9669\u5de5\u4f5c\u7ba1\u7406</div>
        <div class="about-feature">🏓 \u4e52\u4e53\u7403\u65f6\u95f4\u89c4\u5212</div>
        <div class="about-feature">📚 \u82f1\u8bed\u53e3\u8bed\u5b66\u4e60</div>
        <div class="about-feature">📰 \u70ed\u70b9\u65b0\u95fb\u8d44\u8baf</div>
        <div class="about-feature">⚖️ \u51cf\u80a5\u996e\u98df\u7ba1\u7406</div>
        <div class="about-feature">💰 \u5b58\u6b3e\u8fd8\u6b3e\u7ba1\u7406</div>
      </div>
      <p class="about-privacy">🔒 \u6240\u6709\u6570\u636e\u4fdd\u5b58\u5728\u672c\u5730，\u4e0d\u4e0a\u4f20\u4efb\u4f55\u670d\u52a1\u5668</p>
      <p class="about-tip">💡 \u53ef\u6dfb\u52a0\u5230\u624b\u673a\u684c\u9762，\u50cfApp\u4e00\u6837\u4f7f\u7528</p>
    </div>
  `);
};

// ============================================================
// \u5b9a\u65f6\u603b\u7ed3\u68c0\u67e5
// ============================================================

async function checkScheduledSummary() {
  const lastSummary = await getSetting('lastSummaryDate', '');
  const todayStr = today();
  const now = new Date();
  const summaryHour = await getSetting('summaryHour', 21);

  if (now.getHours() >= summaryHour && lastSummary !== todayStr) {
    // \u89e6\u53d1\u603b\u7ed3
    const { showDailySummary } = await import('./modules/work.js');
    await showDailySummary();
    await setSetting('lastSummaryDate', todayStr);
  }
}

// ============================================================
// \u5e94\u7528\u521d\u59cb\u5316
// ============================================================

async function init() {
  // \u66b4\u9732\u5bfc\u822a\u51fd\u6570
  window.__navigate = navigate;

  // \u5237\u65b0\u529f\u80fd：\u6e05\u9664 SW \u7f13\u5b58 + \u91cd\u65b0\u52a0\u8f7d\u9875\u9762
  window.__refreshApp = async function() {
    const btn = document.querySelector('.header-refresh');
    if (btn) {
      btn.classList.add('spinning');
      // \u7ed9\u4e00\u70b9\u52a8\u753b\u65f6\u95f4
      await new Promise(r => setTimeout(r, 300));
    }
    // \u5148\u5907\u4efd\u5f53\u524d\u6570\u636e，\u9632\u6b62\u4e22\u5931
    try { await import('./backup.js').then(m => m.backupToLocalStorage()); } catch(e) {}
    // \u5c1d\u8bd5\u6e05\u9664 Service Worker \u7f13\u5b58\u540e\u5237\u65b0
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch(e) {}
    // \u5f3a\u5236\u91cd\u65b0\u52a0\u8f7d（\u4e0d\u8d70\u7f13\u5b58）
    window.location.reload();
  };

  // 🛡️ \u542f\u52a8\u65f6\u81ea\u52a8\u68c0\u6d4b：\u5982\u679c IndexedDB \u88ab\u6e05\u7a7a\u4f46 localStorage \u6709\u5907\u4efd → \u81ea\u52a8\u6062\u590d
  try {
    const restoreResult = await autoRestoreIfNeeded();
    if (restoreResult.restored) {
      toast(`\u68c0\u6d4b\u5230\u6570\u636e\u4e22\u5931，\u5df2\u81ea\u52a8\u6062\u590d ${restoreResult.count} \u6761\u8bb0\u5f55`);
    }
  } catch (e) {
    console.warn('\u81ea\u52a8\u6062\u590d\u68c0\u6d4b\u5931\u8d25:', e);
  }

  // ☁️ \u4e91\u540c\u6b65：\u542f\u52a8\u65f6\u81ea\u52a8\u4ece Gist \u62c9\u53d6\u6700\u65b0\u6570\u636e
  if (isSyncEnabled()) {
    try {
      const syncResult = await autoSyncOnStart();
      if (syncResult.synced) {
        toast(`☁️ \u5df2\u4ece\u4e91\u7aef\u540c\u6b65 ${syncResult.count} \u6761\u8bb0\u5f55`);
      }
    } catch (e) {
      console.warn('\u4e91\u540c\u6b65\u5931\u8d25:', e);
    }
  }

  // \u521d\u59cb\u5316\u5404\u6a21\u5757
  await Promise.all([
    initWork(),
    initWeight(),
    initFinance(),
    initEnglish(),
    initPingpong(),
    initNews(),
    initAI(),
  ]);

  // \u521d\u59cb\u5316\u9ed8\u8ba4\u5065\u5eb7\u6307\u6807
  const health = await getSetting('healthProfile', null);
  if (!health) {
    await setSetting('healthProfile', {
      healthIndicators: ['\u4f4e\u5bc6\u5ea6\u8102\u86cb\u767d\u8fc7\u9ad8', '\u80c6\u56fa\u9187\u8fc7\u9ad8'],
      dietRestrictions: ['\u4f4e\u80c6\u56fa\u9187', '\u4f4e\u9971\u548c\u8102\u80aa', '\u9ad8\u7ea4\u7ef4', '\u5c11\u6cb9\u70b8'],
    });
  }

  // \u521d\u59cb\u5316\u9ed8\u8ba4\u603b\u7ed3\u65f6\u95f4
  const sh = await getSetting('summaryHour', null);
  if (sh === null) await setSetting('summaryHour', 21);

  // \u6ce8\u518c Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      // \u76d1\u542c SW \u66f4\u65b0，\u81ea\u52a8\u5237\u65b0\u9875\u9762
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('Service Worker \u5df2\u66f4\u65b0，\u5237\u65b0\u9875\u9762...');
          window.location.reload();
        }
      });
      // \u68c0\u6d4b\u5230\u65b0 SW \u7b49\u5f85\u4e2d\u65f6，\u7acb\u5373\u6fc0\u6d3b
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // \u65b0 SW \u5df2\u5b89\u88c5，\u901a\u77e5\u5b83\u8df3\u8fc7\u7b49\u5f85
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    } catch (e) {
      console.log('SW\u6ce8\u518c\u5931\u8d25（\u4e0d\u5f71\u54cd\u4f7f\u7528）:', e);
    }
  }

  // 🛡️ \u542f\u52a8\u65f6\u7acb\u5373\u5907\u4efd\u4e00\u6b21（\u786e\u4fdd localStorage \u6709\u6700\u65b0\u526f\u672c）
  backupToLocalStorage().catch(() => {});

  // 🛡️ \u6bcf 5 \u5206\u949f\u81ea\u52a8\u5907\u4efd\u4e00\u6b21（\u9632 iOS Safari \u968f\u65f6\u6e05\u7a7a IndexedDB）
  setInterval(() => {
    backupToLocalStorage().catch(() => {});
    // ☁️ \u540c\u65f6\u89e6\u53d1\u4e91\u540c\u6b65（\u5982\u679c\u542f\u7528）
    scheduleAutoSync();
  }, 5 * 60 * 1000);

  // 🛡️ \u9875\u9762\u4ece\u540e\u53f0\u5207\u56de\u524d\u53f0\u65f6\u7acb\u5373\u5907\u4efd（\u7528\u6237\u5207\u56de App \u65f6\u6570\u636e\u6700\u65b0）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      backupToLocalStorage().catch(() => {});
      // ☁️ \u5207\u56de\u524d\u53f0\u65f6\u4e5f\u62c9\u53d6\u4e91\u7aef\u6700\u65b0（\u53e6\u4e00\u53f0\u8bbe\u5907\u53ef\u80fd\u6709\u66f4\u65b0）
      if (isSyncEnabled()) {
        autoSyncOnStart().catch(() => {});
      }
    }
  });

  // 🛡️ \u9875\u9762\u5173\u95ed\u524d\u7d27\u6025\u5907\u4efd + \u4e91\u540c\u6b65
  window.addEventListener('pagehide', () => {
    backupToLocalStorage().catch(() => {});
    if (isSyncEnabled()) {
      pushToCloud().catch(() => {});
    }
  });

  // \u79fb\u52a8\u7aef\u9ed8\u8ba4\u6536\u8d77\u4fa7\u8fb9\u680f
  if (isMobile()) {
    document.getElementById('sidebar').classList.add('mobile-closed');
  }

  // \u7a97\u53e3\u5927\u5c0f\u53d8\u5316\u65f6\u91cd\u7f6e\u4fa7\u8fb9\u680f\u72b6\u6001
  window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!isMobile()) {
      sidebar.classList.remove('mobile-open', 'mobile-closed');
      overlay.classList.remove('show');
    } else {
      sidebar.classList.remove('collapsed');
      document.getElementById('main-wrapper').classList.remove('expanded');
      if (!sidebar.classList.contains('mobile-open')) {
        sidebar.classList.add('mobile-closed');
      }
    }
  });

  // \u6e32\u67d3\u9ed8\u8ba4\u9875\u9762
  await navigate('home');

  // \u542f\u52a8\u5b9a\u65f6\u68c0\u67e5
  checkScheduledSummary();
  setInterval(checkScheduledSummary, 10 * 60 * 1000);
}

// DOM \u5c31\u7eea\u540e\u542f\u52a8
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
