import { NextApiRequest } from 'next';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

interface DecodedToken {
  userId: string;
}

export const getUserIdFromRequest = (request: Request | NextRequest | NextApiRequest): string | null => {
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
    
    // 2. Check for token in query params for simple redirects
    if (!token && 'url' in request && request.url) {
      const { searchParams } = new URL(request.url);
      token = searchParams.get('token');
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
      return decoded.userId;
    }

    return null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
};
