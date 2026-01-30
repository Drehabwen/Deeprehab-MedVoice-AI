@echo off
chcp 65001 >nul
title 语音转病例助手 - 快速打包

echo ========================================
echo 语音转病例助手 - 快速打包
echo ========================================
echo.

REM 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)

echo [步骤 1/3] 检查依赖...
pip show pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo PyInstaller 未安装，正在安装...
    pip install pyinstaller
    if %errorlevel% neq 0 (
        echo [错误] PyInstaller 安装失败
        pause
        exit /b 1
    )
) else (
    echo PyInstaller 已安装
)
echo.

echo [步骤 2/3] 检查依赖包...
pip show python-docx >nul 2>&1
if %errorlevel% neq 0 (
    echo python-docx 未安装，正在安装...
    pip install python-docx
)

pip show websocket-client >nul 2>&1
if %errorlevel% neq 0 (
    echo websocket-client 未安装，正在安装...
    pip install websocket-client
)

pip show pyaudio >nul 2>&1
if %errorlevel% neq 0 (
    echo pyaudio 未安装，正在安装...
    pip install pyaudio
)

pip show pycryptodome >nul 2>&1
if %errorlevel% neq 0 (
    echo pycryptodome 未安装，正在安装...
    pip install pycryptodome
)
echo.

echo [步骤 3/3] 开始打包...
echo 正在打包，这可能需要几分钟...
echo.

pyinstaller --onefile --windowed --name "语音转病例助手" --icon=icon.ico main.py

if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo [错误] 打包失败！
    echo ========================================
    echo.
    echo 请检查错误信息并重试
    pause
    exit /b 1
)

echo.
echo ========================================
echo 打包成功！
echo ========================================
echo.
echo 可执行文件位置: dist\语音转病例助手.exe
echo.
echo 按任意键打开输出目录...
pause >nul
explorer dist
