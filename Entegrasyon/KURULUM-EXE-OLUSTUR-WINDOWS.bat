@echo off
chcp 65001 >nul
title ORION FaceGate x Puantaj26 — Windows Portable ZIP ve Kurulum.exe Olusturucu
cd /d "%~dp0"

echo ================================================================
echo   ORION FaceGate x Puantaj26 — Windows Kurulum Paketi Uretici
echo   (Gomulu Node.js 22 + PostgreSQL 16 + Standalone Sunucu)
echo ================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\paket-olustur.ps1"
if %errorlevel% neq 0 (
    echo [HATA] Tasinabilir paket olusturma basarisiz oldu!
    pause
    exit /b 1
)

if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    echo.
    echo [EK ADIM] Inno Setup bulundu — Personel26-Kurulum.exe derleniyor...
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "%~dp0windows\installer.iss"
)

echo.
echo ================================================================
echo   TAMAMLANDI!
echo   - Tasinabilir Klasor : %~dp0Personel26-Portable\Personel26-Baslat.bat
echo   - Tasinabilir ZIP    : %~dp0Personel26-Portable.zip
if exist "%~dp0windows\Personel26-Kurulum.exe" (
echo   - Windows Kurulum EXE: %~dp0windows\Personel26-Kurulum.exe
)
echo ================================================================
pause
