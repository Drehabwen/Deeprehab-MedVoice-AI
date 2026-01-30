# 语音转病例助手 API 文档

## 📋 概述

语音转病例助手 API 是一个基于 Flask 的 RESTful API 服务，提供语音转录、病例结构化、病历生成等功能，方便小程序和网页应用调用。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
pip install flask flask-cors
```

### 2. 启动服务

```bash
python api_server.py
```

服务将在 `http://localhost:5000` 启动

### 3. 测试服务

```bash
curl http://localhost:5000/health
```

---

## 📡 API 接口

### 基础信息

- **Base URL**: `http://localhost:5000`
- **Content-Type**: `application/json`
- **编码**: `UTF-8`

---

## 1. 健康检查

### 接口描述

检查 API 服务是否正常运行

### 请求

```
GET /health
```

### 响应

```json
{
  "status": "success",
  "message": "API服务运行正常",
  "timestamp": "2026-01-26T10:00:00.000000"
}
```

### 示例

```bash
curl http://localhost:5000/health
```

---

## 2. 语音转录

### 接口描述

将音频文件转换为文本（支持 Base64 编码的音频数据）

### 请求

```
POST /api/transcribe
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audio_data | string | 是 | Base64 编码的音频数据 |
| format | string | 否 | 音频格式，默认为 wav |

### 请求示例

```json
{
  "audio_data": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
  "format": "wav"
}
```

### 响应

```json
{
  "status": "success",
  "data": {
    "transcript": "患者主诉头痛三天，伴有恶心呕吐...",
    "timestamp": "2026-01-26T10:00:00.000000"
  }
}
```

### 错误响应

```json
{
  "status": "error",
  "message": "音频数据解码失败"
}
```

### 小程序调用示例

```javascript
wx.request({
  url: 'http://your-server.com/api/transcribe',
  method: 'POST',
  header: {
    'content-type': 'application/json'
  },
  data: {
    audio_data: wx.getFileSystemManager().readFileSync(audioPath, 'base64'),
    format: 'wav'
  },
  success(res) {
    console.log('转录结果:', res.data.data.transcript)
  }
})
```

---

## 3. 病例结构化

### 接口描述

将转录文本结构化为标准病例格式

### 请求

```
POST /api/structure
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| transcript | string | 是 | 转录文本 |
| separate_speakers | boolean | 否 | 是否区分说话人，默认为 true |

### 请求示例

```json
{
  "transcript": "患者主诉头痛三天，伴有恶心呕吐。既往有高血压病史...",
  "separate_speakers": true
}
```

### 响应

```json
{
  "status": "success",
  "data": {
    "structured_case": {
      "chief_complaint": "头痛三天，伴有恶心呕吐",
      "present_illness": "患者主诉头痛三天，伴有恶心呕吐...",
      "past_history": "高血压病史",
      "allergies": "",
      "physical_exam": "",
      "diagnosis": "",
      "treatment_plan": ""
    },
    "timestamp": "2026-01-26T10:00:00.000000"
  }
}
```

### 小程序调用示例

```javascript
wx.request({
  url: 'http://your-server.com/api/structure',
  method: 'POST',
  header: {
    'content-type': 'application/json'
  },
  data: {
    transcript: transcriptText,
    separate_speakers: true
  },
  success(res) {
    console.log('结构化结果:', res.data.data.structured_case)
  }
})
```

---

## 4. 病历生成

### 接口描述

根据结构化病例生成标准病历文本

### 请求

```
POST /api/generate
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| structured_case | object | 是 | 结构化病例数据 |
| patient_info | object | 否 | 患者信息 |
| doctor_info | object | 否 | 医生信息 |

### 请求示例

```json
{
  "structured_case": {
    "chief_complaint": "头痛三天，伴有恶心呕吐",
    "present_illness": "患者主诉头痛三天...",
    "past_history": "高血压病史",
    "allergies": "",
    "physical_exam": "",
    "diagnosis": "",
    "treatment_plan": ""
  },
  "patient_info": {
    "name": "张三",
    "gender": "男",
    "age": 45
  },
  "doctor_info": {
    "name": "李医生",
    "department": "神经内科"
  }
}
```

### 响应

```json
{
  "status": "success",
  "data": {
    "medical_record": "患者张三，男，45岁，因\"头痛三天，伴有恶心呕吐\"就诊...",
    "timestamp": "2026-01-26T10:00:00.000000"
  }
}
```

### 小程序调用示例

```javascript
wx.request({
  url: 'http://your-server.com/api/generate',
  method: 'POST',
  header: {
    'content-type': 'application/json'
  },
  data: {
    structured_case: structuredCase,
    patient_info: {
      name: '张三',
      gender: '男',
      age: 45
    },
    doctor_info: {
      name: '李医生',
      department: '神经内科'
    }
  },
  success(res) {
    console.log('病历文本:', res.data.data.medical_record)
  }
})
```

---

## 5. 文档导出

### 接口描述

生成 Word 格式的病历文档

### 请求

```
POST /api/export
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| medical_record | string | 是 | 病历文本 |
| patient_info | object | 否 | 患者信息 |
| doctor_info | object | 否 | 医生信息 |

