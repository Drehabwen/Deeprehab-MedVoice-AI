# 讯飞星火大模型 API 接入说明

## 概述
当前系统使用基于规则的临时 NLP 处理器进行角色区分和病例结构化。为了提高准确率，建议接入讯飞星火大模型 API。

## 申请步骤

### 1. 访问控制台
- 访问 https://console.xfyun.cn/
- 注册/登录账号

### 2. 创建应用
- 点击"创建应用"
- 填写应用名称（如：语音转病例助手）
- 选择"星火认知大模型"服务

### 3. 获取 API 凭证
- 创建完成后，在应用详情页面获取：
  - **APPID**: 应用标识
  - **APISecret**: API 密钥
  - **APIKey**: API 密钥

### 4. 选择版本
- **推荐：星火 Lite 版本**（免费）
  - 无限 Token 数量
  - 每秒 2 次请求限制
  - 适合 MVP 测试

## 配置方式

### 方式1：直接替换 nlp_processor.py
获取 API 凭证后，更新 [nlp_processor.py](file:///c:/Users/23849/Desktop/插件/MCP%20DEV/AIsci/nlp_processor.py) 中的配置：

```python
self.APPID = "你的APPID"
self.APISecret = "你的APISecret"
self.APIKey = "你的APIKey"
```

### 方式2：使用配置文件
在 [config.json](file:///c:/Users/23849/Desktop/插件/MCP%20DEV/AIsci/config.json) 中添加：

```json
{
  "spark": {
    "appid": "你的APPID",
    "api_secret": "你的APISecret",
    "api_key": "你的APIKey"
  }
}
```

然后修改 [nlp_processor.py](file:///c:/Users/23849/Desktop/插件/MCP%20DEV/AIsci/nlp_processor.py) 读取配置：

```python
with open("config.json", "r", encoding="utf-8") as f:
    config = json.load(f)
    self.APPID = config["spark"]["appid"]
    self.APISecret = config["spark"]["api_secret"]
    self.APIKey = config["spark"]["api_key"]
```

## 切换到星火 API

### 步骤1：更新 main.py 导入
将 [main.py](file:///c:/Users/23849/Desktop/插件/MCP%20DEV/AIsci/main.py) 第13行修改为：

```python
from nlp_processor import NLPProcessor
```

### 步骤2：更新初始化
将 [main.py](file:///c:/Users/23849/Desktop/插件/MCP%20DEV/AIsci/main.py) 第26行修改为：

```python
self.nlp_processor = NLPProcessor()
```

### 步骤3：测试运行
```bash
python main.py
```

## API 费用说明

| 版本 | 价格 | 限制 | 推荐场景 |
|------|------|------|----------|
| Lite | 免费 | 2 QPS | MVP 测试、小规模使用 |
| Pro | ¥0.018/千tokens | 8 QPS | 正式商用 |
| Max | ¥0.073/千tokens | 20 QPS | 高并发场景 |

## 注意事项

1. **不要提交凭证到代码仓库**：将 APPID、APISecret、APIKey 添加到 .gitignore
2. **API 调用限制**：注意 QPS 限制，避免调用过快
3. **Token 计费**：注意 Token 使用量，避免超出预算

## 故障排查

### 错误：11200
**原因**：未开通星火大模型服务或 APPID 不匹配  
**解决**：检查控制台是否已开通"星火认知大模型"服务

### 错误：10003
**原因**：API 密钥错误  
**解决**：检查 APISecret 和 APIKey 是否正确

### 错误：10010
**原因**：请求频率过高（超过 QPS 限制）  
**解决**：降低请求频率，或升级到更高版本

## 技术支持
- 讯飞开发者社区：https://www.xfyun.cn/
- 星火大模型文档：https://www.xfyun.cn/doc/spark/
- 
