// Показываем начало вывода AnyWalk.glb
const fs = require('fs');

function readGLB(p) {
  const b = fs.readFileSync(p);
  const l = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20 + l).toString('utf8'));
}

const json = readGLB('./public/animations/AnyWalk.glb');
const anims = json.animations || [];
const nodes = json.nodes || [];
const accessors = json.accessors || [];

console.log('AnyWalk.glb');
console.log('Nodes:', nodes.length, '| Anims:', anims.length);
console.log('\nAll NODES (first 15):');
nodes.slice(0, 15).forEach((n, i) => {
  console.log(`  [${i}] "${n.name}" children=${JSON.stringify(n.children||[])} skin=${n.skin??'-'}`);
});

const anim = anims[0];
if (anim) {
  const dur = accessors[anim.samplers[0]?.input]?.max?.[0] ?? 0;
  console.log(`\nANIM[0] "${anim.name}" dur=${dur.toFixed(3)}s channels=${anim.channels.length}`);
  console.log('First 12 channels:');
  anim.channels.slice(0, 12).forEach((ch, i) => {
    const n = nodes[ch.target?.node];
    console.log(`  [${i}] "${n?.name}" .${ch.target?.path}`);
  });
  
  // Все translation треки
  const transTracks = anim.channels.filter(c => c.target.path === 'translation');
  console.log(`\nTotal .translation channels: ${transTracks.length}`);
  console.log('Translation tracks:');
  transTracks.forEach(c => {
    const n = nodes[c.target.node];
    console.log(`  "${n?.name}"`);
  });
}
