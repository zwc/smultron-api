import { verifyToken } from '../utils/jwt';

export const verifyAuthToken = (headers: Record<string, string | undefined>): boolean => {
  const authHeader = headers['Authorization'] || headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  return decoded !== null;
};

export const extractToken = (headers: Record<string, string | undefined>): string | null => {
  const authHeader = headers['Authorization'] || headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
};
