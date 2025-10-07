import jwt from 'jsonwebtoken';
import type { AuthPayload } from '../types';

export const generateToken = (payload: { username: string }, expiresIn: string = '24h'): string => {
  const secret = process.env.JWT_SECRET || '';
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string): AuthPayload | null => {
  try {
    const secret = process.env.JWT_SECRET || '';
    return jwt.verify(token, secret) as AuthPayload;
  } catch (error) {
    return null;
  }
};
