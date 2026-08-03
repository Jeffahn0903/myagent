import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export const runtime = 'nodejs';

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL ?? '';
  const authToken = process.env.TURSO_AUTH_TOKEN ?? '';

  let result = '';

  try {
    const client = createClient({ url, authToken });
    const r = await client.execute('SELECT 1 as ok');
    result = `SUCCESS: ${JSON.stringify(r.rows[0])}`;
    client.close();
  } catch (e: any) {
    result = `FAIL: ${e.message} | stack: ${e.stack?.slice(0, 200)}`;
  }

  return NextResponse.json({
    url: url ? url.slice(0, 50) : 'MISSING',
    authTokenFirst20: authToken ? authToken.slice(0, 20) : 'MISSING',
    authTokenLast10: authToken ? authToken.slice(-10) : 'MISSING',
    authTokenLen: authToken.length,
    result,
  });
}
