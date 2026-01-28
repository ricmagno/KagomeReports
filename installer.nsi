;--------------------------------
; General Attributes

!define PRODUCT_NAME "Historian Reports"
!define PRODUCT_VERSION "0.65.0"
!define PRODUCT_PUBLISHER "Ricardo A"
!define PRODUCT_WEB_SITE "https://github.com/your-org/historian-reports"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\${PRODUCT_NAME}.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

;--------------------------------
; Installer Attributes

Outfile "HistorianReports-${PRODUCT_VERSION}-Setup.exe"
InstallDir $PROGRAMFILES\HistorianReports
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

;--------------------------------
; Interface Settings

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

;--------------------------------
; Pages

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

;--------------------------------
; Languages

!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Installer Sections

Section "Historian Reports Application" SEC01
  SectionIn RO
  
  ; Set output path to the installation directory
  SetOutPath $INSTDIR
  
  ; Install application files
  File /r /x ".git" /x "node_modules" /x ".vscode" /x ".idea" /x "src" /x "tests" /x "scripts" /x "jest.config.js" /x "tsconfig.json" /x "Dockerfile" /x "docker-compose.yml" /x "*.md" /x "*.sql" /x "*.yml" /x "*.yaml" "..\package.json"
  File /r /x ".git" /x ".vscode" /x ".idea" /x "tests" /x "scripts" /x "*.md" /x "*.sql" /x "*.yml" /x "*.yaml" "..\dist\*.*"
  
  ; Install client build files (if they exist)
  SetOutPath $INSTDIR\client
  IfFileExists "..\client\build\*" 0 +3
    File /r "..\client\build\*.*"
    Goto +2
    DetailPrint "Client build not found, skipping..."
  
  ; Install configuration files
  SetOutPath $INSTDIR
  File "..\.env.example"
  
  ; Install documentation
  File "..\README.md"
  File "..\LICENSE"
  File "..\WINDOWS_INSTALLATION_GUIDE.md"
  
  ; Create required directories
  CreateDirectory "$INSTDIR\reports"
  CreateDirectory "$INSTDIR\logs"
  CreateDirectory "$INSTDIR\temp"
  CreateDirectory "$INSTDIR\data"
  
  ; Copy example environment file
  CopyFiles "$INSTDIR\.env.example" "$INSTDIR\.env"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Write registry for uninstaller
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\server.js"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
SectionEnd

;--------------------------------
; Optional: Windows Service Installation

Section /o "Install as Windows Service" SEC02
  SectionIn RO
  
  ; Check if NSSM is available or download it
  IfFileExists "$INSTDIR\nssm.exe" 0 nssm_download
  Goto nssm_install_service

  nssm_download:
    DetailPrint "Downloading NSSM for Windows service installation..."
    NSISdl::download "https://nssm.cc/release/nssm-2.24.zip" "$INSTDIR\nssm.zip"
    DetailPrint "Extracting NSSM..."
    nsisunz::extract "$INSTDIR\nssm.zip" "$INSTDIR\nssm_temp"
    SetOutPath "$INSTDIR"
    File /r "$INSTDIR\nssm_temp\nssm-*\*.*"
    Delete "$INSTDIR\nssm.zip"
    RMDir /r "$INSTDIR\nssm_temp"
  
  nssm_install_service:
    ; Install the service using NSSM
    ExecWait '"$INSTDIR\nssm.exe" install "HistorianReports" "$INSTDIR\node.exe" "$INSTDIR\dist\server.js"'
    ExecWait '"$INSTDIR\nssm.exe" set "HistorianReports" Description "Historian Reports Application Service"'
    ExecWait '"$INSTDIR\nssm.exe" set "HistorianReports" Start SERVICE_AUTO_START'
    ExecWait '"$INSTDIR\nssm.exe" set "HistorianReports" AppDirectory "$INSTDIR"'
    ExecWait '"$INSTDIR\nssm.exe" set "HistorianReports" AppParameters "--env-file=$INSTDIR\.env"'
    
    ; Start the service after installation
    ExecWait '"$INSTDIR\nssm.exe" start "HistorianReports"'
SectionEnd

;--------------------------------
; Optional: Database Setup

Section /o "Initialize Database" SEC03
  SetOutPath $INSTDIR
  
  ; Run database initialization script if available
  IfFileExists "$INSTDIR\dist\scripts\setup-database-configs.js" 0 +3
    ExecWait '"$INSTDIR\node.exe" "$INSTDIR\dist\scripts\setup-database-configs.js"'
    Goto +2
    DetailPrint "Database setup script not found, skipping..."
SectionEnd

;--------------------------------
; Shortcuts

Section "Shortcuts" SEC04
  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\Historian Reports.lnk" "$INSTDIR\node.exe" "$INSTDIR\dist\server.js" "$INSTDIR\dist\server.js" 0 SW_SHOWNORMAL \
                 ALT|CONTROL|SHIFT|F5 "Launch Historian Reports"
  
  ; Create start menu shortcuts
  CreateDirectory "$SMPROGRAMS\Historian Reports"
  CreateShortCut "$SMPROGRAMS\Historian Reports\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
  CreateShortCut "$SMPROGRAMS\Historian Reports\Historian Reports.lnk" "$INSTDIR\node.exe" "$INSTDIR\dist\server.js" "$INSTDIR\dist\server.js" 0
  CreateShortCut "$SMPROGRAMS\Historian Reports\Configuration.lnk" "$INSTDIR\.env" "" "$INSTDIR\.env" 0
  CreateShortCut "$SMPROGRAMS\Historian Reports\Documentation.lnk" "$INSTDIR\README.md" "" "$INSTDIR\README.md" 0
SectionEnd

;--------------------------------
; Uninstaller Section

Section "Uninstall"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR\*.*"
  
  ; Remove registry keys
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKCU "${PRODUCT_DIR_REGKEY}"
  
  ; Remove shortcuts
  Delete "$DESKTOP\Historian Reports.lnk"
  RMDir /r "$SMPROGRAMS\Historian Reports"
  
  ; Remove Windows service if NSSM was used
  IfFileExists "$INSTDIR\nssm.exe" 0 +2
    ExecWait '"$INSTDIR\nssm.exe" remove "HistorianReports" confirm'
  
SectionEnd

;--------------------------------
; Functions

Function .onInit
  MessageBox MB_YESNO "This will install Historian Reports v${PRODUCT_VERSION}. Continue?" IDYES +2
  Abort
FunctionEnd