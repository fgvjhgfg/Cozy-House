// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Cozy House — Service Worker v1                                       ║
// ║  Стратегия: Cache-First для GLB/текстур, Network-First для HTML/JS   ║
// ╚══════════════════════════════════════════════════════════════════════╝

const CACHE_VERSION = 'cozy-house-v1';
const ASSET_CACHE   = `${CACHE_VERSION}-assets`;
const APP_CACHE     = `${CACHE_VERSION}-app`;

// ── Ассеты которые кэшируем сразу при install ────────────────────────────
const PRECACHE_APP = [
  '/',
  '/index.html',
  '/basis/basis_transcoder.js',
  '/basis/basis_transcoder.wasm',
];

// ── Ассеты кэшируемые по запросу (Cache-First) ───────────────────────────
const CACHEABLE_EXTENSIONS = [
  '.glb', '.gltf', '.bin',          // 3D модели
  '.ktx2', '.basis',                 // GPU текстуры
  '.webp', '.avif', '.png', '.jpg',  // Изображения
  '.mp3', '.ogg', '.wav',            // Аудио
  '.wasm',                           // WebAssembly
];

function isCacheable(url) {
  const u = new URL(url);
  return CACHEABLE_EXTENSIONS.some(ext => u.pathname.endsWith(ext));
}

function isAppShell(url) {
  const u = new URL(url);
  return u.pathname === '/' || u.pathname.endsWith('.html') ||
    u.pathname.endsWith('.js') || u.pathname.endsWith('.css');
}

// ── INSTALL ──────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing', CACHE_VERSION);
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(PRECACHE_APP))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Precache failed:', err))
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !key.startsWith(CACHE_VERSION))
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Игнорируем не-GET и cross-origin
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  // Игнорируем dev-server HMR и vite
  if (request.url.includes('/@') || request.url.includes('/__vite')) return;

  if (isCacheable(request.url)) {
    // Cache-First: GLB / текстуры / аудио
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  } else if (isAppShell(request.url)) {
    // Network-First: HTML / JS / CSS (чтобы обновления применялись)
    event.respondWith(networkFirst(request, APP_CACHE));
  }
});

// ── CACHE-FIRST стратегия ────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  if (cached) {
    // console.log('[SW] Cache hit:', request.url.split('/').pop());
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()); // фоновое сохранение
    }
    return response;
  } catch (err) {
    console.warn('[SW] Fetch failed (offline?):', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// ── NETWORK-FIRST стратегия ──────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── MESSAGE HANDLER ──────────────────────────────────────────────────────
// Получаем команды от основного треда
self.addEventListener('message', async event => {
  const { type, payload } = event.data || {};

  if (type === 'CACHE_ASSETS') {
    // Кэшируем список URL переданных из PreloadManager
    const { urls } = payload;
    const cache = await caches.open(ASSET_CACHE);
    let cached = 0, failed = 0;

    for (const url of urls) {
      try {
        const existing = await cache.match(url);
        if (existing) { cached++; continue; }
        const response = await fetch(url);
        if (response.ok) { await cache.put(url, response); cached++; }
        else { failed++; }
      } catch { failed++; }

      // Отправляем прогресс
      event.source?.postMessage({
        type: 'CACHE_PROGRESS',
        payload: { cached, total: urls.length, failed }
      });
    }

    event.source?.postMessage({
      type: 'CACHE_COMPLETE',
      payload: { cached, failed, total: urls.length }
    });
  }

  if (type === 'GET_CACHE_SIZE') {
    const size = await getCacheSize();
    event.source?.postMessage({ type: 'CACHE_SIZE', payload: { size } });
  }

  if (type === 'CLEAR_ASSET_CACHE') {
    await caches.delete(ASSET_CACHE);
    event.source?.postMessage({ type: 'CACHE_CLEARED' });
  }

  if (type === 'CHECK_CACHED') {
    const { urls } = payload;
    const cache = await caches.open(ASSET_CACHE);
    const results = await Promise.all(
      urls.map(async url => ({
        url,
        cached: !!(await cache.match(url))
      }))
    );
    event.source?.postMessage({ type: 'CACHED_STATUS', payload: { results } });
  }
});

// ── Утилиты ─────────────────────────────────────────────────────────────
async function getCacheSize() {
  let total = 0;
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys  = await cache.keys();
    for (const req of keys) {
      const res = await cache.match(req);
      if (res) {
        const buf = await res.clone().arrayBuffer();
        total += buf.byteLength;
      }
    }
  }
  return total;
}
