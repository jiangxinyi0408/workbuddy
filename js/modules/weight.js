// ============================================================
// modules/weight.js - 模块5：减肥管理（体重+饮食）
// ============================================================

import { put, getAll, del, getByIndex, getByRange, getSetting, setSetting } from '../db.js';
import { genId, today, fmtDate, toast, openBottomSheet, confirmDialog, escapeHtml, compressImage } from '../utils.js';
import { recognizeFood, generateDietRecommendation, ruleBasedDietAdvice } from '../ai.js';

// ============================================================
// 食物热量数据库（中国常见食物，单位：卡/100g 或 卡/份）
// ============================================================

const FOOD_DB = [
  // === 主食类 ===
  { name: '白米饭', unit: '100g', calories: 116, cat: '主食' },
  { name: '白米饭', unit: '1碗(200g)', calories: 232, cat: '主食' },
  { name: '馒头', unit: '100g', calories: 223, cat: '主食' },
  { name: '馒头', unit: '1个(100g)', calories: 223, cat: '主食' },
  { name: '花卷', unit: '100g', calories: 211, cat: '主食' },
  { name: '包子(猪肉)', unit: '1个(100g)', calories: 227, cat: '主食' },
  { name: '饺子(猪肉)', unit: '1个(25g)', calories: 60, cat: '主食' },
  { name: '饺子(猪肉)', unit: '10个', calories: 600, cat: '主食' },
  { name: '面条(煮)', unit: '100g', calories: 110, cat: '主食' },
  { name: '面条(煮)', unit: '1碗(300g)', calories: 330, cat: '主食' },
  { name: '拉面', unit: '1碗(400g)', calories: 440, cat: '主食' },
  { name: '馄饨', unit: '10个', calories: 350, cat: '主食' },
  { name: '油条', unit: '1根(70g)', calories: 270, cat: '主食' },
  { name: '烧饼', unit: '1个(100g)', calories: 326, cat: '主食' },
  { name: '全麦面包', unit: '1片(50g)', calories: 123, cat: '主食' },
  { name: '白面包', unit: '1片(50g)', calories: 133, cat: '主食' },
  { name: '小米粥', unit: '1碗(300g)', calories: 138, cat: '主食' },
  { name: '白粥', unit: '1碗(300g)', calories: 90, cat: '主食' },
  { name: '八宝粥', unit: '1碗(300g)', calories: 195, cat: '主食' },
  { name: '炒饭', unit: '1份(300g)', calories: 564, cat: '主食' },
  { name: '炒面', unit: '1份(300g)', calories: 480, cat: '主食' },
  { name: '玉米', unit: '1根(200g)', calories: 224, cat: '主食' },
  { name: '红薯', unit: '100g', calories: 86, cat: '主食' },
  { name: '紫薯', unit: '100g', calories: 82, cat: '主食' },
  { name: '土豆', unit: '100g', calories: 76, cat: '主食' },
  { name: '燕麦片', unit: '100g', calories: 377, cat: '主食' },
  { name: '燕麦片', unit: '1碗(50g)', calories: 188, cat: '主食' },
  { name: '粽子', unit: '1个(150g)', calories: 300, cat: '主食' },
  { name: '年糕', unit: '100g', calories: 154, cat: '主食' },

  // === 肉类 ===
  { name: '猪肉(瘦)', unit: '100g', calories: 143, cat: '肉类' },
  { name: '猪肉(五花)', unit: '100g', calories: 395, cat: '肉类' },
  { name: '猪排骨', unit: '100g', calories: 264, cat: '肉类' },
  { name: '红烧肉', unit: '100g', calories: 479, cat: '肉类' },
  { name: '回锅肉', unit: '100g', calories: 266, cat: '肉类' },
  { name: '猪蹄', unit: '100g', calories: 260, cat: '肉类' },
  { name: '牛肉(瘦)', unit: '100g', calories: 106, cat: '肉类' },
  { name: '牛肉(肥牛)', unit: '100g', calories: 250, cat: '肉类' },
  { name: '酱牛肉', unit: '100g', calories: 246, cat: '肉类' },
  { name: '牛排', unit: '1份(200g)', calories: 350, cat: '肉类' },
  { name: '羊肉', unit: '100g', calories: 203, cat: '肉类' },
  { name: '涮羊肉', unit: '1份(200g)', calories: 400, cat: '肉类' },
  { name: '鸡胸肉', unit: '100g', calories: 133, cat: '肉类' },
  { name: '鸡腿', unit: '1个(150g)', calories: 270, cat: '肉类' },
  { name: '鸡翅', unit: '1个(50g)', calories: 97, cat: '肉类' },
  { name: '炸鸡腿', unit: '1个(150g)', calories: 390, cat: '肉类' },
  { name: '烤鸭', unit: '100g', calories: 336, cat: '肉类' },
  { name: '鸭肉', unit: '100g', calories: 240, cat: '肉类' },
  { name: '香肠', unit: '1根(50g)', calories: 254, cat: '肉类' },
  { name: '火腿肠', unit: '1根(50g)', calories: 106, cat: '肉类' },
  { name: '培根', unit: '2片(30g)', calories: 162, cat: '肉类' },
  { name: '午餐肉', unit: '100g', calories: 229, cat: '肉类' },

  // === 蛋类 ===
  { name: '鸡蛋(煮)', unit: '1个(60g)', calories: 86, cat: '蛋类' },
  { name: '鸡蛋(炒)', unit: '1个(60g)', calories: 110, cat: '蛋类' },
  { name: '煎蛋', unit: '1个(60g)', calories: 118, cat: '蛋类' },
  { name: '蛋白', unit: '1个', calories: 17, cat: '蛋类' },
  { name: '蛋黄', unit: '1个', calories: 55, cat: '蛋类' },
  { name: '咸鸭蛋', unit: '1个(70g)', calories: 133, cat: '蛋类' },
  { name: '皮蛋', unit: '1个(60g)', calories: 103, cat: '蛋类' },

  // === 水产类 ===
  { name: '三文鱼', unit: '100g', calories: 139, cat: '水产' },
  { name: '带鱼', unit: '100g', calories: 127, cat: '水产' },
  { name: '鲫鱼', unit: '100g', calories: 108, cat: '水产' },
  { name: '鲤鱼', unit: '100g', calories: 109, cat: '水产' },
  { name: '虾', unit: '100g', calories: 93, cat: '水产' },
  { name: '虾仁', unit: '100g', calories: 48, cat: '水产' },
  { name: '螃蟹', unit: '1只(200g)', calories: 190, cat: '水产' },
  { name: '生蚝', unit: '100g', calories: 57, cat: '水产' },
  { name: '鱿鱼', unit: '100g', calories: 75, cat: '水产' },
  { name: '蛤蜊', unit: '100g', calories: 56, cat: '水产' },
  { name: '金枪鱼罐头', unit: '100g', calories: 198, cat: '水产' },

  // === 豆制品 ===
  { name: '豆腐', unit: '100g', calories: 76, cat: '豆制品' },
  { name: '豆腐干', unit: '100g', calories: 140, cat: '豆制品' },
  { name: '豆浆', unit: '1杯(250ml)', calories: 40, cat: '豆制品' },
  { name: '豆浆(甜)', unit: '1杯(250ml)', calories: 83, cat: '豆制品' },
  { name: '豆腐脑', unit: '1碗(300g)', calories: 45, cat: '豆制品' },
  { name: '腐竹', unit: '100g', calories: 459, cat: '豆制品' },

  // === 蔬菜类 ===
  { name: '白菜', unit: '100g', calories: 13, cat: '蔬菜' },
  { name: '菠菜', unit: '100g', calories: 23, cat: '蔬菜' },
  { name: '西兰花', unit: '100g', calories: 34, cat: '蔬菜' },
  { name: '番茄', unit: '100g', calories: 18, cat: '蔬菜' },
  { name: '黄瓜', unit: '100g', calories: 15, cat: '蔬菜' },
  { name: '胡萝卜', unit: '100g', calories: 37, cat: '蔬菜' },
  { name: '白萝卜', unit: '100g', calories: 16, cat: '蔬菜' },
  { name: '茄子', unit: '100g', calories: 21, cat: '蔬菜' },
  { name: '青椒', unit: '100g', calories: 20, cat: '蔬菜' },
  { name: '芹菜', unit: '100g', calories: 13, cat: '蔬菜' },
  { name: '韭菜', unit: '100g', calories: 25, cat: '蔬菜' },
  { name: '生菜', unit: '100g', calories: 13, cat: '蔬菜' },
  { name: '油麦菜', unit: '100g', calories: 15, cat: '蔬菜' },
  { name: '空心菜', unit: '100g', calories: 20, cat: '蔬菜' },
  { name: '豆芽', unit: '100g', calories: 18, cat: '蔬菜' },
  { name: '洋葱', unit: '100g', calories: 40, cat: '蔬菜' },
  { name: '蒜苔', unit: '100g', calories: 36, cat: '蔬菜' },
  { name: '藕', unit: '100g', calories: 73, cat: '蔬菜' },
  { name: '南瓜', unit: '100g', calories: 22, cat: '蔬菜' },
  { name: '冬瓜', unit: '100g', calories: 11, cat: '蔬菜' },
  { name: '丝瓜', unit: '100g', calories: 20, cat: '蔬菜' },
  { name: '苦瓜', unit: '100g', calories: 19, cat: '蔬菜' },
  { name: '蘑菇', unit: '100g', calories: 22, cat: '蔬菜' },
  { name: '香菇', unit: '100g', calories: 26, cat: '蔬菜' },
  { name: '金针菇', unit: '100g', calories: 32, cat: '蔬菜' },
  { name: '木耳', unit: '100g', calories: 21, cat: '蔬菜' },
  { name: '海带', unit: '100g', calories: 12, cat: '蔬菜' },
  { name: '紫菜', unit: '100g', calories: 35, cat: '蔬菜' },

  // === 水果类 ===
  { name: '苹果', unit: '1个(200g)', calories: 106, cat: '水果' },
  { name: '香蕉', unit: '1根(120g)', calories: 111, cat: '水果' },
  { name: '橙子', unit: '1个(200g)', calories: 96, cat: '水果' },
  { name: '橘子', unit: '1个(100g)', calories: 44, cat: '水果' },
  { name: '西瓜', unit: '1块(300g)', calories: 93, cat: '水果' },
  { name: '葡萄', unit: '100g', calories: 69, cat: '水果' },
  { name: '草莓', unit: '100g', calories: 32, cat: '水果' },
  { name: '蓝莓', unit: '100g', calories: 57, cat: '水果' },
  { name: '猕猴桃', unit: '1个(100g)', calories: 61, cat: '水果' },
  { name: '芒果', unit: '1个(200g)', calories: 70, cat: '水果' },
  { name: '梨', unit: '1个(200g)', calories: 88, cat: '水果' },
  { name: '桃子', unit: '1个(200g)', calories: 84, cat: '水果' },
  { name: '樱桃', unit: '100g', calories: 50, cat: '水果' },
  { name: '柚子', unit: '1瓣(100g)', calories: 42, cat: '水果' },
  { name: '火龙果', unit: '1个(300g)', calories: 165, cat: '水果' },
  { name: '石榴', unit: '100g', calories: 147, cat: '水果' },
  { name: '牛油果', unit: '1个(150g)', calories: 240, cat: '水果' },
  { name: '哈密瓜', unit: '1块(200g)', calories: 68, cat: '水果' },
  { name: '菠萝', unit: '100g', calories: 44, cat: '水果' },
  { name: '荔枝', unit: '10颗(200g)', calories: 142, cat: '水果' },

  // === 奶制品 ===
  { name: '全脂牛奶', unit: '1杯(250ml)', calories: 163, cat: '奶制品' },
  { name: '脱脂牛奶', unit: '1杯(250ml)', calories: 88, cat: '奶制品' },
  { name: '酸奶(原味)', unit: '1杯(200g)', calories: 144, cat: '奶制品' },
  { name: '酸奶(果味)', unit: '1杯(200g)', calories: 180, cat: '奶制品' },
  { name: '奶酪', unit: '1片(20g)', calories: 66, cat: '奶制品' },

  // === 零食/饮料 ===
  { name: '可乐', unit: '1罐(330ml)', calories: 139, cat: '饮料' },
  { name: '雪碧', unit: '1罐(330ml)', calories: 151, cat: '饮料' },
  { name: '橙汁', unit: '1杯(250ml)', calories: 113, cat: '饮料' },
  { name: '啤酒', unit: '1罐(330ml)', calories: 106, cat: '饮料' },
  { name: '红酒', unit: '1杯(150ml)', calories: 128, cat: '饮料' },
  { name: '拿铁咖啡', unit: '1杯(360ml)', calories: 176, cat: '饮料' },
  { name: '美式咖啡', unit: '1杯(360ml)', calories: 10, cat: '饮料' },
  { name: '奶茶(珍珠)', unit: '1杯(500ml)', calories: 350, cat: '饮料' },
  { name: '奶茶(原味)', unit: '1杯(500ml)', calories: 265, cat: '饮料' },
  { name: '薯片', unit: '1包(75g)', calories: 410, cat: '零食' },
  { name: '饼干', unit: '100g', calories: 433, cat: '零食' },
  { name: '巧克力', unit: '1块(50g)', calories: 273, cat: '零食' },
  { name: '冰淇淋', unit: '1球(100g)', calories: 207, cat: '零食' },
  { name: '蛋糕', unit: '1块(100g)', calories: 347, cat: '零食' },
  { name: '坚果(混合)', unit: '100g', calories: 607, cat: '零食' },
  { name: '核桃', unit: '100g', calories: 654, cat: '零食' },
  { name: '杏仁', unit: '100g', calories: 579, cat: '零食' },
  { name: '瓜子', unit: '100g', calories: 574, cat: '零食' },
  { name: '辣条', unit: '1包(100g)', calories: 450, cat: '零食' },

  // === 外卖/快餐 ===
  { name: '汉堡', unit: '1个(200g)', calories: 456, cat: '快餐' },
  { name: '薯条(大)', unit: '1份(150g)', calories: 468, cat: '快餐' },
  { name: '炸鸡', unit: '1块(100g)', calories: 289, cat: '快餐' },
  { name: '披萨', unit: '1片(150g)', calories: 320, cat: '快餐' },
  { name: '麻辣烫', unit: '1份(500g)', calories: 350, cat: '快餐' },
  { name: '火锅', unit: '1顿(估算)', calories: 1500, cat: '快餐' },
  { name: '麻辣香锅', unit: '1份(400g)', calories: 600, cat: '快餐' },
  { name: '黄焖鸡米饭', unit: '1份', calories: 680, cat: '快餐' },
  { name: '沙县小吃(鸡腿饭)', unit: '1份', calories: 550, cat: '快餐' },
  { name: '兰州拉面', unit: '1碗', calories: 500, cat: '快餐' },
  { name: '螺蛳粉', unit: '1碗', calories: 550, cat: '快餐' },
  { name: '米线', unit: '1碗', calories: 480, cat: '快餐' },
  { name: '酸辣粉', unit: '1碗', calories: 400, cat: '快餐' },
  { name: '凉皮', unit: '1份(350g)', calories: 350, cat: '快餐' },

  // === 家常菜 ===
  { name: '西红柿炒蛋', unit: '1份(250g)', calories: 210, cat: '家常菜' },
  { name: '麻婆豆腐', unit: '1份(250g)', calories: 290, cat: '家常菜' },
  { name: '宫保鸡丁', unit: '1份(250g)', calories: 330, cat: '家常菜' },
  { name: '鱼香肉丝', unit: '1份(250g)', calories: 310, cat: '家常菜' },
  { name: '糖醋里脊', unit: '1份(250g)', calories: 410, cat: '家常菜' },
  { name: '清蒸鱼', unit: '1条(300g)', calories: 270, cat: '家常菜' },
  { name: '水煮鱼', unit: '1份(400g)', calories: 580, cat: '家常菜' },
  { name: '酸菜鱼', unit: '1份(400g)', calories: 480, cat: '家常菜' },
  { name: '红烧排骨', unit: '1份(250g)', calories: 520, cat: '家常菜' },
  { name: '炒青菜', unit: '1份(200g)', calories: 60, cat: '家常菜' },
  { name: '地三鲜', unit: '1份(300g)', calories: 330, cat: '家常菜' },
  { name: '干煸四季豆', unit: '1份(200g)', calories: 260, cat: '家常菜' },
  { name: '可乐鸡翅', unit: '1份(300g)', calories: 480, cat: '家常菜' },
  { name: '蒜蓉西兰花', unit: '1份(200g)', calories: 80, cat: '家常菜' },
];

