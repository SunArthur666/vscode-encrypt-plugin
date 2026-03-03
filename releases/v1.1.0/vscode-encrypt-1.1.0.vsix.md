## VSCode Encrypt 1.1.0 (2026-02-04)

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
