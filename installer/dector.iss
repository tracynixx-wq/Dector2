#define AppName "Dector"
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

[Setup]
AppId={{D3C70F32-1E87-4C50-A76B-7A8A91C38E12}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Dector
DefaultDirName={autopf}\Dector
DefaultGroupName=Dector
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64
OutputDir=..\dist
OutputBaseFilename=Dector-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\dector-desktop.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "..\build\Release\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{autoprograms}\Dector"; Filename: "{app}\dector-desktop.exe"
Name: "{autodesktop}\Dector"; Filename: "{app}\dector-desktop.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\dector-desktop.exe"; Description: "Launch Dector"; Flags: postinstall nowait skipifsilent
