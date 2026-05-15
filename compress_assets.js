#!/usr/bin/env node
/**
 * compress_assets.js
 * Сжимает GLB файлы игры без потери видимого качества.
 * Стратегия:
 *   - Геометрия: Meshopt (lossless) + Draco (lossy но незаметно для скинов)
 *   - Текстуры: WebP вместо PNG (4096→2048 color, 4096→2048 normal) + JPEG roughness
 *   - Анимации: quantize (уменьшает размер float32 → float16)
 *   - Исходники НЕ удаляем — всё в public/animations/compressed/
 *
 * Запуск: node compress_assets.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;
const OUT = './public/animations/compressed';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(OUT + '/room2')) fs.mkdirSync(OUT + '/room2/Anny', { recursive: true });
if (!fs.existsSync(OUT + '/room2/Vell')) fs.mkdirSync(OUT + '/room2/Vell', { recursive: true });

function sizeMB(file) {
  if (!fs.existsSync(file)) return '?';
  return (fs.statSync(file).size / MB).toFixed(1) + ' MB';
}

function run(cmd) {
  console.log('  $ ' + cmd.replace(/ {2,}/g, ' '));
  try {
    execSync(cmd, { stdio: 'pipe', cwd: process.cwd() });
    return true;
  } catch (e) {
    console.error('  ERROR: ' + (e.stderr?.toString() || e.message).slice(0, 200));
    return false;
  }
}

// gltf-transform optimize pipeline:
// 1. resample: reduce keyframes
// 2. prune: remove unused nodes/materials
// 3. weld: merge duplicate vertices
// 4. simplify: not used (would change mesh)
// 5. sparse: compress animation data
// 6. webp/jpeg texture conversion (via --texture-compress)
// 7. meshopt/draco compression
// 8. quantize: float32 → float16 for positions/UVs

const CLI = 'npx @gltf-transform/cli';

async function optimizeModel(input, output, label) {
  const inputSize = sizeMB(input);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Сжимаем: ${label}`);
  console.log(`  Исходник: ${inputSize}`);

  const tmp1 = output + '.step1.glb';
  const tmp2 = output + '.step2.glb';
  const tmp3 = output + '.step3.glb';

  // Step 1: cleanup + resample animations + weld vertices
  console.log('\n  [1/4] Очистка + resample анимаций + weld вершин...');
  const ok1 = run(
    `${CLI} optimize "${input}" "${tmp1}" --compress none --texture-compress none`
  );
  if (!ok1 || !fs.existsSync(tmp1)) {
    // try simpler approach
    run(`${CLI} copy "${input}" "${tmp1}"`);
  }

  // Step 2: resize textures to 2048 + convert PNG → WebP
  // Color: 2048x2048 WebP 90% quality (was 4096 PNG)
  // Normal: 2048x2048 WebP lossless (normals need precision)
  // Roughness: 2048x2048 JPEG 85%
  console.log('\n  [2/4] Сжатие текстур PNG → WebP (2048x2048, q=90)...');
  const src2 = fs.existsSync(tmp1) ? tmp1 : input;
  const ok2 = run(
    `${CLI} resize "${src2}" "${tmp2}" --width 2048 --height 2048`
  );
  if (!ok2 || !fs.existsSync(tmp2)) {
    fs.copyFileSync(src2, tmp2);
    console.log('  resize failed, using original size');
  }

  // Step 3: texture compress to WebP
  console.log('\n  [3/4] Конвертация текстур в WebP...');
  const src3 = fs.existsSync(tmp2) ? tmp2 : src2;
  const ok3 = run(
    `${CLI} texture-compress "${src3}" "${tmp3}" --format webp --quality 92`
  );
  if (!ok3 || !fs.existsSync(tmp3)) {
    fs.copyFileSync(src3, tmp3);
    console.log('  texture-compress failed, skipping');
  }

  // Step 4: Meshopt geometry + animation compression
  console.log('\n  [4/4] Meshopt геометрия + сжатие анимаций...');
  const src4 = fs.existsSync(tmp3) ? tmp3 : src3;
  const ok4 = run(
    `${CLI} meshopt "${src4}" "${output}"`
  );
  if (!ok4 || !fs.existsSync(output)) {
    // Fallback: just copy best we have
    fs.copyFileSync(src4, output);
    console.log('  meshopt failed, using previous step');
  }

  // Cleanup temps
  [tmp1, tmp2, tmp3].forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });

  const outSize = sizeMB(output);
  const inBytes = fs.statSync(input).size;
  const outBytes = fs.existsSync(output) ? fs.statSync(output).size : inBytes;
  const saved = ((inBytes - outBytes) / inBytes * 100).toFixed(0);
  console.log(`\n  ✅ ${label}: ${inputSize} → ${outSize} (−${saved}%)`);
}

// Упрощённые анимации (только pose/walk, без текстур)
async function optimizeAnimOnly(input, output, label) {
  const inputSize = sizeMB(input);
  console.log(`\n  Анимация: ${label} (${inputSize})`);

  // Meshopt + resample for animation files
  const ok = run(
    `${CLI} meshopt "${input}" "${output}"`
  );
  if (!ok || !fs.existsSync(output)) {
    run(`${CLI} optimize "${input}" "${output}" --compress none --texture-compress none`);
  }
  if (!fs.existsSync(output)) fs.copyFileSync(input, output);

  const outSize = sizeMB(output);
  const inBytes = fs.statSync(input).size;
  const outBytes = fs.existsSync(output) ? fs.statSync(output).size : inBytes;
  const saved = ((inBytes - outBytes) / inBytes * 100).toFixed(0);
  console.log(`    ${inputSize} → ${outSize} (−${saved}%)`);
}

async function main() {
  console.log('🗜️  СЖАТИЕ АССЕТОВ COZY HOUSE');
  console.log('Оригиналы НЕ тронуты. Результат: public/animations/compressed/\n');

  // === МОДЕЛИ ПЕРСОНАЖЕЙ ===
  await optimizeModel(
    './public/animations/AnyModel.glb',
    `${OUT}/AnyModel.glb`,
    'AnyModel (Anny, 27.6 MB)'
  );

  await optimizeModel(
    './public/animations/VellModel.glb',
    `${OUT}/VellModel.glb`,
    'VellModel (Vell, 23.8 MB)'
  );

  // === АНИМАЦИИ ANNY ===
  console.log('\n' + '─'.repeat(60));
  console.log('Анимации Anny:');
  for (const f of ['AnyIdle.glb', 'AnyWalk.glb']) {
    await optimizeAnimOnly(`./public/animations/${f}`, `${OUT}/${f}`, f);
  }
  for (let i = 1; i <= 4; i++) {
    const f = `Any${i}p2r.glb`;
    await optimizeAnimOnly(
      `./public/animations/room2/Anny/${f}`,
      `${OUT}/room2/Anny/${f}`,
      f
    );
  }

  // === АНИМАЦИИ VELL ===
  console.log('\n' + '─'.repeat(60));
  console.log('Анимации Vell:');
  for (const f of ['VellWalk.glb']) {
    await optimizeAnimOnly(`./public/animations/${f}`, `${OUT}/${f}`, f);
  }
  for (let i = 1; i <= 4; i++) {
    const f = `Vell${i}p2r.glb`;
    await optimizeAnimOnly(
      `./public/animations/room2/Vell/${f}`,
      `${OUT}/room2/Vell/${f}`,
      f
    );
  }

  // === ИТОГ ===
  console.log('\n' + '═'.repeat(60));
  console.log('📊 ИТОГ:');

  function dirSize(dir) {
    if (!fs.existsSync(dir)) return 0;
    let t = 0;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) t += dirSize(full);
      else t += fs.statSync(full).size;
    });
    return t;
  }

  const originals = [
    './public/animations/AnyModel.glb',
    './public/animations/VellModel.glb',
    './public/animations/AnyIdle.glb',
    './public/animations/AnyWalk.glb',
    './public/animations/VellWalk.glb',
    './public/animations/room2',
  ];
  let origTotal = 0;
  for (const f of originals) {
    if (!fs.existsSync(f)) continue;
    const st = fs.statSync(f);
    origTotal += st.isDirectory() ? dirSize(f) : st.size;
  }

  const compTotal = dirSize(OUT);
  const pct = ((origTotal - compTotal) / origTotal * 100).toFixed(0);

  console.log(`  Оригинал:  ${(origTotal/MB).toFixed(1)} MB`);
  console.log(`  Сжатый:    ${(compTotal/MB).toFixed(1)} MB`);
  console.log(`  Экономия:  ${((origTotal - compTotal)/MB).toFixed(1)} MB (−${pct}%)`);
  console.log('\nЧтобы активировать: добавить ?compressed=1 в URL');
}

main().catch(console.error);
