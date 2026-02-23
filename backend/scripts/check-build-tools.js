const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

if (os.platform() !== 'win32') {
  // macOS/Linux: check for basic build tools
  try {
    execSync('which make', { stdio: 'ignore' });
    execSync('which g++ || which clang++', { stdio: 'ignore', shell: true });
    console.log('[setup] Build tools found. Optional native modules will be compiled.');
  } catch {
    console.warn('\n  ⚠ Missing C++ build tools.');
    console.warn('  Optional native module (nfc-pcsc) will be skipped.');
    console.warn('  On macOS:  xcode-select --install');
    console.warn('  On Linux:  sudo apt install build-essential\n');
    // Allow installation to proceed - nfc-pcsc is optional
  }
  process.exit(0);
}

// Windows: check for Visual Studio Build Tools
const vsWherePaths = [
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
  path.join(process.env['ProgramFiles'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
];

let hasVS = false;

for (const vsWhere of vsWherePaths) {
  if (fs.existsSync(vsWhere)) {
    try {
      const result = execSync(`"${vsWhere}" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      if (result) {
        hasVS = true;
        break;
      }
    } catch {}
  }
}

if (hasVS) {
  console.log('[setup] Visual Studio C++ Build Tools found.');
  process.exit(0);
}

console.warn('\n  ⚠ Visual Studio C++ Build Tools not found.');
console.warn('  Optional native module (nfc-pcsc) will be skipped.');
console.warn('  If you need NFC functionality, install C++ build tools manually:');
console.warn('  https://visualstudio.microsoft.com/visual-cpp-build-tools/\n');

// Allow installation to proceed - nfc-pcsc is optional
process.exit(0);
