import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { google } from 'googleapis';
import { getAuthenticatedGoogleClient } from '@/lib/google';

// GET /api/projects - Get all projects for the logged-in user
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // Sync all existing tasks project ID if they don't have one but are linked to a schedule
    try {
      const untrackedTasks = await prisma.task.findMany({
        where: { userId, projectId: null, scheduleId: { not: null } },
        include: { schedule: true },
      });
      for (const t of untrackedTasks) {
        if (t.schedule && t.schedule.projectId) {
          await prisma.task.update({
            where: { id: t.id },
            data: { projectId: t.schedule.projectId },
          });
        }
      }
    } catch (err) {
      console.error('Error syncing existing task project IDs:', err);
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            schedules: true,
            tasks: true,
            notes: true,
            files: true,
          },
        },
        files: true,
        schedules: {
          include: { files: true },
        },
        tasks: {
          select: { isCompleted: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = projects.map((p) => {
      const directFiles = p.files || [];
      const scheduleFiles = p.schedules.flatMap((s) => s.files || []);
      const allFiles = Array.from(new Map([...directFiles, ...scheduleFiles].map((f) => [f.id, f])).values());
      const hasNewFiles = allFiles.some((f) => !f.isRead && new Date(f.createdAt) >= twelveHoursAgo);

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        driveFolderId: p.driveFolderId,
        startDate: p.startDate,
        endDate: p.endDate,
        createdAt: p.createdAt,
        _count: {
          ...p._count,
          files: allFiles.length,
        },
        totalFileCount: allFiles.length,
        hasNewFiles,
        tasks: p.tasks,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project and Google Drive Folder
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, startDate, endDate } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    let driveFolderId: string | null = null;

    // Create Google Drive Folder if Google OAuth is connected
    try {
      const authClient = await getAuthenticatedGoogleClient(userId);
      const drive = google.drive({ version: 'v3', auth: authClient });

      const folderResponse = await drive.files.create({
        requestBody: {
          name: `[Project] ${name.trim()}`,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, webViewLink',
      });

      if (folderResponse.data.id) {
        driveFolderId = folderResponse.data.id;
      }
    } catch (e) {
      console.warn('Google Drive project folder creation skipped or failed:', e);
    }

    const newProject = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        driveFolderId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId,
      },
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error: any) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred', details: error?.message },
      { status: 500 }
    );
  }
}
