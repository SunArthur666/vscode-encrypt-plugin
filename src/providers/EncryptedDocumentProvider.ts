import * as vscode from 'vscode';
import { encryptionService } from '../services/EncryptionService';
import { passwordService } from '../services/PasswordService';
import type { EncryptedFileData } from '../types';

/**
 * Document Provider for Encrypted Files
 * Provides decrypted content as virtual markdown/text files
 * This allows using VSCode's built-in editor with all Markdown plugins
 */
export class EncryptedDocumentProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = 'enc';

  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  // Map to track which URIs have been opened and need password
  private pendingUris = new Set<string>();

  /**
   * Provide text document content (decrypted file content)
   */
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {

    // Extract real file path from URI
    // Format: enc:///path/to/file.md.enc.md
    const query = new URLSearchParams(uri.query);
    const realPath = query.get('path');

    if (!realPath) {
      return `# Error\n\nInvalid encrypted file URI.\n\nURI: ${uri.toString()}`;
    }

    try {
      // Read the encrypted file
      const fileUri = vscode.Uri.file(realPath);
      const fileData = await vscode.workspace.fs.readFile(fileUri);
      const encryptedData = JSON.parse(Buffer.from(fileData).toString('utf8')) as EncryptedFileData;

      // Try to get cached password
      const cached = passwordService.get(realPath);
      if (cached.password) {
        const decryptedContent = encryptionService.decryptFileData(encryptedData, cached.password);
        if (decryptedContent !== null) {
          this.pendingUris.delete(uri.toString());
          return decryptedContent;
        }
      }

      // No cached password or decryption failed - show password prompt
      this.pendingUris.add(uri.toString());
      return this.getPasswordPromptHtml(realPath, uri.toString(), encryptedData.hint);
    } catch (error) {
      return `# Error\n\nFailed to read encrypted file: ${error}\n\nFile: ${realPath}`;
    }
  }

  /**
   * Get password prompt HTML for webview
   */
  private getPasswordPromptHtml(realPath: string, uri: string, hint?: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enter Password</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 500px;
      width: 100%;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: var(--vscode-foreground);
    }
    .hint {
      color: var(--vscode-textLink-foreground);
      margin-bottom: 1rem;
      font-style: italic;
    }
    input[type="password"] {
      width: 100%;
      padding: 10px;
      margin-bottom: 1rem;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 14px;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    button {
      padding: 10px 20px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      width: 100%;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .error {
      color: var(--vscode-errorForeground);
      margin-top: 1rem;
      display: none;
    }
    .file-info {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9rem;
      margin-bottom: 1rem;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Enter Password to Decrypt</h1>
    ${hint ? `<div class="hint">💡 Hint: ${this.escapeHtml(hint)}</div>` : ''}
    <div class="file-info">📄 ${this.escapeHtml(realPath)}</div>
    <input type="password" id="password" placeholder="Enter password..." autofocus />
    <button onclick="submitPassword()">Decrypt</button>
    <div id="error" class="error">❌ Wrong password, please try again</div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const passwordInput = document.getElementById('password');
    const errorDiv = document.getElementById('error');

    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitPassword();
      }
    });

    passwordInput.focus();

    function submitPassword() {
      const password = passwordInput.value;
      if (!password) {
        return;
      }

      vscode.postMessage({
        command: 'decrypt',
        password: password,
        realPath: '${this.escapeJs(realPath)}',
        uri: '${this.escapeJs(uri)}'
      });
    }

    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'decryptionFailed') {
        errorDiv.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Handle password submission from webview
   */
  async handlePasswordMessage(
    webviewPanel: vscode.WebviewPanel,
    message: { command: string; password: string; realPath: string; uri: string }
  ): Promise<boolean> {
    if (message.command !== 'decrypt') {
      return false;
    }

    const { password, realPath, uri } = message;

    try {
      // Read encrypted file
      const fileUri = vscode.Uri.file(realPath);
      const fileData = await vscode.workspace.fs.readFile(fileUri);
      const encryptedData = JSON.parse(Buffer.from(fileData).toString('utf8')) as EncryptedFileData;

      // Try to decrypt
      const decryptedContent = encryptionService.decryptFileData(encryptedData, password);
      if (decryptedContent === null) {
        // Wrong password - notify webview
        webviewPanel.webview.postMessage({ type: 'decryptionFailed' });
        return false;
      }

      // Decryption successful - cache password and refresh document
      passwordService.put({ password, hint: encryptedData.hint ?? '' }, realPath);

      // Trigger document refresh
      this._onDidChange.fire(vscode.Uri.parse(uri));
      this.pendingUris.delete(uri);

      // Close the webview panel
      webviewPanel.dispose();

      return true;
    } catch {
      webviewPanel.webview.postMessage({ type: 'decryptionFailed' });
      return false;
    }
  }

  /**
   * Check if a URI is currently pending password input
   */
  isPending(uri: string): boolean {
    return this.pendingUris.has(uri);
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Escape JavaScript strings
   */
  private escapeJs(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }
}
