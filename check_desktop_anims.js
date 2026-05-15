const fs = require('fs');

function readGLB(p) {
  const b = fs.readFileSync(p);
  const l = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20 + l).toString('utf8'));
}

const BASE = 'C:/Users/Knp/Desktop/\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u0430\u044f \u043f\u0430\u043f\u043a\u0430 \u0443\u0434\u0430\u043b\u0438/Animations glb lite';

const files = [
  { path: BASE + '/Any/Any1p2r.glb', key: 'Any1p2r' },
  { path: BASE + '/Any/Any2p2r.glb', key: 'Any2p2r' },
  { path: BASE + '/Any/Any3p2r.glb', key: 'Any3p2r' },
  { path: BASE + '/Any/Any4p2r.glb', key: 'Any4p2r' },
  { path: BASE + '/Vell/Vell1p2r.glb', key: 'Vell1p2r' },
  { path: BASE + '/Vell/Vell2p2r.glb', key: 'Vell2p2r' },
  { path: BASE + '/Vell/Vell3p2r.glb', key: 'Vell3p2r' },
  { path: BASE + '/Vell/Vell4p2r.glb', key: 'Vell4p2r' },
];

files.forEach(({ path: p, key }) => {
  const j = readGLB(p);
  const anims = j.animations || [];
  const accessors = j.accessors || [];
  console.log('\n' + key + ':');
  console.log('  anims=' + anims.length + ', size=' + (fs.statSync(p).size / 1024).toFixed(0) + 'KB');
  anims.forEach((a, i) => {
    const inputIdx = a.samplers && a.samplers[0] ? a.samplers[0].input : -1;
    const dur = inputIdx >= 0 && accessors[inputIdx] ? (accessors[inputIdx].max || [0])[0] : 0;
    console.log('  ANIM[' + i + '] "' + (a.name || 'unnamed') + '" dur=' + dur.toFixed(3) + 's channels=' + (a.channels || []).length);
  });
});
