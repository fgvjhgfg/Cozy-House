const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

if (!fs.existsSync('./tools')) fs.mkdirSync('./tools');

const URL = 'https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Windows-x64.exe';
const DEST = './tools/ktx-setup.exe';
const INSTALL_DIR = path.resolve('./tools/ktx');
const TOKTX = path.join(INSTALL_DIR, 'bin', 'toktx.exe');

if (fs.existsSync(TOKTX)) {
  console.log('toktx.exe already installed at', TOKTX);
  process.exit(0);
}

function download(url, dest, redirects) {
  redirects = redirects || 0;
  if (redirects > 8) { console.error('Too many redirects'); process.exit(1); }
  return new Promise(function(resolve, reject) {
    var file = fs.createWriteStream(dest);
    https.get(url, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        file.close();
        try { fs.unlinkSync(dest); } catch(e) {}
        console.log('  Redirect ->', res.headers.location.slice(0, 80));
        resolve(download(res.headers.location, dest, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      var total = parseInt(res.headers['content-length'] || '0');
      var received = 0;
      res.on('data', function(chunk) {
        received += chunk.length;
        if (total > 0) {
          process.stdout.write('\r  ' + (received/1024/1024).toFixed(1) + '/' + (total/1024/1024).toFixed(1) + ' MB  ');
        }
      });
      res.pipe(file);
      file.on('finish', function() { file.close(); console.log('\n  Downloaded!'); resolve(); });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading KTX-Software v4.4.2 (Windows x64)...');
  await download(URL, DEST);

  console.log('\nInstalling silently to', INSTALL_DIR + '...');
  if (!fs.existsSync(INSTALL_DIR)) fs.mkdirSync(INSTALL_DIR, { recursive: true });

  try {
    // NSIS installer: /S = silent, /D = destination dir
    execSync('"' + path.resolve(DEST) + '" /S /D=' + path.resolve(INSTALL_DIR), {
      stdio: 'inherit',
      timeout: 120000
    });
    console.log('Installation complete.');
  } catch (e) {
    console.error('Install error:', e.message);
    // Try alternative: check if it installed to default location
  }

  // Wait a moment for install to finish
  await new Promise(function(r) { setTimeout(r, 3000); });

  // Check various locations
  var candidates = [
    TOKTX,
    'C:/Program Files/KTX-Software/bin/toktx.exe',
    path.join(INSTALL_DIR, 'toktx.exe'),
  ];
  
  var found = null;
  for (var c of candidates) {
    if (fs.existsSync(c)) { found = c; break; }
  }

  if (!found) {
    // Search in tools dir
    function findExe(dir, name) {
      if (!fs.existsSync(dir)) return null;
      var entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return null; }
      for (var e of entries) {
        var full = path.join(dir, e.name);
        if (e.isFile() && e.name.toLowerCase() === name.toLowerCase()) return full;
        if (e.isDirectory()) { var f = findExe(full, name); if (f) return f; }
      }
      return null;
    }
    found = findExe('./tools', 'toktx.exe') || findExe('C:/Program Files/KTX-Software', 'toktx.exe');
  }

  if (found) {
    console.log('\n✅ toktx found at:', found);
    // Copy to tools/ root for easy PATH access
    fs.copyFileSync(found, './tools/toktx.exe');
    try {
      var ver = execSync('"./tools/toktx.exe" --version 2>&1').toString().trim();
      console.log('Version:', ver);
    } catch(e) {
      console.log('(exists but --version failed, ok)');
    }
  } else {
    console.log('\n⚠️  toktx.exe not found after install. Check C:/Program Files/KTX-Software/');
    console.log('Listing tools dir:');
    execSync('dir /s /b tools 2>&1', { stdio: 'inherit' });
  }
}

main().catch(function(e) { console.error('ERROR:', e.message); process.exit(1); });
