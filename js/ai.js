// ============================================================
// ai.js - AI 接口封装（Gemini API）
// ============================================================

import { getSetting } from './db.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/** 获取 API Key */
async function getApiKey() {
  return await getSetting('geminiApiKey', '');
}

/** 调用 Gemini API */
async function callGemini(prompt, imageBase64 = null) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const parts = [{ text: prompt }];
  if (imageBase64) {
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    parts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: base64Data,
      }
    });
  }

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API错误: ${response.status} ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

/** 从 AI 响应中提取 JSON */
function extractJson(text) {
  // 尝试从 markdown 代码块中提取
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch(e) {}
  }
  // 尝试直接解析
  try { return JSON.parse(text.trim()); } catch(e) {}
  // 尝试找到第一个 { 和最后一个 }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.substring(start, end + 1)); } catch(e) {}
  }
  return null;
}

// ============================================================
// 食物识别
// ============================================================

export async function recognizeFood(imageBase64) {
  const prompt = `你是一个专业的营养分析助手。请分析这张食物图片，识别其中的所有食物。

要求：
1. 识别每种食物的名称（中文）
2. 估计每种食物的克数
3. 计算每种食物的卡路里（千卡）
4. 卡路里估算要尽量精准，误差控制在100卡以内
5. 给出总体置信度（0-1）

返回严格的JSON格式：
{
  "foods": [
    {"name": "食物名", "grams": 100, "calories": 150}
  ],
  "totalCalories": 500,
  "confidence": 0.85,
  "description": "简要描述这餐的内容"
}`;

  try {
    const text = await callGemini(prompt, imageBase64);
    const result = extractJson(text);
    if (result && result.foods) {
      return { success: true, data: result };
    }
    return { success: false, error: '无法解析识别结果，请手动输入' };
  } catch (err) {
    if (err.message === 'NO_API_KEY') {
      return { success: false, error: 'NO_API_KEY', message: '未配置API Key，请到设置中配置Gemini API Key以启用AI识别' };
    }
    return { success: false, error: err.message };
  }
}

// ============================================================
// 饮食推荐
// ============================================================

export async function generateDietRecommendation(weekMeals, weightTrend, healthProfile) {
  const indicators = healthProfile?.healthIndicators || ['低密度脂蛋白过高', '胆固醇过高'];
  const restrictions = healthProfile?.dietRestrictions || ['低胆固醇', '低饱和脂肪', '高纤维'];

  const mealsSummary = weekMeals.map(m => 
    `${m.date} ${m.mealType}: ${m.foods?.map(f => `${f.name}(${f.calories}卡)`).join(', ') || '未知'}，共${m.totalCalories}卡`
  ).join('\n');

  const weightInfo = weightTrend ? 
    `体重变化：本周初 ${weightTrend.start}kg → 本周末 ${weightTrend.end}kg，变化 ${weightTrend.diff}kg` : 
    '暂无体重数据';

  const prompt = `你是一个专业的营养师，请根据以下信息为用户生成本周饮食评估和下周饮食推荐。

用户健康指标：${indicators.join('、')}
饮食限制要求：${restrictions.join('、')}

本周饮食记录：
${mealsSummary || '本周暂无饮食记录'}

${weightInfo}

请生成以下内容：
1. 本周饮食评估（热量摄入是否合理、是否有不利健康的食物）
2. 针对低密度脂蛋白和胆固醇过高的具体饮食建议
3. 下周推荐食谱（早中晚各3个选项，标注卡路里）
4. 需要避免的食物清单
5. 推荐增加的食物清单

返回严格JSON格式：
{
  "assessment": "本周饮食评估...",
  "advice": "针对健康指标的建议...",
  "recommendations": {
    "breakfast": [{"name": "燕麦粥+蓝莓", "calories": 250}],
    "lunch": [{"name": "清蒸鱼+糙米饭+西兰花", "calories": 450}],
    "dinner": [{"name": "豆腐汤+蔬菜沙拉", "calories": 300}]
  },
  "avoid": ["蛋黄", "动物内脏", "..."],
  "recommend": ["燕麦", "深海鱼", "..."]
}`;

  try {
    const text = await callGemini(prompt);
    const result = extractJson(text);
    if (result) {
      return { success: true, data: result };
    }
    return { success: false, error: '无法解析推荐结果' };
  } catch (err) {
    if (err.message === 'NO_API_KEY') {
      return { success: false, error: 'NO_API_KEY', data: ruleBasedDietAdvice(weekMeals, healthProfile) };
    }
    return { success: false, error: err.message };
  }
}

