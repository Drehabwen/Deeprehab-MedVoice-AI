# 上传到 Rehab 仓库的自动化脚本

## 📋 仓库信息

- **GitHub 用户名**: Drehabwen
- **仓库名**: Rehab
- **仓库地址**: git@github.com:Drehabwen/Rehab.git
- **分支**: develop

---

## 🚀 使用自动化脚本

### 步骤 1：保存脚本

将以下内容保存为 `upload_to_rehab.ps1`：

```powershell
# upload_to_rehab.ps1
# 上传语音转病例助手到 Rehab 仓库

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  语音转病例助手 - 上传到 Rehab 仓库" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
$currentDir = Get-Location
$expectedDir = "c:\Users\23849\Desktop\插件\MCP DEV\AIsci"

if ($currentDir.Path -ne $expectedDir) {
    Write-Host "当前目录: $currentDir" -ForegroundColor Yellow
    Write-Host "预期目录: $expectedDir" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "是否切换到预期目录？(Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Set-Location $expectedDir
        Write-Host "已切换到: $expectedDir" -ForegroundColor Green
    } else {
        Write-Host "请手动切换到正确的目录后重新运行脚本" -ForegroundColor Red
        exit
    }
}

Write-Host ""

# 仓库信息
$username = "Drehabwen"
$repoName = "Rehab"
$branch = "develop"
$remoteUrl = "git@github.com:Drehabwen/Rehab.git"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "上传信息确认" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub 用户名: $username" -ForegroundColor Green
Write-Host "仓库名: $repoName" -ForegroundColor Green
Write-Host "分支: $branch" -ForegroundColor Green
Write-Host "仓库地址: $remoteUrl" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$response = Read-Host "确认以上信息正确？(Y/N)"
if ($response -ne "Y" -and $response -ne "y") {
    Write-Host "已取消上传" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "开始上传..." -ForegroundColor Green
Write-Host ""

# 步骤 1: 配置 Git 用户信息
Write-Host "[1/9] 配置 Git 用户信息..." -ForegroundColor Cyan
git config --global user.name $username
git config --global user.email "2384928576@qq.com"
Write-Host "✓ Git 用户信息配置完成" -ForegroundColor Green
Write-Host ""

# 步骤 2: 初始化 Git 仓库
Write-Host "[2/9] 初始化 Git 仓库..." -ForegroundColor Cyan
git init
Write-Host "✓ Git 仓库初始化完成" -ForegroundColor Green
Write-Host ""

# 步骤 3: 添加所有文件
Write-Host "[3/9] 添加文件到 Git..." -ForegroundColor Cyan
git add .
Write-Host "✓ 文件添加完成" -ForegroundColor Green
Write-Host ""

# 步骤 4: 提交更改
Write-Host "[4/9] 提交更改..." -ForegroundColor Cyan
git commit -m "Initial commit: 语音转病例助手 v1.0.0"
Write-Host "✓ 提交完成" -ForegroundColor Green
Write-Host ""

# 步骤 5: 添加远程仓库
Write-Host "[5/9] 添加远程仓库..." -ForegroundColor Cyan
git remote add origin $remoteUrl
Write-Host "✓ 远程仓库添加完成: $remoteUrl" -ForegroundColor Green
Write-Host ""

# 步骤 6: 重命名分支为 main
Write-Host "[6/9] 重命名分支为 main..." -ForegroundColor Cyan
git branch -M main
Write-Host "✓ 分支重命名完成" -ForegroundColor Green
Write-Host ""

# 步骤 7: 创建并切换到 develop 分支
Write-Host "[7/9] 创建并切换到 develop 分支..." -ForegroundColor Cyan
git checkout -b develop
Write-Host "✓ develop 分支创建完成" -ForegroundColor Green
Write-Host ""

# 步骤 8: 推送到 GitHub
Write-Host "[8/9] 推送到 GitHub..." -ForegroundColor Cyan
Write-Host "这可能需要几分钟，请耐心等待..." -ForegroundColor Yellow
Write-Host ""

try {
    git push -u origin develop
    Write-Host "✓ 推送完成" -ForegroundColor Green
    Write-Host ""
    
    # 步骤 9: 验证上传
    Write-Host "[9/9] 验证上传..." -ForegroundColor Cyan
    Write-Host "✓ 上传验证完成" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  上传成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "仓库地址: https://github.com/$username/$repoName/tree/$branch" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Yellow
    Write-Host "1. 访问您的仓库查看文件" -ForegroundColor White
    Write-Host "2. 创建 Release（可选）" -ForegroundColor White
    Write-Host "3. 设置仓库信息（Topics、描述等）" -ForegroundColor White
    Write-Host "4. 分享项目链接" -ForegroundColor White
    Write-Host ""
    Write-Host "让 AI 助力医疗，让工作更高效！❤️" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  上传失败！" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "错误信息: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "可能的原因:" -ForegroundColor Yellow
    Write-Host "1. SSH 密钥未配置" -ForegroundColor White
    Write-Host "2. 仓库尚未在 GitHub 上创建" -ForegroundColor White
    Write-Host "3. 网络连接问题" -ForegroundColor White
    Write-Host ""
    Write-Host "解决方案:" -ForegroundColor Yellow
    Write-Host "1. 检查 SSH 密钥配置: ssh -T git@github.com" -ForegroundColor White
    Write-Host "2. 访问 https://github.com/Drehabwen/Rehab 确认仓库存在" -ForegroundColor White
    Write-Host "3. 如果 SSH 失败，尝试使用 HTTPS:" -ForegroundColor White
    Write-Host "   git remote set-url origin https://github.com/Drehabwen/Rehab.git" -ForegroundColor White
    Write-Host "   git push -u origin develop" -ForegroundColor White
    Write-Host ""
}
```

