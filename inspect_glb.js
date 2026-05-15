// Читаем GLB бинарно и смотрим JSON chunk
const fs = require('fs');

function readGLB(path) {
  const buf = fs.readFileSync(path);
  // GLB header: magic(4) + version(4) + length(4) + chunk0_length(4) + chunk0_type(4) + chunk0_data
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.slice(20, 20 + jsonLen).toString('utf8');
  try {
    const json = JSON.parse(jsonStr);
    // Найти корневые узлы
    const nodes = (json.nodes || []).slice(0, 8).map((n, i) => ({
      i, name: n.name, 
      t: n.translation,
      r: n.rotation,
      s: n.scale,
      mesh: n.mesh
    }));
    console.log('NODES:', JSON.stringify(nodes, null, 2));
    console.log('MESHES count:', (json.meshes || []).length);
    console.log('ANIMATIONS count:', (json.animations || []).length);
  } catch(e) {
    console.error('Parse error:', e.message);
  }
}

console.log('\n=== AnyModel.glb ===');
readGLB('./public/animations/AnyModel.glb');
console.log('\n=== VellModel.glb ===');
readGLB('./public/animations/VellModel.glb');
