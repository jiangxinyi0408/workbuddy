// ============================================================
// sw.js - Service Worker（离线缓存）
// 策略：网络优先，离线回退缓存
// ============================================================

const CACHE_NAME = 'workbuddy-v18';
const CACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/sync.js',
  './js/backup.js',
  './js/ai.js',
  './js/news.js',
  './js/modules/work.js',
  './js/modules/weight.js',
  './js/modules/finance.js',
  './js/modules/english.js',
  './js/modules/pingpong.js',
  './js/modules/auth.js',
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

// 接收消息：跳过等待
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 激活：清理旧缓存，立即接管
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
  // 通知所有客户端刷新
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_UPDATED' });
    });
  });
});

// 请求拦截：网络优先，离线回退
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 只处理同源 GET 请求
  if (url.origin === location.origin && e.request.method === 'GET') {
    e.respondWith(
      fetch(e.request).then((response) => {
        // 网络成功：缓存一份，返回响应
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // 网络失败：回退缓存
        return caches.match(e.request).then((cached) => {
          if (cached) return cached;
          // 最终回退
          if (e.request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
    );
  }
});
