import { NextResponse } from 'next/server';
import { getGoogleOAuth2Client, GOOGLE_LOGIN_SCOPES, GOOGLE_FULL_SCOPES } from '@/lib/google';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isFullScope = searchParams.get('scope') === 'full';

  const userId = getUserIdFromRequest(request);
  const state = userId || 'sso';

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'mostlyon.com';

  const oAuth2Client = getGoogleOAuth2Client(host);

  const scopeToUse = (isFullScope || userId) ? GOOGLE_FULL_SCOPES : GOOGLE_LOGIN_SCOPES;

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent',
    scope: scopeToUse,
    state,
  });

  return NextResponse.redirect(url);
}
