// ============================================================
// modules/pingpong.js - 模块2：打球时间
// 周历视图：周一~周日，每天显示已安排活动 + 空闲时段
// ============================================================

import { put, getAll, del } from '../db.js';
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
    timeSlot: data.timeSlot || '晚上',
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
// 渲染：周历视图
// ============================================================

export async function renderPingpong(container) {
  const sessions = await getWeekSessions();
  const [wStart, wEnd] = weekRange(new Date());

  // 构建周一~周日列表
  const ws = weekStart(new Date());
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const dateStr = fmtDate(d);
    const daySessions = sessions.filter(s => s.date === dateStr);
    const dayOfWeek = d.getDay() || 7;
    const isToday = dateStr === today();
    weekDays.push({
      date: dateStr,
      dayName: weekdayName(d),
      dayNum: parseInt(dateStr.slice(8)),
      dayOfWeek,
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
      <!-- 顶部汇总 -->
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

      <!-- 周一~周日 时间轴 -->
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

          ${day.sessions.length > 0 ? day.sessions.map(s => `
            <div class="pp-slot pp-slot-filled" onclick="window.__editSession('${s.id}')">
              <div class="pp-slot-time">
                <span class="pp-slot-icon">${slotIcon[s.timeSlot] || '🕐'}</span>
                <span class="pp-slot-period">${s.timeSlot}</span>
                ${s.startTime ? `<span class="pp-slot-clock">${s.startTime}</span>` : ''}
              </div>
              <div class="pp-slot-body">
                <div class="pp-slot-name">${escapeHtml(s.name)}</div>
                <div class="pp-slot-meta">
                  <span>⏱ ${s.duration}小时</span>
                  ${s.note ? `<span>📝 ${escapeHtml(s.note)}</span>` : ''}
                </div>
              </div>
              <button class="task-delete" onclick="event.stopPropagation();window.__delSession('${s.id}')">✕</button>
            </div>
          `).join('') : `
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

  // 注册全局函数
  window.__ppAdd = () => showAddSessionDialog(container, today());
  window.__ppQuickAdd = (date) => showAddSessionDialog(container, date);

  window.__delSession = async (id) => {
    if (await confirmDialog('删除这条活动记录？')) {
      await del('pingpongSessions', id);
      renderPingpong(document.getElementById('main-content'));
    }
  };

  window.__editSession = (id) => showEditSessionDialog(container, id);
}

// ============================================================
// 添加活动对话框
// ============================================================

function showAddSessionDialog(container, presetDate) {
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
        <label>时段</label>
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
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="pp-note" placeholder="如：和同事一起">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveSession()">保存</button>
    </div>
  `;

  const sheet = openBottomSheet('新增活动', html);

  window.__saveSession = async () => {
    const name = document.getElementById('pp-name').value.trim();
    const date = document.getElementById('pp-date').value;
    const timeSlot = document.getElementById('pp-timeslot').value;
    const startTime = document.getElementById('pp-start').value;
    const duration = parseFloat(document.getElementById('pp-duration').value);
    const note = document.getElementById('pp-note').value.trim();
    if (!date) { toast('请选择日期'); return; }
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    await addSession({ name, date, timeSlot, startTime, duration, note });
    toast('活动已添加');
    sheet.close();
    renderPingpong(document.getElementById('main-content'));
  };
}

// ============================================================
// 编辑活动对话框
// ============================================================

async function showEditSessionDialog(container, id) {
  const all = await getAll('pingpongSessions');
  const session = all.find(s => s.id === id);
  if (!session) { toast('记录不存在'); return; }

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
        <label>时段</label>
        <select id="pp-timeslot">
          <option value="上午" ${session.timeSlot==='上午'?'selected':''}>🌅 上午</option>
          <option value="下午" ${session.timeSlot==='下午'?'selected':''}>☀️ 下午</option>
          <option value="晚上" ${session.timeSlot==='晚上'?'selected':''}>🌙 晚上</option>
        </select>
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

  window.__updateSession = async () => {
    const name = document.getElementById('pp-name').value.trim();
    const date = document.getElementById('pp-date').value;
    const timeSlot = document.getElementById('pp-timeslot').value;
    const startTime = document.getElementById('pp-start').value;
    const duration = parseFloat(document.getElementById('pp-duration').value);
    const note = document.getElementById('pp-note').value.trim();
    if (!date) { toast('请选择日期'); return; }
    if (!duration || duration <= 0) { toast('请填写活动时长'); return; }
    session.name = name;
    session.date = date;
    session.timeSlot = timeSlot;
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
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardPingpong() {
  const sessions = await getWeekSessions();
  const totalHours = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const daysWithActivity = new Set(sessions.map(s => s.date)).size;
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
          <div class="dash-stat-label">总时长</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${daysFree}</div>
          <div class="dash-stat-label">空闲天</div>
        </div>
      </div>
    </div>
  `;
}
