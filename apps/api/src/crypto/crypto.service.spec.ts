import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  const validKey = 'a'.repeat(64); // 64 hex chars = 32 bytes

  function createService(encryptionKey?: string) {
    const configService = {
      get: jest.fn().mockReturnValue(encryptionKey),
    } as unknown as ConfigService;
    return new CryptoService(configService);
  }

  it('throws with actionable message if ENCRYPTION_KEY is missing', () => {
    expect(() => createService(undefined)).toThrow('ENCRYPTION_KEY is missing or invalid');
    expect(() => createService(undefined)).toThrow('Generate one');
    expect(() => createService(undefined)).toThrow('.env');
  });

  it('throws with actionable message if ENCRYPTION_KEY is wrong length', () => {
    expect(() => createService('tooshort')).toThrow('ENCRYPTION_KEY is missing or invalid');
  });

  it('throws with generation command in error message', () => {
    try {
      createService(undefined);
    } catch (e) {
      expect((e as Error).message).toContain('randomBytes');
    }
  });

  it('encrypt then decrypt roundtrip', () => {
    const service = createService(validKey);
    const plaintext = 'sk-test-secret-api-key-12345';
    const { encrypted, iv, authTag } = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted, iv, authTag);
    expect(decrypted).toBe(plaintext);
  });

  it('different plaintexts produce different ciphertexts', () => {
    const service = createService(validKey);
    const a = service.encrypt('hello');
    const b = service.encrypt('world');
    expect(a.encrypted).not.toBe(b.encrypted);
  });

  it('same plaintext encrypted twice produces different ciphertexts (random IV)', () => {
    const service = createService(validKey);
    const a = service.encrypt('same');
    const b = service.encrypt('same');
    expect(a.encrypted).not.toBe(b.encrypted);
    expect(a.iv).not.toBe(b.iv);
  });

  it('decrypt fails with wrong auth tag', () => {
    const service = createService(validKey);
    const { encrypted, iv } = service.encrypt('secret');
    expect(() => service.decrypt(encrypted, iv, 'bad'.padEnd(32, '0'))).toThrow();
  });

  it('handles Unicode API keys (Chinese provider keys)', () => {
    const service = createService(validKey);
    const unicodeKey = 'sk-密钥-テスト-مفتاح-🔑';
    const { encrypted, iv, authTag } = service.encrypt(unicodeKey);
    expect(service.decrypt(encrypted, iv, authTag)).toBe(unicodeKey);
  });

  it('handles very long API keys (500+ chars)', () => {
    const service = createService(validKey);
    const longKey = 'sk-' + 'a'.repeat(500);
    const { encrypted, iv, authTag } = service.encrypt(longKey);
    expect(service.decrypt(encrypted, iv, authTag)).toBe(longKey);
  });

  it('handles empty string encryption', () => {
    const service = createService(validKey);
    const { encrypted, iv, authTag } = service.encrypt('');
    expect(service.decrypt(encrypted, iv, authTag)).toBe('');
  });

  it('handles special characters in API keys', () => {
    const service = createService(validKey);
    const specialKey = "sk-test!@#$%^&*()_+-=[]{}|;':\",./<>?";
    const { encrypted, iv, authTag } = service.encrypt(specialKey);
    expect(service.decrypt(encrypted, iv, authTag)).toBe(specialKey);
  });

  it('decrypt fails with tampered ciphertext', () => {
    const service = createService(validKey);
    const { encrypted, iv, authTag } = service.encrypt('secret');
    const tampered = 'ff' + encrypted.slice(2); // flip first byte
    expect(() => service.decrypt(tampered, iv, authTag)).toThrow();
  });

  it('decrypt fails with wrong IV', () => {
    const service = createService(validKey);
    const { encrypted, authTag } = service.encrypt('secret');
    const wrongIv = '00'.repeat(12);
    expect(() => service.decrypt(encrypted, wrongIv, authTag)).toThrow();
  });
});
