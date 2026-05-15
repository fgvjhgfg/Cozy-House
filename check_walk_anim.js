// Детально инспектируем AnyWalk.glb — все треки анимации
const fs = require('fs');

function readGLB(p) {
  const b = fs.readFileSync(p);
  const l = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20 + l).toString('utf8'));
}

function inspectWalk(filePath) {
  const json = readGLB(filePath);
  const anims = json.animations || [];
  const nodes = json.nodes || [];
  const accessors = json.accessors || [];

  console.log('FILE:', filePath);
  console.log('Nodes count:', nodes.length);
  console.log('Animations:', anims.length);

  // Show all root-level nodes
  console.log('\nAll nodes (first 10):');
  nodes.slice(0, 10).forEach((n, i) => {
    console.log(`  [${i}] "${n.name}" children=${(n.children||[]).length} skin=${n.skin??'-'} mesh=${n.mesh??'-'}`);
  });

  anims.forEach((anim, ai) => {
    const dur = accessors[anim.samplers[0]?.input]?.max?.[0] ?? 0;
    console.log(`\nANIM[${ai}] "${anim.name}" dur=${dur.toFixed(3)}s channels=${anim.channels.length}`);

    // Show ALL channels
    anim.channels.forEach((ch, ci) => {
      const nodeName = nodes[ch.target?.node]?.name ?? `node#${ch.target?.node}`;
      const path = ch.target?.path ?? '?';
      // Flag position tracks — these cause root motion
      const flag = path === 'translation' ? ' ⚠️ ROOT MOTION' : '';
      if (path === 'translation' || ci < 6) {
        console.log(`  ch[${ci}] "${nodeName}" .${path}${flag}`);
      }
    });

    // Count position tracks
    const posTracks = anim.channels.filter(ch => ch.target?.path === 'translation');
    console.log(`  → TOTAL position(translation) tracks: ${posTracks.length}`);
    posTracks.forEach(ch => {
      const nodeName = nodes[ch.target?.node]?.name ?? `node#${ch.target?.node}`;
      console.log(`     - "${nodeName}"`);
    });
  });
}

inspectWalk('./public/animations/AnyWalk.glb');
console.log('\n---\n');
// Also check AnyIdle for comparison
inspectWalk('./public/animations/AnyIdle.glb');
