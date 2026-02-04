import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { encryptionService } from '../services/EncryptionService';
import { passwordService } from '../services/PasswordService';
import { PasswordPrompt } from '../ui/PasswordPrompt';
import type { EncryptedFileData, EncryptConfiguration } from '../types';

/**
 * Get plugin configuration
 */
function getConfiguration(): EncryptConfiguration {
  const config = vscode.workspace.getConfiguration('encrypt');
  return {
    confirmPassword: config.get<boolean>('confirmPassword', true),
    rememberPassword: config.get<boolean>('rememberPassword', true),
    rememberPasswordTimeout: config.get<number>('rememberPasswordTimeout', 30),
    rememberPasswordLevel: config.get<'workspace' | 'folder' | 'file'>('rememberPasswordLevel', 'workspace'),
    expandToWholeLines: config.get<boolean>('expandToWholeLines', false),
    showMarkerWhenReading: config.get<boolean>('showMarkerWhenReading', true)
  };
}

/**
 * Check if file is encrypted
 */
export function isEncryptedFile(filePath: string): boolean {
  return filePath.endsWith('.md.enc');
}

/**
 * Create a new encrypted file
 * @param uri Optional URI of the selected folder to create the file in
 */
export async function createEncryptedFile(uri?: vscode.Uri): Promise<void> {
  const config = getConfiguration();

  // Determine the base folder: use selected folder or default
  let baseFolderUri: vscode.Uri;
  if (uri) {
    baseFolderUri = uri;
  } else {
    baseFolderUri = getDefaultFolderUri();
  }

  // Generate default file name with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:.]/g, '').slice(0, 15);
  const defaultFileName = `untitled-${timestamp}.md.enc`;

  // Get file name
  let fileName = await vscode.window.showInputBox({
    prompt: 'Enter file name',
    value: defaultFileName,
    placeHolder: defaultFileName,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'File name cannot be empty';
      }
      if (!value.endsWith('.md.enc')) {
        return 'File must end with .md.enc';
      }
      return null;
    }
  });

  if (!fileName) {
    return;
  }

  fileName = fileName.trim();

  // Create file URI in the determined folder
  const fileUri = vscode.Uri.joinPath(baseFolderUri, fileName);

  // Check if file exists
  try {
    await vscode.workspace.fs.stat(fileUri);
    const overwrite = await vscode.window.showWarningMessage(
      `File ${fileName} already exists. Overwrite?`,
      'Yes', 'No'
    );
    if (overwrite !== 'Yes') {
      return;
    }
  } catch {
    // File doesn't exist, continue
  }

  // Get password
  const filePath = fileUri.fsPath;
  const cached = passwordService.get(filePath);

  const passwordResult = await PasswordPrompt.showForEncryption({
    confirmPassword: config.confirmPassword,
    defaultPassword: cached.password,
    defaultHint: cached.hint
  });

  if (!passwordResult.confirmed) {
    return;
  }

  // Create encrypted file
  const fileData = encryptionService.encryptFileContent('', passwordResult.password, passwordResult.hint);
  const encryptedContent = JSON.stringify(fileData, null, 2);

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(fileUri, encoder.encode(encryptedContent));

  // Cache password
  if (config.rememberPassword) {
    passwordService.put(passwordResult, filePath);
  }

  // Open the file
  const document = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(document);

  vscode.window.showInformationMessage(`Encrypted file ${fileName} created`);
}

/**
 * Encrypt current file
 */
export async function encryptCurrentFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active file to encrypt');
    return;
  }

  const document = editor.document;
  const filePath = document.uri.fsPath;

  // Check if already encrypted
  if (isEncryptedFile(filePath)) {
    vscode.window.showWarningMessage('File is already encrypted');
    return;
  }

  // Confirm before encrypting
  const confirm = await vscode.window.showWarningMessage(
    `This will encrypt the file "${path.basename(filePath)}". The original file will be replaced with an encrypted version. Continue?`,
    'Encrypt', 'Cancel'
  );

  if (confirm !== 'Encrypt') {
    return;
  }

  const config = getConfiguration();
  const cached = passwordService.get(filePath);

  const passwordResult = await PasswordPrompt.showForEncryption({
    confirmPassword: config.confirmPassword,
    defaultPassword: cached.password,
    defaultHint: cached.hint
  });

  if (!passwordResult.confirmed) {
    return;
  }

  // Encrypt file content
  const content = document.getText();
  const fileData = encryptionService.encryptFileContent(content, passwordResult.password, passwordResult.hint);

  // Create encrypted file path
  const encryptedPath = filePath + (filePath.endsWith('.md') ? 'enc' : '.enc');

  // Write encrypted file
  const encryptedUri = vscode.Uri.file(encryptedPath);
  const encryptedContent = JSON.stringify(fileData, null, 2);
  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(encryptedUri, encoder.encode(encryptedContent));

  // Cache password
  if (config.rememberPassword) {
    passwordService.put(passwordResult, encryptedPath);
  }

  // Open encrypted file
  const newDocument = await vscode.workspace.openTextDocument(encryptedUri);
  await vscode.window.showTextDocument(newDocument);

  // Optionally delete original file
  const deleteOriginal = await vscode.window.showWarningMessage(
    `Delete original file "${path.basename(filePath)}"?`,
    'Delete', 'Keep'
  );

  if (deleteOriginal === 'Delete') {
    await vscode.workspace.fs.delete(document.uri);
  }

  vscode.window.showInformationMessage('File encrypted successfully');
}

