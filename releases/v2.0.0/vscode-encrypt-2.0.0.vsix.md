## VSCode Encrypt 2.0.0 (2026-03-03)

### Added
- **Native Editor Integration**: Decrypted `.md.enc` files now open in VSCode's native text editor via an in-memory `FileSystemProvider` (`encfs://`), enabling full support for Markdown extensions (e.g., Markdown All in One syntax highlighting, navigation, TOC)
- **Single-Tab Experience**: After password entry, the custom editor tab auto-closes, leaving only the native editor — no more two-tab confusion
- **Auto-Save**: Modified content in the native editor is automatically saved after a 1-second debounce, triggering encryption back to `.md.enc`
- **Save Notification**: Status bar shows encryption confirmation on every save: encrypted and saved to .md.enc — plaintext never written to disk
- **Editor Title Buttons**: "Change Password" and "Lock & Close All" commands accessible directly from the editor title bar for `encfs://` documents
- **`[Memory]` File Label**: Virtual file tabs display as `filename [Memory].md` to clearly indicate content lives only in memory
- **Virtual Directory Support**: `EncryptedFileSystem` now correctly responds to `stat`/`readDirectory` calls for parent directories, preventing errors from other extensions

### Changed
- **Architecture Overhaul**: Replaced `TextDocumentContentProvider` (`enc://`) with a full `FileSystemProvider` (`encfs://`) for read-write native editing
- **Simplified Custom Editor**: `EncryptedFileEditor` now serves only as a password-entry gate (Apple-style UI preserved)
- **Password Change via Command Palette**: Works for both `file://` (.md.enc) and `encfs://` (in-memory) documents
- **Create File Input**: Default filename selection now excludes `.md.enc` suffix for easier renaming

### Removed
- Built-in webview markdown editor (replaced by native editor)
- `EncryptedDocumentProvider` (replaced by `EncryptedFileSystem`)
- `DecryptedContentCache` service (replaced by `EncryptedFileSystem` in-memory storage)

### Security
- Plaintext remains strictly in memory — never written to disk
- Encryption happens transparently on every save via `FileSystemProvider.writeFile`
