// ============================================================
// modules/work.js - 模块1：保险工作台
// ============================================================

import { put, getAll, del, getByIndex, getByRange, getSetting } from '../db.js';
import { genId, today, tomorrow, fmtDate, fmtTime, weekRange, weekdayName, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';

let initialized = false;

export async function initWork() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// 任务管理
// ============================================================

async function addTask(data) {
  const task = {
    id: genId(),
    title: data.title,
    type: data.type || 'daily',
    dueDate: data.dueDate || today(),
    priority: data.priority || 'medium',
    status: 'pending',
    category: data.category || '',
    estimateHours: data.estimateHours || null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  await put('tasks', task);
  return task;
}

async function toggleTask(id) {
  const tasks = await getAll('tasks');
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (task.status === 'done') {
    task.status = 'pending';
    task.completedAt = null;
  } else {
    task.status = 'done';
    task.completedAt = new Date().toISOString();
  }
  await put('tasks', task);
}

async function deleteTask(id) {
  await del('tasks', id);
}

// ============================================================
// 工作日志
// ============================================================

async function logWork(data) {
  const log = {
    id: genId(),
    date: data.date || today(),
    startTime: data.startTime,
    endTime: data.endTime,
    actualHours: data.actualHours,
    taskCount: data.taskCount || 0,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  };
  await put('workLogs', log);
  return log;
}

// ============================================================
// 渲染：保险工作台主页面
// ============================================================

let currentFilter = 'today';

export async function renderWork(container) {
  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentFilter==='today'?'active':''}" onclick="window.__workFilter('today')">今天</button>
      <button class="filter-tab ${currentFilter==='tomorrow'?'active':''}" onclick="window.__workFilter('tomorrow')">明天</button>
      <button class="filter-tab ${currentFilter==='week'?'active':''}" onclick="window.__workFilter('week')">本周</button>
      <button class="filter-tab ${currentFilter==='all'?'active':''}" onclick="window.__workFilter('all')">全部</button>
      <button class="filter-tab ${currentFilter==='done'?'active':''}" onclick="window.__workFilter('done')">已完成</button>
    </div>
    <div id="task-list-container"></div>
    <button class="fab" onclick="window.__addTask()">+</button>
  `;

  window.__workFilter = (f) => { currentFilter = f; renderWork(container); };
  window.__addTask = () => showAddTaskDialog(container);
  window.__toggleTask = async (id) => { await toggleTask(id); renderWork(container); };
  window.__deleteTask = async (id) => {
    if (await confirmDialog('确定删除这个任务吗？')) {
      await deleteTask(id);
      renderWork(container);
    }
  };

  await renderTaskList();
}

async function renderTaskList() {
  const listContainer = document.getElementById('task-list-container');
  if (!listContainer) return;

  const allTasks = await getAll('tasks');
  let filtered = [];

  const todayStr = today();
  const tomorrowStr = tomorrow();
  const [wStart, wEnd] = weekRange(new Date());

  switch (currentFilter) {
    case 'today':
      filtered = allTasks.filter(t => t.dueDate === todayStr && t.status === 'pending');
      break;
    case 'tomorrow':
      filtered = allTasks.filter(t => t.dueDate === tomorrowStr && t.status === 'pending');
      break;
    case 'week':
      filtered = allTasks.filter(t => t.dueDate >= wStart && t.dueDate <= wEnd);
      break;
    case 'done':
      filtered = allTasks.filter(t => t.status === 'done');
      break;
    case 'all':
    default:
      filtered = allTasks;
      break;
  }

  // 排序：未完成在前，按优先级
  filtered.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-text">暂无任务，点击 + 添加</div>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = `<ul class="task-list">${filtered.map(t => `
    <li class="task-item ${t.status==='done'?'done':''}">
      <div class="task-checkbox ${t.status==='done'?'checked':''}" onclick="window.__toggleTask('${t.id}')">
        ${t.status==='done'?'✓':''}
      </div>
      <div class="task-content">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          <span class="task-tag ${t.priority}">${t.priority==='high'?'高优先级':t.priority==='medium'?'中优先级':'低优先级'}</span>
          ${t.dueDate ? `<span class="task-tag">${fmtDate(t.dueDate)} ${weekdayName(t.dueDate)}</span>` : ''}
          ${t.category ? `<span class="task-tag">${escapeHtml(t.category)}</span>` : ''}
          ${t.estimateHours ? `<span class="task-tag">预计${t.estimateHours}h</span>` : ''}
        </div>
      </div>
      <button class="task-delete" onclick="window.__deleteTask('${t.id}')">✕</button>
    </li>
  `).join('')}</ul>`;
}

// ============================================================
// 添加任务对话框
// ============================================================

function showAddTaskDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>任务内容</label>
        <textarea id="task-title" placeholder="输入需要完成的工作..." rows="2"></textarea>
      </div>
      <div class="form-group">
        <label>日期</label>
        <select id="task-date">
          <option value="${today()}">今天 (${weekdayName(today())})</option>
          <option value="${tomorrow()}">明天 (${weekdayName(tomorrow())})</option>
          <option value="custom">自定义日期</option>
        </select>
      </div>
      <div class="form-group" id="custom-date-group" style="display:none">
        <label>自定义日期</label>
        <input type="date" id="task-custom-date">
      </div>
      <div class="form-group">
        <label>优先级</label>
        <select id="task-priority">
          <option value="high">高优先级</option>
          <option value="medium" selected>中优先级</option>
          <option value="low">低优先级</option>
        </select>
      </div>
      <div class="form-group">
        <label>业务分类（可选）</label>
        <input type="text" id="task-category" placeholder="如：车险、企财险、理赔...">
      </div>
      <div class="form-group">
        <label>预计耗时（小时，可选）</label>
        <input type="number" id="task-hours" step="0.5" min="0.5" placeholder="如：1.5">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveTask()">保存任务</button>
    </div>
  `;

  const sheet = openBottomSheet('添加任务', html);
  window.__currentSheet = sheet;

  document.getElementById('task-date').onchange = (e) => {
    document.getElementById('custom-date-group').style.display = e.target.value === 'custom' ? 'block' : 'none';
  };

  window.__saveTask = async () => {
    const title = document.getElementById('task-title').value.trim();
    if (!title) { toast('请输入任务内容'); return; }
    let dueDate = document.getElementById('task-date').value;
    if (dueDate === 'custom') {
      dueDate = document.getElementById('task-custom-date').value || today();
    }
    await addTask({
      title,
      dueDate,
      priority: document.getElementById('task-priority').value,
      category: document.getElementById('task-category').value.trim(),
      estimateHours: parseFloat(document.getElementById('task-hours').value) || null,
    });
    toast('任务已添加');
    sheet.close();
    renderWork(document.getElementById('main-content'));
  };
}

// ============================================================
// 每日工作总结
// ============================================================

export async function showDailySummary() {
  const todayStr = today();
  const tomorrowStr = tomorrow();
  const allTasks = await getAll('tasks');

  const todayTasks = allTasks.filter(t => t.dueDate === todayStr);
  const todayDone = todayTasks.filter(t => t.status === 'done');
  const todayPending = todayTasks.filter(t => t.status === 'pending');
  const tomorrowTasks = allTasks.filter(t => t.dueDate === tomorrowStr && t.status === 'pending');

  // 工作日志
  const workLogs = await getByIndex('workLogs', 'date', todayStr);
  let workHours = 0;
  if (workLogs.length > 0) {
    workHours = workLogs.reduce((sum, l) => sum + (l.actualHours || 0), 0);
  }

  // 完成率
  const completionRate = todayTasks.length > 0
    ? Math.round(todayDone.length / todayTasks.length * 100)
    : 0;

  // 智能预估
  let prediction = '';
  const predictionData = await getWorkPrediction();
  if (predictionData) {
    prediction = predictionData.summary;
  }

  const html = `
    <div class="summary-card">
      <div class="summary-header">
        <div class="summary-title">📊 今日工作总结</div>
        <div class="summary-date">${fmtDate(new Date())} ${weekdayName(todayStr)}</div>
      </div>

      <div class="summary-section">
        <div class="summary-section-title">今日完成情况</div>
        <div class="summary-stat-row">
          <span class="summary-stat-label">总任务数</span>
          <span class="summary-stat-value">${todayTasks.length}</span>
        </div>
        <div class="summary-stat-row">
          <span class="summary-stat-label">已完成</span>
          <span class="summary-stat-value text-success">${todayDone.length}</span>
        </div>
        <div class="summary-stat-row">
          <span class="summary-stat-label">未完成</span>
          <span class="summary-stat-value text-danger">${todayPending.length}</span>
        </div>
        <div class="summary-stat-row">
          <span class="summary-stat-label">完成率</span>
          <span class="summary-stat-value">${completionRate}%</span>
        </div>
        ${workHours > 0 ? `
        <div class="summary-stat-row">
          <span class="summary-stat-label">实际工作时长</span>
          <span class="summary-stat-value">${workHours} 小时</span>
        </div>` : ''}
      </div>

      ${todayPending.length > 0 ? `
      <div class="summary-section">
        <div class="summary-section-title">⏰ 今日未完成</div>
        <ul class="summary-task-list">
          ${todayPending.map(t => `
            <li class="summary-task">
              <span class="summary-task-dot" style="background:var(--danger)"></span>
              <span>${escapeHtml(t.title)}</span>
            </li>
          `).join('')}
        </ul>
      </div>` : ''}

      <div class="summary-section">
        <div class="summary-section-title">📅 明天待办 (${tomorrowTasks.length})</div>
        ${tomorrowTasks.length > 0 ? `
        <ul class="summary-task-list">
          ${tomorrowTasks.map(t => `
            <li class="summary-task">
              <span class="summary-task-dot" style="background:var(--primary)"></span>
              <span>${escapeHtml(t.title)}</span>
            </li>
          `).join('')}
        </ul>` : '<div class="text-gray text-sm">明天暂无待办，记得提前规划</div>'}
      </div>

      ${prediction ? `
      <div class="summary-section">
        <div class="summary-section-title">🤖 智能预估</div>
        <div class="text-sm" style="color:var(--gray-600);line-height:1.6">${prediction}</div>
      </div>` : ''}

      <button class="summary-btn" onclick="window.__closeSummary()">知道了</button>
    </div>
  `;

  const overlay = document.createElement('div');
  overlay.className = 'summary-overlay';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  window.__closeSummary = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
  };
  overlay.onclick = (e) => { if (e.target === overlay) window.__closeSummary(); };
}