/**
 * Decrypt current file or specified file
 * @param uri Optional URI of the file to decrypt (for context menu)
 */
export async function decryptCurrentFile(uri?: vscode.Uri): Promise<void> {
  let fileUri: vscode.Uri;
  let filePath: string;
  let fileContent: string;

  // Determine file source: URI parameter or active editor
  if (uri) {
    fileUri = uri;
    filePath = uri.fsPath;
    // Read file content from disk
    const fileData = await vscode.workspace.fs.readFile(uri);
    fileContent = Buffer.from(fileData).toString('utf8');
  } else {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active file to decrypt');
      return;
    }
    fileUri = editor.document.uri;
    filePath = fileUri.fsPath;
    fileContent = editor.document.getText();
  }

  // Check if file is encrypted
  if (!isEncryptedFile(filePath)) {
    vscode.window.showWarningMessage('File is not an encrypted file (.md.enc)');
    return;
  }

  // Parse file data
  let fileData: EncryptedFileData;
  try {
    fileData = JSON.parse(fileContent);
  } catch {
    vscode.window.showErrorMessage('Invalid encrypted file format');
    return;
  }

  const config = getConfiguration();
  const cached = passwordService.get(filePath);

  // Prompt for password
  const passwordResult = await PasswordPrompt.showForDecryption({
    hint: fileData.hint,
    defaultPassword: cached.password
  });

  if (!passwordResult) {
    return;
  }

  const decryptedContent = encryptionService.decryptFileData(fileData, passwordResult.password);
  if (decryptedContent === null) {
    vscode.window.showErrorMessage('Decryption failed. Wrong password?');
    return;
  }

  // Cache password
  if (config.rememberPassword) {
    passwordService.put(passwordResult, filePath);
  }

  // Ask user how to decrypt: to file or to memory (virtual document)
  const decryptOption = await vscode.window.showQuickPick(
    [
      {
        label: '$(file) Decrypt to File',
        description: 'Create a .md file on disk (may be committed to Git)',
        detail: 'The decrypted content will be saved as a regular file',
        value: 'file'
      },
      {
        label: '$(eye) View in Memory Only',
        description: 'Read-only, never written to disk (safe from Git)',
        detail: 'Perfect for viewing sensitive content without risk of accidental commits',
        value: 'memory'
      }
    ],
    {
      placeHolder: 'How would you like to decrypt this file?',
      title: 'Decrypt Options'
    }
  );

  if (!decryptOption) {
    return;
  }

  if (decryptOption.value === 'memory') {
    // Decrypt to virtual document (memory only, never written to disk)
    await decryptToMemory(filePath, decryptedContent);
  } else {
    // Decrypt to file (original behavior)
    await decryptToFile(fileUri, filePath, decryptedContent);
  }
}

/**
 * Decrypt content to a virtual document in memory
 * This document is never written to disk, safe from Git commits
 */
async function decryptToMemory(originalFilePath: string, decryptedContent: string): Promise<void> {
  // Create a virtual document URI with untitled scheme
  // Using untitled scheme means VS Code won't auto-save and won't write to disk
  const fileName = path.basename(originalFilePath).replace('.enc', '') + ' (Decrypted - Read Only)';
  const virtualUri = vscode.Uri.parse(`untitled:${fileName}`);

  // Open an untitled document
  const document = await vscode.workspace.openTextDocument(virtualUri);
  const editor = await vscode.window.showTextDocument(document);

  // Insert the decrypted content
  await editor.edit(editBuilder => {
    editBuilder.insert(new vscode.Position(0, 0), decryptedContent);
  });

  // Set language mode to markdown
  await vscode.languages.setTextDocumentLanguage(document, 'markdown');

  vscode.window.showInformationMessage(
    '🔓 Decrypted to memory. This content is NOT saved to disk and is safe from Git.',
    'Got it'
  );
}

/**
 * Decrypt content to a file on disk
 */
