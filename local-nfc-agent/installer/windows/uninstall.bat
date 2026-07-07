@echo off
:: ============================================================
::  PawSync NFC Agent — Windows Uninstall
::  Run as Administrator (right-click → Run as administrator)
:: ============================================================
setlocal

set SERVICE_NAME=PawSyncNFC
set DIR=%~dp0
set NSSM=%DIR%nssm.exe

echo ============================================================
echo   PawSync NFC Agent — Uninstall
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo ERROR: Run as Administrator.
  pause
  exit /b 1
)

sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% neq 0 (
  echo Service "%SERVICE_NAME%" is not installed. Nothing to remove.
  pause
  exit /b 0
)

echo Stopping service...
net stop %SERVICE_NAME% >nul 2>&1

echo Removing service...
"%NSSM%" remove %SERVICE_NAME% confirm

echo.
echo Done. PawSync NFC Bridge has been removed.
echo Files in this folder were NOT deleted — remove them manually if needed.
echo.
pause
