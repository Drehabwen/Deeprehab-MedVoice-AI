; 语音转病例助手 - NSIS 安装程序脚本
; 用于创建 Windows 安装程序

!define APPNAME "语音转病例助手"
!define COMPANYNAME "AIsci"
!define DESCRIPTION "智能语音转病历生成工具"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0
!define VERSIONBUILD 0
!define HELPURL "https://github.com/your-repo/aisci"

; 安装程序基本设置
Name "${APPNAME}"
OutFile "语音转病例助手_Setup.exe"
InstallDir "$PROGRAMFILES64\${APPNAME}"
InstallDirRegKey "Software\${COMPANYNAME}\${APPNAME}"
InstallDirRegKeyRoot "HKLM"
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show
SetCompressor /SOLID lzma
BrandingText "${APPNAME}"
CRCCheck on

; 版本信息
VIProductVersion "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
VIAddVersionKey /LANG="2052" "ProductName" "${APPNAME}"
VIAddVersionKey /LANG="2052" "CompanyName" "${COMPANYNAME}"
VIAddVersionKey /LANG="2052" "LegalCopyright" "© 2026 ${COMPANYNAME}"
VIAddVersionKey /LANG="2052" "FileDescription" "${DESCRIPTION}"
VIAddVersionKey /LANG="2052" "FileVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.0"

; 安装程序界面
!include "MUI2.nsh"
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_FINISHPAGE_NOAUTOCLOSE

; 安装程序页面
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; 卸载程序页面
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; 安装程序语言
!insertmacro MUI_LANGUAGE "SimpChinese"

; 安装程序文本
LangString DESC_SectionMain ${LANG_SIMPCHINESE} "主程序文件"
LangString DESC_SectionConfig ${LANG_SIMPCHINESE} "配置文件"
LangString DESC_SectionDesktopShortcut ${LANG_SIMPCHINESE} "桌面快捷方式"
LangString DESC_SectionStartMenuShortcut ${LANG_SIMPCHINESE} "开始菜单快捷方式"

; 安装程序组件
Section "主程序" SecMain
    SectionIn RO
    SetOutPath $INSTDIR
    
    ; 主程序文件
    File /oname="语音转病例助手.exe" "dist\语音转病例助手\语音转病例助手.exe"
    
    ; 配置文件
    File /oname="config.json" "config.json"
    
    ; 文档文件
    File /oname="README.md" "README.md"
    File /oname="用户手册.md" "用户手册.md"
    
    ; 创建数据目录
    CreateDirectory "$INSTDATA\cases"
    CreateDirectory "$INSTDATA\exports"
    
    ; 写入卸载信息
    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\语音转病例助手.exe"
SectionEnd

Section "桌面快捷方式" SecDesktopShortcut
    CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\语音转病例助手.exe" "" "$INSTDIR\语音转病例助手.exe" 0
SectionEnd

Section "开始菜单快捷方式" SecStartMenuShortcut
    CreateDirectory "$SMPROGRAMS\${APPNAME}"
    CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\语音转病例助手.exe" "" "$INSTDIR\语音转病例助手.exe" 0
    CreateShortCut "$SMPROGRAMS\${APPNAME}\卸载.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
SectionEnd

; 卸载程序
Section Uninstall
    ; 删除文件
    Delete "$INSTDIR\语音转病例助手.exe"
    Delete "$INSTDIR\config.json"
    Delete "$INSTDIR\README.md"
    Delete "$INSTDIR\用户手册.md"
    Delete "$INSTDIR\uninstall.exe"
    
    ; 删除快捷方式
    Delete "$DESKTOP\${APPNAME}.lnk"
    Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
    Delete "$SMPROGRAMS\${APPNAME}\卸载.lnk"
    RMDir "$SMPROGRAMS\${APPNAME}"
    
    ; 删除目录
    RMDir /r "$INSTDATA\cases"
    RMDir /r "$INSTDATA\exports"
    RMDir "$INSTDATA"
    RMDir "$INSTDIR"
    
    ; 删除注册表项
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
    DeleteRegKey HKLM "Software\${COMPANYNAME}\${APPNAME}"
SectionEnd
