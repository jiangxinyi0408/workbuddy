// ============================================================
// app.js - 主应用：路由、初始化、导航
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

// 页面定义
const PAGES = {
  home: { title: '当日安排', render: renderHome },
  work: { title: '每日业务安排', render: renderWork },
  pingpong: { title: '打球时间', render: renderPingpong },
  english: { title: '英语能力提升', render: renderEnglish },
  weight: { title: '健康管理', render: renderWeight },
  news: { title: '每日资讯', render: renderNews },
  finance: { title: '资产管理', render: renderFinance },
  ai: { title: '了解AI', render: renderAI },
  more: { title: '设置', render: renderMore },
};

let currentPage = 'home';

// ============================================================
// 侧边栏控制
// ============================================================

// 移动端默认收起；桌面端默认展开
function isMobile() {
  return window.innerWidth <= 768;
}

export function toggleSidebar(forceState) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const wrapper = document.getElementById('main-wrapper');

  if (isMobile()) {
    // 移动端：抽屉式
    const willOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('mobile-open');
    sidebar.classList.remove('mobile-closed');
    sidebar.classList.toggle('mobile-open', willOpen);
    if (!willOpen) sidebar.classList.add('mobile-closed');
    overlay.classList.toggle('show', willOpen);
  } else {
    // 桌面端：折叠/展开
    const willCollapse = forceState !== undefined ? !forceState : !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', willCollapse);
    wrapper.classList.toggle('expanded', willCollapse);
  }
}

window.__toggleSidebar = toggleSidebar;

// ============================================================
// 路由
// ============================================================

export async function navigate(page) {
  if (!PAGES[page]) page = 'home';
  currentPage = page;
  const config = PAGES[page];

  // 更新标题
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = config.title;

  // 更新侧边导航高亮
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // 移动端点击后关闭侧边栏
  if (isMobile()) {
    toggleSidebar(false);
  }

  // 渲染页���内容
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  main.scrollTop = 0;

  // 🔒 导航离开资产管理时清除验证标记（下次进入需重新解锁）
  if (page !== 'finance' && isAuthed()) {
    clearAuth();
  }

  // 🔒 资产管理密码锁
  if (page === 'finance' && hasPassword() && !isAuthed()) {
    await showFinanceLock(main);
    window.scrollTo(0, 0);
    return;
  }
  // 🔒 首次进入 finance 但未设密码 → 引导设置
  if (page === 'finance' && !hasPassword()) {
    await showSetPasswordScreen(main);
    window.scrollTo(0, 0);
    return;
  }

  // 显示加载状态
  main.innerHTML = '<div class="loading"><div class="spinner"></div><p>加载中...</p></div>';

  try {
    await config.render(main);
  } catch (err) {
    console.error('页面渲染错误:', err);
    main.innerHTML = `<div class="error-page"><p>加载失败</p><button onclick="location.reload()">重试</button></div>`;
  }

  // 滚动恢复
  window.scrollTo(0, 0);
}

// ============================================================
// 🔒 资产管理密码锁界面
// ============================================================

