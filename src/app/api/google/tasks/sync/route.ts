import { NextResponse } from 'next/server';
import { getAuthenticatedGoogleClient } from '@/lib/google';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const tasksService = google.tasks({ version: 'v1', auth });

    const response = await tasksService.tasks.list({
      tasklist: '@default',
      showCompleted: true,
      showHidden: true,
    });

    const googleTasks = response.data.items || [];
    let syncedCount = 0;

    for (const item of googleTasks) {
      if (!item.title) continue;

      const title = item.title;
      const isCompleted = item.status === 'completed';
      const dueDate = item.due ? new Date(item.due) : null;

      const existing = await prisma.task.findFirst({
        where: {
          userId,
          title,
        },
      });

      if (!existing) {
        await prisma.task.create({
          data: {
            title,
            isCompleted,
            dueDate,
            userId,
          },
        });
        syncedCount++;
      } else {
        await prisma.task.update({
          where: { id: existing.id },
          data: {
            isCompleted,
            dueDate,
          },
        });
      }
    }

    return NextResponse.json({
      message: `Successfully synced ${syncedCount} new tasks from Google Tasks`,
      totalFetched: googleTasks.length,
      syncedCount,
    });
  } catch (error: any) {
    console.error('Google Tasks Sync error:', error?.message);
    return NextResponse.json(
      { error: 'Failed to sync Google Tasks', details: error?.message },
      { status: 500 }
    );
  }
}
