// ============================================================
// modules/pingpong.js - \u6a21\u57572：\u6253\u7403\u65f6\u95f4
// \u4e09\u6807\u7b7e：\u6d3b\u52a8\u603b\u89c8 | \u6253\u7403\u65f6\u95f4 | \u81ea\u7531\u6d3b\u52a8
// \u65f6\u6bb5\u652f\u6301\u591a\u9009：\u4e0a\u5348、\u4e0b\u5348、\u665a\u4e0a、\u5168\u5929
// ============================================================

import { put, bulkPut, getAll, del } from '../db.js';
import { genId, today, fmtDate, weekStart, weekRange, weekdayName, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';

let initialized = false;
let currentTab = 'overview'; // 'overview' | 'schedule' | 'free'
let overviewWeekOffset = 0; // \u603b\u89c8\u5468\u504f\u79fb：0=\u672c\u5468，-1=\u4e0a\u5468，1=\u4e0b\u5468
let scheduleWeekOffset = 0; // \u6253\u7403\u65f6\u95f4\u5468\u504f\u79fb
let freeWeekOffset = 0; // \u81ea\u7531\u6d3b\u52a8\u5468\u504f\u79fb

export async function initPingpong() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// \u8f85\u52a9：\u517c\u5bb9\u65e7\u6570\u636e timeSlot → timeSlots \u6570\u7ec4
// ============================================================

const ALL_SLOTS = ['\u4e0a\u5348', '\u4e0b\u5348', '\u665a\u4e0a'];

function getTimeSlots(item) {
  if (item.timeSlots && Array.isArray(item.timeSlots) && item.timeSlots.length > 0) {
    return item.timeSlots;
  }
  if (item.timeSlot) {
    return [item.timeSlot];
  }
  return ['\u665a\u4e0a'];
}

function slotsLabel(slots) {
  if (!slots || slots.length === 0) return '\u665a\u4e0a';
  if (slots.length === 3) return '\u5168\u5929';
  return slots.join('+');
}

// ============================================================
// \u6570\u636e\u64cd\u4f5c：\u4e52\u4e53\u7403\u6d3b\u52a8
// ============================================================

async function addSession(data) {
  const session = {
    id: genId(),
    date: data.date,
    name: data.name || '\u4e52\u4e53\u7403\u6d3b\u52a8',
    timeSlots: data.timeSlots || ['\u665a\u4e0a'],
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

// \u6309\u5468\u504f\u79fb\u83b7\u53d6\u6d3b\u52a8
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
// \u6570\u636e\u64cd\u4f5c：\u81ea\u7531\u6d3b\u52a8
// ============================================================

async function addFreeActivity(data) {
  const activity = {
    id: genId(),
    date: data.date,
    name: data.name,
    timeSlots: data.timeSlots || ['\u4e0b\u5348'],
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

// \u6309\u5468\u504f\u79fb\u83b7\u53d6\u81ea\u7531\u6d3b\u52a8
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
// \u4e3b\u6e32\u67d3\u5165\u53e3
// ============================================================

export async function renderPingpong(container) {
  const tabs = [
    { key: 'overview', label: '📊 \u6d3b\u52a8\u603b\u89c8' },
    { key: 'schedule', label: '🏓 \u6253\u7403\u65f6\u95f4' },
    { key: 'free', label: '🎯 \u81ea\u7531\u6d3b\u52a8' },
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
// Tab: \u6253\u7403\u65f6\u95f4（\u5468\u5386\u89c6\u56fe）
// ============================================================

async function renderScheduleTab(container) {
  const sessions = await getSessionsByWeek(scheduleWeekOffset);

  const refDate = new Date();
  refDate.setDate(refDate.getDate() + scheduleWeekOffset * 7);
  const ws = weekStart(refDate);
  const [curWStart, curWEnd] = weekRange(refDate);
  const weekLabel = scheduleWeekOffset === 0 ? '\u672c\u5468' : (scheduleWeekOffset < 0 ? `${Math.abs(scheduleWeekOffset)}\u5468\u524d` : `${scheduleWeekOffset}\u5468\u540e`);

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

  const slotIcon = { '\u4e0a\u5348': '🌅', '\u4e0b\u5348': '☀️', '\u665a\u4e0a': '🌙' };

  container.innerHTML = `
    <div class="pp-weekly-view">
      <!-- \u5468\u5207\u6362\u5668 -->
      <div class="pp-week-switcher">
        <button class="pp-week-btn" onclick="window.__ppScheduleWeek(${scheduleWeekOffset - 1})">‹ \u4e0a\u5468</button>
        <span class="pp-week-label">${weekLabel} (${curWStart.slice(5)} ~ ${curWEnd.slice(5)})</span>
        <button class="pp-week-btn" onclick="window.__ppScheduleWeek(${scheduleWeekOffset + 1})">\u4e0b\u5468 ›</button>
      </div>
      ${scheduleWeekOffset !== 0 ? `<div style="text-align:center;margin-bottom:8px"><button class="pp-week-today" onclick="window.__ppScheduleWeek(0)">\u56de\u5230\u672c\u5468</button></div>` : ''}

      <div class="card" style="background:linear-gradient(135deg, var(--primary), #a48cc4);color:#fff;margin-bottom:16px">
        <div style="display:flex;justify-content:space-around;text-align:center;padding:8px 0">
          <div>
            <div style="font-size:24px;font-weight:700">${totalSessions}</div>
            <div style="font-size:11px;opacity:0.85">\u5df2\u5b89\u6392\u6d3b\u52a8</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${totalHours.toFixed(1)}h</div>
            <div style="font-size:11px;opacity:0.85">\u6d3b\u52a8\u603b\u65f6\u957f</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${daysFree}</div>
            <div style="font-size:11px;opacity:0.85">\u7a7a\u95f2\u5929\u6570</div>
          </div>
        </div>
      </div>

      ${weekDays.map(day => `
        <div class="card pp-day-card ${day.isToday ? 'pp-today' : ''}" style="margin-bottom:12px;${day.isToday ? 'border:2px solid var(--primary)' : ''}">
          <div class="card-title" style="margin-bottom:10px">
            <span class="title-left">
              ${day.isToday ? '🔵' : ''} ${day.dayName} ${day.date.slice(5)}
              ${day.isToday ? '<span class="pp-today-badge">\u4eca\u5929</span>' : ''}
            </span>
            <span class="text-xs" style="color:${day.totalHours > 0 ? 'var(--success)' : 'var(--gray-400)'}">
              ${day.totalHours > 0 ? '⏱ ' + day.totalHours + 'h' : '🕊 \u7a7a\u95f2'}
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
                  <span>⏱ ${s.duration}\u5c0f\u65f6</span>
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
                <span>\u5168\u5929</span>
              </div>
              <div class="pp-slot-body">
                <div class="pp-slot-name" style="color:var(--gray-400)">\u6682\u65e0\u6d3b\u52a8\u5b89\u6392</div>
                <div class="pp-slot-meta" style="color:var(--primary)">\u70b9\u51fb\u6dfb\u52a0\u6d3b\u52a8 +</div>
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
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u6d3b\u52a8\u8bb0\u5f55？')) {
      await del('pingpongSessions', id);
      renderPingpong(document.getElementById('main-content'));
    }
  };

  window.__editSession = (id) => showEditSessionDialog(id);
  window.__ppScheduleWeek = (offset) => { scheduleWeekOffset = offset; renderPingpong(document.getElementById('main-content')); };
}

// ============================================================
// Tab: \u6d3b\u52a8\u603b\u89c8（\u65f6\u95f4\u7f51\u683c - \u5408\u5e76\u5355\u5143\u683c\u7248）
// ============================================================

async function renderOverviewTab(container) {
  const sessions = await getSessionsByWeek(overviewWeekOffset);
  const freeActivities = await getFreeActivitiesByWeek(overviewWeekOffset);

  // \u8ba1\u7b97\u5f53\u524d\u504f\u79fb\u5bf9\u5e94\u7684\u5468
  const refDate = new Date();
  refDate.setDate(refDate.getDate() + overviewWeekOffset * 7);
  const ws = weekStart(refDate);
  const [curWStart, curWEnd] = weekRange(refDate);
  const timeSlots = ['\u4e0a\u5348', '\u4e0b\u5348', '\u665a\u4e0a'];
  const slotRanges = { '\u4e0a\u5348': '6:00-12:00', '\u4e0b\u5348': '12:00-18:00', '\u665a\u4e0a': '18:00-24:00' };

  // \u5468\u6807\u7b7e
  const weekLabel = overviewWeekOffset === 0 ? '\u672c\u5468' : (overviewWeekOffset < 0 ? `${Math.abs(overviewWeekOffset)}\u5468\u524d` : `${overviewWeekOffset}\u5468\u540e`);

  // \u989c\u8272\u6309\u6d3b\u52a8\u6765\u6e90\u533a\u5206
  const sourceColors = {
    pp:   { bg: '#e6f7ff', border: '#1890ff', text: '#096dd9' },
    free: { bg: '#f6ffed', border: '#52c41a', text: '#389e0d' },
  };

  const dayLabels = [];

  // \u4e3a\u6bcf\u5929\u6784\u5efa\u6d3b\u52a8\u5217\u8868
  // cellMap[dayIndex][slotIndex] = array of { activity, isStart, rowspan, startIdx, endIdx }
  // \u540c\u4e00\u683c\u53ef\u4ee5\u6709\u591a\u4e2a\u6d3b\u52a8（\u4e0d\u540c\u6d3b\u52a8\u540c\u65f6\u6bb5），\u5404\u81ea\u72ec\u7acb\u663e\u793a
  // \u53ea\u6709\u540c\u4e00\u6d3b\u52a8\u8de8\u591a\u4e2a\u65f6\u6bb5\u65f6\u624d rowspan \u5408\u5e76
  const cellMap = [];
  for (let i = 0; i < 7; i++) cellMap.push([null, null, null]);
  // \u521d\u59cb\u5316\u4e3a\u7a7a\u6570\u7ec4
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 3; j++) cellMap[i][j] = [];
  }

  const allActivities = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const dateStr = fmtDate(d);
    dayLabels.push({ date: dateStr, dayName: weekdayName(d), dateShort: dateStr.slice(5), isToday: dateStr === today() });

    // \u6536\u96c6\u5f53\u5929\u6240\u6709\u6d3b\u52a8
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

      // \u6807\u8bb0 cellMap：\u540c\u4e00\u6d3b\u52a8\u5728\u8d77\u59cb\u683c\u6807\u8bb0 isStart + rowspan，\u5176\u4ed6\u683c\u6807\u8bb0\u88ab\u5408\u5e76
      for (let si = startIdx; si <= endIdx; si++) {
        if (si === startIdx) {
          cellMap[i][si].push({ activity: act, isStart: true, rowspan, startIdx, endIdx });
        } else {
          cellMap[i][si].push({ activity: act, isStart: false, rowspan: 0, startIdx, endIdx });
        }
      }
    }
  }

  // \u7edf\u8ba1
  const totalCells = 7 * 3;
  const occupiedSlots = new Set();
  allActivities.forEach(a => {
    for (let si = a.startIdx; si <= a.endIdx; si++) {
      occupiedSlots.add(`${a.dayIndex}-${si}`);
    }
  });
  const busyCells = occupiedSlots.size;
  const freeCells = totalCells - busyCells;

  // \u6784\u5efa\u8868\u683c\u884c
  const rowsHtml = timeSlots.map((slot, si) => {
    const tds = [];
    for (let di = 0; di < 7; di++) {
      const cellActivities = cellMap[di][si];

      if (cellActivities.length === 0) {
        // \u7a7a\u95f2\u683c
        tds.push(`<td class="pp-ov-td pp-ov-free"><span class="pp-ov-free-text">\u7a7a\u95f2</span></td>`);
        continue;
      }

      // \u627e\u5230\u4ee5\u672c\u683c\u4e3a\u8d77\u59cb\u7684\u6d3b\u52a8（\u53ef\u80fd\u6709\u591a\u4e2a\u4e0d\u540c\u6d3b\u52a8\u540c\u65f6\u6bb5）
      const startActivities = cellActivities.filter(c => c.isStart);
      // \u88ab\u5176\u4ed6\u6d3b\u52a8\u5408\u5e76\u7684\u683c\u5b50（\u975e\u8d77\u59cb），\u4e0d\u6e32\u67d3
      const hasMergedFromAbove = cellActivities.some(c => !c.isStart);

      if (hasMergedFromAbove && startActivities.length === 0) {
        // \u6574\u683c\u88ab\u4e0a\u65b9\u6d3b\u52a8\u5408\u5e76，\u4e0d\u6e32\u67d3 <td>
        continue;
      }

      // \u5982\u679c\u6709\u4ece\u4e0a\u65b9\u5408\u5e76\u8fc7\u6765\u7684\u6d3b\u52a8，\u4e14\u672c\u683c\u4e5f\u6709\u65b0\u6d3b\u52a8\u8d77\u59cb，\u9700\u8981\u5206\u5f00\u6e32\u67d3
      // \u88ab\u5408\u5e76\u7684\u6d3b\u52a8\u4e0d\u6e32\u67d3 td，\u53ea\u6709\u8d77\u59cb\u6d3b\u52a8\u6e32\u67d3
      if (startActivities.length === 0) {
        continue;
      }

      // \u6e32\u67d3\u6240\u6709\u4ee5\u672c\u683c\u4e3a\u8d77\u59cb\u7684\u6d3b\u52a8
      // \u53ea\u6709\u4e00\u4e2a\u8d77\u59cb\u6d3b\u52a8 → \u6b63\u5e38 rowspan
      // \u591a\u4e2a\u8d77\u59cb\u6d3b\u52a8（\u4e0d\u540c\u6d3b\u52a8\u540c\u4e00\u65f6\u6bb5）→ \u540c\u4e00\u4e2a td \u5185\u663e\u793a\u591a\u4e2a\u6d3b\u52a8
      const hasMultiple = startActivities.length > 1;

      const cellContent = startActivities.map(cell => {
        const a = cell.activity;
        const colors = sourceColors[a.source] || sourceColors.pp;
        const slotCount = cell.rowspan;
        const startIdx = cell.startIdx;
        const endIdx = cell.endIdx;
        const slotsLabel = slotCount === 3 ? '\u5168\u5929' : (slotCount === 2 ? `${timeSlots[startIdx]}+${timeSlots[endIdx]}` : timeSlots[startIdx]);

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

      // \u591a\u4e2a\u6d3b\u52a8\u540c\u65f6\u6bb5\u65f6 rowspan=1，\u5355\u4e2a\u6d3b\u52a8\u8de8\u65f6\u6bb5\u65f6\u7528\u5b9e\u9645 rowspan
      const useRowspan = hasMultiple ? 1 : startActivities[0].rowspan;
      // \u591a\u4e2a\u6d3b\u52a8\u65f6\u7528\u6e10\u53d8\u8272\u80cc\u666f
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
            <div style="font-size:11px;opacity:0.85">\u6d3b\u52a8\u603b\u6570</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${busyCells}</div>
            <div style="font-size:11px;opacity:0.85">\u5df2\u5360\u65f6\u6bb5</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${freeCells}</div>
            <div style="font-size:11px;opacity:0.85">\u7a7a\u95f2\u65f6\u6bb5</div>
          </div>
        </div>
      </div>

      <!-- \u5468\u5207\u6362\u5668 -->
      <div class="pp-week-switcher">
        <button class="pp-week-btn" onclick="window.__ppWeekOffset(${overviewWeekOffset - 1})">‹ \u4e0a\u5468</button>
        <span class="pp-week-label">${weekLabel} (${curWStart.slice(5)} ~ ${curWEnd.slice(5)})</span>
        <button class="pp-week-btn" onclick="window.__ppWeekOffset(${overviewWeekOffset + 1})">\u4e0b\u5468 ›</button>
      </div>
      ${overviewWeekOffset !== 0 ? `<div style="text-align:center;margin-bottom:8px"><button class="pp-week-today" onclick="window.__ppWeekOffset(0)">\u56de\u5230\u672c\u5468</button></div>` : ''}

      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:12px;font-size:11px;color:var(--gray-500)">
        <span>🏓 \u6253\u7403</span><span>🎯 \u81ea\u7531\u6d3b\u52a8</span><span style="color:var(--gray-300)">⬜ \u7a7a\u95f2</span>
      </div>

      <div class="pp-overview-grid-wrapper">
        <table class="pp-overview-table">
          <thead>
            <tr>
              <th class="pp-ov-th">\u65f6\u6bb5</th>
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
        💡 \u591a\u65f6\u6bb5\u6d3b\u52a8\u81ea\u52a8\u5408\u5e76\u663e\u793a · \u4e00\u76ee\u4e86\u7136\u67e5\u770b\u6574\u5468\u5b89\u6392
      </div>
    </div>
  `;

  window.__ppWeekOffset = (offset) => {
    overviewWeekOffset = offset;
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// Tab: \u81ea\u7531\u6d3b\u52a8
// ============================================================

async function renderFreeTab(container) {
  const activities = await getFreeActivitiesByWeek(freeWeekOffset);

  const refDate = new Date();
  refDate.setDate(refDate.getDate() + freeWeekOffset * 7);
  const ws = weekStart(refDate);
  const [curWStart, curWEnd] = weekRange(refDate);
  const weekLabel = freeWeekOffset === 0 ? '\u672c\u5468' : (freeWeekOffset < 0 ? `${Math.abs(freeWeekOffset)}\u5468\u524d` : `${freeWeekOffset}\u5468\u540e`);

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

  const slotIcon = { '\u4e0a\u5348': '🌅', '\u4e0b\u5348': '☀️', '\u665a\u4e0a': '🌙' };

  container.innerHTML = `
    <div class="pp-weekly-view">
      <!-- \u5468\u5207\u6362\u5668 -->
      <div class="pp-week-switcher">
        <button class="pp-week-btn" onclick="window.__ppFreeWeek(${freeWeekOffset - 1})">‹ \u4e0a\u5468</button>
        <span class="pp-week-label">${weekLabel} (${curWStart.slice(5)} ~ ${curWEnd.slice(5)})</span>
        <button class="pp-week-btn" onclick="window.__ppFreeWeek(${freeWeekOffset + 1})">\u4e0b\u5468 ›</button>
      </div>
      ${freeWeekOffset !== 0 ? `<div style="text-align:center;margin-bottom:8px"><button class="pp-week-today" onclick="window.__ppFreeWeek(0)">\u56de\u5230\u672c\u5468</button></div>` : ''}

      <div class="card" style="background:linear-gradient(135deg, #52c41a, #1890ff);color:#fff;margin-bottom:16px">
        <div style="display:flex;justify-content:space-around;text-align:center;padding:8px 0">
          <div>
            <div style="font-size:24px;font-weight:700">${totalActivities}</div>
            <div style="font-size:11px;opacity:0.85">\u81ea\u7531\u6d3b\u52a8</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${totalHours.toFixed(1)}h</div>
            <div style="font-size:11px;opacity:0.85">\u6d3b\u52a8\u603b\u65f6\u957f</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700">${daysWithActivity}/7</div>
            <div style="font-size:11px;opacity:0.85">\u6d3b\u8dc3\u5929\u6570</div>
          </div>
        </div>
      </div>

      ${weekDays.map(day => `
        <div class="card pp-day-card ${day.isToday ? 'pp-today' : ''}" style="margin-bottom:12px;${day.isToday ? 'border:2px solid #52c41a' : ''}">
          <div class="card-title" style="margin-bottom:10px">
            <span class="title-left">
              ${day.isToday ? '🟢' : ''} ${day.dayName} ${day.dateShort}
              ${day.isToday ? '<span class="pp-today-badge" style="background:#52c41a">\u4eca\u5929</span>' : ''}
            </span>
            <span class="text-xs" style="color:${day.totalHours > 0 ? 'var(--success)' : 'var(--gray-400)'}">
              ${day.totalHours > 0 ? '⏱ ' + day.totalHours + 'h' : '\u65e0\u6d3b\u52a8'}
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
                  <span>⏱ ${a.duration}\u5c0f\u65f6</span>
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
                <span>\u5168\u5929</span>
              </div>
              <div class="pp-slot-body">
                <div class="pp-slot-name" style="color:var(--gray-400)">\u6682\u65e0\u81ea\u7531\u6d3b\u52a8</div>
                <div class="pp-slot-meta" style="color:#52c41a">\u70b9\u51fb\u6dfb\u52a0\u6d3b\u52a8 +</div>
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
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u81ea\u7531\u6d3b\u52a8？')) {
      await del('freeActivities', id);
      renderPingpong(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// \u65f6\u6bb5\u591a\u9009\u7ec4\u4ef6（\u5171\u4eab）
// ============================================================

function renderSlotPicker(idPrefix, selectedSlots) {
  const slots = [
    { value: '\u4e0a\u5348', icon: '🌅' },
    { value: '\u4e0b\u5348', icon: '☀️' },
    { value: '\u665a\u4e0a', icon: '🌙' },
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
    <div class="form-hint" style="margin-top:4px">\u53ef\u591a\u9009，\u90093\u4e2a = \u5168\u5929</div>
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
            // \u4e0d\u5141\u8bb8\u53d6\u6d88\u6700\u540e\u4e00\u4e2a
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
// \u5bf9\u8bdd\u6846：\u65b0\u589e/\u7f16\u8f91\u4e52\u4e53\u7403\u6d3b\u52a8
// ============================================================

function showAddSessionDialog(presetDate) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u6d3b\u52a8\u540d\u79f0</label>
        <input type="text" id="pp-name" placeholder="\u5982：\u4e52\u4e53\u7403\u8bad\u7ec3、\u53cb\u8c0a\u8d5b" value="\u4e52\u4e53\u7403\u6d3b\u52a8">
      </div>
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <input type="date" id="pp-date" value="${presetDate || today()}">
      </div>
      <div class="form-group">
        <label>\u65f6\u6bb5（\u53ef\u591a\u9009）</label>
        ${renderSlotPicker('pp', ['\u665a\u4e0a'])}
      </div>
      <div class="form-group">
        <label>\u5f00\u59cb\u65f6\u95f4</label>
        <input type="time" id="pp-start" value="19:00">
      </div>
      <div class="form-group">
        <label>\u6d3b\u52a8\u65f6\u957f（\u5c0f\u65f6）</label>
        <input type="number" id="pp-duration" step="0.5" min="0.5" value="2" placeholder="\u5982：2">
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="pp-note" placeholder="\u5982：\u548c\u540c\u4e8b\u4e00\u8d77">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveSession()">\u4fdd\u5b58</button>
    </div>
  `;

  const sheet = openBottomSheet('\u65b0\u589e\u6d3b\u52a8', html);

  // \u521d\u59cb\u5316\u591a\u9009\u6309\u94ae\u4ea4\u4e92
  setTimeout(() => {
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('pp');
    document.body.appendChild(script);
  }, 100);

  window.__saveSession = async () => {
    const name = document.getElementById('pp-name').value.trim();
    const date = document.getElementById('pp-date').value;
    const slotsVal = document.getElementById('pp-slots').value;
    const timeSlots = slotsVal ? slotsVal.split(',').filter(Boolean) : ['\u665a\u4e0a'];
    const startTime = document.getElementById('pp-start').value;
    const duration = parseFloat(document.getElementById('pp-duration').value);
    const note = document.getElementById('pp-note').value.trim();
    if (!date) { toast('\u8bf7\u9009\u62e9\u65e5\u671f'); return; }
    if (!duration || duration <= 0) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u65f6\u957f'); return; }
    await addSession({ name, date, timeSlots, startTime, duration, note });
    toast('\u6d3b\u52a8\u5df2\u6dfb\u52a0');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

async function showEditSessionDialog(id) {
  const all = await getAll('pingpongSessions');
  const session = all.find(s => s.id === id);
  if (!session) { toast('\u8bb0\u5f55\u4e0d\u5b58\u5728'); return; }

  const selectedSlots = getTimeSlots(session);

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u6d3b\u52a8\u540d\u79f0</label>
        <input type="text" id="pp-name" value="${escapeHtml(session.name)}">
      </div>
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <input type="date" id="pp-date" value="${session.date}">
      </div>
      <div class="form-group">
        <label>\u65f6\u6bb5（\u53ef\u591a\u9009）</label>
        ${renderSlotPicker('pp', selectedSlots)}
      </div>
      <div class="form-group">
        <label>\u5f00\u59cb\u65f6\u95f4</label>
        <input type="time" id="pp-start" value="${session.startTime || '19:00'}">
      </div>
      <div class="form-group">
        <label>\u6d3b\u52a8\u65f6\u957f（\u5c0f\u65f6）</label>
        <input type="number" id="pp-duration" step="0.5" min="0.5" value="${session.duration}">
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="pp-note" value="${escapeHtml(session.note || '')}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateSession()">\u4fdd\u5b58\u4fee\u6539</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delSessionFromEdit('${id}')">\u5220\u9664\u6b64\u6d3b\u52a8</button>
    </div>
  `;

  const sheet = openBottomSheet('\u7f16\u8f91\u6d3b\u52a8', html);

  setTimeout(() => {
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('pp');
    document.body.appendChild(script);
  }, 100);

  window.__updateSession = async () => {
    const name = document.getElementById('pp-name').value.trim();
    const date = document.getElementById('pp-date').value;
    const slotsVal = document.getElementById('pp-slots').value;
    const timeSlots = slotsVal ? slotsVal.split(',').filter(Boolean) : ['\u665a\u4e0a'];
    const startTime = document.getElementById('pp-start').value;
    const duration = parseFloat(document.getElementById('pp-duration').value);
    const note = document.getElementById('pp-note').value.trim();
    if (!date) { toast('\u8bf7\u9009\u62e9\u65e5\u671f'); return; }
    if (!duration || duration <= 0) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u65f6\u957f'); return; }
    session.name = name;
    session.date = date;
    session.timeSlots = timeSlots;
    session.startTime = startTime;
    session.duration = duration;
    session.note = note;
    session.updatedAt = new Date().toISOString();
    await put('pingpongSessions', session);
    toast('\u5df2\u4fee\u6539');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };

  window.__delSessionFromEdit = async (delId) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u6d3b\u52a8\u8bb0\u5f55？')) {
      await del('pingpongSessions', delId);
      toast('\u5df2\u5220\u9664');
      sheet.close();
      renderPingpong(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// \u6279\u91cf\u6dfb\u52a0\u6253\u7403\u6d3b\u52a8（\u6309\u661f\u671f\u51e0 + \u8fde\u7eed\u5468\u6570）
// ============================================================

function showBatchAddSessionDialog() {
  const weekDays = [
    { value: 1, label: '\u5468\u4e00' },
    { value: 2, label: '\u5468\u4e8c' },
    { value: 3, label: '\u5468\u4e09' },
    { value: 4, label: '\u5468\u56db' },
    { value: 5, label: '\u5468\u4e94' },
    { value: 6, label: '\u5468\u516d' },
    { value: 0, label: '\u5468\u65e5' },
  ];

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u6d3b\u52a8\u540d\u79f0</label>
        <input type="text" id="batch-pp-name" placeholder="\u5982：\u4e52\u4e53\u7403\u8bad\u7ec3" value="\u4e52\u4e53\u7403\u6d3b\u52a8">
      </div>
      <div class="form-group">
        <label>\u6bcf\u5468\u54ea\u5929（\u53ef\u591a\u9009）</label>
        <div class="pp-slot-picker" id="batch-weekday-picker">
          ${weekDays.map(d => `
            <button type="button" class="pp-slot-chip" data-day="${d.value}">${d.label}</button>
          `).join('')}
          <input type="hidden" id="batch-weekdays" value="">
        </div>
        <div class="form-hint" style="margin-top:4px">\u70b9\u51fb\u9009\u62e9\u661f\u671f\u51e0，\u53ef\u591a\u9009</div>
      </div>
      <div class="form-group">
        <label>\u65f6\u6bb5（\u53ef\u591a\u9009）</label>
        ${renderSlotPicker('batch-pp', ['\u4e0b\u5348', '\u665a\u4e0a'])}
      </div>
      <div class="form-group">
        <label>\u5f00\u59cb\u65f6\u95f4</label>
        <input type="time" id="batch-pp-start" value="19:00">
      </div>
      <div class="form-group">
        <label>\u6d3b\u52a8\u65f6\u957f（\u5c0f\u65f6）</label>
        <input type="number" id="batch-pp-duration" step="0.5" min="0.5" value="2">
      </div>
      <div class="form-group">
        <label>\u8fde\u7eed\u5468\u6570</label>
        <input type="number" id="batch-pp-weeks" min="1" max="52" value="4">
        <div class="form-hint">\u4ece\u672c\u5468\u5f00\u59cb，\u8fde\u7eed\u6dfb\u52a0\u591a\u5c11\u5468</div>
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="batch-pp-note" placeholder="\u5982：\u548c\u540c\u4e8b\u4e00\u8d77">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBatchSession()">\u6279\u91cf\u6dfb\u52a0</button>
    </div>
  `;

  const sheet = openBottomSheet('\u6279\u91cf\u6dfb\u52a0\u6d3b\u52a8', html);

  // \u661f\u671f\u51e0\u591a\u9009
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

    // \u65f6\u6bb5\u591a\u9009
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('batch-pp');
    document.body.appendChild(script);
  }, 100);

  window.__saveBatchSession = async () => {
    const name = document.getElementById('batch-pp-name').value.trim() || '\u4e52\u4e53\u7403\u6d3b\u52a8';
    const daysStr = document.getElementById('batch-weekdays').value;
    if (!daysStr) { toast('\u8bf7\u9009\u62e9\u6bcf\u5468\u54ea\u5929'); return; }
    const weekdays = daysStr.split(',').map(Number);

    const slotsStr = document.getElementById('batch-pp-slots').value;
    const timeSlots = slotsStr ? slotsStr.split(',').filter(Boolean) : ['\u665a\u4e0a'];
    if (timeSlots.length === 0) { toast('\u8bf7\u9009\u62e9\u65f6\u6bb5'); return; }

    const startTime = document.getElementById('batch-pp-start').value;
    const duration = parseFloat(document.getElementById('batch-pp-duration').value);
    if (!duration || duration <= 0) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u65f6\u957f'); return; }
    const weeks = parseInt(document.getElementById('batch-pp-weeks').value) || 1;
    const note = document.getElementById('batch-pp-note').value.trim();

    // \u8ba1\u7b97\u65e5\u671f
    const sessions = [];
    const todayDate = new Date();
    const currentWeekStart = weekStart(todayDate);

    for (let w = 0; w < weeks; w++) {
      for (const dayOfWeek of weekdays) {
        // dayOfWeek: 0=\u5468\u65e5,1=\u5468\u4e00...6=\u5468\u516d → \u8f6c\u4e3a\u4ece\u5468\u4e00\u5f00\u59cb\u7684\u504f\u79fb: \u5468\u4e00=0, \u5468\u65e5=6
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + w * 7 + offset);
        // \u8df3\u8fc7\u8fc7\u53bb\u7684\u65e5\u671f（\u672c\u5468\u5df2\u8fc7\u7684\u5929）
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
      toast('\u6ca1\u6709\u53ef\u6dfb\u52a0\u7684\u65e5\u671f（\u672c\u5468\u6240\u9009\u65e5\u671f\u5df2\u8fc7）');
      return;
    }

    await bulkPut('pingpongSessions', sessions);
    toast(`\u5df2\u6dfb\u52a0 ${sessions.length} \u6761\u6d3b\u52a8`);
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// \u6279\u91cf\u6dfb\u52a0\u81ea\u7531\u6d3b\u52a8（\u6309\u661f\u671f\u51e0 + \u8fde\u7eed\u5468\u6570）
// ============================================================

function showBatchAddFreeActivityDialog() {
  const weekDays = [
    { value: 1, label: '\u5468\u4e00' },
    { value: 2, label: '\u5468\u4e8c' },
    { value: 3, label: '\u5468\u4e09' },
    { value: 4, label: '\u5468\u56db' },
    { value: 5, label: '\u5468\u4e94' },
    { value: 6, label: '\u5468\u516d' },
    { value: 0, label: '\u5468\u65e5' },
  ];

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u6d3b\u52a8\u540d\u79f0</label>
        <input type="text" id="batch-fa-name" placeholder="\u5982：\u6563\u6b65、\u6e38\u6cf3、\u5065\u8eab">
      </div>
      <div class="form-group">
        <label>\u6bcf\u5468\u54ea\u5929（\u53ef\u591a\u9009）</label>
        <div class="pp-slot-picker" id="batch-fa-weekday-picker">
          ${weekDays.map(d => `
            <button type="button" class="pp-slot-chip" data-day="${d.value}">${d.label}</button>
          `).join('')}
          <input type="hidden" id="batch-fa-weekdays" value="">
        </div>
        <div class="form-hint" style="margin-top:4px">\u70b9\u51fb\u9009\u62e9\u661f\u671f\u51e0，\u53ef\u591a\u9009</div>
      </div>
      <div class="form-group">
        <label>\u65f6\u6bb5（\u53ef\u591a\u9009）</label>
        ${renderSlotPicker('batch-fa', ['\u4e0b\u5348'])}
      </div>
      <div class="form-group">
        <label>\u5f00\u59cb\u65f6\u95f4</label>
        <input type="time" id="batch-fa-start" value="">
      </div>
      <div class="form-group">
        <label>\u6d3b\u52a8\u65f6\u957f（\u5c0f\u65f6）</label>
        <input type="number" id="batch-fa-duration" step="0.5" min="0.5" value="1">
      </div>
      <div class="form-group">
        <label>\u8fde\u7eed\u5468\u6570</label>
        <input type="number" id="batch-fa-weeks" min="1" max="52" value="4">
        <div class="form-hint">\u4ece\u672c\u5468\u5f00\u59cb，\u8fde\u7eed\u6dfb\u52a0\u591a\u5c11\u5468</div>
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="batch-fa-note" placeholder="\u5982：\u548c\u670b\u53cb\u4e00\u8d77">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBatchFreeActivity()">\u6279\u91cf\u6dfb\u52a0</button>
    </div>
  `;

  const sheet = openBottomSheet('\u6279\u91cf\u6dfb\u52a0\u81ea\u7531\u6d3b\u52a8', html);

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
    if (!name) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u540d\u79f0'); return; }
    const daysStr = document.getElementById('batch-fa-weekdays').value;
    if (!daysStr) { toast('\u8bf7\u9009\u62e9\u6bcf\u5468\u54ea\u5929'); return; }
    const weekdays = daysStr.split(',').map(Number);

    const slotsStr = document.getElementById('batch-fa-slots').value;
    const timeSlots = slotsStr ? slotsStr.split(',').filter(Boolean) : ['\u4e0b\u5348'];
    if (timeSlots.length === 0) { toast('\u8bf7\u9009\u62e9\u65f6\u6bb5'); return; }

    const startTime = document.getElementById('batch-fa-start').value;
    const duration = parseFloat(document.getElementById('batch-fa-duration').value);
    if (!duration || duration <= 0) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u65f6\u957f'); return; }
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
      toast('\u6ca1\u6709\u53ef\u6dfb\u52a0\u7684\u65e5\u671f（\u672c\u5468\u6240\u9009\u65e5\u671f\u5df2\u8fc7）');
      return;
    }

    await bulkPut('freeActivities', activities);
    toast(`\u5df2\u6dfb\u52a0 ${activities.length} \u6761\u6d3b\u52a8`);
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// \u5bf9\u8bdd\u6846：\u65b0\u589e/\u7f16\u8f91\u81ea\u7531\u6d3b\u52a8
// ============================================================

function showAddFreeActivityDialog(presetDate) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u6d3b\u52a8\u540d\u79f0</label>
        <input type="text" id="fa-name" placeholder="\u5982：\u6563\u6b65、\u6e38\u6cf3、\u5065\u8eab、\u9605\u8bfb" value="">
      </div>
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <input type="date" id="fa-date" value="${presetDate || today()}">
      </div>
      <div class="form-group">
        <label>\u65f6\u6bb5（\u53ef\u591a\u9009）</label>
        ${renderSlotPicker('fa', ['\u4e0b\u5348'])}
      </div>
      <div class="form-group">
        <label>\u5f00\u59cb\u65f6\u95f4</label>
        <input type="time" id="fa-start" value="">
      </div>
      <div class="form-group">
        <label>\u6d3b\u52a8\u65f6\u957f（\u5c0f\u65f6）</label>
        <input type="number" id="fa-duration" step="0.5" min="0.5" value="1" placeholder="\u5982：1">
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="fa-note" placeholder="\u5982：\u548c\u670b\u53cb\u4e00\u8d77">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveFreeActivity()">\u4fdd\u5b58</button>
    </div>
  `;

  const sheet = openBottomSheet('\u65b0\u589e\u81ea\u7531\u6d3b\u52a8', html);

  setTimeout(() => {
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('fa');
    document.body.appendChild(script);
  }, 100);

  window.__saveFreeActivity = async () => {
    const name = document.getElementById('fa-name').value.trim();
    const date = document.getElementById('fa-date').value;
    const slotsVal = document.getElementById('fa-slots').value;
    const timeSlots = slotsVal ? slotsVal.split(',').filter(Boolean) : ['\u4e0b\u5348'];
    const startTime = document.getElementById('fa-start').value;
    const duration = parseFloat(document.getElementById('fa-duration').value);
    const note = document.getElementById('fa-note').value.trim();
    if (!name) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u540d\u79f0'); return; }
    if (!date) { toast('\u8bf7\u9009\u62e9\u65e5\u671f'); return; }
    if (!duration || duration <= 0) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u65f6\u957f'); return; }
    await addFreeActivity({ name, date, timeSlots, startTime, duration, note });
    toast('\u81ea\u7531\u6d3b\u52a8\u5df2\u6dfb\u52a0');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

async function showEditFreeActivityDialog(id) {
  const all = await getAll('freeActivities');
  const activity = all.find(a => a.id === id);
  if (!activity) { toast('\u8bb0\u5f55\u4e0d\u5b58\u5728'); return; }

  const selectedSlots = getTimeSlots(activity);

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u6d3b\u52a8\u540d\u79f0</label>
        <input type="text" id="fa-name" value="${escapeHtml(activity.name)}">
      </div>
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <input type="date" id="fa-date" value="${activity.date}">
      </div>
      <div class="form-group">
        <label>\u65f6\u6bb5（\u53ef\u591a\u9009）</label>
        ${renderSlotPicker('fa', selectedSlots)}
      </div>
      <div class="form-group">
        <label>\u5f00\u59cb\u65f6\u95f4</label>
        <input type="time" id="fa-start" value="${activity.startTime || ''}">
      </div>
      <div class="form-group">
        <label>\u6d3b\u52a8\u65f6\u957f（\u5c0f\u65f6）</label>
        <input type="number" id="fa-duration" step="0.5" min="0.5" value="${activity.duration}">
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="fa-note" value="${escapeHtml(activity.note || '')}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateFreeActivity()">\u4fdd\u5b58\u4fee\u6539</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delFreeFromEdit('${id}')">\u5220\u9664\u6b64\u6d3b\u52a8</button>
    </div>
  `;

  const sheet = openBottomSheet('\u7f16\u8f91\u81ea\u7531\u6d3b\u52a8', html);

  setTimeout(() => {
    const script = document.createElement('script');
    script.textContent = buildSlotPickerScript('fa');
    document.body.appendChild(script);
  }, 100);

  window.__updateFreeActivity = async () => {
    const name = document.getElementById('fa-name').value.trim();
    const date = document.getElementById('fa-date').value;
    const slotsVal = document.getElementById('fa-slots').value;
    const timeSlots = slotsVal ? slotsVal.split(',').filter(Boolean) : ['\u4e0b\u5348'];
    const startTime = document.getElementById('fa-start').value;
    const duration = parseFloat(document.getElementById('fa-duration').value);
    const note = document.getElementById('fa-note').value.trim();
    if (!name) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u540d\u79f0'); return; }
    if (!date) { toast('\u8bf7\u9009\u62e9\u65e5\u671f'); return; }
    if (!duration || duration <= 0) { toast('\u8bf7\u586b\u5199\u6d3b\u52a8\u65f6\u957f'); return; }
    activity.name = name;
    activity.date = date;
    activity.timeSlots = timeSlots;
    activity.startTime = startTime;
    activity.duration = duration;
    activity.note = note;
    activity.updatedAt = new Date().toISOString();
    await put('freeActivities', activity);
    toast('\u5df2\u4fee\u6539');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };

  window.__delFreeFromEdit = async (delId) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u81ea\u7531\u6d3b\u52a8？')) {
      await del('freeActivities', delId);
      toast('\u5df2\u5220\u9664');
      sheet.close();
      renderPingpong(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// \u9996\u9875 Dashboard \u5361\u7247
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
        <div class="dash-card-title">🏓 \u6253\u7403\u65f6\u95f4</div>
        <div class="dash-card-more">\u67e5\u770b\u8be6\u60c5 ›</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${sessions.length}</div>
          <div class="dash-stat-label">\u5df2\u5b89\u6392</div>
        </div>
        <div class="dash-stat success">
          <div class="dash-stat-num">${totalHours.toFixed(1)}h</div>
          <div class="dash-stat-label">\u6253\u7403</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${daysFree}</div>
          <div class="dash-stat-label">\u7a7a\u95f2\u5929</div>
        </div>
      </div>
    </div>
  `;
}
