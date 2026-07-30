// ============================================================
// modules/english.js - \u6a21\u57573：\u82f1\u8bed\u80fd\u529b\u63d0\u5347
// \u6bcf\u59295+5+5\u5206\u949f：\u8bcd\u6c47\u6253\u5361 + \u5bf9\u8bdd\u8ddf\u7ec3 + \u542c\u529b\u8bad\u7ec3
// ============================================================

import { put, getAll, del, getSetting, setSetting } from '../db.js';
import { genId, today, fmtDate, toast, escapeHtml, openBottomSheet } from '../utils.js';

let initialized = false;

export async function initEnglish() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// \u8bcd\u6c47\u5e93（\u6309\u5929\u5206\u7ec4，\u6bcf\u59295\u4e2a\u8bcd）
// ============================================================

const VOCAB_GROUPS = [
  [
    { word: 'reservation', meaning: '\u9884\u8ba2', example: 'I have a reservation for tonight.' },
    { word: 'departure', meaning: '\u51fa\u53d1', example: 'What is the departure time?' },
    { word: 'luggage', meaning: '\u884c\u674e', example: 'Where can I store my luggage?' },
    { word: 'itinerary', meaning: '\u884c\u7a0b', example: 'Here is your travel itinerary.' },
    { word: 'accommodation', meaning: '\u4f4f\u5bbf', example: 'The accommodation is included.' },
  ],
  [
    { word: 'souvenir', meaning: '\u7eaa\u5ff5\u54c1', example: 'I bought some souvenirs.' },
    { word: 'currency', meaning: '\u8d27\u5e01', example: 'What currency do they use?' },
    { word: 'visa', meaning: '\u7b7e\u8bc1', example: 'Do I need a visa?' },
    { word: 'terminal', meaning: '\u822a\u7ad9\u697c', example: 'Which terminal is for international flights?' },
    { word: 'boarding pass', meaning: '\u767b\u673a\u724c', example: 'Show your boarding pass please.' },
  ],
  [
    { word: 'delay', meaning: '\u5ef6\u8bef', example: 'The flight is delayed.' },
    { word: 'upgrade', meaning: '\u5347\u7ea7', example: 'Can I upgrade to business class?' },
    { word: 'receipt', meaning: '\u6536\u636e', example: 'Could I have a receipt?' },
    { word: 'discount', meaning: '\u6298\u6263', example: 'Is there a discount?' },
    { word: 'allergy', meaning: '\u8fc7\u654f', example: 'I have a peanut allergy.' },
  ],
  [
    { word: 'appetizer', meaning: '\u5f00\u80c3\u83dc', example: 'Would you like an appetizer?' },
    { word: 'tip', meaning: '\u5c0f\u8d39', example: 'How much should I tip?' },
    { word: 'downtown', meaning: '\u5e02\u4e2d\u5fc3', example: 'The hotel is downtown.' },
    { word: 'suburb', meaning: '\u90ca\u533a', example: 'They live in the suburbs.' },
    { word: 'landmark', meaning: '\u5730\u6807', example: 'The tower is a famous landmark.' },
  ],
  [
    { word: 'checkout', meaning: '\u9000\u623f', example: 'Checkout is at 11 AM.' },
    { word: 'concierge', meaning: '\u793c\u5bbe\u90e8', example: 'Ask the concierge for directions.' },
    { word: 'amenity', meaning: '\u8bbe\u65bd', example: 'What amenities does the hotel have?' },
    { word: 'shuttle', meaning: '\u73ed\u8f66', example: 'Is there an airport shuttle?' },
    { word: 'deposit', meaning: '\u62bc\u91d1', example: 'We need a security deposit.' },
  ],
  [
    { word: 'prescription', meaning: '\u5904\u65b9', example: 'I need to fill a prescription.' },
    { word: 'emergency', meaning: '\u7d27\u6025\u60c5\u51b5', example: 'Call 911 in an emergency.' },
    { word: 'pharmacy', meaning: '\u836f\u5e97', example: 'Is there a pharmacy nearby?' },
    { word: 'appointment', meaning: '\u9884\u7ea6', example: 'I have a doctor appointment.' },
    { word: 'symptom', meaning: '\u75c7\u72b6', example: 'What are your symptoms?' },
  ],
  [
    { word: 'bargain', meaning: '\u8ba8\u4ef7\u8fd8\u4ef7', example: 'Can I bargain here?' },
    { word: 'refund', meaning: '\u9000\u6b3e', example: 'I would like a refund.' },
    { word: 'exchange', meaning: '\u6362\u8d27', example: 'Can I exchange this for a different size?' },
    { word: 'warranty', meaning: '\u4fdd\u4fee', example: 'Does this have a warranty?' },
    { word: 'delivery', meaning: '\u914d\u9001', example: 'Is delivery free?' },
  ],
];

