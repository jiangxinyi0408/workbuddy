// ============================================================
// modules/work.js - 模块1：保险工作台
// ============================================================

import { put, bulkPut, getAll, del, getByIndex, getByRange, getSetting } from '../db.js';
import { genId, today, tomorrow, fmtDate, fmtTime, weekRange, weekdayName, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';

let initialized = false;

export async function initWork() {
  if (initialized) return;
  initialized = true;

  // 1. 清理之前因旧版延续逻辑堆积的重复任务（一次性）
  await dedupeCarriedOverTasks();

  // 2. 未完成的逾期任务自动延续到今天（直接修改原任务日期，不复制新任务）
  await carryOverOverdueTasks();
}

// 把所有未完成且逾期的任务直接顺延到今天，避免多天累积翻倍
async function carryOverOverdueTasks() {
  const todayStr = today();
  const allTasks = await getAll('tasks');
  const overdue = allTasks.filter(t => t.status === 'pending' && t.dueDate < todayStr);
  if (overdue.length === 0) return;

  const toUpdate = [];
  for (const task of overdue) {
    task.originalDueDate = task.originalDueDate || task.dueDate;
    task.dueDate = todayStr;
    task.carriedOver = true;
    task.updatedAt = new Date().toISOString();
    toUpdate.push(task);
  }
  if (toUpdate.length > 0) {
    await bulkPut('tasks', toUpdate);
  }
}

// 一次性清理：删除同一日期内 title+category 完全相同的重复任务
// 保留 createdAt 最早的那一条，删除其余副本
async function dedupeCarriedOverTasks() {
  const allTasks = await getAll('tasks');
  // 按 dueDate + title + category 分组
  const groups = {};
  for (const t of allTasks) {
    if (t.status !== 'pending') continue;
    const key = `${t.dueDate}||${(t.title || '').trim()}||${t.category || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const toDelete = [];
  for (const key in groups) {
    const group = groups[key];
    if (group.length <= 1) continue;
    // 保留 createdAt 最早的，删除其余
    group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i]);
    }
  }

  if (toDelete.length > 0) {
    for (const t of toDelete) {
      await del('tasks', t.id);
    }
    console.log(`清理了 ${toDelete.length} 条重复任务`);
  }
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
    image: data.image || null,
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
let currentCategory = ''; // '' = 全部分类

export async function renderWork(container) {
  // 先获取所有任务，提取有未完成任务的分类列表
  const allTasks = await getAll('tasks');
  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const categories = [...new Set(pendingTasks.map(t => t.category).filter(c => c && c.trim()))].sort();

  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentFilter==='today'?'active':''}" onclick="window.__workFilter('today')">今天</button>
      <button class="filter-tab ${currentFilter==='tomorrow'?'active':''}" onclick="window.__workFilter('tomorrow')">明天</button>
      <button class="filter-tab ${currentFilter==='week'?'active':''}" onclick="window.__workFilter('week')">本周</button>
      <button class="filter-tab ${currentFilter==='all'?'active':''}" onclick="window.__workFilter('all')">全部</button>
      <button class="filter-tab ${currentFilter==='done'?'active':''}" onclick="window.__workFilter('done')">已完成</button>
    </div>
    ${categories.length > 0 ? `
    <div class="filter-tabs" style="top:calc(var(--header-h) + 41px)">
      <button class="filter-tab ${currentCategory===''?'active':''}" onclick="window.__workCategory('')">📋 全部</button>
      ${categories.map(cat => `
        <button class="filter-tab ${currentCategory===cat?'active':''}" onclick="window.__workCategory('${escapeHtml(cat)}')">${escapeHtml(cat)}</button>
      `).join('')}
    </div>
    ` : ''}
    <div id="task-list-container"></div>
    <button class="fab" onclick="window.__addTask()" style="right:72px">+</button>
    <button class="fab fab-secondary" onclick="window.__batchAddTask()">≡</button>
  `;

  window.__workFilter = (f) => { currentFilter = f; renderWork(container); };
  window.__workCategory = (c) => { currentCategory = c; renderWork(container); };
  window.__addTask = () => showAddTaskDialog(container);
  window.__batchAddTask = () => showBatchAddTaskDialog(container);
  window.__toggleTask = async (id) => { await toggleTask(id); renderWork(container); };
  window.__deleteTask = async (id) => {
    if (await confirmDialog('确定删除这个任务吗？')) {
      await deleteTask(id);
      renderWork(container);
    }
  };
  window.__editTask = (id) => showEditTaskDialog(container, id);
  window.__viewTaskImage = async (id) => {
    const tasks = await getAll('tasks');
    const task = tasks.find(t => t.id === id);
    if (!task || !task.image) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<html><head><title>图片预览</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#000"><img src="${task.image}" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`);
      w.document.close();
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

  // 按分类筛选
  if (currentCategory) {
    filtered = filtered.filter(t => t.category === currentCategory);
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
        <div class="task-title">${escapeHtml(t.title)}${t.carriedOver ? ' <span style="font-size:11px;color:var(--primary);background:var(--gray-100);padding:1px 6px;border-radius:4px;margin-left:4px">📋 延续</span>' : ''}</div>
        ${t.image ? `<div style="margin-top:6px"><img src="${t.image}" style="max-height:120px;border-radius:8px;cursor:pointer" onclick="window.__viewTaskImage('${t.id}')"></div>` : ''}
        <div class="task-meta">
          <span class="task-tag ${t.priority}">${t.priority==='high'?'高优先级':t.priority==='medium'?'中优先级':'低优先级'}</span>
          ${t.dueDate ? `<span class="task-tag">${fmtDate(t.dueDate)} ${weekdayName(t.dueDate)}</span>` : ''}
          ${t.carriedOver && t.originalDueDate ? `<span class="task-tag" style="color:var(--gray-400)">原定：${t.originalDueDate.slice(5)}</span>` : ''}
          ${t.category ? `<span class="task-tag">${escapeHtml(t.category)}</span>` : ''}
          ${t.estimateHours ? `<span class="task-tag">预计${t.estimateHours}h</span>` : ''}
        </div>
      </div>
      <button class="task-edit" onclick="event.stopPropagation();window.__editTask('${t.id}')" title="编辑">✎</button>
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
        <div class="category-quick-tags" id="category-quick-tags">
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='车险'">车险</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='企财险'">企财险</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='理赔'">理赔</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='寿险'">寿险</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='健康险'">健康险</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='客户维护'">客户维护</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='续保'">续保</button>
        </div>
      </div>
      <div class="form-group">
        <label>预计耗时（小时，可选）</label>
        <input type="number" id="task-hours" step="0.5" min="0.5" placeholder="如：1.5">
      </div>
      <div class="form-group">
        <label>📷 图片备注（可选）</label>
        <input type="file" id="task-image" accept="image/*" capture="environment">
        <div id="task-image-preview"></div>
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveTask()">保存任务</button>
    </div>
  `;

  const sheet = openBottomSheet('添加任务', html);
  window.__currentSheet = sheet;

  document.getElementById('task-date').onchange = (e) => {
    document.getElementById('custom-date-group').style.display = e.target.value === 'custom' ? 'block' : 'none';
  };

  let taskImageData = null;
  document.getElementById('task-image').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      taskImageData = ev.target.result;
      document.getElementById('task-image-preview').innerHTML =
        `<img src="${taskImageData}" style="max-height:100px;border-radius:8px;margin-top:8px">`;
    };
    reader.readAsDataURL(file);
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
      image: taskImageData || null,
    });
    toast('任务已添加');
    sheet.close();
    renderWork(document.getElementById('main-content'));
  };
}

// ============================================================
// 编辑任务对话框
// ============================================================

async function showEditTaskDialog(container, id) {
  const allTasks = await getAll('tasks');
  const task = allTasks.find(t => t.id === id);
  if (!task) { toast('任务不存在'); return; }

  const isToday = task.dueDate === today();
  const isTomorrow = task.dueDate === tomorrow();
  const presetDate = isToday ? today() : (isTomorrow ? tomorrow() : 'custom');

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>任务内容</label>
        <textarea id="task-title" rows="2">${escapeHtml(task.title)}</textarea>
      </div>
      <div class="form-group">
        <label>日期</label>
        <select id="task-date">
          <option value="${today()}" ${presetDate===today()?'selected':''}>今天 (${weekdayName(today())})</option>
          <option value="${tomorrow()}" ${presetDate===tomorrow()?'selected':''}>明天 (${weekdayName(tomorrow())})</option>
          <option value="custom" ${presetDate==='custom'?'selected':''}>自定义日期</option>
        </select>
      </div>
      <div class="form-group" id="custom-date-group" style="display:${presetDate==='custom'?'block':'none'}">
        <label>自定义日期</label>
        <input type="date" id="task-custom-date" value="${task.dueDate}">
      </div>
      <div class="form-group">
        <label>优先级</label>
        <select id="task-priority">
          <option value="high" ${task.priority==='high'?'selected':''}>高优先级</option>
          <option value="medium" ${task.priority==='medium'?'selected':''}>中优先级</option>
          <option value="low" ${task.priority==='low'?'selected':''}>低优先级</option>
        </select>
      </div>
      <div class="form-group">
        <label>业务分类（可选）</label>
        <input type="text" id="task-category" value="${escapeHtml(task.category || '')}" placeholder="如：车险、企财险、理赔...">
        <div class="category-quick-tags">
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='车险'">车险</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='企财险'">企财险</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='理赔'">理赔</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='寿险'">寿险</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='健康险'">健康险</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='客户维护'">客户维护</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='续保'">续保</button>
        </div>
      </div>
      <div class="form-group">
        <label>预计耗时（小时，可选）</label>
        <input type="number" id="task-hours" step="0.5" min="0.5" value="${task.estimateHours || ''}" placeholder="如：1.5">
      </div>
      <div class="form-group">
        <label>📷 图片备注（可选）</label>
        <input type="file" id="task-image" accept="image/*" capture="environment">
        <div id="task-image-preview">
          ${task.image ? `<img src="${task.image}" style="max-height:100px;border-radius:8px;margin-top:8px"><div style="font-size:11px;color:var(--gray-400);margin-top:4px">已有图片，选择新图片将替换</div>` : ''}
        </div>
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateTask()">保存修改</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delTaskFromEdit('${id}')">删除此任务</button>
    </div>
  `;

  const sheet = openBottomSheet('编辑任务', html);

  document.getElementById('task-date').onchange = (e) => {
    document.getElementById('custom-date-group').style.display = e.target.value === 'custom' ? 'block' : 'none';
  };

  let taskImageData = task.image || null;
  document.getElementById('task-image').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      taskImageData = ev.target.result;
      document.getElementById('task-image-preview').innerHTML =
        `<img src="${taskImageData}" style="max-height:100px;border-radius:8px;margin-top:8px"><div style="font-size:11px;color:var(--gray-400);margin-top:4px">新图片已选择</div>`;
    };
    reader.readAsDataURL(file);
  };

  window.__updateTask = async () => {
    const title = document.getElementById('task-title').value.trim();
    if (!title) { toast('请输入任务内容'); return; }
    let dueDate = document.getElementById('task-date').value;
    if (dueDate === 'custom') {
      dueDate = document.getElementById('task-custom-date').value || today();
    }
    task.title = title;
    task.dueDate = dueDate;
    task.priority = document.getElementById('task-priority').value;
    task.category = document.getElementById('task-category').value.trim();
    task.estimateHours = parseFloat(document.getElementById('task-hours').value) || null;
    task.image = taskImageData;
    task.updatedAt = new Date().toISOString();
    await put('tasks', task);
    toast('任务已更新');
    sheet.close();
    renderWork(document.getElementById('main-content'));
  };

  window.__delTaskFromEdit = async (delId) => {
    if (await confirmDialog('确定删除这个任务吗？')) {
      await deleteTask(delId);
      toast('已删除');
      sheet.close();
      renderWork(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// 批量添加任务
// ============================================================

function showBatchAddTaskDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>批量任务（每行一个任务）</label>
        <textarea id="batch-tasks" placeholder="每行输入一个任务，例如：&#10;联系张总确认车险续保&#10;整理企财险报价单&#10;跟进李姐理赔进度" rows="8" style="font-size:14px;line-height:1.6"></textarea>
        <div class="form-hint">每行一个任务，空行自动忽略</div>
      </div>
      <div class="form-group">
        <label>统一日期</label>
        <select id="batch-date">
          <option value="${today()}">今天 (${weekdayName(today())})</option>
          <option value="${tomorrow()}">明天 (${weekdayName(tomorrow())})</option>
          <option value="custom">自定义日期</option>
        </select>
      </div>
      <div class="form-group" id="batch-custom-date-group" style="display:none">
        <label>自定义日期</label>
        <input type="date" id="batch-custom-date">
      </div>
      <div class="form-group">
        <label>统一优先级</label>
        <select id="batch-priority">
          <option value="high">高优先级</option>
          <option value="medium" selected>中优先级</option>
          <option value="low">低优先级</option>
        </select>
      </div>
      <div class="form-group">
        <label>统一业务分类（可选）</label>
        <input type="text" id="batch-category" placeholder="如：车险、企财险、理赔...">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBatchTasks()">批量添加</button>
    </div>
  `;

  const sheet = openBottomSheet('批量添加任务', html);
  window.__currentSheet = sheet;

  document.getElementById('batch-date').onchange = (e) => {
    document.getElementById('batch-custom-date-group').style.display = e.target.value === 'custom' ? 'block' : 'none';
  };

  window.__saveBatchTasks = async () => {
    const text = document.getElementById('batch-tasks').value.trim();
    if (!text) { toast('请输入任务内容'); return; }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) { toast('请输入任务内容'); return; }

    let dueDate = document.getElementById('batch-date').value;
    if (dueDate === 'custom') {
      dueDate = document.getElementById('batch-custom-date').value || today();
    }
    const priority = document.getElementById('batch-priority').value;
    const category = document.getElementById('batch-category').value.trim();

    const tasks = lines.map(title => ({
      id: genId(),
      title,
      type: 'daily',
      dueDate,
      priority,
      status: 'pending',
      category,
      estimateHours: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    }));

    await bulkPut('tasks', tasks);
    toast(`已添加 ${tasks.length} 个任务`);
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
        <div class="dash-card-title">📋 每日业务安排</div>
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
