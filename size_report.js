const fs = require('fs');
const MB = 1024 * 1024;
const pairs = [
  ['public/animations/AnyModel.glb', 'public/animations/compressed/AnyModel.glb'],
  ['public/animations/VellModel.glb', 'public/animations/compressed/VellModel.glb'],
  ['public/animations/AnyIdle.glb', 'public/animations/compressed/AnyIdle.glb'],
  ['public/animations/AnyWalk.glb', 'public/animations/compressed/AnyWalk.glb'],
  ['public/animations/VellWalk.glb', 'public/animations/compressed/VellWalk.glb'],
  ['public/animations/room2/Anny/Any1p2r.glb', 'public/animations/compressed/room2/Anny/Any1p2r.glb'],
  ['public/animations/room2/Anny/Any2p2r.glb', 'public/animations/compressed/room2/Anny/Any2p2r.glb'],
  ['public/animations/room2/Anny/Any3p2r.glb', 'public/animations/compressed/room2/Anny/Any3p2r.glb'],
  ['public/animations/room2/Anny/Any4p2r.glb', 'public/animations/compressed/room2/Anny/Any4p2r.glb'],
  ['public/animations/room2/Vell/Vell1p2r.glb', 'public/animations/compressed/room2/Vell/Vell1p2r.glb'],
  ['public/animations/room2/Vell/Vell2p2r.glb', 'public/animations/compressed/room2/Vell/Vell2p2r.glb'],
  ['public/animations/room2/Vell/Vell3p2r.glb', 'public/animations/compressed/room2/Vell/Vell3p2r.glb'],
  ['public/animations/room2/Vell/Vell4p2r.glb', 'public/animations/compressed/room2/Vell/Vell4p2r.glb'],
];

let totalOrig = 0, totalComp = 0;
console.log('СРАВНЕНИЕ РАЗМЕРОВ:');
console.log('-'.repeat(70));
pairs.forEach(function(pair) {
  const orig = pair[0], comp = pair[1];
  if (!fs.existsSync(orig) || !fs.existsSync(comp)) return;
  const o = fs.statSync(orig).size;
  const c = fs.statSync(comp).size;
  totalOrig += o;
  totalComp += c;
  const pct = Math.round((o - c) / o * 100);
  const name = orig.split('/').pop();
  console.log(
    (o/MB).toFixed(1).padStart(6) + ' MB → ' +
    (c/MB).toFixed(1).padStart(6) + ' MB  -' + String(pct).padStart(2) + '%  ' + name
  );
});
console.log('-'.repeat(70));
const pct = Math.round((totalOrig - totalComp) / totalOrig * 100);
console.log(
  (totalOrig/MB).toFixed(1).padStart(6) + ' MB → ' +
  (totalComp/MB).toFixed(1).padStart(6) + ' MB  -' + pct + '%  ИТОГО'
);
console.log('\nЭкономия: ' + ((totalOrig - totalComp)/MB).toFixed(1) + ' MB');
