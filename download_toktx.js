/**
 * download_toktx.js
 * Скачивает toktx.exe для Windows из KhronosGroup/KTX-Software GitHub Releases
 * и кладёт в ./tools/toktx.exe
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_DIR = './tools';
const TOKTX_EXE = path.join(TOOLS_DIR, 'toktx.exe');

if (fs.existsSync(TOKTX_EXE)) {
  console.log('toktx.exe already exists:', TOKTX_EXE);
  process.exit(0);
}

if (!fs.existsSync(TOOLS_DIR)) fs.mkdirSync(TOOLS_DIR);

// KTX-Software 4.3.2 Windows release
const RELEASE_URL = 'https://github.com/KhronosGroup/KTX-Software/releases/download/v4.3.2/KTX-Software-4.3.2-Windows-x64.zip';
const ZIP_PATH = path.join(TOOLS_DIR, 'ktx-software.zip');

console.log('Скачиваю KTX-Software для Windows...');
console.log('URL:', RELEASE_URL);

function download(url, dest, redirects = 0) {
  if (redirects > 5) { console.error('Too many redirects'); process.exit(1); }
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : require('http');
    const req = protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        file.close();
        fs.unlinkSync(dest);
        console.log('Redirect ->', res.headers.location);
        resolve(download(res.headers.location, dest, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0');
      let received = 0;
      res.on('data', chunk => {
        received += chunk.length;
        if (total > 0) {
          process.stdout.write('\r  ' + (received / 1024 / 1024).toFixed(1) + ' MB / ' + (total / 1024 / 1024).toFixed(1) + ' MB');
        }
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log('\n  Загружено!'); resolve(); });
    });
    req.on('error', reject);
  });
}

async function main() {
  await download(RELEASE_URL, ZIP_PATH);

  console.log('\nРаспаковываю ZIP...');
  try {
    execSync(`powershell -command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${TOOLS_DIR}/ktx' -Force"`, { stdio: 'inherit' });
  } catch(e) {
    console.error('powershell expand failed:', e.message);
    process.exit(1);
  }

  // Find toktx.exe
  function findFile(dir, name) {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase() === name.toLowerCase()) return full;
      if (e.isDirectory()) {
        const found = findFile(full, name);
        if (found) return found;
      }
    }
    return null;
  }

  const toktxPath = findFile(path.join(TOOLS_DIR, 'ktx'), 'toktx.exe');
  if (!toktxPath) {
    console.error('toktx.exe not found in ZIP! Listing extracted:');
    execSync('dir /s /b tools\\ktx\\*.exe', { stdio: 'inherit' });
    process.exit(1);
  }

  fs.copyFileSync(toktxPath, TOKTX_EXE);
  console.log('✅ toktx.exe installed to', TOKTX_EXE);

  // Cleanup
  fs.unlinkSync(ZIP_PATH);

  // Test
  try {
    const ver = execSync(`"${TOKTX_EXE}" --version 2>&1`).toString().trim();
    console.log('Version:', ver);
  } catch(e) {
    console.log('(version check failed, but file exists)');
  }
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
