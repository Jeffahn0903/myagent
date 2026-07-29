import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { google } from 'googleapis';
import { getAuthenticatedGoogleClient } from '@/lib/google';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get project details with schedules, tasks, notes, files
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Sync existing tasks that are linked to a schedule in this project but have null projectId
    try {
      const unsyncedTasks = await prisma.task.findMany({
        where: {
          userId,
          projectId: null,
          schedule: {
            projectId: id,
          },
        },
      });

      for (const t of unsyncedTasks) {
        await prisma.task.update({
          where: { id: t.id },
          data: { projectId: id },
        });
      }
    } catch (err) {
      console.error('Error syncing project detail task project IDs:', err);
    }

    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        schedules: {
          include: { customer: true, tasks: true },
          orderBy: { startTime: 'desc' },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        files: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error(`Error fetching project ${id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PUT /api/projects/[id] - Update project info (including Google Drive folder renaming)
export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, status, driveFolderId, startDate, endDate } = await request.json();

    const existingProject = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let finalDriveFolderId = driveFolderId !== undefined ? driveFolderId : existingProject.driveFolderId;

    // Handle Google Drive folder renaming or creation
    if (name && name.trim() && name.trim() !== existingProject.name) {
      if (existingProject.driveFolderId) {
        // Scenario A: Existing folder ID exists -> RENAME the folder in Google Drive
        try {
          const authClient = await getAuthenticatedGoogleClient(userId);
          const drive = google.drive({ version: 'v3', auth: authClient });

          await drive.files.update({
            fileId: existingProject.driveFolderId,
            requestBody: {
              name: `[Project] ${name.trim()}`,
            },
          });
          console.log(`Successfully renamed Google Drive folder to: [Project] ${name.trim()}`);
        } catch (e) {
          console.warn('Google Drive folder renaming failed or skipped:', e);
        }
      } else if (!finalDriveFolderId) {
        // Scenario B: No folder ID exists -> CREATE new folder in Google Drive
        try {
          const authClient = await getAuthenticatedGoogleClient(userId);
          const drive = google.drive({ version: 'v3', auth: authClient });

          const folderResponse = await drive.files.create({
            requestBody: {
              name: `[Project] ${name.trim()}`,
              mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
          });

          if (folderResponse.data.id) {
            finalDriveFolderId = folderResponse.data.id;
            console.log(`Created new Google Drive folder for renamed project: ${finalDriveFolderId}`);
          }
        } catch (e) {
          console.warn('Google Drive folder auto-creation on rename skipped or failed:', e);
        }
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        driveFolderId: finalDriveFolderId,
      },
    });

    await logActivity({
      userId,
      action: 'UPDATE',
      entityType: 'PROJECT',
      title: `프로젝트 수정: ${updated.name}`,
      details: description || undefined,
      targetUrl: `/dashboard/projects/${updated.id}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Error updating project ${id}:`, error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.project.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting project ${id}:`, error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
