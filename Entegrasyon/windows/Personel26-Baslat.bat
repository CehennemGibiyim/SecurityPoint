@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Personel26-Yonet.ps1" -Action Start
if errorlevel 1 (
  echo [HATA] Personel26 baslatilamadi. data klasorundeki loglari inceleyin.
  if not "%P26_NONINTERACTIVE%"=="1" pause
  exit /b 1
)
endlocal
