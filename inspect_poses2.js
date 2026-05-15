// Инспектируем ТОЛЬКО room2 pose файлы — краткий вывод
const fs = require('fs');
const path = require('path');

function readGLB(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.slice(20, 20 + jsonLen).toString('utf8');
  try { return JSON.parse(jsonStr); } catch(e) { return null; }
}

function inspectPose(filePath) {
  const json = readGLB(filePath);
  if (!json) { console.log(`  ERROR parsing ${filePath}`); return; }

  const anims = json.animations || [];
  const nodes = json.nodes || [];
  const skins = json.skins || [];
  const jointCount = skins[0]?.joints?.length ?? 0;

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`FILE: ${path.basename(filePath)} (${(fs.statSync(filePath).size/1024).toFixed(0)}KB)`);
  console.log(`  Animations: ${anims.length}  |  Nodes: ${nodes.length}  |  Skin joints: ${jointCount}`);

  // Sample bone names from skin
  if (skins.length > 0) {
    const names = (skins[0].joints||[]).slice(0,5).map(i => nodes[i]?.name ?? '?');
    console.log(`  Bones[0..4]: ${names.join(' | ')}`);
  }

  // List all animations with name and duration
  anims.forEach((anim, i) => {
    // Try to compute approximate duration from samplers
    let maxTime = 0;
    (anim.samplers||[]).forEach(s => {
      const acc = json.accessors?.[s.input];
      if (acc?.max?.[0]) maxTime = Math.max(maxTime, acc.max[0]);
    });
    console.log(`  ANIM[${i}]: "${anim.name||'unnamed'}"  channels=${anim.channels?.length??0}  dur≈${maxTime.toFixed(2)}s`);
  });
}

const groups = [
  { label: '── Anny room2 poses ──', files: [
    './public/animations/room2/Anny/Any1p2r.glb',
    './public/animations/room2/Anny/Any2p2r.glb',
    './public/animations/room2/Anny/Any3p2r.glb',
    './public/animations/room2/Anny/Any4p2r.glb',
  ]},
  { label: '── Vell room2 poses ──', files: [
    './public/animations/room2/Vell/Vell1p2r.glb',
    './public/animations/room2/Vell/Vell2p2r.glb',
    './public/animations/room2/Vell/Vell3p2r.glb',
    './public/animations/room2/Vell/Vell4p2r.glb',
  ]},
];

groups.forEach(g => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(g.label);
  g.files.forEach(f => {
    if (fs.existsSync(f)) inspectPose(f);
    else console.log(`  [MISSING] ${f}`);
  });
});
