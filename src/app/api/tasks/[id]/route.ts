import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { google } from 'googleapis';
import { getAuthenticatedGoogleClient } from '@/lib/google';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/tasks/[id] - Update a task (and sync to Google Tasks in real-time)
export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const { title, dueDate, scheduleId, projectId, isCompleted } = await request.json();

    // Determine parent project ID
    let finalProjectId = task.projectId;
    if (projectId !== undefined) {
      finalProjectId = projectId || null;
    }
    if (scheduleId !== undefined) {
      if (scheduleId) {
        const schedule = await prisma.schedule.findFirst({
          where: { id: scheduleId, userId },
          select: { projectId: true },
        });
        finalProjectId = schedule ? (schedule.projectId || finalProjectId) : null;
      } else {
        if (projectId === undefined) {
          finalProjectId = null;
        }
      }
    }

    let googleTaskId = task.googleTaskId;

    // Google Tasks Real-time sync
    try {
      const auth = await getAuthenticatedGoogleClient(userId);
      if (auth) {
        const tasksService = google.tasks({ version: 'v1', auth });

        const titleVal = title !== undefined ? title : task.title;
        const dueVal = dueDate !== undefined 
          ? (dueDate ? new Date(dueDate).toISOString() : null) 
          : (task.dueDate ? new Date(task.dueDate).toISOString() : null);
        const statusVal = isCompleted !== undefined 
          ? (isCompleted ? 'completed' : 'needsAction') 
          : (task.isCompleted ? 'completed' : 'needsAction');

        if (googleTaskId) {
          // Update existing Google Task
          await tasksService.tasks.patch({
            tasklist: '@default',
            task: googleTaskId,
            requestBody: {
              title: titleVal,
              due: dueVal || undefined,
              status: statusVal,
            },
          });
        } else {
          // If no Google Task linked yet, create one
          const googleTaskRes = await tasksService.tasks.insert({
            tasklist: '@default',
            requestBody: {
              title: titleVal,
              due: dueVal || undefined,
              status: statusVal,
            },
          });
          if (googleTaskRes.data.id) {
            googleTaskId = googleTaskRes.data.id;
          }
        }
      }
    } catch (googleError: any) {
      console.warn(`Failed to sync to Google Tasks for task update ${id}:`, googleError?.message);
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : task.title,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : task.dueDate,
        scheduleId: scheduleId !== undefined ? (scheduleId || null) : task.scheduleId,
        projectId: finalProjectId,
        googleTaskId,
        isCompleted: isCompleted !== undefined ? isCompleted : task.isCompleted,
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

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error(`Error updating task ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - Delete a task (and delete from Google Tasks in real-time)
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Google Tasks Real-time sync (delete)
    if (task.googleTaskId) {
      try {
        const auth = await getAuthenticatedGoogleClient(userId);
        if (auth) {
          const tasksService = google.tasks({ version: 'v1', auth });
          await tasksService.tasks.delete({
            tasklist: '@default',
            task: task.googleTaskId,
          });
        }
      } catch (googleError: any) {
        console.warn(`Failed to delete Google Task for task ${id}:`, googleError?.message);
      }
    }

    await prisma.task.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting task ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