// \u5bf9\u8bdd\u573a\u666f\u5e93（\u4f7f\u7528\u5f53\u5929\u8bcd\u6c47）
const DIALOGUE_SCENES = [
  {
    title: '\u9152\u5e97\u5165\u4f4f',
    scene: '\u5bd2\u6684',
    lines: [
      { speaker: 'Clerk', en: 'Welcome! Do you have a reservation?', cn: '\u6b22\u8fce！\u60a8\u6709\u9884\u8ba2\u5417？' },
      { speaker: 'You', en: 'Yes, I have a reservation for tonight.', cn: '\u662f\u7684，\u6211\u9884\u8ba2\u4e86\u4eca\u665a\u7684。' },
      { speaker: 'Clerk', en: 'May I see your ID and boarding pass?', cn: '\u8bf7\u51fa\u793a\u60a8\u7684\u8eab\u4efd\u8bc1\u4ef6\u548c\u767b\u673a\u724c。' },
      { speaker: 'You', en: 'Sure, here you are. What time is checkout?', cn: '\u597d\u7684，\u7ed9\u4f60。\u8bf7\u95ee\u51e0\u70b9\u9000\u623f？' },
      { speaker: 'Clerk', en: 'Checkout is at 11 AM. Here is your room key.', cn: '\u9000\u623f\u65f6\u95f4\u662f\u4e0a\u534811\u70b9。\u8fd9\u662f\u60a8\u7684\u623f\u95f4\u94a5\u5319。' },
    ],
  },
  {
    title: '\u673a\u573a\u503c\u673a',
    scene: '\u804c\u573a',
    lines: [
      { speaker: 'Staff', en: 'Where are you flying today?', cn: '\u60a8\u4eca\u5929\u98de\u5f80\u54ea\u91cc？' },
      { speaker: 'You', en: 'I am flying to Tokyo. What is the departure time?', cn: '\u6211\u98de\u5f80\u4e1c\u4eac。\u51fa\u53d1\u65f6\u95f4\u662f\u51e0\u70b9？' },
      { speaker: 'Staff', en: 'Your flight departs at 3 PM. Any luggage to check?', cn: '\u60a8\u7684\u822a\u73ed\u4e0b\u53483\u70b9\u51fa\u53d1。\u6709\u884c\u674e\u8981\u6258\u8fd0\u5417？' },
      { speaker: 'You', en: 'Yes, one suitcase. Can I get a window seat?', cn: '\u662f\u7684，\u4e00\u4e2a\u884c\u674e\u7bb1。\u80fd\u7ed9\u6211\u9760\u7a97\u7684\u5ea7\u4f4d\u5417？' },
      { speaker: 'Staff', en: 'Sure. Here is your boarding pass.', cn: '\u597d\u7684。\u8fd9\u662f\u60a8\u7684\u767b\u673a\u724c。' },
    ],
  },
  {
    title: '\u9910\u5385\u70b9\u9910',
    scene: '\u9910\u996e',
    lines: [
      { speaker: 'Waiter', en: 'Would you like an appetizer to start?', cn: '\u60a8\u60f3\u5148\u6765\u4e2a\u5f00\u80c3\u83dc\u5417？' },
      { speaker: 'You', en: 'Yes, please. I have a peanut allergy.', cn: '\u597d\u7684。\u6211\u5bf9\u82b1\u751f\u8fc7\u654f。' },
      { speaker: 'Waiter', en: 'No problem. What would you like for your main course?', cn: '\u6ca1\u95ee\u9898。\u4e3b\u83dc\u60a8\u60f3\u5403\u4ec0\u4e48？' },
      { speaker: 'You', en: 'I will have the grilled salmon. Is there a discount today?', cn: '\u6211\u8981\u70e4\u4e09\u6587\u9c7c。\u4eca\u5929\u6709\u6298\u6263\u5417？' },
      { speaker: 'Waiter', en: 'Yes, 20% off. Could I get you a receipt later?', cn: '\u6709\u7684，\u6253\u516b\u6298。\u7a0d\u540e\u9700\u8981\u6536\u636e\u5417？' },
    ],
  },
  {
    title: '\u8d2d\u7269\u9000\u7a0e',
    scene: '\u8d2d\u7269',
    lines: [
      { speaker: 'Assistant', en: 'How can I help you today?', cn: '\u4eca\u5929\u9700\u8981\u4ec0\u4e48\u5e2e\u52a9？' },
      { speaker: 'You', en: 'I bought some souvenirs. Can I get a refund on tax?', cn: '\u6211\u4e70\u4e86\u4e00\u4e9b\u7eaa\u5ff5\u54c1。\u53ef\u4ee5\u9000\u7a0e\u5417？' },
      { speaker: 'Assistant', en: 'Sure. What currency do you need?', cn: '\u53ef\u4ee5。\u60a8\u9700\u8981\u4ec0\u4e48\u8d27\u5e01？' },
      { speaker: 'You', en: 'Chinese currency, please. Where can I exchange money?', cn: '\u4eba\u6c11\u5e01，\u8c22\u8c22。\u54ea\u91cc\u53ef\u4ee5\u6362\u94b1？' },
      { speaker: 'Assistant', en: 'There is an exchange counter downstairs.', cn: '\u697c\u4e0b\u6709\u4e2a\u5151\u6362\u67dc\u53f0。' },
    ],
  },
  {
    title: '\u9152\u5e97\u9000\u623f',
    scene: '\u65c5\u6e38',
    lines: [
      { speaker: 'You', en: 'I am checking out today.', cn: '\u6211\u4eca\u5929\u9000\u623f。' },
      { speaker: 'Clerk', en: 'How was your stay? Did you enjoy the amenity?', cn: '\u60a8\u4f4f\u5f97\u600e\u4e48\u6837？\u559c\u6b22\u9152\u5e97\u7684\u8bbe\u65bd\u5417？' },
      { speaker: 'You', en: 'Yes, very much. I left my luggage in the room.', cn: '\u975e\u5e38\u559c\u6b22。\u6211\u628a\u884c\u674e\u7559\u5728\u623f\u95f4\u4e86。' },
      { speaker: 'Clerk', en: 'We will send it via shuttle to the airport.', cn: '\u6211\u4eec\u4f1a\u7528\u73ed\u8f66\u9001\u5230\u673a\u573a。' },
      { speaker: 'You', en: 'Thank you. Please keep the deposit as tip.', cn: '\u8c22\u8c22。\u62bc\u91d1\u5c31\u5f53\u5c0f\u8d39\u5427。' },
    ],
  },
  {
    title: '\u836f\u5e97\u5c31\u533b',
    scene: '\u6c42\u52a9',
    lines: [
      { speaker: 'You', en: 'I need to fill a prescription.', cn: '\u6211\u9700\u8981\u914d\u836f。' },
      { speaker: 'Pharmacist', en: 'Do you have an appointment with a doctor?', cn: '\u60a8\u6709\u533b\u751f\u9884\u7ea6\u5417？' },
      { speaker: 'You', en: 'Yes. My symptom is a sore throat.', cn: '\u6709\u7684。\u6211\u7684\u75c7\u72b6\u662f\u5589\u5499\u75db。' },
      { speaker: 'Pharmacist', en: 'Is this an emergency?', cn: '\u8fd9\u662f\u7d27\u6025\u60c5\u51b5\u5417？' },
      { speaker: 'You', en: 'No, just a mild symptom. Where is the pharmacy?', cn: '\u4e0d\u662f，\u53ea\u662f\u8f7b\u5fae\u75c7\u72b6。\u836f\u5e97\u5728\u54ea\u91cc？' },
    ],
  },
  {
    title: '\u5546\u573a\u8d2d\u7269',
    scene: '\u5bb6\u5ead\u805a\u9910',
    lines: [
      { speaker: 'You', en: 'Can I exchange this for a different size?', cn: '\u53ef\u4ee5\u6362\u4e2a\u5c3a\u7801\u5417？' },
      { speaker: 'Assistant', en: 'Sure. Does this have a warranty?', cn: '\u53ef\u4ee5。\u8fd9\u4e2a\u6709\u4fdd\u4fee\u5417？' },
      { speaker: 'You', en: 'Yes. Is delivery free to downtown?', cn: '\u6709\u7684。\u914d\u9001\u5230\u5e02\u4e2d\u5fc3\u514d\u8d39\u5417？' },
      { speaker: 'Assistant', en: 'Yes, free delivery. Would you like to bargain on the price?', cn: '\u514d\u8d39\u914d\u9001。\u60a8\u60f3\u8ba8\u4ef7\u8fd8\u4ef7\u5417？' },
      { speaker: 'You', en: 'Can I get a refund if I do not like it?', cn: '\u5982\u679c\u4e0d\u559c\u6b22\u53ef\u4ee5\u9000\u6b3e\u5417？' },
    ],
  },
];