// 搜索食物
function searchFood(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return FOOD_DB.filter(f => f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30);
}

// ============================================================
// 初始化
// ============================================================

let initialized = false;
let weightChart = null;

export async function initWeight() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// 体重记录
// ============================================================

async function addWeight(data) {
  const record = {
    id: genId(),
    date: data.date || today(),
    time: data.time,
    weight: parseFloat(data.weight),
    note: data.note || '',
    createdAt: new Date().toISOString(),
  };
  await put('weights', record);
  return record;
}

async function getWeightRecords(days = 30) {
  const all = await getAll('weights');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return all
    .filter(w => new Date(w.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ============================================================
// 饮食记录
// ============================================================

async function addMeal(data) {
  const meal = {
    id: genId(),
    date: data.date || today(),
    mealType: data.mealType,
    foods: data.foods || [],
    totalCalories: data.totalCalories || 0,
    imageBase64: data.imageBase64 || null,
    source: data.source || 'manual',
    createdAt: new Date().toISOString(),
  };
  await put('meals', meal);
  return meal;
}

async function getTodayMeals() {
  return await getByIndex('meals', 'date', today());
}

async function getWeekMeals() {
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return await getByRange('meals', 'date', fmtDate(weekAgo), fmtDate(now));
}

// ============================================================
// 渲染：减肥管理主页面
// ============================================================

let currentTab = 'weight';

export async function renderWeight(container) {
  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentTab==='weight'?'active':''}" onclick="window.__weightTab('weight')">体重记录</button>
      <button class="filter-tab ${currentTab==='diet'?'active':''}" onclick="window.__weightTab('diet')">饮食记录</button>
      <button class="filter-tab ${currentTab==='advice'?'active':''}" onclick="window.__weightTab('advice')">饮食推荐</button>
    </div>
    <div id="weight-content"></div>
    <button class="fab" onclick="window.__weightAdd()">+</button>
  `;

  window.__weightTab = (t) => { currentTab = t; renderWeight(container); };
  window.__weightAdd = () => {
    if (currentTab === 'weight') showAddWeightDialog(container);
    else if (currentTab === 'diet') showAddMealDialog(container);
    else showGenerateAdviceDialog(container);
  };

  await renderWeightContent();
}

async function renderWeightContent() {
  const content = document.getElementById('weight-content');
  if (!content) return;

  if (currentTab === 'weight') {
    await renderWeightTab(content);
  } else if (currentTab === 'diet') {
    await renderDietTab(content);
  } else {
    await renderAdviceTab(content);
  }
}

// ============================================================
// 体重 Tab
// ============================================================

async function renderWeightTab(container) {
  const records = await getWeightRecords(30);
  const targetWeight = await getSetting('targetWeight', '');

  const latest = records.length > 0 ? records[records.length - 1] : null;
  const prev = records.length > 1 ? records[records.length - 2] : null;
  const change = latest && prev ? round(latest.weight - prev.weight, 1) : 0;

  container.innerHTML = `
    <div class="weight-display">
      <div class="weight-current">${latest ? latest.weight : '--'}<span class="weight-unit"> kg</span></div>
      ${change !== 0 ? `<div class="weight-change ${change < 0 ? 'down' : 'up'}">${change < 0 ? '↓' : '↑'} ${Math.abs(change)} kg</div>` : ''}
      ${targetWeight ? `<div class="text-sm text-gray mt-8">目标体重：${targetWeight} kg</div>` : ''}
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">? 体重趋势（30天）</span></div>
      <div class="chart-container"><canvas id="weight-chart"></canvas></div>
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">? 最近记录</span></div>
      ${records.length > 0 ? `
      <ul class="weight-record-list">
        ${records.slice(-10).reverse().map(r => `
          <li class="weight-record-item" onclick="window.__editWeight('${r.id}')" style="cursor:pointer">
            <div>
              <div class="text-sm font-bold">${r.weight} kg</div>
              <div class="text-xs text-gray">${fmtDate(r.date)} ${r.time === 'morning' ? '?早上' : '?晚上'}${r.note ? ' · ' + escapeHtml(r.note) : ''}</div>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="task-edit" onclick="event.stopPropagation();window.__editWeight('${r.id}')">?</button>
              <button class="task-delete" onclick="event.stopPropagation();window.__delWeight('${r.id}')">?</button>
            </div>
          </li>
        `).join('')}
      </ul>` : '<div class="empty-state"><div class="empty-icon">??</div><div class="empty-text">暂无体重记录</div></div>'}
    </div>
  `;

  window.__delWeight = async (id) => {
    if (await confirmDialog('删除这条记录？')) {
      await del('weights', id);
      renderWeightTab(container);
    }
  };
  window.__editWeight = (id) => showEditWeightDialog(container, id);

  if (records.length > 0) {
    drawWeightChart(records, targetWeight);
  }
}

function drawWeightChart(records, targetWeight) {
  const ctx = document.getElementById('weight-chart');
  if (!ctx) return;
  if (weightChart) weightChart.destroy();

  const dayMap = {};
  records.forEach(r => {
    if (!dayMap[r.date] || new Date(r.createdAt) > new Date(dayMap[r.date].createdAt)) {
      dayMap[r.date] = r;
    }
  });
  const sorted = Object.values(dayMap).sort((a, b) => new Date(a.date) - new Date(b.date));

  const labels = sorted.map(r => fmtDate(r.date).slice(5));
  const data = sorted.map(r => r.weight);

  const datasets = [{
    label: '体重 (kg)',
    data,
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.1)',
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointBackgroundColor: '#2563eb',
  }];

  if (targetWeight) {
    datasets.push({
      label: '目标',
      data: sorted.map(() => parseFloat(targetWeight)),
      borderColor: '#10b981',
      borderDash: [5, 5],
      fill: false,
      pointRadius: 0,
    });
  }

  weightChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        y: { ticks: { font: { size: 11 } } },
        x: { ticks: { font: { size: 10 }, maxRotation: 0 } },
      }
    }
  });
}

function round(num, decimals = 1) {
  const f = Math.pow(10, decimals);
  return Math.round(num * f) / f;
}

// ============================================================
// 添加体重对话框
// ============================================================

function showAddWeightDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="weight-date" value="${today()}">
      </div>
      <div class="form-group">
        <label>体重 (kg)</label>
        <input type="number" id="weight-value" step="0.1" placeholder="如：65.5" autofocus>
      </div>
      <div class="form-group">
        <label>称重时间</label>
        <select id="weight-time">
          <option value="morning">? 早上</option>
          <option value="evening">? 晚上</option>
        </select>
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="weight-note" placeholder="如：运动后、空腹...">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveWeight()">保存</button>
    </div>
  `;

  const sheet = openBottomSheet('记录体重', html);
  window.__currentSheet = sheet;

  window.__saveWeight = async () => {
    const weight = document.getElementById('weight-value').value;
    if (!weight) { toast('请输入体重'); return; }
    const date = document.getElementById('weight-date').value || today();
    const time = document.getElementById('weight-time').value;
    const note = document.getElementById('weight-note').value;
    await addWeight({ weight, date, time, note });
    toast('体重已记录');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };
}

// ============================================================
// 编辑体重对话框
// ============================================================

async function showEditWeightDialog(container, id) {
  const all = await getAll('weights');
  const record = all.find(r => r.id === id);
  if (!record) { toast('记录不存在'); return; }

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="weight-date" value="${record.date}">
      </div>
      <div class="form-group">
        <label>体重 (kg)</label>
        <input type="number" id="weight-value" step="0.1" value="${record.weight}">
      </div>
      <div class="form-group">
        <label>称重时间</label>
        <select id="weight-time">
          <option value="morning" ${record.time==='morning'?'selected':''}>? 早上</option>
          <option value="evening" ${record.time==='evening'?'selected':''}>? 晚上</option>
        </select>
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="weight-note" value="${escapeHtml(record.note || '')}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateWeight()">保存修改</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delWeightFromEdit('${id}')">删除此记录</button>
    </div>
  `;

  const sheet = openBottomSheet('编辑体重', html);

  window.__updateWeight = async () => {
    const weight = document.getElementById('weight-value').value;
    if (!weight) { toast('请输入体重'); return; }
    record.date = document.getElementById('weight-date').value || today();
    record.time = document.getElementById('weight-time').value;
    record.weight = parseFloat(weight);
    record.note = document.getElementById('weight-note').value;
    record.updatedAt = new Date().toISOString();
    await put('weights', record);
    toast('已修改');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };

  window.__delWeightFromEdit = async (delId) => {
    if (await confirmDialog('删除这条记录？')) {
      await del('weights', delId);
      toast('已删除');
      sheet.close();
      renderWeight(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// 饮食 Tab
// ============================================================

async function renderDietTab(container) {
  const todayMeals = await getTodayMeals();
  const totalCalories = todayMeals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
  const targetCalories = 1100;

  container.innerHTML = `
    <div class="calorie-summary">
      <div class="calorie-summary-item">
        <div class="calorie-summary-num">${totalCalories}</div>
        <div class="calorie-summary-label">今日摄入(卡)</div>
      </div>
      <div class="calorie-summary-item">
        <div class="calorie-summary-num">${targetCalories}</div>
        <div class="calorie-summary-label">建议目标</div>
      </div>
      <div class="calorie-summary-item">
        <div class="calorie-summary-num">${Math.max(0, targetCalories - totalCalories)}</div>
        <div class="calorie-summary-label">剩余</div>
      </div>
    </div>

    ${todayMeals.length > 0 ? todayMeals.map(m => `
      <div class="meal-card">
        <div class="meal-header" onclick="window.__editMeal('${m.id}')" style="cursor:pointer">
          <span class="meal-type-badge">${m.mealType}</span>
          <span class="meal-calories">${m.totalCalories} 卡</span>
        </div>
        <div class="meal-foods" onclick="window.__editMeal('${m.id}')" style="cursor:pointer">
          ${(m.foods || []).map(f => `<span class="meal-food-tag">${escapeHtml(f.name)} ${f.calories}卡</span>`).join('')}
        </div>
        ${m.imageBase64 ? `<img class="meal-image" src="${m.imageBase64}" alt="食物" onclick="window.__editMeal('${m.id}')">` : ''}
        <div class="flex-between mt-8">
          <span class="text-xs text-gray">${m.source === 'ai' ? '? AI识别' : m.source === 'photo' ? '? 照片记录' : '?? 手动录入'} · ${fmtDate(m.date)}</span>
          <div style="display:flex;gap:4px">
            <button class="task-edit" onclick="window.__editMeal('${m.id}')">?</button>
            <button class="task-delete" onclick="window.__delMeal('${m.id}')">?</button>
          </div>
        </div>
      </div>
    `).join('') : '<div class="empty-state"><div class="empty-icon">??</div><div class="empty-text">今天还没有饮食记录</div></div>'}
  `;

  window.__delMeal = async (id) => {
    if (await confirmDialog('删除这条饮食记录？')) {
      await del('meals', id);
      renderDietTab(container);
    }
  };
  window.__editMeal = (id) => showEditMealDialog(container, id);
}

// ============================================================
// 添加饮食对话框（食物搜索 + 手动 + 拍照）
// ============================================================

function showAddMealDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="meal-date" value="${today()}">
      </div>
      <div class="form-group">
        <label>用餐类型</label>
        <select id="meal-type">
          <option value="早餐">? 早餐</option>
          <option value="午餐">?? 午餐</option>
          <option value="晚餐">? 晚餐</option>
          <option value="加餐">? 加餐</option>
        </select>
      </div>

      <div class="form-group">
        <label>? 搜索食物（输入名称搜索内置数据库）</label>
        <input type="text" id="food-search" placeholder="如：米饭、鸡蛋、红烧肉..." autocomplete="off">
        <div id="food-search-results" style="max-height:200px;overflow-y:auto;margin-top:8px"></div>
      </div>

      <div class="form-group">
        <label>已选食物</label>
        <div id="selected-foods-list">
          <div class="text-xs text-gray" id="no-foods-hint">尚未添加食物，请搜索并点击添加</div>
        </div>
        <div class="flex-between mt-8">
          <span class="text-sm text-gray">总计：<span id="foods-total-cal" class="font-bold">0</span> 卡</span>
          <button class="btn-outline" onclick="window.__addManualFoodRow()" style="font-size:13px">+ 手动输入</button>
        </div>
      </div>

      <div class="form-group">
        <label>食物照片（可选）</label>
        <div class="meal-photo-area" onclick="document.getElementById('meal-photo-input').click()" style="border:2px dashed var(--gray-300);border-radius:12px;padding:20px;text-align:center;cursor:pointer">
          <div id="meal-photo-preview" class="meal-photo-placeholder">
            <div style="font-size:36px">?</div>
            <div class="text-sm text-gray">点击拍照或选择图片</div>
            <div class="text-xs text-gray mt-8">也可用AI识别卡路里（需配置API Key）</div>
          </div>
          <input type="file" id="meal-photo-input" accept="image/*" capture="environment" style="display:none">
        </div>
      </div>

      <div id="ai-result-area"></div>

      <div class="flex gap-8 mt-16">
        <button class="btn-outline" style="flex:1" onclick="window.__saveMealOnly()">仅保存照片</button>
        <button class="btn-primary" style="flex:1" onclick="window.__saveMeal()">保存记录</button>
      </div>
    </div>
  `;

  const sheet = openBottomSheet('记录饮食', html);
  window.__currentSheet = sheet;

  let currentImageBase64 = null;
  let recognizedFoods = [];
  let selectedFoods = []; // 用户已选的食物列表

  // ---- 食物搜索功能 ----
  const searchInput = document.getElementById('food-search');
  const resultsDiv = document.getElementById('food-search-results');
  let searchTimer;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query.length === 0) {
        resultsDiv.innerHTML = '';
        return;
      }
      const results = searchFood(query);
      if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="text-xs text-gray" style="padding:8px">未找到匹配食物，可手动输入</div>';
        return;
      }
      resultsDiv.innerHTML = results.map((f, i) => `
        <div class="food-search-item" onclick="window.__selectFood(${i})" 
             style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100);cursor:pointer;font-size:14px"
             onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
          <div>
            <span style="font-weight:500">${escapeHtml(f.name)}</span>
            <span class="text-xs text-gray" style="margin-left:6px">${escapeHtml(f.unit)}</span>
          </div>
          <span style="font-weight:600;color:var(--warning)">${f.calories} 卡</span>
        </div>
      `).join('');
      // 存储当前搜索结果供选择使用
      window.__currentSearchResults = results;
    }, 200);
  });

  window.__currentSearchResults = [];

  window.__selectFood = (idx) => {
    const food = window.__currentSearchResults[idx];
    if (!food) return;
    // 添加到已选列表
    selectedFoods.push({ name: food.name, unit: food.unit, calories: food.calories, grams: 0 });
    renderSelectedFoods();
    searchInput.value = '';
    resultsDiv.innerHTML = '';
    searchInput.focus();
  };

  function renderSelectedFoods() {
    const list = document.getElementById('selected-foods-list');
    const hint = document.getElementById('no-foods-hint');
    if (selectedFoods.length === 0) {
      list.innerHTML = '<div class="text-xs text-gray" id="no-foods-hint">尚未添加食物，请搜索并点击添加</div>';
    } else {
      list.innerHTML = selectedFoods.map((f, i) => `
        <div class="selected-food-row" style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--gray-50);border-radius:8px;margin-bottom:6px">
          <div style="flex:1">
            <div class="text-sm">${escapeHtml(f.name)}</div>
            <div class="text-xs text-gray">${escapeHtml(f.unit)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:600;font-size:14px;color:var(--warning);white-space:nowrap">${f.calories} 卡</span>
            <button onclick="window.__removeSelectedFood(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:2px 6px">?</button>
          </div>
        </div>
      `).join('');
    }
    // 更新总卡路里
    const total = selectedFoods.reduce((sum, f) => sum + f.calories, 0);
    document.getElementById('foods-total-cal').textContent = total;
  }

  window.__removeSelectedFood = (idx) => {
    selectedFoods.splice(idx, 1);
    renderSelectedFoods();
  };

  // ---- 手动输入 ----
  window.__addManualFoodRow = () => {
    const list = document.getElementById('selected-foods-list');
    // 隐藏提示
    const hint = document.getElementById('no-foods-hint');
    if (hint) hint.remove();

    const row = document.createElement('div');
    row.className = 'manual-food-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px;background:var(--warning-bg);border-radius:8px;margin-bottom:6px';
    row.innerHTML = `
      <input type="text" placeholder="食物名" style="flex:1;padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px" data-manual-name>
      <input type="number" placeholder="卡路里" style="width:70px;padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px" data-manual-cal>
      <button onclick="this.parentElement.remove();window.__recalcManualTotal()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:2px">?</button>
    `;
    list.appendChild(row);
  };

  window.__recalcManualTotal = () => {
    let manualTotal = 0;
    document.querySelectorAll('[data-manual-cal]').forEach(input => {
      manualTotal += parseInt(input.value) || 0;
    });
    const dbTotal = selectedFoods.reduce((sum, f) => sum + f.calories, 0);
    document.getElementById('foods-total-cal').textContent = dbTotal + manualTotal;
  };

  // 监听手动输入变化
  document.getElementById('selected-foods-list').addEventListener('input', (e) => {
    if (e.target.dataset.manualCal) {
      window.__recalcManualTotal();
    }
  });

  // ---- 拍照 + AI 识别 ----
  document.getElementById('meal-photo-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('meal-photo-preview');
    preview.innerHTML = '<div class="spinner"></div><p>处理中...</p>';

    try {
      currentImageBase64 = await compressImage(file, 800);
      preview.innerHTML = `<img src="${currentImageBase64}" style="width:100%;border-radius:8px">`;

      const resultArea = document.getElementById('ai-result-area');
      resultArea.innerHTML = '<div class="text-sm text-gray" style="padding:12px">? AI识别中...</div>';

      const result = await recognizeFood(currentImageBase64);
      if (result.success) {
        recognizedFoods = result.data.foods;
        resultArea.innerHTML = `
          <div class="card" style="margin:0;background:var(--success-bg);box-shadow:none">
            <div class="flex-between mb-8">
              <span class="font-bold" style="color:var(--success)">? AI识别成功</span>
              <span class="font-bold">${result.data.totalCalories} 卡</span>
            </div>
            <div id="recognized-foods">
              ${result.data.foods.map((f, i) => `
                <div class="flex-between text-sm" style="padding:4px 0">
                  <input type="text" value="${escapeHtml(f.name)}" style="flex:1;border:none;background:transparent;font-size:14px" data-food-idx="${i}" data-field="name">
                  <input type="number" value="${f.calories}" style="width:60px;text-align:right;border:1px solid var(--gray-200);border-radius:4px;padding:2px 4px;font-size:13px" data-food-idx="${i}" data-field="calories">
                  <span class="text-xs text-gray">卡</span>
                  <button onclick="window.__addAiFoodToSelected(${i})" style="background:var(--success);color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:12px;cursor:pointer;margin-left:8px">+添加</button>
                </div>
              `).join('')}
            </div>
            <div class="text-xs text-gray mt-8">${result.data.description || ''}</div>
          </div>
        `;
      } else if (result.error === 'NO_API_KEY') {
        resultArea.innerHTML = `
          <div class="card" style="margin:0;background:var(--warning-bg);box-shadow:none">
            <div class="text-sm" style="color:var(--warning)">
              ?? ${result.message}
            </div>
            <div class="text-xs text-gray mt-8">可使用上方食物搜索功能查找卡路里</div>
          </div>
        `;
      } else {
        resultArea.innerHTML = `<div class="text-sm" style="color:var(--danger)">? 识别失败：${escapeHtml(result.error)}</div>`;
      }
    } catch (err) {
      preview.innerHTML = '<div style="color:var(--danger)">图片处理失败</div>';
    }
  };

  window.__addAiFoodToSelected = (idx) => {
    const f = recognizedFoods[idx];
    if (!f) return;
    selectedFoods.push({ name: f.name, unit: '', calories: f.calories, grams: f.grams || 0 });
    renderSelectedFoods();
  };

  // ---- 保存 ----
  window.__saveMeal = async () => {
    const date = document.getElementById('meal-date').value || today();
    const mealType = document.getElementById('meal-type').value;
    const foods = [...selectedFoods];

    // 收集手动输入
    document.querySelectorAll('.manual-food-row').forEach(row => {
      const nameInput = row.querySelector('[data-manual-name]');
      const calInput = row.querySelector('[data-manual-cal]');
      const name = nameInput ? nameInput.value.trim() : '';
      const cal = calInput ? parseInt(calInput.value) || 0 : 0;
      if (name) foods.push({ name, calories: cal, grams: 0, unit: '' });
    });

    if (foods.length === 0) {
      toast('请添加至少一种食物');
      return;
    }

    const totalCalories = foods.reduce((sum, f) => sum + (f.calories || 0), 0);
    await addMeal({
      date,
      mealType,
      foods,
      totalCalories,
      imageBase64: currentImageBase64,
      source: currentImageBase64 ? 'manual' : 'manual',
    });

    toast('饮食已记录');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };

  window.__saveMealOnly = async () => {
    if (!currentImageBase64) {
      toast('请先上传食物照片');
      return;
    }
    const date = document.getElementById('meal-date').value || today();
    const mealType = document.getElementById('meal-type').value;
    await addMeal({
      date,
      mealType,
      foods: [],
      totalCalories: 0,
      imageBase64: currentImageBase64,
      source: 'photo',
    });
    toast('照片已保存');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };
}

