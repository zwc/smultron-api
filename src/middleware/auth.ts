import { verifyToken } from '../utils/jwt';

// Feature flag: disable auth for dev environment if DISABLE_AUTH is set to 'true'
const AUTH_DISABLED = process.env.DISABLE_AUTH === 'true';

if (AUTH_DISABLED) {
  console.warn('⚠️  AUTHENTICATION DISABLED - This should only be used in development!');
}

export const verifyAuthToken = (headers: Record<string, string | undefined>): boolean => {
  // If auth is disabled (dev mode), always return true
  if (AUTH_DISABLED) {
    return true;
  }

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
