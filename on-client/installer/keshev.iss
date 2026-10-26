#define AppName "케셰브"
#define AppVersion "0.2.11"
#define AppPublisher "케셰브 프로젝트"

[Setup]
AppId={{9C0D9D4E-4E9C-4E62-8F35-1C79C2B6C4A1}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Keshev
DefaultGroupName={#AppName}
OutputDir=..\dist\installer
OutputBaseFilename=KeshevSetup-{#AppVersion}
PrivilegesRequired=lowest
Uninstallable=yes
DisableProgramGroupPage=yes
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
ChangesAssociations=no
CloseApplications=no

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 케셰브 바로가기 만들기"; GroupDescription: "추가 바로가기:"; Flags: unchecked

[Files]
Source: "..\dist\installer-staging\keshev-package\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}\{#AppName}"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launch-keshev.ps1"""; WorkingDir: "{app}"; IconFilename: "{sys}\imageres.dll"; IconIndex: 3
Name: "{autodesktop}\{#AppName}"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launch-keshev.ps1"""; WorkingDir: "{app}"; IconFilename: "{sys}\imageres.dll"; IconIndex: 3; Tasks: desktopicon

[UninstallDelete]
Type: filesandordirs; Name: "{app}\dist"
