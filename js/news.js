// ============================================================
// news.js - \u6a21\u57574：\u70ed\u70b9\u65b0\u95fb\u8d44\u8baf
// \u6570\u636e\u6e90：60s.viki.moe（Cloudflare Workers \u90e8\u7f72，\u56fd\u5185\u53ef\u8bbf\u95ee，JSON \u683c\u5f0f，\u514d Key）
// \u6587\u6863：https://docs.60s-api.viki.moe
// ============================================================

import { getSetting, setSetting } from './db.js';
import { fmtDate, escapeHtml, toast } from './utils.js';

let initialized = false;
let currentCategory = 'top';

// \u5206\u7c7b → \u7aef\u70b9\u6620\u5c04（60s.viki.moe v2 API）
// \u6bcf\u4e2a\u5206\u7c7b\u5bf9\u5e94\u4e00\u4e2a\u6216\u591a\u4e2a\u699c\u5355，\u53d6\u5e76\u96c6
const CATEGORY_ENDPOINTS = {
  top:    [{ ep: '60s',     label: '\u6bcf\u65e560\u79d2' }],
  hot:    [
          { ep: 'weibo',    label: '\u5fae\u535a\u70ed\u641c' },
          { ep: 'toutiao',  label: '\u5934\u6761\u70ed\u699c' },
          ],
  tech:   [{ ep: 'it-news', label: 'IT\u8d44\u8baf' }],
  finance:[{ ep: 'zhihu',   label: '\u77e5\u4e4e\u70ed\u699c' }],
  fun:    [{ ep: 'douyin',  label: '\u6296\u97f3\u70ed\u70b9' }],
};

const CATEGORIES = [
  { key: 'top',     name: '📰 60\u79d2' },
  { key: 'hot',     name: '🔥 \u70ed\u641c' },
  { key: 'tech',    name: '💻 \u79d1\u6280' },
  { key: 'finance', name: '💡 \u77e5\u4e4e' },
  { key: 'fun',     name: '🎬 \u6296\u97f3' },
];

const API_BASE = 'https://60s.viki.moe/v2/';

export async function initNews() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// \u7edf\u4e00\u6293\u53d6：5 \u79d2\u8d85\u65f6，\u5931\u8d25\u8fd4\u56de null
// ============================================================

async function fetchEndpoint(ep) {
  const url = API_BASE + ep + '?format=json';
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== 200) return null;
    return json.data;
  } catch (e) {
    return null;
  }
}

// ============================================================
// \u89e3\u6790：\u628a\u5404\u7aef\u70b9\u7684\u4e0d\u540c\u7ed3\u6784\u7edf\u4e00\u6210 {title, summary, link, hot, source, pubDate}
// ============================================================

function parse60s(data) {
  // data: { date, news: [...strings], cover, tip, image, link, created_at }
  if (!data || !Array.isArray(data.news)) return [];
  const pubDate = data.created_at ? new Date(data.created_at) : new Date();
  return data.news.map((title, idx) => ({
    id: '60s_' + idx,
    title: String(title).trim(),
    summary: '',
    link: data.link || '',
    hot: '',
    source: '\u6bcf\u65e560\u79d2',
    pubDate,
  }));
}

function parseHotList(data, sourceName) {
  // \u901a\u7528：[{title, hot_value, link, cover, detail, description}]
  if (!Array.isArray(data)) return [];
  return data.map((item, idx) => ({
    id: sourceName + '_' + idx,
    title: (item.title || '').trim(),
    summary: (item.detail || item.description || '').trim().slice(0, 200),
    link: item.link || '',
    hot: item.hot_value ? formatHot(item.hot_value) : '',
    source: sourceName,
    pubDate: new Date(),
  }));
}

function formatHot(v) {
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '\u4ebf';
  if (v >= 10000) return (v / 10000).toFixed(1) + '\u4e07';
  return String(v);
}

// ============================================================
// \u5206\u7c7b\u6293\u53d6（\u5e26 2 \u5c0f\u65f6\u7f13\u5b58）
// ============================================================

