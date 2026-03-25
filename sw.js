/* MJ 狙擊手 v8.5 PWA — Service Worker v2.0
   修復：Yahoo Finance 請求不走 SW 快取，直接穿透
   避免 networkFirst 快取過期返回 {"error":"offline"}
*/
const CACHE_VER   = 'mj-dashboard-v8.5-3.0'; // 強制更新
const SHELL_CACHE = CACHE_VER + '-shell';

// App Shell — 只快取本地靜態資源
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 金融數據域名 — 完全不快取，直接穿透（避免離線錯誤污染數據）
const BYPASS_DOMAINS = [
  'yahoo.com',
  'finance.yahoo.com',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'finnhub.io',
  'alphavantage.co',
  'corsproxy.io',
  'allorigins.win',
  'codetabs.com',
];

self.addEventListener('install', e => {
  console.log('[SW v2] Installing:', CACHE_VER);
  e.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      Promise.allSettled(SHELL_URLS.map(url =>
        cache.add(url).catch(err => console.warn('[SW] cache miss:', url))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  console.log('[SW v2] Activating:', CACHE_VER);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // 金融數據和 CORS 代理 → 完全穿透，不快取不攔截
  if(BYPASS_DOMAINS.some(d => url.hostname.includes(d))){
    return; // 讓瀏覽器直接處理
  }

  // Google Fonts / CDN → Cache First
  if(url.hostname.includes('fonts.google') ||
     url.hostname.includes('fonts.gstatic') ||
     url.hostname.includes('unpkg.com')){
    e.respondWith(cacheFirst(e.request));
    return;
  }

  // 本地 HTML/JS/JSON/圖示 → Cache First（App Shell）
  if(url.pathname.endsWith('.html') ||
     url.pathname.endsWith('.json') ||
     url.pathname.endsWith('.png')  ||
     url.pathname.endsWith('.svg')  ||
     url.pathname === '/'){
    e.respondWith(cacheFirst(e.request));
    return;
  }
  // 其他請求直接穿透
});

async function cacheFirst(req){
  const cache  = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req);
  if(cached) return cached;
  try{
    const res = await fetch(req);
    if(res.ok) cache.put(req, res.clone());
    return res;
  }catch(e){
    return new Response('<!-- offline -->', { headers:{'Content-Type':'text/html'} });
  }
}

self.addEventListener('message', e => {
  if(e.data === 'SKIP_WAITING') self.skipWaiting();
});
