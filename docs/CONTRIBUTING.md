# 贡献指南

感谢您对语音转病例助手项目的关注！我们欢迎任何形式的贡献。

---

## 🤝 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议：

1. 检查 [Issues](https://github.com/your-repo/aisci/issues) 是否已有相关问题
2. 如果没有，创建新的 Issue
3. 详细描述问题或建议
4. 提供复现步骤（如果是 bug）
5. 附上相关截图或日志（如果适用）

### 提交代码

#### 1. Fork 仓库

点击 GitHub 页面右上角的 "Fork" 按钮

#### 2. 克隆您的 Fork

```bash
git clone https://github.com/your-username/aisci.git
cd aisci
```

#### 3. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

分支命名规范：
- `feature/` - 新功能
- `fix/` - bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关

#### 4. 进行更改

- 遵循代码规范（见下文）
- 添加必要的注释
- 确保代码通过测试
- 更新相关文档

#### 5. 提交更改

```bash
git add .
git commit -m "Add some feature"
```

提交信息规范：
```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- `feat`: 新功能
- `fix`: bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新增功能也不是修复 bug）
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

示例：
```
feat(transcription): add speaker diarization support

Add support for distinguishing between doctor and patient
in voice transcription using iFlytek's speaker separation
feature.

Closes #123
```

#### 6. 推送到您的 Fork

```bash
git push origin feature/your-feature-name
```

#### 7. 创建 Pull Request

1. 访问您 Fork 的 GitHub 页面
2. 点击 "New Pull Request"
3. 选择您的分支
4. 填写 PR 描述：
   - 清晰的标题
   - 详细的描述
   - 相关 Issue 编号
   - 截图或演示（如果适用）
5. 提交 PR

---

## 📝 代码规范

### Python 代码规范

遵循 [PEP 8](https://www.python.org/dev/peps/pep-0008/) 规范：

#### 命名规范

- **变量/函数/方法**：snake_case
  ```python
  def transcribe_audio():
      audio_data = ...
  ```

- **类名**：PascalCase
  ```python
  class VoiceRecorder:
      pass
  ```

- **常量**：UPPER_SNAKE_CASE
  ```python
  MAX_AUDIO_LENGTH = 60000
  ```

- **私有成员**：_leading_underscore
  ```python
  def _private_method(self):
      pass
  ```

#### 代码格式

- 使用 4 个空格缩进
- 每行最大长度 79 字符
- 运算符周围使用空格
- 逗号后使用空格
- 函数和类定义之间空两行

```python
def transcribe_audio(audio_data):
    """
    Transcribe audio data to text.
    
    Args:
        audio_data: Base64 encoded audio data
        
    Returns:
        Transcribed text
    """
    result = process_audio(audio_data)
    return result


class VoiceRecorder:
    """Voice recorder and transcriber."""
    
    def __init__(self):
        self.recognizer = VoiceRecognizer()
```

#### 文档字符串

使用 Google 风格的文档字符串：

```python
def transcribe_audio(audio_data, format='wav'):
    """
    Transcribe audio data to text.
    
    Args:
        audio_data (str): Base64 encoded audio data
        format (str): Audio format, default 'wav'
        
    Returns:
        dict: Transcription result with 'status' and 'data'
        
    Raises:
        ValueError: If audio data is invalid
        ConnectionError: If API connection fails
        
    Example:
        >>> result = transcribe_audio(audio_base64)
        >>> print(result['data']['transcript'])
    """
    pass
```

#### 类型提示

建议使用类型提示：

```python
from typing import Optional, Dict, List

def transcribe_audio(
    audio_data: str,
    format: str = 'wav'
) -> Dict[str, any]:
    """Transcribe audio data to text."""
    pass

def get_case(case_id: str) -> Optional[Dict]:
    """Get case by ID."""
    pass
```

### JavaScript 代码规范

遵循 [ESLint](https://eslint.org/) 规范：

#### 命名规范

- **变量/函数**：camelCase
  ```javascript
  const transcribeAudio = () => {};
  ```

- **类/组件**：PascalCase
  ```javascript
  class VoiceRecorder {}
  ```

- **常量**：UPPER_SNAKE_CASE
  ```javascript
  const MAX_AUDIO_LENGTH = 60000;
  ```

#### 代码格式

- 使用 2 个空格缩进
- 使用单引号
- 使用分号
- 每行最大长度 100 字符

```javascript
const transcribeAudio = async (audioData, format = 'wav') => {
  try {
    const response = await axios.post('/api/transcribe', {
      audio_data: audioData,
      format: format
    });
    return response.data;
  } catch (error) {
    console.error('Transcription failed:', error);
    throw error;
  }
};
```

---

## 🧪 测试

### 编写测试

为所有新功能编写测试：

```python
# test_voice.py
import pytest
from voice import VoiceRecorder

def test_transcribe_audio():
    """Test audio transcription."""
    recorder = VoiceRecorder()
    result = recorder.transcribe_file('test.wav')
    assert result is not None
    assert len(result) > 0
```

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest test_voice.py

# 运行特定测试函数
pytest test_voice.py::test_transcribe_audio

# 查看测试覆盖率
pytest --cov=. --cov-report=html
```

### 测试要求

- 所有新功能必须有对应的测试
- 测试覆盖率不低于 80%
- 所有测试必须通过才能合并

---

## 📖 文档

### 更新文档

任何代码更改都应该更新相关文档：

- **API 变更**：更新 [API文档.md](API文档.md)
- **功能变更**：更新 [用户手册.md](用户手册.md)
- **架构变更**：更新 [技术白皮书.md](技术白皮书.md)
- **部署变更**：更新 [BUILD_GUIDE.md](BUILD_GUIDE.md)

### 文档规范

- 使用清晰简洁的语言
- 提供代码示例
- 包含必要的截图
- 保持文档与代码同步

---

## 🔍 代码审查

### 审查流程

1. 提交 PR 后，维护者会进行代码审查
2. 根据反馈进行修改
3. 所有审查通过后，代码将被合并

### 审查标准

- 代码符合规范
- 测试充分且通过
- 文档完整且准确
- 没有引入新的 bug
- 性能没有明显下降

---

## 🎯 开发环境

### 设置开发环境

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/aisci.git
cd aisci

# 2. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 3. 安装依赖
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 4. 运行测试
pytest

# 5. 启动应用
python main.py
```

### 开发依赖

创建 `requirements-dev.txt`：

```txt
pytest
pytest-cov
black
flake8
mypy
```

### 代码格式化

```bash
# 格式化代码
black .

# 检查代码规范
flake8 .

# 类型检查
mypy .
```

---

## 📋 Pull Request 模板

创建 PR 时，请使用以下模板：

```markdown
## 描述
简要描述此 PR 的目的和内容。

## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能优化
- [ ] 其他

## 相关 Issue
Closes #(issue number)

## 测试
- [ ] 添加了新测试
- [ ] 所有测试通过
- [ ] 手动测试通过

## 文档
- [ ] 更新了 API 文档
- [ ] 更新了用户手册
- [ ] 更新了其他相关文档

## 截图/演示
（如果适用）

## 检查清单
- [ ] 代码符合规范
- [ ] 添加了必要的注释
- [ ] 更新了相关文档
- [ ] 没有引入新的警告
- [ ] 没有破坏现有功能
```

---

## 🎨 设计原则

### 核心原则

1. **用户优先**：始终以用户体验为出发点
2. **简单性**：保持代码简单易懂
3. **可维护性**：编写易于维护的代码
4. **性能**：关注性能和效率
5. **安全性**：保护用户数据和隐私

### 代码质量

- 避免重复代码（DRY 原则）
- 保持函数短小精悍
- 使用有意义的命名
- 添加必要的注释
- 编写可测试的代码

---

## 📞 联系方式

如有任何问题或建议：

- **GitHub Issues**: https://github.com/your-repo/aisci/issues
- **Email**: support@example.com
- **微信群**: 扫码加入技术交流群

---

## 📄 许可证

通过贡献代码，您同意您的贡献将根据项目的 [MIT 许可证](LICENSE) 进行许可。

---

感谢您的贡献！🎉
