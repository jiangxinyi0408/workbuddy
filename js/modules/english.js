// ============================================================
// modules/english.js - 模块3：英语口语学习
// ============================================================

import { put, getAll, getSetting, setSetting } from '../db.js';
import { genId, today, fmtDate, toast, escapeHtml } from '../utils.js';

let initialized = false;

export async function initEnglish() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// 90天学习计划
// ============================================================

const STUDY_PLAN = generateStudyPlan();

function generateStudyPlan() {
  const plan = [];

  // 阶段1：1-30天 基础重建
  for (let day = 1; day <= 30; day++) {
    const weekday = (day - 1) % 7;
    let type, title, detail;
    if (weekday === 0 || weekday === 2 || weekday === 4) {
      type = '口语';
      title = `旅游口语跟读 Day ${day}`;
      detail = '跟读旅游场景对话，练习发音和语调。重点：机场值机、酒店入住、餐厅点餐';
    } else if (weekday === 1 || weekday === 3 || weekday === 5) {
      type = '听力';
      title = `听力训练 Day ${day}`;
      detail = '慢速英语听力练习，听写旅游短片对白。训练抓取关键词和主旨';
    } else {
      type = '词汇';
      title = `词汇巩固 Day ${day}`;
      detail = '复习本周词汇 + 学习20个旅游高频词，用联想记忆法巩固';
    }
    plan.push({ day, phase: 1, type, title, detail, duration: 15 + Math.floor(day / 10) * 5 });
  }

  // 阶段2：31-60天 场景强化
  const scenes = ['机场出行', '酒店住宿', '餐厅用餐', '问路交通', '购物退税', '紧急情况', '社交对话'];
  for (let day = 31; day <= 60; day++) {
    const sceneIdx = (day - 31) % scenes.length;
    const weekday = (day - 1) % 7;
    let type, title, detail;
    if (weekday === 6) {
      type = '词汇';
      title = `场景词汇 Day ${day}`;
      detail = `巩固${scenes[sceneIdx]}相关词汇和表达`;
    } else if (weekday % 2 === 0) {
      type = '口语';
      title = `${scenes[sceneIdx]}口语 Day ${day}`;
      detail = `角色扮演${scenes[sceneIdx]}场景，练习完整对话流程，注意地道表达`;
    } else {
      type = '听力';
      title = `影视听写 Day ${day}`;
      detail = `观看英语影视片段，逐句听写，对照字幕纠正。提升连读和弱读识别`;
    }
    plan.push({ day, phase: 2, type, title, detail, duration: 20 + Math.floor((day - 30) / 10) * 5 });
  }

  // 阶段3：61-90天 实战提升
  for (let day = 61; day <= 90; day++) {
    const weekday = (day - 1) % 7;
    let type, title, detail;
    if (weekday === 6) {
      type = '词汇';
      title = `高级词汇 Day ${day}`;
      detail = '学习影视/新闻高级词汇，习语和俚语表达';
    } else if (weekday % 3 === 0) {
      type = '口语';
      title = `自由表达 Day ${day}`;
      detail = '给定话题，用英语自由表达2分钟。录音回听，纠正语法和发音';
    } else {
      type = '听力';
      title = `无字幕理解 Day ${day}`;
      detail = '观看无字幕英语视频，理解主旨和细节。逐步提升到能理解80%内容';
    }
    plan.push({ day, phase: 3, type, title, detail, duration: 25 + Math.floor((day - 60) / 10) * 5 });
  }

  return plan;
}

// 每日实用口语
const DAILY_PHRASES = [
  { en: "Could you help me with this?", cn: "你能帮我一下吗？" },
  { en: "I'd like to check in, please.", cn: "我想办理入住。" },
  { en: "What time does it open?", cn: "几点开门？" },
  { en: "Can I have the menu, please?", cn: "请给我菜单好吗？" },
  { en: "How much does this cost?", cn: "这个多少钱？" },
  { en: "Where is the nearest station?", cn: "最近的车站在哪里？" },
  { en: "I'll have what she's having.", cn: "我要和她一样的。" },
  { en: "Could you say that again?", cn: "你能再说一遍吗？" },
  { en: "I'm looking for a pharmacy.", cn: "我在找药店。" },
  { en: "Is there a discount?", cn: "有折扣吗？" },
  { en: "I'd like to book a room.", cn: "我想预订一个房间。" },
  { en: "Can I pay by credit card?", cn: "可以用信用卡支付吗？" },
  { en: "What do you recommend?", cn: "你推荐什么？" },
  { en: "I have a reservation.", cn: "我有预约。" },
  { en: "Could I get a receipt?", cn: "能给我收据吗？" },
  { en: "Where can I exchange money?", cn: "哪里可以换钱？" },
  { en: "I'm allergic to seafood.", cn: "我对海鲜过敏。" },
  { en: "How long does it take?", cn: "需要多长时间？" },
  { en: "Could you call a taxi for me?", cn: "能帮我叫辆出租车吗？" },
  { en: "I'd like to return this.", cn: "我想退货。" },
  { en: "What's your specialty?", cn: "你们的特色菜是什么？" },
  { en: "I need to see a doctor.", cn: "我需要看医生。" },
  { en: "Can you lower the price?", cn: "能便宜点吗？" },
  { en: "I'm checking out today.", cn: "我今天退房。" },
  { en: "Is breakfast included?", cn: "包含早餐吗？" },
  { en: "Which platform is the train?", cn: "火车在哪个站台？" },
  { en: "I'd like a window seat.", cn: "我想要靠窗的座位。" },
  { en: "Can I try this on?", cn: "我可以试穿吗？" },
  { en: "Where is the restroom?", cn: "洗手间在哪里？" },
  { en: "Could you wrap it up?", cn: "能帮我打包吗？" },
];

