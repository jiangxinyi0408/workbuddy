// ============================================================
// modules/pingpong.js - 模块2：打球时间
// 三标签：活动总览 | 打球时间 | 自由活动
// 时段支持多选：上午、下午、晚上、全天
// ============================================================

import { put, getAll, del } from '../db.js';
import { genId, today, fmtDate, weekStart, weekRange, weekdayName, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';

let initialized = false;
let currentTab = 'overview'; // 'overview' | 'schedule' | 'free'

export async function initPingpong() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// 辅助：兼容旧数据 timeSlot → timeSlots 数组
// ============================================================

const ALL_SLOTS = ['上午', '下午', '晚上'];

function getTimeSlots(item) {
  if (item.timeSlots && Array.isArray(item.timeSlots) && item.timeSlots.length > 0) {
    return item.timeSlots;
  }
  if (item.timeSlot) {
    return [item.timeSlot];
  }
  return ['晚上'];
}

function slotsLabel(slots) {
  if (!slots || slots.length === 0) return '晚上';
  if (slots.length === 3) return '全天';
  return slots.join('+');
}

// ============================================================
// 数据操作：乒乓球活动
// ============================================================

async function addSession(data) {
  const session = {
    id: genId(),
    date: data.date,
    name: data.name || '乒乓球活动',
    timeSlots: data.timeSlots || ['晚上'],
    startTime: data.startTime || '',
    duration: data.duration || 2,
    note: data.note || '',
    createdAt: new Date().toISOString(),
  };
  await put('pingpongSessions', session);
  return session;
}

export async function getWeekSessions() {
  const [wStart, wEnd] = weekRange(new Date());
  const all = await getAll('pingpongSessions');
  return all.filter(s => s.date >= wStart && s.date <= wEnd).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
}

// ============================================================
// 数据操作：自由活动
// ============================================================

async function addFreeActivity(data) {
  const activity = {
    id: genId(),
    date: data.date,
    name: data.name,
    timeSlots: data.timeSlots || ['下午'],
    startTime: data.startTime || '',
    duration: data.duration || 1,
    note: data.note || '',
    createdAt: new Date().toISOString(),
  };
  await put('freeActivities', activity);
  return activity;
}

async function getWeekFreeActivities() {
  const [wStart, wEnd] = weekRange(new Date());
  const all = await getAll('freeActivities');
  return all.filter(a => a.date >= wStart && a.date <= wEnd).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
}

// ============================================================
// 主渲染入口
// ============================================================

export async function renderPingpong(container) {
  const tabs = [
    { key: 'overview', label: '📊 活动总览' },
    { key: 'schedule', label: '🏓 打球时间' },
    { key: 'free', label: '🎯 自由活动' },
  ];

  const tabHtml = tabs.map(t => `
    <button class="filter-tab ${currentTab === t.key ? 'active' : ''}" onclick="window.__ppSwitchTab('${t.key}')">
      ${t.label}
    </button>
  `).join('');

  container.innerHTML = `
    <div class="filter-tabs" style="position:sticky;top:var(--header-h);z-index:50">${tabHtml}</div>
    <div id="pp-content-area"></div>
  `;

  window.__ppSwitchTab = (key) => {
    currentTab = key;
    renderPingpong(document.getElementById('main-content'));
  };

  await renderCurrentTab();
}

async function renderCurrentTab() {
  const area = document.getElementById('pp-content-area');
  if (!area) return;

  switch (currentTab) {
    case 'schedule': await renderScheduleTab(area); break;
    case 'overview': await renderOverviewTab(area); break;
    case 'free': await renderFreeTab(area); break;
  }
}

// ============================================================
// Tab: 打球时间（周历视图）
// ============================================================

async function renderScheduleTab(container) {
  const sessions = await getWeekSessions();

  const ws = weekStart(new Date());
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const dateStr = fmtDate(d);
    const daySessions = sessions.filter(s => s.date === dateStr);
    const isToday = dateStr === today();
    weekDays.push({
      date: dateStr,
      dayName: weekdayName(d),
      dayNum: parseInt(dateStr.slice(8)),
      isToday,
      sessions: daySessions,
      totalHours: daySessions.reduce((sum, s) => sum + (s.duration || 0), 0),
    });
  }

  const totalSessions = sessions.length;
  const totalHours = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const daysWithActivity = weekDays.filter(d => d.sessions.length > 0).length;
  const daysFree = 7 - daysWithActivity;

  const slotIcon = { '上午': '🌅', '下午': '☀️', '晚上': '🌙' };

  container.innerHTML = `
    <div class="pp-weekly-view">
      <div class="card" style="background:linear-gradient(135deg, var(--primary), #a48cc4);color:#fff;margin-bottom:16px">
        <div style="display:flex;justify-content:space-around;text-align:center;padding:8px 0">
          <div>
            <div style="font-size:24px;font-weight:700">${totalSessions}</div>
            <div style="font-size:11px;opacity:0.85">已安排活动</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${totalHours.toFixed(1)}h</div>
            <div style="font-size:11px;opacity:0.85">活动总时长</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${daysFree}</div>
            <div style="font-size:11px;opacity:0.85">空闲天数</div>
          </div>
        </div>
      </div>

      ${weekDays.map(day => `
        <div class="card pp-day-card ${day.isToday ? 'pp-today' : ''}" style="margin-bottom:12px;${day.isToday ? 'border:2px solid var(--primary)' : ''}">
          <div class="card-title" style="margin-bottom:10px">
            <span class="title-left">
              ${day.isToday ? '🔵' : ''} ${day.dayName} ${day.date.slice(5)}
              ${day.isToday ? '<span class="pp-today-badge">今天</span>' : ''}
            </span>
            <span class="text-xs" style="color:${day.totalHours > 0 ? 'var(--success)' : 'var(--gray-400)'}">
              ${day.totalHours > 0 ? '⏱ ' + day.totalHours + 'h' : '🕊 空闲'}
            </span>
          </div>

          ${day.sessions.length > 0 ? day.sessions.map(s => {
            const slots = getTimeSlots(s);
            const label = slotsLabel(slots);
            const icon = slots.length === 3 ? '🌤️' : (slotIcon[slots[0]] || '🕐');
            return `
            <div class="pp-slot pp-slot-filled" onclick="window.__editSession('${s.id}')">
              <div class="pp-slot-time">
                <span class="pp-slot-icon">${icon}</span>
                <span class="pp-slot-period">${label}</span>
                ${s.startTime ? `<span class="pp-slot-clock">${s.startTime}</span>` : ''}
              </div>
              <div class="pp-slot-body">
                <div class="pp-slot-name">${escapeHtml(s.name)}</div>
                <div class="pp-slot-meta">
                  <span>⏱ ${s.duration}小时</span>
                  ${slots.length > 1 ? `<span style="color:var(--primary);font-size:10px">${slots.map(sl => slotIcon[sl]).join('')} ${slots.join('·')}</span>` : ''}
                  ${s.note ? `<span>📝 ${escapeHtml(s.note)}</span>` : ''}
                </div>
              </div>
              <button class="task-delete" onclick="event.stopPropagation();window.__delSession('${s.id}')">✕</button>
            </div>
          `;
          }).join('') : `
            <div class="pp-slot pp-slot-empty" onclick="window.__ppQuickAdd('${day.date}')">
              <div class="pp-slot-time">
                <span class="pp-slot-icon">📅</span>
                <span>全天</span>
              </div>
              <div class="pp-slot-body">
                <div class="pp-slot-name" style="color:var(--gray-400)">暂无活动安排</div>
                <div class="pp-slot-meta" style="color:var(--primary)">点击添加活动 +</div>
              </div>
            </div>
          `}
        </div>
      `).join('')}
    </div>

    <button class="fab" onclick="window.__ppAdd()">+</button>
  `;

  window.__ppAdd = () => showAddSessionDialog(today());
  window.__ppQuickAdd = (date) => showAddSessionDialog(date);

  window.__delSession = async (id) => {
    if (await confirmDialog('删除这条活动记录？')) {
      await del('pingpongSessions', id);
      renderPingpong(document.getElementById('main-content'));
    }
  };

  window.__editSession = (id) => showEditSessionDialog(id);
}