// \u542c\u529b\u8bad\u7ec3\u7d20\u6750
const LISTENING_EXERCISES = [
  {
    title: '\u673a\u573a\u5e7f\u64ad',
    scene: '\u804c\u573a',
    text: 'Attention passengers. The departure for flight CA981 to Tokyo has been delayed by 30 minutes. The new boarding time is 3:30 PM. Please wait near the terminal gate. Thank you for your patience.',
    questions: [
      { q: '\u822a\u73ed\u98de\u5f80\u54ea\u91cc？', a: 'Tokyo（\u4e1c\u4eac）' },
      { q: '\u539f\u767b\u673a\u65f6\u95f4\u662f\u591a\u5c11？', a: '3:00 PM' },
      { q: '\u5ef6\u8bef\u4e86\u591a\u4e45？', a: '30\u5206\u949f' },
    ],
  },
  {
    title: '\u9152\u5e97\u524d\u53f0',
    scene: '\u9910\u996e',
    text: 'Welcome to our hotel. Your accommodation includes breakfast and free WiFi. Checkout is at 11 AM. If you need anything, please call the concierge. We also have an airport shuttle every hour.',
    questions: [
      { q: '\u4f4f\u5bbf\u5305\u542b\u4ec0\u4e48？', a: '\u65e9\u9910\u548c\u514d\u8d39WiFi' },
      { q: '\u9000\u623f\u65f6\u95f4\u662f\u51e0\u70b9？', a: '\u4e0a\u534811\u70b9' },
      { q: '\u73ed\u8f66\u591a\u4e45\u4e00\u73ed？', a: '\u6bcf\u5c0f\u65f6\u4e00\u73ed' },
    ],
  },
  {
    title: '\u9910\u5385\u5bf9\u8bdd',
    scene: '\u65c5\u6e38',
    text: 'Good evening. Would you like an appetizer? Our specialty is grilled salmon. If you have any allergy, please let us know. We offer a 20% discount today, and a receipt will be provided.',
    questions: [
      { q: '\u7279\u8272\u83dc\u662f\u4ec0\u4e48？', a: '\u70e4\u4e09\u6587\u9c7c' },
      { q: '\u4eca\u5929\u6709\u4ec0\u4e48\u4f18\u60e0？', a: '\u516b\u6298（20% off）' },
      { q: '\u6709\u4ec0\u4e48\u9700\u8981\u6ce8\u610f\u7684？', a: '\u5982\u6709\u8fc7\u654f\u8bf7\u544a\u77e5' },
    ],
  },
  {
    title: '\u8d2d\u7269\u9000\u7a0e',
    scene: '\u8d2d\u7269',
    text: 'You can get a tax refund for your souvenirs. Please show your receipt at the counter. The refund can be given in different currency. There is also an exchange office next door.',
    questions: [
      { q: '\u4ec0\u4e48\u53ef\u4ee5\u9000\u7a0e？', a: '\u7eaa\u5ff5\u54c1（souvenirs）' },
      { q: '\u9700\u8981\u51fa\u793a\u4ec0\u4e48？', a: '\u6536\u636e（receipt）' },
      { q: '\u9000\u6b3e\u53ef\u4ee5\u4ec0\u4e48\u5f62\u5f0f？', a: '\u4e0d\u540c\u8d27\u5e01（currency）' },
    ],
  },
  {
    title: '\u7d27\u6025\u5c31\u533b',
    scene: '\u5bd2\u6684',
    text: 'I understand your symptom. This is not an emergency, but you should see a doctor. I can help you make an appointment. The pharmacy is on the first floor, and you can fill your prescription there.',
    questions: [
      { q: '\u8fd9\u662f\u7d27\u6025\u60c5\u51b5\u5417？', a: '\u4e0d\u662f' },
      { q: '\u5efa\u8bae\u505a\u4ec0\u4e48？', a: '\u770b\u533b\u751f（see a doctor）' },
      { q: '\u836f\u5e97\u5728\u51e0\u697c？', a: '\u4e00\u697c' },
    ],
  },
  {
    title: '\u5546\u573a\u9000\u6362\u8d27',
    scene: '\u60c5\u611f',
    text: 'You can exchange this item within 30 days. Please bring your receipt. If you want a refund, it will take 3 to 5 business days. Does this have a warranty? Yes, one year warranty is included.',
    questions: [
      { q: '\u6362\u8d27\u671f\u9650\u662f\u591a\u4e45？', a: '30\u5929\u5185' },
      { q: '\u9000\u6b3e\u9700\u8981\u51e0\u5929？', a: '3-5\u4e2a\u5de5\u4f5c\u65e5' },
      { q: '\u4fdd\u4fee\u671f\u591a\u4e45？', a: '\u4e00\u5e74' },
    ],
  },
  {
    title: '\u4ea4\u901a\u95ee\u8def',
    scene: '\u6c42\u52a9',
    text: 'To get to downtown, you can take the shuttle from the suburb. It runs every 20 minutes. The landmark you are looking for is the tall tower. You cannot miss it. The journey takes about 30 minutes.',
    questions: [
      { q: '\u53bb\u5e02\u4e2d\u5fc3\u5750\u4ec0\u4e48？', a: '\u73ed\u8f66（shuttle）' },
      { q: '\u73ed\u8f66\u591a\u4e45\u4e00\u73ed？', a: '20\u5206\u949f\u4e00\u73ed' },
      { q: '\u8def\u7a0b\u9700\u8981\u591a\u4e45？', a: '\u7ea630\u5206\u949f' },
    ],
  },
];

