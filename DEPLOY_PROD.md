# AIsci 生产环境部署指南

本项目采用 FastAPI 后端与原生 JS 前端，支持通过多种方式部署到 Web 端（服务器）。

## 方案一：Docker 容器化部署（推荐）

这是最简单且一致性最高的方式，适合云服务器（如阿里云、腾讯云、AWS）。

### 1. 准备环境
确保服务器已安装 `docker` 和 `docker-compose`。

### 2. 快速启动
在项目根目录下运行：
```bash
docker-compose up -d
```
系统将自动构建镜像并在 5000 端口启动服务。

---

## 方案二：Linux 服务器手动部署 (Ubuntu/CentOS)

### 1. 安装环境
```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx -y
```

### 2. 配置 Python 虚拟环境
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install uvicorn gunicorn
```

### 3. 使用 Gunicorn 管理进程
创建服务启动脚本或直接运行：
```bash
gunicorn src.api_server:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:5000 --daemon
```

### 4. Nginx 反向代理 (实现 HTTPS 和 80 端口访问)
编辑 Nginx 配置 `/etc/nginx/sites-available/aisci`：
```nginx
server {
    listen 80;
    server_name your-domain.com; # 替换为您的域名或 IP

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```
激活配置：`sudo ln -s /etc/nginx/sites-available/aisci /etc/nginx/sites-enabled/ && sudo systemctl restart nginx`

---

## 方案三：宝塔面板部署（新手友好）

1. **添加站点**：在宝塔面板点击“网站” -> “添加 Python 项目”。
2. **配置项目**：
   - 项目路径：选择 AIsci 根目录。
   - 启动文件：`src/api_server.py`。
   - 端口：`5000`。
3. **映射域名**：在项目设置中点击“映射”，绑定您的域名。
4. **防火墙**：确保在“安全”页签开放 `5000` 端口。

## 重要注意事项

1. **API Key 环境变量**：在生产环境中，建议将 LLM 的 API Key 设置为系统环境变量，而不是写在 `config.json` 中。
2. **麦克风权限**：由于 Web 浏览器安全限制，**实时录音功能必须在 HTTPS 环境下才能正常工作**（除非是 localhost）。请务必配置 SSL 证书。
3. **持久化目录**：确保 `cases/` 和 `exports/` 目录有写入权限。
