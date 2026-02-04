# Releases

This directory contains pre-built VSIX packages for the VSCode Encrypt extension.

## Download Latest Version

### Version 1.1.0
- **File**: [vscode-encrypt-1.1.0.vsix](vscode-encrypt-1.1.0.vsix)
- **Size**: ~55 KB
- **Release Date**: February 4, 2026
- **Changes**: 
  - 🎨 Apple-style minimalist password UI
  - 👁️ Memory-only decrypt mode (Git-safe)
  - 🔒 Enhanced security with Git protection warnings

## Installation

### Method 1: VS Code UI
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Click `...` (More Actions) → `Install from VSIX...`
4. Select the `.vsix` file from this directory

### Method 2: Command Line
```bash
code --install-extension releases/vscode-encrypt-1.1.0.vsix
```

### Method 3: GitHub Releases
Visit the [Releases page](https://github.com/SunArthur666/vscode-encrypt-plugin/releases) for the latest version.

## Verification

After installation, verify the extension is installed:
```bash
code --list-extensions | grep vscode-encrypt
```

You should see: `SunArthur666.vscode-encrypt`

## Troubleshooting

If installation fails:
1. Make sure VS Code is closed before installing
2. Check VS Code version compatibility (requires VS Code ^1.85.0)
3. Try installing from the VS Code Marketplace instead

## Building from Source

To build your own VSIX file:
```bash
npm install
npm run compile
npx vsce package
```

The VSIX file will be generated in the project root.
