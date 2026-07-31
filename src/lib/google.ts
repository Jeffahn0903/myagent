import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export const GOOGLE_LOGIN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export const GOOGLE_FULL_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
];

export const getGoogleOAuth2Client = (reqHost?: string) => {
  const GOOGLE_CLIENT_ID = (
    process.env.GOOGLE_CLIENT_ID ||
    '715706294927-d8b9m73k88kq4qbekde0ojd45mplm3o1.apps.googleusercontent.com'
  ).trim();

  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mostlyon.com';
  if (reqHost) {
    const proto = reqHost.includes('localhost') ? 'http' : 'https';
    baseUrl = `${proto}://${reqHost}`;
  }

  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/auth/google/callback`;

  if (!GOOGLE_CLIENT_SECRET) {
    console.warn('Warning: GOOGLE_CLIENT_SECRET is missing in Vercel environment variables.');
  }

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  return oAuth2Client;
};

export const getAuthenticatedGoogleClient = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.googleAccessToken) {
    throw new Error('Google account not connected');
  }

  const oAuth2Client = getGoogleOAuth2Client();
  oAuth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken || undefined,
    expiry_date: user.googleTokenExpiry ? user.googleTokenExpiry.getTime() : undefined,
  });

  return oAuth2Client;
};
