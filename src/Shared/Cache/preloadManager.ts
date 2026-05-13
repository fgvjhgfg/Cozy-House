/**
 * preloadManager.ts
 * Управляет очередью загрузки с:
 *   - батчами по приоритету (critical → high → normal → lazy)
 *   - конкурентной загрузкой (N файлов одновременно)
 *   - отслеживанием прогресса по категориям
 *   - mobile-safe: ограничение памяти
 */

import { ASSET_MANIFEST, AssetEntry, AssetCategory, getTotalSize } from './assetManifest';
import { cacheManager } from './cacheManager';

export interface CategoryProgress {
  category: AssetCategory;
  total: number;
  loaded: number;
  bytes: number;
  totalBytes: number;
}

export interface OverallProgress {
  phase: 'checking' | 'downloading' | 'complete' | 'idle';
  totalFiles: number;
  loadedFiles: number;
  totalBytes: number;
  loadedBytes: number;
  /** 0–1 */
  progress: number;
  byCategory: CategoryProgress[];
  currentFile?: string;
  speed?: number;           // bytes/sec
  estimatedSeconds?: number;
}

export type ProgressCallback = (progress: OverallProgress) => void;
export type CompleteCallback = () => void;

// Сколько файлов качаем параллельно
const CONCURRENT_DOWNLOADS = 3;

class PreloadManager {
  private callbacks: ProgressCallback[] = [];
  private progress: OverallProgress = this.emptyProgress();
  private isRunning = false;

  private emptyProgress(): OverallProgress {
    return {
      phase: 'idle',
      totalFiles: 0,
      loadedFiles: 0,
      totalBytes: 0,
      loadedBytes: 0,
      progress: 0,
      byCategory: [],
    };
  }

  onProgress(cb: ProgressCallback): () => void {
    this.callbacks.push(cb);
    return () => { this.callbacks = this.callbacks.filter(c => c !== cb); };
  }

  private emit(update: Partial<OverallProgress>) {
    this.progress = { ...this.progress, ...update };
    this.callbacks.forEach(cb => cb(this.progress));
  }

  /** Возвращает текущий прогресс */
  getProgress(): OverallProgress { return this.progress; }

  /**
   * Проверяет что уже закэшировано и возвращает список некэшированных.
   */
  async checkCacheStatus(assets: AssetEntry[] = ASSET_MANIFEST): Promise<{
    cached: AssetEntry[];
    missing: AssetEntry[];
    cachedBytes: number;
    missingBytes: number;
  }> {
    this.emit({ phase: 'checking' });
    const urls = assets.map(a => a.url);
    const status = await cacheManager.checkCachedBatch(urls);

    const cached  = assets.filter(a => status.get(a.url));
    const missing = assets.filter(a => !status.get(a.url));

    return {
      cached,
      missing,
      cachedBytes: getTotalSize(cached),
      missingBytes: getTotalSize(missing),
    };
  }

  /**
   * Главный метод: скачивает и кэширует ассеты с прогрессом.
   * 
   * @param assets - список ассетов для загрузки (по умолчанию все)
   * @param onComplete - callback после завершения
   */
  async downloadAll(
    assets: AssetEntry[] = ASSET_MANIFEST,
    onComplete?: CompleteCallback
  ): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const totalBytes = getTotalSize(assets);
    const categories = [...new Set(assets.map(a => a.category))];
    const byCategory: CategoryProgress[] = categories.map(cat => ({
      category: cat,
      total: assets.filter(a => a.category === cat).length,
      loaded: 0,
      bytes: 0,
      totalBytes: getTotalSize(assets.filter(a => a.category === cat)),
    }));

    this.emit({
      phase: 'downloading',
      totalFiles: assets.length,
      loadedFiles: 0,
      totalBytes,
      loadedBytes: 0,
      progress: 0,
      byCategory,
    });

    // Сортируем по приоритету
    const priorityOrder = { critical: 0, high: 1, normal: 2, lazy: 3 };
    const sorted = [...assets].sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    let loadedBytes = 0;
    let loadedFiles = 0;
    let startTime   = Date.now();

    // Очередь с ограничением параллелизма
    const queue = [...sorted];
    const inFlight: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
      const asset = queue.shift();
      if (!asset) return;

      const catProgress = byCategory.find(c => c.category === asset.category)!;

      await cacheManager.fetchAndCache(
        asset.url,
        asset.size,
        (loaded, total) => {
          // Прогресс внутри файла (приближение)
        }
      );

      loadedBytes += asset.size;
      loadedFiles++;
      catProgress.loaded++;
      catProgress.bytes += asset.size;

      const elapsed = (Date.now() - startTime) / 1000;
      const speed   = elapsed > 0 ? loadedBytes / elapsed : 0;
      const remaining = totalBytes - loadedBytes;
      const estimatedSeconds = speed > 0 ? remaining / speed : undefined;

      this.emit({
        loadedFiles,
        loadedBytes,
        progress: totalBytes > 0 ? loadedBytes / totalBytes : 0,
        byCategory: [...byCategory],
        currentFile: asset.label || asset.url.split('/').pop(),
        speed,
        estimatedSeconds,
      });

      // Продолжаем очередь
      if (queue.length > 0) {
        await processNext();
      }
    };

    // Запускаем N параллельных воркеров
    for (let i = 0; i < Math.min(CONCURRENT_DOWNLOADS, sorted.length); i++) {
      inFlight.push(processNext());
    }

    await Promise.allSettled(inFlight);

    this.isRunning = false;
    this.emit({ phase: 'complete', progress: 1, loadedFiles: assets.length });
    onComplete?.();
  }

  /**
   * Быстрый старт: загружает только critical+high приоритет.
   * Остальное — фоном после запуска игры.
   */
  async preloadCritical(): Promise<void> {
    const critical = ASSET_MANIFEST.filter(
      a => a.priority === 'critical' || a.priority === 'high'
    );
    await this.downloadAll(critical);
  }

  /**
   * Фоновая загрузка оставшихся ассетов (после запуска игры).
   */
  async backgroundLoad(delay = 3000): Promise<void> {
    await new Promise(r => setTimeout(r, delay));
    const lazy = ASSET_MANIFEST.filter(
      a => a.priority === 'normal' || a.priority === 'lazy'
    );
    if (lazy.length === 0) return;
    const status = await this.checkCacheStatus(lazy);
    if (status.missing.length > 0) {
      console.log('[PreloadManager] Background loading', status.missing.length, 'assets...');
      await this.downloadAll(status.missing);
    }
  }

  /** Форматирует байты в читаемый вид */
  static formatBytes(bytes: number): string {
    if (bytes < 1024)             return `${bytes} B`;
    if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  /** Форматирует секунды */
  static formatTime(seconds: number): string {
    if (seconds < 60)  return `${Math.round(seconds)}с`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}м ${Math.round(seconds % 60)}с`;
    return `${Math.floor(seconds / 3600)}ч`;
  }
}

export const preloadManager = new PreloadManager();
