// ============================================================
// sw.js - Service Worker（离线缓存）
// ============================================================

const CACHE_NAME = 'workbuddy-v15';
const CACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/ai.js',
  './js/news.js',
  './js/modules/work.js',
  './js/modules/weight.js',
  './js/modules/finance.js',
  './js/modules/english.js',
  './js/modules/pingpong.js',
  './manifest.json',
];

// 安装：预缓存核心资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch(err => {
        console.log('部分资源缓存失败（不影响使用）:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：缓存优先，网络后备
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 只处理同源请求和 CDN
  if (url.origin === location.origin || url.hostname.includes('cdn')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          // 缓存新资源
          if (response && response.status === 200 && e.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => {
          // 离线后备
          if (e.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
