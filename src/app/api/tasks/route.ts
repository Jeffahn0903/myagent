import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { google } from 'googleapis';
import { getAuthenticatedGoogleClient } from '@/lib/google';

// GET /api/tasks - Get all tasks for the logged-in user with linked schedule info and project info
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      where: { userId },
      include: {
        schedule: {
          select: { id: true, title: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task and associate project ID directly or via schedule
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, dueDate, scheduleId, projectId } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Determine parent project ID
    let finalProjectId = projectId || null;
    if (scheduleId) {
      const schedule = await prisma.schedule.findFirst({
        where: { id: scheduleId, userId },
        select: { projectId: true },
      });
      if (schedule && schedule.projectId) {
        finalProjectId = schedule.projectId;
      }
    }

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
      console.warn('Failed to sync to Google Tasks during task creation:', googleError?.message);
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
        scheduleId: scheduleId || null,
        projectId: finalProjectId,
        googleTaskId,
        userId,
      },
      include: {
        schedule: {
          select: { id: true, title: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
}
