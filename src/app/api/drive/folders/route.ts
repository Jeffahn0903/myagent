import { NextResponse } from 'next/server';
import { getAuthenticatedGoogleClient } from '@/lib/google';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';

// POST /api/drive/folders - Create a new folder in Google Drive and optionally link to a project
export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, projectId } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const auth = await getAuthenticatedGoogleClient(userId);
    if (!auth) {
      return NextResponse.json({ error: 'Google Account not connected' }, { status: 400 });
    }

    const drive = google.drive({ version: 'v3', auth });
    
    // Create folder in Google Drive
    const res = await drive.files.create({
      requestBody: {
        name: name.trim(),
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id, name, webViewLink',
    });

    const folderId = res.data.id;
    if (!folderId) {
      throw new Error('Failed to create folder in Google Drive');
    }

    // Optionally link to project
    if (projectId) {
      await prisma.project.update({
        where: { id: projectId, userId },
        data: { driveFolderId: folderId },
      });
    }

    return NextResponse.json({
      id: folderId,
      name: res.data.name,
      webViewLink: res.data.webViewLink,
      projectId: projectId || null,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create folder:', error);
    return NextResponse.json({ error: 'Failed to create folder', details: error?.message }, { status: 500 });
  }
}

// PUT /api/drive/folders - Link an existing Google Drive folder to a project (or unlink)
export async function PUT(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { folderId, projectId } = await request.json();

    if (!projectId) {
      // Unlink folder from project
      const project = await prisma.project.findFirst({
        where: { driveFolderId: folderId, userId },
      });
      if (project) {
        await prisma.project.update({
          where: { id: project.id },
          data: { driveFolderId: null },
        });
      }
      return NextResponse.json({ success: true, message: 'Unlinked successfully' });
    }

    // Link project to driveFolderId
    await prisma.project.update({
      where: { id: projectId, userId },
      data: { driveFolderId: folderId },
    });

    return NextResponse.json({ success: true, message: 'Linked successfully' });
  } catch (error: any) {
    console.error('Failed to link folder:', error);
    return NextResponse.json({ error: 'Failed to link folder', details: error?.message }, { status: 500 });
  }
}
