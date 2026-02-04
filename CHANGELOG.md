# Changelog

All notable changes to the "VSCode Encrypt" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Support for additional file types (.txt.enc, .json.enc)
- Keyboard shortcuts customization
- Multiple password support per file
- Export/Import encrypted files

## [1.1.0] - 2026-02-04

[Download VSIX](releases/vscode-encrypt-1.1.0.vsix) | [View Release Notes](https://github.com/SunArthur666/vscode-encrypt-plugin/releases/tag/v1.1.0)

### Added
- **Memory-Only Decrypt Mode**: View decrypted content without writing to disk, preventing accidental Git commits
  - Choose between "Decrypt to File" or "View in Memory Only" when decrypting
  - Memory-only mode opens as read-only buffer that never touches disk
- **Add to .gitignore**: Option to automatically add decrypted files to `.gitignore`
- **Apple-Style Password UI**: Completely redesigned password prompt with:
  - Frosted glass effect (backdrop blur)
  - Gradient lock icon with shadow
  - Clean, minimalist input fields
  - Smooth animations and transitions
  - Loading states and shake animation for errors
  - Dark/light theme support
- **VSIX Releases**: Pre-built VSIX packages available in `releases/` directory for direct download

### Changed
- Improved decrypt workflow with clear options and Git safety warnings
- Enhanced error handling with visual feedback
- Updated installation documentation with VSIX download instructions

### Security
- Memory-only decrypt mode ensures sensitive content can be viewed without any disk writes

## [1.0.0] - 2026-02-04

### Added
- Initial release
- File encryption with `.md.enc` format
- In-place text encryption with `🔐...🔐` markers
- Hidden mode encryption with `%%🔐...🔐%%` markers
- Password caching with configurable timeout
- Password hints support
- Markdown preview support for encrypted files (split view)
- Custom editor for encrypted files with instant-save
- Commands:
  - Create Encrypted File
  - Encrypt Current File
  - Decrypt Current File
  - Change Password
  - Encrypt Selection
  - Decrypt Selection/Cursor
  - Lock and Close All
  - Clear Password Cache
- Configuration options:
  - Confirm password when encrypting
  - Remember password during session
  - Password cache timeout
  - Password cache level (workspace/folder/file)
  - Expand selection to whole lines
  - Show/hide encryption markers
- Obsidian Encrypt v2.0 compatibility (AES-256-GCM with PBKDF2-SHA512, 210,000 iterations)
- Status bar indicator for encrypted files
- Context menu integration

### Security
- AES-256-GCM encryption (military-grade)
- PBKDF2-SHA512 key derivation (210,000 iterations)
- 16-byte random salt per encryption
- 16-byte random IV/nonce per encryption
- 16-byte authentication tag
- Plaintext NEVER written to disk
- Memory cleared on file close

[Unreleased]: https://github.com/SunArthur666/vscode-encrypt-plugin/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/SunArthur666/vscode-encrypt-plugin/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/SunArthur666/vscode-encrypt-plugin/releases/tag/v1.0.0
