import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { google } from 'googleapis';
import { getAuthenticatedGoogleClient } from '@/lib/google';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/schedules/[id]/tasks - Get tasks linked to a specific schedule
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tasks = await prisma.task.findMany({
      where: { userId, scheduleId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch schedule tasks' }, { status: 500 });
  }
}

// POST /api/schedules/[id]/tasks - Add a task linked to this schedule and its project, plus sync with Google Tasks
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, dueDate } = await request.json();
    if (!title) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    // Retrieve schedule to check if it belongs to a project
    const schedule = await prisma.schedule.findFirst({
      where: { id, userId },
      select: { projectId: true },
    });

    // Google Tasks Real-time Integration
    let googleTaskId = null;
    try {
      const auth = await getAuthenticatedGoogleClient(userId);
      if (auth) {
        const tasksService = google.tasks({ version: 'v1', auth });
        const googleTaskRes = await tasksService.tasks.insert({
          tasklist: '@default',
          requestBody: {
            title: title,
            due: dueDate ? new Date(dueDate).toISOString() : undefined,
            status: 'needsAction',
          },
        });
        if (googleTaskRes.data.id) {
          googleTaskId = googleTaskRes.data.id;
        }
      }
    } catch (googleError: any) {
      console.warn('Failed to sync to Google Tasks during schedule task creation:', googleError?.message);
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
        userId,
        scheduleId: id,
        projectId: schedule?.projectId || null,
        googleTaskId,
        isCompleted: false,
      },
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create task for schedule' }, { status: 500 });
  }
}
