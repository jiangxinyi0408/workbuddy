// ============================================================
// modules/work.js - \u6a21\u57571：\u4fdd\u9669\u5de5\u4f5c\u53f0
// ============================================================

import { put, bulkPut, getAll, del, getByIndex, getByRange, getSetting } from '../db.js';
import { genId, today, tomorrow, fmtDate, fmtTime, weekRange, weekdayName, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';

let initialized = false;

export async function initWork() {
  if (initialized) return;
  initialized = true;

  // 1. \u6e05\u7406\u4e4b\u524d\u56e0\u65e7\u7248\u5ef6\u7eed\u903b\u8f91\u5806\u79ef\u7684\u91cd\u590d\u4efb\u52a1（\u4e00\u6b21\u6027）
  await dedupeCarriedOverTasks();

  // 2. \u672a\u5b8c\u6210\u7684\u903e\u671f\u4efb\u52a1\u81ea\u52a8\u5ef6\u7eed\u5230\u4eca\u5929（\u76f4\u63a5\u4fee\u6539\u539f\u4efb\u52a1\u65e5\u671f，\u4e0d\u590d\u5236\u65b0\u4efb\u52a1）
  await carryOverOverdueTasks();
}

// \u628a\u6240\u6709\u672a\u5b8c\u6210\u4e14\u903e\u671f\u7684\u4efb\u52a1\u76f4\u63a5\u987a\u5ef6\u5230\u4eca\u5929，\u907f\u514d\u591a\u5929\u7d2f\u79ef\u7ffb\u500d
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

// \u4e00\u6b21\u6027\u6e05\u7406：\u5220\u9664\u540c\u4e00\u65e5\u671f\u5185 title+category \u5b8c\u5168\u76f8\u540c\u7684\u91cd\u590d\u4efb\u52a1
// \u4fdd\u7559 createdAt \u6700\u65e9\u7684\u90a3\u4e00\u6761，\u5220\u9664\u5176\u4f59\u526f\u672c
async function dedupeCarriedOverTasks() {
  const allTasks = await getAll('tasks');
  // \u6309 dueDate + title + category \u5206\u7ec4
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
    // \u4fdd\u7559 createdAt \u6700\u65e9\u7684，\u5220\u9664\u5176\u4f59
    group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i]);
    }
  }

  if (toDelete.length > 0) {
    for (const t of toDelete) {
      await del('tasks', t.id);
    }
    console.log(`\u6e05\u7406\u4e86 ${toDelete.length} \u6761\u91cd\u590d\u4efb\u52a1`);
  }
}

// ============================================================
// \u4efb\u52a1\u7ba1\u7406
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
// \u5de5\u4f5c\u65e5\u5fd7
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
// \u6e32\u67d3：\u4fdd\u9669\u5de5\u4f5c\u53f0\u4e3b\u9875\u9762
// ============================================================

let currentFilter = 'today';
let currentCategory = ''; // '' = \u5168\u90e8\u5206\u7c7b