async function decryptToFile(fileUri: vscode.Uri, filePath: string, decryptedContent: string): Promise<void> {
  // Create decrypted file (convert .md.enc to .md)
  let decryptedPath: string;
  if (filePath.endsWith('.md.enc')) {
    decryptedPath = filePath.slice(0, -4); // Remove .enc (4 chars), keep .md
  } else {
    decryptedPath = filePath.replace(/\.enc$/, '');
  }
  const decryptedUri = vscode.Uri.file(decryptedPath);

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(decryptedUri, encoder.encode(decryptedContent));

  // Open decrypted file
  const newDocument = await vscode.workspace.openTextDocument(decryptedUri);
  await vscode.window.showTextDocument(newDocument);

  // Warn about Git
  const deleteOrKeep = await vscode.window.showWarningMessage(
    `⚠️ Decrypted file "${path.basename(decryptedPath)}" created. Be careful not to commit it to Git!`,
    'Delete Encrypted', 'Keep Both', 'Add to .gitignore'
  );

  if (deleteOrKeep === 'Delete Encrypted') {
    await vscode.workspace.fs.delete(fileUri);
    vscode.window.showInformationMessage('Encrypted file deleted');
  } else if (deleteOrKeep === 'Add to .gitignore') {
    await addToGitignore(decryptedPath);
  }
}

/**
 * Change password for encrypted file
 */
export async function changePassword(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active file');
    return;
  }

  const document = editor.document;
  const filePath = document.uri.fsPath;

  if (!isEncryptedFile(filePath)) {
    vscode.window.showWarningMessage('Not an encrypted file');
    return;
  }

  // Parse file data
  let fileData: EncryptedFileData;
  try {
    fileData = JSON.parse(document.getText());
  } catch {
    vscode.window.showErrorMessage('Invalid encrypted file format');
    return;
  }

  // Get password change
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

  // Re-encrypt with new password
  const newFileData = encryptionService.encryptFileContent(
    decryptedContent,
    passwordResult.new.password,
    passwordResult.new.hint
  );

  // Save updated file
  const newContent = JSON.stringify(newFileData, null, 2);
  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(document.uri, encoder.encode(newContent));

  // Update cache
  const config = getConfiguration();
  if (config.rememberPassword) {
    passwordService.put(passwordResult.new, filePath);
  }

  vscode.window.showInformationMessage('Password changed successfully');
}

/**
 * Lock and close all encrypted files
 */
export async function lockAndCloseAll(): Promise<void> {
  const config = getConfiguration();

  // Close all .md.enc files
  const tabs = vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .filter(tab => {
      const uri = (tab.input as vscode.TabInputText).uri;
      return uri && isEncryptedFile(uri.fsPath);
    });

  for (const tab of tabs) {
    await vscode.window.tabGroups.close(tab);
  }

  // Clear password cache if desired
  if (config.rememberPassword) {
    const cleared = passwordService.clear();
    vscode.window.showInformationMessage(`Closed ${tabs.length} encrypted file(s) and cleared ${cleared} cached password(s)`);
  } else {
    vscode.window.showInformationMessage(`Closed ${tabs.length} encrypted file(s)`);
  }
}

/**
 * Clear password cache
 */
export async function clearPasswordCache(): Promise<void> {
  const cleared = passwordService.clear();
  vscode.window.showInformationMessage(`Cleared ${cleared} cached password(s)`);
}

/**
 * Add a file to .gitignore
 */
async function addToGitignore(filePath: string): Promise<void> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  if (!workspaceFolder) {
    vscode.window.showWarningMessage('Could not find workspace folder');
    return;
  }

  const gitignorePath = path.join(workspaceFolder.uri.fsPath, '.gitignore');
  const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
  const gitignoreEntry = `\n# Decrypted file - DO NOT COMMIT\n${relativePath}\n`;

  try {
    const gitignoreUri = vscode.Uri.file(gitignorePath);
    let existingContent = '';
    
    try {
      const fileData = await vscode.workspace.fs.readFile(gitignoreUri);
      existingContent = Buffer.from(fileData).toString('utf8');
    } catch {
      // File doesn't exist, will create new
    }

    // Check if already in gitignore
    if (existingContent.includes(relativePath)) {
      vscode.window.showInformationMessage('File is already in .gitignore');
      return;
    }

    const newContent = existingContent + gitignoreEntry;
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(gitignoreUri, encoder.encode(newContent));
    
    vscode.window.showInformationMessage(`Added "${relativePath}" to .gitignore`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update .gitignore: ${error}`);
  }
}

/**
 * Get default folder for new files
 */
function getDefaultFolderUri(): vscode.Uri {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    if (workspaceFolder) {
      return workspaceFolder.uri;
    }
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri;
  }

  return vscode.Uri.file(path.join(os.homedir(), 'Desktop'));
}
