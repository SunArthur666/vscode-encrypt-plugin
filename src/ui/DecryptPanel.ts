import * as vscode from 'vscode';

/**
 * Panel for showing decrypted content
 */
export class DecryptPanel {
  private static currentPanel: DecryptPanel | undefined;

  public static get activePanel(): DecryptPanel | undefined {
    return DecryptPanel.currentPanel;
  }

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  // Store options as instance variable so they can be updated
  private _options: {
    title?: string;
    onSave?: (newContent: string) => void;
    onDecryptInPlace?: () => void;
  };

  /**
   * Show or create decrypt panel
   */
  public static show(
    extensionUri: vscode.Uri,
    content: string,
    options: {
      title?: string;
      onSave?: (newContent: string) => void;
      onDecryptInPlace?: () => void;
    } = {}
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (DecryptPanel.currentPanel) {
      // Update existing panel with new content and options
      DecryptPanel.currentPanel._update(content, options);
      DecryptPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'decryptPanel',
      options.title ?? 'Decrypted Content',
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    DecryptPanel.currentPanel = new DecryptPanel(panel, extensionUri, content, options);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    content: string,
    options: {
      title?: string;
      onSave?: (newContent: string) => void;
      onDecryptInPlace?: () => void;
    }
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._options = options; // Store options

    this._updateContent(content);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set up message handler once
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'save':
            this._options.onSave?.(message.content);
            return;
          case 'decryptInPlace':
            this._options.onDecryptInPlace?.();
            return;
          case 'copy':
            vscode.env.clipboard.writeText(message.content);
            vscode.window.showInformationMessage('Copied to clipboard');
            return;
        }
      },
      null,
      this._disposables
    );
  }

  private _update(content: string, options: { title?: string; onSave?: (content: string) => void; onDecryptInPlace?: () => void }): void {
    // Update stored options
    this._options = { ...this._options, ...options };
    this._panel.title = options.title ?? 'Decrypted Content';
    this._updateContent(content);
  }

  private _updateContent(content: string): void {
    const webview = this._panel.webview;
    webview.html = this._getHtml(webview, content, !!this._options.onSave, !!this._options.onDecryptInPlace);
  }

  private _getHtml(webview: vscode.Webview, content: string, showSave: boolean, showDecryptInPlace: boolean): string {
    const escapedContent = this._escapeHtml(content);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Decrypted Content</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      font-weight: var(--vscode-font-weight);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .content {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 15px;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.5;
      min-height: 200px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .content:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    .content[contenteditable="true"] {
      background-color: var(--vscode-input-background);
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      opacity: 0.6;
      cursor: not-allowed;
    }
    .warning {
      color: var(--vscode-errorForeground);
      padding: 10px;
      background-color: var(--vscode-inputValidation-warningBackground);
      border: 1px solid var(--vscode-inputValidation-warningBorder);
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="warning">
      ⚠️ Warning: The decrypted content is displayed in a webview. Any changes made here are temporary unless you save them.
    </div>
    <div class="toolbar">
      <button id="copyBtn">📋 Copy</button>
      ${showDecryptInPlace ? '<button id="decryptInPlaceBtn" class="secondary">🔓 Decrypt In-Place</button>' : ''}
      ${showSave ? '<button id="saveBtn" class="secondary">💾 Save Changes</button>' : ''}
    </div>
    <div class="content" ${showSave ? 'contenteditable="true"' : ''} id="content">${escapedContent}</div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const content = document.getElementById('content');

    document.getElementById('copyBtn').addEventListener('click', () => {
      vscode.postMessage({
        command: 'copy',
        content: content.innerText
      });
    });

    ${showDecryptInPlace ? `
    document.getElementById('decryptInPlaceBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'decryptInPlace' });
    });
    ` : ''}

    ${showSave ? `
    document.getElementById('saveBtn').addEventListener('click', () => {
      vscode.postMessage({
        command: 'save',
        content: content.innerText
      });
    });
    ` : ''}
  </script>
</body>
</html>`;
  }

  private _escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  public dispose(): void {
    DecryptPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
