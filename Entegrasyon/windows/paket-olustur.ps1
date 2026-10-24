[CmdletBinding()]
param(
  [switch]$SkipBuild,     # Mevcut .next/standalone çıktısını kullan (CI'da build ayrı adımda yapılır)
  [switch]$NoZip,         # Personel26-Portable.zip üretme
  [switch]$NoExe,         # Kurulum .exe'sini derleme (yalnızca taşınabilir paket)
  [string]$NodeVersion = '22.22.3',
  [string]$PgVersion = '16.13-1'
)
<#
  ORION FaceGate x Puantaj26 — Windows kurulum paketi üreticisi (TEK DOSYA).

  Bu betik tek başına tüm süreci yürütür:
    1) TypeScript + üretim derlemesi (isterseniz -SkipBuild ile atlanır)
    2) Taşınabilir çalışma ortamı: Node.js 22 + PostgreSQL 16 + Visual C++ Redistributable
    3) Personel26-Portable\ klasörü + Personel26-Portable.zip
    4) installer.iss dosyasını üretir (artık ayrı dosya taşınmaz)
    5) Inno Setup 6 yoksa sessizce kurar, Personel26-Kurulum.exe'yi derler

  Kullanım (Entegrasyon/ altında):
    powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1
    powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1 -SkipBuild   # yalnızca paketle+exe
    powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1 -NoExe        # yalnızca taşınabilir zip

  Son kullanıcıda Node.js, PostgreSQL veya Visual C++ kurulu olmak zorunda değildir;
  gerekli her şey paketin içine gömülür.
#>
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

# Gecici ag kesintilerine karsi tekrar deneyen indirme yardimcisi.
function Get-WebWithRetry {
  param([string]$Uri, [string]$OutFile, [int]$Tries = 5)
  for ($i = 1; $i -le $Tries; $i++) {
    try {
      if ($OutFile) {
        if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
        Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing -TimeoutSec 600
        return
      }
      return (Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 120)
    } catch {
      if ($OutFile -and (Test-Path $OutFile)) { Remove-Item $OutFile -Force -ErrorAction SilentlyContinue }
      if ($i -eq $Tries) { throw }
      Write-Host "Indirme basarisiz ($i/$Tries): $Uri - $($_.Exception.Message). Tekrar deneniyor..." -ForegroundColor Yellow
      Start-Sleep -Seconds (5 * $i)
    }
  }
}

# ─────────────────────────────────────────────────────────────────
# 1) Derleme (isteğe bağlı)
# ─────────────────────────────────────────────────────────────────
$Root = Split-Path -Parent $PSScriptRoot        # Entegrasyon\
$Out = Join-Path $Root 'Personel26-Portable'
$Cache = Join-Path $Root '.paket-cache'
New-Item -ItemType Directory -Force -Path $Cache | Out-Null

if (-not $SkipBuild) {
  Push-Location $Root
  try {
    if (Test-Path 'package-lock.json') {
      npm ci --allow-remote=root
      if ($LASTEXITCODE -ne 0) {
        Write-Host 'package-lock.json package.json ile uyumsuz; npm install ile yenileniyor...'
        npm install --allow-remote=root
      }
    } else { npm install --allow-remote=root }
    if ($LASTEXITCODE -ne 0) { throw 'Bagimlilik kurulumu basarisiz.' }
    npx next typegen
    if ($LASTEXITCODE -ne 0) { throw 'Next.js tip uretimi basarisiz.' }
    npx tsc --noEmit --pretty false
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript dogrulamasi basarisiz.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Uretim derlemesi basarisiz.' }
  } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $Root '.next\standalone\server.js'))) { throw 'Next.js standalone sunucu ciktisi bulunamadi.' }

