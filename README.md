<p align="center">
  <img src="images/icon.png" alt="VSCode Encrypt Logo" width="128" height="128">
</p>

<h1 align="center">VSCode Encrypt</h1>

<p align="center">
  <strong>Military-grade AES-256 encryption for your files and text in VS Code</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=SunArthur666.vscode-encrypt">
    <img src="https://img.shields.io/visual-studio-marketplace/v/SunArthur666.vscode-encrypt?style=flat-square&logo=visual-studio-code" alt="VS Code Marketplace">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=SunArthur666.vscode-encrypt">
    <img src="https://img.shields.io/visual-studio-marketplace/d/SunArthur666.vscode-encrypt?style=flat-square" alt="Downloads">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=SunArthur666.vscode-encrypt">
    <img src="https://img.shields.io/visual-studio-marketplace/r/SunArthur666.vscode-encrypt?style=flat-square" alt="Rating">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License">
  </a>
  <a href="https://github.com/SunArthur666/vscode-encrypt-plugin/issues">
    <img src="https://img.shields.io/github/issues/SunArthur666/vscode-encrypt-plugin?style=flat-square" alt="GitHub Issues">
  </a>
  <a href="releases/vscode-encrypt-1.2.0.vsix">
    <img src="https://img.shields.io/badge/download-VSIX-blue?style=flat-square&logo=visual-studio-code" alt="Download VSIX">
  </a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#commands">Commands</a> •
  <a href="#settings">Settings</a> •
  <a href="#faq">FAQ</a> •
  <a href="releases/">Downloads</a>
</p>

---

