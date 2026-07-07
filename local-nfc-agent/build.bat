@echo off
:: ============================================================
::  PawSync NFC Agent - Windows build script
::  Run this ON A WINDOWS MACHINE to produce
::  PawSync-NFC-Agent-Windows.zip
::  Prerequisite: Node.js 18+ and npm installed on this machine
:: ============================================================
setlocal EnableDelayedExpansion

:: ─── Configure these before building ────────────────────────
set BACKEND_URL=https://pawsync-backend.onrender.com
set NFC_SECRET=7c8c69bfdc984c880f100516c9064ac91e96c4130414fdbc924ab6c0eed2d07e
:: ────────────────────────────────────────────────────────────

set SCRIPT_DIR=%~dp0
set RELEASE_DIR=%SCRIPT_DIR%release
set DIST_DIR=%RELEASE_DIR%\dist-windows
set ZIP_NAME=PawSync-NFC-Agent-Windows.zip

echo ============================================================
echo   PawSync NFC Agent - Windows Build
echo   Output : %ZIP_NAME%
echo ============================================================
echo.

cd /d "%SCRIPT_DIR%"

:: 1. Clean
echo [1/8] Cleaning release directory...
if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"
mkdir "%DIST_DIR%\logs"

:: 2. Install dependencies
echo [2/8] Installing dependencies...
call npm install
if errorlevel 1 (echo ERROR: npm install failed & pause & exit /b 1)

:: 3. Compile TypeScript
echo [3/8] Compiling TypeScript...
call npm run build
if errorlevel 1 (echo ERROR: tsc failed & pause & exit /b 1)

:: 4. Package with pkg (auto-detect Node version for ABI match)
echo [4/8] Bundling executable...
for /f "tokens=1 delims=." %%v in ('node --version') do set NODE_VER=%%v
set NODE_MAJOR=%NODE_VER:~1%
set PKG_TARGET=node%NODE_MAJOR%-win-x64
echo     Detected Node %NODE_MAJOR% -- using target: %PKG_TARGET%
call npx @yao-pkg/pkg . --target %PKG_TARGET% --output "%DIST_DIR%\PawSync-NFC-Agent.exe" --compress GZip
if errorlevel 1 (echo ERROR: pkg failed & pause & exit /b 1)

:: 5. Copy native .node files
echo [5/8] Copying native modules...
for /r node_modules %%f in (*.node) do (
  copy /y "%%f" "%DIST_DIR%\" >nul 2>&1
)

:: 6. Write pre-filled .env
echo [6/8] Writing .env...
(
  echo # PawSync NFC Agent - pre-configured, do not edit
  echo BACKEND_URL=%BACKEND_URL%
  echo NFC_SECRET=%NFC_SECRET%
  echo POLL_INTERVAL_MS=3000
  echo DRAIN_INTERVAL_MS=30000
  echo LOG_LEVEL=info
) > "%DIST_DIR%\.env"

:: 7. Download NSSM (Windows service manager, public domain)
echo [7/8] Downloading NSSM...
powershell -NoProfile -Command ^
  "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%DIST_DIR%\nssm.zip' -UseBasicParsing"
if errorlevel 1 (
  echo WARNING: NSSM download failed. Download manually from https://nssm.cc and place nssm.exe in %DIST_DIR%
) else (
  powershell -NoProfile -Command ^
    "Expand-Archive -Path '%DIST_DIR%\nssm.zip' -DestinationPath '%DIST_DIR%\nssm-tmp' -Force"
  copy /y "%DIST_DIR%\nssm-tmp\nssm-2.24\win64\nssm.exe" "%DIST_DIR%\nssm.exe" >nul
  rmdir /s /q "%DIST_DIR%\nssm-tmp"
  del "%DIST_DIR%\nssm.zip"
)

:: 8. Copy installer scripts
echo [8/8] Copying installer scripts...
copy /y "%SCRIPT_DIR%installer\windows\setup.bat"     "%DIST_DIR%\" >nul
copy /y "%SCRIPT_DIR%installer\windows\uninstall.bat"  "%DIST_DIR%\" >nul

:: Create zip
echo.
echo Creating archive...
powershell -NoProfile -Command ^
  "Compress-Archive -Path '%DIST_DIR%\*' -DestinationPath '%RELEASE_DIR%\%ZIP_NAME%' -Force"

echo.
echo ============================================================
echo   Done!
echo   Archive : %RELEASE_DIR%\%ZIP_NAME%
echo.
echo   Deliver this zip to clinic admin.
echo   Admin steps:
echo     1. Install ACS ACR122U driver from acs.com.hk
echo     2. Extract zip anywhere (Desktop is fine)
echo     3. Right-click setup.bat → Run as Administrator
echo     4. Plug in ACR122U - done
echo ============================================================
pause
