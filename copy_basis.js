const fs = require('fs');
const path = require('path');

var basisDir = path.resolve('./node_modules/three/examples/jsm/libs/basis');
var destDir  = path.resolve('./public/basis');

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

var files = ['basis_transcoder.js', 'basis_transcoder.wasm'];
files.forEach(function(f) {
  var src = path.join(basisDir, f);
  var dst = path.join(destDir, f);
  if (!fs.existsSync(src)) { console.log('NOT FOUND: ' + src); return; }
  fs.copyFileSync(src, dst);
  console.log('OK: ' + f + ' (' + (fs.statSync(dst).size / 1024).toFixed(0) + ' KB)');
});
