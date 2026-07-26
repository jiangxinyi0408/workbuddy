// ============================================================
// modules/pingpong.js - 模块2：乒乓球时间规划
// ============================================================

import { put, getAll, del, getSetting, setSetting } from '../db.js';
import { genId, today, fmtDate, fmtTime, weekStart, weekEnd, weekRange, weekdayName, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';

let initialized = false;

export async function initPingpong() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// 数据操作
// ============================================================

async function addSession(data) {
  const session = {
    id: genId(),
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location || '',
    type: data.type || '娱乐',
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  };
  await put('pingpongSessions', session);
  return session;
}

async function getWeekSessions() {
  const [wStart, wEnd] = weekRange(new Date());
  const all = await getAll('pingpongSessions');
  return all.filter(s => s.date >= wStart && s.date <= wEnd).sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
// 自由时间计算
// ============================================================

async function calculateFreeTime() {
  const sessions = await getWeekSessions();
  const busySlots = await getSetting('busySlots', []);

  // 默认时间网格
  // 工作日（周一到周五）：18:00-22:00 可用
  // 周末：08:00-22:00 可用
  const weekDays = [];
  const ws = weekStart(new Date());
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const freeTimeByDay = weekDays.map((date, idx) => {
    const dayOfWeek = date.getDay() || 7; // 1-7, 1=周一
    const isWeekend = dayOfWeek >= 6;
    const dateStr = fmtDate(date);

    // 可用时段
    const availableSlots = isWeekend
      ? [{ start: '08:00', end: '22:00' }]
      : [{ start: '18:00', end: '22:00' }];

    // 扣除乒乓球活动
    const daySessions = sessions.filter(s => s.date === dateStr);
    const dayBusy = busySlots.filter(b => b.date === dateStr);

    const allBusy = [...daySessions, ...dayBusy];
    let freeSlots = availableSlots;

    allBusy.forEach(busy => {
      const newSlots = [];
      freeSlots.forEach(slot => {
        if (busy.startTime >= slot.end || busy.endTime <= slot.start) {
          // 不重叠
          newSlots.push(slot);
        } else {
          // 有重叠，拆分
          if (busy.startTime > slot.start) {
            newSlots.push({ start: slot.start, end: busy.startTime });
          }
          if (busy.endTime < slot.end) {
            newSlots.push({ start: busy.endTime, end: slot.end });
          }
        }
      });
      freeSlots = newSlots;
    });

    // 计算自由时间小时数
    let freeHours = 0;
    freeSlots.forEach(slot => {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      freeHours += (eh * 60 + em - sh * 60 - sm) / 60;
    });

    return {
      date: dateStr,
      dayName: weekdayName(date),
      isWeekend,
      freeSlots,
      freeHours: Math.round(freeHours * 10) / 10,
      sessions: daySessions,
    };
  });

  return freeTimeByDay;
}

// ============================================================
// 渲染：乒乓球时间主页面
// ============================================================

let currentView = 'schedule'; // 'schedule' | 'freetime'

export async function renderPingpong(container) {
  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentView==='schedule'?'active':''}" onclick="window.__ppTab('schedule')">🏓 活动安排</button>
      <button class="filter-tab ${currentView==='freetime'?'active':''}" onclick="window.__ppTab('freetime')">🕐 自由时间</button>
    </div>
    <div id="pp-content"></div>
    <button class="fab" onclick="window.__ppAdd()">+</button>
  `;

  window.__ppTab = (t) => { currentView = t; renderPingpong(container); };
  window.__ppAdd = () => {
    if (currentView === 'schedule') showAddSessionDialog(container);
    else showAddBusyDialog(container);
  };

  await renderPingpongContent();
}

async function renderPingpongContent() {
  const content = document.getElementById('pp-content');
  if (!content) return;

  if (currentView === 'schedule') await renderSchedule(content);
  else await renderFreeTime(content);
}

// ============================================================
// 活动安排
// ============================================================

async function renderSchedule(container) {
  const sessions = await getWeekSessions();
  const [wStart, wEnd] = weekRange(new Date());

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏓</div>
        <div class="empty-text">本周暂无乒乓球活动</div>
        <div class="text-xs text-gray mt-8">点击 + 登记活动</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-title">
        <span class="title-left">📅 本周活动 (${sessions.length})</span>
        <span class="text-xs text-gray">${wStart.slice(5)} - ${wEnd.slice(5)}</span>
      </div>
    </div>
    ${sessions.map(s => `
      <div class="pingpong-session">
        <div class="pingpong-date">
          <div class="pingpong-date-day">${s.date.slice(8)}</div>
          <div class="pingpong-date-weekday">${weekdayName(s.date)}</div>
        </div>
        <div class="pingpong-info">
          <div class="pingpong-time">${s.startTime} - ${s.endTime}</div>
          <div class="text-xs text-gray">
            ${s.type} ${s.location ? '· ' + escapeHtml(s.location) : ''}
          </div>
        </div>
        <button class="task-delete" onclick="window.__delSession('${s.id}')">✕</button>
      </div>
    `).join('')}
  `;

  window.__delSession = async (id) => {
    if (await confirmDialog('删除这条活动记录？')) {
      await del('pingpongSessions', id);
      renderPingpong(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// 自由时间
// ============================================================

async function renderFreeTime(container) {
  const freeTimeData = await calculateFreeTime();
  const totalFree = freeTimeData.reduce((sum, d) => sum + d.freeHours, 0);

  container.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,var(--success),#059669);color:white">
      <div class="text-sm" style="opacity:0.9">本周可用自由时间</div>
      <div style="font-size:32px;font-weight:700;margin-top:4px">${totalFree.toFixed(1)} 小时</div>
      <div class="text-sm" style="opacity:0.9;margin-top:4px">扣除乒乓球活动后的空闲时间</div>
    </div>

    <div class="free-time-grid">
      ${freeTimeData.map(d => `
        <div class="free-time-day ${d.freeHours === 0 ? 'busy' : ''}">
          <div class="free-time-day-label">${d.dayName}</div>
          <div class="free-time-day-hours">${d.freeHours}</div>
          <div class="text-xs text-gray">小时</div>
        </div>
      `).join('')}
    </div>

    ${freeTimeData.map(d => d.freeSlots.length > 0 ? `
      <div class="card">
        <div class="card-title">
          <span class="title-left">${d.dayName} ${d.date.slice(5)} ${d.isWeekend ? '🏖️' : '💼'}</span>
          <span class="text-xs ${d.freeHours > 0 ? 'text-success' : 'text-gray'}">${d.freeHours}h空闲</span>
        </div>
        <div class="flex gap-8" style="flex-wrap:wrap">
          ${d.freeSlots.map(slot => `
            <span class="task-tag" style="background:var(--success-bg);color:var(--success);padding:4px 10px">${slot.start} - ${slot.end}</span>
          `).join('')}
        </div>
        ${d.sessions.length > 0 ? `
        <div class="text-xs text-gray mt-8">🏓 乒乓球：${d.sessions.map(s => `${s.startTime}-${s.endTime}`).join(', ')}</div>
        ` : ''}
      </div>
    ` : '').join('')}
  `;
}

// ============================================================
// 添加活动对话框
// ============================================================

function showAddSessionDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="pp-date" value="${today()}">
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="pp-start" value="19:00">
      </div>
      <div class="form-group">
        <label>结束时间</label>
        <input type="time" id="pp-end" value="21:00">
      </div>
      <div class="form-group">
        <label>活动类型</label>
        <select id="pp-type">
          <option value="训练">训练</option>
          <option value="比赛">比赛</option>
          <option value="娱乐">娱乐</option>
        </select>
      </div>
      <div class="form-group">
        <label>地点（可选）</label>
        <input type="text" id="pp-location" placeholder="如：社区活动中心">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveSession()">保存</button>
    </div>
  `;

  const sheet = openBottomSheet('登记乒乓球活动', html);
  window.__currentSheet = sheet;

  window.__saveSession = async () => {
    const date = document.getElementById('pp-date').value;
    const startTime = document.getElementById('pp-start').value;
    const endTime = document.getElementById('pp-end').value;
    if (!date || !startTime || !endTime) { toast('请填写完整时间'); return; }
    if (startTime >= endTime) { toast('结束时间需晚于开始时间'); return; }
    await addSession({
      date,
      startTime,
      endTime,
      type: document.getElementById('pp-type').value,
      location: document.getElementById('pp-location').value.trim(),
    });
    toast('活动已登记');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// 添加不可用时段
// ============================================================

function showAddBusyDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="text-sm text-gray" style="margin-bottom:12px">标注其他不可用时段（如已有安排），将自动从自由时间中扣除</div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="busy-date" value="${today()}">
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="busy-start" value="20:00">
      </div>
      <div class="form-group">
        <label>结束时间</label>
        <input type="time" id="busy-end" value="22:00">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBusy()">保存</button>
    </div>
  `;

  const sheet = openBottomSheet('添加不可用时段', html);
  window.__currentSheet = sheet;

  window.__saveBusy = async () => {
    const date = document.getElementById('busy-date').value;
    const startTime = document.getElementById('busy-start').value;
    const endTime = document.getElementById('busy-end').value;
    if (!date || !startTime || !endTime) { toast('请填写完整'); return; }
    const busySlots = await getSetting('busySlots', []);
    busySlots.push({ date, startTime, endTime });
    await setSetting('busySlots', busySlots);
    toast('已添加不可用时段');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardPingpong() {
  const sessions = await getWeekSessions();
  const freeTimeData = await calculateFreeTime();
  const totalFree = freeTimeData.reduce((sum, d) => sum + d.freeHours, 0);
  const totalPingpong = sessions.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    return sum + (eh * 60 + em - sh * 60 - sm) / 60;
  }, 0);

  return `
    <div class="dash-card" onclick="window.__navigate('pingpong')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">🏓 乒乓球 & 自由时间</div>
        <div class="dash-card-more">查看详情 ›</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${sessions.length}</div>
          <div class="dash-stat-label">本周活动</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${totalPingpong.toFixed(1)}</div>
          <div class="dash-stat-label">乒乓(小时)</div>
        </div>
        <div class="dash-stat success">
          <div class="dash-stat-num">${totalFree.toFixed(1)}</div>
          <div class="dash-stat-label">自由(小时)</div>
        </div>
      </div>
    </div>
  `;
}
