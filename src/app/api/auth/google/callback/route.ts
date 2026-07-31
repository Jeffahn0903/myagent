import { NextResponse } from 'next/server';
import { getGoogleOAuth2Client } from '@/lib/google';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url));
  }

  try {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'mostlyon.com';
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const currentOrigin = `${proto}://${host}`;

    const oAuth2Client = getGoogleOAuth2Client(host);
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    const { access_token, refresh_token, expiry_date } = tokens;

    // Retrieve Google User Profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      return NextResponse.redirect(new URL('/login?error=no_email_from_google', currentOrigin));
    }

    let user;

    if (state && state !== 'sso') {
      // Connect to existing logged-in user
      user = await prisma.user.update({
        where: { id: state },
        data: {
          googleAccessToken: access_token,
          googleRefreshToken: refresh_token,
          googleTokenExpiry: expiry_date ? new Date(expiry_date) : null,
        },
      });
      return NextResponse.redirect(new URL('/dashboard/settings?connected=true', currentOrigin));
    }

    // Find existing user by email or create new user (Public Registration via Google SSO)
    user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split('@')[0],
          password: '',
          googleAccessToken: access_token,
          googleRefreshToken: refresh_token,
          googleTokenExpiry: expiry_date ? new Date(expiry_date) : null,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: access_token || user.googleAccessToken,
          googleRefreshToken: refresh_token || user.googleRefreshToken,
          googleTokenExpiry: expiry_date ? new Date(expiry_date) : user.googleTokenExpiry,
        },
      });
    }

    // Issue JWT cookie and redirect to client-side callback handler
    const secret = process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod';
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn: '7d' }
    );

    const redirectTarget = new URL(`/auth/callback?token=${token}`, currentOrigin);

    const response = NextResponse.redirect(redirectTarget);
    const isProd = process.env.NODE_ENV === 'production' || currentOrigin.startsWith('https://');

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Google OAuth callback error details:', error?.response?.data || error?.message || error);
    const errMessage = error?.message || 'google_callback_error';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'mostlyon.com';
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errMessage)}`, `${proto}://${host}`));
  }
}
