import * as vscode from 'vscode';
import { encryptionService } from '../services/EncryptionService';

interface VirtualFile {
  content: Uint8Array;
  ctime: number;
  mtime: number;
}

interface FileMeta {
  realPath: string;
  password: string;
  hint: string;
}

/**
 * In-memory virtual file system for decrypted content.
 * Files live only in memory; on save the content is encrypted
 * and written back to the real .md.enc file on disk.
 */
export class EncryptedFileSystem implements vscode.FileSystemProvider {
  static readonly scheme = 'encfs';

  private files = new Map<string, VirtualFile>();
  private metadata = new Map<string, FileMeta>();

  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  // --- FileSystemProvider required methods ---

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const file = this.files.get(uri.path);
    if (file) {
      return {
        type: vscode.FileType.File,
        ctime: file.ctime,
        mtime: file.mtime,
        size: file.content.byteLength,
      };
    }

    // Check if the path is an ancestor directory of any virtual file
    const dirPrefix = uri.path.endsWith('/') ? uri.path : uri.path + '/';
    for (const key of this.files.keys()) {
      if (key.startsWith(dirPrefix)) {
        return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
      }
    }

    throw vscode.FileSystemError.FileNotFound(uri);
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const dirPrefix = uri.path.endsWith('/') ? uri.path : uri.path + '/';
    const entries = new Map<string, vscode.FileType>();

    for (const key of this.files.keys()) {
      if (!key.startsWith(dirPrefix)) { continue; }
      const rest = key.slice(dirPrefix.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx === -1) {
        entries.set(rest, vscode.FileType.File);
      } else {
        entries.set(rest.slice(0, slashIdx), vscode.FileType.Directory);
      }
    }

    return [...entries.entries()];
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('createDirectory not supported');
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const file = this.files.get(uri.path);
    if (!file) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return file.content;
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    _options: { readonly create: boolean; readonly overwrite: boolean }
  ): Promise<void> {
    const now = Date.now();
    const existing = this.files.get(uri.path);
    this.files.set(uri.path, {
      content,
      ctime: existing?.ctime ?? now,
      mtime: now,
    });

    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);

    const meta = this.metadata.get(uri.path);
    if (!meta) {
      return;
    }

    const plaintext = new TextDecoder().decode(content);
    const realUri = vscode.Uri.file(meta.realPath);

    try {
      const diskBytes = await vscode.workspace.fs.readFile(realUri);
      const existingData = JSON.parse(new TextDecoder().decode(diskBytes));
      const hint = meta.hint ?? existingData.hint;
      const encrypted = encryptionService.encryptFileContent(plaintext, meta.password, hint);
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(realUri, encoder.encode(JSON.stringify(encrypted, null, 2)));
    } catch {
      const encrypted = encryptionService.encryptFileContent(plaintext, meta.password, meta.hint);
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(realUri, encoder.encode(JSON.stringify(encrypted, null, 2)));
    }

    vscode.window.setStatusBarMessage('$(lock) Encrypted and saved to .md.enc — plaintext never written to disk', 3000);
  }

  delete(uri: vscode.Uri): void {
    this.files.delete(uri.path);
    this.metadata.delete(uri.path);
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions('rename not supported');
  }

  // --- Public helper methods ---

  /**
   * Build the encfs:// URI for a given real .md.enc file path.
   * Strips the trailing .enc and inserts a [Memory] marker before .md
   * so the tab title makes it clear the content lives only in memory.
   */
  getVirtualUri(realPath: string): vscode.Uri {
    const withoutEnc = realPath.replace(/\.enc$/, '');
    const virtualPath = withoutEnc.replace(/\.md$/, ' [Memory].md');
    return vscode.Uri.from({ scheme: EncryptedFileSystem.scheme, path: virtualPath });
  }

  /**
   * Store decrypted content in the virtual file system and return the URI.
   */
  createVirtualFile(
    realPath: string,
    password: string,
    hint: string,
    content: string
  ): vscode.Uri {
    const uri = this.getVirtualUri(realPath);
    const now = Date.now();
    this.files.set(uri.path, {
      content: new TextEncoder().encode(content),
      ctime: now,
      mtime: now,
    });
    this.metadata.set(uri.path, { realPath, password, hint });
    return uri;
  }

  hasFile(realPath: string): boolean {
    const uri = this.getVirtualUri(realPath);
    return this.files.has(uri.path);
  }

  /**
   * Update the password / hint for an already-open virtual file.
   */
  updateMeta(realPath: string, password: string, hint: string): void {
    const uri = this.getVirtualUri(realPath);
    const existing = this.metadata.get(uri.path);
    if (existing) {
      existing.password = password;
      existing.hint = hint;
    }
  }

  /**
   * Retrieve metadata for a virtual URI (real path, password, hint).
   */
  getMeta(uri: vscode.Uri): FileMeta | undefined {
    return this.metadata.get(uri.path);
  }

  clearAll(): void {
    const uris = [...this.files.keys()].map(p =>
      vscode.Uri.from({ scheme: EncryptedFileSystem.scheme, path: p })
    );
    this.files.clear();
    this.metadata.clear();
    for (const uri of uris) {
      this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    }
  }

  dispose(): void {
    this._onDidChangeFile.dispose();
  }
}
