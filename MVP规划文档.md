# 语音转病例助手 - MVP规划文档

## 产品定位
帮助医生通过语音快速生成结构化病历，减少手动录入时间。

## 目标用户
- 基层医生、社区医生
- 门诊医生
- 需要快速记录病历的医疗工作者

## 核心痛点
1. 手动录入病历耗时，影响诊疗效率
2. 语音转录后需要手动整理成病例格式
3. 缺乏便捷的病历管理和导出工具

## MVP核心功能列表

### 功能1：实时语音转录（已有）
- 支持中文语音实时转文字
- 使用讯飞IAT API
- 基础的语音识别准确率

### 功能2：病例结构化（新增）
- 自动识别病例关键信息：
  - 患者基本信息（姓名、性别、年龄）
  - 主诉（Chief Complaint）
  - 现病史（HPI - History of Present Illness）
  - 既往史（PMH - Past Medical History）
  - 过敏史（Allergies）
  - 体格检查（Physical Examination）
  - 初步诊断（Diagnosis）
  - 处置建议（Treatment Plan）
- 支持手动编辑调整
- 实时预览结构化结果

### 功能3：病例保存管理（新增）
- 保存病例到本地JSON文件
- 按日期自动命名
- 查看历史病例列表

### 功能4：病例导出（新增）
- 导出为Word文档（.docx）
- 标准化病历格式
- 支持自定义医院名称和医生签名

### 功能5：简单操作界面（新增）
- 录音控制按钮
- 实时转录显示
- 病例结构化预览
- 历史病例查看
- 导出按钮

## 技术选型

### 前端界面
- 使用Python tkinter（内置GUI库）
- 简单易用，无需额外依赖

### 后端核心
- 基于现有voice.py
- 添加病例结构化逻辑
- Word文档生成（python-docx）

### 数据存储
- 本地JSON文件存储
- 便于快速开发MVP

## 非功能需求

### 性能要求
- 语音转录延迟 < 2秒
- 病例结构化响应 < 1秒
- 导出Word文档 < 3秒

### 可用性要求
- 界面简洁，操作直观
- 支持快捷键操作
- 提供操作提示

### 兼容性要求
- Windows 10/11
- Python 3.10+

## 成功指标
1. 用户可以在30秒内完成一次语音转录和病例生成
2. 病例结构化准确率 > 80%
3. 用户满意度评分 > 4/5

