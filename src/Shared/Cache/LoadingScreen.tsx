/**
 * LoadingScreen.tsx
 * Красивый PWA экран загрузки с прогрессом по категориям.
 * Показывается при первом запуске или если ассеты не кэшированы.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ASSET_MANIFEST, getCategorySummary, getTotalSize, CATEGORY_LABELS, AssetCategory } from './assetManifest';
import { cacheManager } from './cacheManager';
import { preloadManager, OverallProgress, CategoryProgress } from './preloadManager';

interface LoadingScreenProps {
  onPlay: () => void;
}

interface CacheInfo {
  cached: number;
  missing: number;
  cachedBytes: number;
  missingBytes: number;
  totalBytes: number;
  isChecking: boolean;
  isFullyCached: boolean;
}

const ICON: Record<AssetCategory, string> = {
  characters: '👤',
  rooms:      '🏠',
  animations: '🎬',
  textures:   '🖼',
  audio:      '🔊',
  system:     '⚙️',
};

function formatBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

function formatTime(s: number): string {
  if (s < 60)  return `~${Math.round(s)}с`;
  return `~${Math.floor(s / 60)}м ${Math.round(s % 60)}с`;
}

// ─────────────────────────────────────────────────────────────────────────────

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onPlay }) => {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({
    cached: 0, missing: 0, cachedBytes: 0, missingBytes: 0,
    totalBytes: getTotalSize(), isChecking: true, isFullyCached: false,
  });
  const [progress, setProgress]       = useState<OverallProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const categorySummary               = getCategorySummary();

  // ── Проверяем кэш при монтировании ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await cacheManager.registerServiceWorker();
      const status = await preloadManager.checkCacheStatus();
      if (cancelled) return;
      setCacheInfo({
        cached:      status.cached.length,
        missing:     status.missing.length,
        cachedBytes: status.cachedBytes,
        missingBytes: status.missingBytes,
        totalBytes:   getTotalSize(),
        isChecking:   false,
        isFullyCached: status.missing.length === 0,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Подписка на прогресс ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = preloadManager.onProgress(setProgress);
    return unsub;
  }, []);

  // ── Скачать всё ──────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    await preloadManager.downloadAll(ASSET_MANIFEST, () => {
      setCacheInfo(ci => ({ ...ci, isFullyCached: true, missing: 0 }));
      setIsDownloading(false);
    });
  }, []);

  // ── Запуск без скачивания ────────────────────────────────────────────────
  const handlePlayNow = useCallback(() => {
    // Запускаем фоновую загрузку через 3 сек после старта игры
    preloadManager.backgroundLoad(3000);
    onPlay();
  }, [onPlay]);

  // ── Прогресс в процентах ─────────────────────────────────────────────────
  const pct = progress ? Math.round(progress.progress * 100) : 0;
  const totalMB = formatBytes(cacheInfo.totalBytes);
  const missingMB = formatBytes(cacheInfo.missingBytes);
  const cachedMB = formatBytes(cacheInfo.cachedBytes);

  return (
    <div style={styles.overlay}>
      {/* ── BACKGROUND ── */}
      <div style={styles.bg} />

      {/* ── CARD ── */}
      <div style={styles.card}>
        {/* Title */}
        <div style={styles.titleRow}>
          <span style={styles.emoji}>🏠</span>
          <div>
            <h1 style={styles.title}>Cozy House</h1>
            <p style={styles.subtitle}>3D Interactive Experience</p>
          </div>
        </div>

        {cacheInfo.isChecking ? (
          /* ── CHECKING ── */
          <div style={styles.checking}>
            <div style={styles.spinner} />
            <p style={styles.checkingText}>Проверка локального кэша...</p>
          </div>
        ) : isDownloading ? (
          /* ── DOWNLOADING ── */
          <div style={styles.downloadSection}>
            <div style={styles.progressHeader}>
              <span style={styles.progressLabel}>
                {progress?.currentFile || 'Загрузка...'}
              </span>
              <span style={styles.progressPct}>{pct}%</span>
            </div>

            {/* Main progress bar */}
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${pct}%` }} />
            </div>

            {/* Stats row */}
            <div style={styles.statsRow}>
              <span style={styles.statText}>
                {progress ? formatBytes(progress.loadedBytes) : '0'} / {totalMB}
              </span>
              {progress?.speed && (
                <span style={styles.statText}>{formatSpeed(progress.speed)}</span>
              )}
              {progress?.estimatedSeconds && progress.estimatedSeconds < 300 && (
                <span style={styles.statText}>{formatTime(progress.estimatedSeconds)}</span>
              )}
            </div>

            {/* Per-category progress */}
            {progress?.byCategory?.map(cat => (
              <CategoryBar key={cat.category} cat={cat} />
            ))}

            {progress?.phase === 'complete' && (
              <div style={styles.completeRow}>
                <span style={styles.completeText}>✅ Ассеты загружены! Запускаем...</span>
              </div>
            )}
          </div>
        ) : (
          /* ── READY / PARTIAL ── */
          <div>
            {/* Cache status */}
            <div style={styles.statusCard}>
              {cacheInfo.isFullyCached ? (
                <div style={styles.statusFull}>
                  <span style={{ fontSize: 28 }}>⚡</span>
                  <div>
                    <div style={styles.statusTitle}>Быстрый запуск готов</div>
                    <div style={styles.statusSub}>
                      {formatBytes(cacheInfo.cachedBytes)} сохранено локально
                    </div>
                  </div>
                </div>
              ) : (
                <div style={styles.statusPartial}>
                  <span style={{ fontSize: 28 }}>📥</span>
                  <div>
                    <div style={styles.statusTitle}>
                      {cacheInfo.cached > 0 ? 'Частично загружено' : 'Не загружено'}
                    </div>
                    <div style={styles.statusSub}>
                      {cacheInfo.cached > 0
                        ? `${cachedMB} из ${totalMB} в кэше`
                        : `${totalMB} будет загружено`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Categories breakdown */}
            <button
              style={styles.detailsToggle}
              onClick={() => setShowDetails(d => !d)}
            >
              {showDetails ? '▲' : '▼'} Детали ({ASSET_MANIFEST.length} файлов)
            </button>

            {showDetails && (
              <div style={styles.categoriesList}>
                {categorySummary.map(({ category, label, count, totalSize }) => (
                  <div key={category} style={styles.categoryRow}>
                    <span style={styles.catIcon}>{ICON[category]}</span>
                    <span style={styles.catLabel}>{label}</span>
                    <span style={styles.catCount}>{count} файлов</span>
                    <span style={styles.catSize}>{formatBytes(totalSize)}</span>
                  </div>
                ))}
                <div style={styles.totalRow}>
                  <span>📦 Итого</span>
                  <span>{ASSET_MANIFEST.length} файлов</span>
                  <span>{totalMB}</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={styles.buttonsRow}>
              {!cacheInfo.isFullyCached && (
                <button style={styles.btnDownload} onClick={handleDownload}>
                  📥 Скачать для быстрого запуска
                  <span style={styles.btnSub}>{missingMB}</span>
                </button>
              )}
              <button
                style={cacheInfo.isFullyCached ? styles.btnPlayFull : styles.btnPlay}
                onClick={cacheInfo.isFullyCached ? onPlay : handlePlayNow}
              >
                {cacheInfo.isFullyCached ? '⚡ Запустить' : '▶ Играть без загрузки'}
                {!cacheInfo.isFullyCached && (
                  <span style={styles.btnSub}>загрузка во время игры</span>
                )}
              </button>
            </div>

            {/* PWA hint */}
            {!cacheInfo.isFullyCached && (
              <p style={styles.hint}>
                💡 После первой загрузки игра работает офлайн
              </p>
            )}
          </div>
        )}
      </div>

      {/* Version */}
      <div style={styles.version}>v1.0 · PWA · Three.js</div>
    </div>
  );
};

// ── Category progress bar ─────────────────────────────────────────────────

const CategoryBar: React.FC<{ cat: CategoryProgress }> = ({ cat }) => {
  const pct = cat.totalBytes > 0 ? (cat.bytes / cat.totalBytes) * 100 : 0;
  return (
    <div style={styles.catBarRow}>
      <span style={styles.catBarLabel}>
        {ICON[cat.category]} {CATEGORY_LABELS[cat.category]}
      </span>
      <div style={styles.catBarTrack}>
        <div style={{ ...styles.catBarFill, width: `${pct}%` }} />
      </div>
      <span style={styles.catBarPct}>{cat.loaded}/{cat.total}</span>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: '16px',
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 40%, #16213e 100%)',
    zIndex: -1,
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '32px',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
  },
  titleRow: {
    display: 'flex', alignItems: 'center', gap: '16px',
    marginBottom: '28px',
  },
  emoji: { fontSize: '48px', lineHeight: 1 },
  title: {
    margin: 0, fontSize: '28px', fontWeight: 700,
    color: '#ffffff', letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: '4px 0 0', fontSize: '13px',
    color: 'rgba(255,255,255,0.45)',
  },
  checking: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '16px', padding: '24px 0',
  },
  spinner: {
    width: '40px', height: '40px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid #7c6af7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  checkingText: { color: 'rgba(255,255,255,0.5)', margin: 0 },
  downloadSection: { display: 'flex', flexDirection: 'column', gap: '10px' },
  progressHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  progressLabel: { color: 'rgba(255,255,255,0.7)', fontSize: '13px' },
  progressPct: { color: '#7c6af7', fontWeight: 700, fontSize: '20px' },
  progressTrack: {
    height: '8px', background: 'rgba(255,255,255,0.08)',
    borderRadius: '4px', overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #7c6af7, #a78bfa)',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
    boxShadow: '0 0 12px rgba(124,106,247,0.6)',
  },
  statsRow: {
    display: 'flex', gap: '16px', flexWrap: 'wrap',
  },
  statText: { color: 'rgba(255,255,255,0.4)', fontSize: '12px' },
  catBarRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '4px 0',
  },
  catBarLabel: { color: 'rgba(255,255,255,0.6)', fontSize: '12px', width: '130px' },
  catBarTrack: {
    flex: 1, height: '4px',
    background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #7c6af7, #a78bfa)',
    borderRadius: '2px', transition: 'width 0.3s',
  },
  catBarPct: { color: 'rgba(255,255,255,0.35)', fontSize: '11px', width: '36px', textAlign: 'right' },
  completeRow: {
    textAlign: 'center', padding: '12px',
    background: 'rgba(124,106,247,0.15)', borderRadius: '8px',
  },
  completeText: { color: '#a78bfa', fontWeight: 600 },
  statusCard: {
    padding: '16px', borderRadius: '12px',
    marginBottom: '16px',
  },
  statusFull: {
    display: 'flex', alignItems: 'center', gap: '14px',
    background: 'rgba(52,211,153,0.1)', borderRadius: '10px', padding: '14px',
  },
  statusPartial: {
    display: 'flex', alignItems: 'center', gap: '14px',
    background: 'rgba(124,106,247,0.1)', borderRadius: '10px', padding: '14px',
  },
  statusTitle: { color: '#ffffff', fontWeight: 600, fontSize: '15px' },
  statusSub: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' },
  detailsToggle: {
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.35)', fontSize: '12px',
    cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'left',
    marginBottom: '8px',
  },
  categoriesList: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    padding: '12px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    marginBottom: '20px',
  },
  categoryRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '13px', color: 'rgba(255,255,255,0.6)',
  },
  catIcon: { fontSize: '16px', width: '24px' },
  catLabel: { flex: 1 },
  catCount: { color: 'rgba(255,255,255,0.3)', fontSize: '12px' },
  catSize: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', width: '60px', textAlign: 'right' },
  totalRow: {
    display: 'flex', gap: '8px', justifyContent: 'space-between',
    paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)',
    color: '#ffffff', fontWeight: 600, fontSize: '13px',
  },
  buttonsRow: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' },
  btnDownload: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '2px',
    padding: '16px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #7c6af7, #a78bfa)',
    border: 'none', color: '#fff', fontSize: '15px', fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 8px 24px rgba(124,106,247,0.4)',
    transition: 'opacity 0.2s, transform 0.2s',
  },
  btnPlay: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    padding: '14px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', transition: 'opacity 0.2s',
  },
  btnPlayFull: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    padding: '16px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #34d399, #10b981)',
    border: 'none', color: '#fff', fontSize: '16px', fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 8px 24px rgba(52,211,153,0.4)',
    transition: 'opacity 0.2s, transform 0.2s',
  },
  btnSub: {
    fontSize: '11px', fontWeight: 400,
    opacity: 0.75,
  },
  hint: {
    textAlign: 'center', color: 'rgba(255,255,255,0.3)',
    fontSize: '12px', marginTop: '12px',
  },
  version: {
    position: 'fixed', bottom: '12px',
    color: 'rgba(255,255,255,0.2)', fontSize: '11px',
  },
};

// ── CSS animation (injected once) ─────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('ls-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'ls-spinner-style';
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
