import * as vscode from 'vscode';
import type { PasswordAndHint, PasswordCacheEntry } from '../types';

/**
 * Password Service for managing session-level password caching
 */
export class PasswordService {
  private cache: Map<string, PasswordCacheEntry> = new Map();
  private active: boolean = true;
  private timeout: number = 30; // minutes
  private level: 'workspace' | 'folder' | 'file' = 'workspace';
  private timer?: NodeJS.Timeout;

  constructor() {
    this.startExpirationTimer();
  }

  /**
   * Initialize with configuration
   */
  init(active: boolean, timeout: number, level: 'workspace' | 'folder' | 'file'): void {
    this.active = active;
    this.timeout = timeout;
    this.level = level;
    if (!active) {
      this.clear();
    }
  }

  /**
   * Start expiration check timer
   */
  private startExpirationTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      this.removeExpiredEntries();
    }, 60000); // Check every minute
  }

  /**
   * Remove expired cache entries
   */
  private removeExpiredEntries(): void {
    if (this.timeout === 0) return; // No timeout

    const now = Date.now();
    const timeoutMs = this.timeout * 60 * 1000;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > timeoutMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Generate cache key based on current level and file path
   */
  private getCacheKey(filePath: string): string {
    if (this.level === 'workspace') {
      return 'workspace';
    } else if (this.level === 'folder') {
      const uri = vscode.Uri.file(filePath);
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      return workspaceFolder ? `${workspaceFolder.uri.fsPath}:${filePath}` : filePath;
    } else {
      return filePath;
    }
  }

  /**
   * Store password in cache
   */
  put(passwordAndHint: PasswordAndHint, filePath: string): void {
    if (!this.active) {
      return;
    }

    const key = this.getCacheKey(filePath);
    this.cache.set(key, {
      password: passwordAndHint.password,
      hint: passwordAndHint.hint,
      timestamp: Date.now()
    });
  }

  /**
   * Get password from cache
   */
  get(filePath: string): PasswordAndHint {
    const key = this.getCacheKey(filePath);
    const entry = this.cache.get(key);

    if (entry) {
      // Check if expired
      if (this.timeout > 0) {
        const age = Date.now() - entry.timestamp;
        const timeoutMs = this.timeout * 60 * 1000;
        if (age > timeoutMs) {
          this.cache.delete(key);
          return { password: '', hint: '' };
        }
      }
      return { password: entry.password, hint: entry.hint };
    }

    return { password: '', hint: '' };
  }

  /**
   * Check if password exists in cache
   */
  has(filePath: string): boolean {
    const key = this.getCacheKey(filePath);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (this.timeout > 0) {
      const age = Date.now() - entry.timestamp;
      const timeoutMs = this.timeout * 60 * 1000;
      return age <= timeoutMs;
    }

    return true;
  }

  /**
   * Clear password for a specific file
   */
  clearForFile(filePath: string): void {
    const key = this.getCacheKey(filePath);
    this.cache.delete(key);
  }

  /**
   * Clear all cached passwords
   */
  clear(): number {
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Dispose timer
   */
  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

// Singleton instance
export const passwordService = new PasswordService();
