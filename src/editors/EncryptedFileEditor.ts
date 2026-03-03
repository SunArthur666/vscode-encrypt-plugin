import * as vscode from 'vscode';
import { encryptionService } from '../services/EncryptionService';
import { passwordService } from '../services/PasswordService';
import { PasswordPrompt } from '../ui/PasswordPrompt';
import type { EncryptedFileSystem } from '../providers/EncryptedFileSystem';
import type { EncryptedFileData } from '../types';

/**
 * Custom Editor for Encrypted Files (.md.enc)
 *
 * Serves only as a password-entry gate. After the user enters the
 * correct password the decrypted content is opened in VSCode's native
 * text editor via an in-memory FileSystemProvider (`encfs://`), and this
 * Custom Editor tab is automatically closed -- leaving the user with a
 * single, fully-featured native editor tab.
 */
export class EncryptedFileEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'encrypt.encryptedFileEditor';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly encryptedFS: EncryptedFileSystem
  ) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: []
    };

    const filePath = document.uri.fsPath;

    const getFileData = (): EncryptedFileData => {
      return JSON.parse(document.getText());
    };

    const fileData = getFileData();
    webviewPanel.webview.html = this.getPasswordPromptHtml(fileData.hint);

    const messageHandler = webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === 'decrypt') {
          await this.handleDecrypt(webviewPanel, document, getFileData(), filePath, message.password);
        }
      },
      null,
      this.context.subscriptions
    );

    webviewPanel.onDidDispose(() => {
      messageHandler.dispose();
    });
  }

  private async handleDecrypt(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument,
    fileData: EncryptedFileData,
    filePath: string,
    passwordFromWebview?: string
  ): Promise<void> {
    let password = passwordFromWebview;
    let hint = fileData.hint ?? '';

    if (!password) {
      const cached = passwordService.get(filePath);
      password = cached.password;
      hint = cached.hint || hint;
    }

    let decryptedContent = encryptionService.decryptFileData(fileData, password);

    if (decryptedContent === null && !passwordFromWebview) {
      const result = await PasswordPrompt.showForDecryption({ hint, defaultPassword: password });
      if (!result) {
        vscode.window.showInformationMessage('Decryption cancelled');
        return;
      }
      password = result.password;
      decryptedContent = encryptionService.decryptFileData(fileData, password);

      if (decryptedContent === null) {
        vscode.window.showErrorMessage('Decryption failed. Wrong password?');
        webviewPanel.webview.html = this.getPasswordPromptHtml(hint, true);
        return;
      }

      const config = vscode.workspace.getConfiguration('encrypt');
      if (config.get<boolean>('rememberPassword', true)) {
        passwordService.put({ password, hint }, filePath);
      }
    }

    if (decryptedContent === null) {
      vscode.window.showErrorMessage('Decryption failed. Wrong password?');
      webviewPanel.webview.html = this.getPasswordPromptHtml(hint, true);
      return;
    }

    // Store in virtual file system and open native editor
    this.encryptedFS.createVirtualFile(filePath, password, hint, decryptedContent);

    const encfsUri = this.encryptedFS.getVirtualUri(filePath);
    const doc = await vscode.workspace.openTextDocument(encfsUri);
    await vscode.languages.setTextDocumentLanguage(doc, 'markdown');
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Active, preview: false });

    // Close the Custom Editor tab so the user only sees the native editor
    setTimeout(() => {
      const encTabs = vscode.window.tabGroups.all
        .flatMap(g => g.tabs)
        .filter(tab => {
          const input = tab.input;
          if (input && typeof input === 'object' && 'viewType' in input && 'uri' in input) {
            return (input as { uri: vscode.Uri }).uri.fsPath === filePath;
          }
          return false;
        });
      for (const tab of encTabs) {
        vscode.window.tabGroups.close(tab);
      }
    }, 150);
  }

  private getPasswordPromptHtml(hint?: string, showError: boolean = false): string {
    const hintHtml = hint ? `
      <div class="hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
        <span>${this.escapeHtml(hint)}</span>
      </div>` : '';

    const errorHtml = showError ? `
      <div class="error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>Incorrect password. Please try again.</span>
      </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unlock</title>
  <style>
    :root {
      --glass-bg: rgba(255, 255, 255, 0.08);
      --glass-border: rgba(255, 255, 255, 0.1);
      --text-primary: rgba(255, 255, 255, 0.95);
      --text-secondary: rgba(255, 255, 255, 0.6);
      --accent: #0A84FF;
      --accent-hover: #409CFF;
      --error: #FF453A;
      --hint-bg: rgba(255, 255, 255, 0.05);
    }
    @media (prefers-color-scheme: light) {
      :root {
        --glass-bg: rgba(255, 255, 255, 0.7);
        --glass-border: rgba(0, 0, 0, 0.1);
        --text-primary: rgba(0, 0, 0, 0.85);
        --text-secondary: rgba(0, 0, 0, 0.5);
        --hint-bg: rgba(0, 0, 0, 0.03);
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
      background: var(--vscode-editor-background);
      min-height: 100vh; display: flex; justify-content: center; align-items: center;
      padding: 24px; -webkit-font-smoothing: antialiased;
    }
    .container { width: 100%; max-width: 360px; text-align: center; }
    .lock-icon {
      width: 80px; height: 80px; margin: 0 auto 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
    }
    .lock-icon svg { width: 40px; height: 40px; stroke: white; stroke-width: 2; fill: none; }
    h1 { font-size: 24px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; letter-spacing: -0.5px; }
    .subtitle { font-size: 14px; color: var(--text-secondary); margin-bottom: 32px; }
    .card {
      background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    }
    .input-wrapper { position: relative; margin-bottom: 16px; }
    input[type="password"] {
      width: 100%; height: 48px; padding: 0 48px 0 16px; font-size: 16px; font-family: inherit;
      color: var(--text-primary); background: var(--hint-bg);
      border: 1px solid transparent; border-radius: 12px; outline: none; transition: all 0.2s ease;
    }
    input[type="password"]::placeholder { color: var(--text-secondary); }
    input[type="password"]:focus {
      border-color: var(--accent); background: var(--glass-bg);
      box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.2);
    }
    .input-icon { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); }
    .btn {
      width: 100%; height: 48px; font-size: 16px; font-weight: 500; font-family: inherit;
      border: none; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(10, 132, 255, 0.4); }
    .btn-primary:active { transform: translateY(0); }
    .hint {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px 16px; margin-bottom: 16px; background: var(--hint-bg); border-radius: 10px;
      font-size: 13px; color: var(--text-secondary);
    }
    .error {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px 16px; margin-bottom: 16px; background: rgba(255, 69, 58, 0.1);
      border-radius: 10px; font-size: 13px; color: var(--error);
    }
    .footer {
      margin-top: 24px; font-size: 12px; color: var(--text-secondary);
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .footer svg { width: 14px; height: 14px; }
    .btn.loading { pointer-events: none; opacity: 0.8; }
    .spinner {
      width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
      border-radius: 50%; animation: spin 0.8s linear infinite; display: none;
    }
    .btn.loading .spinner { display: block; }
    .btn.loading .btn-text { display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
    .shake { animation: shake 0.4s ease; }
  </style>
</head>
<body>
  <div class="container">
    <div class="lock-icon">
      <svg viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <h1>Unlock File</h1>
    <p class="subtitle">Enter password to decrypt this file</p>
    <div class="card" id="card">
      ${errorHtml}
      ${hintHtml}
      <div class="input-wrapper">
        <input type="password" id="password" placeholder="Password" autofocus>
        <div class="input-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
        </div>
      </div>
      <button class="btn btn-primary" id="unlockBtn" onclick="decrypt()">
        <span class="spinner"></span>
        <span class="btn-text">Unlock</span>
      </button>
    </div>
    <div class="footer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      <span>AES-256 encrypted &middot; Your data stays private</span>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const passwordInput = document.getElementById('password');
    const unlockBtn = document.getElementById('unlockBtn');
    const card = document.getElementById('card');
    passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') decrypt(); });
    function decrypt() {
      const password = passwordInput.value;
      if (!password) { card.classList.add('shake'); passwordInput.focus(); setTimeout(() => card.classList.remove('shake'), 400); return; }
      unlockBtn.classList.add('loading');
      vscode.postMessage({ command: 'decrypt', password });
    }
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      "'": '&#039;', '`': '&#96;', '/': '&#47;'
    };
    return text.replace(/[&<>"'`/]/g, m => map[m]);
  }
}