// ============================================================
// 规则引擎后备（无 API Key 时）
// ============================================================

export function ruleBasedDietAdvice(weekMeals, healthProfile) {
  const indicators = healthProfile?.healthIndicators || ['低密度脂蛋白过高', '胆固醇过高'];

  // 推荐食物（低胆固醇）
  const recommendFoods = [
    { name: '燕麦', reason: '富含可溶性纤维，帮助降低胆固醇' },
    { name: '深海鱼（三文鱼、鲭鱼）', reason: '富含Omega-3，保护心血管' },
    { name: '豆制品（豆腐、豆浆）', reason: '植物蛋白，无胆固醇' },
    { name: '坚果（核桃、杏仁）', reason: '健康脂肪，适量食用' },
    { name: '蔬菜水果', reason: '丰富纤维和抗氧化物' },
    { name: '橄榄油', reason: '健康单不饱和脂肪酸' },
    { name: '全谷物', reason: '膳食纤维丰富' },
  ];

  // 需避免食物
  const avoidFoods = [
    { name: '蛋黄', reason: '胆固醇含量高' },
    { name: '动物内脏', reason: '胆固醇极高' },
    { name: '油炸食品', reason: '反式脂肪和饱和脂肪高' },
    { name: '肥肉', reason: '饱和脂肪高' },
    { name: '奶油黄油', reason: '饱和脂肪高' },
    { name: '蟹黄鱼子', reason: '胆固醇高' },
  ];

  // 计算本周热量
  const totalCalories = weekMeals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
  const avgDailyCalories = weekMeals.length > 0 ? Math.round(totalCalories / 7) : 0;

  return {
    assessment: `本周共记录 ${weekMeals.length} 餐饮食，平均每日摄入约 ${avgDailyCalories} 卡路里。${avgDailyCalories > 2000 ? '热量摄入偏高，建议适当控制。' : '热量摄入在合理范围内。'}`,
    advice: `针对你的${indicators.join('和')}情况，核心原则是：减少饱和脂肪和胆固醇摄入，增加可溶性膳食纤维。建议每日胆固醇摄入控制在200mg以内，饱和脂肪供能比降至7%以下。`,
    recommendations: {
      breakfast: [
        { name: '燕麦粥+蓝莓+脱脂牛奶', calories: 280 },
        { name: '全麦面包+鸡蛋清+番茄', calories: 250 },
        { name: '豆浆+杂粮馒头+黄瓜', calories: 300 },
      ],
      lunch: [
        { name: '清蒸鲈鱼+糙米饭+西兰花', calories: 450 },
        { name: '鸡胸肉沙拉+全麦面包', calories: 400 },
        { name: '豆腐炖菜+杂粮饭+菠菜', calories: 420 },
      ],
      dinner: [
        { name: '紫菜蛋花汤（蛋清）+蔬菜沙拉', calories: 280 },
        { name: '小米粥+清炒时蔬+蒸南瓜', calories: 300 },
        { name: '番茄豆腐汤+凉拌木耳', calories: 250 },
      ],
    },
    avoid: avoidFoods.map(f => `${f.name}（${f.reason}）`),
    recommend: recommendFoods.map(f => `${f.name}（${f.reason}）`),
    source: 'rule-based',
  };
}
