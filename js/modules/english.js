// ============================================================
// modules/english.js - 模块3：英语能力提升
// 每天5+5+5分钟：词汇打卡 + 对话跟练 + 听力训练
// ============================================================

import { put, getAll, del, getSetting, setSetting } from '../db.js';
import { genId, today, fmtDate, toast, escapeHtml, openBottomSheet } from '../utils.js';

let initialized = false;

export async function initEnglish() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// 词汇库（按天分组，每天5个词）
// ============================================================

const VOCAB_GROUPS = [
  [
    { word: 'reservation', meaning: '预订', example: 'I have a reservation for tonight.' },
    { word: 'departure', meaning: '出发', example: 'What is the departure time?' },
    { word: 'luggage', meaning: '行李', example: 'Where can I store my luggage?' },
    { word: 'itinerary', meaning: '行程', example: 'Here is your travel itinerary.' },
    { word: 'accommodation', meaning: '住宿', example: 'The accommodation is included.' },
  ],
  [
    { word: 'souvenir', meaning: '纪念品', example: 'I bought some souvenirs.' },
    { word: 'currency', meaning: '货币', example: 'What currency do they use?' },
    { word: 'visa', meaning: '签证', example: 'Do I need a visa?' },
    { word: 'terminal', meaning: '航站楼', example: 'Which terminal is for international flights?' },
    { word: 'boarding pass', meaning: '登机牌', example: 'Show your boarding pass please.' },
  ],
  [
    { word: 'delay', meaning: '延误', example: 'The flight is delayed.' },
    { word: 'upgrade', meaning: '升级', example: 'Can I upgrade to business class?' },
    { word: 'receipt', meaning: '收据', example: 'Could I have a receipt?' },
    { word: 'discount', meaning: '折扣', example: 'Is there a discount?' },
    { word: 'allergy', meaning: '过敏', example: 'I have a peanut allergy.' },
  ],
  [
    { word: 'appetizer', meaning: '开胃菜', example: 'Would you like an appetizer?' },
    { word: 'tip', meaning: '小费', example: 'How much should I tip?' },
    { word: 'downtown', meaning: '市中心', example: 'The hotel is downtown.' },
    { word: 'suburb', meaning: '郊区', example: 'They live in the suburbs.' },
    { word: 'landmark', meaning: '地标', example: 'The tower is a famous landmark.' },
  ],
  [
    { word: 'checkout', meaning: '退房', example: 'Checkout is at 11 AM.' },
    { word: 'concierge', meaning: '礼宾部', example: 'Ask the concierge for directions.' },
    { word: 'amenity', meaning: '设施', example: 'What amenities does the hotel have?' },
    { word: 'shuttle', meaning: '班车', example: 'Is there an airport shuttle?' },
    { word: 'deposit', meaning: '押金', example: 'We need a security deposit.' },
  ],
  [
    { word: 'prescription', meaning: '处方', example: 'I need to fill a prescription.' },
    { word: 'emergency', meaning: '紧急情况', example: 'Call 911 in an emergency.' },
    { word: 'pharmacy', meaning: '药店', example: 'Is there a pharmacy nearby?' },
    { word: 'appointment', meaning: '预约', example: 'I have a doctor appointment.' },
    { word: 'symptom', meaning: '症状', example: 'What are your symptoms?' },
  ],
  [
    { word: 'bargain', meaning: '讨价还价', example: 'Can I bargain here?' },
    { word: 'refund', meaning: '退款', example: 'I would like a refund.' },
    { word: 'exchange', meaning: '换货', example: 'Can I exchange this for a different size?' },
    { word: 'warranty', meaning: '保修', example: 'Does this have a warranty?' },
    { word: 'delivery', meaning: '配送', example: 'Is delivery free?' },
  ],
];

