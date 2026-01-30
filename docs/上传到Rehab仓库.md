# 上传到 Rehab 仓库的命令

## 📋 仓库信息

- **GitHub 用户名**: Drehabwen
- **仓库名**: Rehab
- **仓库地址**: git@github.com:Drehabwen/Rehab.git
- **分支**: develop

---

## 🚀 上传步骤

### 步骤 1：打开 PowerShell

```powershell
cd "c:\Users\23849\Desktop\插件\MCP DEV\AIsci"
```

### 步骤 2：配置 Git 用户信息

```powershell
git config --global user.name "Drehabwen"
git config --global user.email "2384928576@qq.com"
```

### 步骤 3：初始化 Git 仓库

```powershell
git init
```

### 步骤 4：添加所有文件

```powershell
git add .
```

### 步骤 5：提交更改

```powershell
git commit -m "Initial commit: 语音转病例助手 v1.0.0"
```

### 步骤 6：添加远程仓库

```powershell
git remote add origin git@github.com:Drehabwen/Rehab.git
```

### 步骤 7：重命名分支为 main

```powershell
git branch -M main
```

### 步骤 8：创建并切换到 develop 分支

```powershell
git checkout -b develop
```

### 步骤 9：推送到 GitHub

```powershell
git push -u origin develop
```

---

## 📝 完整命令（复制粘贴版）

```powershell
# 1. 进入项目目录
cd "c:\Users\23849\Desktop\插件\MCP DEV\AIsci"

# 2. 配置 Git 用户信息
git config --global user.name "Drehabwen"
git config --global user.email "2384928576@qq.com"

# 3. 初始化 Git 仓库
git init

# 4. 添加所有文件
git add .

# 5. 提交更改
git commit -m "Initial commit: 语音转病例助手 v1.0.0"

# 6. 添加远程仓库
git remote add origin git@github.com:Drehabwen/Rehab.git

# 7. 重命名分支为 main
git branch -M main

# 8. 创建并切换到 develop 分支
git checkout -b develop

# 9. 推送到 GitHub
git push -u origin develop
```

---

## ⚠️ 注意事项

### SSH 密钥配置

由于使用 SSH 地址 `git@github.com:Drehabwen/Rehab.git`，需要配置 SSH 密钥：

1. **生成 SSH 密钥**（如果还没有）：
   ```powershell
   ssh-keygen -t ed25519 -C "2384928576@qq.com"
   ```

2. **查看公钥**：
   ```powershell
   cat ~/.ssh/id_ed25519.pub
   ```

3. **添加到 GitHub**：
   - 访问 https://github.com/settings/keys
   - 点击 "New SSH key"
   - 粘贴公钥内容
   - 点击 "Add SSH key"

4. **测试连接**：
   ```powershell
   ssh -T git@github.com
   ```

### 如果推送失败

如果遇到 SSH 相关错误，可以使用 HTTPS 地址：

```powershell
# 移除 SSH 远程仓库
git remote remove origin

# 添加 HTTPS 远程仓库
git remote add origin https://github.com/Drehabwen/Rehab.git

# 推送
git push -u origin develop
```

---

## ✅ 验证上传

上传完成后，访问以下链接验证：

```
https://github.com/Drehabwen/Rehab/tree/develop
```

您应该能看到：
- README.md 文件
- 所有代码文件
- 所有文档文件

---

## 🎯 分支说明

- **main 分支**: 稳定版本，用于生产环境
- **develop 分支**: 开发分支，用于日常开发

当前上传到 `develop` 分支，开发工作在此分支进行。

---

## 📞 需要帮助？

如果遇到问题：

1. 查看 [GitHub 文档](https://docs.github.com/)
2. 搜索 [GitHub 社区](https://github.community/)
3. 检查错误信息并搜索解决方案

---

**让 AI 助力医疗，让工作更高效！** ❤️
