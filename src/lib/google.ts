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
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';

  // Always use www.mostlyon.com as the canonical redirect URI in production
  // to match the single URI registered in Google Cloud Console
  let baseUrl: string;
  if (reqHost && reqHost.includes('localhost')) {
    baseUrl = `http://${reqHost}`;
  } else {
    // Force canonical www domain for all production deployments
    baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.mostlyon.com';
    // Ensure www prefix
    if (baseUrl === 'https://mostlyon.com') {
      baseUrl = 'https://www.mostlyon.com';
    }
  }

  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/auth/google/callback`;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('CRITICAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set in process.env!');
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
