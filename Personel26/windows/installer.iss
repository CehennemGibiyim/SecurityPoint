#define AppName "Personel26"
#define AppVersion "1.1.0"
#define PortableDir "..\Personel26-Portable"
[Setup]
AppId={{7E1B2A64-9C3D-4B8F-A2E5-P26PUANTAJ01}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Personel26
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
OutputDir=.
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
Filename: "{app}\Personel26-Baslat.bat"; Description: "{#AppName} şimdi başlatılsın"; Flags: postinstall nowait skipifsilent shellexec
[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Personel26-Yonet.ps1"" -Action Stop"; Flags: runhidden; RunOnceId: "StopP26"
[Code]
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
