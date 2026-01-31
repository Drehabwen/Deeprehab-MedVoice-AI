@echo off
title AIsci Demo Server
echo ======================================================
echo           AIsci 智能诊疗辅助系统 - 演示启动器
echo ======================================================
echo.

:: 检查 Python 环境
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python 环境，请先安装 Python 3.9+
    pause
    exit /b
)

:: 检查并安装依赖
echo [1/3] 正在检查必要组件...
if not exist "requirements.txt" (
    echo [警告] 未找到 requirements.txt，尝试安装核心库...
    pip install fastapi uvicorn requests python-multipart python-docx fpdf2 pyaudio websocket-client
) else (
    pip install -r requirements.txt
)

:: 检查配置文件
if not exist "config.json" (
    echo [2/3] 正在初始化默认配置...
    echo { "hospital_name": "AIsci 演示中心", "doctor_name": "演示医生", "audio_sample_rate": 16000, "audio_channels": 1, "cases_dir": "./cases", "exports_dir": "./exports" } > config.json
)

:: 获取本地 IP 地址
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0.*0.0.0.0') do (
    set LOCAL_IP=%%a
)

echo [3/3] 正在启动演示服务器...
echo.
echo ======================================================
echo  服务已启动！您可以从以下地址访问演示界面：
echo.
echo  本地访问: http://localhost:5000
echo  局域网访问: http://%LOCAL_IP%:5000
echo ======================================================
echo.
echo [提示] 演示过程中请勿关闭此窗口。按 Ctrl+C 停止服务。
echo.

python src/api_server.py
pause
