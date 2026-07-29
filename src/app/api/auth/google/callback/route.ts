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
    const oAuth2Client = getGoogleOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    const { access_token, refresh_token, expiry_date } = tokens;

    // Retrieve Google User Profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      return NextResponse.redirect(new URL('/login?error=no_email_from_google', request.url));
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
    } else {
      // SSO Login or Auto-Register
      user = await prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: googleUser.email,
            name: googleUser.name || googleUser.email.split('@')[0],
            password: '', // SSO user without password
            googleAccessToken: access_token,
            googleRefreshToken: refresh_token,
            googleTokenExpiry: expiry_date ? new Date(expiry_date) : null,
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleAccessToken: access_token,
            ...(refresh_token ? { googleRefreshToken: refresh_token } : {}),
            googleTokenExpiry: expiry_date ? new Date(expiry_date) : null,
          },
        });
      }
    }

    // Generate App JWT Token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    return NextResponse.redirect(new URL(`/auth/callback?token=${token}`, request.url));
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url));
  }
}
