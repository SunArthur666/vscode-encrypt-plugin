import * as vscode from 'vscode';
import { encryptionService } from '../services/EncryptionService';
import { passwordService } from '../services/PasswordService';
import { PasswordPrompt } from '../ui/PasswordPrompt';
import { DecryptPanel } from '../ui/DecryptPanel';
import type { EncryptConfiguration } from '../types';

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
 * Encrypt selected text
 */
export async function encryptSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const config = getConfiguration();
  let selection = editor.selection;

  // If no selection and expandToWholeLines is enabled, select current line
  if (selection.isEmpty && config.expandToWholeLines) {
    const line = editor.document.lineAt(selection.active.line);
    selection = new vscode.Selection(line.range.start, line.range.end);
  }

  // If still empty, prompt for text to encrypt
  if (selection.isEmpty) {
    await promptAndEncryptText(editor, editor.selection.active);
    return;
  }

  const selectedText = editor.document.getText(selection);

  // Check if selection contains encrypted content
  if (selectedText.includes('🔐')) {
    vscode.window.showWarningMessage('Selection contains encrypted content');
    return;
  }

  await performEncryption(editor, selection, selectedText);
}

/**
 * Prompt for text and encrypt
 */
async function promptAndEncryptText(editor: vscode.TextEditor, position: vscode.Position): Promise<void> {
  const config = getConfiguration();
  const filePath = editor.document.uri.fsPath;

  // Get default password from cache
  const cached = passwordService.get(filePath);

  const result = await PasswordPrompt.showForEncryption({
    confirmPassword: config.confirmPassword,
    defaultPassword: cached.password,
    defaultHint: cached.hint
  });

  if (!result.confirmed) {
    return;
  }

  const showMarker = config.showMarkerWhenReading;
  const encrypted = encryptionService.encryptInPlace(
    result.password,
    result.password, // Use password as text to encrypt when empty selection
    result.hint,
    showMarker
  );

  await editor.edit(editBuilder => {
    editBuilder.insert(position, encrypted);
  });

  // Cache password
  if (config.rememberPassword) {
    passwordService.put({ password: result.password, hint: result.hint }, filePath);
  }
}

/**
 * Perform encryption on selection
 */
async function performEncryption(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  text: string
): Promise<void> {
  const config = getConfiguration();
  const filePath = editor.document.uri.fsPath;

  // Get default password from cache
  const cached = passwordService.get(filePath);

  const result = await PasswordPrompt.showForEncryption({
    confirmPassword: config.confirmPassword,
    defaultPassword: cached.password,
    defaultHint: cached.hint
  });

  if (!result.confirmed) {
    return;
  }

  const showMarker = config.showMarkerWhenReading;
  const encrypted = encryptionService.encryptInPlace(text, result.password, result.hint, showMarker);

  await editor.edit(editBuilder => {
    editBuilder.replace(selection, encrypted);
  });

  // Cache password
  if (config.rememberPassword) {
    passwordService.put({ password: result.password, hint: result.hint }, filePath);
  }

  vscode.window.showInformationMessage('Text encrypted successfully');
}

/**
 * Decrypt selected text or text at cursor
 */
export async function decryptSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const config = getConfiguration();
  let selection = editor.selection;
  let selectedText = editor.document.getText(selection);

  // If no selection, try to find encrypted text at cursor
  if (selection.isEmpty || !selectedText.includes('🔐')) {
    const found = findEncryptedTextAtCursor(editor);
    if (!found) {
      vscode.window.showWarningMessage('No encrypted text found at cursor position');
      return;
    }
    selection = found.selection;
    selectedText = found.text;
  }

  const parsed = encryptionService.parseInPlaceEncrypted(selectedText);
  if (!parsed) {
    vscode.window.showWarningMessage('Could not parse encrypted text');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const cached = passwordService.get(filePath);

  // Try cached password first
  if (cached.password) {
    const decrypted = encryptionService.decryptInPlace(selectedText, cached.password);
    if (decrypted) {
      showDecryptedContent(editor, selection, selectedText, decrypted, cached.password, parsed.hint);
      return;
    }
  }

  // Prompt for password
  const passwordResult = await PasswordPrompt.showForDecryption({
    hint: parsed.hint,
    defaultPassword: cached.password
  });

  if (!passwordResult) {
    return;
  }

  const decrypted = encryptionService.decryptInPlace(selectedText, passwordResult.password);
  if (decrypted === null) {
    vscode.window.showErrorMessage('Decryption failed. Wrong password?');
    return;
  }

  // Cache password
  if (config.rememberPassword) {
    passwordService.put(passwordResult, filePath);
  }

  showDecryptedContent(editor, selection, selectedText, decrypted, passwordResult.password, parsed.hint);
}

/**
 * Find encrypted text at cursor position
 */
