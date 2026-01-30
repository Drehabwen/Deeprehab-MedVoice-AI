# 语音转病例助手 - 打包说明

## 打包方式

本项目提供了两种打包方式：

### 方式一：使用 PyInstaller（推荐）

#### 快速打包
```bash
build_simple.bat
```

#### 完整打包
```bash
build.bat
```

#### 手动打包
```bash
# 1. 安装 PyInstaller
pip install pyinstaller

# 2. 打包应用
pyinstaller --onefile --windowed --name "语音转病例助手" main.py

# 3. 打包结果在 dist 目录
```

### 方式二：使用 NSIS（创建安装程序）

#### 前提条件
1. 先使用 PyInstaller 打包应用
2. 安装 NSIS（Nullsoft Scriptable Install System）
3. 运行 NSIS 编译脚本

#### 创建安装程序
```bash
# 1. 确保已打包应用
# 运行 build.bat 或 build_simple.bat

# 2. 使用 NSIS 编译安装程序
makensis installer.nsi

# 3. 安装程序在当前目录
```

## 打包文件说明

### 核心文件
- `main.py` - 主程序入口
- `voice.py` - 语音转录模块
- `case_structurer.py` - 病例结构化模块
- `case_manager.py` - 数据管理模块
- `document_generator.py` - 文档生成模块
- `nlp_processor.py` - NLP 处理模块

### 配置文件
- `config.json` - 应用配置
- `语音转病例助手.spec` - PyInstaller 配置

### 打包脚本
- `build.bat` - 完整打包脚本
- `build_simple.bat` - 快速打包脚本
- `installer.nsi` - NSIS 安装程序脚本

### 文档文件
- `README.md` - 项目说明
- `用户手册.md` - 用户手册
- `TEST_REPORT.md` - 测试报告

## 依赖项

### Python 依赖
```
tkinter (内置)
python-docx
websocket-client
pyaudio
pycryptodome
```

### 系统要求
- Windows 10/11
- Python 3.10+
- 麦克风设备
- 网络连接

## 打包输出

### PyInstaller 输出
```
dist/
├── 语音转病例助手.exe    # 单文件可执行程序
└── 语音转病例助手/        # 目录版本（可选）
    ├── 语音转病例助手.exe
    ├── config.json
    └── ...
```

### NSIS 输出
```
语音转病例助手_Setup.exe    # Windows 安装程序
```

## 分发准备

### 1. 测试打包结果
在目标系统上测试打包后的程序：
- 启动程序
- 测试语音转录
- 测试病例结构化
- 测试文档生成
- 测试保存和加载

### 2. 创建发布包
```
发布包/
├── 语音转病例助手_Setup.exe    # 安装程序
├── README.txt                   # 安装说明
└── 用户手册.pdf                  # 用户手册（可选）
```

### 3. 版本号管理
在 `语音转病例助手.spec` 中更新版本号：
```python
VERSIONMAJOR = 1
VERSIONMINOR = 0
VERSIONBUILD = 0
```

## 常见问题

### Q: 打包失败怎么办？
A: 
1. 检查 Python 版本是否为 3.10+
2. 确保所有依赖已安装：`pip install -r requirements.txt`
3. 检查 PyInstaller 是否正确安装：`pip show pyinstaller`

### Q: 打包后的程序无法启动？
A:
1. 检查是否缺少依赖文件
2. 确认 config.json 在正确位置
3. 查看错误日志

### Q: 如何减小打包体积？
A:
1. 使用 `--onefile` 选项
2. 排除不必要的模块
3. 使用 UPX 压缩

### Q: 如何添加自定义图标？
A:
1. 准备 icon.ico 文件
2. 在打包命令中添加 `--icon=icon.ico`
3. 或在 .spec 文件中设置 `icon='icon.ico'`

## 发布检查清单

- [ ] 所有功能测试通过
- [ ] 打包程序在目标系统运行正常
- [ ] 安装程序测试通过
- [ ] 卸载程序测试通过
- [ ] 用户手册更新完成
- [ ] 版本号更新
- [ ] 发布说明编写完成
- [ ] 已知问题文档化

## 技术支持

如遇到打包问题，请参考：
- PyInstaller 官方文档：https://pyinstaller.org/
- NSIS 官方文档：https://nsis.sourceforge.io/
- 项目 GitHub Issues：https://github.com/your-repo/aisci/issues
