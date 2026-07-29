import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { getAuthenticatedGoogleClient } from '@/lib/google';
import { logActivity } from '@/lib/activity';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string; fileId: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id, fileId } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const file = await prisma.projectFile.findFirst({
      where: { id: fileId, scheduleId: id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Try deleting from Google Drive if driveFileId exists
    if (file.driveFileId) {
      try {
        const authClient = await getAuthenticatedGoogleClient(userId);
        const drive = google.drive({ version: 'v3', auth: authClient });
        await drive.files.delete({ fileId: file.driveFileId });
      } catch (gErr) {
        console.warn('Google Drive delete warning:', gErr);
      }
    }

    // Delete local file if present
    if (file.fileUrl && file.fileUrl.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', file.fileUrl);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }

    await prisma.projectFile.delete({
      where: { id: fileId },
    });

    await logActivity({
      userId,
      action: 'DELETE',
      entityType: 'FILE',
      title: `회의록 첨부파일 삭제: "${file.filename}"`,
      targetUrl: `/dashboard/schedules/${id}`,
    });

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting schedule file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