export async function renderWork(container) {
  // \u5148\u83b7\u53d6\u6240\u6709\u4efb\u52a1，\u63d0\u53d6\u6709\u672a\u5b8c\u6210\u4efb\u52a1\u7684\u5206\u7c7b\u5217\u8868
  const allTasks = await getAll('tasks');
  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const categories = [...new Set(pendingTasks.map(t => t.category).filter(c => c && c.trim()))].sort();

  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentFilter==='today'?'active':''}" onclick="window.__workFilter('today')">\u4eca\u5929</button>
      <button class="filter-tab ${currentFilter==='tomorrow'?'active':''}" onclick="window.__workFilter('tomorrow')">\u660e\u5929</button>
      <button class="filter-tab ${currentFilter==='week'?'active':''}" onclick="window.__workFilter('week')">\u672c\u5468</button>
      <button class="filter-tab ${currentFilter==='all'?'active':''}" onclick="window.__workFilter('all')">\u5168\u90e8</button>
      <button class="filter-tab ${currentFilter==='done'?'active':''}" onclick="window.__workFilter('done')">\u5df2\u5b8c\u6210</button>
    </div>
    ${categories.length > 0 ? `
    <div class="filter-tabs" style="top:calc(var(--header-h) + 41px)">
      <button class="filter-tab ${currentCategory===''?'active':''}" onclick="window.__workCategory('')">📋 \u5168\u90e8</button>
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
    if (await confirmDialog('\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u4efb\u52a1\u5417？')) {
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
      w.document.write(`<html><head><title>\u56fe\u7247\u9884\u89c8</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#000"><img src="${task.image}" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`);
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

  // \u6309\u5206\u7c7b\u7b5b\u9009
  if (currentCategory) {
    filtered = filtered.filter(t => t.category === currentCategory);
  }

  // \u6392\u5e8f：\u672a\u5b8c\u6210\u5728\u524d，\u6309\u4f18\u5148\u7ea7
  filtered.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-text">\u6682\u65e0\u4efb\u52a1，\u70b9\u51fb + \u6dfb\u52a0</div>
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
        <div class="task-title">${escapeHtml(t.title)}${t.carriedOver ? ' <span style="font-size:11px;color:var(--primary);background:var(--gray-100);padding:1px 6px;border-radius:4px;margin-left:4px">📋 \u5ef6\u7eed</span>' : ''}</div>
        ${t.image ? `<div style="margin-top:6px"><img src="${t.image}" style="max-height:120px;border-radius:8px;cursor:pointer" onclick="window.__viewTaskImage('${t.id}')"></div>` : ''}
        <div class="task-meta">
          <span class="task-tag ${t.priority}">${t.priority==='high'?'\u9ad8\u4f18\u5148\u7ea7':t.priority==='medium'?'\u4e2d\u4f18\u5148\u7ea7':'\u4f4e\u4f18\u5148\u7ea7'}</span>
          ${t.dueDate ? `<span class="task-tag">${fmtDate(t.dueDate)} ${weekdayName(t.dueDate)}</span>` : ''}
          ${t.carriedOver && t.originalDueDate ? `<span class="task-tag" style="color:var(--gray-400)">\u539f\u5b9a：${t.originalDueDate.slice(5)}</span>` : ''}
          ${t.category ? `<span class="task-tag">${escapeHtml(t.category)}</span>` : ''}
          ${t.estimateHours ? `<span class="task-tag">\u9884\u8ba1${t.estimateHours}h</span>` : ''}
        </div>
      </div>
      <button class="task-edit" onclick="event.stopPropagation();window.__editTask('${t.id}')" title="\u7f16\u8f91">✎</button>
      <button class="task-delete" onclick="window.__deleteTask('${t.id}')">✕</button>
    </li>
  `).join('')}</ul>`;
}

// ============================================================
// \u6dfb\u52a0\u4efb\u52a1\u5bf9\u8bdd\u6846
// ============================================================

function showAddTaskDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u4efb\u52a1\u5185\u5bb9</label>
        <textarea id="task-title" placeholder="\u8f93\u5165\u9700\u8981\u5b8c\u6210\u7684\u5de5\u4f5c..." rows="2"></textarea>
      </div>
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <select id="task-date">
          <option value="${today()}">\u4eca\u5929 (${weekdayName(today())})</option>
          <option value="${tomorrow()}">\u660e\u5929 (${weekdayName(tomorrow())})</option>
          <option value="custom">\u81ea\u5b9a\u4e49\u65e5\u671f</option>
        </select>
      </div>
      <div class="form-group" id="custom-date-group" style="display:none">
        <label>\u81ea\u5b9a\u4e49\u65e5\u671f</label>
        <input type="date" id="task-custom-date">
      </div>
      <div class="form-group">
        <label>\u4f18\u5148\u7ea7</label>
        <select id="task-priority">
          <option value="high">\u9ad8\u4f18\u5148\u7ea7</option>
          <option value="medium" selected>\u4e2d\u4f18\u5148\u7ea7</option>
          <option value="low">\u4f4e\u4f18\u5148\u7ea7</option>
        </select>
      </div>
      <div class="form-group">
        <label>\u4e1a\u52a1\u5206\u7c7b（\u53ef\u9009）</label>
        <input type="text" id="task-category" placeholder="\u5982：\u8f66\u9669、\u4f01\u8d22\u9669、\u7406\u8d54...">
        <div class="category-quick-tags" id="category-quick-tags">
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u8f66\u9669'">\u8f66\u9669</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u4f01\u8d22\u9669'">\u4f01\u8d22\u9669</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u7406\u8d54'">\u7406\u8d54</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u5bff\u9669'">\u5bff\u9669</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u5065\u5eb7\u9669'">\u5065\u5eb7\u9669</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u5ba2\u6237\u7ef4\u62a4'">\u5ba2\u6237\u7ef4\u62a4</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u7eed\u4fdd'">\u7eed\u4fdd</button>
        </div>
      </div>
      <div class="form-group">
        <label>\u9884\u8ba1\u8017\u65f6（\u5c0f\u65f6，\u53ef\u9009）</label>
        <input type="number" id="task-hours" step="0.5" min="0.5" placeholder="\u5982：1.5">
      </div>
      <div class="form-group">
        <label>📷 \u56fe\u7247\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="file" id="task-image" accept="image/*" capture="environment">
        <div id="task-image-preview"></div>
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveTask()">\u4fdd\u5b58\u4efb\u52a1</button>
    </div>
  `;

  const sheet = openBottomSheet('\u6dfb\u52a0\u4efb\u52a1', html);
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
    if (!title) { toast('\u8bf7\u8f93\u5165\u4efb\u52a1\u5185\u5bb9'); return; }
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
    toast('\u4efb\u52a1\u5df2\u6dfb\u52a0');
    sheet.close();
    renderWork(document.getElementById('main-content'));
  };
}

// ============================================================
// \u7f16\u8f91\u4efb\u52a1\u5bf9\u8bdd\u6846
// ============================================================

async function showEditTaskDialog(container, id) {
  const allTasks = await getAll('tasks');
  const task = allTasks.find(t => t.id === id);
  if (!task) { toast('\u4efb\u52a1\u4e0d\u5b58\u5728'); return; }

  const isToday = task.dueDate === today();
  const isTomorrow = task.dueDate === tomorrow();
  const presetDate = isToday ? today() : (isTomorrow ? tomorrow() : 'custom');

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u4efb\u52a1\u5185\u5bb9</label>
        <textarea id="task-title" rows="2">${escapeHtml(task.title)}</textarea>
      </div>
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <select id="task-date">
          <option value="${today()}" ${presetDate===today()?'selected':''}>\u4eca\u5929 (${weekdayName(today())})</option>
          <option value="${tomorrow()}" ${presetDate===tomorrow()?'selected':''}>\u660e\u5929 (${weekdayName(tomorrow())})</option>
          <option value="custom" ${presetDate==='custom'?'selected':''}>\u81ea\u5b9a\u4e49\u65e5\u671f</option>
        </select>
      </div>
      <div class="form-group" id="custom-date-group" style="display:${presetDate==='custom'?'block':'none'}">
        <label>\u81ea\u5b9a\u4e49\u65e5\u671f</label>
        <input type="date" id="task-custom-date" value="${task.dueDate}">
      </div>
      <div class="form-group">
        <label>\u4f18\u5148\u7ea7</label>
        <select id="task-priority">
          <option value="high" ${task.priority==='high'?'selected':''}>\u9ad8\u4f18\u5148\u7ea7</option>
          <option value="medium" ${task.priority==='medium'?'selected':''}>\u4e2d\u4f18\u5148\u7ea7</option>
          <option value="low" ${task.priority==='low'?'selected':''}>\u4f4e\u4f18\u5148\u7ea7</option>
        </select>
      </div>
      <div class="form-group">
        <label>\u4e1a\u52a1\u5206\u7c7b（\u53ef\u9009）</label>
        <input type="text" id="task-category" value="${escapeHtml(task.category || '')}" placeholder="\u5982：\u8f66\u9669、\u4f01\u8d22\u9669、\u7406\u8d54...">
        <div class="category-quick-tags">
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u8f66\u9669'">\u8f66\u9669</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u4f01\u8d22\u9669'">\u4f01\u8d22\u9669</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u7406\u8d54'">\u7406\u8d54</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u5bff\u9669'">\u5bff\u9669</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u5065\u5eb7\u9669'">\u5065\u5eb7\u9669</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u5ba2\u6237\u7ef4\u62a4'">\u5ba2\u6237\u7ef4\u62a4</button>
          <button type="button" class="cat-quick-btn" onclick="document.getElementById('task-category').value='\u7eed\u4fdd'">\u7eed\u4fdd</button>
        </div>
      </div>
      <div class="form-group">
        <label>\u9884\u8ba1\u8017\u65f6（\u5c0f\u65f6，\u53ef\u9009）</label>
        <input type="number" id="task-hours" step="0.5" min="0.5" value="${task.estimateHours || ''}" placeholder="\u5982：1.5">
      </div>
      <div class="form-group">
        <label>📷 \u56fe\u7247\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="file" id="task-image" accept="image/*" capture="environment">
        <div id="task-image-preview">
          ${task.image ? `<img src="${task.image}" style="max-height:100px;border-radius:8px;margin-top:8px"><div style="font-size:11px;color:var(--gray-400);margin-top:4px">\u5df2\u6709\u56fe\u7247，\u9009\u62e9\u65b0\u56fe\u7247\u5c06\u66ff\u6362</div>` : ''}
        </div>
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateTask()">\u4fdd\u5b58\u4fee\u6539</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delTaskFromEdit('${id}')">\u5220\u9664\u6b64\u4efb\u52a1</button>
    </div>
  `;

  const sheet = openBottomSheet('\u7f16\u8f91\u4efb\u52a1', html);

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
        `<img src="${taskImageData}" style="max-height:100px;border-radius:8px;margin-top:8px"><div style="font-size:11px;color:var(--gray-400);margin-top:4px">\u65b0\u56fe\u7247\u5df2\u9009\u62e9</div>`;
    };
    reader.readAsDataURL(file);
  };

  window.__updateTask = async () => {
    const title = document.getElementById('task-title').value.trim();
    if (!title) { toast('\u8bf7\u8f93\u5165\u4efb\u52a1\u5185\u5bb9'); return; }
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
    toast('\u4efb\u52a1\u5df2\u66f4\u65b0');
    sheet.close();
    renderWork(document.getElementById('main-content'));
  };

  window.__delTaskFromEdit = async (delId) => {
    if (await confirmDialog('\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u4efb\u52a1\u5417？')) {
      await deleteTask(delId);
      toast('\u5df2\u5220\u9664');
      sheet.close();
      renderWork(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// \u6279\u91cf\u6dfb\u52a0\u4efb\u52a1
// ============================================================

function showBatchAddTaskDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u6279\u91cf\u4efb\u52a1（\u6bcf\u884c\u4e00\u4e2a\u4efb\u52a1）</label>
        <textarea id="batch-tasks" placeholder="\u6bcf\u884c\u8f93\u5165\u4e00\u4e2a\u4efb\u52a1，\u4f8b\u5982：&#10;\u8054\u7cfb\u5f20\u603b\u786e\u8ba4\u8f66\u9669\u7eed\u4fdd&#10;\u6574\u7406\u4f01\u8d22\u9669\u62a5\u4ef7\u5355&#10;\u8ddf\u8fdb\u674e\u59d0\u7406\u8d54\u8fdb\u5ea6" rows="8" style="font-size:14px;line-height:1.6"></textarea>
        <div class="form-hint">\u6bcf\u884c\u4e00\u4e2a\u4efb\u52a1，\u7a7a\u884c\u81ea\u52a8\u5ffd\u7565</div>
      </div>
      <div class="form-group">
        <label>\u7edf\u4e00\u65e5\u671f</label>
        <select id="batch-date">
          <option value="${today()}">\u4eca\u5929 (${weekdayName(today())})</option>
          <option value="${tomorrow()}">\u660e\u5929 (${weekdayName(tomorrow())})</option>
          <option value="custom">\u81ea\u5b9a\u4e49\u65e5\u671f</option>
        </select>
      </div>
      <div class="form-group" id="batch-custom-date-group" style="display:none">
        <label>\u81ea\u5b9a\u4e49\u65e5\u671f</label>
        <input type="date" id="batch-custom-date">
      </div>
      <div class="form-group">
        <label>\u7edf\u4e00\u4f18\u5148\u7ea7</label>
        <select id="batch-priority">
          <option value="high">\u9ad8\u4f18\u5148\u7ea7</option>
          <option value="medium" selected>\u4e2d\u4f18\u5148\u7ea7</option>
          <option value="low">\u4f4e\u4f18\u5148\u7ea7</option>
        </select>
      </div>
      <div class="form-group">
        <label>\u7edf\u4e00\u4e1a\u52a1\u5206\u7c7b（\u53ef\u9009）</label>
        <input type="text" id="batch-category" placeholder="\u5982：\u8f66\u9669、\u4f01\u8d22\u9669、\u7406\u8d54...">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBatchTasks()">\u6279\u91cf\u6dfb\u52a0</button>
    </div>
  `;

  const sheet = openBottomSheet('\u6279\u91cf\u6dfb\u52a0\u4efb\u52a1', html);
  window.__currentSheet = sheet;

  document.getElementById('batch-date').onchange = (e) => {
    document.getElementById('batch-custom-date-group').style.display = e.target.value === 'custom' ? 'block' : 'none';
  };

  window.__saveBatchTasks = async () => {
    const text = document.getElementById('batch-tasks').value.trim();
    if (!text) { toast('\u8bf7\u8f93\u5165\u4efb\u52a1\u5185\u5bb9'); return; }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) { toast('\u8bf7\u8f93\u5165\u4efb\u52a1\u5185\u5bb9'); return; }

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
    toast(`\u5df2\u6dfb\u52a0 ${tasks.length} \u4e2a\u4efb\u52a1`);
    sheet.close();
    renderWork(document.getElementById('main-content'));
  };
}

// ============================================================
// \u6bcf\u65e5\u5de5\u4f5c\u603b\u7ed3
// ============================================================

export async function showDailySummary() {
  const todayStr = today();
  const tomorrowStr = tomorrow();
  const allTasks = await getAll('tasks');

  const todayTasks = allTasks.filter(t => t.dueDate === todayStr);
  const todayDone = todayTasks.filter(t => t.status === 'done');
  const todayPending = todayTasks.filter(t => t.status === 'pending');
  const tomorrowTasks = allTasks.filter(t => t.dueDate === tomorrowStr && t.status === 'pending');

  // \u5de5\u4f5c\u65e5\u5fd7
  const workLogs = await getByIndex('workLogs', 'date', todayStr);
  let workHours = 0;
  if (workLogs.length > 0) {
    workHours = workLogs.reduce((sum, l) => sum + (l.actualHours || 0), 0);
  }

  // \u5b8c\u6210\u7387
  const completionRate = todayTasks.length > 0
    ? Math.round(todayDone.length / todayTasks.length * 100)
    : 0;

  // \u667a\u80fd\u9884\u4f30
  let prediction = '';
  const predictionData = await getWorkPrediction();
  if (predictionData) {
    prediction = predictionData.summary;
  }

  const html = `
    <div class="summary-card">
      <div class="summary-header">
        <div class="summary-title">📊 \u4eca\u65e5\u5de5\u4f5c\u603b\u7ed3</div>
        <div class="summary-date">${fmtDate(new Date())} ${weekdayName(todayStr)}</div>
      </div>

      <div class="summary-section">
        <div class="summary-section-title">\u4eca\u65e5\u5b8c\u6210\u60c5\u51b5</div>
        <div class="summary-stat-row">
          <span class="summary-stat-label">\u603b\u4efb\u52a1\u6570</span>
          <span class="summary-stat-value">${todayTasks.length}</span>
        </div>
        <div class="summary-stat-row">
          <span class="summary-stat-label">\u5df2\u5b8c\u6210</span>
          <span class="summary-stat-value text-success">${todayDone.length}</span>
        </div>
        <div class="summary-stat-row">
          <span class="summary-stat-label">\u672a\u5b8c\u6210</span>
          <span class="summary-stat-value text-danger">${todayPending.length}</span>
        </div>
        <div class="summary-stat-row">
          <span class="summary-stat-label">\u5b8c\u6210\u7387</span>
          <span class="summary-stat-value">${completionRate}%</span>
        </div>
        ${workHours > 0 ? `
        <div class="summary-stat-row">
          <span class="summary-stat-label">\u5b9e\u9645\u5de5\u4f5c\u65f6\u957f</span>
          <span class="summary-stat-value">${workHours} \u5c0f\u65f6</span>
        </div>` : ''}
      </div>

      ${todayPending.length > 0 ? `
      <div class="summary-section">
        <div class="summary-section-title">⏰ \u4eca\u65e5\u672a\u5b8c\u6210</div>
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
        <div class="summary-section-title">📅 \u660e\u5929\u5f85\u529e (${tomorrowTasks.length})</div>
        ${tomorrowTasks.length > 0 ? `
        <ul class="summary-task-list">
          ${tomorrowTasks.map(t => `
            <li class="summary-task">
              <span class="summary-task-dot" style="background:var(--primary)"></span>
              <span>${escapeHtml(t.title)}</span>
            </li>
          `).join('')}
        </ul>` : '<div class="text-gray text-sm">\u660e\u5929\u6682\u65e0\u5f85\u529e，\u8bb0\u5f97\u63d0\u524d\u89c4\u5212</div>'}
      </div>

      ${prediction ? `
      <div class="summary-section">
        <div class="summary-section-title">🤖 \u667a\u80fd\u9884\u4f30</div>
        <div class="text-sm" style="color:var(--gray-600);line-height:1.6">${prediction}</div>
      </div>` : ''}

      <button class="summary-btn" onclick="window.__closeSummary()">\u77e5\u9053\u4e86</button>
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
// \u667a\u80fd\u5de5\u4f5c\u65f6\u95f4\u63a8\u7b97（\u6ee11\u4e2a\u6708\u6570\u636e\u540e\u6fc0\u6d3b）
// ============================================================

async function getWorkPrediction() {
  const allLogs = await getAll('workLogs');
  const allTasks = await getAll('tasks');

  // \u9700\u8981\u81f3\u5c1130\u5929\u6570\u636e
  if (allLogs.length < 7) return null;

  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // \u8fc7\u53bb30\u5929\u7684\u5de5\u4f5c\u65e5\u5fd7
  const recentLogs = allLogs.filter(l => new Date(l.date) >= thirtyDaysAgo);
  if (recentLogs.length < 7) return null;

  // \u8ba1\u7b97\u5e73\u5747\u6bcf\u5929\u5de5\u4f5c\u65f6\u957f
  const totalHours = recentLogs.reduce((sum, l) => sum + (l.actualHours || 0), 0);
  const avgHoursPerDay = totalHours / recentLogs.length;

  // \u8ba1\u7b97\u5e73\u5747\u6bcf\u5929\u4efb\u52a1\u6570\u548c\u5b8c\u6210\u7387
  const recentDates = recentLogs.map(l => l.date);
  const recentTasks = allTasks.filter(t => recentDates.includes(t.dueDate));
  const avgTasksPerDay = recentTasks.length / recentLogs.length;
  const doneTasks = recentTasks.filter(t => t.status === 'done');
  const completionRate = recentTasks.length > 0 ? doneTasks.length / recentTasks.length : 0.8;

  // \u660e\u5929\u5f85\u529e
  const tomorrowStr = tomorrow();
  const tomorrowTasks = allTasks.filter(t => t.dueDate === tomorrowStr && t.status === 'pending');

  if (tomorrowTasks.length === 0) return null;

  // \u6309\u4f18\u5148\u7ea7\u4f30\u7b97\u8017\u65f6
  const priorityHours = { high: 1.5, medium: 1.0, low: 0.5 };
  let estimatedHours = 0;
  tomorrowTasks.forEach(t => {
    if (t.estimateHours) {
      estimatedHours += t.estimateHours;
    } else {
      estimatedHours += priorityHours[t.priority] || 1.0;
    }
  });

  // \u6839\u636e\u5b8c\u6210\u7387\u8c03\u6574（\u5b8c\u6210\u7387\u4f4e\u610f\u5473\u7740\u53ef\u80fd\u9700\u8981\u66f4\u591a\u65f6\u95f4）
  const adjustedHours = completionRate > 0 ? estimatedHours / completionRate : estimatedHours;
  const suggestStart = Math.max(8, 18 - Math.ceil(adjustedHours));

  const summary = `\u57fa\u4e8e\u4f60\u8fd130\u5929\u6570\u636e：\u5e73\u5747\u6bcf\u5929\u5de5\u4f5c ${avgHoursPerDay.toFixed(1)} \u5c0f\u65f6，\u65e5\u5747\u5904\u7406 ${avgTasksPerDay.toFixed(1)} \u9879\u4efb\u52a1，\u5b8c\u6210\u7387 ${Math.round(completionRate * 100)}%。\u660e\u5929\u6709 ${tomorrowTasks.length} \u9879\u5f85\u529e，\u9884\u8ba1\u9700\u8981 ${adjustedHours.toFixed(1)} \u5c0f\u65f6，\u5efa\u8bae ${suggestStart}:00 \u5f00\u59cb\u5de5\u4f5c。`;

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
// \u9996\u9875 Dashboard \u5361\u7247
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
        <div class="dash-card-title">📋 \u6bcf\u65e5\u4e1a\u52a1\u5b89\u6392</div>
        <div class="dash-card-more">\u67e5\u770b\u5168\u90e8 ›</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${todayPending.length}</div>
          <div class="dash-stat-label">\u5f85\u5b8c\u6210</div>
        </div>
        <div class="dash-stat success">
          <div class="dash-stat-num">${todayDone.length}</div>
          <div class="dash-stat-label">\u5df2\u5b8c\u6210</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${completionRate}%</div>
          <div class="dash-stat-label">\u5b8c\u6210\u7387</div>
        </div>
        <div class="dash-stat">
          <div class="dash-stat-num">${tomorrowTasks.length}</div>
          <div class="dash-stat-label">\u660e\u65e5\u5f85\u529e</div>
        </div>
      </div>
      ${todayPending.length > 0 ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)">
        <div class="text-xs text-gray mb-8">\u5f85\u529e\u4e8b\u9879</div>
        ${todayPending.slice(0, 3).map(t => `
          <div class="text-sm" style="padding:4px 0">• ${escapeHtml(t.title)}</div>
        `).join('')}
        ${todayPending.length > 3 ? `<div class="text-xs text-gray mt-8">\u8fd8\u6709 ${todayPending.length - 3} \u9879...</div>` : ''}
      </div>` : '<div class="text-sm text-gray text-center mt-16">\u4eca\u5929\u4efb\u52a1\u90fd\u5b8c\u6210\u4e86 🎉</div>'}
    </div>
  `;
}
