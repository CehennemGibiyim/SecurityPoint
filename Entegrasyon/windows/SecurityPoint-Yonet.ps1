param(
  [ValidateSet('Start','Stop','Backup','Restore','Update','AutoStart','AutoStartOff','AutoBackup','AutoBackupOff','AutoUpdate','AutoUpdateOff','Kiosk','Doctor')][string]$Action = 'Start',
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
$ManifestFile = Join-Path $Root 'manifest.json'
$LogFile = Join-Path $Data 'yonet.log'
$ErrorFile = Join-Path $Data 'baslatma-hatasi.txt'
$UpdateStateFile = Join-Path $Data 'update-check.json'
$AutoUpdateRepo = 'CehennemGibiyim/SecurityPoint'
# Otomatik acilis (Windows otomatik baslatma klasoru) ve gunluk yedek gorevi.
$TaskName = 'SecurityPoint Gunluk Yedek'
$StartupFile = Join-Path ([Environment]::GetFolderPath('Startup')) 'SecurityPoint-Baslangic.vbs'

New-Item -ItemType Directory -Force -Path $Data | Out-Null

# ── Gunluk ve gorunur hata ──────────────────────────────────────────────
function Write-Log([string]$Message) {
  $line = '{0} {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $Message
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch { }
  Write-Host $Message
}
function Show-Failure([string]$Message, [string]$Detail) {
  $text = "SecurityPoint baslatilamadi.`r`n`r`n$Message"
  if ($Detail) { $text += "`r`n`r`nAyrinti: $Detail" }
  $text += "`r`n`r`nGunluk: $LogFile`r`nTanilama dosyasi: data\tanilama.txt ('Doctor' komutu uretir.)"
  Write-Log "HATA: $Message $Detail"
  try { Set-Content -Path $ErrorFile -Value $text -Encoding UTF8 } catch { }
  if ($env:P26_NONINTERACTIVE -eq '1') { [Console]::Error.WriteLine($text); return }
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    [void][System.Windows.Forms.MessageBox]::Show($text, 'SecurityPoint', 'OK', 'Error')
  } catch {
    try { Start-Process notepad.exe -ArgumentList $ErrorFile } catch { }
  }
}
function Get-AppVersion {
  if (Test-Path $ManifestFile) {
    try { return [string](Get-Content $ManifestFile -Raw | ConvertFrom-Json).application } catch { }
  }
  return ''
}
function ConvertTo-VersionParts([string]$Value) {
  $clean = ($Value -replace '^[vV]', '') -replace '[^0-9.].*$', ''
  if (-not $clean) { return $null }
  try { return [version]$clean } catch { return $null }
}
function Test-IsNewer([string]$Candidate, [string]$Current) {
  $c = ConvertTo-VersionParts $Candidate
  $cur = ConvertTo-VersionParts $Current
  if (-not $c) { return $false }
  if (-not $cur) { return $true }
  return ($c -gt $cur)
}

# ── Portlar ────────────────────────────────────────────────────────────
# Baska bir uygulama 3210/5433'u dinliyorsa anlasilir hata ver ya da bos port sec.
function Test-PortListening([int]$Port) {
  $client = New-Object Net.Sockets.TcpClient
  try {
    $task = $client.ConnectAsync('127.0.0.1', $Port)
    if ($task.Wait(500) -and $client.Connected) { return $true }
    return $false
  } catch { return $false } finally { $client.Dispose() }
}
function Get-FreePort([int]$Preferred, [int]$Count = 10) {
  for ($port = $Preferred; $port -lt ($Preferred + $Count); $port++) {
    if (-not (Test-PortListening $port)) { return $port }
  }
  throw "Bos port bulunamadi ($Preferred-$($Preferred + $Count - 1))."
}
function Save-Config {
  $Config | ConvertTo-Json | Set-Content $ConfigFile -Encoding UTF8
  $env:PGPASSWORD = $Config.password
}
function Pg-Args {
  return @('-h','127.0.0.1','-p',[string]$Config.pgPort,'-U',$Config.user)
}

