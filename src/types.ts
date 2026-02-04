/**
 * Plugin configuration interface
 */
export interface EncryptConfiguration {
  confirmPassword: boolean;
  rememberPassword: boolean;
  rememberPasswordTimeout: number;
  rememberPasswordLevel: 'workspace' | 'folder' | 'file';
  expandToWholeLines: boolean;
  showMarkerWhenReading: boolean;
}

/**
 * Password and hint pair
 */
export interface PasswordAndHint {
  password: string;
  hint: string;
}

/**
 * Encrypted file data structure (stored as JSON in .md.enc files)
 */
export interface EncryptedFileData {
  version: string;
  hint?: string;
  ciphertext: string;
  salt: string;
  iv: string;
  authTag: string;
}

/**
 * Password cache entry with expiration
 */
export interface PasswordCacheEntry extends PasswordAndHint {
  timestamp: number;
}

/**
 * Encryption result
 */
export interface EncryptionResult {
  ciphertext: string;
  salt: string;
  iv: string;
  authTag: string;
}

/**
 * In-place encryption format
 */
export interface InPlaceEncryptedData {
  hint: string;
  ciphertext: string;
  showMarker: boolean;
}

/**
 * Constants for in-place encryption markers
 */
export const ENCRYPTED_MARKER = '🔐';
export const HINT_DELIMITER = ':';
export const COMMENT_PREFIX = '%%';
export const COMMENT_SUFFIX = '%%';

/**
 * Encrypted file extensions
 */
export const ENCRYPTED_EXTENSIONS = ['.md.enc'];
