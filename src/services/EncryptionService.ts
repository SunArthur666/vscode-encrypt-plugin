import * as crypto from 'crypto';
import type { EncryptionResult, EncryptedFileData } from '../types';

/**
 * Encryption Service using AES-256-GCM
 */
export class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32; // 256 bits
  private readonly IV_LENGTH = 16; // 128 bits
  private readonly SALT_LENGTH = 16; // 128 bits (compatible with Obsidian Encrypt v2.0)
  private readonly AUTH_TAG_LENGTH = 16;
  private readonly ITERATIONS = 210000; // Compatible with Obsidian Encrypt v2.0

  /**
   * Derive a key from password using PBKDF2 with SHA-512
   * Compatible with Obsidian Encrypt v2.0
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      this.ITERATIONS,
      this.KEY_LENGTH,
      'sha512' // Using SHA-512 to match Obsidian Encrypt v2.0
    );
  }

  /**
   * Encrypt plaintext to Base64 encoded ciphertext
   */
  encryptToBase64(plaintext: string, password: string): EncryptionResult {
    // Generate random salt and IV
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    // Derive key from password
    const key = this.deriveKey(password, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    // Encrypt
    let ciphertext = cipher.update(plaintext, 'utf8', 'binary');
    ciphertext += cipher.final('binary');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: Buffer.from(ciphertext, 'binary').toString('base64'),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  /**
   * Decrypt Base64 encoded ciphertext
   * Returns null if decryption fails (wrong password)
   */
  decryptFromBase64(
    base64Ciphertext: string,
    password: string,
    base64Salt: string,
    base64Iv: string,
    base64AuthTag: string
  ): string | null {
    try {
      const ciphertext = Buffer.from(base64Ciphertext, 'base64');
      const salt = Buffer.from(base64Salt, 'base64');
      const iv = Buffer.from(base64Iv, 'base64');
      const authTag = Buffer.from(base64AuthTag, 'base64');

      // Derive key from password
      const key = this.deriveKey(password, salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let plaintext = decipher.update(ciphertext);
      plaintext = Buffer.concat([plaintext, decipher.final()]);

      return plaintext.toString('utf8');
    } catch {
      // Decryption failed (likely wrong password)
      return null;
    }
  }

  /**
   * Encrypt file content to EncryptedFileData format
   */
  encryptFileContent(content: string, password: string, hint?: string): EncryptedFileData {
    const result = this.encryptToBase64(content, password);
    return {
      version: '1.0',
      hint,
      ...result
    };
  }

  /**
   * Decrypt file data from EncryptedFileData format
   */
  decryptFileData(fileData: EncryptedFileData, password: string): string | null {
    return this.decryptFromBase64(
      fileData.ciphertext,
      password,
      fileData.salt,
      fileData.iv,
      fileData.authTag
    );
  }

  /**
   * Encrypt text for in-place encryption (compact format)
   * Returns format: 🔐hint:base64data🔐 or 🔐base64data🔐
   * The base64data contains: salt + iv + authTag + ciphertext
   */
  encryptInPlace(text: string, password: string, hint?: string, showMarker: boolean = true): string {
    const result = this.encryptToBase64(text, password);

    // Combine salt + iv + authTag + ciphertext into one buffer
    const salt = Buffer.from(result.salt, 'base64');
    const iv = Buffer.from(result.iv, 'base64');
    const authTag = Buffer.from(result.authTag, 'base64');
    const ciphertext = Buffer.from(result.ciphertext, 'base64');

    const combined = Buffer.concat([salt, iv, authTag, ciphertext]);
    const combinedBase64 = combined.toString('base64');

    const data = hint ? `${hint}:${combinedBase64}` : combinedBase64;
    const prefix = showMarker ? '🔐' : '%%🔐';
    const suffix = showMarker ? '🔐' : '🔐%%';
    return `${prefix}${data}${suffix}`;
  }

  /**
   * Parse in-place encrypted text
   * Returns { hint, ciphertext } or null
   * The ciphertext is the combined base64 data (salt + iv + authTag + actual ciphertext)
   */
  parseInPlaceEncrypted(text: string): { hint?: string; combinedData: string } | null {
    // Match patterns: 🔐hint:combinedData🔐 or 🔐combinedData🔐 or %%🔐...🔐%%
    const patterns = [
      /🔐([^:🔐]+):([A-Za-z0-9+/=]+)🔐/,  // with hint
      /🔐([A-Za-z0-9+/=]+)🔐/,            // without hint
      /%%🔐([^:🔐]+):([A-Za-z0-9+/=]+)🔐%%/,  // hidden with hint
      /%%🔐([A-Za-z0-9+/=]+)🔐%%/         // hidden without hint
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        if (match.length === 3) {
          return { hint: match[1], combinedData: match[2] };
        } else if (match.length === 2) {
          return { combinedData: match[1] };
        }
      }
    }
    return null;
  }

  /**
   * Decrypt in-place encrypted text
   */
  decryptInPlace(encryptedText: string, password: string): string | null {
    const parsed = this.parseInPlaceEncrypted(encryptedText);
    if (!parsed) {
      return null;
    }

    try {
      // The combinedData contains: salt + iv + authTag + ciphertext
      const combined = Buffer.from(parsed.combinedData, 'base64');

      if (combined.length < this.SALT_LENGTH + this.IV_LENGTH + this.AUTH_TAG_LENGTH) {
        return null;
      }

      const salt = combined.subarray(0, this.SALT_LENGTH);
      const iv = combined.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const authTag = combined.subarray(
        this.SALT_LENGTH + this.IV_LENGTH,
        this.SALT_LENGTH + this.IV_LENGTH + this.AUTH_TAG_LENGTH
      );
      const actualCiphertext = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.AUTH_TAG_LENGTH);

      return this.decryptFromBase64(
        actualCiphertext.toString('base64'),
        password,
        salt.toString('base64'),
        iv.toString('base64'),
        authTag.toString('base64')
      );
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
