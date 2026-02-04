# 开发调试指南

## 前置要求

- **Node.js**: 18+ 
- **VS Code**: 1.85+
- **npm**: 随 Node.js 一起安装

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译项目

```bash
npm run compile
```

这会编译 TypeScript 代码到 `out/` 目录。

### 3. 启动调试

有两种方式启动调试：

#### 方式一：使用 VS Code 调试面板（推荐）

1. 在 VS Code 中打开项目
2. 按 `F5` 或点击左侧调试图标
3. 选择 **"Run Extension"** 配置
4. 点击绿色播放按钮或按 `F5`

这会：
- 自动编译 TypeScript（如果 `out/` 目录不存在）
- 启动一个新的 VS Code 窗口（Extension Development Host）
- 在新窗口中加载你的扩展

#### 方式二：使用命令行

```bash
# 先编译
npm run compile

# 然后使用 VS Code 命令行启动
code --extensionDevelopmentPath=$(pwd)
```

## 开发工作流

### 监听模式（自动编译）

在开发时，建议使用监听模式，这样修改代码后会自动重新编译：

```bash
npm run watch
```

这个命令会：
- 监听 `src/` 目录下的所有 `.ts` 文件
- 自动编译到 `out/` 目录
- 显示编译错误和警告

**注意**：在监听模式下，修改代码后需要：
1. 等待编译完成（通常几秒钟）
2. 在 Extension Development Host 窗口中按 `Ctrl+R` (Windows/Linux) 或 `Cmd+R` (macOS) 重新加载扩展

### 调试技巧

#### 1. 设置断点

- 在源代码中点击行号左侧设置断点（红色圆点）
- 断点会在 Extension Development Host 中触发

#### 2. 查看日志

扩展的日志会显示在：
- **调试控制台**（Debug Console）- 在 VS Code 主窗口的底部面板
- **开发者工具**（Developer Tools）- 在 Extension Development Host 窗口中：
  - 按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (macOS)
  - 或菜单：`Help > Toggle Developer Tools`

#### 3. 重新加载扩展

修改代码后，在 Extension Development Host 窗口中：
- 按 `Ctrl+R` (Windows/Linux) 或 `Cmd+R` (macOS)
- 或使用命令面板：`Developer: Reload Window`

#### 4. 检查扩展是否加载

在 Extension Development Host 窗口中：
1. 打开命令面板 (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. 输入 `Encrypt`，应该能看到所有扩展命令

### 测试功能

#### 测试文件加密

1. 在 Extension Development Host 窗口中
2. 右键点击文件夹 → **"Create Encrypted File"**
3. 输入文件名（如 `test.md.enc`）
4. 设置密码和提示
5. 开始编辑，内容会自动加密保存

#### 测试文本加密

1. 打开任意文件（如 `.md` 文件）
2. 选中一些文本
3. 右键 → **"Encrypt Selection"**
4. 设置密码
5. 文本会被替换为加密标记

#### 测试解密

1. 双击 `.md.enc` 文件打开
2. 输入密码
3. 查看解密后的内容

## 常见问题

### 问题：扩展没有加载

**解决方案**：
1. 检查 `out/extension.js` 是否存在
2. 运行 `npm run compile` 确保编译成功
3. 查看调试控制台的错误信息

### 问题：修改代码后没有生效

**解决方案**：
1. 确保 `npm run watch` 正在运行
2. 等待编译完成（查看终端输出）
3. 在 Extension Development Host 窗口中按 `Ctrl+R` / `Cmd+R` 重新加载

### 问题：断点不生效

**解决方案**：
1. 确保 `tsconfig.json` 中 `sourceMap: true`
2. 检查 `out/` 目录中是否有对应的 `.js.map` 文件
3. 重新编译：`npm run compile`

### 问题：TypeScript 编译错误

**解决方案**：
1. 查看终端中的错误信息
2. 运行 `npm run lint` 检查代码规范
3. 修复错误后重新编译

## 代码检查

### 运行 Linter

```bash
npm run lint
```

这会检查代码风格和潜在问题。

### 修复自动修复的问题

```bash
npm run lint -- --fix
```

## 项目结构

```
vscode-encrypt-plugin/
├── src/                    # 源代码目录
│   ├── extension.ts        # 扩展入口点
│   ├── commands/           # 命令处理
│   ├── services/           # 业务逻辑
│   ├── editors/            # 自定义编辑器
│   ├── providers/          # 内容提供者
│   ├── ui/                 # UI 组件
│   └── types.ts            # 类型定义
├── out/                    # 编译输出（自动生成）
├── .vscode/                # VS Code 配置
│   ├── launch.json         # 调试配置
│   └── tasks.json          # 任务配置
└── package.json            # 项目配置
```

## 调试配置说明

### launch.json

- **Run Extension**: 启动扩展开发主机
- **Extension Tests**: 运行测试（如果有）

### tasks.json

- **npm: watch**: 监听模式编译（默认构建任务）
- **npm: compile**: 一次性编译

## 性能优化

### 开发时禁用某些功能

可以在代码中添加开发模式检查：

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
```

### 减少日志输出

在生产环境中移除 `console.log`，使用 VS Code 的日志 API：

```typescript
import * as vscode from 'vscode';
const outputChannel = vscode.window.createOutputChannel('Encrypt');
outputChannel.appendLine('Debug message');
```

## 下一步

- 查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解代码规范
- 查看 [SECURITY.md](SECURITY.md) 了解安全注意事项
- 查看源代码注释了解实现细节

---

**提示**：开发时保持 `npm run watch` 运行，这样修改代码后会自动编译！
