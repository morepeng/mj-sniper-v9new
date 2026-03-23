/* MJ 狙擊手 v8.5 PWA — Service Worker v1.0 */
const CACHE_VER   = 'mj-dashboard-v8.5-1.0';
const SHELL_CACHE = CACHE_VER + '-shell';
const DATA_CACHE  = CACHE_VER + '-data';

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;700;900&display=swap',
];

const DATA_DOMAINS = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'finnhub.io',
  'www.alphavantage.co',
  'api.allorigins.win',
  'corsproxy.io',
  'api.codetabs.com',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      Promise.allSettled(SHELL_URLS.map(url =>
        cache.add(url).catch(err => console.warn('[SW] cache miss:', url))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== DATA_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET') return;

  if(DATA_DOMAINS.some(d => url.hostname.includes(d))){
    e.respondWith(networkFirst(e.request, DATA_CACHE, 12000));
    return;
  }
  if(url.pathname.endsWith('.html') || url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.json')|| url.pathname.endsWith('.png') ||
     url.pathname === '/'){
    e.respondWith(cacheFirst(e.request, SHELL_CACHE));
    return;
  }
  if(url.hostname.includes('fonts.google') || url.hostname.includes('fonts.gstatic')){
    e.respondWith(cacheFirst(e.request, SHELL_CACHE));
    return;
  }
});

async function networkFirst(req, cacheName, ms=10000){
  const cache = await caches.open(cacheName);
  try{
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), ms);
    const res = await fetch(req, {signal:ctrl.signal});
    clearTimeout(t);
    if(res.ok) cache.put(req, res.clone());
    return res;
  }catch(e){
    const cached = await cache.match(req);
    if(cached) return cached;
    return new Response(JSON.stringify({error:'offline'}),{headers:{'Content-Type':'application/json'}});
  }
}

async function cacheFirst(req, cacheName){
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req);
  if(cached) return cached;
  try{
    const res = await fetch(req);
    if(res.ok) cache.put(req, res.clone());
    return res;
  }catch(e){
    return new Response('<!-- offline -->',{headers:{'Content-Type':'text/html'}});
  }
}

self.addEventListener('message', e => {
  if(e.data === 'SKIP_WAITING') self.skipWaiting();
});
