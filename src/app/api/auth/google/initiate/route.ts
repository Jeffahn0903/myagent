import { NextResponse } from 'next/server';
import { getGoogleOAuth2Client, GOOGLE_LOGIN_SCOPES, GOOGLE_FULL_SCOPES } from '@/lib/google';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isFullScope = searchParams.get('scope') === 'full';

  const userId = getUserIdFromRequest(request);
  const state = userId || 'sso';

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : undefined;

  const oAuth2Client = getGoogleOAuth2Client(origin);

  // Use minimal login scope for public 1-click SSO (avoids Google unverified app warning)
  // Use full scope only when connecting Google Drive & Calendar in Settings
  const scopeToUse = (isFullScope || userId) ? GOOGLE_FULL_SCOPES : GOOGLE_LOGIN_SCOPES;

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent',
    scope: scopeToUse,
    state,
  });

  return NextResponse.redirect(url);
}
