import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const decoded = getUserFromRequest(request);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user: any = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          googleAccessToken: true,
        },
      });
    } catch (dbErr) {
      console.warn('Prisma findUnique error in /api/me (using fallback token info):', dbErr);
    }

    if (!user) {
      user = {
        id: decoded.userId,
        email: decoded.email || 'user@mostlyon.com',
        name: decoded.name || '사용자',
        hasGoogleAuth: true,
      };
    } else {
      user = {
        id: user.id,
        email: user.email,
        name: user.name,
        hasGoogleAuth: !!user.googleAccessToken,
      };
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
}
