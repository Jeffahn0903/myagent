import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { getAuthenticatedGoogleClient } from '@/lib/google';
import { logActivity } from '@/lib/activity';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/schedules/[id]/files - Get attached files for a schedule
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const files = await prisma.projectFile.findMany({
      where: { scheduleId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(files);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch schedule files' }, { status: 500 });
  }
}

// POST /api/schedules/[id]/files - Upload file, upload to Google Drive & save to DB
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id, userId },
      include: { project: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const filename = file.name;
    const mimeType = file.type || 'application/octet-stream';
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Save local file to /public/uploads
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const localFilePath = path.join(uploadsDir, safeFilename);
    fs.writeFileSync(localFilePath, buffer);
    let fileUrl = `/uploads/${safeFilename}`;
    let driveFileId: string | null = null;

    // 2. Upload to Google Drive if Google account is connected
    try {
      const authClient = await getAuthenticatedGoogleClient(userId);
      const drive = google.drive({ version: 'v3', auth: authClient });

      const requestBody: any = {
        name: filename,
        mimeType,
      };

      // If schedule belongs to a project with Google Drive folder ID, upload into that folder!
      if (schedule.project?.driveFolderId) {
        requestBody.parents = [schedule.project.driveFolderId];
      }

      const driveRes = await drive.files.create({
        requestBody,
        media: {
          mimeType,
          body: Readable.from(buffer),
        },
        fields: 'id, webViewLink, webContentLink',
      });

      if (driveRes.data.id) {
        driveFileId = driveRes.data.id;
        fileUrl = driveRes.data.webViewLink || fileUrl;

        // Set permission to anyone with link (or user)
        try {
          await drive.permissions.create({
            fileId: driveFileId,
            requestBody: { role: 'reader', type: 'anyone' },
          });
        } catch (e) {}
      }
    } catch (gErr: any) {
      console.warn('Google Drive upload warning (using local fallback):', gErr?.message);
    }

    // 3. Create ProjectFile record (linked to Schedule & Project)
    const newFile = await prisma.projectFile.create({
      data: {
        filename,
        fileUrl,
        driveFileId,
        mimeType,
        scheduleId: id,
        projectId: schedule.projectId || null,
      },
    });

    // 4. Log Activity
    await logActivity({
      userId,
      action: 'CREATE',
      entityType: 'FILE',
      title: `회의록 첨부파일 등록: "${filename}"`,
      details: driveFileId ? 'Google Drive 저장 완료' : '로컬 파일 저장 완료',
      targetUrl: `/dashboard/schedules/${id}`,
    });

    return NextResponse.json(newFile, { status: 201 });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: '파일 업로드 실패', details: error?.message },
      { status: 500 }
    );
  }
}
