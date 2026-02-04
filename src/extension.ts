import * as vscode from 'vscode';
import { passwordService } from './services/PasswordService';
import {
  createEncryptedFile,
  encryptCurrentFile,
  decryptCurrentFile,
  changePassword,
  lockAndCloseAll,
  clearPasswordCache,
  isEncryptedFile
} from './commands/fileCommands';
import { encryptSelection, decryptSelection } from './commands/selectionCommands';
import { EncryptedFileEditorProvider } from './editors/EncryptedFileEditor';

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext): void {
  // Initialize password service with configuration
  updatePasswordServiceConfig();

  // Watch for configuration changes
  const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('encrypt')) {
      updatePasswordServiceConfig();
    }
  });

  // Register custom editor for encrypted files
  const editorProvider = vscode.window.registerCustomEditorProvider(
    EncryptedFileEditorProvider.viewType,
    new EncryptedFileEditorProvider(context),
    {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  );

  // Register file commands
  const createCmd = vscode.commands.registerCommand('encrypt.createEncryptedFile', (uri?: vscode.Uri) => {
    createEncryptedFile(uri);
  });
  const encryptFileCmd = vscode.commands.registerCommand('encrypt.encryptFile', encryptCurrentFile);
  const decryptFileCmd = vscode.commands.registerCommand('encrypt.decryptFile', (uri?: vscode.Uri) => {
    decryptCurrentFile(uri);
  });
  const changePwdCmd = vscode.commands.registerCommand('encrypt.changePassword', changePassword);
  const lockAllCmd = vscode.commands.registerCommand('encrypt.lockAndCloseAll', lockAndCloseAll);
  const clearCacheCmd = vscode.commands.registerCommand('encrypt.clearPasswordCache', clearPasswordCache);

  // Register selection commands
  const encryptSelCmd = vscode.commands.registerCommand('encrypt.encryptSelection', encryptSelection);
  const decryptSelCmd = vscode.commands.registerCommand('encrypt.decryptSelection', decryptSelection);

  // Register status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'encrypt.lockAndCloseAll';
  statusBarItem.text = '$(lock) Encrypted';
  updateStatusBar(statusBarItem);

  const activeEditorChange = vscode.window.onDidChangeActiveTextEditor(() => {
    updateStatusBar(statusBarItem);
  });

  // Add all disposables to context
  context.subscriptions.push(
    configWatcher,
    editorProvider,
    createCmd,
    encryptFileCmd,
    decryptFileCmd,
    changePwdCmd,
    lockAllCmd,
    clearCacheCmd,
    encryptSelCmd,
    decryptSelCmd,
    statusBarItem,
    activeEditorChange
  );
}

/**
 * Update password service configuration
 */
function updatePasswordServiceConfig(): void {
  const config = vscode.workspace.getConfiguration('encrypt');
  passwordService.init(
    config.get<boolean>('rememberPassword', true),
    config.get<number>('rememberPasswordTimeout', 30),
    config.get<'workspace' | 'folder' | 'file'>('rememberPasswordLevel', 'workspace')
  );
}

/**
 * Update status bar visibility
 */
function updateStatusBar(statusBarItem: vscode.StatusBarItem): void {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && isEncryptedFile(activeEditor.document.uri.fsPath)) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
  passwordService.dispose();
}
