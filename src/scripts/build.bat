@echo off
chcp 65001 >nul
echo ========================================
echo 语音转病例助手 - 打包脚本
echo ========================================
echo.

echo [1/4] 检查环境...
python --version
if %errorlevel% neq 0 (
    echo 错误: 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)
echo.

echo [2/4] 安装依赖...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo 警告: 依赖安装可能失败，请手动检查
)
echo.

echo [3/4] 安装 PyInstaller...
pip install pyinstaller
if %errorlevel% neq 0 (
    echo 错误: PyInstaller 安装失败
    pause
    exit /b 1
)
echo.

echo [4/4] 开始打包...
echo 正在打包，这可能需要几分钟...
echo.

pyinstaller --clean 语音转病例助手.spec

if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo 错误: 打包失败！
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo 打包成功！
echo ========================================
echo.
echo 可执行文件位置: dist\语音转病例助手\
echo.
echo 按任意键打开输出目录...
pause >nul
explorer dist\语音转病例助手
