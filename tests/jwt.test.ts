import { describe, test, expect, beforeAll } from 'bun:test';
import { generateToken, verifyToken } from '../src/utils/jwt';

describe('JWT Utils', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
  });

  test('should generate a valid JWT token', () => {
    const payload = { username: 'admin' };
    const token = generateToken(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  test('should verify a valid token', () => {
    const payload = { username: 'admin' };
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    
    expect(decoded).toBeDefined();
    expect(decoded?.username).toBe('admin');
  });

  test('should return null for invalid token', () => {
    const decoded = verifyToken('invalid.token.here');
    expect(decoded).toBeNull();
  });

  test('should return null for expired token', () => {
    const token = generateToken({ username: 'admin' }, '0s');
    const decoded = verifyToken(token);
    expect(decoded).toBeNull();
  });
});