async function fetchCategoryNews(category) {
  const endpoints = CATEGORY_ENDPOINTS[category] || CATEGORY_ENDPOINTS.top;
  const cacheKey = `newsCache_${category}`;
  const cached = await getSetting(cacheKey, null);
  const now = Date.now();

  // \u547d\u4e2d\u7f13\u5b58
  if (cached && (now - cached.timestamp) < 2 * 60 * 60 * 1000) {
    return { news: cached.news, fromCache: true };
  }

  // \u5e76\u884c\u6293\u53d6\u6240\u6709\u7aef\u70b9
  const results = await Promise.allSettled(
    endpoints.map(async ({ ep, label }) => {
      const data = await fetchEndpoint(ep);
      if (data == null) return [];
      let news;
      if (ep === '60s') {
        news = parse60s(data);
      } else {
        news = parseHotList(data, label);
      }
      // 60s \u7aef\u70b9\u53ea\u53d6\u524d 15 \u6761；\u70ed\u699c\u53d6\u524d 25 \u6761/\u6e90
      return ep === '60s' ? news : news.slice(0, 25);
    })
  );

  let allNews = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allNews = allNews.concat(r.value);
    }
  });

  // \u6392\u5e8f：60s \u4fdd\u6301\u539f\u987a\u5e8f；\u70ed\u699c\u6309\u70ed\u5ea6\u964d\u5e8f
  if (category !== 'top' && allNews.length > 0 && allNews[0].hot) {
    // \u70ed\u5ea6\u6392\u5e8f\u4e0d\u53ef\u9760（\u4e0d\u540c\u5e73\u53f0\u91cf\u7ea7\u4e0d\u540c），\u6539\u4e3a\u6309\u6e90\u5206\u7ec4、\u6e90\u5185\u6309\u539f\u987a\u5e8f
    // \u8fd9\u91cc\u4fdd\u6301\u5404\u6e90\u5185\u90e8\u987a\u5e8f，\u6e90\u4e4b\u95f4\u6309 endpoints \u987a\u5e8f
  }

  // 60s \u5206\u7c7b\u9650\u5236 15 \u6761；\u5176\u4ed6\u5206\u7c7b\u6700\u591a 40 \u6761
  const limit = category === 'top' ? 15 : 40;
  allNews = allNews.slice(0, limit);

  // \u5199\u7f13\u5b58
  if (allNews.length > 0) {
    await setSetting(cacheKey, { news: allNews, timestamp: now });
  }

  return { news: allNews, fromCache: false };
}

// ============================================================
// \u6e32\u67d3：\u4e3b\u9875\u9762
// ============================================================

export async function renderNews(container) {
  container.innerHTML = `
    <div class="news-tabs">
      ${CATEGORIES.map(c => `
        <button class="news-tab ${c.key === currentCategory ? 'active' : ''}" onclick="window.__newsCat('${c.key}')">${c.name}</button>
      `).join('')}
    </div>
    <div class="news-refresh-bar">
      <button class="btn-outline btn-sm" onclick="window.__newsRefresh()">🔄 \u5237\u65b0</button>
      <span class="text-xs text-gray" id="news-update-time"></span>
    </div>
    <div id="news-content">
      <div class="loading">
        <div class="spinner"></div>
        <p>\u52a0\u8f7d\u4e2d...</p>
      </div>
    </div>
  `;

  window.__newsCat = (cat) => {
    currentCategory = cat;
    renderNews(container);
  };

  window.__newsRefresh = async () => {
    // \u6e05\u7f13\u5b58
    const cacheKey = `newsCache_${currentCategory}`;
    await setSetting(cacheKey, null);
    toast('\u5df2\u5237\u65b0');
    renderNews(container);
  };

  window.__openNews = (url) => {
    if (url) window.open(url, '_blank');
  };

  await renderNewsList();
}