# ── Otomatik acilis / gunluk yedek ─────────────────────────────────────
function Set-AutoStart([bool]$Enable) {
  if ($Enable) {
    $psPath = Join-Path $Root 'SecurityPoint-Yonet.ps1'
    $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $psPath + '" -Action Start'
    $content = 'Set sh = CreateObject("WScript.Shell")' + "`r`n" + 'sh.Run "' + ($cmd -replace '"','""') + '", 0, False' + "`r`n"
    # UTF-8 BOM ile yazilir ki WSH Turkce karakterli yollari dogru okusun.
    [IO.File]::WriteAllText($StartupFile, $content, [Text.UTF8Encoding]::new($true))
    if (-not (Test-Path $StartupFile)) { throw 'Otomatik baslatma kaydi yazilamadi.' }
    Write-Log "Otomatik baslatma acildi (Windows acilis klasoru): $StartupFile"
  } else {
    Remove-Item $StartupFile -Force -ErrorAction SilentlyContinue
    Write-Log 'Otomatik baslatma kapatildi.'
  }
}
function Set-AutoBackup([bool]$Enable) {
  if ($Enable) {
    # schtasks /TR icindeki ic ice tirnaklar Windows PowerShell 5.1'de
    # bozuldugu icin ScheduledTasks modulu (nesne tabanli, tirmnak oyunu yok) kullanilir.
    $psPath = Join-Path $Root 'SecurityPoint-Yonet.ps1'
    $arg = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $psPath + '" -Action Backup'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
    $trigger = New-ScheduledTaskTrigger -Daily -At (Get-Date -Hour 19 -Minute 0 -Second 0)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Force | Out-Null
    if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) { throw 'Gunluk yedek gorevi olusturulamadi.' }
    Write-Log "Gunluk otomatik yedek acildi (her gun 19:00): $TaskName"
  } else {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    Write-Log 'Gunluk otomatik yedek gorevi silindi.'
  }
}
function Set-AutoUpdate([bool]$Enable) {
  $Config | Add-Member -NotePropertyName autoUpdate -NotePropertyValue $Enable -Force
  Save-Config
  if ($Enable) { Write-Log 'Otomatik guncelleme acildi (acilista yeni surum denetlenir).' }
  else { Write-Log 'Otomatik guncelleme kapatildi.' }
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
  Write-Log 'SecurityPoint kapatildi. Veriler data klasorunde korundu.'
}
if ($Action -eq 'Stop') { Stop-All; exit 0 }
if ($Action -in 'AutoStart','AutoStartOff','AutoBackup','AutoBackupOff') {
  # Yonetim eylemleri: veritabani/sunucu kurulumuna dokunmadan calisir.
  switch ($Action) {
    'AutoStart'     { Set-AutoStart $true }
    'AutoStartOff'  { Set-AutoStart $false }
    'AutoBackup'    { Set-AutoBackup $true }
    'AutoBackupOff' { Set-AutoBackup $false }
  }
  exit 0
}
if (-not (Test-Path (Join-Path $Root 'node\node.exe')) -or -not (Test-Path (Join-Path $PgBin 'postgres.exe'))) {
  throw 'Pakette tasinabilir Node.js veya PostgreSQL eksik. Kurulum dosyasini yeniden calistirin.'
}
if (-not (Test-Path $ConfigFile)) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $config = @{ user = 'personel26'; password = [Convert]::ToBase64String($bytes); database = 'personel26'; pgPort = 5433; appPort = 3210; autoUpdate = $true }
  $config | ConvertTo-Json | Set-Content $ConfigFile -Encoding UTF8
  # Yalnizca mevcut kullanici ve SYSTEM bu yerel baglanti dosyasini okuyabilir.
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $ConfigFile /inheritance:r /grant:r "${identity}:(F)" 'SYSTEM:(F)' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Baglanti dosyasi izinleri ayarlanamadi.' }
}
$Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
# Eski kurulumlarda alan yoksa varsayilanlari ekle (veri silinmez).
if ($null -eq $Config.PSObject.Properties['autoUpdate']) { $Config | Add-Member -NotePropertyName autoUpdate -NotePropertyValue $true -Force; Save-Config }
$env:PGPASSWORD = $Config.password
if ($Action -in 'AutoUpdate','AutoUpdateOff') { Set-AutoUpdate ($Action -eq 'AutoUpdate'); exit 0 }

