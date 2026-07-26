// ============================================================
// app.js - 主应用：路由、初始化、导航
// ============================================================

import { getSetting, setSetting, getAll, getByIndex, getByRange } from './db.js';
import { today, tomorrow, weekRange, fmtDate, toast, openBottomSheet } from './utils.js';
import { initWork, renderWork, dashboardWork } from './modules/work.js';
import { initWeight, renderWeight, dashboardWeight } from './modules/weight.js';
import { initFinance, renderFinance, dashboardFinance } from './modules/finance.js';
import { initEnglish, renderEnglish, dashboardEnglish } from './modules/english.js';
import { initPingpong, renderPingpong, dashboardPingpong } from './modules/pingpong.js';
import { initNews, renderNews, dashboardNews } from './news.js';

// 页面定义
const PAGES = {
  home: { title: '首页概览', render: renderHome },
  work: { title: '每日业务安排', render: renderWork },
  pingpong: { title: '打球时间', render: renderPingpong },
  english: { title: '英语能力提升', render: renderEnglish },
  weight: { title: '身材管理', render: renderWeight },
  news: { title: '每日资讯', render: renderNews },
  finance: { title: '还款进度', render: renderFinance },
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

  // 渲染页面内容
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  main.scrollTop = 0;

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
// 首页 Dashboard
// ============================================================

async function renderHome(container) {
  const [workHTML, weightHTML, financeHTML, englishHTML, pingpongHTML, newsHTML] = await Promise.all([
    dashboardWork(),
    dashboardWeight(),
    dashboardFinance(),
    dashboardEnglish(),
    dashboardPingpong(),
    dashboardNews(),
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
      ${weightHTML}
      ${financeHTML}
      ${newsHTML}
    </div>
  `;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了，注意休息';
  if (h < 9) return '早上好，新的一天开始了';
  if (h < 12) return '上午好，工作顺利';
  if (h < 14) return '中午好，记得吃饭';
  if (h < 18) return '下午好，继续加油';
  if (h < 22) return '晚上好，辛苦了';
  return '夜晚好，早点休息';
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
        <label>💾 数据管理</label>
        <div class="data-actions">
          <button class="btn-outline" onclick="window.__exportData()">导出全部数据</button>
          <button class="btn-danger-outline" onclick="window.__clearData()">清空所有数据</button>
        </div>
      </div>

      <button class="btn-primary btn-full" onclick="window.__saveSettings()">保存设置</button>
    </div>
  `;

  const sheet = openBottomSheet('应用设置', html);
  window.__currentSheet = sheet;
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
  const stores = ['tasks', 'workLogs', 'pingpongSessions', 'englishProgress', 'weights', 'meals', 'loans', 'incomes', 'repayments', 'settings'];
  const data = {};
  for (const s of stores) {
    data[s] = await getAll(s);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workbuddy-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('数据已导出');
};

window.__clearData = async function() {
  if (!confirm('确定清空所有数据吗？此操作不可恢复！')) return;
  if (!confirm('再次确认：所有任务、体重、饮食、贷款数据都将删除！')) return;
  const stores = ['tasks', 'workLogs', 'pingpongSessions', 'englishProgress', 'weights', 'meals', 'loans', 'incomes', 'repayments'];
  for (const s of stores) {
    const { clear } = await import('./db.js');
    await clear(s);
  }
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

  // 初始化各模块
  await Promise.all([
    initWork(),
    initWeight(),
    initFinance(),
    initEnglish(),
    initPingpong(),
    initNews(),
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