# ─────────────────────────────────────────────────────────────────
# 2) Gömülü çalışma ortamı: Node.js + PostgreSQL + Visual C++ Redistributable
# ─────────────────────────────────────────────────────────────────
$NodeFile = "node-v$NodeVersion-win-x64.zip"
$NodeZip = Join-Path $Cache $NodeFile
if (-not (Test-Path $NodeZip)) { Get-WebWithRetry "https://nodejs.org/dist/v$NodeVersion/$NodeFile" $NodeZip }
# Resmi Node.js SHA-256 kontrolu.
$Checksums = (Get-WebWithRetry "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt").Content
$Line = ($Checksums -split "`n" | Where-Object { $_.Trim().EndsWith($NodeFile) } | Select-Object -First 1)
if (-not $Line) { throw 'Node.js checksum kaydi bulunamadi.' }
$Expected = ($Line.Trim() -split '\s+')[0]
if ((Get-FileHash $NodeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Expected.ToLowerInvariant()) { throw 'Node.js SHA-256 dogrulamasi basarisiz.' }

$PgZip = Join-Path $Cache "postgresql-$PgVersion-windows-x64-binaries.zip"
if (-not (Test-Path $PgZip)) { Get-WebWithRetry "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64-binaries.zip" $PgZip }

# PostgreSQL ve Node.js'in temiz Windows'ta ihtiyaç duyduğu Visual C++ çalışma zamanı.
$VcFile = Join-Path $Cache 'vc_redist.x64.exe'
Get-WebWithRetry 'https://aka.ms/vs/17/release/vc_redist.x64.exe' $VcFile
# aka.ms yönlendirmesi yayınlaştıkça değişebilir; indirilen dosyanın imzasını doğrula.
$vcSig = Get-AuthenticodeSignature -FilePath $VcFile
if ($vcSig.Status -ne 'Valid' -or $vcSig.SignerCertificate.Subject -notlike '*Microsoft*') {
  throw 'Visual C++ Redistributable imza dogrulamasi basarisiz.'
}

# ─────────────────────────────────────────────────────────────────
# 3) Taşınabilir paket klasörü
# ─────────────────────────────────────────────────────────────────
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$Out\app", "$Out\node" | Out-Null
Copy-Item "$Root\.next\standalone\*" "$Out\app\" -Recurse -Force
New-Item -ItemType Directory -Force -Path "$Out\app\.next\static" | Out-Null
Copy-Item "$Root\.next\static\*" "$Out\app\.next\static\" -Recurse -Force
if (Test-Path "$Root\public") { Copy-Item "$Root\public" "$Out\app\public" -Recurse -Force }
# Gelistirme ortamina ait baglanti bilgileri pakete ALINMAZ.
Get-ChildItem "$Out\app" -Filter '.env*' -Force -ErrorAction SilentlyContinue | Remove-Item -Force
$NodeTmp = Join-Path $Cache 'node-extract'
$PgTmp = Join-Path $Cache 'pg-extract'
foreach ($dir in @($NodeTmp,$PgTmp)) { if (Test-Path $dir) { Remove-Item $dir -Recurse -Force } }
Expand-Archive $NodeZip -DestinationPath $NodeTmp
Copy-Item (Get-ChildItem "$NodeTmp\*\node.exe").FullName "$Out\node\node.exe"
Expand-Archive $PgZip -DestinationPath $PgTmp
New-Item -ItemType Directory -Force -Path "$Out\pgsql" | Out-Null
foreach ($dir in @('bin','lib','share')) { Copy-Item "$PgTmp\pgsql\$dir" "$Out\pgsql\$dir" -Recurse -Force }
foreach ($file in @('Personel26-Baslat.bat','Personel26-Durdur.bat','Personel26-Yedekle.bat','Personel26-Yonet.ps1','schema.sql','schema-update.sql')) { Copy-Item (Join-Path $PSScriptRoot $file) $Out -Force }
Copy-Item (Join-Path $PSScriptRoot 'README-WINDOWS.md') (Join-Path $Out 'BENIOKU.md')
# Temiz Windows'ta Visual C++ yoksa kurulabilsin diye pakete dahil edilir.
Copy-Item $VcFile (Join-Path $Out 'vc_redist.x64.exe') -Force
@{ application='1.1.0'; schema='2026.01'; node=$NodeVersion; postgresql=$PgVersion; nodeSha256=(Get-FileHash $NodeZip).Hash; postgresqlSha256=(Get-FileHash $PgZip).Hash; vcRedistSha256=(Get-FileHash $VcFile).Hash } | ConvertTo-Json | Set-Content (Join-Path $Out 'manifest.json') -Encoding UTF8

if (-not $NoZip) {
  $Zip = Join-Path $Root 'Personel26-Portable.zip'
  if (Test-Path $Zip) { Remove-Item $Zip -Force }
  Compress-Archive -Path "$Out\*" -DestinationPath $Zip
}
Write-Host "Taşinabilir paket hazir: $Out" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────
# 4) Kurulum .exe'si — .iss bu dosya icinde uretilir, Inno Setup yoksa kurulur
# ─────────────────────────────────────────────────────────────────
if (-not $NoExe) {
  function Find-ISCC {
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
      if (-not $base) { continue }
      $candidate = Join-Path $base 'Inno Setup 6\ISCC.exe'
      if (Test-Path $candidate) { return $candidate }
    }
    $cmd = Get-Command 'ISCC.exe' -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
  }

  $ISCC = Find-ISCC
  if (-not $ISCC) {
    Write-Host 'Inno Setup 6 bulunamadi; sessizce kuruluyor...' -ForegroundColor Yellow
    $installed = $false
    $winget = Get-Command 'winget' -ErrorAction SilentlyContinue
    if ($winget) {
      & $winget.Source install -e --id JRSoftware.InnoSetup --silent --accept-package-agreements --accept-source-agreements | Out-Null
      $installed = [bool](Find-ISCC)
    }
    if (-not $installed) {
      $choco = Get-Command 'choco' -ErrorAction SilentlyContinue
      if ($choco) {
        & $choco.Source install innosetup -y --no-progress | Out-Null
        $installed = [bool](Find-ISCC)
      }
    }
    $ISCC = Find-ISCC
    if (-not $ISCC) {
      throw 'Inno Setup 6 kurulamadi. Elle kurulum: https://jrsoftware.org/isdl.php (kurulumdan sonra betigi tekrar calistirin) veya -NoExe ile yalnizca taşinabilir paketi uretin.'
    }
  }

  # installer.iss — betigin icinde uretilir; harici dosya tasiinaz.
  $IssTemplate = @'
#define AppName "Personel26"
#define AppVersion "1.1.0"
#define PortableDir "@@PORTABLEDIR@@"
[Setup]
AppId={{7E1B2A64-9C3D-4B8F-A2E5-P26PUANTAJ01}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Personel26
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
OutputDir=@@OUTPUTDIR@@
OutputBaseFilename=Personel26-Kurulum
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayName={#AppName} — Puantaj ve Nöbet Yönetimi
UninstallFilesDir={app}\uninstall
CloseApplications=no
[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"
[Files]
Source: "{#PortableDir}\*"; DestDir: "{app}"; Excludes: "data\*"; Flags: recursesubdirs createallsubdirs ignoreversion
[Icons]
Name: "{group}\{#AppName} Başlat"; Filename: "{app}\Personel26-Baslat.bat"; WorkingDir: "{app}"
Name: "{group}\{#AppName} Durdur"; Filename: "{app}\Personel26-Durdur.bat"; WorkingDir: "{app}"
Name: "{group}\{#AppName} Yedekle"; Filename: "{app}\Personel26-Yedekle.bat"; WorkingDir: "{app}"
Name: "{group}\{#AppName} Kaldır"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\Personel26-Baslat.bat"; WorkingDir: "{app}"; Tasks: desktopicon
[Tasks]
Name: "desktopicon"; Description: "Masaüstü kısayolu oluştur"; GroupDescription: "Kısayollar:"
[Run]
Filename: "{app}\vc_redist.x64.exe"; Description: "Gerekirse Microsoft Visual C++ çalışma zamanını kur"; Parameters: "/install /passive /norestart"; Flags: postinstall shellexec skipifsilent; Check: not VCInstalled
Filename: "{app}\Personel26-Baslat.bat"; Description: "{#AppName} şimdi başlatılsın"; Flags: postinstall nowait skipifsilent shellexec
[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Personel26-Yonet.ps1"" -Action Stop"; Flags: runhidden; RunOnceId: "StopP26"
[Code]
function VCInstalled: Boolean;
begin
  Result := FileExists(ExpandConstant('{sys}\vcruntime140.dll')) and FileExists(ExpandConstant('{sys}\msvcp140.dll'));
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\Personel26-Durdur.bat')) then
  begin
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\Personel26-Yonet.ps1') + '" -Action Stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      Result := 'Güncelleme öncesinde Personel26 kapatılamadı.'
    else if ResultCode <> 0 then
      Result := 'Personel26 kapatma işlemi başarısız. Uygulamayı kapatıp tekrar deneyin.';
  end;
end;
// Veritabanı sonradan data/ içinde oluşur ve Inno Setup tarafından kaydedilmez.
// Kaldırma veya güncelleme sırasında data/ asla silinmez.
'@
  $IssPath = Join-Path $Cache 'installer-generated.iss'
  $IssContent = $IssTemplate.Replace('@@PORTABLEDIR@@', $Out).Replace('@@OUTPUTDIR@@', $PSScriptRoot)
  Set-Content -Path $IssPath -Value $IssContent -Encoding UTF8

  $ExePath = Join-Path $PSScriptRoot 'Personel26-Kurulum.exe'
  if (Test-Path $ExePath) { Remove-Item $ExePath -Force }
  & $ISCC $IssPath
  if ($LASTEXITCODE -ne 0) { throw "Inno Setup derlemesi basarisiz (kod $LASTEXITCODE)." }
  if (-not (Test-Path $ExePath)) { throw 'Kurulum .exe dosyasi uretilmedi.' }
  Write-Host "Kurulum dosyasi hazir: $ExePath" -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────────
# 5) Özet
# ─────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '================ TAMAMLANDI ================' -ForegroundColor Green
Write-Host "  Taşinabilir klasör : $Out\Personel26-Baslat.bat"
if (-not $NoZip) { Write-Host "  Taşinabilir ZIP    : $(Join-Path $Root 'Personel26-Portable.zip')" }
if (-not $NoExe) { Write-Host "  Windows Kurulum EXE: $(Join-Path $PSScriptRoot 'Personel26-Kurulum.exe')" }
Write-Host '============================================'