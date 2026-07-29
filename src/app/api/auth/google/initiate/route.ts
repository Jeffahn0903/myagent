import { NextResponse } from 'next/server';
import { getGoogleOAuth2Client, GOOGLE_SCOPES } from '@/lib/google';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  const state = userId || 'sso';

  const oAuth2Client = getGoogleOAuth2Client();

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent', // Always show account picker & consent
    scope: GOOGLE_SCOPES,
    state,
  });

  return NextResponse.redirect(url);
}