// 对话场景库（使用当天词汇）
const DIALOGUE_SCENES = [
  {
    title: '酒店入住',
    scene: '寒暄',
    lines: [
      { speaker: 'Clerk', en: 'Welcome! Do you have a reservation?', cn: '欢迎！您有预订吗？' },
      { speaker: 'You', en: 'Yes, I have a reservation for tonight.', cn: '是的，我预订了今晚的。' },
      { speaker: 'Clerk', en: 'May I see your ID and boarding pass?', cn: '请出示您的身份证件和登机牌。' },
      { speaker: 'You', en: 'Sure, here you are. What time is checkout?', cn: '好的，给你。请问几点退房？' },
      { speaker: 'Clerk', en: 'Checkout is at 11 AM. Here is your room key.', cn: '退房时间是上午11点。这是您的房间钥匙。' },
    ],
  },
  {
    title: '机场值机',
    scene: '职场',
    lines: [
      { speaker: 'Staff', en: 'Where are you flying today?', cn: '您今天飞往哪里？' },
      { speaker: 'You', en: 'I am flying to Tokyo. What is the departure time?', cn: '我飞往东京。出发时间是几点？' },
      { speaker: 'Staff', en: 'Your flight departs at 3 PM. Any luggage to check?', cn: '您的航班下午3点出发。有行李要托运吗？' },
      { speaker: 'You', en: 'Yes, one suitcase. Can I get a window seat?', cn: '是的，一个行李箱。能给我靠窗的座位吗？' },
      { speaker: 'Staff', en: 'Sure. Here is your boarding pass.', cn: '好的。这是您的登机牌。' },
    ],
  },
  {
    title: '餐厅点餐',
    scene: '餐饮',
    lines: [
      { speaker: 'Waiter', en: 'Would you like an appetizer to start?', cn: '您想先来个开胃菜吗？' },
      { speaker: 'You', en: 'Yes, please. I have a peanut allergy.', cn: '好的。我对花生过敏。' },
      { speaker: 'Waiter', en: 'No problem. What would you like for your main course?', cn: '没问题。主菜您想吃什么？' },
      { speaker: 'You', en: 'I will have the grilled salmon. Is there a discount today?', cn: '我要烤三文鱼。今天有折扣吗？' },
      { speaker: 'Waiter', en: 'Yes, 20% off. Could I get you a receipt later?', cn: '有的，打八折。稍后需要收据吗？' },
    ],
  },
  {
    title: '购物退税',
    scene: '购物',
    lines: [
      { speaker: 'Assistant', en: 'How can I help you today?', cn: '今天需要什么帮助？' },
      { speaker: 'You', en: 'I bought some souvenirs. Can I get a refund on tax?', cn: '我买了一些纪念品。可以退税吗？' },
      { speaker: 'Assistant', en: 'Sure. What currency do you need?', cn: '可以。您需要什么货币？' },
      { speaker: 'You', en: 'Chinese currency, please. Where can I exchange money?', cn: '人民币，谢谢。哪里可以换钱？' },
      { speaker: 'Assistant', en: 'There is an exchange counter downstairs.', cn: '楼下有个兑换柜台。' },
    ],
  },
  {
    title: '酒店退房',
    scene: '旅游',
    lines: [
      { speaker: 'You', en: 'I am checking out today.', cn: '我今天退房。' },
      { speaker: 'Clerk', en: 'How was your stay? Did you enjoy the amenity?', cn: '您住得怎么样？喜欢酒店的设施吗？' },
      { speaker: 'You', en: 'Yes, very much. I left my luggage in the room.', cn: '非常喜欢。我把行李留在房间了。' },
      { speaker: 'Clerk', en: 'We will send it via shuttle to the airport.', cn: '我们会用班车送到机场。' },
      { speaker: 'You', en: 'Thank you. Please keep the deposit as tip.', cn: '谢谢。押金就当小费吧。' },
    ],
  },
  {
    title: '药店就医',
    scene: '求助',
    lines: [
      { speaker: 'You', en: 'I need to fill a prescription.', cn: '我需要配药。' },
      { speaker: 'Pharmacist', en: 'Do you have an appointment with a doctor?', cn: '您有医生预约吗？' },
      { speaker: 'You', en: 'Yes. My symptom is a sore throat.', cn: '有的。我的症状是喉咙痛。' },
      { speaker: 'Pharmacist', en: 'Is this an emergency?', cn: '这是紧急情况吗？' },
      { speaker: 'You', en: 'No, just a mild symptom. Where is the pharmacy?', cn: '不是，只是轻微症状。药店在哪里？' },
    ],
  },
  {
    title: '商场购物',
    scene: '家庭聚餐',
    lines: [
      { speaker: 'You', en: 'Can I exchange this for a different size?', cn: '可以换个尺码吗？' },
      { speaker: 'Assistant', en: 'Sure. Does this have a warranty?', cn: '可以。这个有保修吗？' },
      { speaker: 'You', en: 'Yes. Is delivery free to downtown?', cn: '有的。配送到市中心免费吗？' },
      { speaker: 'Assistant', en: 'Yes, free delivery. Would you like to bargain on the price?', cn: '免费配送。您想讨价还价吗？' },
      { speaker: 'You', en: 'Can I get a refund if I do not like it?', cn: '如果不喜欢可以退款吗？' },
    ],
  },
];