async function showFinanceLock(container) {
  const lockRemaining = getLockRemaining();

  const renderLockScreen = (msg, isError) => {
    const locked = getLockRemaining();
    container.innerHTML = `
      <div class="lock-screen">
        <div class="lock-icon">${locked > 0 ? '⏳' : '🔒'}</div>
        <div class="lock-title">资产管理</div>
        ${locked > 0 ? `
          <div class="lock-warning">已锁定</div>
          <div class="lock-countdown" id="lock-countdown">${locked} 秒后可重试</div>
          <button class="btn-outline mt-16" onclick="window.__navigate('home')">返回首页</button>
        ` : `
          <div class="lock-hint">请输入8位数字密码</div>
          <input type="password" id="lock-pwd" class="lock-input" maxlength="8" inputmode="numeric" placeholder="••••••••" autocomplete="off">
          <button class="btn-primary btn-full mt-16" onclick="window.__unlockFinance()">解锁</button>
          ${msg ? `<div class="lock-error">${escapeHtml(msg)}</div>` : ''}
          ${isError ? '' : `<div class="text-xs text-gray mt-16">提示：密码为8位纯数字</div>`}
          <button class="btn-outline mt-16" onclick="window.__navigate('home')">返回首页</button>
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
      el.textContent = `${remain} 秒后可重试`;
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1000);
  };

  window.__unlockFinance = async () => {
    const input = document.getElementById('lock-pwd');
    if (!input) return;
    const pwd = input.value.trim();
    if (!/^\d{8}$/.test(pwd)) {
      renderLockScreen('请输入8位数字密码', true);
      return;
    }
    const result = await verifyPassword(pwd);
    if (result.success) {
      toast('解锁成功');
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
// 🔒 首次设置密码界面
// ============================================================

async function showSetPasswordScreen(container) {
  container.innerHTML = `
    <div class="lock-screen">
      <div class="lock-icon">🔐</div>
      <div class="lock-title">设置资产管理密码</div>
      <div class="lock-hint">为保护财务隐私，请设置8位数字密码</div>
      <input type="password" id="set-pwd-1" class="lock-input" maxlength="8" inputmode="numeric" placeholder="输入8位数字密码" autocomplete="off">
      <input type="password" id="set-pwd-2" class="lock-input mt-8" maxlength="8" inputmode="numeric" placeholder="再次输入确认" autocomplete="off">
      <button class="btn-primary btn-full mt-16" onclick="window.__confirmSetPwd()">设置密码</button>
      <button class="btn-outline mt-8" onclick="window.__navigate('home')">暂不设置</button>
      <div class="text-xs text-gray mt-16">密码为8位纯数字，建议不要用生日</div>
    </div>
  `;
  document.getElementById('set-pwd-1').focus();

  window.__confirmSetPwd = async () => {
    const p1 = document.getElementById('set-pwd-1').value.trim();
    const p2 = document.getElementById('set-pwd-2').value.trim();
    if (!/^\d{8}$/.test(p1)) { toast('密码必须是8位数字'); return; }
    if (p1 !== p2) { toast('两次输入不一致'); return; }
    const result = await setPassword(p1);
    if (result.success) {
      toast('密码已设置');
      navigate('finance');
    } else {
      toast(result.error);
    }
  };
}

// ============================================================
// 首页 Dashboard
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
  return '欢迎小姜总';
}

// ============================================================
// "更多"页面
// ============================================================

async function renderMore(container) {
  container.innerHTML = `
    <div class="more-page">
      <div class="more-section">
        <h3 class="more-section-title">学习提升</h3>
        <div class="more-item" onclick="window.__navigate('english')">
          <div class="more-icon" style="background:#8b5cf6">📚</div>
          <div class="more-info"><div class="more-name">英语学习</div><div class="more-desc">90天口语提升计划</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.__navigate('news')">
          <div class="more-icon" style="background:#f59e0b">📰</div>
          <div class="more-info"><div class="more-name">热点资讯</div><div class="more-desc">国内外新闻速览</div></div>
          <div class="more-arrow">›</div>
        </div>
      </div>

      <div class="more-section">
        <h3 class="more-section-title">生活管理</h3>
        <div class="more-item" onclick="window.__navigate('pingpong')">
          <div class="more-icon" style="background:#06b6d4">🏓</div>
          <div class="more-info"><div class="more-name">乒乓球时间</div><div class="more-desc">活动登记与空闲时间</div></div>
          <div class="more-arrow">›</div>
        </div>
      </div>

      <div class="more-section">
        <h3 class="more-section-title">设置</h3>
        <div class="more-item" onclick="window.__showSettings()">
          <div class="more-icon" style="background:#6b7280">⚙️</div>
          <div class="more-info"><div class="more-name">应用设置</div><div class="more-desc">AI配置、定时总结、数据管理</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.__showAbout()">
          <div class="more-icon" style="background:#6b7280">ℹ️</div>
          <div class="more-info"><div class="more-name">关于</div><div class="more-desc">版本信息与使用帮助</div></div>
          <div class="more-arrow">›</div>
        </div>
      </div>

      <div class="more-footer">个人工作台 v1.0 · 数据本地存储</div>
    </div>
  `;
}

// ============================================================
// 设置面板
// ============================================================

window.__showSettings = async function() {
  const apiKey = await getSetting('geminiApiKey', '');
  const summaryHour = await getSetting('summaryHour', 21);
  const height = await getSetting('height', '');
  const targetWeight = await getSetting('targetWeight', '');

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>🤖 Gemini API Key（用于食物识别和饮食推荐）</label>
        <input type="text" id="set-apikey" value="${apiKey}" placeholder="可选，留空则使用手动模式">
        <div class="form-hint">到 <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> 免费获取</div>
      </div>

      <div class="form-group">
        <label>🕐 每日工作总结时间</label>
        <select id="set-summary-hour">
          ${[18,19,20,21,22,23].map(h => `<option value="${h}" ${h==summaryHour?'selected':''}>${h}:00</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>📏 身高（cm）</label>
        <input type="number" id="set-height" value="${height}" placeholder="用于计算BMI">
      </div>

      <div class="form-group">
        <label>⚖️ 目标体重（kg）</label>
        <input type="number" id="set-target-weight" value="${targetWeight}" placeholder="你的减肥目标">
      </div>

      <div class="form-group">
        <label>💊 健康指标（已预填）</label>
        <div class="health-tags">
          <span class="health-tag">低密度脂蛋白过高</span>
          <span class="health-tag">胆固醇过高</span>
        </div>
        <div class="form-hint">饮食推荐将基于这些指标生成</div>
      </div>

      <div class="form-group">
        <label>💾 数据备份与恢复</label>
        <div class="backup-status" id="backup-status">⏳ 读取中...</div>
        <div class="data-actions">
          <button class="btn-outline" onclick="window.__manualBackup()">📥 立即备份</button>
          <button class="btn-outline" onclick="window.__exportData()">📤 导出文件</button>
        </div>
        <div class="data-actions mt-8">
          <button class="btn-outline" onclick="window.__importData()">📂 导入文件</button>
          <button class="btn-danger-outline" onclick="window.__clearData()">🗑 清空数据</button>
        </div>
        <input type="file" id="import-file-input" accept=".json" style="display:none">
        <div class="form-hint">自动备份每5分钟执行一次，切换App回来时也会备份</div>
      </div>

      <div class="form-group">
        <label>☁️ 云同步（多设备同步）</label>
        <div class="sync-status" id="sync-status">⏳ 读取中...</div>
        <div class="data-actions" id="sync-actions">
          <button class="btn-outline" onclick="window.__setupSync()">⚙️ 设置同步</button>
        </div>
        <div class="form-hint">通过 GitHub Gist 在 iPhone/iPad 间自动同步数据</div>
      </div>

      <div class="form-group">
        <label>🔒 资产管理密码锁</label>
        <div class="lock-setting-status" id="lock-status">⏳ 读取中...</div>
        <div class="data-actions">
          ${hasPassword() ? `
            <button class="btn-outline" onclick="window.__changePwd()">修改密码</button>
            <button class="btn-danger-outline" onclick="window.__removePwd()">关闭密码锁</button>
          ` : `
            <button class="btn-primary" onclick="window.__setPwd()">设置密码</button>
          `}
        </div>
        <div class="form-hint">保护资产管理模块，错误5次锁1分钟，10次锁5分钟</div>
      </div>

      <button class="btn-primary btn-full" onclick="window.__saveSettings()">保存设置</button>
    </div>
  `;

  const sheet = openBottomSheet('应用设置', html);
  window.__currentSheet = sheet;

  // 更新备份状态显示
  const updateBackupStatus = () => {
    const el = document.getElementById('backup-status');
    if (el) el.textContent = '✅ ' + formatBackupTime();
  };
  updateBackupStatus();

  // 更新密码锁状态显示
  const updateLockStatus = () => {
    const el = document.getElementById('lock-status');
    if (el) {
      el.textContent = hasPassword() ? '✅ 已启用密码保护' : '⚪ 未设置密码';
    }
  };
  updateLockStatus();

  // 更新云同步状态显示
  const updateSyncStatus = () => {
    const statusEl = document.getElementById('sync-status');
    const actionsEl = document.getElementById('sync-actions');
    if (!statusEl || !actionsEl) return;
    const status = getSyncStatus();
    if (status.enabled) {
      statusEl.textContent = '✅ 已启用 · ' + status.lastSync;
      actionsEl.innerHTML = `
        <button class="btn-outline" onclick="window.__syncPush()">⬆️ 立即上传</button>
        <button class="btn-outline" onclick="window.__syncPull()">⬇️ 立即拉取</button>
        <button class="btn-danger-outline" onclick="window.__disableSync()">关闭同步</button>
      `;
    } else if (status.hasToken) {
      statusEl.textContent = '⚪ Token已设置，未启用同步';
      actionsEl.innerHTML = `<button class="btn-primary" onclick="window.__enableSync()">启用同步</button>`;
    } else {
      statusEl.textContent = '⚪ 未设置';
      actionsEl.innerHTML = `<button class="btn-outline" onclick="window.__setupSync()">⚙️ 设置同步</button>`;
    }
  };
  updateSyncStatus();
};

// ============================================================
// ☁️ 云同步管理函数
// ============================================================

window.__setupSync = function() {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>GitHub Token</label>
        <input type="password" id="sync-token" class="lock-input" placeholder="ghp_xxxxxxxx" autocomplete="off" value="${getSyncStatus().hasToken ? '(已设置，输入新Token可替换)' : ''}">
        <div class="form-hint">需要一个有 gist 权限的 Token<br>到 github.com → Settings → Developer settings → Personal access tokens → Generate new token → 勾选 gist</div>
      </div>
      <button class="btn-primary btn-full" onclick="window.__verifyAndSaveToken()">验证并保存</button>
    </div>
  `;
  const sheet = openBottomSheet('设置云同步', html);
  window.__currentSheet = sheet;

  window.__verifyAndSaveToken = async () => {
    const token = document.getElementById('sync-token').value.trim();
    if (!token || token === '(已设置，输入新Token可替换)') { toast('请输入Token'); return; }
    toast('验证中...');
    const result = await verifyToken(token);
    if (result.success) {
      setSyncToken(token);
      setSyncEnabled(true);
      toast(`✅ Token验证成功，欢迎 ${result.username}`);
      sheet.close();
      // 立即推送一次
      const pushResult = await pushToCloud();
      if (pushResult.success) {
        toast(`☁️ 已上传 ${pushResult.count} 条记录`);
      }
      window.__showSettings();
    } else {
      toast('❌ ' + result.error);
    }
  };
};

window.__enableSync = function() {
  setSyncEnabled(true);
  toast('云同步已启用');
  pushToCloud().then(r => {
    if (r.success) toast(`☁️ 已上传 ${r.count} 条记录`);
  });
  window.__showSettings();
};

window.__disableSync = function() {
  if (!confirm('确定关闭云同步？关闭后多设备不再自动同步')) return;
  setSyncEnabled(false);
  toast('云同步已关闭');
  window.__showSettings();
};

window.__syncPush = async function() {
  toast('上传中...');
  const result = await pushToCloud();
  if (result.success) {
    toast(`☁️ 已上传 ${result.count} 条记录`);
    window.__showSettings();
  } else {
    toast('❌ ' + result.error);
  }
};

window.__syncPull = async function() {
  toast('拉取中...');
  const result = await pullFromCloud();
  if (result.success) {
    toast(`☁️ 已拉取 ${result.count} 条记录`);
    location.reload();
  } else {
    toast('❌ ' + result.error);
  }
};

// ============================================================
// 🔒 密码锁管理函数
// ============================================================

window.__setPwd = function() {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>设置8位数字密码</label>
        <input type="password" id="new-pwd-1" class="lock-input" maxlength="8" inputmode="numeric" placeholder="输入8位数字" autocomplete="off">
        <input type="password" id="new-pwd-2" class="lock-input mt-8" maxlength="8" inputmode="numeric" placeholder="再次输入确认" autocomplete="off">
      </div>
      <button class="btn-primary btn-full" onclick="window.__doSetPwd()">确认设置</button>
    </div>
  `;
  const sheet = openBottomSheet('设置密码', html);
  window.__currentSheet = sheet;
  document.getElementById('new-pwd-1').focus();

  window.__doSetPwd = async () => {
    const p1 = document.getElementById('new-pwd-1').value.trim();
    const p2 = document.getElementById('new-pwd-2').value.trim();
    if (!/^\d{8}$/.test(p1)) { toast('密码必须是8位数字'); return; }
    if (p1 !== p2) { toast('两次输入不一致'); return; }
    const result = await setPassword(p1);
    if (result.success) {
      toast('密码已设置');
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
        <label>旧密码</label>
        <input type="password" id="old-pwd" class="lock-input" maxlength="8" inputmode="numeric" placeholder="输入旧密码" autocomplete="off">
      </div>
      <div class="form-group">
        <label>新密码（8位数字）</label>
        <input type="password" id="chg-pwd-1" class="lock-input" maxlength="8" inputmode="numeric" placeholder="输入新密码" autocomplete="off">
        <input type="password" id="chg-pwd-2" class="lock-input mt-8" maxlength="8" inputmode="numeric" placeholder="再次输入确认" autocomplete="off">
      </div>
      <button class="btn-primary btn-full" onclick="window.__doChangePwd()">确认修改</button>
    </div>
  `;
  const sheet = openBottomSheet('修改密码', html);
  window.__currentSheet = sheet;
  document.getElementById('old-pwd').focus();

  window.__doChangePwd = async () => {
    const oldP = document.getElementById('old-pwd').value.trim();
    const p1 = document.getElementById('chg-pwd-1').value.trim();
    const p2 = document.getElementById('chg-pwd-2').value.trim();
    if (!/^\d{8}$/.test(p1)) { toast('新密码必须是8位数字'); return; }
    if (p1 !== p2) { toast('两次输入不一致'); return; }
    const result = await changePassword(oldP, p1);
    if (result.success) {
      toast('密码已修改');
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
        <label>输入密码以关闭密码锁</label>
        <input type="password" id="rm-pwd" class="lock-input" maxlength="8" inputmode="numeric" placeholder="输入当前密码" autocomplete="off">
        <div class="form-hint">关闭后资产管理不再需要密码</div>
      </div>
      <button class="btn-danger-outline btn-full" onclick="window.__doRemovePwd()">确认关闭</button>
    </div>
  `;
  const sheet = openBottomSheet('关闭密码锁', html);
  window.__currentSheet = sheet;
  document.getElementById('rm-pwd').focus();

  window.__doRemovePwd = async () => {
    const pwd = document.getElementById('rm-pwd').value.trim();
    const result = await removePassword(pwd);
    if (result.success) {
      toast('密码锁已关闭');
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

  // 保存健康指标
  await setSetting('healthProfile', {
    height: height,
    targetWeight: targetWeight,
    healthIndicators: ['低密度脂蛋白过高', '胆固醇过高'],
    dietRestrictions: ['低胆固醇', '低饱和脂肪', '高纤维', '少油炸'],
  });

  toast('设置已保存');
  if (window.__currentSheet) window.__currentSheet.close();
};

window.__exportData = async function() {
  const { exportBackupFile } = await import('./backup.js');
  await exportBackupFile();
  toast('备份文件已下载到手机');
};

window.__manualBackup = async function() {
  const { backupToLocalStorage } = await import('./backup.js');
  const result = await backupToLocalStorage();
  if (result.success) {
    toast(`已备份 ${result.count} 条记录`);
    const el = document.getElementById('backup-status');
    if (el) el.textContent = '✅ ' + formatBackupTime();
  } else {
    toast('备份失败：' + (result.error || '存储空间不足'));
  }
};

window.__importData = function() {
  const input = document.getElementById('import-file-input');
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('导入备份将覆盖当前数据，确定继续吗？')) return;
    try {
      const { importBackupFile } = await import('./backup.js');
      const result = await importBackupFile(file);
      toast(`已恢复 ${result.restored} 条记录`);
      if (window.__currentSheet) window.__currentSheet.close();
      location.reload();
    } catch (err) {
      toast('导入失败：' + err.message);
    }
  };
  input.click();
};

window.__clearData = async function() {
  if (!confirm('确定清空所有数据吗？此操作不可恢复！')) return;
  if (!confirm('再次确认：所有任务、体重、饮食、贷款数据都将删除！')) return;
  const stores = ['tasks', 'workLogs', 'pingpongSessions', 'englishProgress', 'weights', 'meals', 'loans', 'incomes', 'repayments'];
  for (const s of stores) {
    const { clear } = await import('./db.js');
    await clear(s);
  }
  // 同步清空 localStorage 备份
  localStorage.removeItem('workbuddy_backup');
  localStorage.removeItem('workbuddy_backup_time');
  toast('数据已清空');
  location.reload();
};

window.__showAbout = function() {
  openBottomSheet('关于', `
    <div class="about-content">
      <div class="about-logo">💼</div>
      <h3>个人工作台</h3>
      <p class="about-version">版本 1.0.0</p>
      <p class="about-desc">专为保险业务员打造的一站式移动工作台</p>
      <div class="about-features">
        <div class="about-feature">📋 保险工作管理</div>
        <div class="about-feature">🏓 乒乓球时间规划</div>
        <div class="about-feature">📚 英语口语学习</div>
        <div class="about-feature">📰 热点新闻资讯</div>
        <div class="about-feature">⚖️ 减肥饮食管理</div>
        <div class="about-feature">💰 存款还款管理</div>
      </div>
      <p class="about-privacy">🔒 所有数据保存在本地，不上传任何服务器</p>
      <p class="about-tip">💡 可添加到手机桌面，像App一样使用</p>
    </div>
  `);
};

// ============================================================
// 定时总结检查
// ============================================================

async function checkScheduledSummary() {
  const lastSummary = await getSetting('lastSummaryDate', '');
  const todayStr = today();
  const now = new Date();
  const summaryHour = await getSetting('summaryHour', 21);

  if (now.getHours() >= summaryHour && lastSummary !== todayStr) {
    // 触发总结
    const { showDailySummary } = await import('./modules/work.js');
    await showDailySummary();
    await setSetting('lastSummaryDate', todayStr);
  }
}

// ============================================================
// 应用初始化
// ============================================================

async function init() {
  // 暴露导航函数
  window.__navigate = navigate;

  // 🛡️ 启动时自动检测：如果 IndexedDB 被清空但 localStorage 有备份 → 自动恢复
  try {
    const restoreResult = await autoRestoreIfNeeded();
    if (restoreResult.restored) {
      toast(`检测到数据丢失，已自动恢复 ${restoreResult.count} 条记录`);
    }
  } catch (e) {
    console.warn('自动恢复检测失败:', e);
  }

  // ☁️ 云同步：启动时自动从 Gist 拉取最新数据
  if (isSyncEnabled()) {
    try {
      const syncResult = await autoSyncOnStart();
      if (syncResult.synced) {
        toast(`☁️ 已从云端同步 ${syncResult.count} 条记录`);
      }
    } catch (e) {
      console.warn('云同步失败:', e);
    }
  }

  // 初始化各模块
  await Promise.all([
    initWork(),
    initWeight(),
    initFinance(),
    initEnglish(),
    initPingpong(),
    initNews(),
    initAI(),
  ]);

  // 初始化默认健康指标
  const health = await getSetting('healthProfile', null);
  if (!health) {
    await setSetting('healthProfile', {
      healthIndicators: ['低密度脂蛋白过高', '胆固醇过高'],
      dietRestrictions: ['低胆固醇', '低饱和脂肪', '高纤维', '少油炸'],
    });
  }

  // 初始化默认总结时间
  const sh = await getSetting('summaryHour', null);
  if (sh === null) await setSetting('summaryHour', 21);

  // 注册 Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (e) {
      console.log('SW注册失败（不影响使用）:', e);
    }
  }

  // 🛡️ 启动时立即备份一次（确保 localStorage 有最新副本）
  backupToLocalStorage().catch(() => {});

  // 🛡️ 每 5 分钟自动备份一次（防 iOS Safari 随时清空 IndexedDB）
  setInterval(() => {
    backupToLocalStorage().catch(() => {});
    // ☁️ 同时触发云同步（如果启用）
    scheduleAutoSync();
  }, 5 * 60 * 1000);

  // 🛡️ 页面从后台切回前台时立即备份（用户切回 App 时数据最新）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      backupToLocalStorage().catch(() => {});
      // ☁️ 切回前台时也拉取云端最新（另一台设备可能有更新）
      if (isSyncEnabled()) {
        autoSyncOnStart().catch(() => {});
      }
    }
  });

  // 🛡️ 页面关闭前紧急备份 + 云同步
  window.addEventListener('pagehide', () => {
    backupToLocalStorage().catch(() => {});
    if (isSyncEnabled()) {
      pushToCloud().catch(() => {});
    }
  });

  // 移动端默认收起侧边栏
  if (isMobile()) {
    document.getElementById('sidebar').classList.add('mobile-closed');
  }

  // 窗口大小变化时重置侧边栏状态
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

  // 渲染默认页面
  await navigate('home');

  // 启动定时检查
  checkScheduledSummary();
  setInterval(checkScheduledSummary, 10 * 60 * 1000);
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
