@echo off
echo ========================================
echo 语音转病例助手 API 服务
echo ========================================
echo.

echo [1/3] 检查 Python 环境...
python --version
if errorlevel 1 (
    echo 错误: 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

echo.
echo [2/3] 检查依赖...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo 错误: 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo 依赖已安装
)

echo.
echo [3/3] 启动 API 服务...
echo.
echo ========================================
echo API 服务地址: http://localhost:5000
echo 健康检查: http://localhost:5000/health
echo API 文档: API文档.md
echo ========================================
echo.
echo 按 Ctrl+C 停止服务
echo.

python api_server.py

pause