// 听力训练素材
const LISTENING_EXERCISES = [
  {
    title: '机场广播',
    scene: '职场',
    text: 'Attention passengers. The departure for flight CA981 to Tokyo has been delayed by 30 minutes. The new boarding time is 3:30 PM. Please wait near the terminal gate. Thank you for your patience.',
    questions: [
      { q: '航班飞往哪里？', a: 'Tokyo（东京）' },
      { q: '原登机时间是多少？', a: '3:00 PM' },
      { q: '延误了多久？', a: '30分钟' },
    ],
  },
  {
    title: '酒店前台',
    scene: '餐饮',
    text: 'Welcome to our hotel. Your accommodation includes breakfast and free WiFi. Checkout is at 11 AM. If you need anything, please call the concierge. We also have an airport shuttle every hour.',
    questions: [
      { q: '住宿包含什么？', a: '早餐和免费WiFi' },
      { q: '退房时间是几点？', a: '上午11点' },
      { q: '班车多久一班？', a: '每小时一班' },
    ],
  },
  {
    title: '餐厅对话',
    scene: '旅游',
    text: 'Good evening. Would you like an appetizer? Our specialty is grilled salmon. If you have any allergy, please let us know. We offer a 20% discount today, and a receipt will be provided.',
    questions: [
      { q: '特色菜是什么？', a: '烤三文鱼' },
      { q: '今天有什么优惠？', a: '八折（20% off）' },
      { q: '有什么需要注意的？', a: '如有过敏请告知' },
    ],
  },
  {
    title: '购物退税',
    scene: '购物',
    text: 'You can get a tax refund for your souvenirs. Please show your receipt at the counter. The refund can be given in different currency. There is also an exchange office next door.',
    questions: [
      { q: '什么可以退税？', a: '纪念品（souvenirs）' },
      { q: '需要出示什么？', a: '收据（receipt）' },
      { q: '退款可以什么形式？', a: '不同货币（currency）' },
    ],
  },
  {
    title: '紧急就医',
    scene: '寒暄',
    text: 'I understand your symptom. This is not an emergency, but you should see a doctor. I can help you make an appointment. The pharmacy is on the first floor, and you can fill your prescription there.',
    questions: [
      { q: '这是紧急情况吗？', a: '不是' },
      { q: '建议做什么？', a: '看医生（see a doctor）' },
      { q: '药店在几楼？', a: '一楼' },
    ],
  },
  {
    title: '商场退换货',
    scene: '情感',
    text: 'You can exchange this item within 30 days. Please bring your receipt. If you want a refund, it will take 3 to 5 business days. Does this have a warranty? Yes, one year warranty is included.',
    questions: [
      { q: '换货期限是多久？', a: '30天内' },
      { q: '退款需要几天？', a: '3-5个工作日' },
      { q: '保修期多久？', a: '一年' },
    ],
  },
  {
    title: '交通问路',
    scene: '求助',
    text: 'To get to downtown, you can take the shuttle from the suburb. It runs every 20 minutes. The landmark you are looking for is the tall tower. You cannot miss it. The journey takes about 30 minutes.',
    questions: [
      { q: '去市中心坐什么？', a: '班车（shuttle）' },
      { q: '班车多久一班？', a: '20分钟一班' },
      { q: '路程需要多久？', a: '约30分钟' },
    ],
  },
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
  return Math.max(diff, 1);
}

