// ============================================================
// ai.js - AI \u63a5\u53e3\u5c01\u88c5（Gemini API）
// ============================================================

import { getSetting } from './db.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/** \u83b7\u53d6 API Key */
async function getApiKey() {
  return await getSetting('geminiApiKey', '');
}

/** \u8c03\u7528 Gemini API */
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
    throw new Error(`API\u9519\u8bef: ${response.status} ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

/** \u4ece AI \u54cd\u5e94\u4e2d\u63d0\u53d6 JSON */
function extractJson(text) {
  // \u5c1d\u8bd5\u4ece markdown \u4ee3\u7801\u5757\u4e2d\u63d0\u53d6
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch(e) {}
  }
  // \u5c1d\u8bd5\u76f4\u63a5\u89e3\u6790
  try { return JSON.parse(text.trim()); } catch(e) {}
  // \u5c1d\u8bd5\u627e\u5230\u7b2c\u4e00\u4e2a { \u548c\u6700\u540e\u4e00\u4e2a }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.substring(start, end + 1)); } catch(e) {}
  }
  return null;
}

// ============================================================
// \u98df\u7269\u8bc6\u522b
// ============================================================

export async function recognizeFood(imageBase64) {
  const prompt = `\u4f60\u662f\u4e00\u4e2a\u4e13\u4e1a\u7684\u8425\u517b\u5206\u6790\u52a9\u624b。\u8bf7\u5206\u6790\u8fd9\u5f20\u98df\u7269\u56fe\u7247，\u8bc6\u522b\u5176\u4e2d\u7684\u6240\u6709\u98df\u7269。

\u8981\u6c42：
1. \u8bc6\u522b\u6bcf\u79cd\u98df\u7269\u7684\u540d\u79f0（\u4e2d\u6587）
2. \u4f30\u8ba1\u6bcf\u79cd\u98df\u7269\u7684\u514b\u6570
3. \u8ba1\u7b97\u6bcf\u79cd\u98df\u7269\u7684\u5361\u8def\u91cc（\u5343\u5361）
4. \u5361\u8def\u91cc\u4f30\u7b97\u8981\u5c3d\u91cf\u7cbe\u51c6，\u8bef\u5dee\u63a7\u5236\u5728100\u5361\u4ee5\u5185
5. \u7ed9\u51fa\u603b\u4f53\u7f6e\u4fe1\u5ea6（0-1）

\u8fd4\u56de\u4e25\u683c\u7684JSON\u683c\u5f0f：
{
  "foods": [
    {"name": "\u98df\u7269\u540d", "grams": 100, "calories": 150}
  ],
  "totalCalories": 500,
  "confidence": 0.85,
  "description": "\u7b80\u8981\u63cf\u8ff0\u8fd9\u9910\u7684\u5185\u5bb9"
}`;

  try {
    const text = await callGemini(prompt, imageBase64);
    const result = extractJson(text);
    if (result && result.foods) {
      return { success: true, data: result };
    }
    return { success: false, error: '\u65e0\u6cd5\u89e3\u6790\u8bc6\u522b\u7ed3\u679c，\u8bf7\u624b\u52a8\u8f93\u5165' };
  } catch (err) {
    if (err.message === 'NO_API_KEY') {
      return { success: false, error: 'NO_API_KEY', message: '\u672a\u914d\u7f6eAPI Key，\u8bf7\u5230\u8bbe\u7f6e\u4e2d\u914d\u7f6eGemini API Key\u4ee5\u542f\u7528AI\u8bc6\u522b' };
    }
    return { success: false, error: err.message };
  }
}

// ============================================================
// \u996e\u98df\u63a8\u8350
// ============================================================

export async function generateDietRecommendation(weekMeals, weightTrend, healthProfile) {
  const indicators = healthProfile?.healthIndicators || ['\u4f4e\u5bc6\u5ea6\u8102\u86cb\u767d\u8fc7\u9ad8', '\u80c6\u56fa\u9187\u8fc7\u9ad8'];
  const restrictions = healthProfile?.dietRestrictions || ['\u4f4e\u80c6\u56fa\u9187', '\u4f4e\u9971\u548c\u8102\u80aa', '\u9ad8\u7ea4\u7ef4'];

  const mealsSummary = weekMeals.map(m => 
    `${m.date} ${m.mealType}: ${m.foods?.map(f => `${f.name}(${f.calories}\u5361)`).join(', ') || '\u672a\u77e5'}，\u5171${m.totalCalories}\u5361`
  ).join('\n');

  const weightInfo = weightTrend ? 
    `\u4f53\u91cd\u53d8\u5316：\u672c\u5468\u521d ${weightTrend.start}kg → \u672c\u5468\u672b ${weightTrend.end}kg，\u53d8\u5316 ${weightTrend.diff}kg` : 
    '\u6682\u65e0\u4f53\u91cd\u6570\u636e';

  const prompt = `\u4f60\u662f\u4e00\u4e2a\u4e13\u4e1a\u7684\u8425\u517b\u5e08，\u8bf7\u6839\u636e\u4ee5\u4e0b\u4fe1\u606f\u4e3a\u7528\u6237\u751f\u6210\u672c\u5468\u996e\u98df\u8bc4\u4f30\u548c\u4e0b\u5468\u996e\u98df\u63a8\u8350。

\u7528\u6237\u5065\u5eb7\u6307\u6807：${indicators.join('、')}
\u996e\u98df\u9650\u5236\u8981\u6c42：${restrictions.join('、')}

\u672c\u5468\u996e\u98df\u8bb0\u5f55：
${mealsSummary || '\u672c\u5468\u6682\u65e0\u996e\u98df\u8bb0\u5f55'}

${weightInfo}

\u8bf7\u751f\u6210\u4ee5\u4e0b\u5185\u5bb9：
1. \u672c\u5468\u996e\u98df\u8bc4\u4f30（\u70ed\u91cf\u6444\u5165\u662f\u5426\u5408\u7406、\u662f\u5426\u6709\u4e0d\u5229\u5065\u5eb7\u7684\u98df\u7269）
2. \u9488\u5bf9\u4f4e\u5bc6\u5ea6\u8102\u86cb\u767d\u548c\u80c6\u56fa\u9187\u8fc7\u9ad8\u7684\u5177\u4f53\u996e\u98df\u5efa\u8bae
3. \u4e0b\u5468\u63a8\u8350\u98df\u8c31（\u65e9\u4e2d\u665a\u54043\u4e2a\u9009\u9879，\u6807\u6ce8\u5361\u8def\u91cc）
4. \u9700\u8981\u907f\u514d\u7684\u98df\u7269\u6e05\u5355
5. \u63a8\u8350\u589e\u52a0\u7684\u98df\u7269\u6e05\u5355

\u8fd4\u56de\u4e25\u683cJSON\u683c\u5f0f：
{
  "assessment": "\u672c\u5468\u996e\u98df\u8bc4\u4f30...",
  "advice": "\u9488\u5bf9\u5065\u5eb7\u6307\u6807\u7684\u5efa\u8bae...",
  "recommendations": {
    "breakfast": [{"name": "\u71d5\u9ea6\u7ca5+\u84dd\u8393", "calories": 250}],
    "lunch": [{"name": "\u6e05\u84b8\u9c7c+\u7cd9\u7c73\u996d+\u897f\u5170\u82b1", "calories": 450}],
    "dinner": [{"name": "\u8c46\u8150\u6c64+\u852c\u83dc\u6c99\u62c9", "calories": 300}]
  },
  "avoid": ["\u86cb\u9ec4", "\u52a8\u7269\u5185\u810f", "..."],
  "recommend": ["\u71d5\u9ea6", "\u6df1\u6d77\u9c7c", "..."]
}`;

  try {
    const text = await callGemini(prompt);
    const result = extractJson(text);
    if (result) {
      return { success: true, data: result };
    }
    return { success: false, error: '\u65e0\u6cd5\u89e3\u6790\u63a8\u8350\u7ed3\u679c' };
  } catch (err) {
    if (err.message === 'NO_API_KEY') {
      return { success: false, error: 'NO_API_KEY', data: ruleBasedDietAdvice(weekMeals, healthProfile) };
    }
    return { success: false, error: err.message };
  }
}

// ============================================================
// \u89c4\u5219\u5f15\u64ce\u540e\u5907（\u65e0 API Key \u65f6）
// ============================================================

export function ruleBasedDietAdvice(weekMeals, healthProfile) {
  const indicators = healthProfile?.healthIndicators || ['\u4f4e\u5bc6\u5ea6\u8102\u86cb\u767d\u8fc7\u9ad8', '\u80c6\u56fa\u9187\u8fc7\u9ad8'];

  // \u63a8\u8350\u98df\u7269（\u4f4e\u80c6\u56fa\u9187）
  const recommendFoods = [
    { name: '\u71d5\u9ea6', reason: '\u5bcc\u542b\u53ef\u6eb6\u6027\u7ea4\u7ef4，\u5e2e\u52a9\u964d\u4f4e\u80c6\u56fa\u9187' },
    { name: '\u6df1\u6d77\u9c7c（\u4e09\u6587\u9c7c、\u9cad\u9c7c）', reason: '\u5bcc\u542bOmega-3，\u4fdd\u62a4\u5fc3\u8840\u7ba1' },
    { name: '\u8c46\u5236\u54c1（\u8c46\u8150、\u8c46\u6d46）', reason: '\u690d\u7269\u86cb\u767d，\u65e0\u80c6\u56fa\u9187' },
    { name: '\u575a\u679c（\u6838\u6843、\u674f\u4ec1）', reason: '\u5065\u5eb7\u8102\u80aa，\u9002\u91cf\u98df\u7528' },
    { name: '\u852c\u83dc\u6c34\u679c', reason: '\u4e30\u5bcc\u7ea4\u7ef4\u548c\u6297\u6c27\u5316\u7269' },
    { name: '\u6a44\u6984\u6cb9', reason: '\u5065\u5eb7\u5355\u4e0d\u9971\u548c\u8102\u80aa\u9178' },
    { name: '\u5168\u8c37\u7269', reason: '\u81b3\u98df\u7ea4\u7ef4\u4e30\u5bcc' },
  ];

  // \u9700\u907f\u514d\u98df\u7269
  const avoidFoods = [
    { name: '\u86cb\u9ec4', reason: '\u80c6\u56fa\u9187\u542b\u91cf\u9ad8' },
    { name: '\u52a8\u7269\u5185\u810f', reason: '\u80c6\u56fa\u9187\u6781\u9ad8' },
    { name: '\u6cb9\u70b8\u98df\u54c1', reason: '\u53cd\u5f0f\u8102\u80aa\u548c\u9971\u548c\u8102\u80aa\u9ad8' },
    { name: '\u80a5\u8089', reason: '\u9971\u548c\u8102\u80aa\u9ad8' },
    { name: '\u5976\u6cb9\u9ec4\u6cb9', reason: '\u9971\u548c\u8102\u80aa\u9ad8' },
    { name: '\u87f9\u9ec4\u9c7c\u5b50', reason: '\u80c6\u56fa\u9187\u9ad8' },
  ];

  // \u8ba1\u7b97\u672c\u5468\u70ed\u91cf
  const totalCalories = weekMeals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
  const avgDailyCalories = weekMeals.length > 0 ? Math.round(totalCalories / 7) : 0;

  return {
    assessment: `\u672c\u5468\u5171\u8bb0\u5f55 ${weekMeals.length} \u9910\u996e\u98df，\u5e73\u5747\u6bcf\u65e5\u6444\u5165\u7ea6 ${avgDailyCalories} \u5361\u8def\u91cc。${avgDailyCalories > 2000 ? '\u70ed\u91cf\u6444\u5165\u504f\u9ad8，\u5efa\u8bae\u9002\u5f53\u63a7\u5236。' : '\u70ed\u91cf\u6444\u5165\u5728\u5408\u7406\u8303\u56f4\u5185。'}`,
    advice: `\u9488\u5bf9\u4f60\u7684${indicators.join('\u548c')}\u60c5\u51b5，\u6838\u5fc3\u539f\u5219\u662f：\u51cf\u5c11\u9971\u548c\u8102\u80aa\u548c\u80c6\u56fa\u9187\u6444\u5165，\u589e\u52a0\u53ef\u6eb6\u6027\u81b3\u98df\u7ea4\u7ef4。\u5efa\u8bae\u6bcf\u65e5\u80c6\u56fa\u9187\u6444\u5165\u63a7\u5236\u5728200mg\u4ee5\u5185，\u9971\u548c\u8102\u80aa\u4f9b\u80fd\u6bd4\u964d\u81f37%\u4ee5\u4e0b。`,
    recommendations: {
      breakfast: [
        { name: '\u71d5\u9ea6\u7ca5+\u84dd\u8393+\u8131\u8102\u725b\u5976', calories: 280 },
        { name: '\u5168\u9ea6\u9762\u5305+\u9e21\u86cb\u6e05+\u756a\u8304', calories: 250 },
        { name: '\u8c46\u6d46+\u6742\u7cae\u9992\u5934+\u9ec4\u74dc', calories: 300 },
      ],
      lunch: [
        { name: '\u6e05\u84b8\u9c88\u9c7c+\u7cd9\u7c73\u996d+\u897f\u5170\u82b1', calories: 450 },
        { name: '\u9e21\u80f8\u8089\u6c99\u62c9+\u5168\u9ea6\u9762\u5305', calories: 400 },
        { name: '\u8c46\u8150\u7096\u83dc+\u6742\u7cae\u996d+\u83e0\u83dc', calories: 420 },
      ],
      dinner: [
        { name: '\u7d2b\u83dc\u86cb\u82b1\u6c64（\u86cb\u6e05）+\u852c\u83dc\u6c99\u62c9', calories: 280 },
        { name: '\u5c0f\u7c73\u7ca5+\u6e05\u7092\u65f6\u852c+\u84b8\u5357\u74dc', calories: 300 },
        { name: '\u756a\u8304\u8c46\u8150\u6c64+\u51c9\u62cc\u6728\u8033', calories: 250 },
      ],
    },
    avoid: avoidFoods.map(f => `${f.name}（${f.reason}）`),
    recommend: recommendFoods.map(f => `${f.name}（${f.reason}）`),
    source: 'rule-based',
  };
}