// ============================================================
// Tab: 活动总览（时间网格 - 合并单元格版）
// ============================================================

async function renderOverviewTab(container) {
  const sessions = await getWeekSessions();
  const freeActivities = await getWeekFreeActivities();

  const ws = weekStart(new Date());
  const timeSlots = ['上午', '下午', '晚上'];
  const slotRanges = { '上午': '6:00-12:00', '下午': '12:00-18:00', '晚上': '18:00-24:00' };

  // 颜色按活动来源区分
  const sourceColors = {
    pp:   { bg: '#e6f7ff', border: '#1890ff', text: '#096dd9' },
    free: { bg: '#f6ffed', border: '#52c41a', text: '#389e0d' },
  };

  const dayLabels = [];

  // 为每天构建活动列表，每个活动标记覆盖的时段索引范围
  // cellMap[dayIndex][slotIndex] = { activity, isStart, rowspan, isFree }
  const cellMap = [];
  for (let i = 0; i < 7; i++) cellMap.push([null, null, null]);

  const allActivities = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const dateStr = fmtDate(d);
    const isToday = dateStr === today();
    dayLabels.push({ date: dateStr, dayName: weekdayName(d), dateShort: dateStr.slice(5), isToday });

    // 收集当天所有活动
    const dayPp = sessions.filter(s => s.date === dateStr).map(s => ({ ...s, source: 'pp' }));
    const dayFree = freeActivities.filter(a => a.date === dateStr).map(a => ({ ...a, source: 'free' }));
    const dayAll = [...dayPp, ...dayFree];

    for (const act of dayAll) {
      const slots = getTimeSlots(act);
      // 将时段名转为索引
      const slotIndices = slots.map(s => timeSlots.indexOf(s)).filter(idx => idx >= 0).sort((a, b) => a - b);
      if (slotIndices.length === 0) continue;

      const startIdx = slotIndices[0];
      const endIdx = slotIndices[slotIndices.length - 1];
      const rowspan = endIdx - startIdx + 1;

      allActivities.push({ ...act, dayIndex: i, startIdx, endIdx, rowspan });

      // 标记 cellMap
      for (let si = startIdx; si <= endIdx; si++) {
        if (si === startIdx) {
          cellMap[i][si] = { activity: act, isStart: true, rowspan, isFree: false };
        } else {
          cellMap[i][si] = { activity: act, isStart: false, rowspan: 0, isFree: false };
        }
      }
    }
  }

  // 统计
  const totalCells = 7 * 3;
  const occupiedSlots = new Set();
  allActivities.forEach(a => {
    for (let si = a.startIdx; si <= a.endIdx; si++) {
      occupiedSlots.add(`${a.dayIndex}-${si}`);
    }
  });
  const busyCells = occupiedSlots.size;
  const freeCells = totalCells - busyCells;

  // 构建表格行
  const rowsHtml = timeSlots.map((slot, si) => {
    const tds = [];
    for (let di = 0; di < 7; di++) {
      const cell = cellMap[di][si];

      if (!cell) {
        // 空闲格
        tds.push(`<td class="pp-ov-td pp-ov-free"><span class="pp-ov-free-text">空闲</span></td>`);
        continue;
      }

      if (!cell.isStart) {
        // 被合并的格子，不渲染 <td>
        continue;
      }

      const a = cell.activity;
      const colors = sourceColors[a.source] || sourceColors.pp;
      const slotCount = cell.rowspan;
      const slotsLabel = slotCount === 3 ? '全天' : (slotCount === 2 ? `${timeSlots[a.startIdx]}+${timeSlots[a.endIdx]}` : timeSlots[a.startIdx]);

      tds.push(`
        <td class="pp-ov-td pp-ov-merged" rowspan="${cell.rowspan}" style="background:${colors.bg};border:1px solid ${colors.border};vertical-align:middle">
          <div class="pp-ov-activity">
            <span style="font-size:13px">${a.source === 'pp' ? '🏓' : '🎯'}</span>
            <span style="font-size:12px;font-weight:600;color:${colors.text}">${escapeHtml(a.name.length > 8 ? a.name.slice(0, 8) + '…' : a.name)}</span>
            <span style="font-size:10px;color:${colors.text};opacity:0.7">${slotsLabel}</span>
            ${a.startTime ? `<span style="font-size:10px;color:var(--gray-500)">${a.startTime}</span>` : ''}
            <span style="font-size:10px;color:var(--gray-500)">${a.duration}h</span>
          </div>
        </td>
      `);
    }

    return `
      <tr>
        <td class="pp-ov-td pp-ov-slot-label">
          <div style="font-weight:600">${slot}</div>
          <div style="font-size:10px;color:var(--gray-400)">${slotRanges[slot]}</div>
        </td>
        ${tds.join('')}
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="pp-overview">
      <div class="card" style="background:linear-gradient(135deg, #1890ff, #722ed1);color:#fff;margin-bottom:16px">
        <div style="display:flex;justify-content:space-around;text-align:center;padding:8px 0">
          <div>
            <div style="font-size:24px;font-weight:700">${allActivities.length}</div>
            <div style="font-size:11px;opacity:0.85">活动总数</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${busyCells}</div>
            <div style="font-size:11px;opacity:0.85">已占时段</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${freeCells}</div>
            <div style="font-size:11px;opacity:0.85">空闲时段</div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:12px;font-size:11px;color:var(--gray-500)">
        <span>🏓 打球</span><span>🎯 自由活动</span><span style="color:var(--gray-300)">⬜ 空闲</span>
      </div>

      <div class="pp-overview-grid-wrapper">
        <table class="pp-overview-table">
          <thead>
            <tr>
              <th class="pp-ov-th">时段</th>
              ${dayLabels.map(d => `
                <th class="pp-ov-th ${d.isToday ? 'pp-ov-today' : ''}">
                  <div>${d.dayName}</div>
                  <div style="font-size:10px;font-weight:400">${d.dateShort}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div style="text-align:center;padding:16px;color:var(--gray-400);font-size:12px">
        💡 多时段活动自动合并显示 · 一目了然查看整周安排
      </div>
    </div>
  `;
}

// ============================================================
// Tab: 自由活动
// ============================================================

async function renderFreeTab(container) {
  const activities = await getWeekFreeActivities();

  const ws = weekStart(new Date());
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const dateStr = fmtDate(d);
    const dayActivities = activities.filter(a => a.date === dateStr);
    const isToday = dateStr === today();
    weekDays.push({
      date: dateStr,
      dayName: weekdayName(d),
      dateShort: dateStr.slice(5),
      isToday,
      activities: dayActivities,
      totalHours: dayActivities.reduce((sum, a) => sum + (a.duration || 0), 0),
    });
  }

  const totalActivities = activities.length;
  const totalHours = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const daysWithActivity = weekDays.filter(d => d.activities.length > 0).length;

  const slotIcon = { '上午': '🌅', '下午': '☀️', '晚上': '🌙' };

  container.innerHTML = `
    <div class="pp-weekly-view">
      <div class="card" style="background:linear-gradient(135deg, #52c41a, #1890ff);color:#fff;margin-bottom:16px">
        <div style="display:flex;justify-content:space-around;text-align:center;padding:8px 0">
          <div>
            <div style="font-size:24px;font-weight:700">${totalActivities}</div>
            <div style="font-size:11px;opacity:0.85">自由活动</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${totalHours.toFixed(1)}h</div>
            <div style="font-size:11px;opacity:0.85">活动总时长</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${daysWithActivity}/7</div>
            <div style="font-size:11px;opacity:0.85">活跃天数</div>
          </div>
        </div>
      </div>

      ${weekDays.map(day => `
        <div class="card pp-day-card ${day.isToday ? 'pp-today' : ''}" style="margin-bottom:12px;${day.isToday ? 'border:2px solid #52c41a' : ''}">
          <div class="card-title" style="margin-bottom:10px">
            <span class="title-left">
              ${day.isToday ? '🟢' : ''} ${day.dayName} ${day.dateShort}
              ${day.isToday ? '<span class="pp-today-badge" style="background:#52c41a">今天</span>' : ''}
            </span>
            <span class="text-xs" style="color:${day.totalHours > 0 ? 'var(--success)' : 'var(--gray-400)'}">
              ${day.totalHours > 0 ? '⏱ ' + day.totalHours + 'h' : '无活动'}
            </span>
          </div>

          ${day.activities.length > 0 ? day.activities.map(a => {
            const slots = getTimeSlots(a);
            const label = slotsLabel(slots);
            const icon = slots.length === 3 ? '🌤️' : (slotIcon[slots[0]] || '🎯');
            return `
            <div class="pp-slot pp-slot-filled" style="background:#f6ffed;border-left:3px solid #52c41a" onclick="window.__editFreeActivity('${a.id}')">
              <div class="pp-slot-time">
                <span class="pp-slot-icon">${icon}</span>
                <span class="pp-slot-period">${label}</span>
                ${a.startTime ? `<span class="pp-slot-clock">${a.startTime}</span>` : ''}
              </div>
              <div class="pp-slot-body">
                <div class="pp-slot-name">${escapeHtml(a.name)}</div>
                <div class="pp-slot-meta">
                  <span>⏱ ${a.duration}小时</span>
                  ${slots.length > 1 ? `<span style="color:#52c41a;font-size:10px">${slots.map(sl => slotIcon[sl]).join('')} ${slots.join('·')}</span>` : ''}
                  ${a.note ? `<span>📝 ${escapeHtml(a.note)}</span>` : ''}
                </div>
              </div>
              <button class="task-delete" onclick="event.stopPropagation();window.__delFreeActivity('${a.id}')">✕</button>
            </div>
          `;
          }).join('') : `
            <div class="pp-slot pp-slot-empty" onclick="window.__addFreeActivity('${day.date}')">
              <div class="pp-slot-time">
                <span class="pp-slot-icon">🎯</span>
                <span>全天</span>
              </div>
              <div class="pp-slot-body">
                <div class="pp-slot-name" style="color:var(--gray-400)">暂无自由活动</div>
                <div class="pp-slot-meta" style="color:#52c41a">点击添加活动 +</div>
              </div>
            </div>
          `}
        </div>
      `).join('')}
    </div>

    <button class="fab" style="background:#52c41a" onclick="window.__addFreeActivity('${today()}')">+</button>
  `;

  window.__addFreeActivity = (date) => showAddFreeActivityDialog(date);
  window.__editFreeActivity = (id) => showEditFreeActivityDialog(id);

  window.__delFreeActivity = async (id) => {
    if (await confirmDialog('删除这条自由活动？')) {
      await del('freeActivities', id);
      renderPingpong(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// 时段多选组件（共享）
// ============================================================

function renderSlotPicker(idPrefix, selectedSlots) {
  const slots = [
    { value: '上午', icon: '🌅' },
    { value: '下午', icon: '☀️' },
    { value: '晚上', icon: '🌙' },
  ];
  return `
    <div class="pp-slot-picker" id="${idPrefix}-picker">
      ${slots.map(s => {
        const checked = selectedSlots.includes(s.value);
        return `
          <button type="button"
            class="pp-slot-chip ${checked ? 'pp-slot-chip-active' : ''}"
            data-slot="${s.value}"
            onclick="window.__toggleSlotChip(this)"
            style="${checked ? '' : ''}">
            ${s.icon} ${s.value}
          </button>
        `;
      }).join('')}
      <input type="hidden" id="${idPrefix}-slots" value="${selectedSlots.join(',')}">
    </div>
    <div class="form-hint" style="margin-top:4px">可多选，选3个 = 全天</div>
  `;
}

function buildSlotPickerScript(idPrefix) {
  return `
    (function() {
      const hidden = document.getElementById('${idPrefix}-slots');
      const chips = document.querySelectorAll('#${idPrefix}-picker .pp-slot-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', function() {
          this.classList.toggle('pp-slot-chip-active');
          const selected = [];
          chips.forEach(c => {
            if (c.classList.contains('pp-slot-chip-active')) {
              selected.push(c.dataset.slot);
            }
          });
          if (selected.length === 0) {
            // 不允许取消最后一个
            this.classList.add('pp-slot-chip-active');
            return;
          }
          hidden.value = selected.join(',');
        });
      });
    })();
  `;
}

// ============================================================
// 对话框：新增/编辑乒乓球活动
// ============================================================

function showAddSessionDialog(presetDate) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>活动名称</label>
        <input type="text" id="pp-name" placeholder="如：乒乓球训练、友谊赛" value="乒乓球活动">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="pp-date" value="${presetDate || today()}">
      </div>
      <div class="form-group">
        <label>时段（可多选）</label>
        ${renderSlotPicker('pp', ['晚上'])}
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="pp-start" value="19:00">
      </div>
      <div class="form-group">
        <label>活动时长（小时）</label>
        <input type="number" id="pp-duration" step="0.5" min="0.5" value="2" placeholder="如：2">
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="pp-note" placeholder="如：和同事一起">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveSession()">保存</button>
    </div>
  `;

  const sheet = openBottomSheet('新增活动', html);

  // 初始化多选按钮交互
  setTimeout(() => {
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('pp');
    document.body.appendChild(script);
  }, 100);

  window.__saveSession = async () => {
    const name = document.getElementById('pp-name').value.trim();
    const date = document.getElementById('pp-date').value;
    const slotsVal = document.getElementById('pp-slots').value;
    const timeSlots = slotsVal ? slotsVal.split(',').filter(Boolean) : ['晚上'];
    const startTime = document.getElementById('pp-start').value;
    const duration = parseFloat(document.getElementById('pp-duration').value);
    const note = document.getElementById('pp-note').value.trim();
    if (!date) { toast('请选择日期'); return; }
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    await addSession({ name, date, timeSlots, startTime, duration, note });
    toast('活动已添加');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

async function showEditSessionDialog(id) {
  const all = await getAll('pingpongSessions');
  const session = all.find(s => s.id === id);
  if (!session) { toast('记录不存在'); return; }

  const selectedSlots = getTimeSlots(session);

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>活动名称</label>
        <input type="text" id="pp-name" value="${escapeHtml(session.name)}">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="pp-date" value="${session.date}">
      </div>
      <div class="form-group">
        <label>时段（可多选）</label>
        ${renderSlotPicker('pp', selectedSlots)}
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="pp-start" value="${session.startTime || '19:00'}">
      </div>
      <div class="form-group">
        <label>活动时长（小时）</label>
        <input type="number" id="pp-duration" step="0.5" min="0.5" value="${session.duration}">
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="pp-note" value="${escapeHtml(session.note || '')}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateSession()">保存修改</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delSessionFromEdit('${id}')">删除此活动</button>
    </div>
  `;

  const sheet = openBottomSheet('编辑活动', html);

  setTimeout(() => {
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('pp');
    document.body.appendChild(script);
  }, 100);

  window.__updateSession = async () => {
    const name = document.getElementById('pp-name').value.trim();
    const date = document.getElementById('pp-date').value;
    const slotsVal = document.getElementById('pp-slots').value;
    const timeSlots = slotsVal ? slotsVal.split(',').filter(Boolean) : ['晚上'];
    const startTime = document.getElementById('pp-start').value;
    const duration = parseFloat(document.getElementById('pp-duration').value);
    const note = document.getElementById('pp-note').value.trim();
    if (!date) { toast('请选择日期'); return; }
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    session.name = name;
    session.date = date;
    session.timeSlots = timeSlots;
    session.startTime = startTime;
    session.duration = duration;
    session.note = note;
    session.updatedAt = new Date().toISOString();
    await put('pingpongSessions', session);
    toast('已修改');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };

  window.__delSessionFromEdit = async (delId) => {
    if (await confirmDialog('删除这条活动记录？')) {
      await del('pingpongSessions', delId);
      toast('已删除');
      sheet.close();
      renderPingpong(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// 对话框：新增/编辑自由活动
// ============================================================

function showAddFreeActivityDialog(presetDate) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>活动名称</label>
        <input type="text" id="fa-name" placeholder="如：散步、游泳、健身、阅读" value="">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="fa-date" value="${presetDate || today()}">
      </div>
      <div class="form-group">
        <label>时段（可多选）</label>
        ${renderSlotPicker('fa', ['下午'])}
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="fa-start" value="">
      </div>
      <div class="form-group">
        <label>活动时长（小时）</label>
        <input type="number" id="fa-duration" step="0.5" min="0.5" value="1" placeholder="如：1">
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="fa-note" placeholder="如：和朋友一起">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveFreeActivity()">保存</button>
    </div>
  `;

  const sheet = openBottomSheet('新增自由活动', html);

  setTimeout(() => {
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('fa');
    document.body.appendChild(script);
  }, 100);

  window.__saveFreeActivity = async () => {
    const name = document.getElementById('fa-name').value.trim();
    const date = document.getElementById('fa-date').value;
    const slotsVal = document.getElementById('fa-slots').value;
    const timeSlots = slotsVal ? slotsVal.split(',').filter(Boolean) : ['下午'];
    const startTime = document.getElementById('fa-start').value;
    const duration = parseFloat(document.getElementById('fa-duration').value);
    const note = document.getElementById('fa-note').value.trim();
    if (!name) { toast('请填写活动名称'); return; }
    if (!date) { toast('请选择日期'); return; }
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    await addFreeActivity({ name, date, timeSlots, startTime, duration, note });
    toast('自由活动已添加');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

async function showEditFreeActivityDialog(id) {
  const all = await getAll('freeActivities');
  const activity = all.find(a => a.id === id);
  if (!activity) { toast('记录不存在'); return; }

  const selectedSlots = getTimeSlots(activity);

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>活动名称</label>
        <input type="text" id="fa-name" value="${escapeHtml(activity.name)}">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="fa-date" value="${activity.date}">
      </div>
      <div class="form-group">
        <label>时段（可多选）</label>
        ${renderSlotPicker('fa', selectedSlots)}
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="fa-start" value="${activity.startTime || ''}">
      </div>
      <div class="form-group">
        <label>活动时长（小时）</label>
        <input type="number" id="fa-duration" step="0.5" min="0.5" value="${activity.duration}">
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="fa-note" value="${escapeHtml(activity.note || '')}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateFreeActivity()">保存修改</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delFreeFromEdit('${id}')">删除此活动</button>
    </div>
  `;

  const sheet = openBottomSheet('编辑自由活动', html);

  setTimeout(() => {
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('fa');
    document.body.appendChild(script);
  }, 100);

  window.__updateFreeActivity = async () => {
    const name = document.getElementById('fa-name').value.trim();
    const date = document.getElementById('fa-date').value;
    const slotsVal = document.getElementById('fa-slots').value;
    const timeSlots = slotsVal ? slotsVal.split(',').filter(Boolean) : ['下午'];
    const startTime = document.getElementById('fa-start').value;
    const duration = parseFloat(document.getElementById('fa-duration').value);
    const note = document.getElementById('fa-note').value.trim();
    if (!name) { toast('请填写活动名称'); return; }
    if (!date) { toast('请选择日期'); return; }
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    activity.name = name;
    activity.date = date;
    activity.timeSlots = timeSlots;
    activity.startTime = startTime;
    activity.duration = duration;
    activity.note = note;
    activity.updatedAt = new Date().toISOString();
    await put('freeActivities', activity);
    toast('已修改');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };

  window.__delFreeFromEdit = async (delId) => {
    if (await confirmDialog('删除这条自由活动？')) {
      await del('freeActivities', delId);
      toast('已删除');
      sheet.close();
      renderPingpong(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardPingpong() {
  const sessions = await getWeekSessions();
  const freeActivities = await getWeekFreeActivities();
  const totalHours = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const freeHours = freeActivities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const daysWithActivity = new Set([...sessions.map(s => s.date), ...freeActivities.map(a => a.date)]).size;
  const daysFree = 7 - daysWithActivity;

  return `
    <div class="dash-card" onclick="window.__navigate('pingpong')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">🏓 打球时间</div>
        <div class="dash-card-more">查看详情 ›</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${sessions.length}</div>
          <div class="dash-stat-label">已安排</div>
        </div>
        <div class="dash-stat success">
          <div class="dash-stat-num">${totalHours.toFixed(1)}h</div>
          <div class="dash-stat-label">打球</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${daysFree}</div>
          <div class="dash-stat-label">空闲天</div>
        </div>
      </div>
    </div>
  `;
}
