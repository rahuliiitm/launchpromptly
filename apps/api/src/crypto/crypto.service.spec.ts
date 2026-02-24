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

  it('throws if ENCRYPTION_KEY is missing', () => {
    expect(() => createService(undefined)).toThrow('ENCRYPTION_KEY');
  });

  it('throws if ENCRYPTION_KEY is wrong length', () => {
    expect(() => createService('tooshort')).toThrow('ENCRYPTION_KEY');
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
});
