// ============================================================
// modules/pingpong.js - 模块2：打球时间
// 三标签：活动总览 | 打球时间 | 自由活动
// 时段支持多选：上午、下午、晚上、全天
// ============================================================

import { put, bulkPut, getAll, del } from '../db.js';
import { genId, today, fmtDate, weekStart, weekRange, weekdayName, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';

let initialized = false;
let currentTab = 'overview'; // 'overview' | 'schedule' | 'free'
let overviewWeekOffset = 0; // 总览周偏移：0=本周，-1=上周，1=下周
let scheduleWeekOffset = 0; // 打球时间周偏移
let freeWeekOffset = 0; // 自由活动周偏移

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

// 按周偏移获取活动
async function getSessionsByWeek(offset) {
  const ref = new Date();
  ref.setDate(ref.getDate() + offset * 7);
  const [wStart, wEnd] = weekRange(ref);
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

// 按周偏移获取自由活动
async function getFreeActivitiesByWeek(offset) {
  const ref = new Date();
  ref.setDate(ref.getDate() + offset * 7);
  const [wStart, wEnd] = weekRange(ref);
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
  const sessions = await getSessionsByWeek(scheduleWeekOffset);

  const refDate = new Date();
  refDate.setDate(refDate.getDate() + scheduleWeekOffset * 7);
  const ws = weekStart(refDate);
  const [curWStart, curWEnd] = weekRange(refDate);
  const weekLabel = scheduleWeekOffset === 0 ? '本周' : (scheduleWeekOffset < 0 ? `${Math.abs(scheduleWeekOffset)}周前` : `${scheduleWeekOffset}周后`);

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
      <!-- 周切换器 -->
      <div class="pp-week-switcher">
        <button class="pp-week-btn" onclick="window.__ppScheduleWeek(${scheduleWeekOffset - 1})">‹ 上周</button>
        <span class="pp-week-label">${weekLabel} (${curWStart.slice(5)} ~ ${curWEnd.slice(5)})</span>
        <button class="pp-week-btn" onclick="window.__ppScheduleWeek(${scheduleWeekOffset + 1})">下周 ›</button>
      </div>
      ${scheduleWeekOffset !== 0 ? `<div style="text-align:center;margin-bottom:8px"><button class="pp-week-today" onclick="window.__ppScheduleWeek(0)">回到本周</button></div>` : ''}

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

    <button class="fab" onclick="window.__ppAdd()" style="right:72px">+</button>
    <button class="fab fab-secondary" onclick="window.__ppBatchAdd()">≡</button>
  `;

  window.__ppAdd = () => showAddSessionDialog(today());
  window.__ppQuickAdd = (date) => showAddSessionDialog(date);
  window.__ppBatchAdd = () => showBatchAddSessionDialog();

  window.__delSession = async (id) => {
    if (await confirmDialog('删除这条活动记录？')) {
      await del('pingpongSessions', id);
      renderPingpong(document.getElementById('main-content'));
    }
  };

  window.__editSession = (id) => showEditSessionDialog(id);
  window.__ppScheduleWeek = (offset) => { scheduleWeekOffset = offset; renderPingpong(document.getElementById('main-content')); };
}

// ============================================================
// Tab: 活动总览（时间网格 - 合并单元格版）
// ============================================================

async function renderOverviewTab(container) {
  const sessions = await getSessionsByWeek(overviewWeekOffset);
  const freeActivities = await getFreeActivitiesByWeek(overviewWeekOffset);

  // 计算当前偏移对应的周
  const refDate = new Date();
  refDate.setDate(refDate.getDate() + overviewWeekOffset * 7);
  const ws = weekStart(refDate);
  const [curWStart, curWEnd] = weekRange(refDate);
  const timeSlots = ['上午', '下午', '晚上'];
  const slotRanges = { '上午': '6:00-12:00', '下午': '12:00-18:00', '晚上': '18:00-24:00' };

  // 周标签
  const weekLabel = overviewWeekOffset === 0 ? '本周' : (overviewWeekOffset < 0 ? `${Math.abs(overviewWeekOffset)}周前` : `${overviewWeekOffset}周后`);

  // 颜色按活动来源区分
  const sourceColors = {
    pp:   { bg: '#e6f7ff', border: '#1890ff', text: '#096dd9' },
    free: { bg: '#f6ffed', border: '#52c41a', text: '#389e0d' },
  };

  const dayLabels = [];

  // 为每天构建活动列表
  // cellMap[dayIndex][slotIndex] = array of { activity, isStart, rowspan, startIdx, endIdx }
  // 同一格可以有多个活动（不同活动同时段），各自独立显示
  // 只有同一活动跨多个时段时才 rowspan 合并
  const cellMap = [];
  for (let i = 0; i < 7; i++) cellMap.push([null, null, null]);
  // 初始化为空数组
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 3; j++) cellMap[i][j] = [];
  }

  const allActivities = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const dateStr = fmtDate(d);
    dayLabels.push({ date: dateStr, dayName: weekdayName(d), dateShort: dateStr.slice(5), isToday: dateStr === today() });

    // 收集当天所有活动
    const dayPp = sessions.filter(s => s.date === dateStr).map(s => ({ ...s, source: 'pp' }));
    const dayFree = freeActivities.filter(a => a.date === dateStr).map(a => ({ ...a, source: 'free' }));
    const dayAll = [...dayPp, ...dayFree];

    for (const act of dayAll) {
      const slots = getTimeSlots(act);
      const slotIndices = slots.map(s => timeSlots.indexOf(s)).filter(idx => idx >= 0).sort((a, b) => a - b);
      if (slotIndices.length === 0) continue;

      const startIdx = slotIndices[0];
      const endIdx = slotIndices[slotIndices.length - 1];
      const rowspan = endIdx - startIdx + 1;

      allActivities.push({ ...act, dayIndex: i, startIdx, endIdx, rowspan });

      // 标记 cellMap：同一活动在起始格标记 isStart + rowspan，其他格标记被合并
      for (let si = startIdx; si <= endIdx; si++) {
        if (si === startIdx) {
          cellMap[i][si].push({ activity: act, isStart: true, rowspan, startIdx, endIdx });
        } else {
          cellMap[i][si].push({ activity: act, isStart: false, rowspan: 0, startIdx, endIdx });
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
      const cellActivities = cellMap[di][si];

      if (cellActivities.length === 0) {
        // 空闲格
        tds.push(`<td class="pp-ov-td pp-ov-free"><span class="pp-ov-free-text">空闲</span></td>`);
        continue;
      }

      // 找到以本格为起始的活动（可能有多个不同活动同时段）
      const startActivities = cellActivities.filter(c => c.isStart);
      // 被其他活动合并的格子（非起始），不渲染
      const hasMergedFromAbove = cellActivities.some(c => !c.isStart);

      if (hasMergedFromAbove && startActivities.length === 0) {
        // 整格被上方活动合并，不渲染 <td>
        continue;
      }

      // 如果有从上方合并过来的活动，且本格也有新活动起始，需要分开渲染
      // 被合并的活动不渲染 td，只有起始活动渲染
      if (startActivities.length === 0) {
        continue;
      }

      // 渲染所有以本格为起始的活动
      // 只有一个起始活动 → 正常 rowspan
      // 多个起始活动（不同活动同一时段）→ 同一个 td 内显示多个活动
      const hasMultiple = startActivities.length > 1;

      const cellContent = startActivities.map(cell => {
        const a = cell.activity;
        const colors = sourceColors[a.source] || sourceColors.pp;
        const slotCount = cell.rowspan;
        const startIdx = cell.startIdx;
        const endIdx = cell.endIdx;
        const slotsLabel = slotCount === 3 ? '全天' : (slotCount === 2 ? `${timeSlots[startIdx]}+${timeSlots[endIdx]}` : timeSlots[startIdx]);

        return `
          <div class="pp-ov-activity" style="${startActivities.length > 1 ? 'border-bottom:1px solid var(--gray-100);padding-bottom:4px;margin-bottom:4px' : ''}">
            <span style="font-size:13px">${a.source === 'pp' ? '🏓' : '🎯'}</span>
            <span style="font-size:12px;font-weight:600;color:${colors.text}">${escapeHtml(a.name.length > 8 ? a.name.slice(0, 8) + '…' : a.name)}</span>
            <span style="font-size:10px;color:${colors.text};opacity:0.7">${slotsLabel}</span>
            ${a.startTime ? `<span style="font-size:10px;color:var(--gray-500)">${a.startTime}</span>` : ''}
            <span style="font-size:10px;color:var(--gray-500)">${a.duration}h</span>
          </div>
        `;
      }).join('');

      // 多个活动同时段时 rowspan=1，单个活动跨时段时用实际 rowspan
      const useRowspan = hasMultiple ? 1 : startActivities[0].rowspan;
      // 多个活动时用渐变色背景
      const bg = hasMultiple ? '#f0f5ff' : (sourceColors[startActivities[0].activity.source] || sourceColors.pp).bg;
      const border = hasMultiple ? '#adc6ff' : (sourceColors[startActivities[0].activity.source] || sourceColors.pp).border;

      tds.push(`
        <td class="pp-ov-td pp-ov-merged" rowspan="${useRowspan}" style="background:${bg};border:1px solid ${border};vertical-align:middle">
          ${cellContent}
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

      <!-- 周切换器 -->
      <div class="pp-week-switcher">
        <button class="pp-week-btn" onclick="window.__ppWeekOffset(${overviewWeekOffset - 1})">‹ 上周</button>
        <span class="pp-week-label">${weekLabel} (${curWStart.slice(5)} ~ ${curWEnd.slice(5)})</span>
        <button class="pp-week-btn" onclick="window.__ppWeekOffset(${overviewWeekOffset + 1})">下周 ›</button>
      </div>
      ${overviewWeekOffset !== 0 ? `<div style="text-align:center;margin-bottom:8px"><button class="pp-week-today" onclick="window.__ppWeekOffset(0)">回到本周</button></div>` : ''}

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

  window.__ppWeekOffset = (offset) => {
    overviewWeekOffset = offset;
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// Tab: 自由活动
// ============================================================

async function renderFreeTab(container) {
  const activities = await getFreeActivitiesByWeek(freeWeekOffset);

  const refDate = new Date();
  refDate.setDate(refDate.getDate() + freeWeekOffset * 7);
  const ws = weekStart(refDate);
  const [curWStart, curWEnd] = weekRange(refDate);
  const weekLabel = freeWeekOffset === 0 ? '本周' : (freeWeekOffset < 0 ? `${Math.abs(freeWeekOffset)}周前` : `${freeWeekOffset}周后`);

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
      <!-- 周切换器 -->
      <div class="pp-week-switcher">
        <button class="pp-week-btn" onclick="window.__ppFreeWeek(${freeWeekOffset - 1})">‹ 上周</button>
        <span class="pp-week-label">${weekLabel} (${curWStart.slice(5)} ~ ${curWEnd.slice(5)})</span>
        <button class="pp-week-btn" onclick="window.__ppFreeWeek(${freeWeekOffset + 1})">下周 ›</button>
      </div>
      ${freeWeekOffset !== 0 ? `<div style="text-align:center;margin-bottom:8px"><button class="pp-week-today" onclick="window.__ppFreeWeek(0)">回到本周</button></div>` : ''}

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

    <button class="fab" style="background:#52c41a;right:72px" onclick="window.__addFreeActivity('${today()}')">+</button>
    <button class="fab fab-secondary" style="background:#52c41a" onclick="window.__ppBatchFree()">≡</button>
  `;

  window.__addFreeActivity = (date) => showAddFreeActivityDialog(date);
  window.__editFreeActivity = (id) => showEditFreeActivityDialog(id);
  window.__ppFreeWeek = (offset) => { freeWeekOffset = offset; renderPingpong(document.getElementById('main-content')); };
  window.__ppBatchFree = () => showBatchAddFreeActivityDialog();

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
// 批量添加打球活动（按星期几 + 连续周数）
// ============================================================

function showBatchAddSessionDialog() {
  const weekDays = [
    { value: 1, label: '周一' },
    { value: 2, label: '周二' },
    { value: 3, label: '周三' },
    { value: 4, label: '周四' },
    { value: 5, label: '周五' },
    { value: 6, label: '周六' },
    { value: 0, label: '周日' },
  ];

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>活动名称</label>
        <input type="text" id="batch-pp-name" placeholder="如：乒乓球训练" value="乒乓球活动">
      </div>
      <div class="form-group">
        <label>每周哪天（可多选）</label>
        <div class="pp-slot-picker" id="batch-weekday-picker">
          ${weekDays.map(d => `
            <button type="button" class="pp-slot-chip" data-day="${d.value}">${d.label}</button>
          `).join('')}
          <input type="hidden" id="batch-weekdays" value="">
        </div>
        <div class="form-hint" style="margin-top:4px">点击选择星期几，可多选</div>
      </div>
      <div class="form-group">
        <label>时段（可多选）</label>
        ${renderSlotPicker('batch-pp', ['下午', '晚上'])}
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="batch-pp-start" value="19:00">
      </div>
      <div class="form-group">
        <label>活动时长（小时）</label>
        <input type="number" id="batch-pp-duration" step="0.5" min="0.5" value="2">
      </div>
      <div class="form-group">
        <label>连续周数</label>
        <input type="number" id="batch-pp-weeks" min="1" max="52" value="4">
        <div class="form-hint">从本周开始，连续添加多少周</div>
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="batch-pp-note" placeholder="如：和同事一起">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBatchSession()">批量添加</button>
    </div>
  `;

  const sheet = openBottomSheet('批量添加活动', html);

  // 星期几多选
  setTimeout(() => {
    const dayChips = document.querySelectorAll('#batch-weekday-picker .pp-slot-chip');
    const dayHidden = document.getElementById('batch-weekdays');
    dayChips.forEach(chip => {
      chip.addEventListener('click', function() {
        this.classList.toggle('pp-slot-chip-active');
        const selected = [];
        dayChips.forEach(c => {
          if (c.classList.contains('pp-slot-chip-active')) selected.push(c.dataset.day);
        });
        dayHidden.value = selected.join(',');
      });
    });

    // 时段多选
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('batch-pp');
    document.body.appendChild(script);
  }, 100);

  window.__saveBatchSession = async () => {
    const name = document.getElementById('batch-pp-name').value.trim() || '乒乓球活动';
    const daysStr = document.getElementById('batch-weekdays').value;
    if (!daysStr) { toast('请选择每周哪天'); return; }
    const weekdays = daysStr.split(',').map(Number);

    const slotsStr = document.getElementById('batch-pp-slots').value;
    const timeSlots = slotsStr ? slotsStr.split(',').filter(Boolean) : ['晚上'];
    if (timeSlots.length === 0) { toast('请选择时段'); return; }

    const startTime = document.getElementById('batch-pp-start').value;
    const duration = parseFloat(document.getElementById('batch-pp-duration').value);
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    const weeks = parseInt(document.getElementById('batch-pp-weeks').value) || 1;
    const note = document.getElementById('batch-pp-note').value.trim();

    // 计算日期
    const sessions = [];
    const todayDate = new Date();
    const currentWeekStart = weekStart(todayDate);

    for (let w = 0; w < weeks; w++) {
      for (const dayOfWeek of weekdays) {
        // dayOfWeek: 0=周日,1=周一...6=周六 → 转为从周一开始的偏移: 周一=0, 周日=6
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + w * 7 + offset);
        // 跳过过去的日期（本周已过的天）
        if (w === 0 && d < new Date(todayDate.toDateString())) continue;

        sessions.push({
          id: genId(),
          date: fmtDate(d),
          name,
          timeSlots,
          startTime,
          duration,
          note,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (sessions.length === 0) {
      toast('没有可添加的日期（本周所选日期已过）');
      return;
    }

    await bulkPut('pingpongSessions', sessions);
    toast(`已添加 ${sessions.length} 条活动`);
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// 批量添加自由活动（按星期几 + 连续周数）
// ============================================================

function showBatchAddFreeActivityDialog() {
  const weekDays = [
    { value: 1, label: '周一' },
    { value: 2, label: '周二' },
    { value: 3, label: '周三' },
    { value: 4, label: '周四' },
    { value: 5, label: '周五' },
    { value: 6, label: '周六' },
    { value: 0, label: '周日' },
  ];

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>活动名称</label>
        <input type="text" id="batch-fa-name" placeholder="如：散步、游泳、健身">
      </div>
      <div class="form-group">
        <label>每周哪天（可多选）</label>
        <div class="pp-slot-picker" id="batch-fa-weekday-picker">
          ${weekDays.map(d => `
            <button type="button" class="pp-slot-chip" data-day="${d.value}">${d.label}</button>
          `).join('')}
          <input type="hidden" id="batch-fa-weekdays" value="">
        </div>
        <div class="form-hint" style="margin-top:4px">点击选择星期几，可多选</div>
      </div>
      <div class="form-group">
        <label>时段（可多选）</label>
        ${renderSlotPicker('batch-fa', ['下午'])}
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="batch-fa-start" value="">
      </div>
      <div class="form-group">
        <label>活动时长（小时）</label>
        <input type="number" id="batch-fa-duration" step="0.5" min="0.5" value="1">
      </div>
      <div class="form-group">
        <label>连续周数</label>
        <input type="number" id="batch-fa-weeks" min="1" max="52" value="4">
        <div class="form-hint">从本周开始，连续添加多少周</div>
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="batch-fa-note" placeholder="如：和朋友一起">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBatchFreeActivity()">批量添加</button>
    </div>
  `;

  const sheet = openBottomSheet('批量添加自由活动', html);

  setTimeout(() => {
    const dayChips = document.querySelectorAll('#batch-fa-weekday-picker .pp-slot-chip');
    const dayHidden = document.getElementById('batch-fa-weekdays');
    dayChips.forEach(chip => {
      chip.addEventListener('click', function() {
        this.classList.toggle('pp-slot-chip-active');
        const selected = [];
        dayChips.forEach(c => {
          if (c.classList.contains('pp-slot-chip-active')) selected.push(c.dataset.day);
        });
        dayHidden.value = selected.join(',');
      });
    });

    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('batch-fa');
    document.body.appendChild(script);
  }, 100);

  window.__saveBatchFreeActivity = async () => {
    const name = document.getElementById('batch-fa-name').value.trim();
    if (!name) { toast('请填写活动名称'); return; }
    const daysStr = document.getElementById('batch-fa-weekdays').value;
    if (!daysStr) { toast('请选择每周哪天'); return; }
    const weekdays = daysStr.split(',').map(Number);

    const slotsStr = document.getElementById('batch-fa-slots').value;
    const timeSlots = slotsStr ? slotsStr.split(',').filter(Boolean) : ['下午'];
    if (timeSlots.length === 0) { toast('请选择时段'); return; }

    const startTime = document.getElementById('batch-fa-start').value;
    const duration = parseFloat(document.getElementById('batch-fa-duration').value);
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    const weeks = parseInt(document.getElementById('batch-fa-weeks').value) || 1;
    const note = document.getElementById('batch-fa-note').value.trim();

    const activities = [];
    const todayDate = new Date();
    const currentWeekStart = weekStart(todayDate);

    for (let w = 0; w < weeks; w++) {
      for (const dayOfWeek of weekdays) {
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + w * 7 + offset);
        if (w === 0 && d < new Date(todayDate.toDateString())) continue;

        activities.push({
          id: genId(),
          date: fmtDate(d),
          name,
          timeSlots,
          startTime,
          duration,
          note,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (activities.length === 0) {
      toast('没有可添加的日期（本周所选日期已过）');
      return;
    }

    await bulkPut('freeActivities', activities);
    toast(`已添加 ${activities.length} 条活动`);
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
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