// ============================================================
// 编辑饮食对话框（含食物搜索）
// ============================================================

async function showEditMealDialog(container, id) {
  const all = await getAll('meals');
  const meal = all.find(m => m.id === id);
  if (!meal) { toast('记录不存在'); return; }

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="meal-date" value="${meal.date}">
      </div>
      <div class="form-group">
        <label>用餐类型</label>
        <select id="meal-type">
          <option value="早餐" ${meal.mealType==='早餐'?'selected':''}>? 早餐</option>
          <option value="午餐" ${meal.mealType==='午餐'?'selected':''}>?? 午餐</option>
          <option value="晚餐" ${meal.mealType==='晚餐'?'selected':''}>? 晚餐</option>
          <option value="加餐" ${meal.mealType==='加餐'?'selected':''}>? 加餐</option>
        </select>
      </div>

      <div class="form-group">
        <label>? 搜索食物添加到列表</label>
        <input type="text" id="edit-food-search" placeholder="如：米饭、鸡蛋、红烧肉..." autocomplete="off">
        <div id="edit-food-search-results" style="max-height:200px;overflow-y:auto;margin-top:8px"></div>
      </div>

      <div class="form-group">
        <label>食物列表</label>
        <div id="edit-foods-list"></div>
        <div class="flex-between mt-8">
          <span class="text-sm text-gray">总计：<span id="edit-foods-total" class="font-bold">${meal.totalCalories || 0}</span> 卡</span>
          <button class="btn-outline" onclick="window.__addEditManualFood()" style="font-size:13px">+ 手动输入</button>
        </div>
      </div>

      ${meal.imageBase64 ? `
      <div class="form-group">
        <label>已有照片</label>
        <img src="${meal.imageBase64}" style="max-height:120px;border-radius:8px">
      </div>
      ` : ''}
      <button class="btn-primary btn-full" onclick="window.__updateMeal()">保存修改</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delMealFromEdit('${id}')">删除此记录</button>
    </div>
  `;

  const sheet = openBottomSheet('编辑饮食', html);

  // 当前编辑中的食物列表（从已有记录初始化）
  let editFoods = (meal.foods || []).map(f => ({ ...f }));

  function renderEditFoods() {
    const list = document.getElementById('edit-foods-list');
    if (editFoods.length === 0) {
      list.innerHTML = '<div class="text-xs text-gray">暂无食物，请搜索添加</div>';
    } else {
      list.innerHTML = editFoods.map((f, i) => `
        <div class="edit-food-row" style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--gray-50);border-radius:8px;margin-bottom:6px">
          <div style="flex:1">
            <input type="text" value="${escapeHtml(f.name)}" style="border:none;background:transparent;font-size:14px;font-weight:500;width:100%" data-edit-name="${i}">
            <div class="text-xs text-gray">${escapeHtml(f.unit || '')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" value="${f.calories}" style="width:65px;text-align:right;border:1px solid var(--gray-200);border-radius:4px;padding:2px 4px;font-size:13px" data-edit-cal="${i}">
            <span class="text-xs text-gray">卡</span>
            <button onclick="window.__removeEditFood(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:2px 6px">?</button>
          </div>
        </div>
      `).join('');
    }
    // 更新总计
    const total = editFoods.reduce((sum, f) => sum + (parseInt(f.calories) || 0), 0);
    document.getElementById('edit-foods-total').textContent = total;
  }

  renderEditFoods();

  // 监听食物名和卡路里的编辑
  document.getElementById('edit-foods-list').addEventListener('input', (e) => {
    if (e.target.dataset.editName !== undefined) {
      editFoods[parseInt(e.target.dataset.editName)].name = e.target.value;
    }
    if (e.target.dataset.editCal !== undefined) {
      const idx = parseInt(e.target.dataset.editCal);
      editFoods[idx].calories = parseInt(e.target.value) || 0;
      // 更新总计
      const total = editFoods.reduce((sum, f) => sum + (parseInt(f.calories) || 0), 0);
      document.getElementById('edit-foods-total').textContent = total;
    }
  });

  window.__removeEditFood = (idx) => {
    editFoods.splice(idx, 1);
    renderEditFoods();
  };

  window.__addEditManualFood = () => {
    editFoods.push({ name: '', unit: '', calories: 0, grams: 0 });
    renderEditFoods();
    // 聚焦到新添加的食物名输入框
    setTimeout(() => {
      const inputs = document.querySelectorAll('[data-edit-name]');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 100);
  };

  // ---- 食物搜索 ----
  const editSearchInput = document.getElementById('edit-food-search');
  const editResultsDiv = document.getElementById('edit-food-search-results');
  let editSearchTimer;

  editSearchInput.addEventListener('input', () => {
    clearTimeout(editSearchTimer);
    editSearchTimer = setTimeout(() => {
      const query = editSearchInput.value.trim();
      if (query.length === 0) {
        editResultsDiv.innerHTML = '';
        return;
      }
      const results = searchFood(query);
      if (results.length === 0) {
        editResultsDiv.innerHTML = '<div class="text-xs text-gray" style="padding:8px">未找到匹配食物</div>';
        return;
      }
      editResultsDiv.innerHTML = results.map((f, i) => `
        <div class="food-search-item" onclick="window.__editSelectFood(${i})" 
             style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100);cursor:pointer;font-size:14px"
             onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
          <div>
            <span style="font-weight:500">${escapeHtml(f.name)}</span>
            <span class="text-xs text-gray" style="margin-left:6px">${escapeHtml(f.unit)}</span>
          </div>
          <span style="font-weight:600;color:var(--warning)">${f.calories} 卡</span>
        </div>
      `).join('');
      window.__editCurrentResults = results;
    }, 200);
  });

  window.__editCurrentResults = [];

  window.__editSelectFood = (idx) => {
    const food = window.__editCurrentResults[idx];
    if (!food) return;
    editFoods.push({ name: food.name, unit: food.unit, calories: food.calories, grams: 0 });
    renderEditFoods();
    editSearchInput.value = '';
    editResultsDiv.innerHTML = '';
  };

  // ---- 保存修改 ----
  window.__updateMeal = async () => {
    const date = document.getElementById('meal-date').value || today();
    const mealType = document.getElementById('meal-type').value;

    // 从 DOM 收集最新数据
    const foods = [];
    document.querySelectorAll('[data-edit-name]').forEach((input, i) => {
      const name = input.value.trim();
      const calInput = document.querySelector(`[data-edit-cal="${i}"]`);
      const cal = calInput ? parseInt(calInput.value) || 0 : 0;
      if (name) foods.push({ name, calories: cal, grams: 0, unit: editFoods[i]?.unit || '' });
    });

    const totalCalories = foods.reduce((sum, f) => sum + (f.calories || 0), 0);

    meal.date = date;
    meal.mealType = mealType;
    meal.foods = foods;
    meal.totalCalories = totalCalories;
    meal.updatedAt = new Date().toISOString();
    await put('meals', meal);
    toast('已修改');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };

  window.__delMealFromEdit = async (delId) => {
    if (await confirmDialog('删除这条饮食记录？')) {
      await del('meals', delId);
      toast('已删除');
      sheet.close();
      renderWeight(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// 饮食推荐 Tab
// ============================================================

async function renderAdviceTab(container) {
  const cachedAdvice = await getSetting('lastDietAdvice', null);
  const adviceDate = await getSetting('lastAdviceDate', '');

  container.innerHTML = `
    <div id="advice-content">
      ${cachedAdvice ? renderAdviceContent(cachedAdvice, adviceDate) : `
        <div class="empty-state">
          <div class="empty-icon">?</div>
          <div class="empty-text">暂无饮食推荐</div>
          <div class="text-xs text-gray mt-8">点击右下角 + 生成每周饮食推荐</div>
        </div>
      `}
    </div>
  `;
}

function renderAdviceContent(advice, dateStr) {
  const isRuleBased = advice.source === 'rule-based';
  return `
    <div class="card">
      <div class="flex-between mb-8">
        <span class="font-bold">? 饮食推荐</span>
        <span class="text-xs text-gray">${dateStr || ''} ${isRuleBased ? '· 基础版' : '· AI版'}</span>
      </div>

      ${advice.assessment ? `
      <div class="mb-16">
        <div class="text-sm font-bold mb-8">? 本周评估</div>
        <div class="text-sm" style="color:var(--gray-600);line-height:1.6">${escapeHtml(advice.assessment)}</div>
      </div>` : ''}

      ${advice.advice ? `
      <div class="mb-16">
        <div class="text-sm font-bold mb-8">? 健康建议</div>
        <div class="text-sm" style="color:var(--gray-600);line-height:1.6">${escapeHtml(advice.advice)}</div>
      </div>` : ''}
    </div>

    ${advice.recommendations ? `
    <div class="card">
      <div class="card-title"><span class="title-left">?? 推荐食谱</span></div>
      ${advice.recommendations.breakfast ? `
        <div class="mb-16">
          <div class="text-sm font-bold text-warning mb-8">? 早餐</div>
          ${advice.recommendations.breakfast.map(m => `<div class="text-sm" style="padding:4px 0">? ${escapeHtml(m.name)} <span class="text-gray">(${m.calories}卡)</span></div>`).join('')}
        </div>` : ''}
      ${advice.recommendations.lunch ? `
        <div class="mb-16">
          <div class="text-sm font-bold text-warning mb-8">?? 午餐</div>
          ${advice.recommendations.lunch.map(m => `<div class="text-sm" style="padding:4px 0">? ${escapeHtml(m.name)} <span class="text-gray">(${m.calories}卡)</span></div>`).join('')}
        </div>` : ''}
      ${advice.recommendations.dinner ? `
        <div class="mb-16">
          <div class="text-sm font-bold text-warning mb-8">? 晚餐</div>
          ${advice.recommendations.dinner.map(m => `<div class="text-sm" style="padding:4px 0">? ${escapeHtml(m.name)} <span class="text-gray">(${m.calories}卡)</span></div>`).join('')}
        </div>` : ''}
    </div>` : ''}

    ${advice.avoid ? `
    <div class="card">
      <div class="card-title"><span class="title-left">? 需避免食物</span></div>
      ${advice.avoid.map(a => `<div class="text-sm" style="padding:4px 0;color:var(--danger)">? ${escapeHtml(typeof a === 'string' ? a : a.name)}</div>`).join('')}
    </div>` : ''}

    ${advice.recommend ? `
    <div class="card">
      <div class="card-title"><span class="title-left">? 推荐食物</span></div>
      ${advice.recommend.map(r => `<div class="text-sm" style="padding:4px 0;color:var(--success)">? ${escapeHtml(typeof r === 'string' ? r : r.name)}</div>`).join('')}
    </div>` : ''}
  `;
}

// ============================================================
// 生成饮食推荐
// ============================================================

function showGenerateAdviceDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="text-sm" style="color:var(--gray-600);line-height:1.6;margin-bottom:16px">
        将根据你本周的饮食记录、体重变化和健康指标（低密度脂蛋白过高、胆固醇过高）生成个性化饮食推荐。
      </div>
      <div class="form-group">
        <label>生成方式</label>
        <select id="advice-mode">
          <option value="ai">? AI生成（需配置API Key，更精准）</option>
          <option value="rule">? 基础版（基于健康指标，无需API Key）</option>
        </select>
      </div>
      <button class="btn-primary btn-full" onclick="window.__genAdvice()">生成推荐</button>
    </div>
  `;

  const sheet = openBottomSheet('生成饮食推荐', html);
  window.__currentSheet = sheet;

  window.__genAdvice = async () => {
    const mode = document.getElementById('advice-mode').value;
    sheet.close();

    const content = document.getElementById('weight-content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div><p>生成中...</p></div>';

    const weekMeals = await getWeekMeals();
    const weightRecords = await getWeightRecords(7);
    const healthProfile = await getSetting('healthProfile', {
      healthIndicators: ['低密度脂蛋白过高', '胆固醇过高'],
      dietRestrictions: ['低胆固醇', '低饱和脂肪', '高纤维', '少油炸'],
    });

    let weightTrend = null;
    if (weightRecords.length >= 2) {
      const sorted = weightRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
      weightTrend = {
        start: sorted[0].weight,
        end: sorted[sorted.length - 1].weight,
        diff: round(sorted[sorted.length - 1].weight - sorted[0].weight, 1),
      };
    }

    let result;
    if (mode === 'rule') {
      result = { success: true, data: ruleBasedDietAdvice(weekMeals, healthProfile) };
    } else {
      result = await generateDietRecommendation(weekMeals, weightTrend, healthProfile);
      if (!result.success && result.error === 'NO_API_KEY') {
        result = { success: true, data: ruleBasedDietAdvice(weekMeals, healthProfile) };
        toast('未配置API Key，已使用基础版推荐');
      }
    }

    if (result.success) {
      await setSetting('lastDietAdvice', result.data);
      await setSetting('lastAdviceDate', fmtDate(new Date()));
      renderAdviceTab(content);
      toast('饮食推荐已生成');
    } else {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">?</div><div class="empty-text">生成失败：${escapeHtml(result.error)}</div></div>`;
    }
  };
}

// ============================================================
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardWeight() {
  const records = await getWeightRecords(7);
  const latest = records.length > 0 ? records[records.length - 1] : null;
  const prev = records.length > 1 ? records[0] : null;
  const change = latest && prev ? round(latest.weight - prev.weight, 1) : 0;

  const todayMeals = await getTodayMeals();
  const totalCalories = todayMeals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);

  return `
    <div class="dash-card" onclick="window.__navigate('weight')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">?? 健康管理</div>
        <div class="dash-card-more">查看详情 ?</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${latest ? latest.weight : '--'}</div>
          <div class="dash-stat-label">当前体重(kg)</div>
        </div>
        <div class="dash-stat ${change < 0 ? 'success' : change > 0 ? 'danger' : ''}">
          <div class="dash-stat-num">${change === 0 ? '--' : (change < 0 ? '↓' : '↑') + Math.abs(change)}</div>
          <div class="dash-stat-label">本周变化</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${totalCalories}</div>
          <div class="dash-stat-label">今日卡路里</div>
        </div>
      </div>
    </div>
  `;
}
