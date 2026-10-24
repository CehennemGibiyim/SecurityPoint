param(
  [ValidateSet('Start','Stop','Backup','Restore','Update','AutoStart','AutoStartOff','AutoBackup','AutoBackupOff','Kiosk')][string]$Action = 'Start',
  [string]$BackupFile,
  [string]$PackagePath,
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Data = Join-Path $Root 'data'
$PgBin = Join-Path $Root 'pgsql\bin'
$PgData = Join-Path $Data 'pgdata'
$RuntimeFile = Join-Path $Data 'runtime.json'
$ConfigFile = Join-Path $Data 'connection.json'
# Otomatik acilis (Windows otomatik baslatma klasoru) ve gunluk yedek gorevi.
$TaskName = 'Personel26 Gunluk Yedek'
$StartupFile = Join-Path ([Environment]::GetFolderPath('Startup')) 'Personel26-Baslangic.vbs'

# Yonetim eylemleri: veritabani/sunucu kurulumuna dokunmadan calisir
# (kurulum ve kaldirma sirasinda dosyalar yerindedir, yonetici yetkisi gerekmez).
function Set-AutoStart([bool]$Enable) {
  if ($Enable) {
    $psPath = Join-Path $Root 'Personel26-Yonet.ps1'
    $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $psPath + '" -Action Start'
    $content = 'Set sh = CreateObject("WScript.Shell")' + "`r`n" + 'sh.Run "' + ($cmd -replace '"','""') + '", 0, False' + "`r`n"
    # UTF-8 BOM ile yazilir ki WSH Turkce karakterli yollari dogru okusun.
    [IO.File]::WriteAllText($StartupFile, $content, [Text.UTF8Encoding]::new($true))
    if (-not (Test-Path $StartupFile)) { throw 'Otomatik baslatma kaydi yazilamadi.' }
    Write-Host "Otomatik baslatma acildi (Windows acilis klasoru): $StartupFile"
  } else {
    Remove-Item $StartupFile -Force -ErrorAction SilentlyContinue
    Write-Host 'Otomatik baslatma kapatildi.'
  }
}
function Set-AutoBackup([bool]$Enable) {
  if ($Enable) {
    # schtasks /TR icindeki ic ice tirnaklar Windows PowerShell 5.1'de
    # bozuldugu icin ScheduledTasks modulu (nesne tabanli, tirmnak oyunu yok) kullanilir.
    $psPath = Join-Path $Root 'Personel26-Yonet.ps1'
    $arg = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $psPath + '" -Action Backup'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
    $trigger = New-ScheduledTaskTrigger -Daily -At (Get-Date -Hour 19 -Minute 0 -Second 0)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Force | Out-Null
    if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) { throw 'Gunluk yedek gorevi olusturulamadi.' }
    Write-Host "Gunluk otomatik yedek acildi (her gun 19:00): $TaskName"
  } else {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    Write-Host 'Gunluk otomatik yedek gorevi silindi.'
  }
}
function Invoke-Pg([string]$Tool, [string[]]$Arguments) {
  $Executable = Join-Path $PgBin ($Tool + '.exe')
  if (-not (Test-Path $Executable)) { throw "Pakette $Tool bulunamadi." }
  $PreviousPreference = $ErrorActionPreference
  $Code = 0
  try {
    # Windows PowerShell 5.1 stderr NOTICE mesajlarini ErrorRecord'a cevirir.
    # Normal bilgileri kaydet; basarisizligi gercek native exit koduyla belirle.
    $ErrorActionPreference = 'Continue'
    & $Executable @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
    $Code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $PreviousPreference }
  if ($Code -ne 0) { throw "$Tool basarisiz oldu (kod $Code). data klasorundeki loglari inceleyin." }
}
function Stop-App {
  if (Test-Path $RuntimeFile) {
    $runtime = Get-Content $RuntimeFile -Raw | ConvertFrom-Json
    $process = Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue
    $expected = [IO.Path]::GetFullPath((Join-Path $Root 'node\node.exe'))
    # Baska uygulamalara ait node.exe sureclerine asla dokunma.
    if ($process -and $process.Path -and [IO.Path]::GetFullPath($process.Path) -eq $expected) {
      Stop-Process -Id $runtime.pid -Force
      Wait-Process -Id $runtime.pid -Timeout 15 -ErrorAction SilentlyContinue
    }
    Remove-Item $RuntimeFile -Force -ErrorAction SilentlyContinue
  }
}
function Stop-All {
  Stop-App
  if (Test-Path (Join-Path $PgData 'PG_VERSION')) {
    & (Join-Path $PgBin 'pg_ctl.exe') status -D $PgData *> $null
    if ($LASTEXITCODE -eq 0) { Invoke-Pg -Tool 'pg_ctl' -Arguments @('stop','-D',$PgData,'-m','fast','-w','-t','60') }
  }
  Write-Host 'Personel26 kapatildi. Veriler data klasorunde korundu.'
}
if ($Action -eq 'Stop') { Stop-All; exit 0 }
if ($Action -in 'AutoStart','AutoStartOff','AutoBackup','AutoBackupOff') {
  switch ($Action) {
    'AutoStart'     { Set-AutoStart $true }
    'AutoStartOff'  { Set-AutoStart $false }
    'AutoBackup'    { Set-AutoBackup $true }
    'AutoBackupOff' { Set-AutoBackup $false }
  }
  exit 0
}
if (-not (Test-Path (Join-Path $Root 'node\node.exe')) -or -not (Test-Path (Join-Path $PgBin 'postgres.exe'))) { throw 'Pakette tasinabilir Node.js veya PostgreSQL eksik.' }
New-Item -ItemType Directory -Force -Path $Data | Out-Null
if (-not (Test-Path $ConfigFile)) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $config = @{ user = 'personel26'; password = [Convert]::ToBase64String($bytes); database = 'personel26'; pgPort = 5433; appPort = 3210 }
  $config | ConvertTo-Json | Set-Content $ConfigFile -Encoding UTF8
  # Yalnizca mevcut kullanici ve SYSTEM bu yerel baglanti dosyasini okuyabilir.
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $ConfigFile /inheritance:r /grant:r "${identity}:(F)" 'SYSTEM:(F)' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Baglanti dosyasi izinleri ayarlanamadi.' }
}
$Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$env:PGPASSWORD = $Config.password
$PgArgs = @('-h','127.0.0.1','-p',[string]$Config.pgPort,'-U',$Config.user)
function Start-PgServer {
  # pg_ctl start komutu boru hattina (| Write-Host) baglanirsa, arka planda kalan
  # postgres sureci ayni boruyu miras alir ve PowerShell hic bitmez. Bu yuzden
  # sunucu ayri bir surec olarak baslatilir, hazir olana kadar pg_isready ile beklenir.
  $pgCtl = Join-Path $PgBin 'pg_ctl.exe'
  $isReady = Join-Path $PgBin 'pg_isready.exe'
  $log = Join-Path $Data 'postgres.log'
  $args = @('start','-D',('"' + $PgData + '"'),'-o',('"-p ' + $Config.pgPort + ' -c listen_addresses=127.0.0.1"'),'-l',('"' + $log + '"'))
  Start-Process -FilePath $pgCtl -ArgumentList $args -WindowStyle Hidden | Out-Null
  for ($i = 0; $i -lt 60; $i++) {
    & $isReady -h 127.0.0.1 -p ([string]$Config.pgPort) *> $null
    if ($LASTEXITCODE -eq 0) { Write-Host 'PostgreSQL hazir.'; return }
    Start-Sleep -Seconds 1
  }
  throw 'PostgreSQL 60 saniyede baslamadi. data/postgres.log dosyasini inceleyin.'
}
function Ensure-Database {
  if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) {
    $pwfile = Join-Path $Data ('pw-' + [guid]::NewGuid().ToString() + '.tmp')
    try {
      [IO.File]::WriteAllText($pwfile,$Config.password,[Text.Encoding]::ASCII)
      Invoke-Pg -Tool 'initdb' -Arguments @('-D',$PgData,'-U',$Config.user,'-A','scram-sha-256',"--pwfile=$pwfile",'-E','UTF8','--locale=C')
    } finally { Remove-Item $pwfile -Force -ErrorAction SilentlyContinue }
  }
  & (Join-Path $PgBin 'pg_ctl.exe') status -D $PgData *> $null
  if ($LASTEXITCODE -ne 0) {
    Start-PgServer
  }
  $exists = & (Join-Path $PgBin 'psql.exe') @PgArgs -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='personel26'"
  if ($LASTEXITCODE -ne 0) { throw 'Veritabani baglantisi kurulamadı.' }
  if (-not $exists) { Invoke-Pg -Tool 'createdb' -Arguments ($PgArgs + @($Config.database)) }
  $table = & (Join-Path $PgBin 'psql.exe') @PgArgs -d $Config.database -tAc "SELECT to_regclass('public.personnel')"
  if ($LASTEXITCODE -ne 0) { throw 'Sema kontrol edilemedi.' }
  if (-not $table) { Invoke-Pg -Tool 'psql' -Arguments ($PgArgs + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','--single-transaction','-f',(Join-Path $Root 'schema.sql'))) }
  # Her baslatmada idempotent guncelleme; kayitlari silmez.
  Invoke-Pg -Tool 'psql' -Arguments ($PgArgs + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','-f',(Join-Path $Root 'schema-update.sql')))
}
function Wait-Health {
  $url = "http://127.0.0.1:$($Config.appPort)/api/health"
  for ($i = 0; $i -lt 60; $i++) {
    try { if ((Invoke-RestMethod $url -TimeoutSec 2).ok) { return } } catch { }
    Start-Sleep -Seconds 1
  }
  throw 'Uygulama saglik kontrolu gecmedi. data/app-error.log dosyasini inceleyin.'
}
function Start-App {
  Ensure-Database
  if (Test-Path $RuntimeFile) {
    $runtime = Get-Content $RuntimeFile -Raw | ConvertFrom-Json
    $running = Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue
    if ($running -and $running.Path -eq (Join-Path $Root 'node\node.exe')) { Wait-Health; return }
  }
  $encoded = [Uri]::EscapeDataString($Config.password)
  $env:DATABASE_URL = "postgresql://$($Config.user):${encoded}@127.0.0.1:$($Config.pgPort)/$($Config.database)"
  $env:PORT = [string]$Config.appPort
  $env:HOSTNAME = '127.0.0.1'
  $env:NODE_ENV = 'production'
  $app = Start-Process -FilePath (Join-Path $Root 'node\node.exe') -ArgumentList @('server.js') -WorkingDirectory (Join-Path $Root 'app') -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Data 'app.log') -RedirectStandardError (Join-Path $Data 'app-error.log')
  @{pid=$app.Id; root=$Root} | ConvertTo-Json | Set-Content $RuntimeFile -Encoding UTF8
  try { Wait-Health } catch { Stop-App; throw }
}
function Native-Backup([string]$Destination) {
  Ensure-Database
  if (-not $Destination) {
    $dir = Join-Path $Data 'backups'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $Destination = Join-Path $dir ('personel26-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.sql')
  }
  Invoke-Pg -Tool 'pg_dump' -Arguments ($PgArgs + @('-d',$Config.database,'--clean','--if-exists','--no-owner','--no-privileges','-f',$Destination))
  if (-not (Test-Path $Destination) -or (Get-Item $Destination).Length -eq 0) { throw 'SQL yedegi olusturulamadi.' }
  Write-Host "SQL yedegi: $Destination"
  return $Destination
}
# Temiz Windows'ta Visual C++ calisma zamani (vcruntime140/msvcp140) yoksa
# paketle gelen resmi Microsoft kurucusunu calistir; PostgreSQL bunlara muhtac.
function Ensure-VcRuntime {
  $sys32 = Join-Path $env:SystemRoot 'System32'
  if ((Test-Path (Join-Path $sys32 'vcruntime140.dll')) -and (Test-Path (Join-Path $sys32 'msvcp140.dll'))) { return }
  $redist = Join-Path $Root 'vc_redist.x64.exe'
  if (-not (Test-Path $redist)) { return }
  Write-Host 'Visual C++ calisma zamani bulunamadi — Microsoft Visual C++ Redistributable kuruluyor...'
  Write-Host '(Windows onay penceresi cikarsa "Evet" deyin.)'
  try {
    $p = Start-Process -FilePath $redist -ArgumentList '/install','/passive','/norestart' -PassThru -Wait
    if ($p.ExitCode -in 0,1641,3010) { Write-Host 'Visual C++ calisma zamani hazir.' }
    else { Write-Host "UYARI: Visual C++ kurulusu kod $($p.ExitCode) ile bitti; PostgreSQL baslamazsa kurulumu elle tamamlayin." -ForegroundColor Yellow }
  } catch {
    Write-Host "UYARI: Visual C++ kurulumu calistirilamadi: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
if ($Action -ne 'Stop') { Ensure-VcRuntime }

switch ($Action) {
  'Start' { Start-App; if (-not $NoBrowser -and $env:P26_NO_BROWSER -ne '1') { Start-Process "http://127.0.0.1:$($Config.appPort)" }; Write-Host 'Personel26 hazir.' }
  'Kiosk' {
    Start-App
    $url = "http://127.0.0.1:$($Config.appPort)/terminal?kiosk=1"
    $edge = @(
      "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
      "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
      "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if ($edge) { Start-Process -FilePath $edge -ArgumentList @('--kiosk', $url, '--edge-kiosk-type=fullscreen') }
    else { Start-Process $url }
    Write-Host "Kiosk modu acildi: $url"
  }
  'Backup' { Native-Backup $BackupFile | Out-Null }
  'Restore' {
    if (-not $BackupFile -or -not (Test-Path $BackupFile) -or [IO.Path]::GetExtension($BackupFile) -ne '.sql') { throw 'Gecerli bir Personel26 SQL yedegi secin.' }
    Stop-App; Ensure-Database
    $safety = Native-Backup ''
    Invoke-Pg -Tool 'psql' -Arguments ($PgArgs + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','--single-transaction','-f',$BackupFile))
    Start-App
    Write-Host "Geri yukleme tamamlandi. Guvenlik yedegi: $safety"
  }
  'Update' {
    if (-not $PackagePath -or -not (Test-Path (Join-Path $PackagePath 'app\server.js'))) { throw 'Yeni portable paket klasorunu belirtin.' }
    Stop-App; Ensure-Database
    $safety = Native-Backup ''
    $old = Join-Path $Data 'app-before-update'
    if (Test-Path $old) { Remove-Item $old -Recurse -Force }
    Move-Item (Join-Path $Root 'app') $old
    try {
      Copy-Item (Join-Path $PackagePath 'app') (Join-Path $Root 'app') -Recurse -Force
      Copy-Item (Join-Path $PackagePath 'schema-update.sql') (Join-Path $Root 'schema-update.sql') -Force
      Start-App
      Remove-Item $old -Recurse -Force
      Write-Host "Guncelleme tamamlandi. Veriler korundu. Guvenlik yedegi: $safety"
    } catch {
      Stop-App
      if (Test-Path (Join-Path $Root 'app')) { Remove-Item (Join-Path $Root 'app') -Recurse -Force }
      Move-Item $old (Join-Path $Root 'app')
      Start-App
      throw 'Guncelleme basarisiz; onceki uygulama geri alindi. SQL guvenlik yedegi data/backups icinde.'
    }
  }
}
