import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? 'file:./dev.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  let adapterResult = 'not tested';
  let prismaResult = 'not tested';

  // Test 1: Create adapter
  try {
    const { PrismaLibSql } = await import('@prisma/adapter-libsql');
    const adapter = new PrismaLibSql({ url, authToken });
    adapterResult = `OK - provider: ${adapter.provider}`;

    // Test 2: Create PrismaClient and run query
    try {
      const { PrismaClient } = await import('@prisma/client');
      const client = new PrismaClient({ adapter });
      const count = await client.user.count();
      prismaResult = `OK - user count: ${count}`;
      await client.$disconnect();
    } catch (e: any) {
      prismaResult = `ERROR: ${e.message}`;
    }
  } catch (e: any) {
    adapterResult = `ERROR: ${e.message}`;
  }

  return NextResponse.json({
    url: url ? url.slice(0, 30) + '...' : 'MISSING',
    authToken: authToken ? `SET (len: ${authToken.length})` : 'MISSING',
    adapterResult,
    prismaResult,
    NODE_ENV: process.env.NODE_ENV,
  });
}
