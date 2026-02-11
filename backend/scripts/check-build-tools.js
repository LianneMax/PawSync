const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

if (os.platform() !== 'win32') {
  // macOS/Linux: check for basic build tools
  try {
    execSync('which make', { stdio: 'ignore' });
    execSync('which g++ || which clang++', { stdio: 'ignore', shell: true });
  } catch {
    console.error('\n  Missing C++ build tools.');
    console.error('  On macOS:  xcode-select --install');
    console.error('  On Linux:  sudo apt install build-essential\n');
    process.exit(1);
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

console.log('\n  Visual Studio C++ Build Tools not found.');
console.log('  These are required to compile the nfc-pcsc native module.\n');
console.log('  Installing via winget...\n');

try {
  execSync(
    'winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" --accept-source-agreements --accept-package-agreements',
    { stdio: 'inherit' }
  );
  console.log('\n  Build Tools installed successfully.');
  console.log('  NOTE: You may need to RESTART your terminal (or PC) then re-run npm install.\n');
} catch {
  console.error('\n  Auto-install failed. Please install manually:');
  console.error('  1. Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/');
  console.error('  2. Select "Desktop development with C++" workload');
  console.error('  3. Restart your terminal and re-run npm install\n');
  process.exit(1);
}
