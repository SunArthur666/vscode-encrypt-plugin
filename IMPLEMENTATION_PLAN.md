# VSCode Encrypt Plugin 实现大纲

## 项目概述
将 Obsidian Encrypt 插件功能移植到 VSCode，实现文件加密和文本加密功能。

## 核心功能模块

### 1. 加密核心模块 (EncryptionService)
- 使用 AES-256-GCM 加密算法
- 支持 Base64 编码存储
- 加密/解密接口封装

### 2. 整文件加密功能 (Whole File Encryption)
- 创建新的加密文件 (`.md.enc`)
- 打开加密文件时自动解密显示
- 保存时自动加密
- 修改加密文件密码
- 加密/解密现有文件

### 3. 原地加密功能 (In-place Encryption)
- 选中部分文本加密
- 光标定位解密
- 加密文本标记：`🔐hint:base64data🔐`
- 隐藏标记模式：`%%🔐hint:base64data🔐%%`


### 4. 密码管理模块 (SessionPasswordService)
- 会话级密码缓存
- 密码超时机制
- 按文件/文件夹/工作区记忆密码
- 密码提示功能

### 5. UI 交互
- 密码输入对话框 (QuickPick + InputBox)
- 解密结果显示面板
- 状态栏加密状态指示器
- 右键菜单集成

### 6. 配置项 (Configuration)
- `encrypt.confirmPassword`: 加密时确认密码
- `encrypt.rememberPassword`: 记忆密码
- `encrypt.rememberPasswordTimeout`: 密码记忆超时(分钟)
- `encrypt.rememberPasswordLevel`: 密码记忆级别 (workspace/folder/file)
- `encrypt.expandToWholeLines`: 扩展选择到整行

### 7. 文件类型支持
- `.md.enc` - 加密的 Markdown 文件
- 自定义图标和语言配置

## 命令列表

| 命令ID | 描述 |
|--------|------|
| `encrypt.createEncryptedFile` | 创建新的加密文件 |
| `encrypt.encryptFile` | 加密当前文件 |
| `encrypt.decryptFile` | 解密当前文件 |
| `encrypt.changePassword` | 修改加密文件密码 |
| `encrypt.encryptSelection` | 加密选中内容 |
| `encrypt.decryptSelection` | 解密选中内容/光标位置内容 |
| `encrypt.lockAndCloseAll` | 锁定并关闭所有加密文件 |
| `encrypt.clearPasswordCache` | 清除密码缓存 |

## 文件结构
```
vscode-encrypt-plugin/
├── src/
│   ├── extension.ts                    # 主入口
│   ├── commands/                       # 命令定义
│   │   ├── fileCommands.ts             # 文件加密/解密命令
│   │   └── selectionCommands.ts        # 选中文本加密/解密命令
│   ├── services/                       # 服务层
│   │   ├── EncryptionService.ts        # 加密核心 (AES-256-GCM)
│   │   └── PasswordService.ts          # 密码管理与缓存
│   ├── editors/                        # 自定义编辑器
│   │   └── EncryptedFileEditor.ts      # 加密文件编辑器 (Custom Editor)
│   ├── providers/                      # 内容提供者
│   │   └── EncryptedDocumentProvider.ts # 加密文档内容提供者
│   ├── ui/                             # UI 组件
│   │   ├── PasswordPrompt.ts           # 密码输入对话框
│   │   └── DecryptPanel.ts             # 解密结果展示面板
│   └── types.ts                        # 类型定义
├── images/                             # 图标资源
│   └── icon.png                        # 插件图标
├── package.json
├── tsconfig.json
├── language-configuration.json         # 语言配置
└── README.md
```

## 技术栈
- **语言**: TypeScript
- **加密库**: Node.js 内置 `crypto` 模块
- **VSCode API**: vscode.extensions.*
- **依赖**: @types/node, @types/vscode
