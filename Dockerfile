# 使用轻量级 Python 镜像
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖 (用于音频处理和 PDF 生成)
RUN apt-get update && apt-get install -y \
    gcc \
    portaudio19-dev \
    python3-all-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir uvicorn gunicorn

# 复制项目代码
COPY src/ ./src/
COPY config.json .

# 创建必要的目录
RUN mkdir -p cases exports

# 暴露端口
EXPOSE 5000

# 启动命令 (使用 gunicorn 提高生产环境稳定性)
CMD ["gunicorn", "src.api_server:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:5000"]