### 请求示例

```json
{
  "medical_record": "患者张三，男，45岁，因\"头痛三天，伴有恶心呕吐\"就诊...",
  "patient_info": {
    "name": "张三",
    "gender": "男",
    "age": 45
  },
  "doctor_info": {
    "name": "李医生",
    "department": "神经内科"
  }
}
```

### 响应

```json
{
  "status": "success",
  "data": {
    "document_base64": "UEsDBBQABgAIAAAAIQ...",
    "filename": "张三_病历_20260126.docx",
    "timestamp": "2026-01-26T10:00:00.000000"
  }
}
```

### 小程序调用示例

```javascript
wx.request({
  url: 'http://your-server.com/api/export',
  method: 'POST',
  header: {
    'content-type': 'application/json'
  },
  data: {
    medical_record: medicalRecordText,
    patient_info: patientInfo,
    doctor_info: doctorInfo
  },
  success(res) {
    const base64Data = res.data.data.document_base64
    const fileName = res.data.data.filename
    
    // 保存文件
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    const buffer = wx.base64ToArrayBuffer(base64Data)
    wx.getFileSystemManager().writeFile({
      filePath: filePath,
      data: buffer,
      encoding: 'binary',
      success() {
        console.log('文件保存成功:', filePath)
      }
    })
  }
})
```

---

## 6. 保存病例

### 接口描述

保存病例数据到本地存储

### 请求

```
POST /api/case/save
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| case_data | object | 是 | 病例数据 |

### 请求示例

```json
{
  "case_data": {
    "patient_info": {
      "name": "张三",
      "gender": "男",
      "age": 45
    },
    "transcript": "患者主诉头痛三天...",
    "structured_case": {
      "chief_complaint": "头痛三天",
      "present_illness": "...",
      "past_history": "高血压病史"
    },
    "medical_record": "患者张三，男，45岁...",
    "created_at": "2026-01-26T10:00:00.000000"
  }
}
```

### 响应

```json
{
  "status": "success",
  "data": {
    "case_id": "20260126_100000",
    "timestamp": "2026-01-26T10:00:00.000000"
  }
}
```

### 小程序调用示例

```javascript
wx.request({
  url: 'http://your-server.com/api/case/save',
  method: 'POST',
  header: {
    'content-type': 'application/json'
  },
  data: {
    case_data: caseData
  },
  success(res) {
    console.log('病例ID:', res.data.data.case_id)
  }
})
```

---

## 7. 获取病例

### 接口描述

根据病例 ID 获取病例详情

### 请求

```
GET /api/case/<case_id>
```

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| case_id | string | 是 | 病例 ID |

### 响应

```json
{
  "status": "success",
  "data": {
    "case_id": "20260126_100000",
    "patient_info": {
      "name": "张三",
      "gender": "男",
      "age": 45
    },
    "transcript": "患者主诉头痛三天...",
    "structured_case": {
      "chief_complaint": "头痛三天",
      "present_illness": "...",
      "past_history": "高血压病史"
    },
    "medical_record": "患者张三，男，45岁...",
    "created_at": "2026-01-26T10:00:00.000000"
  }
}
```

### 小程序调用示例

```javascript
wx.request({
  url: 'http://your-server.com/api/case/20260126_100000',
  method: 'GET',
  success(res) {
    console.log('病例详情:', res.data.data)
  }
})
```

---

## 8. 病例列表

### 接口描述

获取所有病例列表

### 请求

```
GET /api/cases
```

### 响应

```json
{
  "status": "success",
  "data": {
    "cases": [
      {
        "case_id": "20260126_100000",
        "patient_name": "张三",
        "created_at": "2026-01-26T10:00:00.000000"
      },
      {
        "case_id": "20260126_110000",
        "patient_name": "李四",
        "created_at": "2026-01-26T11:00:00.000000"
      }
    ],
    "total": 2
  }
}
```

### 小程序调用示例

```javascript
wx.request({
  url: 'http://your-server.com/api/cases',
  method: 'GET',
  success(res) {
    console.log('病例列表:', res.data.data.cases)
  }
})
```

---

## 9. 删除病例

### 接口描述

根据病例 ID 删除病例

### 请求

```
DELETE /api/case/<case_id>
```

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| case_id | string | 是 | 病例 ID |

### 响应

```json
{
  "status": "success",
  "message": "病例删除成功"
}
```

### 小程序调用示例

```javascript
wx.request({
  url: 'http://your-server.com/api/case/20260126_100000',
  method: 'DELETE',
  success(res) {
    console.log('删除成功')
  }
})
```

---

## 📝 完整工作流程示例

### 小程序完整调用流程

```javascript
// 1. 录音并转录
function transcribeAudio(audioPath) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'http://your-server.com/api/transcribe',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        audio_data: wx.getFileSystemManager().readFileSync(audioPath, 'base64'),
        format: 'wav'
      },
      success: (res) => resolve(res.data.data.transcript),
      fail: reject
    })
  })
}

