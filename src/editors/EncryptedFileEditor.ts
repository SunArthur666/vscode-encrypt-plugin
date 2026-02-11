import * as vscode from 'vscode';
import { encryptionService } from '../services/EncryptionService';
import { passwordService } from '../services/PasswordService';
import { PasswordPrompt } from '../ui/PasswordPrompt';
import type { EncryptedFileData } from '../types';

/**
 * Custom Editor for Encrypted Files (.md.enc)
 * Features:
 * - Auto-save on every keystroke (content is encrypted and saved immediately)
 * - Auto-decrypt with cached password (no need to re-enter password after save)
 * - Markdown syntax highlighting for .md.enc files
 * - Plaintext NEVER written to disk - only encrypted content
 */
export class EncryptedFileEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'encrypt.encryptedFileEditor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Resolve the custom editor
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: []
    };

    const filePath = document.uri.fsPath;

    // Function to get current file data
    const getFileData = (): EncryptedFileData => {
      return JSON.parse(document.getText());
    };

    // Always require password to open encrypted file (security requirement)
    const fileData = getFileData();

    // Always show password prompt - never auto-decrypt for security
    webviewPanel.webview.html = this.getPasswordPromptHtml(fileData.hint);

    // Handle messages from webview
    const messageHandler = webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        // Always use current file data
        const fileData = getFileData();

        switch (message.command) {
          case 'decrypt':
            await this.handleDecrypt(webviewPanel, document, fileData, filePath, message.password);
            break;
          case 'save':
            await this.handleSave(document, filePath, message.content, message.password);
            break;
          case 'autoSave':
            await this.handleAutoSave(document, filePath, message.content, message.password);
            break;
          case 'changePassword':
            await this.handleChangePassword(webviewPanel, document, fileData, filePath);
            break;
        }
      },
      null,
      this.context.subscriptions
    );

    // Clean up handlers on dispose
    webviewPanel.onDidDispose(() => {
      messageHandler.dispose();
    });
  }

  /**
   * Handle decrypt request
   */
  private async handleDecrypt(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument,
    fileData: EncryptedFileData,
    filePath: string,
    passwordFromCache?: string
  ): Promise<void> {
    let password = passwordFromCache;
    let hint = fileData.hint ?? '';
    const isMarkdown = filePath.endsWith('.md.enc');

    // If no password from cache, prompt for it
    if (!password) {
      const cached = passwordService.get(filePath);
      password = cached.password;
      hint = cached.hint || hint;
    }

    // Try to decrypt
    let decryptedContent = encryptionService.decryptFileData(fileData, password);

    // If failed and no cached password, prompt user
    if (decryptedContent === null && !passwordFromCache) {
      const result = await PasswordPrompt.showForDecryption({
        hint,
        defaultPassword: password
      });

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

      // Cache the password
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

    // Show decrypted content with editor
    webviewPanel.webview.html = this.getEditorHtml(decryptedContent, password, hint, isMarkdown);
  }

  /**
   * Handle manual save request
   */
  private async handleSave(
    document: vscode.TextDocument,
    filePath: string,
    content: string,
    password: string
  ): Promise<void> {
    try {
      await this.encryptAndSave(document, filePath, content, password);
      vscode.window.showInformationMessage('File encrypted and saved');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save: ${error}`);
    }
  }

  /**
   * Handle auto-save request (immediate save)
   */
  private async handleAutoSave(
    document: vscode.TextDocument,
    filePath: string,
    content: string,
    password: string
  ): Promise<void> {
    try {
      await this.encryptAndSave(document, filePath, content, password);
      // Notification will be shown by the webview
    } catch (error) {
      vscode.window.showErrorMessage(`Instant-save failed: ${error}`);
    }
  }

  /**
   * Encrypt and save content to file
   * IMPORTANT: Plaintext is NEVER written to disk, only encrypted content
   */
  private async encryptAndSave(
    document: vscode.TextDocument,
    filePath: string,
    content: string,
    password: string
  ): Promise<void> {
    // Get current file data to preserve hint
    const fileData = JSON.parse(document.getText()) as EncryptedFileData;

    // Re-encrypt with new content
    const newFileData = encryptionService.encryptFileContent(content, password, fileData.hint);

    // Write ENCRYPTED content to file
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(document.uri, encoder.encode(JSON.stringify(newFileData, null, 2)));
  }

  /**
   * Handle change password request
   */
  private async handleChangePassword(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument,
    fileData: EncryptedFileData,
    filePath: string
  ): Promise<void> {
    const isMarkdown = filePath.endsWith('.md.enc');

    const passwordResult = await PasswordPrompt.showForChangePassword({
      currentHint: fileData.hint
    });

    if (!passwordResult) {
      return;
    }

    // Verify current password
    const decryptedContent = encryptionService.decryptFileData(fileData, passwordResult.current.password);
    if (decryptedContent === null) {
      vscode.window.showErrorMessage('Current password is incorrect');
      return;
    }

    // Update password cache
    const config = vscode.workspace.getConfiguration('encrypt');
    if (config.get<boolean>('rememberPassword', true)) {
      passwordService.put(passwordResult.new, filePath);
    }

    // Show content with new password
    webviewPanel.webview.html = this.getEditorHtml(
      decryptedContent,
      passwordResult.new.password,
      passwordResult.new.hint,
      isMarkdown
    );

    vscode.window.showInformationMessage('Password changed. File will be saved with new password.');
  }

  /**
   * Get HTML for password prompt - Apple-style minimalist design
   */
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
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
      background: var(--vscode-editor-background);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    
    .container {
      width: 100%;
      max-width: 360px;
      text-align: center;
    }
    
    .lock-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
    }
    
    .lock-icon svg {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 2;
      fill: none;
    }
    
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    
    .subtitle {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 32px;
    }
    
    .card {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    }
    
    .input-wrapper {
      position: relative;
      margin-bottom: 16px;
    }
    
    input[type="password"] {
      width: 100%;
      height: 48px;
      padding: 0 48px 0 16px;
      font-size: 16px;
      font-family: inherit;
      color: var(--text-primary);
      background: var(--hint-bg);
      border: 1px solid transparent;
      border-radius: 12px;
      outline: none;
      transition: all 0.2s ease;
    }
    
    input[type="password"]::placeholder {
      color: var(--text-secondary);
    }
    
    input[type="password"]:focus {
      border-color: var(--accent);
      background: var(--glass-bg);
      box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.2);
    }
    
    .input-icon {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-secondary);
    }
    
    .btn {
      width: 100%;
      height: 48px;
      font-size: 16px;
      font-weight: 500;
      font-family: inherit;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .btn-primary {
      background: var(--accent);
      color: white;
    }
    
    .btn-primary:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(10, 132, 255, 0.4);
    }
    
    .btn-primary:active {
      transform: translateY(0);
    }
    
    .hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: var(--hint-bg);
      border-radius: 10px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    .error {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: rgba(255, 69, 58, 0.1);
      border-radius: 10px;
      font-size: 13px;
      color: var(--error);
    }
    
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    
    .footer svg {
      width: 14px;
      height: 14px;
    }
    
    /* Loading state */
    .btn.loading {
      pointer-events: none;
      opacity: 0.8;
    }
    
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: none;
    }
    
    .btn.loading .spinner {
      display: block;
    }
    
    .btn.loading .btn-text {
      display: none;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Shake animation for error */
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-8px); }
      40%, 80% { transform: translateX(8px); }
    }
    
    .shake {
      animation: shake 0.4s ease;
    }
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
      <span>AES-256 encrypted · Your data stays private</span>
    </div>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    const passwordInput = document.getElementById('password');
    const unlockBtn = document.getElementById('unlockBtn');
    const card = document.getElementById('card');

    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        decrypt();
      }
    });

    function decrypt() {
      const password = passwordInput.value;
      if (!password) {
        card.classList.add('shake');
        passwordInput.focus();
        setTimeout(() => card.classList.remove('shake'), 400);
        return;
      }

      // Show loading state
      unlockBtn.classList.add('loading');

      // Send decrypt message to extension
      vscode.postMessage({
        command: 'decrypt',
        password: password
      });
    }

    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }
  </script>
</body>
</html>`;
  }

  /**
   * Get HTML for the editor with Markdown support and auto-save
   */
  private getEditorHtml(content: string, password: string, hint: string, isMarkdown: boolean): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Encrypted File Editor</title>
  ${isMarkdown ? `
  <!-- Marked.js for Markdown parsing -->
  <script src="https://cdn.jsdelivr.net/npm/marked@11.0.0/marked.min.js"></script>
  <!-- Highlight.js for code highlighting in preview -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/monokai-sublime.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  ` : ''}
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 15px;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .status {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }
    .status-icon {
      font-size: 16px;
    }
    .auto-save-indicator {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 3px;
      background: var(--vscode-charts-green);
      color: white;
    }
    .view-toggle {
      display: ${isMarkdown ? 'flex' : 'none'};
      gap: 5px;
      background: var(--vscode-editor-selectionBackground);
      border-radius: 4px;
      padding: 2px;
    }
    .view-toggle button {
      padding: 4px 12px;
      font-size: 12px;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
    }
    .view-toggle button.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button {
      padding: 6px 14px;
      font-size: 13px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .editor-container {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }
    .editor-pane, .preview-pane {
      flex: 1;
      overflow: auto;
      padding: 20px;
    }
    .editor-pane {
      border-right: 1px solid var(--vscode-panel-border);
    }
    .preview-pane {
      display: ${isMarkdown ? 'block' : 'none'};
    }
    #editor {
      width: 100%;
      height: 100%;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      border: none;
      resize: none;
      padding: 20px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: var(--vscode-editor-font-size);
      line-height: 1.6;
      outline: none;
    }
    /* Markdown Preview Styles */
    .markdown-body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: var(--vscode-foreground);
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    .markdown-body h1 { font-size: 2em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
    .markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
    .markdown-body h3 { font-size: 1.25em; }
    .markdown-body p { margin-bottom: 16px; }
    .markdown-body code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
    }
    .markdown-body pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 16px;
      border-radius: 6px;
      overflow: auto;
      margin-bottom: 16px;
    }
    .markdown-body pre code {
      background: transparent;
      padding: 0;
    }
    .markdown-body blockquote {
      border-left: 4px solid var(--vscode-textLink-foreground);
      padding-left: 16px;
      margin-left: 0;
      color: var(--vscode-descriptionForeground);
    }
    .markdown-body ul, .markdown-body ol {
      padding-left: 2em;
      margin-bottom: 16px;
    }
    .markdown-body li { margin-bottom: 4px; }
    /* Task list styling - remove extra bullet and fix spacing */
    .markdown-body li:has(input[type="checkbox"]) {
      list-style-type: none;
      padding-left: 0;
    }
    .markdown-body li input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin-right: 8px;
      cursor: pointer;
      vertical-align: middle;
    }
    .markdown-body a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    .markdown-body a:hover { text-decoration: underline; }
    .markdown-body table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    .markdown-body table th, .markdown-body table td {
      border: 1px solid var(--vscode-panel-border);
      padding: 8px 12px;
    }
    .markdown-body table th {
      background: var(--vscode-editor-selectionBackground);
      font-weight: 600;
    }
    .markdown-body img {
      max-width: 100%;
      height: auto;
    }
    .info {
      padding: 4px 15px;
      background: var(--vscode-notificationsInfoIcon-foreground);
      color: white;
      font-size: 12px;
      text-align: center;
      transition: opacity 0.3s;
    }
    .warning {
      padding: 6px 15px;
      background: var(--vscode-editorWarning-foreground);
      color: white;
      font-size: 11px;
    }
    /* Search bar styles */
    .search-bar {
      display: none;
      align-items: center;
      gap: 6px;
      padding: 6px 15px;
      background: var(--vscode-editorWidget-background, var(--vscode-editorGroupHeader-tabsBackground));
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .search-input-container {
      display: flex;
      align-items: center;
      flex: 0 1 300px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 3px;
      overflow: hidden;
    }
    .search-input-container:focus-within {
      border-color: var(--vscode-focusBorder);
    }
    #searchInput {
      flex: 1;
      padding: 4px 8px;
      font-size: 13px;
      background: transparent;
      color: var(--vscode-input-foreground);
      border: none;
      outline: none;
      font-family: var(--vscode-font-family);
    }
    .search-count {
      padding: 0 8px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    .search-btn {
      padding: 4px 8px !important;
      font-size: 14px !important;
      background: transparent !important;
      color: var(--vscode-foreground) !important;
      border: none !important;
      cursor: pointer;
      border-radius: 3px !important;
      min-width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .search-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31)) !important;
    }
    mark.search-highlight {
      background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
      color: inherit;
      border-radius: 2px;
      padding: 1px 0;
    }
    mark.search-highlight.current {
      background: var(--vscode-editor-findMatchBackground, rgba(255, 150, 50, 0.6));
      outline: 1px solid var(--vscode-editor-findMatchBorder, rgba(255, 150, 50, 0.8));
    }
    /* Editor backdrop for search highlighting in textarea */
    .editor-pane {
      position: relative;
    }
    .editor-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 20px;
      overflow: hidden;
      pointer-events: none;
    }
    .editor-backdrop pre {
      margin: 0;
      padding: 20px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: var(--vscode-editor-font-size);
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: transparent;
    }
    #editor.searching {
      background: transparent;
      position: relative;
      z-index: 1;
      caret-color: var(--vscode-foreground);
    }
    .editor-backdrop mark.search-highlight {
      color: transparent;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="status">
      <span class="status-icon">🔓</span>
      <span>Decrypted</span>
      <span class="auto-save-indicator">Instant-save ON</span>
      ${hint ? `<span style="margin-left: 10px; color: var(--vscode-descriptionForeground);">(Hint: ${this.escapeHtml(hint)})</span>` : ''}
    </div>
    ${isMarkdown ? `
    <div class="view-toggle">
      <button id="btnEditOnly" onclick="setView('edit')">Edit</button>
      <button id="btnSplit" class="active" onclick="setView('split')">Split</button>
      <button id="btnPreviewOnly" onclick="setView('preview')">Preview</button>
    </div>
    ` : ''}
  </div>
  <div class="search-bar" id="searchBar">
    <div class="search-input-container">
      <input type="text" id="searchInput" placeholder="Search..." autocomplete="off" />
      <span class="search-count" id="searchCount"></span>
    </div>
    <button class="search-btn" onclick="findPrevious()" title="Previous Match (Shift+Enter)">&#9650;</button>
    <button class="search-btn" onclick="findNext()" title="Next Match (Enter)">&#9660;</button>
    <button class="search-btn" onclick="closeSearch()" title="Close (Escape)">&#10005;</button>
  </div>
  <div class="editor-container">
    <div class="editor-pane" id="editorPane">
      <div class="editor-backdrop" id="editorBackdrop"><pre id="backdropContent"></pre></div>
      <textarea id="editor" spellcheck="false">${this.escapeHtml(content)}</textarea>
    </div>
    <div class="preview-pane" id="previewPane">
      <div class="markdown-body" id="preview"></div>
    </div>
  </div>
  <div class="warning">
    🔒 Security: Content is instant-saved with encryption. Plaintext is NEVER written to disk.
  </div>
  <div class="info" id="info" style="opacity: 0;"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const editorPane = document.getElementById('editorPane');
    const previewPane = document.getElementById('previewPane');
    const info = document.getElementById('info');
    const password = '${this.escapeHtml(password)}';
    const hint = '${this.escapeHtml(hint)}';
    const isMarkdown = ${isMarkdown};
    let hasUnsavedChanges = false;

    // Initialize Markdown with highlight.js
    if (isMarkdown && typeof marked !== 'undefined') {
      marked.setOptions({
        highlight: function(code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (e) {}
          }
          return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
      });
      // Initial preview
      updatePreview();
    }

    // Update preview
    function updatePreview() {
      if (!isMarkdown) return;
      const content = editor.value;
      preview.innerHTML = marked.parse(content);
    }

    // View toggle functions
    function setView(view) {
      const btnEdit = document.getElementById('btnEditOnly');
      const btnSplit = document.getElementById('btnSplit');
      const btnPreview = document.getElementById('btnPreviewOnly');

      // Reset all buttons
      [btnEdit, btnSplit, btnPreview].forEach(b => b?.classList.remove('active'));

      switch(view) {
        case 'edit':
          editorPane.style.display = 'block';
          previewPane.style.display = 'none';
          btnEdit?.classList.add('active');
          break;
        case 'preview':
          editorPane.style.display = 'none';
          previewPane.style.display = 'block';
          btnPreview?.classList.add('active');
          break;
        case 'split':
        default:
          editorPane.style.display = 'block';
          previewPane.style.display = 'block';
          btnSplit?.classList.add('active');
          break;
      }
    }

    // Support tab key in textarea
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        triggerAutoSave();
      }
      // Ctrl/Cmd + S to force save now
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNow();
      }
    });

    // Auto-save on input and update preview
    editor.addEventListener('input', () => {
      hasUnsavedChanges = true;
      updatePreview();
      triggerAutoSave();
    });

    // Sync scroll between editor and preview in split view
    editor.addEventListener('scroll', () => {
      if (previewPane.style.display !== 'none' && editorPane.style.display !== 'none') {
        const scrollRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        previewPane.scrollTop = scrollRatio * (previewPane.scrollHeight - previewPane.clientHeight);
      }
    });

    function triggerAutoSave() {
      // Save immediately without delay
      autoSave();
    }

    function autoSave() {
      const content = editor.value;
      vscode.postMessage({
        command: 'autoSave',
        content: content,
        password: password
      });
      showInfo('✓ Instant-saved and encrypted');
      hasUnsavedChanges = false;
    }

    function saveNow() {
      const content = editor.value;
      vscode.postMessage({
        command: 'save',
        content: content,
        password: password
      });
      showInfo('✓ Saved and encrypted');
      hasUnsavedChanges = false;
    }

    function showInfo(message) {
      info.textContent = message;
      info.style.opacity = '1';
      setTimeout(() => {
        info.style.opacity = '0';
      }, 2000);
    }

    function changePassword() {
      // Save before changing password
      if (hasUnsavedChanges) {
        saveNow();
      }
      vscode.postMessage({
        command: 'changePassword'
      });
    }

    // ====== Search functionality ======
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchInput');
    const searchCount = document.getElementById('searchCount');
    const editorBackdrop = document.getElementById('editorBackdrop');
    const backdropContent = document.getElementById('backdropContent');
    let searchMatches = [];
    let currentMatchIndex = -1;
    let isSearchOpen = false;

    // Open search with Cmd/Ctrl + F
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape' && isSearchOpen) {
        e.preventDefault();
        closeSearch();
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    });

    searchInput.addEventListener('input', () => {
      performSearch();
    });

    function openSearch() {
      searchBar.style.display = 'flex';
      isSearchOpen = true;
      searchInput.focus();
      searchInput.select();
      if (searchInput.value) {
        performSearch();
      }
    }

    function closeSearch() {
      searchBar.style.display = 'none';
      isSearchOpen = false;
      searchMatches = [];
      currentMatchIndex = -1;
      searchCount.textContent = '';
      // Remove backdrop highlights
      editor.classList.remove('searching');
      backdropContent.innerHTML = '';
      // Clear highlights in preview
      if (isMarkdown) {
        updatePreview();
      }
      editor.focus();
    }

    function escapeHtmlForBackdrop(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function performSearch() {
      const query = searchInput.value;
      if (!query) {
        searchMatches = [];
        currentMatchIndex = -1;
        searchCount.textContent = '';
        editor.classList.remove('searching');
        backdropContent.innerHTML = '';
        if (isMarkdown) {
          updatePreview();
        }
        return;
      }

      // Find all matches in editor content
      const content = editor.value;
      searchMatches = [];
      const lowerContent = content.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let idx = 0;
      while ((idx = lowerContent.indexOf(lowerQuery, idx)) !== -1) {
        searchMatches.push({ start: idx, end: idx + query.length });
        idx += 1;
      }

      if (searchMatches.length > 0) {
        // Find the match closest to cursor position
        const cursorPos = editor.selectionStart;
        currentMatchIndex = 0;
        for (let i = 0; i < searchMatches.length; i++) {
          if (searchMatches[i].start >= cursorPos) {
            currentMatchIndex = i;
            break;
          }
        }
        searchCount.textContent = (currentMatchIndex + 1) + ' of ' + searchMatches.length;
      } else {
        currentMatchIndex = -1;
        searchCount.textContent = 'No results';
      }

      // Update backdrop highlighting
      updateBackdropHighlight();

      // Select current match in textarea
      if (currentMatchIndex >= 0) {
        selectCurrentMatch();
      }

      // Highlight matches in preview
      if (isMarkdown) {
        highlightPreviewMatches(query);
      }
    }

    function updateBackdropHighlight() {
      const query = searchInput.value;
      if (!query || searchMatches.length === 0) {
        editor.classList.remove('searching');
        backdropContent.innerHTML = '';
        return;
      }

      editor.classList.add('searching');
      const content = editor.value;
      let html = '';
      let lastIdx = 0;

      for (let i = 0; i < searchMatches.length; i++) {
        const match = searchMatches[i];
        // Add text before this match
        html += escapeHtmlForBackdrop(content.substring(lastIdx, match.start));
        // Add highlighted match
        const cls = i === currentMatchIndex ? 'search-highlight current' : 'search-highlight';
        html += '<mark class="' + cls + '">' + escapeHtmlForBackdrop(content.substring(match.start, match.end)) + '</mark>';
        lastIdx = match.end;
      }
      // Add remaining text
      html += escapeHtmlForBackdrop(content.substring(lastIdx));
      // Add a trailing newline to match textarea behavior
      html += '\\n';
      backdropContent.innerHTML = html;

      // Sync backdrop scroll with editor
      syncBackdropScroll();
    }

    function syncBackdropScroll() {
      editorBackdrop.scrollTop = editor.scrollTop;
      editorBackdrop.scrollLeft = editor.scrollLeft;
    }

    // Keep backdrop scroll in sync
    editor.addEventListener('scroll', function syncSearch() {
      if (isSearchOpen && searchMatches.length > 0) {
        syncBackdropScroll();
      }
    });

    function selectCurrentMatch() {
      if (currentMatchIndex < 0 || currentMatchIndex >= searchMatches.length) return;
      const match = searchMatches[currentMatchIndex];
      editor.setSelectionRange(match.start, match.end);
      // Scroll textarea to show the match
      scrollEditorToMatch(match);
      searchCount.textContent = (currentMatchIndex + 1) + ' of ' + searchMatches.length;
      // Update backdrop to reflect current match
      updateBackdropHighlight();
      // Keep focus on search input
      searchInput.focus();
    }

    function scrollEditorToMatch(match) {
      const textBefore = editor.value.substring(0, match.start);
      const lines = textBefore.split('\\n');
      const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 24;
      const targetLine = lines.length - 1;
      const targetScroll = targetLine * lineHeight - editor.clientHeight / 3;
      editor.scrollTop = Math.max(0, targetScroll);
    }

    function findNext() {
      if (searchMatches.length === 0) {
        if (searchInput.value) performSearch();
        return;
      }
      currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
      selectCurrentMatch();
      if (isMarkdown) {
        highlightPreviewMatches(searchInput.value);
      }
    }

    function findPrevious() {
      if (searchMatches.length === 0) {
        if (searchInput.value) performSearch();
        return;
      }
      currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
      selectCurrentMatch();
      if (isMarkdown) {
        highlightPreviewMatches(searchInput.value);
      }
    }

    function highlightPreviewMatches(query) {
      if (!isMarkdown || !preview) return;
      // Re-render preview then highlight
      updatePreview();
      if (!query) return;

      const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      const lowerQuery = query.toLowerCase();
      let globalMatchIdx = 0;

      textNodes.forEach(node => {
        const text = node.textContent;
        const lowerText = text.toLowerCase();
        const parts = [];
        let lastIdx = 0;
        let searchIdx = 0;

        while ((searchIdx = lowerText.indexOf(lowerQuery, lastIdx)) !== -1) {
          if (searchIdx > lastIdx) {
            parts.push(document.createTextNode(text.substring(lastIdx, searchIdx)));
          }
          const mark = document.createElement('mark');
          mark.className = 'search-highlight';
          if (globalMatchIdx === currentMatchIndex) {
            mark.classList.add('current');
          }
          mark.textContent = text.substring(searchIdx, searchIdx + query.length);
          parts.push(mark);
          lastIdx = searchIdx + query.length;
          globalMatchIdx++;
        }

        if (parts.length > 0) {
          if (lastIdx < text.length) {
            parts.push(document.createTextNode(text.substring(lastIdx)));
          }
          const parent = node.parentNode;
          parts.forEach(part => parent.insertBefore(part, node));
          parent.removeChild(node);
        }
      });
    }

    // Update search when content changes
    editor.addEventListener('input', () => {
      if (isSearchOpen && searchInput.value) {
        performSearch();
      }
    });

    // Warn before closing with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  </script>
</body>
</html>`;
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
      "'": '&#039;',
      '`': '&#96;',
      '/': '&#47;'
    };
    return text.replace(/[&<>"'`/]/g, m => map[m]);
  }
}
