import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const rawUrl = process.env.TURSO_DATABASE_URL ?? '';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // Convert libsql:// -> https:// for HTTP-mode connection
  const httpUrl = rawUrl.replace(/^libsql:\/\//, 'https://');

  let libsqlResult = 'not tested';
  let adapterResult = 'not tested';
  let prismaResult = 'not tested';

  // Test 1: direct libsql client with original URL
  try {
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: rawUrl, authToken });
    const r = await client.execute('SELECT 1 as ok');
    libsqlResult = `OK (libsql://) - ${JSON.stringify(r.rows[0])}`;
  } catch (e: any) {
    // Test with https://
    try {
      const { createClient } = await import('@libsql/client');
      const client = createClient({ url: httpUrl, authToken });
      const r = await client.execute('SELECT 1 as ok');
      libsqlResult = `OK (https://) - ${JSON.stringify(r.rows[0])}`;
    } catch (e2: any) {
      libsqlResult = `FAIL libsql: ${e.message} | FAIL https: ${e2.message}`;
    }
  }

  // Test 2: PrismaLibSql with https:// url
  try {
    const { PrismaLibSql } = await import('@prisma/adapter-libsql');
    const adapter = new PrismaLibSql({ url: httpUrl, authToken });
    adapterResult = `OK provider: ${adapter.provider}`;

    try {
      const { PrismaClient } = await import('@prisma/client');
      const client = new PrismaClient({ adapter });
      const count = await client.user.count();
      prismaResult = `OK count: ${count}`;
      await client.$disconnect();
    } catch (e: any) {
      prismaResult = `FAIL: ${e.message}`;
    }
  } catch (e: any) {
    adapterResult = `FAIL: ${e.message}`;
  }

  return NextResponse.json({
    rawUrl: rawUrl ? rawUrl.slice(0, 40) + '...' : 'MISSING',
    httpUrl: httpUrl ? httpUrl.slice(0, 40) + '...' : 'MISSING',
    authToken: authToken ? `len:${authToken.length}` : 'MISSING',
    libsqlResult,
    adapterResult,
    prismaResult,
  });
}
