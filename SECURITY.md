# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Features

### Encryption

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with SHA-512, 210,000 iterations
- **Salt**: 16 bytes (128 bits), randomly generated per encryption
- **IV/Nonce**: 16 bytes (128 bits), randomly generated per encryption
- **Authentication Tag**: 16 bytes (128 bits)

### Data Protection

- ✅ Plaintext is **NEVER** written to disk
- ✅ Encrypted data uses authenticated encryption (GCM)
- ✅ Passwords are stored only in memory during session
- ✅ Memory is cleared when files are closed
- ✅ No telemetry or data collection

### What We DON'T Do

- ❌ Store passwords persistently
- ❌ Send any data to external servers
- ❌ Log sensitive information
- ❌ Create temporary unencrypted files

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

### Do

1. **Email**: Create a private security advisory on GitHub
2. **Provide**: Detailed description of the vulnerability
3. **Include**: Steps to reproduce (if applicable)
4. **Wait**: Allow reasonable time for a fix before public disclosure

### Don't

- Don't disclose publicly before a fix is available
- Don't exploit the vulnerability
- Don't access others' data

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Target**: Within 30 days for critical issues

## Security Best Practices for Users

1. **Use Strong Passwords**: Use long, unique passwords
2. **Use Password Hints Wisely**: Don't make hints too obvious
3. **Clear Cache**: Use "Clear Password Cache" when stepping away
4. **Update Regularly**: Keep the extension updated

## Cryptographic Details

### Encryption Process

```
1. Generate random salt (16 bytes)
2. Generate random IV (16 bytes)
3. Derive key using PBKDF2-SHA512(password, salt, 210000 iterations)
4. Encrypt plaintext using AES-256-GCM with derived key and IV
5. Store: salt + IV + authTag + ciphertext (all Base64 encoded)
```

### Decryption Process

```
1. Parse stored data to extract salt, IV, authTag, ciphertext
2. Derive key using PBKDF2-SHA512(password, salt, 210000 iterations)
3. Verify authTag and decrypt ciphertext using AES-256-GCM
4. Return plaintext only if authentication succeeds
```

## Compatibility

This extension uses the same encryption format as [Obsidian Encrypt](https://github.com/meld-cp/obsidian-encrypt) v2.0, ensuring interoperability.

## Contact

For security concerns, please use GitHub's private security advisory feature or contact the maintainer directly.

---

**Remember**: No encryption is perfect. Use this tool as part of a comprehensive security strategy.