// 核心词汇库
const VOCABULARY = [
  { word: 'reservation', meaning: '预订', example: 'I have a reservation for tonight.' },
  { word: 'departure', meaning: '出发', example: 'What is the departure time?' },
  { word: 'luggage', meaning: '行李', example: 'Where can I store my luggage?' },
  { word: 'itinerary', meaning: '行程', example: 'Here is your travel itinerary.' },
  { word: 'accommodation', meaning: '住宿', example: 'The accommodation is included.' },
  { word: 'souvenir', meaning: '纪念品', example: 'I bought some souvenirs.' },
  { word: 'currency', meaning: '货币', example: 'What currency do they use?' },
  { word: 'visa', meaning: '签证', example: 'Do I need a visa?' },
  { word: 'terminal', meaning: '航站楼', example: 'Which terminal is for international flights?' },
  { word: 'boarding pass', meaning: '登机牌', example: 'Show your boarding pass please.' },
  { word: 'delay', meaning: '延误', example: 'The flight is delayed.' },
  { word: 'upgrade', meaning: '升级', example: 'Can I upgrade to business class?' },
  { word: 'receipt', meaning: '收据', example: 'Could I have a receipt?' },
  { word: 'discount', meaning: '折扣', example: 'Is there a discount?' },
  { word: 'allergy', meaning: '过敏', example: 'I have a peanut allergy.' },
  { word: 'appetizer', meaning: '开胃菜', example: 'Would you like an appetizer?' },
  { word: 'tip', meaning: '小费', example: 'How much should I tip?' },
  { word: 'downtown', meaning: '市中心', example: 'The hotel is downtown.' },
  { word: 'suburb', meaning: '郊区', example: 'They live in the suburbs.' },
  { word: 'landmark', meaning: '地标', example: 'The tower is a famous landmark.' },
];

// ============================================================
// 进度管理
// ============================================================

async function getProgress() {
  const records = await getAll('englishProgress');
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  return records;
}

async function getCurrentDay() {
  const startDay = await getSetting('englishStartDate', null);
  if (!startDay) {
    await setSetting('englishStartDate', today());
    return 1;
  }
  const start = new Date(startDay);
  const now = new Date();
  const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(diff, 1), 90);
}

