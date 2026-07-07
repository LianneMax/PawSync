@echo off
:: ============================================================
::  PawSync NFC Agent — Windows Setup
::  Run as Administrator (right-click → Run as administrator)
::  Installs the NFC bridge as a Windows service that starts
::  automatically on boot. No terminal needed after this.
:: ============================================================
setlocal EnableDelayedExpansion

set SERVICE_NAME=PawSyncNFC
set SERVICE_DISPLAY=PawSync NFC Bridge
set SERVICE_DESC=Reads NFC tags on the ACS ACR122U reader and sends events to the PawSync server.

set DIR=%~dp0
set EXE=%DIR%PawSync-NFC-Agent.exe
set NSSM=%DIR%nssm.exe
set LOG_OUT=%DIR%logs\agent-out.log
set LOG_ERR=%DIR%logs\agent-err.log

echo ============================================================
echo   PawSync NFC Agent — Windows Setup
echo ============================================================
echo.

:: ─── Check admin rights ──────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo ERROR: This script must be run as Administrator.
  echo Right-click setup.bat and select "Run as administrator".
  echo.
  pause
  exit /b 1
)

:: ─── Verify required files ───────────────────────────────────
if not exist "%EXE%" (
  echo ERROR: PawSync-NFC-Agent.exe not found in this folder.
  echo Make sure all files from the zip are extracted together.
  pause
  exit /b 1
)

if not exist "%NSSM%" (
  echo ERROR: nssm.exe not found in this folder.
  echo Download from https://nssm.cc and place nssm.exe here.
  pause
  exit /b 1
)

if not exist "%DIR%.env" (
  echo ERROR: .env file not found. Contact your PawSync administrator.
  pause
  exit /b 1
)

:: ─── Create logs directory ───────────────────────────────────
if not exist "%DIR%logs" mkdir "%DIR%logs"

:: ─── Check if ACS driver is installed ───────────────────────
echo Checking Smart Card service...
sc query SCardSvr >nul 2>&1
if %errorLevel% neq 0 (
  echo WARNING: Smart Card service not found.
  echo Please install the ACS ACR122U driver from:
  echo   https://www.acs.com.hk  Products ^> ACR122U ^> Drivers
  echo Then run this setup again.
  pause
  exit /b 1
)

:: Ensure Smart Card service is running
sc config SCardSvr start= auto >nul
net start SCardSvr >nul 2>&1

:: ─── Remove existing service if present ─────────────────────
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
  echo Removing existing service...
  net stop %SERVICE_NAME% >nul 2>&1
  "%NSSM%" remove %SERVICE_NAME% confirm >nul 2>&1
)

:: ─── Install service ─────────────────────────────────────────
echo Installing PawSync NFC service...

"%NSSM%" install %SERVICE_NAME% "%EXE%"
if errorlevel 1 (echo ERROR: Service install failed. & pause & exit /b 1)

"%NSSM%" set %SERVICE_NAME% DisplayName   "%SERVICE_DISPLAY%"
"%NSSM%" set %SERVICE_NAME% Description   "%SERVICE_DESC%"
"%NSSM%" set %SERVICE_NAME% AppDirectory  "%DIR%"
"%NSSM%" set %SERVICE_NAME% Start         SERVICE_AUTO_START
"%NSSM%" set %SERVICE_NAME% AppStdout     "%LOG_OUT%"
"%NSSM%" set %SERVICE_NAME% AppStderr     "%LOG_ERR%"
"%NSSM%" set %SERVICE_NAME% AppRotateFiles 1
"%NSSM%" set %SERVICE_NAME% AppRotateSeconds 86400
"%NSSM%" set %SERVICE_NAME% AppRotateBytes 10485760

:: ─── Start service ───────────────────────────────────────────
echo Starting service...
net start %SERVICE_NAME%
if errorlevel 1 (
  echo WARNING: Service installed but could not start.
  echo Plug in the ACR122U reader and try:  net start %SERVICE_NAME%
) else (
  echo Service started successfully.
)

echo.
echo ============================================================
echo   Setup complete!
echo.
echo   The PawSync NFC Bridge will now:
echo     - Start automatically every time Windows boots
echo     - Restart itself if it crashes
echo     - Run silently in the background (no window)
echo.
echo   To check status:  sc query %SERVICE_NAME%
echo   Logs location  :  %DIR%logs\
echo.
echo   Plug in the ACS ACR122U reader and you are ready.
echo ============================================================
echo.
pause