function findEncryptedTextAtCursor(editor: vscode.TextEditor): { selection: vscode.Selection; text: string } | null {
  const document = editor.document;
  const cursor = editor.selection.active;
  const line = document.lineAt(cursor.line);

  // Find all encrypted markers in the line
  const markerPattern = /🔐[^🔐]*🔐|%%🔐[^🔐]*🔐%%/g;
  let match: RegExpExecArray | null;

  while ((match = markerPattern.exec(line.text)) !== null) {
    const startPos = new vscode.Position(line.lineNumber, match.index);
    const endPos = new vscode.Position(line.lineNumber, match.index + match[0].length);

    // Check if cursor is within or near the marker
    if (cursor.character >= startPos.character && cursor.character <= endPos.character) {
      return {
        selection: new vscode.Selection(startPos, endPos),
        text: match[0]
      };
    }
  }

  // Check surrounding lines
  const searchRange = 10000; // characters to search
  const startOffset = Math.max(0, document.offsetAt(cursor) - searchRange);
  const endOffset = Math.min(document.getText().length, document.offsetAt(cursor) + searchRange);

  const searchStart = document.positionAt(startOffset);
  const searchEnd = document.positionAt(endOffset);
  const searchText = document.getText(new vscode.Range(searchStart, searchEnd));

  // Find marker closest to cursor
  let closestMatch: RegExpExecArray | null = null;
  let closestDistance = Infinity;

  while ((match = markerPattern.exec(searchText)) !== null) {
    const matchStart = startOffset + match.index;
    const matchEnd = matchStart + match[0].length;
    const cursorOffset = document.offsetAt(cursor);

    if (cursorOffset >= matchStart && cursorOffset <= matchEnd) {
      closestMatch = match;
      break;
    }

    const distance = Math.min(Math.abs(cursorOffset - matchStart), Math.abs(cursorOffset - matchEnd));
    if (distance < closestDistance) {
      closestDistance = distance;
      closestMatch = match;
    }
  }

  if (closestMatch) {
    const matchStartOffset = startOffset + closestMatch.index;
    const matchEndOffset = matchStartOffset + closestMatch[0].length;
    const matchStart = document.positionAt(matchStartOffset);
    const matchEnd = document.positionAt(matchEndOffset);

    return {
      selection: new vscode.Selection(matchStart, matchEnd),
      text: closestMatch[0]
    };
  }

  return null;
}

/**
 * Find the exact range of encrypted marker within text
 */
function findEncryptedMarkerRange(text: string): { start: number; end: number } | null {
  // Try to find encrypted marker in the text
  const patterns = [
    /🔐[^🔐]*🔐/,  // 🔐...🔐
    /%%🔐[^🔐]*🔐%%/  // %%🔐...🔐%%
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        start: match.index!,
        end: match.index! + match[0].length
      };
    }
  }

  return null;
}

/**
 * Show decrypted content in panel
 */
function showDecryptedContent(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  encryptedText: string,
  decryptedText: string,
  password: string,
  hint?: string
): void {
  const config = getConfiguration();
  const extensionUri = vscode.Uri.parse('file://' + __dirname);

  // Store document URI and selection range instead of editor reference
  // Use WorkspaceEdit API which works even when editor is in background tab
  const documentUri = editor.document.uri;

  // Find the exact range of the encrypted marker within the selected text
  // This ensures we only replace the encrypted portion, not extra text user selected
  const markerRange = findEncryptedMarkerRange(encryptedText);

  let replaceRange: vscode.Range;
  if (markerRange) {
    // Calculate the exact range of the encrypted marker in the document
    const selectionStartOffset = editor.document.offsetAt(selection.start);
    const markerStartOffset = selectionStartOffset + markerRange.start;
    const markerEndOffset = selectionStartOffset + markerRange.end;

    const markerStartPos = editor.document.positionAt(markerStartOffset);
    const markerEndPos = editor.document.positionAt(markerEndOffset);
    replaceRange = new vscode.Range(markerStartPos, markerEndPos);
  } else {
    // Fallback to entire selection if marker not found
    replaceRange = new vscode.Range(selection.start, selection.end);
  }

  DecryptPanel.show(extensionUri, decryptedText, {
    title: 'Decrypted Content',
    onDecryptInPlace: async () => {
      // Use WorkspaceEdit which works with document URI directly
      const edit = new vscode.WorkspaceEdit();
      edit.replace(documentUri, replaceRange, decryptedText);
      const success = await vscode.workspace.applyEdit(edit);

      if (!success) {
        vscode.window.showErrorMessage('Failed to decrypt in-place');
        return;
      }

      DecryptPanel.activePanel?.dispose();
      vscode.window.showInformationMessage('Decrypted in-place successfully');
    },
    onSave: async (newContent: string) => {
      // Use WorkspaceEdit which works with document URI directly
      const showMarker = config.showMarkerWhenReading;
      const reEncrypted = encryptionService.encryptInPlace(newContent, password, hint ?? '', showMarker);

      const edit = new vscode.WorkspaceEdit();
      edit.replace(documentUri, replaceRange, reEncrypted);
      const success = await vscode.workspace.applyEdit(edit);

      if (!success) {
        vscode.window.showErrorMessage('Failed to save changes');
        return;
      }

      vscode.window.showInformationMessage('Content re-encrypted and saved');
    }
  });
}
