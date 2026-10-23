param([Parameter(Mandatory=$true)][string]$DistributionPath)
$ErrorActionPreference = 'Stop'
$ReportDir = Join-Path (Get-Location) '.artifacts\windows-tests'
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$Checks = New-Object System.Collections.Generic.List[object]
$TempRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$Target = Join-Path $TempRoot 'Personel26 clean installation'
$Package = Join-Path $TempRoot 'Personel26 update source'
$PowerShell = (Get-Command powershell.exe).Source
$PreviousPath = $env:PATH
$UnrelatedProcess = $null
function Assert-Check([string]$Name,[bool]$Condition) {
  $Checks.Add(@{ name=$Name; passed=$Condition; time=(Get-Date).ToUniversalTime().ToString('o') })
  if (-not $Condition) { throw "TEST BASARISIZ: $Name" }
  Write-Host "PASS: $Name" -ForegroundColor Green
}
function Manager([string]$Mode,[string[]]$More=@()) {
  & $PowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'Personel26-Yonet.ps1') -Action $Mode -NoBrowser @More
  if ($LASTEXITCODE -ne 0) { throw "Yonetim komutu basarisiz: $Mode" }
}
function Api([string]$Path,[string]$Method='GET',$Body=$null) {
  $args = @{ Uri="http://127.0.0.1:3210$Path"; Method=$Method; TimeoutSec=60 }
  if ($null -ne $Body) { $args.ContentType='application/json; charset=utf-8'; $args.Body=[Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 20)) }
  return Invoke-RestMethod @args
}
try {
  $Installer = (Get-ChildItem $DistributionPath -Recurse -Filter 'Personel26-Kurulum.exe' | Select-Object -First 1).FullName
  $Zip = (Get-ChildItem $DistributionPath -Recurse -Filter 'Personel26-Portable.zip' | Select-Object -First 1).FullName
  if (-not $Installer -or -not $Zip) { throw 'Kurulum veya portable ZIP eksik.' }
  if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
  if (Test-Path $Package) { Remove-Item $Package -Recurse -Force }
  Expand-Archive $Zip -DestinationPath $Package
  $install = Start-Process $Installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-',"/DIR=`"$Target`"","/LOG=`"$ReportDir\install.log`"") -Wait -PassThru
  Assert-Check 'Sessiz kullanici kurulumu' ($install.ExitCode -eq 0 -and (Test-Path (Join-Path $Target 'app\server.js')))
  # GitHub runner'lari gercek bos Windows imajlari degildir. Bu test sistemdeki
  # Node/PostgreSQL'e erisimi kapatir ve SADECE paketlenmis exe'leri kullanir.
  Get-Service -Name '*postgres*' -ErrorAction SilentlyContinue | Where-Object {$_.Status -eq 'Running'} | Stop-Service -Force -ErrorAction SilentlyContinue
  $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
  $env:P26_NO_BROWSER = '1'
  $env:P26_NONINTERACTIVE = '1'
  Assert-Check 'Sistem Node.js kullanilmiyor' (-not (Get-Command node.exe -ErrorAction SilentlyContinue))
  Assert-Check 'Sistem PostgreSQL kullanilmiyor' (-not (Get-Command psql.exe -ErrorAction SilentlyContinue))
  Manager 'Start'
  Assert-Check 'Ilk baslatma ve gercek veritabani saglik kontrolu' ((Api '/api/health').ok -eq $true)
  $boot = Api '/api/bootstrap'
  Assert-Check 'Sema ve ornek veri kurulumu' ($boot.departments.Count -gt 0 -and $boot.personnel.Count -gt 0)
  $status = Api '/api/settings'
  Assert-Check 'Guncel sema surumu' ($status.status.schemaVersion -eq '2026.01')
  $env:TEST_BASE_URL = 'http://127.0.0.1:3210'
  & (Join-Path $Target 'node\node.exe') (Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\test-settings-api.mjs')
  Assert-Check 'Excel aktarim ve transaction API testleri' ($LASTEXITCODE -eq 0)
  $settings = $status.settings
  $settings.institution = 'CI KURUM KAYDI KORUNDU'
  Api '/api/settings' 'PUT' $settings | Out-Null
  $person = Api '/api/personnel' 'POST' @{ name='CI TEST PERSONEL'; tcNo='11111111110'; personnelType='ISCI'; staffGroup='DESTEK'; departmentIds=@($boot.departments[0].id) }
  $Id = $person.personnel.id
  $Before = (Api '/api/personnel').personnel.Count
  $Backup = Join-Path $TempRoot 'personel26-ci-roundtrip.sql'
  Manager 'Backup' @('-BackupFile',$Backup)
  Assert-Check 'SQL yedek dosyasi olusturuldu' ((Test-Path $Backup) -and (Get-Item $Backup).Length -gt 100)
  Api '/api/personnel' 'DELETE' @{id=$Id;hard=$true} | Out-Null
  Assert-Check 'Geri yukleme test verisi degistirildi' ((Api '/api/personnel').personnel.Count -eq ($Before-1))
  Manager 'Restore' @('-BackupFile',$Backup)
  Assert-Check 'SQL yedekten tam geri donus' ((Api '/api/personnel').personnel.Count -eq $Before)
  Assert-Check 'Geri yuklenen kurum ayarlari' ((Api '/api/settings').settings.institution -eq 'CI KURUM KAYDI KORUNDU')
  # Kapatmanin baska Node sureclerini oldurmedigini gercek surecle dogrula.
  $Other = Join-Path $TempRoot 'unrelated-node'
  New-Item -ItemType Directory -Force -Path $Other | Out-Null
  Copy-Item (Join-Path $Target 'node\node.exe') (Join-Path $Other 'node.exe') -Force
  $UnrelatedProcess = Start-Process (Join-Path $Other 'node.exe') -ArgumentList @('-e','setInterval(()=>{},1000)') -PassThru -WindowStyle Hidden
  Manager 'Stop'
  Assert-Check 'Yalnizca Personel26 sureci kapatildi' ($null -ne (Get-Process -Id $UnrelatedProcess.Id -ErrorAction SilentlyContinue))
  Assert-Check 'Runtime PID temizlendi' (-not (Test-Path (Join-Path $Target 'data\runtime.json')))
  $healthAfterStop = $false
  try { $healthAfterStop = (Api '/api/health').ok } catch {}
  Assert-Check 'Sunucu guvenli sekilde durdu' (-not $healthAfterStop)
  Manager 'Start'
  Assert-Check 'Yeniden baslatmada veriler korundu' ((Api '/api/personnel').personnel.Count -eq $Before)
  Manager 'Update' @('-PackagePath',$Package)
  Assert-Check 'Uygulama guncelleme sonrasi saglikli' ((Api '/api/health').ok -eq $true)
  Assert-Check 'Guncelleme personel verilerini korudu' ((Api '/api/personnel').personnel.Count -eq $Before)
  Assert-Check 'Guncelleme kurum ayarlarini korudu' ((Api '/api/settings').settings.institution -eq 'CI KURUM KAYDI KORUNDU')
  Manager 'Stop'
  $installAgain = Start-Process $Installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-',"/DIR=`"$Target`"","/LOG=`"$ReportDir\update-install.log`"") -Wait -PassThru
  Assert-Check 'Mevcut kurulum uzerine yeniden kurulum' ($installAgain.ExitCode -eq 0)
  Manager 'Start'
  Assert-Check 'Kurulum guncellemesi veri klasorunu korudu' ((Api '/api/personnel').personnel.Count -eq $Before)
  Manager 'Stop'
} catch {
  $_ | Out-String | Set-Content (Join-Path $ReportDir 'failure.txt') -Encoding UTF8
  throw
} finally {
  try { if (Test-Path (Join-Path $Target 'Personel26-Yonet.ps1')) { Manager 'Stop' } } catch {}
  if ($UnrelatedProcess) { Stop-Process -Id $UnrelatedProcess.Id -Force -ErrorAction SilentlyContinue }
  $env:PATH = $PreviousPath
  # Baglanti sifresi ve SQL yedegi artifact'e alinmaz; yalnizca test/loglar.
  $Checks | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $ReportDir 'report.json') -Encoding UTF8
  foreach ($log in @('app.log','app-error.log','postgres.log')) {
    $source = Join-Path $Target "data\$log"
    if (Test-Path $source) { Copy-Item $source $ReportDir -Force }
  }
}