// ============================================================
// \u8fdb\u5ea6\u7ba1\u7406
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
  // \u53ea\u770b\u5b8c\u6210\u4e863\u9879\u4efb\u52a1\u7684\u65e5\u671f
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
    type, // '\u8bcd\u6c47' | '\u5bf9\u8bdd' | '\u542c\u529b'
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
    vocab: todayRecords.some(r => r.type === '\u8bcd\u6c47'),
    dialogue: todayRecords.some(r => r.type === '\u5bf9\u8bdd'),
    listening: todayRecords.some(r => r.type === '\u542c\u529b'),
    all: todayRecords,
  };
}

// ============================================================
// \u83b7\u53d6\u5f53\u5929\u5185\u5bb9
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
// \u6536\u85cf\u7ba1\u7406
// ============================================================

const SCENE_COLORS = {
  '\u5bd2\u6684': '#9d8ec4',
  '\u804c\u573a': '#8caa94',
  '\u8d2d\u7269': '#d4a574',
  '\u9910\u996e': '#c08a8a',
  '\u65c5\u6e38': '#7eb8c9',
  '\u6c42\u52a9': '#e8b44f',
  '\u5bb6\u5ead\u805a\u9910': '#c49bb8',
  '\u60c5\u611f': '#a48cc4',
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
    toast('\u5df2\u53d6\u6d88\u6536\u85cf');
  } else {
    await put('englishFavorites', {
      id: genId(),
      type,
      itemIndex,
      title,
      createdAt: new Date().toISOString(),
    });
    toast('\u5df2\u6536\u85cf');
  }
}