async function getStreak() {
  const records = await getProgress();
  // 只看完成了3项任务的日期
  const fullDays = {};
  records.forEach(r => {
    if (!fullDays[r.date]) fullDays[r.date] = new Set();
    fullDays[r.date].add(r.type);
  });
  const completedDates = Object.keys(fullDays).filter(d => fullDays[d].size >= 3);

  if (completedDates.length === 0) return 0;
  let streak = 0;
  let checkDate = new Date();
  for (;;) {
    const dateStr = fmtDate(checkDate);
    if (completedDates.includes(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
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
    type, // '词汇' | '对话' | '听力'
    minutes: parseInt(minutes) || 5,
    content: content || '',
    createdAt: new Date().toISOString(),
  };
  await put('englishProgress', record);
  return record;
}

async function getTodayProgress() {
  const records = await getProgress();
  const todayRecords = records.filter(r => r.date === today());
  return {
    vocab: todayRecords.some(r => r.type === '词汇'),
    dialogue: todayRecords.some(r => r.type === '对话'),
    listening: todayRecords.some(r => r.type === '听力'),
    all: todayRecords,
  };
}

// ============================================================
// 获取当天内容
// ============================================================

async function getTodayContent() {
  const day = await getCurrentDay();
  const groupIdx = (day - 1) % VOCAB_GROUPS.length;
  const sceneIdx = (day - 1) % DIALOGUE_SCENES.length;
  const listeningIdx = (day - 1) % LISTENING_EXERCISES.length;

  return {
    day,
    vocab: VOCAB_GROUPS[groupIdx],
    dialogue: DIALOGUE_SCENES[sceneIdx],
    listening: LISTENING_EXERCISES[listeningIdx],
  };
}

// ============================================================
// 收藏管理
// ============================================================

const SCENE_COLORS = {
  '寒暄': '#9d8ec4',
  '职场': '#8caa94',
  '购物': '#d4a574',
  '餐饮': '#c08a8a',
  '旅游': '#7eb8c9',
  '求助': '#e8b44f',
  '家庭聚餐': '#c49bb8',
  '情感': '#a48cc4',
};

function sceneBadge(scene) {
  const color = SCENE_COLORS[scene] || '#999';
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">${escapeHtml(scene)}</span>`;
}

async function getFavorites(type) {
  const all = await getAll('englishFavorites');
  return all.filter(f => f.type === type);
}

async function isFavorited(type, itemIndex) {
  const favs = await getFavorites(type);
  return favs.some(f => f.type === type && f.itemIndex === itemIndex);
}

async function toggleFavorite(type, itemIndex, title) {
  const favs = await getFavorites(type);
  const existing = favs.find(f => f.itemIndex === itemIndex);
  if (existing) {
    await del('englishFavorites', existing.id);
    toast('已取消收藏');
  } else {
    await put('englishFavorites', {
      id: genId(),
      type,
      itemIndex,
      title,
      createdAt: new Date().toISOString(),
    });
    toast('已收藏');
  }
}

// ============================================================
// 渲染：英语能力提升主页面
// ============================================================

export async function renderEnglish(container) {
  const content = await getTodayContent();
  const progress = await getTodayProgress();
  const streak = await getStreak();
  const allRecords = await getProgress();
  const totalMinutes = allRecords.reduce((s, r) => s + r.minutes, 0);
  const completedCount = (progress.vocab ? 1 : 0) + (progress.dialogue ? 1 : 0) + (progress.listening ? 1 : 0);
  const completionRate = Math.round(completedCount / 3 * 100);

  // 查询收藏状态
  const vocabFavs = await getFavorites('vocab');
  const dialogueFav = await isFavorited('dialogue', content.day);
  const listeningFav = await isFavorited('listening', content.day);
  const vocabFavSet = new Set(vocabFavs.map(f => f.itemIndex));

  container.innerHTML = `
    <div class="english-stage">
      <div class="english-stage-num">每日学习 5+5+5</div>
      <div class="english-stage-name">英语能力提升</div>
      <div class="english-stage-desc">词汇打卡 · 对话跟练 · 听力训练</div>
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
      <div class="text-sm" style="opacity:0.9">连续 ${streak} 天 · 累计 ${totalMinutes} 分钟</div>
    </div>

    <!-- 任务1：词汇打卡 -->
    <div class="english-task-card" style="border-left: 4px solid ${progress.vocab ? 'var(--success)' : 'var(--primary)'}">
      <div class="english-task-day">📝 任务一 · 5分钟词汇打卡 · 第${content.day}天</div>
      <div class="english-task-title">今日词汇（${content.vocab.length}个）</div>
      <div id="vocab-learn-area">
        ${content.vocab.map((v, i) => `
          <div class="vocab-item" style="padding:10px 0;border-bottom:1px solid var(--gray-100)">
            <div class="font-bold text-sm">${i+1}. ${escapeHtml(v.word)} <span class="text-gray text-xs">${escapeHtml(v.meaning)}</span> <span style="cursor:pointer;font-size:16px;color:#e8b44f;" onclick="window.__toggleVocabFav(${i})">${vocabFavSet.has(i) ? '★' : '☆'}</span></div>
            <div class="text-xs text-gray mt-4">例：${escapeHtml(v.example)}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary btn-full mt-16" onclick="window.__completeVocab()" ${progress.vocab ? 'disabled style="opacity:0.5"' : ''}>
        ${progress.vocab ? '✅ 已完成词汇打卡' : '完成词汇打卡（5分钟）'}
      </button>
    </div>

    <!-- 任务2：对话跟练 -->
    <div class="english-task-card" style="border-left: 4px solid ${progress.dialogue ? 'var(--success)' : 'var(--purple)'}">
      <div class="english-task-day">🗣️ 任务二 · 5分钟对话跟练</div>
      <div class="english-task-title">场景：${escapeHtml(content.dialogue.title)} ${sceneBadge(content.dialogue.scene)} <span style="cursor:pointer;font-size:18px;color:#e8b44f;vertical-align:middle;" onclick="window.__toggleDialogueFav()">${dialogueFav ? '★' : '☆'}</span></div>
      <div class="english-task-detail text-xs text-gray">运用今日词汇的日常对话，跟读练习发音和语调</div>
      <div class="dialogue-area mt-16">
        ${content.dialogue.lines.map((line, i) => `
          <div class="dialogue-line" style="padding:10px;margin-bottom:6px;border-radius:8px;background:${line.speaker === 'You' ? 'var(--primary-bg)' : 'var(--gray-100)'}">
            <div class="text-xs font-bold" style="color:${line.speaker === 'You' ? 'var(--primary-dark)' : 'var(--gray-600)'}">${escapeHtml(line.speaker)}（你）</div>
            <div class="text-sm font-bold mt-4">${escapeHtml(line.en)}</div>
            <div class="text-xs text-gray mt-4">${escapeHtml(line.cn)}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary btn-full mt-16" onclick="window.__completeDialogue()" ${progress.dialogue ? 'disabled style="opacity:0.5"' : ''}>
        ${progress.dialogue ? '✅ 已完成对话跟练' : '完成对话跟练（5分钟）'}
      </button>
    </div>

    <!-- 任务3：听力训练 -->
    <div class="english-task-card" style="border-left: 4px solid ${progress.listening ? 'var(--success)' : 'var(--cyan)'}">
      <div class="english-task-day">👂 任务三 · 5分钟听力训练</div>
      <div class="english-task-title">${escapeHtml(content.listening.title)} ${sceneBadge(content.listening.scene)} <span style="cursor:pointer;font-size:18px;color:#e8b44f;vertical-align:middle;" onclick="window.__toggleListeningFav()">${listeningFav ? '★' : '☆'}</span></div>
      <div class="english-task-detail text-xs text-gray">阅读以下短文，理解内容后回答问题</div>
      <div class="listening-text mt-16" style="padding:14px;background:var(--gray-50);border-radius:8px;line-height:1.8;font-size:14px">
        ${escapeHtml(content.listening.text)}
      </div>
      <div class="listening-questions mt-16">
        <div class="text-xs text-gray mb-8">理解问题（点击查看答案）：</div>
        ${content.listening.questions.map((q, i) => `
          <div class="listening-q" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div class="text-sm" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'" style="cursor:pointer">
              ${i+1}. ${escapeHtml(q.q)} <span class="text-xs text-primary">▾ 点击查看答案</span>
            </div>
            <div class="text-xs text-success mt-4" style="display:none">答案：${escapeHtml(q.a)}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary btn-full mt-16" onclick="window.__completeListening()" ${progress.listening ? 'disabled style="opacity:0.5"' : ''}>
        ${progress.listening ? '✅ 已完成听力训练' : '完成听力训练（5分钟）'}
      </button>
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">📊 学习记录</span></div>
      ${allRecords.length > 0 ? allRecords.slice(0, 15).map(r => `
        <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--gray-100)">
          <div>
            <span class="text-sm">${r.type === '词汇' ? '📝' : r.type === '对话' ? '🗣️' : '👂'} ${escapeHtml(r.type)}</span>
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
        <div class="mt-8 text-xs">💡 每天15分钟（5+5+5），坚持就能看到变化</div>
      </div>
    </div>
  `;

  window.__completeVocab = async () => {
    if (progress.vocab) return;
    await logStudy('词汇', 5, `第${content.day}天词汇：${content.vocab.map(v => v.word).join(', ')}`);
    toast('词汇打卡完成！+5分钟');
    renderEnglish(container);
  };

  window.__completeDialogue = async () => {
    if (progress.dialogue) return;
    await logStudy('对话', 5, `对话跟练：${content.dialogue.title}`);
    toast('对话跟练完成！+5分钟');
    renderEnglish(container);
  };

  window.__completeListening = async () => {
    if (progress.listening) return;
    await logStudy('听力', 5, `听力训练：${content.listening.title}`);
    toast('听力训练完成！+5分钟');
    renderEnglish(container);
  };

  window.__toggleVocabFav = async (i) => {
    await toggleFavorite('vocab', i, content.vocab[i].word);
    renderEnglish(container);
  };

  window.__toggleDialogueFav = async () => {
    await toggleFavorite('dialogue', content.day, content.dialogue.title);
    renderEnglish(container);
  };

  window.__toggleListeningFav = async () => {
    await toggleFavorite('listening', content.day, content.listening.title);
    renderEnglish(container);
  };
}

// ============================================================
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardEnglish() {
  const content = await getTodayContent();
  const progress = await getTodayProgress();
  const streak = await getStreak();
  const completedCount = (progress.vocab ? 1 : 0) + (progress.dialogue ? 1 : 0) + (progress.listening ? 1 : 0);

  return `
    <div class="dash-card" onclick="window.__navigate('english')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">📚 英语能力提升</div>
        <div class="dash-card-more">${completedCount}/3 ›</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${streak}</div>
          <div class="dash-stat-label">连续天数</div>
        </div>
        <div class="dash-stat success">
          <div class="dash-stat-num">${completedCount}/3</div>
          <div class="dash-stat-label">今日完成</div>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)">
        <div class="text-xs text-gray mb-8">今日任务（5+5+5分钟）</div>
        <div class="text-sm" style="padding:3px 0">${progress.vocab ? '✅' : '⬜'} 📝 词汇打卡</div>
        <div class="text-sm" style="padding:3px 0">${progress.dialogue ? '✅' : '⬜'} 🗣️ 对话跟练</div>
        <div class="text-sm" style="padding:3px 0">${progress.listening ? '✅' : '⬜'} 👂 听力训练</div>
      </div>
    </div>
  `;
}
