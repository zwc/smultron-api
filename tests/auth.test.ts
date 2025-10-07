import { describe, test, expect, beforeAll } from 'bun:test';
import { verifyAuthToken } from '../src/middleware/auth';
import { generateToken } from '../src/utils/jwt';

describe('Auth Middleware', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
  });

  test('should extract and verify valid token from Authorization header', () => {
    const token = generateToken({ username: 'admin' });
    const headers = { Authorization: `Bearer ${token}` };
    
    const result = verifyAuthToken(headers);
    
    expect(result).toBe(true);
  });

  test('should return false for missing Authorization header', () => {
    const result = verifyAuthToken({});
    
    expect(result).toBe(false);
  });

  test('should return false for invalid token format', () => {
    const headers = { Authorization: 'InvalidToken' };
    
    const result = verifyAuthToken(headers);
    
    expect(result).toBe(false);
  });

  test('should return false for invalid token', () => {
    const headers = { Authorization: 'Bearer invalid.token.here' };
    
    const result = verifyAuthToken(headers);
    
    expect(result).toBe(false);
  });

  test('should handle lowercase authorization header', () => {
    const token = generateToken({ username: 'admin' });
    const headers = { authorization: `Bearer ${token}` };
    
    const result = verifyAuthToken(headers);
    
    expect(result).toBe(true);
  });
});