// ============================================================
// \u6e32\u67d3：\u82f1\u8bed\u80fd\u529b\u63d0\u5347\u4e3b\u9875\u9762
// ============================================================

export async function renderEnglish(container) {
  const content = await getTodayContent();
  const progress = await getTodayProgress();
  const streak = await getStreak();
  const allRecords = await getProgress();
  const totalMinutes = allRecords.reduce((s, r) => s + r.minutes, 0);
  const completedCount = (progress.vocab ? 1 : 0) + (progress.dialogue ? 1 : 0) + (progress.listening ? 1 : 0);
  const completionRate = Math.round(completedCount / 3 * 100);

  // \u67e5\u8be2\u6536\u85cf\u72b6\u6001
  const vocabFavs = await getFavorites('vocab');
  const dialogueFav = await isFavorited('dialogue', content.day);
  const listeningFav = await isFavorited('listening', content.day);
  const vocabFavSet = new Set(vocabFavs.map(f => f.itemIndex));

  container.innerHTML = `
    <div class="english-stage">
      <div class="english-stage-num">\u6bcf\u65e5\u5b66\u4e60 5+5+5</div>
      <div class="english-stage-name">\u82f1\u8bed\u80fd\u529b\u63d0\u5347</div>
      <div class="english-stage-desc">\u8bcd\u6c47\u6253\u5361 · \u5bf9\u8bdd\u8ddf\u7ec3 · \u542c\u529b\u8bad\u7ec3</div>
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
      <div class="text-sm" style="opacity:0.9">\u8fde\u7eed ${streak} \u5929 · \u7d2f\u8ba1 ${totalMinutes} \u5206\u949f</div>
    </div>

    <!-- \u4efb\u52a11：\u8bcd\u6c47\u6253\u5361 -->
    <div class="english-task-card" style="border-left: 4px solid ${progress.vocab ? 'var(--success)' : 'var(--primary)'}">
      <div class="english-task-day">📝 \u4efb\u52a1\u4e00 · 5\u5206\u949f\u8bcd\u6c47\u6253\u5361 · \u7b2c${content.day}\u5929</div>
      <div class="english-task-title">\u4eca\u65e5\u8bcd\u6c47（${content.vocab.length}\u4e2a）</div>
      <div id="vocab-learn-area">
        ${content.vocab.map((v, i) => `
          <div class="vocab-item" style="padding:10px 0;border-bottom:1px solid var(--gray-100)">
            <div class="font-bold text-sm">${i+1}. ${escapeHtml(v.word)} <span class="text-gray text-xs">${escapeHtml(v.meaning)}</span> <span style="cursor:pointer;font-size:16px;color:#e8b44f;" onclick="window.__toggleVocabFav(${i})">${vocabFavSet.has(i) ? '★' : '☆'}</span></div>
            <div class="text-xs text-gray mt-4">\u4f8b：${escapeHtml(v.example)}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary btn-full mt-16" onclick="window.__completeVocab()" ${progress.vocab ? 'disabled style="opacity:0.5"' : ''}>
        ${progress.vocab ? '✅ \u5df2\u5b8c\u6210\u8bcd\u6c47\u6253\u5361' : '\u5b8c\u6210\u8bcd\u6c47\u6253\u5361（5\u5206\u949f）'}
      </button>
    </div>

    <!-- \u4efb\u52a12：\u5bf9\u8bdd\u8ddf\u7ec3 -->
    <div class="english-task-card" style="border-left: 4px solid ${progress.dialogue ? 'var(--success)' : 'var(--purple)'}">
      <div class="english-task-day">🗣️ \u4efb\u52a1\u4e8c · 5\u5206\u949f\u5bf9\u8bdd\u8ddf\u7ec3</div>
      <div class="english-task-title">\u573a\u666f：${escapeHtml(content.dialogue.title)} ${sceneBadge(content.dialogue.scene)} <span style="cursor:pointer;font-size:18px;color:#e8b44f;vertical-align:middle;" onclick="window.__toggleDialogueFav()">${dialogueFav ? '★' : '☆'}</span></div>
      <div class="english-task-detail text-xs text-gray">\u8fd0\u7528\u4eca\u65e5\u8bcd\u6c47\u7684\u65e5\u5e38\u5bf9\u8bdd，\u8ddf\u8bfb\u7ec3\u4e60\u53d1\u97f3\u548c\u8bed\u8c03</div>
      <div class="dialogue-area mt-16">
        ${content.dialogue.lines.map((line, i) => `
          <div class="dialogue-line" style="padding:10px;margin-bottom:6px;border-radius:8px;background:${line.speaker === 'You' ? 'var(--primary-bg)' : 'var(--gray-100)'}">
            <div class="text-xs font-bold" style="color:${line.speaker === 'You' ? 'var(--primary-dark)' : 'var(--gray-600)'}">${escapeHtml(line.speaker)}（\u4f60）</div>
            <div class="text-sm font-bold mt-4">${escapeHtml(line.en)}</div>
            <div class="text-xs text-gray mt-4">${escapeHtml(line.cn)}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary btn-full mt-16" onclick="window.__completeDialogue()" ${progress.dialogue ? 'disabled style="opacity:0.5"' : ''}>
        ${progress.dialogue ? '✅ \u5df2\u5b8c\u6210\u5bf9\u8bdd\u8ddf\u7ec3' : '\u5b8c\u6210\u5bf9\u8bdd\u8ddf\u7ec3（5\u5206\u949f）'}
      </button>
    </div>

    <!-- \u4efb\u52a13：\u542c\u529b\u8bad\u7ec3 -->
    <div class="english-task-card" style="border-left: 4px solid ${progress.listening ? 'var(--success)' : 'var(--cyan)'}">
      <div class="english-task-day">👂 \u4efb\u52a1\u4e09 · 5\u5206\u949f\u542c\u529b\u8bad\u7ec3</div>
      <div class="english-task-title">${escapeHtml(content.listening.title)} ${sceneBadge(content.listening.scene)} <span style="cursor:pointer;font-size:18px;color:#e8b44f;vertical-align:middle;" onclick="window.__toggleListeningFav()">${listeningFav ? '★' : '☆'}</span></div>
      <div class="english-task-detail text-xs text-gray">\u9605\u8bfb\u4ee5\u4e0b\u77ed\u6587，\u7406\u89e3\u5185\u5bb9\u540e\u56de\u7b54\u95ee\u9898</div>
      <div class="listening-text mt-16" style="padding:14px;background:var(--gray-50);border-radius:8px;line-height:1.8;font-size:14px">
        ${escapeHtml(content.listening.text)}
      </div>
      <div class="listening-questions mt-16">
        <div class="text-xs text-gray mb-8">\u7406\u89e3\u95ee\u9898（\u70b9\u51fb\u67e5\u770b\u7b54\u6848）：</div>
        ${content.listening.questions.map((q, i) => `
          <div class="listening-q" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div class="text-sm" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'" style="cursor:pointer">
              ${i+1}. ${escapeHtml(q.q)} <span class="text-xs text-primary">▾ \u70b9\u51fb\u67e5\u770b\u7b54\u6848</span>
            </div>
            <div class="text-xs text-success mt-4" style="display:none">\u7b54\u6848：${escapeHtml(q.a)}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary btn-full mt-16" onclick="window.__completeListening()" ${progress.listening ? 'disabled style="opacity:0.5"' : ''}>
        ${progress.listening ? '✅ \u5df2\u5b8c\u6210\u542c\u529b\u8bad\u7ec3' : '\u5b8c\u6210\u542c\u529b\u8bad\u7ec3（5\u5206\u949f）'}
      </button>
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">📊 \u5b66\u4e60\u8bb0\u5f55</span></div>
      ${allRecords.length > 0 ? allRecords.slice(0, 15).map(r => `
        <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--gray-100)">
          <div>
            <span class="text-sm">${r.type === '\u8bcd\u6c47' ? '📝' : r.type === '\u5bf9\u8bdd' ? '🗣️' : '👂'} ${escapeHtml(r.type)}</span>
            <span class="text-xs text-gray ml-8">${fmtDate(r.date)}</span>
          </div>
          <span class="text-sm font-bold">${r.minutes}\u5206\u949f</span>
        </div>
      `).join('') : '<div class="text-sm text-gray text-center" style="padding:12px">\u8fd8\u6ca1\u6709\u5b66\u4e60\u8bb0\u5f55</div>'}
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">🎯 \u5b66\u4e60\u76ee\u6807</span></div>
      <div class="text-sm" style="color:var(--gray-600);line-height:1.8">
        <div>✈️ \u51fa\u56fd\u65c5\u6e38\u4e0d\u9700\u7ffb\u8bd1</div>
        <div>🎬 \u770b\u82f1\u8bed\u7535\u5f71\u5927\u591a\u4e0d\u7528\u4e2d\u6587\u5b57\u5e55</div>
        <div>🗣️ \u65e5\u5e38\u53e3\u8bed\u6d41\u5229\u4ea4\u6d41</div>
        <div>👂 \u542c\u529b\u7406\u89e3\u80fd\u529b\u663e\u8457\u63d0\u5347</div>
        <div class="mt-8 text-xs">💡 \u6bcf\u592915\u5206\u949f（5+5+5），\u575a\u6301\u5c31\u80fd\u770b\u5230\u53d8\u5316</div>
      </div>
    </div>
  `;

  window.__completeVocab = async () => {
    if (progress.vocab) return;
    await logStudy('\u8bcd\u6c47', 5, `\u7b2c${content.day}\u5929\u8bcd\u6c47：${content.vocab.map(v => v.word).join(', ')}`);
    toast('\u8bcd\u6c47\u6253\u5361\u5b8c\u6210！+5\u5206\u949f');
    renderEnglish(container);
  };

  window.__completeDialogue = async () => {
    if (progress.dialogue) return;
    await logStudy('\u5bf9\u8bdd', 5, `\u5bf9\u8bdd\u8ddf\u7ec3：${content.dialogue.title}`);
    toast('\u5bf9\u8bdd\u8ddf\u7ec3\u5b8c\u6210！+5\u5206\u949f');
    renderEnglish(container);
  };

  window.__completeListening = async () => {
    if (progress.listening) return;
    await logStudy('\u542c\u529b', 5, `\u542c\u529b\u8bad\u7ec3：${content.listening.title}`);
    toast('\u542c\u529b\u8bad\u7ec3\u5b8c\u6210！+5\u5206\u949f');
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
// \u9996\u9875 Dashboard \u5361\u7247
// ============================================================

export async function dashboardEnglish() {
  const content = await getTodayContent();
  const progress = await getTodayProgress();
  const streak = await getStreak();
  const completedCount = (progress.vocab ? 1 : 0) + (progress.dialogue ? 1 : 0) + (progress.listening ? 1 : 0);

  return `
    <div class="dash-card" onclick="window.__navigate('english')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">📚 \u82f1\u8bed\u80fd\u529b\u63d0\u5347</div>
        <div class="dash-card-more">${completedCount}/3 ›</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${streak}</div>
          <div class="dash-stat-label">\u8fde\u7eed\u5929\u6570</div>
        </div>
        <div class="dash-stat success">
          <div class="dash-stat-num">${completedCount}/3</div>
          <div class="dash-stat-label">\u4eca\u65e5\u5b8c\u6210</div>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)">
        <div class="text-xs text-gray mb-8">\u4eca\u65e5\u4efb\u52a1（5+5+5\u5206\u949f）</div>
        <div class="text-sm" style="padding:3px 0">${progress.vocab ? '✅' : '⬜'} 📝 \u8bcd\u6c47\u6253\u5361</div>
        <div class="text-sm" style="padding:3px 0">${progress.dialogue ? '✅' : '⬜'} 🗣️ \u5bf9\u8bdd\u8ddf\u7ec3</div>
        <div class="text-sm" style="padding:3px 0">${progress.listening ? '✅' : '⬜'} 👂 \u542c\u529b\u8bad\u7ec3</div>
      </div>
    </div>
  `;
}
