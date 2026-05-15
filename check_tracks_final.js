// Глубокая проверка AnyWalk и VellWalk GLB — смотрим реальные THREE.js имена треков
// запускается через: node check_tracks_final.js

const fs = require('fs');

function readGLB(p) {
  const b = fs.readFileSync(p);
  const l = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20 + l).toString('utf8'));
}

function showAnims(file) {
  const json = readGLB(file);
  const anims = json.animations || [];
  const nodes = json.nodes || [];
  const acc = json.accessors || [];
  const name = file.split('/').pop();
  console.log(`\n=== ${name} ===`);
  console.log(`  Nodes: ${nodes.length}  Anims: ${anims.length}`);
  anims.forEach((a, i) => {
    const dur = (acc[a.samplers?.[0]?.input]?.max?.[0] ?? 0).toFixed(3);
    const transCh = a.channels.filter(c => c.target.path === 'translation');
    const rotCh   = a.channels.filter(c => c.target.path === 'rotation');
    const hipsTrans = transCh.filter(c => nodes[c.target.node]?.name === 'mixamorig:Hips');
    console.log(`  ANIM[${i}] "${a.name}" dur=${dur}s | trans=${transCh.length} rot=${rotCh.length} | hips.trans=${hipsTrans.length}`);
  });
  // Last anim (what we pick)
  if (anims.length > 0) {
    const last = anims[anims.length - 1];
    const dur2 = (acc[last.samplers?.[0]?.input]?.max?.[0] ?? 0).toFixed(3);
    console.log(`  → LAST ANIM[${anims.length-1}] "${last.name}" dur=${dur2}s  ← this one gets picked`);
    // Sample first 5 channels
    console.log('  First 5 channels:');
    last.channels.slice(0, 5).forEach((c, i) => {
      console.log(`    [${i}] "${nodes[c.target.node]?.name}" .${c.target.path}`);
    });
  }
}

showAnims('./public/animations/AnyWalk.glb');
showAnims('./public/animations/VellWalk.glb');
showAnims('./public/animations/AnyIdle.glb');
