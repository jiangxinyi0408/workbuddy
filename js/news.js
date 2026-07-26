// ============================================================
// news.js - 模块4：热点新闻资讯
// 数据源：60s.viki.moe（Cloudflare Workers 部署，国内可访问，JSON 格式，免 Key）
// 文档：https://docs.60s-api.viki.moe
// ============================================================

import { getSetting, setSetting } from './db.js';
import { fmtDate, escapeHtml, toast } from './utils.js';

let initialized = false;
let currentCategory = 'top';

// 分类 → 端点映射（60s.viki.moe v2 API）
// 每个分类对应一个或多个榜单，取并集
const CATEGORY_ENDPOINTS = {
  top:    [{ ep: '60s',     label: '每日60秒' }],
  hot:    [
          { ep: 'weibo',    label: '微博热搜' },
          { ep: 'toutiao',  label: '头条热榜' },
          ],
  tech:   [{ ep: 'it-news', label: 'IT资讯' }],
  finance:[{ ep: 'zhihu',   label: '知乎热榜' }],
  fun:    [{ ep: 'douyin',  label: '抖音热点' }],
};

const CATEGORIES = [
  { key: 'top',     name: '📰 60秒' },
  { key: 'hot',     name: '🔥 热搜' },
  { key: 'tech',    name: '💻 科技' },
  { key: 'finance', name: '💡 知乎' },
  { key: 'fun',     name: '🎬 抖音' },
];

const API_BASE = 'https://60s.viki.moe/v2/';

export async function initNews() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// 统一抓取：5 秒超时，失败返回 null
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
// 解析：把各端点的不同结构统一成 {title, summary, link, hot, source, pubDate}
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
    source: '每日60秒',
    pubDate,
  }));
}

function parseHotList(data, sourceName) {
  // 通用：[{title, hot_value, link, cover, detail, description}]
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
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '亿';
  if (v >= 10000) return (v / 10000).toFixed(1) + '万';
  return String(v);
}

// ============================================================
// 分类抓取（带 2 小时缓存）
// ============================================================

async function fetchCategoryNews(category) {
  const endpoints = CATEGORY_ENDPOINTS[category] || CATEGORY_ENDPOINTS.top;
  const cacheKey = `newsCache_${category}`;
  const cached = await getSetting(cacheKey, null);
  const now = Date.now();

  // 命中缓存
  if (cached && (now - cached.timestamp) < 2 * 60 * 60 * 1000) {
    return { news: cached.news, fromCache: true };
  }

  // 并行抓取所有端点
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
      // 60s 端点只取前 15 条；热榜取前 25 条/源
      return ep === '60s' ? news : news.slice(0, 25);
    })
  );

  let allNews = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allNews = allNews.concat(r.value);
    }
  });

  // 排序：60s 保持原顺序；热榜按热度降序
  if (category !== 'top' && allNews.length > 0 && allNews[0].hot) {
    // 热度排序不可靠（不同平台量级不同），改为按源分组、源内按原顺序
    // 这里保持各源内部顺序，源之间按 endpoints 顺序
  }

  // 60s 分类限制 15 条；其他分类最多 40 条
  const limit = category === 'top' ? 15 : 40;
  allNews = allNews.slice(0, limit);

  // 写缓存
  if (allNews.length > 0) {
    await setSetting(cacheKey, { news: allNews, timestamp: now });
  }

  return { news: allNews, fromCache: false };
}

// ============================================================
// 渲染：主页面
// ============================================================

export async function renderNews(container) {
  container.innerHTML = `
    <div class="news-tabs">
      ${CATEGORIES.map(c => `
        <button class="news-tab ${c.key === currentCategory ? 'active' : ''}" onclick="window.__newsCat('${c.key}')">${c.name}</button>
      `).join('')}
    </div>
    <div class="news-refresh-bar">
      <button class="btn-outline btn-sm" onclick="window.__newsRefresh()">🔄 刷新</button>
      <span class="text-xs text-gray" id="news-update-time"></span>
    </div>
    <div id="news-content">
      <div class="loading">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>
    </div>
  `;

  window.__newsCat = (cat) => {
    currentCategory = cat;
    renderNews(container);
  };

  window.__newsRefresh = async () => {
    // 清缓存
    const cacheKey = `newsCache_${currentCategory}`;
    await setSetting(cacheKey, null);
    toast('已刷新');
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
        <div class="empty-text">暂无内容</div>
        <div class="text-xs text-gray mt-8">可能是网络波动，请点击刷新重试</div>
        <button class="btn-outline mt-16" onclick="window.__newsRefresh()">🔄 重新加载</button>
      </div>
      <div class="card">
        <div class="card-title"><span class="title-left">📌 推荐资讯入口</span></div>
        <div class="more-item" onclick="window.open('https://news.cctv.com','_blank')">
          <div class="more-icon" style="background:#ef4444">📺</div>
          <div class="more-info"><div class="more-name">央视新闻</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.open('https://www.thepaper.cn','_blank')">
          <div class="more-icon" style="background:#1677ff">📰</div>
          <div class="more-info"><div class="more-name">澎湃新闻</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.open('https://www.cls.cn','_blank')">
          <div class="more-icon" style="background:#f59e0b">💰</div>
          <div class="more-info"><div class="more-name">财联社</div></div>
          <div class="more-arrow">›</div>
        </div>
      </div>
    `;
    return;
  }

  const news = result.news;
  const updateTime = document.getElementById('news-update-time');
  if (updateTime) {
    updateTime.textContent = result.fromCache ? '📡 离线缓存' : '✨ 刚刚更新';
  }

  content.innerHTML = `
    ${result.fromCache ? '<div class="text-xs text-gray text-center" style="padding:6px">📡 离线缓存内容（2小时内）</div>' : ''}
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
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return fmtDate(d);
}

// ============================================================
// 首页 Dashboard 卡片（用 60s 接口，3 秒超时不阻塞首页）
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
    // 静默失败
  }

  return `
    <div class="dash-card" onclick="window.__navigate('news')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">📰 每日资讯</div>
        <div class="dash-card-more">查看更多 ›</div>
      </div>
      ${topNews.length > 0 ? topNews.map((n, i) => `
        <div class="text-sm" style="padding:5px 0;border-bottom:1px solid var(--gray-100);display:flex;gap:6px">
          <span style="color:var(--primary);font-weight:600;min-width:18px">${i + 1}.</span>
          <span>${escapeHtml(n.title)}</span>
        </div>
      `).join('') : '<div class="text-sm text-gray text-center" style="padding:12px">点击查看最新资讯</div>'}
    </div>
  `;
}
