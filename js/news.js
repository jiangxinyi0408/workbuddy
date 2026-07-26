// ============================================================
// news.js - 模块4：热点新闻资讯
// ============================================================

import { getSetting, setSetting } from './db.js';
import { fmtDate, escapeHtml, toast } from './utils.js';

let initialized = false;
let currentCategory = 'top';

// 新闻源配置
const NEWS_SOURCES = {
  top: [
    { name: '新华网', url: 'https://feedx.net/rss/xinhuanet.xml', badge: '国内' },
    { name: '央视新闻', url: 'https://feedx.net/rss/cctv.xml', badge: '国内' },
  ],
  world: [
    { name: 'BBC中文', url: 'https://feedx.net/rss/bbc.xml', badge: '国际' },
    { name: 'Reuters', url: 'https://feedx.net/rss/reuters.xml', badge: '国际' },
  ],
  tech: [
    { name: '36氪', url: 'https://feedx.net/rss/36kr.xml', badge: '科技' },
  ],
  finance: [
    { name: '华尔街见闻', url: 'https://feedx.net/rss/wallstreetcn.xml', badge: '财经' },
  ],
};

const CATEGORIES = [
  { key: 'top', name: '🎯 热点' },
  { key: 'world', name: '🌍 国际' },
  { key: 'tech', name: '💡 科技' },
  { key: 'finance', name: '💰 财经' },
];

// CORS 代理
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?url=',
];

export async function initNews() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// RSS 抓取与解析
// ============================================================

async function fetchRSS(url) {
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url), {
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const text = await response.text();
        return text;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

function parseRSS(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const items = doc.querySelectorAll('item');
  const news = [];

  items.forEach((item, idx) => {
    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';

    // 清理描述中的 HTML
    const cleanDesc = description
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
      .slice(0, 200);

    if (title) {
      news.push({
        id: genId(),
        title: title.trim(),
        link: link.trim(),
        summary: cleanDesc,
        pubDate: pubDate ? new Date(pubDate) : new Date(),
      });
    }
  });

  return news;
}

function genId() {
  return Math.random().toString(36).slice(2);
}

async function fetchCategoryNews(category) {
  const sources = NEWS_SOURCES[category] || NEWS_SOURCES.top;
  let allNews = [];

  // 检查缓存
  const cacheKey = `newsCache_${category}`;
  const cached = await getSetting(cacheKey, null);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < 2 * 60 * 60 * 1000) {
    return { news: cached.news, fromCache: true };
  }

  // 抓取所有源
  for (const source of sources) {
    try {
      const xmlText = await fetchRSS(source.url);
      if (xmlText) {
        const news = parseRSS(xmlText);
        news.forEach(n => n.source = source.name);
        allNews = allNews.concat(news);
      }
    } catch (e) {
      console.log(`抓取 ${source.name} 失败:`, e);
    }
  }

  // 按时间排序
  allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // 缓存
  if (allNews.length > 0) {
    await setSetting(cacheKey, { news: allNews.slice(0, 30), timestamp: now });
  }

  return { news: allNews.slice(0, 30), fromCache: false };
}

// ============================================================
// 渲染：热点资讯主页面
// ============================================================

export async function renderNews(container) {
  container.innerHTML = `
    <div class="news-tabs">
      ${CATEGORIES.map(c => `
        <button class="news-tab ${c.key === currentCategory ? 'active' : ''}" onclick="window.__newsCat('${c.key}')">${c.name}</button>
      `).join('')}
    </div>
    <div id="news-content">
      <div class="loading">
        <div class="spinner"></div>
        <p>加载新闻中...</p>
      </div>
    </div>
  `;

  window.__newsCat = (cat) => {
    currentCategory = cat;
    renderNews(container);
  };

  window.__openNews = (url) => {
    window.open(url, '_blank');
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
        <div class="empty-text">暂无新闻</div>
        <div class="text-xs text-gray mt-8">可能是网络问题，请稍后重试</div>
        <button class="btn-outline mt-16" onclick="location.reload()">刷新</button>
      </div>
      <div class="card">
        <div class="card-title"><span class="title-left">📌 推荐资讯入口</span></div>
        <div class="more-item" onclick="window.open('https://news.cctv.com','_blank')">
          <div class="more-icon" style="background:#ef4444">📺</div>
          <div class="more-info"><div class="more-name">央视新闻</div></div>
          <div class="more-arrow">›</div>
        </div>
        <div class="more-item" onclick="window.open('https://www.bbc.com/zhongwen/simp','_blank')">
          <div class="more-icon" style="background:#6b7280">🌐</div>
          <div class="more-info"><div class="more-name">BBC中文</div></div>
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
  content.innerHTML = `
    ${result.fromCache ? '<div class="text-xs text-gray text-center" style="padding:8px">📡 离线缓存内容</div>' : ''}
    ${news.map(n => `
      <div class="news-item" onclick="window.__openNews('${escapeHtml(n.link)}')">
        <div class="news-source">
          ${n.source ? `<span class="news-source-badge">${escapeHtml(n.source)}</span>` : ''}
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
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return fmtDate(d);
}

// ============================================================
// 首页 Dashboard 卡片
// ============================================================

export async function dashboardNews() {
  // 尝试获取热点新闻 Top 3
  let topNews = [];
  try {
    const result = await fetchCategoryNews('top');
    topNews = (result?.news || []).slice(0, 3);
  } catch (e) {
    // 静默失败
  }

  return `
    <div class="dash-card" onclick="window.__navigate('news')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">📰 热点资讯</div>
        <div class="dash-card-more">查看更多 ›</div>
      </div>
      ${topNews.length > 0 ? topNews.map(n => `
        <div class="text-sm" style="padding:6px 0;border-bottom:1px solid var(--gray-100)">
          ${escapeHtml(n.title)}
        </div>
      `).join('') : '<div class="text-sm text-gray text-center" style="padding:12px">点击查看最新资讯</div>'}
    </div>
  `;
}
