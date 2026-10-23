@echo off
chcp 65001 >nul
title ORION FaceGate x Puantaj26 — Entegre Sistem Baslatici
cd /d "%~dp0"

echo ================================================================
echo   ORION FaceGate x Puantaj26 — Tek Pencere Entegre Platform
echo ================================================================
echo.

:: Eger onceden uretilmis tasinabilir Windows paketi varsa dogrudan onu calistir
if exist "%~dp0Personel26-Portable\Personel26-Baslat.bat" (
    echo [BILGI] Hazir tasinabilir Windows paketi bulundu, baslatiliyor...
    call "%~dp0Personel26-Portable\Personel26-Baslat.bat"
    exit /b 0
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Node.js 22 bulunamadi!
    echo Node.js olmadan calisan gomulu PostgreSQL + Node kurulum paketi icin
    echo GitHub Actions "windows-distribution" ciktisindaki Personel26-Kurulum.exe
    echo dosyasini calistirin veya https://nodejs.org adresinden Node.js 22 kurun.
    pause
    exit /b 1
)

if not exist "%~dp0node_modules" (
    echo [1/3] Bagimliliklar kuruluyor...
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo [HATA] npm install basarisiz oldu.
        pause
        exit /b 1
    )
)

if exist "%~dp0.env" (
    echo [2/3] Veritabani semasi kontrol ediliyor...
    call npx drizzle-kit push --config=drizzle.config.ts
) else (
    echo [UYARI] .env dosyasi bulunamadi! .env.example dosyasini .env olarak kopyalayip
    echo PostgreSQL adresinizi yazin veya gomulu kurulum icin KURULUM-EXE-OLUSTUR-WINDOWS.bat calistirin.
)

echo.
echo [3/3] ORION FaceGate + Puantaj26 Tek Uygulama Baslatiliyor: http://localhost:3000
echo       - Canli Panel ve Biyometrik Personel : http://localhost:3000
echo       - Yuz Terminali                      : http://localhost:3000/terminal
echo       - Puantaj26 Resmi Cetvel ve Nobet    : http://localhost:3000/puantaj26
echo       - Sifresiz TC Personel Sorgu         : http://localhost:3000/personel-sorgu
echo.
start "" "http://localhost:3000"
call npm run dev -- -p 3000
pause