async function renderNewsList() {
  const content = document.getElementById('news-content');
  if (!content) return;

  const result = await fetchCategoryNews(currentCategory);

  if (!result || result.news.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📰</div>
        <div class="empty-text">\u6682\u65e0\u5185\u5bb9</div>
        <div class="text-xs text-gray mt-8">\u53ef\u80fd\u662f\u7f51\u7edc\u6ce2\u52a8，\u8bf7\u70b9\u51fb\u5237\u65b0\u91cd\u8bd5</div>
        <button class="btn-outline mt-16" onclick="window.__newsRefresh()">🔄 \u91cd\u65b0\u52a0\u8f7d</button>
      </div>
      <div class="card">
        <div class="card-title"><span class="title-left">📌 \u63a8\u8350\u8d44\u8baf\u5165\u53e3</span></div>
        <div class="more-item" onclick="window.open('https://news.cctv.com','_blank')">
          <div class="more-icon" style="background:#ef4444">📺</div>
          <div class="more-info"><div class="more-name">\u592e\u89c6\u65b0\u95fb</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.open('https://www.thepaper.cn','_blank')">
          <div class="more-icon" style="background:#1677ff">📰</div>
          <div class="more-info"><div class="more-name">\u6f8e\u6e43\u65b0\u95fb</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.open('https://www.cls.cn','_blank')">
          <div class="more-icon" style="background:#f59e0b">💰</div>
          <div class="more-info"><div class="more-name">\u8d22\u8054\u793e</div></div>
          <div class="more-arrow">›</div>
        </div>
      </div>
    `;
    return;
  }

  const news = result.news;
  const updateTime = document.getElementById('news-update-time');
  if (updateTime) {
    updateTime.textContent = result.fromCache ? '📡 \u79bb\u7ebf\u7f13\u5b58' : '✨ \u521a\u521a\u66f4\u65b0';
  }

  content.innerHTML = `
    ${result.fromCache ? '<div class="text-xs text-gray text-center" style="padding:6px">📡 \u79bb\u7ebf\u7f13\u5b58\u5185\u5bb9（2\u5c0f\u65f6\u5185）</div>' : ''}
    ${news.map(n => `
      <div class="news-item" onclick="window.__openNews('${escapeHtml(n.link)}')">
        <div class="news-source">
          ${n.source ? `<span class="news-source-badge">${escapeHtml(n.source)}</span>` : ''}
          ${n.hot ? `<span class="news-hot-badge">🔥 ${escapeHtml(n.hot)}</span>` : ''}
          <span>${formatTime(n.pubDate)}</span>
        </div>
        <div class="news-title">${escapeHtml(n.title)}</div>
        ${n.summary ? `<div class="news-summary">${escapeHtml(n.summary)}</div>` : ''}
      </div>
    `).join('')}
  `;
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}\u5206\u949f\u524d`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}\u5c0f\u65f6\u524d`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}\u5929\u524d`;
  return fmtDate(d);
}

// ============================================================
// \u9996\u9875 Dashboard \u5361\u7247（\u7528 60s \u63a5\u53e3，3 \u79d2\u8d85\u65f6\u4e0d\u963b\u585e\u9996\u9875）
// ============================================================

export async function dashboardNews() {
  let topNews = [];
  let tip = '';
  try {
    const result = await Promise.race([
      fetchCategoryNews('top'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500)),
    ]);
    topNews = (result?.news || []).slice(0, 4);
  } catch (e) {
    // \u9759\u9ed8\u5931\u8d25
  }

  return `
    <div class="dash-card" onclick="window.__navigate('news')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">📰 \u6bcf\u65e5\u8d44\u8baf</div>
        <div class="dash-card-more">\u67e5\u770b\u66f4\u591a ›</div>
      </div>
      ${topNews.length > 0 ? topNews.map((n, i) => `
        <div class="text-sm" style="padding:5px 0;border-bottom:1px solid var(--gray-100);display:flex;gap:6px">
          <span style="color:var(--primary);font-weight:600;min-width:18px">${i + 1}.</span>
          <span>${escapeHtml(n.title)}</span>
        </div>
      `).join('') : '<div class="text-sm text-gray text-center" style="padding:12px">\u70b9\u51fb\u67e5\u770b\u6700\u65b0\u8d44\u8baf</div>'}
    </div>
  `;
}
