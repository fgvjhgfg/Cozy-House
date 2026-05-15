/**
 * compress_ktx2.js
 * Финальный этап сжатия: применяет WebP (sharp) + KTX2/ETC1S (toktx) к моделям.
 * Работает НА ОСНОВЕ уже сжатых meshopt-файлов из public/animations/compressed/
 * Результат: public/animations/ktx2/   (полный пайплайн)
 *
 * Техники:
 *   - WebP q=92 для baseColor (Color) — lossy, отличный на глаз
 *   - WebP near-lossless для normalMap — сохраняет точность нормалей
 *   - WebP q=88 для roughness
 *   - Meshopt (уже применён) + WebP = лучшее что можно без GPU-сжатия
 *
 * Запуск: node compress_ktx2.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;

// Путь к toktx.exe
const TOKTX = path.resolve('./tools/ktx/bin/toktx.exe');
const TOKTX_AVAILABLE = fs.existsSync(TOKTX);

const CLI = 'npx @gltf-transform/cli';
const SRC = './public/animations/compressed';  // вход — уже meshopt-сжатые
const OUT = './public/animations/ktx2';         // выход — WebP+KTX2

// Создаём выходные папки
['', '/room2/Anny', '/room2/Vell'].forEach(function(sub) {
  var d = OUT + sub;
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

function sizeMB(file) {
  if (!fs.existsSync(file)) return '?MB';
  return (fs.statSync(file).size / MB).toFixed(1) + ' MB';
}

function run(cmd, label) {
  var short = cmd.length > 120 ? cmd.slice(0, 120) + '...' : cmd;
  console.log('  $ ' + short);
  try {
    execSync(cmd, { stdio: 'pipe', cwd: process.cwd(),
      env: Object.assign({}, process.env, { PATH: process.env.PATH + ';' + path.dirname(TOKTX) })
    });
    return true;
  } catch (e) {
    var msg = (e.stderr ? e.stderr.toString() : e.message).slice(0, 300);
    console.error('  ⚠️  ' + (label || 'ERROR') + ': ' + msg);
    return false;
  }
}

function processModel(srcFile, outFile, label) {
  console.log('\n' + '═'.repeat(60));
  console.log('📦 ' + label);
  console.log('  Вход:  ' + sizeMB(srcFile));

  var tmp1 = outFile + '.webp.tmp.glb';
  var tmp2 = outFile + '.ktx2.tmp.glb';

  // Step 1: WebP compression для всех текстур
  // --slots "*" = все текстуры, quality=92, effort=90
  console.log('\n  [1/3] WebP текстуры (q=92)...');
  var ok1 = run(
    CLI + ' webp "' + srcFile + '" "' + tmp1 + '" --quality 92 --effort 90 --slots "*"',
    'webp'
  );
  if (!ok1 || !fs.existsSync(tmp1)) {
    console.log('  webp failed, trying with --formats png...');
    ok1 = run(
      CLI + ' webp "' + srcFile + '" "' + tmp1 + '" --quality 92 --formats png',
      'webp-png'
    );
  }
  if (!ok1 || !fs.existsSync(tmp1)) {
    fs.copyFileSync(srcFile, tmp1);
    console.log('  WebP не применён, продолжаем без него');
  }

  // Step 2: Попытка KTX2/ETC1S если toktx доступен
  if (TOKTX_AVAILABLE) {
    console.log('\n  [2/3] KTX2/ETC1S (GPU-compression, качество=128)...');
    // --slots "baseColor* roughness* metallic*" = только color+roughness, не normal!
    // Normal map лучше в UASTC или WebP (ETC1S плохо работает с нормалями)
    var ok2 = run(
      CLI + ' etc1s "' + tmp1 + '" "' + tmp2 + '"' +
      ' --quality 192' +  // высокое качество (255 max)
      ' --compression 1' + // скорость кодирования
      ' --slots "baseColorTexture,*roughness*,*metallic*"',
      'etc1s-color'
    );
    if (!ok2 || !fs.existsSync(tmp2)) {
      // Fallback: etc1s без фильтра по слотам
      ok2 = run(
        CLI + ' etc1s "' + tmp1 + '" "' + tmp2 + '" --quality 192',
        'etc1s-all'
      );
    }
    if (!ok2 || !fs.existsSync(tmp2)) {
      fs.copyFileSync(tmp1, tmp2);
      console.log('  KTX2 не применён, используем WebP');
    }
  } else {
    fs.copyFileSync(tmp1, tmp2);
    console.log('\n  [2/3] Пропуск KTX2 (toktx не найден)');
  }

  // Step 3: Финальный copy в output
  console.log('\n  [3/3] Финализация...');
  fs.copyFileSync(tmp2, outFile);

  // Cleanup
  [tmp1, tmp2].forEach(function(f) { if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch(e) {} });

  var outSize = sizeMB(outFile);
  var inBytes = fs.statSync(srcFile).size;
  var outBytes = fs.existsSync(outFile) ? fs.statSync(outFile).size : inBytes;
  var saved = Math.round((inBytes - outBytes) / inBytes * 100);
  console.log('\n  ✅ ' + label + ':');
  console.log('     Meshopt-версия: ' + sizeMB(srcFile));
  console.log('     KTX2/WebP:      ' + outSize + ' (' + (saved >= 0 ? '-' + saved : '+' + Math.abs(saved)) + '% от meshopt)');
}

function processAnim(srcFile, outFile, label) {
  // Анимации без текстур — просто копируем (meshopt уже применён)
  if (!fs.existsSync(srcFile)) { console.log('  skip (not found): ' + label); return; }
  fs.copyFileSync(srcFile, outFile);
  console.log('  ✓ ' + label + ': ' + sizeMB(outFile));
}

function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  var t = 0;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function(e) {
    var full = path.join(dir, e.name);
    if (e.isDirectory()) t += dirSize(full);
    else t += fs.statSync(full).size;
  });
  return t;
}

async function main() {
  console.log('🚀 KTX2/WebP КОМПРЕССИЯ ТЕКСТУР');
  console.log('Вход:  ' + SRC + '/ (meshopt-сжатые)');
  console.log('Выход: ' + OUT + '/');
  console.log('toktx: ' + (TOKTX_AVAILABLE ? '✅ ' + TOKTX : '❌ не найден (только WebP)'));

  // === МОДЕЛИ (с текстурами — главный выигрыш) ===
  processModel(SRC + '/AnyModel.glb',  OUT + '/AnyModel.glb',  'AnyModel (Anny)');
  processModel(SRC + '/VellModel.glb', OUT + '/VellModel.glb', 'VellModel (Vell)');

  // === АНИМАЦИИ (без текстур — просто копируем) ===
  console.log('\n' + '─'.repeat(60));
  console.log('Анимации (без текстур — копируем meshopt-версии):');
  [
    ['AnyIdle.glb',  'AnyIdle.glb'],
    ['AnyWalk.glb',  'AnyWalk.glb'],
    ['VellWalk.glb', 'VellWalk.glb'],
    ['room2/Anny/Any1p2r.glb', 'room2/Anny/Any1p2r.glb'],
    ['room2/Anny/Any2p2r.glb', 'room2/Anny/Any2p2r.glb'],
    ['room2/Anny/Any3p2r.glb', 'room2/Anny/Any3p2r.glb'],
    ['room2/Anny/Any4p2r.glb', 'room2/Anny/Any4p2r.glb'],
    ['room2/Vell/Vell1p2r.glb', 'room2/Vell/Vell1p2r.glb'],
    ['room2/Vell/Vell2p2r.glb', 'room2/Vell/Vell2p2r.glb'],
    ['room2/Vell/Vell3p2r.glb', 'room2/Vell/Vell3p2r.glb'],
    ['room2/Vell/Vell4p2r.glb', 'room2/Vell/Vell4p2r.glb'],
  ].forEach(function(pair) {
    processAnim(SRC + '/' + pair[0], OUT + '/' + pair[1], pair[0]);
  });

  // === ИТОГ ===
  console.log('\n' + '═'.repeat(60));
  var origTotal   = dirSize('./public/animations/compressed');
  var webpTotal   = dirSize(OUT);
  var originTotal = [
    './public/animations/AnyModel.glb',
    './public/animations/VellModel.glb',
    './public/animations/AnyIdle.glb',
    './public/animations/AnyWalk.glb',
    './public/animations/VellWalk.glb',
    './public/animations/room2',
  ].reduce(function(acc, f) {
    if (!fs.existsSync(f)) return acc;
    var st = fs.statSync(f);
    return acc + (st.isDirectory() ? dirSize(f) : st.size);
  }, 0);

  console.log('📊 ИТОГ:');
  console.log('  Оригинал (PNG 4096x4096): ' + (originTotal/MB).toFixed(1) + ' MB');
  console.log('  Meshopt + resize 2048:    ' + (origTotal/MB).toFixed(1) + ' MB (-' + Math.round((originTotal-origTotal)/originTotal*100) + '%)');
  console.log('  + WebP/KTX2 текстуры:    ' + (webpTotal/MB).toFixed(1)  + ' MB (-' + Math.round((originTotal-webpTotal)/originTotal*100)  + '% от оригинала)');
  console.log('\nДля активации: изменить ASSET_BASE в Room2Scene.tsx на /animations/ktx2');
  console.log('Для Three.js KTX2: добавить KTX2Loader в main.tsx');
}

main().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
