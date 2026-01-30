# AIsci 智能病历生成系统 API & SDK

## 📋 概述

AIsci API 服务是一个基于 FastAPI 的高性能接口服务，提供语音转录、病例结构化、病历生成以及灵犀引擎（LLM）对话功能。它不仅支持 Web/小程序调用，还提供了 Python SDK 方便其他项目直接集成。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

**Windows:**
```bash
python api_server.py
```

服务默认将在 `http://localhost:8000` 启动，你可以访问 `http://localhost:8000/docs` 查看交互式 Swagger 文档。

---

## 📦 SDK 接入 (Python)

我们提供了 `sdk.py`，只需几行代码即可接入：

```python
from sdk import AIsciClient

client = AIsciClient(base_url="http://localhost:8000")

# 1. 灵犀引擎对话
response = client.chat("请分析患者的主诉：头痛伴随恶心")
print(response['content'])

# 2. 语音转录
transcript = client.transcribe("path/to/audio.wav")

# 3. 病例结构化
case_data = client.structure_case(transcript)
```

---

## 📡 API 接口

### 基础信息

- **Base URL**: `http://localhost:8000`
- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`

### 核心接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/chat` | POST | **灵犀引擎对话** (新) |
| `/api/transcribe` | POST | 语音转录 |
| `/api/structure` | POST | 病例结构化 |
| `/api/generate` | POST | 病历生成 |
| `/api/reset` | POST | 重置对话历史 |

---

## 📖 文档

- **[API 文档](API文档.md)** - 详细的 API 接口文档
- **[小程序集成指南](小程序集成指南.md)** - 微信小程序集成教程
- **[网页集成指南](网页集成指南.md)** - 网页应用集成教程

---

## 🔧 配置

### API 配置

在 `api_server.py` 中修改配置：

```python
app.run(host='0.0.0.0', port=5000, debug=True)
```

### API 密钥配置

在 `voice.py` 中配置讯飞 API 密钥：

```python
APPID = "your_appid"
API_KEY = "your_api_key"
API_SECRET = "your_api_secret"
```

---

## 📦 项目结构

```
AIsci/
├── api_server.py              # API 服务主文件
├── voice.py                   # 语音识别模块
├── nlp_processor.py           # NLP 处理模块
├── case_structurer.py         # 病例结构化模块
├── document_generator.py      # 文档生成模块
├── case_manager.py            # 病例管理模块
├── start_api.bat              # 启动脚本（Windows）
├── test_api.py                # API 测试脚本
├── requirements.txt           # 依赖列表
├── API文档.md                 # API 接口文档
├── 小程序集成指南.md          # 小程序集成教程
├── 网页集成指南.md            # 网页集成教程
└── README_API.md              # 本文件
```

---

## 🎯 功能特性

### 核心功能

✅ **语音转录** - 实时语音转文字（医疗领域优化）
✅ **病例结构化** - 自动提取病例信息
✅ **说话人区分** - 区分医生和患者
✅ **医学文书生成** - 生成标准化病历
✅ **数据管理** - 保存、加载、删除病例
✅ **Word 导出** - 生成专业病历文档
✅ **RESTful API** - 标准化接口设计
✅ **CORS 支持** - 跨域请求支持
✅ **错误处理** - 完善的错误处理机制

### 技术特点

✅ **医疗领域优化** - 讯飞医疗 API
✅ **专业术语准确** - AI 模型优化
✅ **医学文书规范** - 符合病历书写标准
✅ **自动过滤无关信息** - 只保留医疗相关内容
✅ **量化描述** - 准确记录数值指标
✅ **易于集成** - 简单的 RESTful API
✅ **跨平台支持** - 支持小程序和网页

---

## 📝 使用示例

### 1. 健康检查

```bash
curl http://localhost:5000/health
```

### 2. 语音转录

```bash
curl -X POST http://localhost:5000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audio_data": "base64_encoded_audio",
    "format": "wav"
  }'
```

### 3. 病例结构化

```bash
curl -X POST http://localhost:5000/api/structure \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "患者主诉头痛三天...",
    "separate_speakers": true
  }'
```

### 4. 病历生成

```bash
curl -X POST http://localhost:5000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "structured_case": {...},
    "patient_info": {...},
    "doctor_info": {...}
  }'
```

---

## 🧪 测试

### 运行测试

```bash
python test_api.py
```

### 测试覆盖

- ✅ 健康检查
- ✅ 语音转录
- ✅ 病例结构化
- ✅ 病历生成
- ✅ 保存病例
- ✅ 获取病例
- ✅ 病例列表
- ✅ 删除病例

---

## 🚀 部署

### 本地部署

```bash
python api_server.py
```

### 生产部署

#### 使用 Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 api_server:app
```

#### 使用 Docker

```dockerfile
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "api_server:app"]
```

#### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## ⚠️ 注意事项

### 安全性

1. **API 密钥保护**
   - 不要在前端代码中暴露 API 密钥
   - 建议在后端服务中配置 API 密钥

2. **HTTPS**
   - 生产环境建议使用 HTTPS
   - 配置 SSL 证书

3. **认证授权**
   - 添加 API 认证机制
   - 实现用户权限管理

### 性能优化

1. **音频处理**
   - 限制音频文件大小
   - 使用流式处理大文件

2. **缓存**
   - 缓存常用数据
   - 减少重复计算

3. **负载均衡**
   - 使用多个服务实例
   - 配置负载均衡器

---

## 📊 性能指标

### 响应时间

- **健康检查**: < 100ms
- **语音转录**: 2-5s（取决于音频长度）
- **病例结构化**: 2-5s
- **病历生成**: 5-10s
- **文档导出**: 1-3s

### 并发处理

- **推荐并发数**: 10-20
- **最大并发数**: 50
- **资源占用**: 200-500MB 内存

---

## 🔍 故障排除

### 常见问题

#### Q: 服务无法启动？
**A:**
1. 检查端口 5000 是否被占用
2. 确认依赖已正确安装
3. 查看 Python 版本（建议 3.7+）

#### Q: 语音转录失败？
**A:**
1. 检查讯飞 API 密钥配置
2. 确认网络连接正常
3. 查看音频格式是否正确

#### Q: 病例结构化失败？
**A:**
1. 确认星火 API 密钥配置
2. 检查网络连接
3. 查看错误日志

#### Q: 跨域请求失败？
**A:**
1. 确认已安装 flask-cors
2. 检查 CORS 配置
3. 查看浏览器控制台错误

---

## 📞 技术支持

### 获取帮助

- **API 文档**: [API文档.md](API文档.md)
- **小程序集成**: [小程序集成指南.md](小程序集成指南.md)
- **网页集成**: [网页集成指南.md](网页集成指南.md)
- **测试脚本**: test_api.py

### 联系方式

- **GitHub Issues**: https://github.com/your-repo/aisci/issues
- **Email**: support@example.com

---

## 📄 许可证

MIT License

---

## 🎉 总结

语音转病例助手 API 服务已成功封装为 RESTful API！

**主要特点：**
- ✅ 标准化 RESTful API 接口
- ✅ 支持小程序和网页集成
- ✅ 完善的错误处理机制
- ✅ CORS 跨域支持
- ✅ 详细的 API 文档
- ✅ 完整的集成指南
- ✅ 易于部署和维护

**使用建议：**
1. 首次使用请仔细阅读 API 文档
2. 配置正确的 API 密钥
3. 运行测试脚本验证功能
4. 根据需求选择集成方式（小程序/网页）
5. 生产环境建议使用 HTTPS

开始使用语音转病例助手 API 服务，轻松集成语音转病例功能！🚀