function Start-PgServer {
  # pg_ctl start komutu boru hattina (| Write-Host) baglanirsa, arka planda kalan
  # postgres sureci ayni boruyu miras alir ve PowerShell hic bitmez. Bu yuzden
  # sunucu ayri bir surec olarak baslatilir, hazir olana kadar pg_isready ile beklenir.
  $pgCtl = Join-Path $PgBin 'pg_ctl.exe'
  $isReady = Join-Path $PgBin 'pg_isready.exe'
  $log = Join-Path $Data 'postgres.log'
  if (Test-PortListening ([int]$Config.pgPort)) {
    # Baska bir PostgreSQL/uygulama 5433'u tutuyorsa bos bir porta gec ve kaydet.
    $newPort = Get-FreePort (([int]$Config.pgPort) + 1)
    Write-Log "PostgreSQL portu $($Config.pgPort) dolu; $newPort portuna geciliyor."
    $Config.pgPort = $newPort
    Save-Config
  }
  $args = @('start','-D',('"' + $PgData + '"'),'-o',('"-p ' + $Config.pgPort + ' -c listen_addresses=127.0.0.1"'),'-l',('"' + $log + '"'))
  Start-Process -FilePath $pgCtl -ArgumentList $args -WindowStyle Hidden | Out-Null
  for ($i = 0; $i -lt 60; $i++) {
    & $isReady -h 127.0.0.1 -p ([string]$Config.pgPort) *> $null
    if ($LASTEXITCODE -eq 0) { Write-Log 'PostgreSQL hazir.'; return }
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
  $exists = & (Join-Path $PgBin 'psql.exe') (Pg-Args) -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='personel26'"
  if ($LASTEXITCODE -ne 0) { throw 'Veritabani baglantisi kurulamadi. data/postgres.log dosyasini inceleyin.' }
  if (-not $exists) { Invoke-Pg -Tool 'createdb' -Arguments ((Pg-Args) + @($Config.database)) }
  $table = & (Join-Path $PgBin 'psql.exe') (Pg-Args) -d $Config.database -tAc "SELECT to_regclass('public.personnel')"
  if ($LASTEXITCODE -ne 0) { throw 'Sema kontrol edilemedi.' }
  if (-not $table) { Invoke-Pg -Tool 'psql' -Arguments ((Pg-Args) + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','--single-transaction','-f',(Join-Path $Root 'schema.sql'))) }
  # Her baslatmada idempotent guncelleme; kayitlari silmez.
  Invoke-Pg -Tool 'psql' -Arguments ((Pg-Args) + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','-f',(Join-Path $Root 'schema-update.sql')))
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
  if (Test-Path $RuntimeFile) {
    $runtime = Get-Content $RuntimeFile -Raw | ConvertFrom-Json
    $running = Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue
    if ($running -and $running.Path -eq (Join-Path $Root 'node\node.exe')) { Wait-Health; return }
  }
  if (Test-PortListening ([int]$Config.appPort)) {
    $newPort = Get-FreePort (([int]$Config.appPort) + 1)
    Write-Log "Uygulama portu $($Config.appPort) dolu; $newPort portuna geciliyor."
    $Config.appPort = $newPort
    Save-Config
  }
  Ensure-Database
  $encoded = [Uri]::EscapeDataString($Config.password)
  $env:DATABASE_URL = "postgresql://$($Config.user):${encoded}@127.0.0.1:$($Config.pgPort)/$($Config.database)"
  $env:PORT = [string]$Config.appPort
  $env:HOSTNAME = '127.0.0.1'
  $env:NODE_ENV = 'production'
  $stdout = Join-Path $Data 'app.log'
  $stderr = Join-Path $Data 'app-error.log'
  # Onceki calistirmadan kalan kilit/log varsa temizle.
  Remove-Item $stdout, $stderr -Force -ErrorAction SilentlyContinue
  $app = Start-Process -FilePath (Join-Path $Root 'node\node.exe') -ArgumentList @('server.js') -WorkingDirectory (Join-Path $Root 'app') -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
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
  Invoke-Pg -Tool 'pg_dump' -Arguments ((Pg-Args) + @('-d',$Config.database,'--clean','--if-exists','--no-owner','--no-privileges','-f',$Destination))
  if (-not (Test-Path $Destination) -or (Get-Item $Destination).Length -eq 0) { throw 'SQL yedegi olusturulamadi.' }
  Write-Log "SQL yedegi: $Destination"
  return $Destination
}
# Temiz Windows'ta Visual C++ calisma zamani (vcruntime140/msvcp140) yoksa
# paketle gelen resmi Microsoft kurucusunu calistir; PostgreSQL bunlara muhtac.
function Ensure-VcRuntime {
  $sys32 = Join-Path $env:SystemRoot 'System32'
  if ((Test-Path (Join-Path $sys32 'vcruntime140.dll')) -and (Test-Path (Join-Path $sys32 'msvcp140.dll'))) { return }
  $redist = Join-Path $Root 'vc_redist.x64.exe'
  if (-not (Test-Path $redist)) { return }
  Write-Log 'Visual C++ calisma zamani bulunamadi - Microsoft Visual C++ Redistributable kuruluyor...'
  try {
    $p = Start-Process -FilePath $redist -ArgumentList '/install','/passive','/norestart' -PassThru -Wait
    if ($p.ExitCode -in 0,1641,3010) { Write-Log 'Visual C++ calisma zamani hazir.' }
    else { Write-Log "UYARI: Visual C++ kurulusu kod $($p.ExitCode) ile bitti; PostgreSQL baslamazsa kurulumu elle tamamlayin." }
  } catch {
    Write-Log "UYARI: Visual C++ kurulumu calistirilamadi: $($_.Exception.Message)"
  }
}

# ── Guncelleme ─────────────────────────────────────────────────────────
function Update-App([string]$SourcePath, [bool]$Auto) {
  if (-not $SourcePath -or -not (Test-Path (Join-Path $SourcePath 'app\server.js'))) {
    throw 'Yeni portable paket klasorunu belirtin (app\server.js icermeli).'
  }
  Stop-App; Ensure-Database
  $safety = Native-Backup ''
  $old = Join-Path $Data 'app-before-update'
  if (Test-Path $old) { Remove-Item $old -Recurse -Force }
  Move-Item (Join-Path $Root 'app') $old
  try {
    Copy-Item (Join-Path $SourcePath 'app') (Join-Path $Root 'app') -Recurse -Force
    if (Test-Path (Join-Path $SourcePath 'schema-update.sql')) {
      Copy-Item (Join-Path $SourcePath 'schema-update.sql') (Join-Path $Root 'schema-update.sql') -Force
    }
    if (Test-Path (Join-Path $SourcePath 'manifest.json')) {
      Copy-Item (Join-Path $SourcePath 'manifest.json') $ManifestFile -Force
    }
    Start-App
    Remove-Item $old -Recurse -Force -ErrorAction SilentlyContinue
    Write-Log "Guncelleme tamamlandi. Veriler korundu. Guvenlik yedegi: $safety"
  } catch {
    Stop-App
    if (Test-Path (Join-Path $Root 'app')) { Remove-Item (Join-Path $Root 'app') -Recurse -Force }
    Move-Item $old (Join-Path $Root 'app')
    Start-App
    if ($Auto) { throw "Otomatik guncelleme geri alindi: $($_.Exception.Message)" }
    throw 'Guncelleme basarisiz; onceki uygulama geri alindi. SQL guvenlik yedegi data/backups icinde.'
  }
}
function Invoke-AutoUpdate {
  if ($env:P26_NO_UPDATE -eq '1') { return }
  if ($Config.autoUpdate -eq $false) { return }
  if (-not (Test-Path $ManifestFile)) { return }   # Gelistirme calisma alani
  $current = Get-AppVersion
  if (-not $current) { return }
  # 6 saatten sik denetleme (GitHub API'sini bos yere yormamak icin).
  if (Test-Path $UpdateStateFile) {
    try {
      $state = Get-Content $UpdateStateFile -Raw | ConvertFrom-Json
      if ($state.lastCheck -and ((Get-Date) - [datetime]$state.lastCheck).TotalHours -lt 6) { return }
    } catch { }
  }
  @{ lastCheck = (Get-Date).ToString('o'); checkedBy = $current } | ConvertTo-Json | Set-Content $UpdateStateFile -Encoding UTF8
  try {
    $headers = @{ 'User-Agent' = 'SecurityPoint'; 'Accept' = 'application/vnd.github+json' }
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$AutoUpdateRepo/releases/latest" -Headers $headers -TimeoutSec 20
  } catch {
    Write-Log "Guncelleme denetimi yapilamadi (cevrimdisi olabilir): $($_.Exception.Message)"
    return
  }
  $latest = [string]$release.tag_name
  if (-not (Test-IsNewer $latest $current)) { return }
  $asset = $release.assets | Where-Object { $_.name -like 'SecurityPoint-Portable*.zip' } | Select-Object -First 1
  if (-not $asset) { Write-Log "Yeni surum ($latest) var ancak portable paket bulunamadi."; return }

  Write-Log "Yeni surum bulundu: $latest (kurulu: $current). Indiriliyor..."
  $dir = Join-Path $Data ('updates\' + ($latest -replace '[^0-9A-Za-z.-]', ''))
  $zip = "$dir.zip"
  try {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing -TimeoutSec 900
    Expand-Archive -Path $zip -DestinationPath $dir -Force
    $package = (Get-ChildItem $dir -Recurse -Filter 'server.js' | Where-Object { $_.DirectoryName -like '*app*' } | Select-Object -First 1)
    if (-not $package) { throw 'Indirilen pakette app\server.js bulunamadi.' }
    Update-App -SourcePath (Split-Path -Parent $package.DirectoryName) -Auto $true
    Write-Log "Otomatik guncelleme tamamlandi: $latest"
  } catch {
    Write-Log "Otomatik guncelleme uygulanamadi: $($_.Exception.Message). Mevcut surumle devam ediliyor."
  } finally {
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ── Tanilama ───────────────────────────────────────────────────────────
function Get-DoctorReport {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('SecurityPoint tanilama raporu')
  $lines.Add('Olusturulma : ' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))
  $lines.Add('Surum      : ' + (Get-AppVersion))
  $lines.Add('Klasor     : ' + $Root)
  $lines.Add('Windows    : ' + [Environment]::OSVersion.VersionString)
  $lines.Add('PowerShell : ' + $PSVersionTable.PSVersion.ToString())
  $lines.Add('Kullanici  : ' + [Environment]::UserName)
  $lines.Add('')
  $lines.Add('-- Dosyalar')
  foreach ($item in @('node\node.exe','pgsql\bin\postgres.exe','app\server.js','manifest.json','schema.sql','schema-update.sql')) {
    $state = $(if (Test-Path (Join-Path $Root $item)) { 'var' } else { 'YOK' })
    $lines.Add(('{0,-24} {1}' -f $item, $state))
  }
  $pgState = $(if (Test-Path (Join-Path $PgData 'PG_VERSION')) { 'var' } else { 'YOK (ilk kurulum yapilmadi)' })
  $lines.Add(('{0,-24} {1}' -f 'data\PG_VERSION', $pgState))
  $lines.Add('')
  $lines.Add('-- Yapilandirma')
  if (Test-Path $ConfigFile) {
    $lines.Add(('appPort  : {0}' -f $Config.appPort))
    $lines.Add(('pgPort   : {0}' -f $Config.pgPort))
    $lines.Add(('autoUpdate: {0}' -f $Config.autoUpdate))
    $lines.Add('Sifre    : (guvenlik nedeniyle yazilmaz)')
  } else { $lines.Add('connection.json YOK') }
  $lines.Add('')
  $lines.Add('-- Calisma durumu')
  foreach ($port in @($Config.appPort, $Config.pgPort)) {
    if ($port) {
      $portState = $(if (Test-PortListening ([int]$port)) { 'DINLENIYOR' } else { 'bos' })
      $lines.Add(('port {0,-6} {1}' -f $port, $portState))
    }
  }
  if (Test-Path $RuntimeFile) {
    try {
      $runtime = Get-Content $RuntimeFile -Raw | ConvertFrom-Json
      $proc = Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue
      $appState = $(if ($proc) { 'calisiyor' } else { 'YOK' })
      $lines.Add(('Uygulama PID {0}: {1}' -f $runtime.pid, $appState))
    } catch { }
  } else { $lines.Add('runtime.json YOK (uygulama calismiyor)') }
  if (Test-Path (Join-Path $PgData 'PG_VERSION')) {
    & (Join-Path $PgBin 'pg_ctl.exe') status -D $PgData *> $null
    $pgRun = $(if ($LASTEXITCODE -eq 0) { 'calisiyor' } else { 'kapali' })
    $lines.Add('PostgreSQL: ' + $pgRun)
  }
  $lines.Add('')
  foreach ($logName in @('app-error.log','app.log','postgres.log','yonet.log')) {
    $path = Join-Path $Data $logName
    $lines.Add("-- $logName (son 25 satir)")
    if (Test-Path $path) {
      $tail = Get-Content $path -Tail 25 -ErrorAction SilentlyContinue
      if ($tail) { $lines.AddRange([string[]]$tail) } else { $lines.Add('(bos)') }
    } else { $lines.Add('(dosya yok)') }
    $lines.Add('')
  }
  return ($lines -join "`r`n")
}

# ── Ana akis ───────────────────────────────────────────────────────────
try {
  if ($Action -eq 'Doctor') {
    $report = Get-DoctorReport
    $target = Join-Path $Data 'tanilama.txt'
    Set-Content -Path $target -Value $report -Encoding UTF8
    Write-Host $report
    Write-Host ''
    Write-Host "Tanilama dosyasi: $target" -ForegroundColor Green
    exit 0
  }

  Ensure-VcRuntime

  switch ($Action) {
    'Start' {
      Invoke-AutoUpdate
      Start-App
      $url = "http://127.0.0.1:$($Config.appPort)"
      if (-not $NoBrowser -and $env:P26_NO_BROWSER -ne '1') {
        try { Start-Process $url } catch { Write-Log "Tarayici acilamadi. Adres: $url" }
      }
      Write-Log "SecurityPoint hazir: $url"
    }
    'Kiosk' {
      Invoke-AutoUpdate
      Start-App
      $url = "http://127.0.0.1:$($Config.appPort)/terminal?kiosk=1"
      $edge = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
      ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
      if ($edge) { Start-Process -FilePath $edge -ArgumentList @('--kiosk', $url, '--edge-kiosk-type=fullscreen') }
      else { Start-Process $url }
      Write-Log "Kiosk modu acildi: $url"
    }
    'Backup' { Native-Backup $BackupFile | Out-Null }
    'Restore' {
      if (-not $BackupFile -or -not (Test-Path $BackupFile) -or [IO.Path]::GetExtension($BackupFile) -ne '.sql') { throw 'Gecerli bir SecurityPoint SQL yedegi secin.' }
      Stop-App; Ensure-Database
      $safety = Native-Backup ''
      Invoke-Pg -Tool 'psql' -Arguments ((Pg-Args) + @('-d',$Config.database,'-v','ON_ERROR_STOP=1','--single-transaction','-f',$BackupFile))
      Start-App
      Write-Log "Geri yukleme tamamlandi. Guvenlik yedegi: $safety"
    }
    'Update' { Update-App -SourcePath $PackagePath -Auto $false }
  }
} catch {
  Show-Failure $_.Exception.Message ''
  exit 1
}
