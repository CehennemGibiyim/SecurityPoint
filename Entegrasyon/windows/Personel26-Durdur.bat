@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Personel26-Yonet.ps1" -Action Stop
if errorlevel 1 exit /b 1
endlocal
