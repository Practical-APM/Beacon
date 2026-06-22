import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(ciphertext: string, secret: string): string {
  const [ivPart, tagPart, dataPart] = ciphertext.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Invalid encrypted payload');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(secret),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function getEncryptionKey(): string {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    return 'dev-only-integration-encryption-key-32b';
  }
  return key;
}
