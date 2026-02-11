# Download VSCode Encrypt Extension

## Latest Release: v1.2.0

### Direct Download

📦 **[Download vscode-encrypt-1.2.0.vsix](releases/vscode-encrypt-1.2.0.vsix)** (~58 KB)

### Installation Instructions

#### Method 1: VS Code UI (Recommended)

1. Download the `.vsix` file from the [releases directory](releases/)
2. Open VS Code
3. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
4. Click `...` (More Actions) in the Extensions view
5. Select `Install from VSIX...`
6. Choose the downloaded `.vsix` file
7. Wait for installation to complete
8. Reload VS Code if prompted

#### Method 2: Command Line

```bash
# Download the file first, then:
code --install-extension releases/vscode-encrypt-1.2.0.vsix
```

#### Method 3: GitHub Releases

Visit the [GitHub Releases page](https://github.com/SunArthur666/vscode-encrypt-plugin/releases) for all versions.

### Verify Installation

After installation, verify the extension is installed:

```bash
code --list-extensions | grep vscode-encrypt
```

You should see: `SunArthur666.vscode-encrypt`

### All Releases

| Version | File | Size | Release Date | Notes |
|---------|------|------|--------------|-------|
| 1.2.0 | [vscode-encrypt-1.2.0.vsix](releases/vscode-encrypt-1.2.0.vsix) | ~58 KB | 2026-02-11 | Search & Replace functionality |
| 1.1.0 | [vscode-encrypt-1.1.0.vsix](releases/vscode-encrypt-1.1.0.vsix) | ~55 KB | 2026-02-04 | Apple-style UI, Memory-only decrypt |

### Troubleshooting

**Installation fails:**
- Make sure VS Code is closed before installing via command line
- Check VS Code version compatibility (requires VS Code ^1.85.0)
- Try installing from the VS Code Marketplace instead

**Extension not working:**
- Reload VS Code window (`Ctrl+R` / `Cmd+R`)
- Check the Output panel for error messages
- Verify the extension is enabled in Extensions view

**Need help?**
- Open an [issue](https://github.com/SunArthur666/vscode-encrypt-plugin/issues)
- Check the [README](README.md) for usage instructions
- Review the [FAQ](README.md#faq) section

### Building from Source

If you prefer to build your own VSIX:

```bash
git clone https://github.com/SunArthur666/vscode-encrypt-plugin.git
cd vscode-encrypt-plugin
npm install
npm run compile
npx vsce package
```

The VSIX file will be generated in the project root.

### Security

All VSIX files are built from the source code in this repository. You can verify the integrity by:
1. Comparing the file hash
2. Building from source yourself
3. Reviewing the source code before installation

---

**Note:** VSIX files are ZIP archives. You can inspect the contents with any ZIP tool if needed.
