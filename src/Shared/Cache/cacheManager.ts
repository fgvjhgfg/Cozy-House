/**
 * cacheManager.ts
 * Управляет Cache API + IndexedDB для хранения больших бинарных ассетов.
 * 
 * Архитектура:
 *   - Cache API (sw.js)  → GLB/текстуры/аудио (через Service Worker)
 *   - IndexedDB          → метаданные, версии кэша, статусы
 */

const DB_NAME      = 'cozy-house-cache';
const DB_VERSION   = 1;
const META_STORE   = 'asset-meta';
const CACHE_VERSION = 'cozy-house-v1';
const ASSET_CACHE   = `${CACHE_VERSION}-assets`;

export interface AssetMeta {
  url: string;
  cachedAt: number;
  size: number;
  version: string;
}

// ── IndexedDB ─────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: 'url' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
    req.onsuccess  = e => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db!); };
    req.onerror    = e => reject((e.target as IDBOpenDBRequest).error);
  });
}

async function dbPut(meta: AssetMeta): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    store.put(meta).onsuccess = () => resolve();
    tx.onerror = e => reject((e.target as IDBTransaction).error);
  });
}

async function dbGet(url: string): Promise<AssetMeta | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(META_STORE, 'readonly');
    const req   = tx.objectStore(META_STORE).get(url);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject((e.target as IDBRequest).error);
  });
}

async function dbGetAll(): Promise<AssetMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject((e.target as IDBRequest).error);
  });
}

async function dbClear(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).clear().onsuccess = () => resolve();
    tx.onerror = e => reject((e.target as IDBTransaction).error);
  });
}

// ── Cache API wrapper ─────────────────────────────────────────────────────

class CacheManager {
  private swReady: boolean = false;

  /** Регистрирует Service Worker */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[CacheManager] Service Workers not supported');
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      this.swReady = true;
      console.log('[CacheManager] SW registered:', reg.scope);
      return reg;
    } catch (e) {
      console.error('[CacheManager] SW registration failed:', e);
      return null;
    }
  }

  /** Проверяет закэширован ли ассет */
  async isCached(url: string): Promise<boolean> {
    // Проверяем метаданные в IndexedDB
    const meta = await dbGet(url);
    if (!meta) return false;

    // Дополнительно проверяем Cache API если SW доступен
    if ('caches' in window) {
      try {
        const cache = await caches.open(ASSET_CACHE);
        const match = await cache.match(url);
        return !!match;
      } catch { return !!meta; }
    }
    return true;
  }

  /** Проверяет статус кэширования для списка URL */
  async checkCachedBatch(urls: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    if ('caches' in window) {
      try {
        const cache = await caches.open(ASSET_CACHE);
        await Promise.all(urls.map(async url => {
          const match = await cache.match(url);
          result.set(url, !!match);
        }));
        return result;
      } catch { /* fallback to IndexedDB */ }
    }
    // IndexedDB fallback
    await Promise.all(urls.map(async url => {
      const meta = await dbGet(url);
      result.set(url, !!meta);
    }));
    return result;
  }

  /**
   * Загружает и кэширует один ассет.
   * Возвращает Response который можно использовать или undefined при ошибке.
   */
  async fetchAndCache(
    url: string,
    size: number,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Response | null> {
    try {
      // Проверяем Cache API
      if ('caches' in window) {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(url);
        if (cached) {
          await dbPut({ url, cachedAt: Date.now(), size, version: CACHE_VERSION });
          return cached;
        }
      }

      // Загружаем с прогрессом
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Читаем тело с отслеживанием прогресса
      const contentLength = parseInt(response.headers.get('content-length') || '0') || size;
      const reader = response.body?.getReader();

      if (reader && onProgress) {
        const chunks: Uint8Array[] = [];
        let loaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          onProgress(loaded, contentLength);
        }
        // Пересобираем Response с телом
        const body = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
        let offset = 0;
        for (const c of chunks) { body.set(c, offset); offset += c.length; }

        const finalResponse = new Response(body, {
          status: response.status,
          headers: response.headers,
        });

        // Кэшируем
        if ('caches' in window) {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(url, finalResponse.clone());
        }
        await dbPut({ url, cachedAt: Date.now(), size: body.length, version: CACHE_VERSION });
        return finalResponse;
      }

      // Без прогресса — просто кэшируем
      if ('caches' in window) {
        const cache = await caches.open(ASSET_CACHE);
        await cache.put(url, response.clone());
      }
      await dbPut({ url, cachedAt: Date.now(), size, version: CACHE_VERSION });
      return response;

    } catch (e) {
      console.error('[CacheManager] Failed to fetch:', url, e);
      return null;
    }
  }

  /** Получает суммарный размер кэша (байты) */
  async getCacheSize(): Promise<number> {
    const metas = await dbGetAll();
    return metas.reduce((sum, m) => sum + m.size, 0);
  }

  /** Получает список всех закэшированных URL */
  async getCachedUrls(): Promise<string[]> {
    if ('caches' in window) {
      try {
        const cache = await caches.open(ASSET_CACHE);
        const keys  = await cache.keys();
        return keys.map(k => k.url);
      } catch { /* fallback */ }
    }
    const metas = await dbGetAll();
    return metas.map(m => m.url);
  }

  /** Очищает весь кэш */
  async clearCache(): Promise<void> {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    await dbClear();
    console.log('[CacheManager] Cache cleared');
  }

  /** Посылает команду в Service Worker */
  async postToSW(type: string, payload: any = {}): Promise<void> {
    const sw = navigator.serviceWorker?.controller;
    if (sw) {
      sw.postMessage({ type, payload });
    }
  }

  get isServiceWorkerActive(): boolean {
    return this.swReady && !!navigator.serviceWorker?.controller;
  }
}

export const cacheManager = new CacheManager();
