# Contributing to VSCode Encrypt

Thank you for your interest in contributing to VSCode Encrypt! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all skill levels.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/SunArthur666/vscode-encrypt-plugin/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - VS Code version and OS
   - Extension version

### Suggesting Features

1. Check existing [Issues](https://github.com/SunArthur666/vscode-encrypt-plugin/issues) for similar suggestions
2. Create a new issue with:
   - Clear description of the feature
   - Use case / why it's needed
   - Possible implementation approach (optional)

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting: `npm run lint`
5. Commit with clear message: `git commit -m 'Add amazing feature'`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- VS Code 1.85+
- npm or yarn

### Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/vscode-encrypt-plugin.git
cd vscode-encrypt-plugin

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (for development)
npm run watch
```

### Running & Debugging

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test your changes in the new VS Code window

### Project Structure

```
vscode-encrypt/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── commands/             # Command handlers
│   │   ├── fileCommands.ts   # File encryption commands
│   │   └── selectionCommands.ts # Text selection commands
│   ├── services/             # Core services
│   │   ├── EncryptionService.ts # AES-256-GCM encryption
│   │   └── PasswordService.ts   # Password caching
│   ├── editors/              # Custom editors
│   │   └── EncryptedFileEditor.ts
│   ├── providers/            # Content providers
│   │   └── EncryptedDocumentProvider.ts
│   ├── ui/                   # UI components
│   │   ├── PasswordPrompt.ts
│   │   └── DecryptPanel.ts
│   └── types.ts              # TypeScript types
├── images/                   # Icons and images
├── package.json              # Extension manifest
└── tsconfig.json             # TypeScript config
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Handle errors appropriately

### Security

- **NEVER** log passwords or sensitive data
- **NEVER** write plaintext to disk
- Always use secure random number generation
- Follow cryptographic best practices

### Commits

- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused and atomic

## Testing

Currently, the project uses manual testing. Contributions to add automated tests are welcome!

```bash
# Run linting
npm run lint

# Compile and check for errors
npm run compile
```

## Release Process

Releases are managed by the maintainers. To request a release:

1. Ensure all changes are merged to main
2. Update CHANGELOG.md
3. Create a GitHub release

## Questions?

Feel free to open an issue for any questions about contributing.

---

Thank you for contributing to VSCode Encrypt! 🔐