async function getStreak() {
  const records = await getProgress();
  if (records.length === 0) return 0;
  let streak = 0;
  let checkDate = new Date();
  for (;;) {
    const dateStr = fmtDate(checkDate);
    const hasRecord = records.some(r => r.date === dateStr);
    if (hasRecord) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // 今天还没学不算断
      if (streak === 0 && dateStr === today()) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return streak;
}

async function logStudy(type, minutes, content) {
  const record = {
    id: genId(),
    date: today(),
    type,
    minutes: parseInt(minutes) || 15,
    content: content || '',
    createdAt: new Date().toISOString(),
  };
  await put('englishProgress', record);
  return record;
}

// ============================================================
// 渲染：英语学习主页面
// ============================================================

export async function renderEnglish(container) {
  const currentDay = await getCurrentDay();
  const todayTask = STUDY_PLAN[currentDay - 1];
  const phase = todayTask.phase;
  const phaseNames = ['', '基础重建', '场景强化', '实战提升'];
  const phaseDescs = ['', '旅游口语跟读 + 基础听力 + 核心词汇', '全场景对话 + 影视听写', '无字幕理解 + 自由表达'];

  const records = await getProgress();
  const totalMinutes = records.reduce((s, r) => s + r.minutes, 0);
  const streak = await getStreak();
  const completionRate = Math.round(records.length / 90 * 100);

  // 每日一句
  const phraseIdx = (currentDay - 1) % DAILY_PHRASES.length;
  const phrase = DAILY_PHRASES[phraseIdx];

  container.innerHTML = `
    <div class="english-stage">
      <div class="english-stage-num">阶段 ${phase} / 3</div>
      <div class="english-stage-name">${phaseNames[phase]}</div>
      <div class="english-stage-desc">${phaseDescs[phase]} · 第 ${currentDay} 天</div>
      <div class="progress-ring">
        <svg width="80" height="80">
          <circle class="progress-ring-bg" cx="40" cy="40" r="34" fill="none" stroke-width="6"/>
          <circle class="progress-ring-fill" cx="40" cy="40" r="34" fill="none" stroke-width="6"
            stroke-dasharray="${2 * Math.PI * 34}"
            stroke-dashoffset="${2 * Math.PI * 34 * (1 - completionRate / 100)}"
            stroke-linecap="round"/>
        </svg>
        <div class="progress-ring-text">${completionRate}%</div>
      </div>
      <div class="text-sm" style="opacity:0.9">连续学习 ${streak} 天 · 累计 ${totalMinutes} 分钟</div>
    </div>

    <div class="english-task-card">
      <div class="english-task-day">第 ${currentDay} 天 · ${todayTask.type} · 建议 ${todayTask.duration}分钟</div>
      <div class="english-task-title">${escapeHtml(todayTask.title)}</div>
      <div class="english-task-detail">${escapeHtml(todayTask.detail)}</div>
      <button class="btn-primary btn-full mt-16" onclick="window.__completeEnglish()">完成今日学习</button>
    </div>

    <div class="english-phrase">
      <div class="text-xs text-gray mb-8">💬 每日一句</div>
      <div class="english-phrase-en">"${escapeHtml(phrase.en)}"</div>
      <div class="english-phrase-cn">${escapeHtml(phrase.cn)}</div>
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">📚 核心词汇（${VOCABULARY.length}个）</span></div>
      <div id="vocab-list">
        ${VOCABULARY.slice(0, 5).map(v => `
          <div style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div class="font-bold text-sm">${escapeHtml(v.word)} <span class="text-gray text-xs">${escapeHtml(v.meaning)}</span></div>
            <div class="text-xs text-gray mt-4">${escapeHtml(v.example)}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn-outline btn-full mt-8" onclick="window.__showAllVocab()">查看全部词汇</button>
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">📊 学习记录</span></div>
      ${records.length > 0 ? records.slice(0, 10).map(r => `
        <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--gray-100)">
          <div>
            <span class="text-sm">${escapeHtml(r.type)}</span>
            <span class="text-xs text-gray ml-8">${fmtDate(r.date)}</span>
          </div>
          <span class="text-sm font-bold">${r.minutes}分钟</span>
        </div>
      `).join('') : '<div class="text-sm text-gray text-center" style="padding:12px">还没有学习记录</div>'}
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">🎯 学习目标</span></div>
      <div class="text-sm" style="color:var(--gray-600);line-height:1.8">
        <div>✈️ 出国旅游不需翻译</div>
        <div>🎬 看英语电影大多不用中文字幕</div>
        <div>🗣️ 日常口语流利交流</div>
        <div>👂 听力理解能力显著提升</div>
      </div>
    </div>
  `;

  window.__completeEnglish = async () => {
    await logStudy(todayTask.type, todayTask.duration, todayTask.title);
    toast(`太棒了！已记录 ${todayTask.duration} 分钟学习`);
    renderEnglish(container);
  };

  window.__showAllVocab = () => {
    const html = `
      <div class="settings-form">
        ${VOCABULARY.map(v => `
          <div style="padding:10px 0;border-bottom:1px solid var(--gray-100)">
            <div class="font-bold">${escapeHtml(v.word)} <span class="text-gray text-sm">${escapeHtml(v.meaning)}</span></div>
            <div class="text-xs text-gray mt-4">${escapeHtml(v.example)}</div>
          </div>
        `).join('')}
      </div>
    `;
    const sheet = openBottomSheet2('全部词汇', html);
  };
}

function openBottomSheet2(title, html) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header"><h3>${escapeHtml(title)}</h3><button class="sheet-close">✕</button></div>
      <div class="sheet-body">${html}</div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 300); };
  overlay.querySelector('.sheet-close').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  return { overlay, close };
}

// ============================================================
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardEnglish() {
  const currentDay = await getCurrentDay();
  const todayTask = STUDY_PLAN[currentDay - 1];
  const streak = await getStreak();
  const phraseIdx = (currentDay - 1) % DAILY_PHRASES.length;
  const phrase = DAILY_PHRASES[phraseIdx];

  return `
    <div class="dash-card" onclick="window.__navigate('english')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">📚 英语学习</div>
        <div class="dash-card-more">第${currentDay}天 ›</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${streak}</div>
          <div class="dash-stat-label">连续天数</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${todayTask.duration}</div>
          <div class="dash-stat-label">今日分钟</div>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)">
        <div class="text-xs text-gray mb-8">今日任务：${escapeHtml(todayTask.title)}</div>
        <div class="english-phrase-en" style="font-size:13px">"${escapeHtml(phrase.en)}"</div>
        <div class="english-phrase-cn" style="font-size:12px">${escapeHtml(phrase.cn)}</div>
      </div>
    </div>
  `;
}
