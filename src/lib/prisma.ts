import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more: https://pris.ly/d/help/next-js-best-practices

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function getPrismaClient(): PrismaClient {
  if (global.__prisma) return global.__prisma;

  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? 'file:./dev.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || url === 'undefined') {
    throw new Error(`TURSO_DATABASE_URL is not set. Got: "${url}"`);
  }

  const adapter = new PrismaLibSql({ url, authToken });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

  if (process.env.NODE_ENV !== 'production') {
    global.__prisma = client;
  }

  return client;
}

export const prisma = {
  get user() { return getPrismaClient().user; },
  get schedule() { return getPrismaClient().schedule; },
  get task() { return getPrismaClient().task; },
  get project() { return getPrismaClient().project; },
  get projectNote() { return getPrismaClient().projectNote; },
  get customer() { return getPrismaClient().customer; },
  get activityLog() { return getPrismaClient().activityLog; },
  get savedNews() { return getPrismaClient().savedNews; },
  get readNews() { return getPrismaClient().readNews; },
  get report() { return getPrismaClient().report; },
  get projectFile() { return getPrismaClient().projectFile; },
  get projectBudget() { return getPrismaClient().projectBudget; },
  get cashTransaction() { return getPrismaClient().cashTransaction; },
  get meetingRoom() { return getPrismaClient().meetingRoom; },
  get meetingAttendee() { return getPrismaClient().meetingAttendee; },
  get chatMessage() { return getPrismaClient().chatMessage; },
  get meetingSummaryHistory() { return getPrismaClient().meetingSummaryHistory; },
  $transaction: (...args: Parameters<PrismaClient['$transaction']>) => getPrismaClient().$transaction(...args as [any]),
  $disconnect: () => getPrismaClient().$disconnect(),
};
