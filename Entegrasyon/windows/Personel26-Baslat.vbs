' Personel26 — konsol penceresi göstermeden başlatır (taşınabilir kullanım).
' Personel26-Baslat.bat ile aynı işi yapar; siyah komut penceresi açılmaz.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & base & "\Personel26-Yonet.ps1"" -Action Start", 0, False
