import { NextResponse } from 'next/server';
import { getGoogleOAuth2Client, GOOGLE_SCOPES } from '@/lib/google';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  const state = userId || 'sso';

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : undefined;

  const oAuth2Client = getGoogleOAuth2Client(origin);

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent',
    scope: GOOGLE_SCOPES,
    state,
  });

  return NextResponse.redirect(url);
}
