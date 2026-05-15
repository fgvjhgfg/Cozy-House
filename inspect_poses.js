// Инспектируем все pose GLB файлы
const fs = require('fs');
const path = require('path');

function readGLB(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.slice(20, 20 + jsonLen).toString('utf8');
  try {
    return JSON.parse(jsonStr);
  } catch(e) {
    console.error('Parse error:', e.message);
    return null;
  }
}

function inspectPose(filePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FILE: ${path.basename(filePath)}`);
  console.log(`SIZE: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB`);

  const json = readGLB(filePath);
  if (!json) return;

  const anims = json.animations || [];
  const nodes = json.nodes || [];
  const skins = json.skins || [];

  console.log(`ANIMATIONS: ${anims.length}`);
  console.log(`NODES: ${nodes.length}`);
  console.log(`SKINS: ${skins.length}`);

  if (skins.length > 0) {
    const jointCount = skins[0].joints?.length ?? 0;
    console.log(`SKIN[0] joints: ${jointCount}`);
    // First few joint names
    const jointNames = (skins[0].joints || []).slice(0, 6).map(idx => nodes[idx]?.name ?? '?');
    console.log(`SKIN[0] sample bones: ${jointNames.join(', ')}`);
  }

  anims.forEach((anim, ai) => {
    const channels = anim.channels || [];
    const samplers = anim.samplers || [];
    console.log(`\n  ANIM[${ai}] name="${anim.name || '(unnamed)'}"`);
    console.log(`    channels: ${channels.length}`);
    // Show first 5 channel targets
    channels.slice(0, 5).forEach(ch => {
      const nodeName = nodes[ch.target?.node]?.name ?? `node#${ch.target?.node}`;
      const path2 = ch.target?.path ?? '?';
      console.log(`    → "${nodeName}" .${path2}`);
    });
    if (channels.length > 5) console.log(`    ... (${channels.length - 5} more)`);
  });
}

// Список всех файлов для проверки
const files = [
  './public/animations/room2/Anny/Any1p2r.glb',
  './public/animations/room2/Anny/Any2p2r.glb',
  './public/animations/room2/Anny/Any3p2r.glb',
  './public/animations/room2/Anny/Any4p2r.glb',
  './public/animations/room2/Vell/Vell1p2r.glb',
  './public/animations/room2/Vell/Vell2p2r.glb',
  './public/animations/room2/Vell/Vell3p2r.glb',
  './public/animations/room2/Vell/Vell4p2r.glb',
  // Также проверим дубли в корне
  './public/animations/Any1p2r.glb',
  './public/animations/Any2p2r.glb',
  './public/animations/Any3p2r.glb',
  './public/animations/Any4p2r.glb',
];

console.log('POSE GLB INSPECTOR\n');
files.forEach(f => {
  if (fs.existsSync(f)) {
    inspectPose(f);
  } else {
    console.log(`\n[MISSING] ${f}`);
  }
});

// Также проверим имена костей в моделях для сравнения
console.log('\n' + '='.repeat(60));
console.log('MODEL BONE SAMPLES (for comparison):');
['./public/animations/AnyModel.glb', './public/animations/VellModel.glb'].forEach(mf => {
  if (!fs.existsSync(mf)) return;
  const json = readGLB(mf);
  if (!json) return;
  const skins = json.skins || [];
  const nodes = json.nodes || [];
  console.log(`\n${path.basename(mf)}:`);
  if (skins.length > 0) {
    const names = (skins[0].joints || []).slice(0, 10).map(i => nodes[i]?.name ?? '?');
    console.log(`  First 10 bones: ${names.join(', ')}`);
  }
});