// ============================================================
// 智能工作时间推算（满1个月数据后激活）
// ============================================================

async function getWorkPrediction() {
  const allLogs = await getAll('workLogs');
  const allTasks = await getAll('tasks');

  // 需要至少30天数据
  if (allLogs.length < 7) return null;

  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 过去30天的工作日志
  const recentLogs = allLogs.filter(l => new Date(l.date) >= thirtyDaysAgo);
  if (recentLogs.length < 7) return null;

  // 计算平均每天工作时长
  const totalHours = recentLogs.reduce((sum, l) => sum + (l.actualHours || 0), 0);
  const avgHoursPerDay = totalHours / recentLogs.length;

  // 计算平均每天任务数和完成率
  const recentDates = recentLogs.map(l => l.date);
  const recentTasks = allTasks.filter(t => recentDates.includes(t.dueDate));
  const avgTasksPerDay = recentTasks.length / recentLogs.length;
  const doneTasks = recentTasks.filter(t => t.status === 'done');
  const completionRate = recentTasks.length > 0 ? doneTasks.length / recentTasks.length : 0.8;

  // 明天待办
  const tomorrowStr = tomorrow();
  const tomorrowTasks = allTasks.filter(t => t.dueDate === tomorrowStr && t.status === 'pending');

  if (tomorrowTasks.length === 0) return null;

  // 按优先级估算耗时
  const priorityHours = { high: 1.5, medium: 1.0, low: 0.5 };
  let estimatedHours = 0;
  tomorrowTasks.forEach(t => {
    if (t.estimateHours) {
      estimatedHours += t.estimateHours;
    } else {
      estimatedHours += priorityHours[t.priority] || 1.0;
    }
  });

  // 根据完成率调整（完成率低意味着可能需要更多时间）
  const adjustedHours = completionRate > 0 ? estimatedHours / completionRate : estimatedHours;
  const suggestStart = Math.max(8, 18 - Math.ceil(adjustedHours));

  const summary = `基于你近30天数据：平均每天工作 ${avgHoursPerDay.toFixed(1)} 小时，日均处理 ${avgTasksPerDay.toFixed(1)} 项任务，完成率 ${Math.round(completionRate * 100)}%。明天有 ${tomorrowTasks.length} 项待办，预计需要 ${adjustedHours.toFixed(1)} 小时，建议 ${suggestStart}:00 开始工作。`;

  return {
    summary,
    avgHours: avgHoursPerDay,
    avgTasks: avgTasksPerDay,
    completionRate,
    tomorrowCount: tomorrowTasks.length,
    estimatedHours: adjustedHours,
  };
}

