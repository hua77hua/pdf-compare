// 離線快取外殼：第二次起開頁直接從手機快取秒開，不用等伺服器（PythonAnywhere 每個請求約 1 秒）。
// 首頁 HTML 採「先給舊的、背景更新」；有新版時通知頁面自動重新載入一次。API 一律走網路。
const CACHE = 'tk-shell-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add('/')).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  // 首頁：有快取就立刻回，同時背景抓新的；內容不同就通知頁面
  if (req.mode === 'navigate' || url.pathname === '/') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('/');
      const refresh = fetch('/', { cache: 'no-store' }).then(async res => {
        if (res.ok) {
          const fresh = res.clone();
          let changed = false;
          if (cached) changed = (await cached.clone().text()) !== (await res.clone().text());
          await cache.put('/', fresh);                       // 先寫入快取，再通知頁面重新載入
          if (changed) (await self.clients.matchAll()).forEach(c => c.postMessage('updated'));
        }
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(refresh); return cached; }
      return (await refresh) || Response.error();
    })());
    return;
  }

  // JS / CSS / 圖示：網址帶版本號，快取優先
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
