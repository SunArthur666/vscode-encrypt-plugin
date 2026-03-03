import * as vscode from 'vscode';
import { encryptionService } from './services/EncryptionService';
import { passwordService } from './services/PasswordService';
import { PasswordPrompt } from './ui/PasswordPrompt';
import {
  createEncryptedFile,
  encryptCurrentFile,
  decryptCurrentFile,
  changePassword as changePasswordForFile,
  lockAndCloseAll,
  clearPasswordCache,
  isEncryptedFile
} from './commands/fileCommands';
import { encryptSelection, decryptSelection } from './commands/selectionCommands';
import { EncryptedFileEditorProvider } from './editors/EncryptedFileEditor';
import { EncryptedFileSystem } from './providers/EncryptedFileSystem';
import type { EncryptedFileData } from './types';

export function activate(context: vscode.ExtensionContext): void {
  updatePasswordServiceConfig();

  const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('encrypt')) {
      updatePasswordServiceConfig();
    }
  });

  // In-memory virtual file system for decrypted content
  const encryptedFS = new EncryptedFileSystem();
  const fsRegistration = vscode.workspace.registerFileSystemProvider(
    EncryptedFileSystem.scheme,
    encryptedFS,
    { isCaseSensitive: true, isReadonly: false }
  );

  // Custom editor (password prompt only, auto-closes after unlock)
  const editorProvider = vscode.window.registerCustomEditorProvider(
    EncryptedFileEditorProvider.viewType,
    new EncryptedFileEditorProvider(context, encryptedFS),
    { webviewOptions: { retainContextWhenHidden: true } }
  );

  // Clean up virtual files when the native editor tab is closed
  const docCloseWatcher = vscode.workspace.onDidCloseTextDocument(doc => {
    if (doc.uri.scheme === EncryptedFileSystem.scheme) {
      encryptedFS.delete(doc.uri);
    }
  });

  // ── Auto-save for encfs:// documents (debounced) ───────────
  const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const docChangeWatcher = vscode.workspace.onDidChangeTextDocument(e => {
    if (e.document.uri.scheme !== EncryptedFileSystem.scheme) { return; }
    if (e.contentChanges.length === 0) { return; }

    const key = e.document.uri.toString();
    const existing = autoSaveTimers.get(key);
    if (existing) { clearTimeout(existing); }

    const docRef = e.document;
    autoSaveTimers.set(key, setTimeout(() => {
      autoSaveTimers.delete(key);
      docRef.save();
    }, 1000));
  });

  // ── File commands ──────────────────────────────────────────
  const createCmd = vscode.commands.registerCommand(
    'encrypt.createEncryptedFile', (uri?: vscode.Uri) => createEncryptedFile(uri)
  );
  const encryptFileCmd = vscode.commands.registerCommand('encrypt.encryptFile', encryptCurrentFile);
  const decryptFileCmd = vscode.commands.registerCommand(
    'encrypt.decryptFile', (uri?: vscode.Uri) => decryptCurrentFile(uri)
  );

  // changePassword: supports both file:// (.md.enc) and encfs:// native editor
  const changePwdCmd = vscode.commands.registerCommand('encrypt.changePassword', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active file');
      return;
    }

    if (editor.document.uri.scheme === EncryptedFileSystem.scheme) {
      await changePasswordForEncfs(encryptedFS, editor.document.uri);
    } else {
      await changePasswordForFile();
    }
  });

  const lockAllCmd = vscode.commands.registerCommand('encrypt.lockAndCloseAll', async () => {
    const encfsTabs = vscode.window.tabGroups.all
      .flatMap(g => g.tabs)
      .filter(tab => {
        const input = tab.input;
        if (input && typeof input === 'object' && 'uri' in input) {
          return (input as { uri: vscode.Uri }).uri.scheme === EncryptedFileSystem.scheme;
        }
        return false;
      });
    for (const tab of encfsTabs) {
      await vscode.window.tabGroups.close(tab);
    }
    encryptedFS.clearAll();
    await lockAndCloseAll();
  });

  const clearCacheCmd = vscode.commands.registerCommand('encrypt.clearPasswordCache', async () => {
    await clearPasswordCache();
    encryptedFS.clearAll();
  });

  // ── Selection commands ─────────────────────────────────────
  const encryptSelCmd = vscode.commands.registerCommand('encrypt.encryptSelection', encryptSelection);
  const decryptSelCmd = vscode.commands.registerCommand('encrypt.decryptSelection', decryptSelection);

  // ── Status bar ─────────────────────────────────────────────
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'encrypt.lockAndCloseAll';
  statusBarItem.text = '$(lock) Encrypted';
  updateStatusBar(statusBarItem);

  const activeEditorChange = vscode.window.onDidChangeActiveTextEditor(() => {
    updateStatusBar(statusBarItem);
  });

  // ── Dispose everything ─────────────────────────────────────
  context.subscriptions.push(
    configWatcher,
    fsRegistration,
    encryptedFS,
    editorProvider,
    docCloseWatcher,
    docChangeWatcher,
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
 * Change password when the active editor is an encfs:// virtual file.
 */
async function changePasswordForEncfs(
  encryptedFS: EncryptedFileSystem,
  encfsUri: vscode.Uri
): Promise<void> {
  const meta = encryptedFS.getMeta(encfsUri);
  if (!meta) {
    vscode.window.showWarningMessage('Cannot find file metadata.');
    return;
  }

  const realUri = vscode.Uri.file(meta.realPath);
  let fileData: EncryptedFileData;
  try {
    const bytes = await vscode.workspace.fs.readFile(realUri);
    fileData = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    vscode.window.showErrorMessage('Failed to read the encrypted file.');
    return;
  }

  const passwordResult = await PasswordPrompt.showForChangePassword({
    currentHint: fileData.hint
  });
  if (!passwordResult) { return; }

  const decryptedContent = encryptionService.decryptFileData(fileData, passwordResult.current.password);
  if (decryptedContent === null) {
    vscode.window.showErrorMessage('Current password is incorrect');
    return;
  }

  const newFileData = encryptionService.encryptFileContent(
    decryptedContent,
    passwordResult.new.password,
    passwordResult.new.hint
  );
  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(realUri, encoder.encode(JSON.stringify(newFileData, null, 2)));

  encryptedFS.updateMeta(meta.realPath, passwordResult.new.password, passwordResult.new.hint);

  const config = vscode.workspace.getConfiguration('encrypt');
  if (config.get<boolean>('rememberPassword', true)) {
    passwordService.put(passwordResult.new, meta.realPath);
  }

  vscode.window.showInformationMessage('Password changed successfully.');
}

function updatePasswordServiceConfig(): void {
  const config = vscode.workspace.getConfiguration('encrypt');
  passwordService.init(
    config.get<boolean>('rememberPassword', true),
    config.get<number>('rememberPasswordTimeout', 30),
    config.get<'workspace' | 'folder' | 'file'>('rememberPasswordLevel', 'workspace')
  );
}

function updateStatusBar(statusBarItem: vscode.StatusBarItem): void {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && (
    isEncryptedFile(activeEditor.document.uri.fsPath) ||
    activeEditor.document.uri.scheme === EncryptedFileSystem.scheme
  )) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

export function deactivate(): void {
  passwordService.dispose();
}