// ============================================================
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardWork() {
  const todayStr = today();
  const tomorrowStr = tomorrow();
  const allTasks = await getAll('tasks');

  const todayTasks = allTasks.filter(t => t.dueDate === todayStr);
  const todayDone = todayTasks.filter(t => t.status === 'done');
  const todayPending = todayTasks.filter(t => t.status === 'pending');
  const tomorrowTasks = allTasks.filter(t => t.dueDate === tomorrowStr && t.status === 'pending');

  const completionRate = todayTasks.length > 0
    ? Math.round(todayDone.length / todayTasks.length * 100)
    : 0;

  return `
    <div class="dash-card" onclick="window.__navigate('work')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">📋 今日工作</div>
        <div class="dash-card-more">查看全部 ›</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${todayPending.length}</div>
          <div class="dash-stat-label">待完成</div>
        </div>
        <div class="dash-stat success">
          <div class="dash-stat-num">${todayDone.length}</div>
          <div class="dash-stat-label">已完成</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${completionRate}%</div>
          <div class="dash-stat-label">完成率</div>
        </div>
        <div class="dash-stat">
          <div class="dash-stat-num">${tomorrowTasks.length}</div>
          <div class="dash-stat-label">明日待办</div>
        </div>
      </div>
      ${todayPending.length > 0 ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)">
        <div class="text-xs text-gray mb-8">待办事项</div>
        ${todayPending.slice(0, 3).map(t => `
          <div class="text-sm" style="padding:4px 0">• ${escapeHtml(t.title)}</div>
        `).join('')}
        ${todayPending.length > 3 ? `<div class="text-xs text-gray mt-8">还有 ${todayPending.length - 3} 项...</div>` : ''}
      </div>` : '<div class="text-sm text-gray text-center mt-16">今天任务都完成了 🎉</div>'}
    </div>
  `;
}
