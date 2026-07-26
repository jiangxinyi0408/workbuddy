// ============================================================
// modules/pingpong.js - 模块2：打球时间
// ============================================================

import { put, getAll, del, getSetting, setSetting } from '../db.js';
import { genId, today, fmtDate, weekStart, weekRange, weekdayName, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';

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
    name: data.name || '乒乓球活动',
    timeSlot: data.timeSlot || '晚上', // 上午/下午/晚上
    startTime: data.startTime || '',
    duration: data.duration || 2, // 活动时长（小时）
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
// 休息时间计算（不扣除乒乓活动和工作时间）
// ============================================================

async function calculateRestTime() {
  // 休息时间 = 每天的非工作时间
  // 工作日（周一到周五）：18:00-22:00 为休息时间（下班后）
  // 周末：08:00-22:00 为休息时间
  // 不扣除乒乓球活动，乒乓活动也算休息时间的一部分
  const weekDays = [];
  const ws = weekStart(new Date());
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const restTimeByDay = weekDays.map((date) => {
    const dayOfWeek = date.getDay() || 7;
    const isWeekend = dayOfWeek >= 6;
    const dateStr = fmtDate(date);

    // 休息时段
    const restSlots = isWeekend
      ? [{ start: '08:00', end: '22:00' }]
      : [{ start: '18:00', end: '22:00' }];

    // 计算休息时间小时数
    let restHours = 0;
    restSlots.forEach(slot => {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      restHours += (eh * 60 + em - sh * 60 - sm) / 60;
    });

    // 当天的乒乓活动
    const daySessions = getWeekSessions.result ? [] : [];
    return {
      date: dateStr,
      dayName: weekdayName(date),
      isWeekend,
      restSlots,
      restHours: Math.round(restHours * 10) / 10,
    };
  });

  // 获取本周活动用于显示
  const sessions = await getWeekSessions();
  const sessionByDate = {};
  sessions.forEach(s => {
    if (!sessionByDate[s.date]) sessionByDate[s.date] = [];
    sessionByDate[s.date].push(s);
  });

  restTimeByDay.forEach(d => {
    d.sessions = sessionByDate[d.date] || [];
  });

  return restTimeByDay;
}

// ============================================================
// 渲染：打球时间主页面
// ============================================================

let currentView = 'schedule'; // 'schedule' | 'resttime'

export async function renderPingpong(container) {
  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentView==='schedule'?'active':''}" onclick="window.__ppTab('schedule')">🏓 活动安排</button>
      <button class="filter-tab ${currentView==='resttime'?'active':''}" onclick="window.__ppTab('resttime')">🕐 休息时间</button>
    </div>
    <div id="pp-content"></div>
    <button class="fab" onclick="window.__ppAdd()">+</button>
  `;

  window.__ppTab = (t) => { currentView = t; renderPingpong(container); };
  window.__ppAdd = () => {
    if (currentView === 'schedule') showAddSessionDialog(container);
  };

  await renderPingpongContent();
}

async function renderPingpongContent() {
  const content = document.getElementById('pp-content');
  if (!content) return;

  if (currentView === 'schedule') await renderSchedule(content);
  else await renderRestTime(content);
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
        <div class="text-xs text-gray mt-8">点击 + 新增活动</div>
      </div>
    `;
    return;
  }

  const slotIcon = { '上午': '🌅', '下午': '☀️', '晚上': '🌙' };

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
          <div class="pingpong-time">${escapeHtml(s.name)}</div>
          <div class="text-xs text-gray">
            ${slotIcon[s.timeSlot] || '🕐'} ${s.timeSlot} ${s.startTime ? '· ' + s.startTime : ''} · ${s.duration}小时
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
// 休息时间
// ============================================================

async function renderRestTime(container) {
  const restTimeData = await calculateRestTime();
  const totalRest = restTimeData.reduce((sum, d) => sum + d.restHours, 0);

  container.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,var(--success),#6b9e76);color:white">
      <div class="text-sm" style="opacity:0.9">本周休息时间</div>
      <div style="font-size:32px;font-weight:700;margin-top:4px">${totalRest.toFixed(1)} 小时</div>
      <div class="text-sm" style="opacity:0.9;margin-top:4px">工作日下班后 + 周末全天</div>
    </div>

    <div class="free-time-grid">
      ${restTimeData.map(d => `
        <div class="free-time-day ${d.restHours === 0 ? 'busy' : ''}">
          <div class="free-time-day-label">${d.dayName}</div>
          <div class="free-time-day-hours">${d.restHours}</div>
          <div class="text-xs text-gray">小时</div>
        </div>
      `).join('')}
    </div>

    ${restTimeData.map(d => `
      <div class="card">
        <div class="card-title">
          <span class="title-left">${d.dayName} ${d.date.slice(5)} ${d.isWeekend ? '🏖️' : '💼'}</span>
          <span class="text-xs text-success">${d.restHours}h休息</span>
        </div>
        <div class="flex gap-8" style="flex-wrap:wrap">
          ${d.restSlots.map(slot => `
            <span class="task-tag" style="background:var(--success-bg);color:var(--success);padding:4px 10px">${slot.start} - ${slot.end}</span>
          `).join('')}
        </div>
        ${d.sessions && d.sessions.length > 0 ? `
        <div class="text-xs text-gray mt-8">🏓 乒乓活动：${d.sessions.map(s => s.name + '(' + s.timeSlot + ')').join(', ')}</div>
        ` : '<div class="text-xs text-gray mt-8">无乒乓活动安排</div>'}
      </div>
    `).join('')}
  `;
}

// ============================================================
// 新增活动对话框
// ============================================================

function showAddSessionDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>活动名称</label>
        <input type="text" id="pp-name" placeholder="如：乒乓球训练、友谊赛" value="乒乓球活动">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="pp-date" value="${today()}">
      </div>
      <div class="form-group">
        <label>活动时间</label>
        <select id="pp-timeslot">
          <option value="上午">🌅 上午</option>
          <option value="下午">☀️ 下午</option>
          <option value="晚上" selected>🌙 晚上</option>
        </select>
      </div>
      <div class="form-group">
        <label>开始时间</label>
        <input type="time" id="pp-start" value="19:00">
      </div>
      <div class="form-group">
        <label>活动时长（小时）</label>
        <input type="number" id="pp-duration" step="0.5" min="0.5" value="2" placeholder="如：2">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveSession()">保存</button>
    </div>
  `;

  const sheet = openBottomSheet('新增活动', html);
  window.__currentSheet = sheet;

  window.__saveSession = async () => {
    const name = document.getElementById('pp-name').value.trim();
    const date = document.getElementById('pp-date').value;
    const timeSlot = document.getElementById('pp-timeslot').value;
    const startTime = document.getElementById('pp-start').value;
    const duration = parseFloat(document.getElementById('pp-duration').value);
    if (!date) { toast('请选择日期'); return; }
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    await addSession({ name, date, timeSlot, startTime, duration });
    toast('活动已添加');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardPingpong() {
  const sessions = await getWeekSessions();
  const restTimeData = await calculateRestTime();
  const totalRest = restTimeData.reduce((sum, d) => sum + d.restHours, 0);
  const totalPingpong = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  return `
    <div class="dash-card" onclick="window.__navigate('pingpong')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">🏓 乒乓&休息</div>
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
          <div class="dash-stat-num">${totalRest.toFixed(1)}</div>
          <div class="dash-stat-label">休息(小时)</div>
        </div>
      </div>
    </div>
  `;
}