[English](#english) | [中文](#中文)

---

<a name="english"></a>

## English

Encrypt entire files or selected text with **AES-256-GCM** — the same encryption standard trusted by governments worldwide. Your data never touches disk unencrypted.

### Demo

<!-- TODO: Add GIF demos -->
<!-- 
<p align="center">
  <img src="images/demo-create.gif" alt="Create Encrypted File" width="600">
  <br>
  <em>Create an encrypted file</em>
</p>

<p align="center">
  <img src="images/demo-encrypt-selection.gif" alt="Encrypt Selection" width="600">
  <br>
  <em>Encrypt selected text</em>
</p>
-->

### Features

| Feature | Description |
|---------|-------------|
| 🔐 **File Encryption** | Create and edit encrypted `.md.enc` files with instant-save |
| ✂️ **In-Place Text Encryption** | Encrypt selected text within any file |
| 🛡️ **AES-256-GCM** | Military-grade encryption with authentication |
| 🔑 **Password Protection** | Required password for every file access |
| 💡 **Password Hints** | Optional hints to help remember passwords |
| ⏱️ **Session Cache** | Remember passwords during your session (configurable) |
| 🚫 **Zero Knowledge** | Plaintext NEVER touches disk |
| 📝 **Markdown Preview** | Split view with live Markdown preview |
| 🔄 **Obsidian Compatible** | Works with Obsidian Encrypt v2.0 files |
| 👁️ **Memory-Only Decrypt** | View decrypted content without writing to disk (Git-safe) |
| 🎨 **Apple-Style UI** | Beautiful, minimalist password prompt interface |
| 🔍 **Search & Replace** | Full-featured search and replace in encrypted editor |

### Security Guarantees

> **⚠️ Plaintext NEVER touches disk**

| ✅ Guaranteed | ❌ Never Happens |
|--------------|------------------|
| Encrypted data only written to disk | Plaintext in temp files |
| Memory cleared on file close | Plaintext in crash dumps |
| Safe from crashes & backups | Accessible to other extensions |

### Installation

#### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"VSCode Encrypt"**
4. Click **Install**

#### From VSIX File (Direct Download)

**Download the latest release:**
- 📦 [vscode-encrypt-1.2.0.vsix](releases/vscode-encrypt-1.2.0.vsix) (~55 KB)
- 📋 [View all releases](releases/)

**Installation methods:**

**Option 1: VS Code UI**
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Click `...` (More Actions) → `Install from VSIX...`
4. Select the downloaded `.vsix` file

**Option 2: Command Line**
```bash
code --install-extension releases/vscode-encrypt-1.2.0.vsix
```

**Option 3: GitHub Releases**
Visit the [Releases page](https://github.com/SunArthur666/vscode-encrypt-plugin/releases) for the latest version.

#### From Source

```bash
git clone https://github.com/SunArthur666/vscode-encrypt-plugin.git
cd vscode-encrypt-plugin
npm install
npm run compile
```

Press `F5` in VS Code to launch in debug mode.

**Build VSIX from source:**
```bash
npm install
npm run compile
npx vsce package
```

### Quick Start

#### Create an Encrypted File

1. Right-click any folder in Explorer → **"Create Encrypted File"**
2. Name it (e.g., `secrets.md.enc`)
3. Set a password + optional hint
4. Start typing — everything is instantly encrypted on save

#### Encrypt Text Selection

1. Select any text in a file
2. Right-click → **"Encrypt Selection"**
3. Set a password
4. Text becomes: `🔐your_hint:encrypted_data🔐`

### Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `Create Encrypted File` | Create a new encrypted file | Explorer context menu |
| `Encrypt Current File` | Encrypt the current `.md` file | Editor context menu |
| `Decrypt Current File` | Decrypt with options: to file or memory-only | Editor context menu |
| `Change Password` | Change password for encrypted file | Title bar |
| `Encrypt Selection` | Encrypt selected text | Editor context menu |
| `Decrypt Selection/Cursor` | Decrypt text at cursor | Editor context menu |
| `Lock and Close All` | Close all encrypted files | Command palette |
| `Clear Password Cache` | Clear cached passwords | Command palette |

### Search & Replace in Encrypted Editor

When editing encrypted files (`.md.enc`), you have full search and replace capabilities:

| Action | Shortcut | Description |
|--------|----------|-------------|
| **Open Search** | `Cmd+F` / `Ctrl+F` | Open search bar |
| **Next Match** | `Enter` | Navigate to next match |
| **Previous Match** | `Shift+Enter` | Navigate to previous match |
| **Replace Current** | `Ctrl+Shift+H` / `Cmd+Shift+H` | Replace current match |
| **Replace All** | `Ctrl+Alt+Enter` / `Cmd+Alt+Enter` | Replace all matches |
| **Close Search** | `Escape` | Close search bar |

**Features:**
- Case-insensitive search
- Real-time match highlighting in both editor and preview panes
- Match counter (e.g., "3 of 10")
- Current match highlighted with distinct color
- Automatic content update and auto-save after replacement

### Decrypt Options

When decrypting a file, you can choose:

| Option | Description | Use Case |
|--------|-------------|----------|
| **Decrypt to File** | Creates a `.md` file on disk | When you need to edit and save changes |
| **View in Memory Only** | Opens read-only in memory, never written to disk | Safe viewing - won't be committed to Git |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `encrypt.confirmPassword` | `true` | Require password confirmation when encrypting |
| `encrypt.rememberPassword` | `true` | Remember password during session |
| `encrypt.rememberPasswordTimeout` | `30` | Minutes before clearing cache (0 = no timeout) |
| `encrypt.rememberPasswordLevel` | `workspace` | Cache level: `workspace` / `folder` / `file` |
| `encrypt.expandToWholeLines` | `false` | Expand selection to entire lines |
| `encrypt.showMarkerWhenReading` | `true` | Show `🔐` markers (vs hidden `%%🔐%%` mode) |

### Technical Specifications

| Component | Specification |
|-----------|---------------|
| **Algorithm** | AES-256-GCM (Galois/Counter Mode) |
| **Key Derivation** | PBKDF2-SHA512 (210,000 iterations) |
| **Salt** | 16 bytes (128 bits) |
| **IV/Nonce** | 16 bytes (128 bits) |
| **Auth Tag** | 16 bytes (128 bits) |
| **Encoding** | Base64 |

### File Format

#### Encrypted Files (.md.enc)

```json
{
  "version": "1.0",
  "hint": "optional password hint",
  "ciphertext": "base64 encrypted content",
  "salt": "base64 salt",
  "iv": "base64 initialization vector",
  "authTag": "base64 authentication tag"
}
```

#### Encrypted Text Markers

```
🔐hint:encrypted_content_here🔐
%%🔐hint:encrypted_content_here🔐%%  (hidden mode for code comments)
```

### FAQ

<details>
<summary><strong>Q: Can I recover my password if I forget it?</strong></summary>

A: **No.** The encryption is designed to be mathematically impossible to break without the password. Use hints wisely!
</details>

<details>
<summary><strong>Q: Is my data safe if VS Code crashes?</strong></summary>

A: **Yes.** Only encrypted data is ever written to disk. Unencrypted content exists only in memory.
</details>

<details>
<summary><strong>Q: Can I use this in a team?</strong></summary>

A: **Yes**, but you'll need to share passwords securely. Each person can have their own encrypted files.
</details>

<details>
<summary><strong>Q: Does this work with Git?</strong></summary>

A: **Yes.** Encrypted files can be committed to Git. Only people with the password can read the content.
</details>

<details>
<summary><strong>Q: How do I prevent decrypted files from being committed to Git?</strong></summary>

A: Use **"View in Memory Only"** when decrypting - this opens the file in a read-only buffer that is never written to disk, so it can't be accidentally committed. Alternatively, if you decrypt to a file, you can choose to add it to `.gitignore`.
</details>

<details>
<summary><strong>Q: Is this compatible with Obsidian Encrypt?</strong></summary>

A: **Yes.** Files encrypted with this extension can be decrypted with Obsidian Encrypt v2.0 and vice versa.
</details>

---

<a name="中文"></a>

## 中文

使用 **AES-256-GCM** 加密整个文件或选中的文本 - 这是全球政府信赖的加密标准。您的数据永远不会以明文形式写入磁盘。

### 功能特性

| 功能 | 描述 |
|------|------|
| 🔐 **文件加密** | 创建和编辑加密的 `.md.enc` 文件，即时保存 |
| ✂️ **原地文本加密** | 在任何文件中加密选中的文本 |
| 🛡️ **AES-256-GCM** | 带认证的军用级加密 |
| 🔑 **密码保护** | 每次访问文件都需要密码 |
| 💡 **密码提示** | 可选的提示帮助记忆密码 |
| ⏱️ **会话缓存** | 在会话期间记住密码（可配置） |
| 🚫 **零知识** | 明文永远不会写入磁盘 |
| 📝 **Markdown 预览** | 分屏视图，实时 Markdown 预览 |
| 🔄 **兼容 Obsidian** | 与 Obsidian Encrypt v2.0 文件兼容 |
| 👁️ **内存解密** | 解密内容仅在内存中查看，不写入磁盘（防止 Git 提交） |
| 🎨 **苹果风格 UI** | 精美极简的密码输入界面 |
| 🔍 **搜索和替换** | 加密编辑器中的完整搜索和替换功能 |

### 安装

#### 从 VS Code 市场安装

1. 打开 VS Code
2. 进入扩展 (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. 搜索 **"VSCode Encrypt"**
4. 点击 **安装**

#### 从 VSIX 文件安装（直接下载）

**下载最新版本：**
- 📦 [vscode-encrypt-1.2.0.vsix](releases/vscode-encrypt-1.2.0.vsix) (~55 KB)
- 📋 [查看所有版本](releases/)

**安装方式：**

**方式 1：VS Code 界面**
1. 打开 VS Code
2. 进入扩展 (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. 点击 `...` (更多操作) → `从 VSIX 安装...`
4. 选择下载的 `.vsix` 文件

**方式 2：命令行**
```bash
code --install-extension releases/vscode-encrypt-1.2.0.vsix
```

**方式 3：GitHub Releases**
访问 [Releases 页面](https://github.com/SunArthur666/vscode-encrypt-plugin/releases) 获取最新版本。

### 快速开始

#### 创建加密文件

1. 在资源管理器中右键点击任意文件夹 → **"Create Encrypted File"**
2. 命名文件（例如 `secrets.md.enc`）
3. 设置密码和可选的提示
4. 开始输入 - 保存时自动加密

#### 加密选中文本

1. 在文件中选择任意文本
2. 右键 → **"Encrypt Selection"**
3. 设置密码
4. 文本变为：`🔐your_hint:encrypted_data🔐`

### 命令

| 命令 | 描述 |
|------|------|
| `Create Encrypted File` | 创建新的加密文件 |
| `Encrypt Current File` | 加密当前文件 |
| `Decrypt Current File` | 解密当前文件（可选：写入文件或仅在内存中查看） |
| `Change Password` | 修改加密文件密码 |
| `Encrypt Selection` | 加密选中的文本 |
| `Decrypt Selection/Cursor` | 解密光标处的文本 |
| `Lock and Close All` | 锁定并关闭所有加密文件 |
| `Clear Password Cache` | 清除密码缓存 |

### 加密编辑器中的搜索和替换

编辑加密文件（`.md.enc`）时，您可以使用完整的搜索和替换功能：

| 操作 | 快捷键 | 描述 |
|------|--------|------|
| **打开搜索** | `Cmd+F` / `Ctrl+F` | 打开搜索栏 |
| **下一个匹配** | `Enter` | 跳转到下一个匹配 |
| **上一个匹配** | `Shift+Enter` | 跳转到上一个匹配 |
| **替换当前** | `Ctrl+Shift+H` / `Cmd+Shift+H` | 替换当前匹配 |
| **替换全部** | `Ctrl+Alt+Enter` / `Cmd+Alt+Enter` | 替换所有匹配 |
| **关闭搜索** | `Escape` | 关闭搜索栏 |

**功能特性：**
- 大小写不敏感搜索
- 在编辑器和预览面板中实时高亮匹配项
- 匹配计数器（例如 "3 of 10"）
- 当前匹配项使用不同颜色高亮
- 替换后自动更新内容并自动保存

### 解密选项

解密文件时，你可以选择：

| 选项 | 描述 | 使用场景 |
|------|------|----------|
| **解密到文件** | 在磁盘上创建 `.md` 文件 | 需要编辑和保存修改时使用 |
| **仅在内存中查看** | 以只读方式在内存中打开，永不写入磁盘 | 安全查看 - 不会被 Git 提交 |

### 设置

| 设置 | 默认值 | 描述 |
|------|--------|------|
| `encrypt.confirmPassword` | `true` | 加密时需要确认密码 |
| `encrypt.rememberPassword` | `true` | 在会话期间记住密码 |
| `encrypt.rememberPasswordTimeout` | `30` | 清除缓存前的分钟数（0 = 不超时） |
| `encrypt.rememberPasswordLevel` | `workspace` | 缓存级别：`workspace` / `folder` / `file` |
| `encrypt.expandToWholeLines` | `false` | 将选择扩展到整行 |
| `encrypt.showMarkerWhenReading` | `true` | 显示 `🔐` 标记（vs 隐藏的 `%%🔐%%` 模式） |

---

## Download

📦 **Pre-built VSIX packages available:**
- [Download Latest Release](releases/vscode-encrypt-1.2.0.vsix)
- [View All Releases](releases/)
- [Download Page](DOWNLOAD.md) - Detailed installation instructions

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

For security concerns, please see [SECURITY.md](SECURITY.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT © 2026 [SunArthur666](https://github.com/SunArthur666)

## Acknowledgments

This extension is inspired by [Obsidian Encrypt](https://github.com/meld-cp/obsidian-encrypt) by [meld-cp](https://github.com/meld-cp).

---

<p align="center">
  <strong>Made with 🔒 for your privacy</strong>
</p>
