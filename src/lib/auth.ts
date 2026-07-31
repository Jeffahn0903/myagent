import { NextApiRequest } from 'next';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

interface DecodedToken {
  userId: string;
  email?: string;
  name?: string;
}

export const getUserFromRequest = (request: Request | NextRequest | NextApiRequest): DecodedToken | null => {
  try {
    let token: string | null = null;
    
    // 1. Check for Authorization header
    let authorization: string | null = null;
    if ('headers' in request && typeof (request.headers as Headers).get === 'function') {
      authorization = (request.headers as Headers).get('authorization');
    } else if ('headers' in request && request.headers) {
      const authHeader = (request.headers as Record<string, string | string[] | undefined>)['authorization'];
      authorization = Array.isArray(authHeader) ? authHeader[0] : authHeader || null;
    }

    if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
      token = authorization.substring(7);
    }
    
    // 2. Check for token in query params
    if (!token && 'url' in request && request.url) {
      try {
        const { searchParams } = new URL(request.url);
        token = searchParams.get('token');
      } catch (e) {}
    }

    // 3. Check for auth_token in Cookies
    if (!token) {
      if ('cookies' in request && typeof (request as any).cookies?.get === 'function') {
        token = (request as any).cookies.get('auth_token')?.value || null;
      }
      if (!token && 'headers' in request && typeof (request.headers as Headers).get === 'function') {
        const cookieHeader = (request.headers as Headers).get('cookie');
        if (cookieHeader) {
          const match = cookieHeader.match(/auth_token=([^;]+)/);
          if (match) token = match[1];
        }
      }
    }

    if (token) {
      const secret = process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod';
      const decoded = jwt.verify(token, secret) as DecodedToken;
      return decoded;
    }

    return null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
};

export const getUserIdFromRequest = (request: Request | NextRequest | NextApiRequest): string | null => {
  const decoded = getUserFromRequest(request);
  return decoded ? decoded.userId : null;
};