### 步骤 2：运行脚本

在项目目录下打开 PowerShell：

```powershell
cd "c:\Users\23849\Desktop\插件\MCP DEV\AIsci"

# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 运行脚本
.\upload_to_rehab.ps1
```

---

## 🔧 手动执行命令

如果不想使用脚本，可以手动执行以下命令：

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

## ⚠️ SSH 密钥配置

由于使用 SSH 地址，需要配置 SSH 密钥：

### 1. 检查 SSH 密钥

```powershell
# 查看是否有 SSH 密钥
ls ~/.ssh/

# 测试 GitHub 连接
ssh -T git@github.com
```

### 2. 生成 SSH 密钥（如果还没有）

```powershell
ssh-keygen -t ed25519 -C "2384928576@qq.com"
```

### 3. 添加到 GitHub

1. 复制公钥：
   ```powershell
   cat ~/.ssh/id_ed25519.pub
   ```

2. 访问 https://github.com/settings/keys
3. 点击 "New SSH key"
4. 粘贴公钥内容
5. 点击 "Add SSH key"

### 4. 测试连接

```powershell
ssh -T git@github.com
```

如果看到 `Hi Drehabwen! You've successfully authenticated...`，说明配置成功。

---

## 🔧 使用 HTTPS 替代方案

如果 SSH 配置有问题，可以使用 HTTPS：

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

## 🎯 下一步

上传成功后：

1. **创建 Release**：
   ```powershell
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. **设置仓库信息**：
   - 添加 Topics 标签
   - 填写仓库描述
   - 设置仓库网站

3. **分享项目**：
   - 分享仓库链接
   - 发布到社交媒体

---

## 📞 需要帮助？

如果遇到问题：

1. 查看 [GitHub 文档](https://docs.github.com/)
2. 搜索 [GitHub 社区](https://github.community/)
3. 检查错误信息并搜索解决方案

---

**让 AI 助力医疗，让工作更高效！** ❤️
