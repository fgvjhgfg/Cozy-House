const fs = require('fs');
const path = require('path');
const MB = 1024 * 1024;

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

function fileSize(f) { return fs.existsSync(f) ? fs.statSync(f).size : 0; }

const pub = './public';

// Total public size
const pubTotal = dirSize(pub);

// By folder
const folders = {
  'animations/ (originals)': dirSize('./public/animations') - dirSize('./public/animations/compressed') - dirSize('./public/animations/ktx2') - dirSize('./public/animations/room2'),
  'animations/room2/ (orig poses)': dirSize('./public/animations/room2'),
  'animations/compressed/ (meshopt)': dirSize('./public/animations/compressed'),
  'animations/ktx2/ (ACTIVE: webp+ktx2)': dirSize('./public/animations/ktx2'),
  'models/': dirSize('./public/models'),
  'basis/ (wasm decoder)': dirSize('./public/basis'),
};

// Room 2 active assets
const room2Active = [
  './public/animations/ktx2/AnyModel.glb',
  './public/animations/ktx2/VellModel.glb',
  './public/animations/ktx2/AnyIdle.glb',
  './public/animations/ktx2/AnyWalk.glb',
  './public/animations/ktx2/VellWalk.glb',
  './public/animations/ktx2/room2',
].reduce((acc, f) => {
  if (!fs.existsSync(f)) return acc;
  const st = fs.statSync(f);
  return acc + (st.isDirectory() ? dirSize(f) : st.size);
}, 0);

const room2Orig = [
  './public/animations/AnyModel.glb',
  './public/animations/VellModel.glb',
  './public/animations/AnyIdle.glb',
  './public/animations/AnyWalk.glb',
  './public/animations/VellWalk.glb',
  './public/animations/room2',
].reduce((acc, f) => {
  if (!fs.existsSync(f)) return acc;
  const st = fs.statSync(f);
  return acc + (st.isDirectory() ? dirSize(f) : st.size);
}, 0);

console.log('='.repeat(70));
console.log('  ПОЛНЫЙ ОТЧЁТ О РАЗМЕРАХ ИГРЫ');
console.log('='.repeat(70));
console.log('\n📁 ВСЕГО public/: ' + (pubTotal/MB).toFixed(1) + ' MB');
console.log('\n📂 По папкам:');
Object.entries(folders).forEach(([k,v]) => {
  console.log('  ' + (v/MB).toFixed(1).padStart(6) + ' MB  ' + k);
});

console.log('\n' + '─'.repeat(70));
console.log('🎮 КОМНАТА 2 (Room 2):');
console.log('  Оригинал:     ' + (room2Orig/MB).toFixed(1) + ' MB');
console.log('  Активные:     ' + (room2Active/MB).toFixed(1) + ' MB  (KTX2/WebP)');
console.log('  Экономия:     ' + ((room2Orig-room2Active)/MB).toFixed(1) + ' MB (-' + Math.round((room2Orig-room2Active)/room2Orig*100) + '%)');

console.log('\n' + '─'.repeat(70));
console.log('📦 АКТИВНЫЕ АССЕТЫ Room 2 (загружаются браузером):');
[
  ['AnyModel.glb', './public/animations/ktx2/AnyModel.glb'],
  ['VellModel.glb', './public/animations/ktx2/VellModel.glb'],
  ['AnyIdle.glb', './public/animations/ktx2/AnyIdle.glb'],
  ['AnyWalk.glb', './public/animations/ktx2/AnyWalk.glb'],
  ['VellWalk.glb', './public/animations/ktx2/VellWalk.glb'],
  ['room2/ (8 поз)', './public/animations/ktx2/room2'],
].forEach(([name, f]) => {
  if (!fs.existsSync(f)) return;
  const st = fs.statSync(f);
  const sz = st.isDirectory() ? dirSize(f) : st.size;
  console.log('  ' + (sz/MB).toFixed(1).padStart(5) + ' MB  ' + name);
});
console.log('  ─────────────');
console.log('  ' + (room2Active/MB).toFixed(1).padStart(5) + ' MB  ИТОГО Room 2');

// KTX2 vs orig
console.log('\n' + '─'.repeat(70));
console.log('📊 СРАВНЕНИЕ МОДЕЛЕЙ (3 уровня):');
const levels = [
  ['Оригинал (PNG 4096×4096)', './public/animations/AnyModel.glb', './public/animations/VellModel.glb'],
  ['Meshopt+resize 2048',       './public/animations/compressed/AnyModel.glb', './public/animations/compressed/VellModel.glb'],
  ['WebP+KTX2 (ACTIVE)',        './public/animations/ktx2/AnyModel.glb', './public/animations/ktx2/VellModel.glb'],
];
levels.forEach(([label, anny, vell]) => {
  const a = fileSize(anny), v = fileSize(vell);
  console.log('  ' + ((a+v)/MB).toFixed(1).padStart(5) + ' MB  ' + label);
});
