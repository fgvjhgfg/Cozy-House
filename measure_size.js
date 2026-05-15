const fs = require('fs');
const path = require('path');

function getDirSize(dir) {
  let total = 0;
  const files = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); }
      else {
        const sz = fs.statSync(full).size;
        total += sz;
        files.push({ path: full, size: sz });
      }
    }
  }
  walk(dir);
  return { total, files };
}

const MB = 1024 * 1024;
const base = './public';
const { total, files } = getDirSize(base);

console.log('=== ОБЩИЙ РАЗМЕР ИГРЫ ===');
console.log('public/: ' + (total / MB).toFixed(1) + ' MB (' + files.length + ' файлов)');

// Src folder
const src = getDirSize('./src');
console.log('src/:    ' + (src.total / MB).toFixed(1) + ' MB');
console.log('ИТОГО:   ' + ((total + src.total) / MB).toFixed(1) + ' MB');

// Room 2 specific
const room2Dirs = [
  './public/animations/room2',
  './public/animations/AnyModel.glb',
  './public/animations/AnyIdle.glb',
  './public/animations/AnyWalk.glb',
  './public/animations/VellModel.glb',
  './public/animations/VellWalk.glb',
  './src/Scenes/Room2Scene',
];

console.log('\n=== КОМНАТА 2 ===');
let room2Total = 0;
for (const p of room2Dirs) {
  if (!fs.existsSync(p)) { console.log('[missing] ' + p); continue; }
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    const { total: t } = getDirSize(p);
    room2Total += t;
    console.log((t / MB).toFixed(1) + ' MB  ' + p);
  } else {
    room2Total += stat.size;
    console.log((stat.size / MB).toFixed(1) + ' MB  ' + p);
  }
}
console.log('─────────────────');
console.log((room2Total / MB).toFixed(1) + ' MB  ИТОГО Room 2');

// Top 15 biggest files
console.log('\n=== ТОП 15 САМЫХ ТЯЖЁЛЫХ ФАЙЛОВ ===');
files.sort((a, b) => b.size - a.size);
files.slice(0, 15).forEach(f => {
  console.log((f.size / MB).toFixed(1) + ' MB  ' + f.path.replace('./public/', ''));
});

// By folder
console.log('\n=== РАЗМЕР ПО ПАПКАМ ===');
const folders = {};
for (const f of files) {
  const rel = f.path.replace('./public/', '');
  const parts = rel.split('/');
  const folder = parts.length > 1 ? parts[0] + '/' + (parts[1] || '') : parts[0];
  folders[folder] = (folders[folder] || 0) + f.size;
}
Object.entries(folders).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log((v/MB).toFixed(1) + ' MB  ' + k);
});