## 系统架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                   用户界面层 (GUI)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 录音控制 │  │ 转录显示 │  │病例编辑  │  │ 历史查看 │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   业务逻辑层 (Core)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │语音转录  │  │病例结构化│  │数据管理  │  │文档生成  │ │
│  │模块      │  │模块      │  │模块      │  │模块      │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   数据层 (Storage)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ 本地JSON │  │ 临时文件 │  │ Word文档 │                │
│  │ 病例存储 │  │ 缓存     │  │ 导出     │                │
│  └──────────┘  └──────────┘  └──────────┘                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   外部服务层 (External)                   │
│  ┌──────────┐                                            │
│  │ 讯飞IAT  │                                            │
│  │ API      │                                            │
│  └──────────┘                                            │
└─────────────────────────────────────────────────────────┘
```

### 模块划分

#### 1. GUI模块 (main.py)
- 负责用户界面展示和交互
- 录音按钮控制
- 转录文字实时显示
- 病例表单编辑
- 历史病例列表
- 导出功能触发

#### 2. 语音转录模块 (transcriber.py)
- 基于现有voice.py
- 处理音频采集和WebSocket连接
- 返回转录文本结果
- 错误处理和重连机制

#### 3. 病例结构化模块 (case_structurer.py)
- 从转录文本中提取病例关键信息
- 基于规则和关键词匹配
- 支持手动编辑调整
- 返回结构化病例数据

#### 4. 数据管理模块 (case_manager.py)
- 病例的增删改查
- JSON文件读写
- 历史病例列表查询
- 数据验证

#### 5. 文档生成模块 (document_generator.py)
- 使用python-docx生成Word文档
- 标准化病历格式
- 支持自定义医院信息

### 数据流设计

#### 录音转写流程
```
用户点击录音 → GUI启动录音 → transcriber采集音频 
→ 发送讯飞API → 接收转录结果 → GUI实时显示
```

#### 病例生成流程
```
转录完成 → case_structurer结构化 → GUI显示结构化表单 
→ 用户编辑确认 → case_manager保存JSON → 用户点击导出 
→ document_generator生成Word文档
```

## 数据模型设计

### 病例数据模型 (Case)

```json
{
  "case_id": "20260124_001",
  "patient_name": "张三",
  "gender": "男",
  "age": 45,
  "visit_date": "2026-01-24",
  "chief_complaint": "头痛3天",
  "present_illness": "患者3天前无明显诱因出现头痛，呈持续性钝痛...",
  "past_history": "高血压病史5年，规律服药",
  "allergies": "青霉素过敏",
  "physical_exam": "T 36.5℃，P 80次/分，R 18次/分，BP 140/90mmHg...",
  "diagnosis": "高血压病",
  "treatment_plan": "继续降压治疗，监测血压，必要时复查"
}
```

### 历史病例索引 (CaseIndex)

```json
{
  "cases": [
    {
      "case_id": "20260124_001",
      "patient_name": "张三",
      "visit_date": "2026-01-24",
      "diagnosis": "高血压病",
      "file_path": "./cases/20260124_001.json"
    },
    {
      "case_id": "20260124_002",
      "patient_name": "李四",
      "visit_date": "2026-01-24",
      "diagnosis": "上呼吸道感染",
      "file_path": "./cases/20260124_002.json"
    }
  ]
}
```

### 应用配置 (AppConfig)

```json
{
  "hospital_name": "XX社区卫生服务中心",
  "doctor_name": "王医生",
  "audio_sample_rate": 16000,
  "audio_channels": 1,
  "cases_dir": "./cases",
  "exports_dir": "./exports"
}
```

### 字段验证规则

| 字段 | 类型 | 必填 | 验证规则 |
|------|------|------|----------|
| case_id | string | 是 | 格式：YYYYMMDD_XXX |
| patient_name | string | 是 | 非空，2-20字符 |
| gender | string | 是 | 男/女 |
| age | integer | 是 | 0-120 |
| visit_date | string | 是 | YYYY-MM-DD格式 |
| chief_complaint | string | 是 | 非空 |
| present_illness | string | 否 | - |
| past_history | string | 否 | - |
| allergies | string | 否 | - |
| physical_exam | string | 否 | - |
| diagnosis | string | 是 | 非空 |
| treatment_plan | string | 是 | 非空 |

## 接口设计

### 内部模块接口

#### Transcriber模块
```python
class Transcriber:
    def start_recording(callback) -> None
    def stop_recording() -> str  # 返回转录文本
    def get_status() -> str  # "idle", "recording", "processing"
```

#### CaseStructurer模块
```python
class CaseStructurer:
    def structure(transcript: str) -> dict  # 返回结构化病例
    def update_field(case: dict, field: str, value: str) -> dict
```

#### CaseManager模块
```python
class CaseManager:
    def save_case(case: dict) -> str  # 返回case_id
    def load_case(case_id: str) -> dict
    def list_cases() -> list
    def delete_case(case_id: str) -> bool
```

#### DocumentGenerator模块
```python
class DocumentGenerator:
    def generate_word(case: dict, config: dict) -> str  # 返回文件路径
```

### 文件结构

```
AIsci/
├── main.py                    # 主程序入口（GUI）
├── voice.py                   # 语音转录模块（已有）
├── case_structurer.py         # 病例结构化模块（新增）
├── case_manager.py            # 数据管理模块（新增）
├── document_generator.py      # 文档生成模块（新增）
├── config.json                # 应用配置
├── cases/                     # 病例JSON存储目录
│   ├── index.json            # 病例索引
│   └── *.json                # 各病例文件
├── exports/                   # Word文档导出目录
└── requirements.txt           # 依赖列表
```

## 技术实现要点

### 语音转录优化
- 使用线程避免阻塞GUI
- 实现连接超时和重连机制
- 添加网络状态检测

### 病例结构化策略
- 基于关键词匹配（初期简单实现）
- 支持自定义字段分隔符
- 智能推断性别和年龄

### 数据持久化
- 原子性写入，避免数据损坏
- 定期备份机制
- 文件锁防止并发冲突

### Word文档模板
- 预定义标准化格式
- 支持医院Logo和抬头
- 打印优化布局

## 后续迭代方向（不在MVP范围内）
- 云端存储和同步
- 多用户支持
- 病例模板管理
- AI辅助诊断建议
- 移动端适配（小程序/APK）