// 2. 结构化病例
function structureCase(transcript) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'http://your-server.com/api/structure',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { transcript, separate_speakers: true },
      success: (res) => resolve(res.data.data.structured_case),
      fail: reject
    })
  })
}

// 3. 生成病历
function generateMedicalRecord(structuredCase, patientInfo, doctorInfo) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'http://your-server.com/api/generate',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        structured_case: structuredCase,
        patient_info: patientInfo,
        doctor_info: doctorInfo
      },
      success: (res) => resolve(res.data.data.medical_record),
      fail: reject
    })
  })
}

// 4. 导出文档
function exportDocument(medicalRecord, patientInfo, doctorInfo) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'http://your-server.com/api/export',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        medical_record: medicalRecord,
        patient_info: patientInfo,
        doctor_info: doctorInfo
      },
      success: (res) => {
        const base64Data = res.data.data.document_base64
        const fileName = res.data.data.filename
        const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
        const buffer = wx.base64ToArrayBuffer(base64Data)
        
        wx.getFileSystemManager().writeFile({
          filePath,
          data: buffer,
          encoding: 'binary',
          success: () => resolve(filePath),
          fail: reject
        })
      },
      fail: reject
    })
  })
}

// 5. 保存病例
function saveCase(caseData) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'http://your-server.com/api/case/save',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { case_data: caseData },
      success: (res) => resolve(res.data.data.case_id),
      fail: reject
    })
  })
}

// 完整流程
async function processMedicalCase(audioPath, patientInfo, doctorInfo) {
  try {
    // 1. 转录
    const transcript = await transcribeAudio(audioPath)
    console.log('转录完成:', transcript)
    
    // 2. 结构化
    const structuredCase = await structureCase(transcript)
    console.log('结构化完成:', structuredCase)
    
    // 3. 生成病历
    const medicalRecord = await generateMedicalRecord(
      structuredCase,
      patientInfo,
      doctorInfo
    )
    console.log('病历生成完成:', medicalRecord)
    
    // 4. 导出文档
    const docPath = await exportDocument(medicalRecord, patientInfo, doctorInfo)
    console.log('文档导出完成:', docPath)
    
    // 5. 保存病例
    const caseData = {
      patient_info: patientInfo,
      doctor_info: doctorInfo,
      transcript,
      structured_case: structuredCase,
      medical_record: medicalRecord,
      created_at: new Date().toISOString()
    }
    const caseId = await saveCase(caseData)
    console.log('病例保存完成:', caseId)
    
    return {
      transcript,
      structuredCase,
      medicalRecord,
      docPath,
      caseId
    }
  } catch (error) {
    console.error('处理失败:', error)
    throw error
  }
}

// 使用示例
processMedicalCase(
  '/tmp/recording.wav',
  { name: '张三', gender: '男', age: 45 },
  { name: '李医生', department: '神经内科' }
).then(result => {
  console.log('处理成功:', result)
}).catch(error => {
  console.error('处理失败:', error)
})
```

---

## 🔧 部署说明

### 本地部署

1. **安装依赖**
   ```bash
   pip install -r requirements.txt
   pip install flask flask-cors
   ```

2. **启动服务**
   ```bash
   python api_server.py
   ```

3. **访问服务**
   ```
   http://localhost:5000
   ```

### 服务器部署

1. **使用 Gunicorn**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 api_server:app
   ```

2. **使用 Nginx 反向代理**
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

3. **使用 Docker**
   ```dockerfile
   FROM python:3.9
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . .
   CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "api_server:app"]
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

## 📞 技术支持

如有问题，请联系：
- **GitHub Issues**: https://github.com/your-repo/aisci/issues
- **Email**: support@example.com

---

## 📄 许可证

MIT License
