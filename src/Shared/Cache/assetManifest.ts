/**
 * assetManifest.ts
 * Централизованный реестр всех игровых ассетов.
 * Каждый ассет имеет категорию, размер (в байтах) и приоритет загрузки.
 */

export type AssetCategory = 'characters' | 'rooms' | 'animations' | 'textures' | 'audio' | 'system';
export type AssetPriority = 'critical' | 'high' | 'normal' | 'lazy';

export interface AssetEntry {
  url: string;
  category: AssetCategory;
  priority: AssetPriority;
  /** Примерный размер в байтах (для прогресс-бара) */
  size: number;
  /** К какой комнате относится (undefined = глобальный) */
  room?: 'Room1Scene' | 'Room2Scene' | 'Room3Scene';
  label?: string;
}

// ── BASE PATH ──────────────────────────────────────────────────────────────
// Сжатые ассеты (KTX2/WebP pipeline)
const A = '/animations/ktx2';  // compressed models/anims
const O = '/animations';        // originals (fallback)

// ── ASSET MANIFEST ────────────────────────────────────────────────────────
export const ASSET_MANIFEST: AssetEntry[] = [

  // ── System (Basis Transcoder WASM) ──
  {
    url: '/basis/basis_transcoder.js',
    category: 'system',
    priority: 'critical',
    size: 62_000,
    label: 'KTX2 Decoder JS',
  },
  {
    url: '/basis/basis_transcoder.wasm',
    category: 'system',
    priority: 'critical',
    size: 499_000,
    label: 'KTX2 Decoder WASM',
  },

  // ── Rooms ──
  {
    url: '/animations/room4.glb',
    category: 'rooms',
    priority: 'critical',
    size: 15_440_000,
    room: 'Room2Scene',
    label: 'Комната 2 (geometry)',
  },
  {
    url: '/animations/room3.glb',
    category: 'rooms',
    priority: 'lazy',
    size: 12_591_000,
    room: 'Room3Scene',
    label: 'Комната 3 (geometry)',
  },

  // ── Characters (Room 2) ──
  {
    url: `${A}/AnyModel.glb`,
    category: 'characters',
    priority: 'critical',
    size: 3_200_000,
    room: 'Room2Scene',
    label: 'Anny (модель)',
  },
  {
    url: `${A}/VellModel.glb`,
    category: 'characters',
    priority: 'critical',
    size: 2_800_000,
    room: 'Room2Scene',
    label: 'Vell (модель)',
  },

  // ── Animations (Room 2) ──
  {
    url: `${A}/AnyIdle.glb`,
    category: 'animations',
    priority: 'high',
    size: 70_000,
    room: 'Room2Scene',
    label: 'Anny idle',
  },
  {
    url: `${A}/AnyWalk.glb`,
    category: 'animations',
    priority: 'high',
    size: 100_000,
    room: 'Room2Scene',
    label: 'Anny walk',
  },
  {
    url: `${A}/VellWalk.glb`,
    category: 'animations',
    priority: 'high',
    size: 200_000,
    room: 'Room2Scene',
    label: 'Vell walk',
  },
  {
    url: `${A}/room2/Anny/Any1p2r.glb`,
    category: 'animations',
    priority: 'normal',
    size: 200_000,
    room: 'Room2Scene',
    label: 'Поза 1',
  },
  {
    url: `${A}/room2/Anny/Any2p2r.glb`,
    category: 'animations',
    priority: 'normal',
    size: 240_000,
    room: 'Room2Scene',
    label: 'Поза 2',
  },
  {
    url: `${A}/room2/Anny/Any3p2r.glb`,
    category: 'animations',
    priority: 'normal',
    size: 280_000,
    room: 'Room2Scene',
    label: 'Поза 3',
  },
  {
    url: `${A}/room2/Anny/Any4p2r.glb`,
    category: 'animations',
    priority: 'normal',
    size: 310_000,
    room: 'Room2Scene',
    label: 'Поза 4',
  },
  {
    url: `${A}/room2/Vell/Vell1p2r.glb`,
    category: 'animations',
    priority: 'normal',
    size: 27_000,
    room: 'Room2Scene',
    label: 'Vell поза 1',
  },
  {
    url: `${A}/room2/Vell/Vell2p2r.glb`,
    category: 'animations',
    priority: 'normal',
    size: 45_000,
    room: 'Room2Scene',
    label: 'Vell поза 2',
  },
  {
    url: `${A}/room2/Vell/Vell3p2r.glb`,
    category: 'animations',
    priority: 'normal',
    size: 62_000,
    room: 'Room2Scene',
    label: 'Vell поза 3',
  },
  {
    url: `${A}/room2/Vell/Vell4p2r.glb`,
    category: 'animations',
    priority: 'normal',
    size: 80_000,
    room: 'Room2Scene',
    label: 'Vell поза 4',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

/** Все ассеты определённой категории */
export function getByCategory(category: AssetCategory): AssetEntry[] {
  return ASSET_MANIFEST.filter(a => a.category === category);
}

/** Ассеты конкретной комнаты */
export function getByRoom(room: string): AssetEntry[] {
  return ASSET_MANIFEST.filter(a => !a.room || a.room === room);
}

/** Только критические + высокоприоритетные (первый батч) */
export function getCritical(): AssetEntry[] {
  return ASSET_MANIFEST.filter(a => a.priority === 'critical' || a.priority === 'high');
}

/** Общий размер ассетов (байты) */
export function getTotalSize(assets: AssetEntry[] = ASSET_MANIFEST): number {
  return assets.reduce((sum, a) => sum + a.size, 0);
}

/** Сводка по категориям */
export interface CategorySummary {
  category: AssetCategory;
  label: string;
  count: number;
  totalSize: number;
  assets: AssetEntry[];
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  characters: '👤 Персонажи',
  rooms:      '🏠 Комнаты',
  animations: '🎬 Анимации',
  textures:   '🖼 Текстуры',
  audio:      '🔊 Аудио',
  system:     '⚙️ Система',
};

export function getCategorySummary(): CategorySummary[] {
  const categories = [...new Set(ASSET_MANIFEST.map(a => a.category))];
  return categories.map(cat => {
    const assets = getByCategory(cat);
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      count: assets.length,
      totalSize: getTotalSize(assets),
      assets,
    };
  });
}
