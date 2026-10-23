@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Personel26-Yonet.ps1" -Action Backup
if errorlevel 1 exit /b 1
echo SQL yedeginiz data\backups klasorunde hazir.
if not "%P26_NONINTERACTIVE%"=="1" pause
endlocal
