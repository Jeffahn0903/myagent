import { NextResponse } from 'next/server';
import { getAuthenticatedGoogleClient } from '@/lib/google';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    // Scenario A: Request files inside a specific Google Drive folder
    if (folderId) {
      const auth = await getAuthenticatedGoogleClient(userId);
      if (!auth) {
        return NextResponse.json([]);
      }
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, webViewLink, iconLink, createdTime, size)',
        orderBy: 'folder, name',
      });

      const files = (res.data.files || []).map((gf: any) => ({
        id: gf.id,
        name: gf.name,
        isFolder: gf.mimeType === 'application/vnd.google-apps.folder',
        mimeType: gf.mimeType,
        webViewLink: gf.webViewLink,
        iconLink: gf.iconLink,
        createdAt: gf.createdTime,
        size: gf.size,
      }));
      return NextResponse.json(files);
    }

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // 1. Fetch User's Projects with files count and new files check
    const userProjects = await prisma.project.findMany({
      where: { userId },
      include: {
        files: true,
        schedules: {
          include: { files: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 2. Fetch User's Attached Files
    const userFiles = await prisma.projectFile.findMany({
      where: {
        OR: [
          { project: { userId } },
          { schedule: { userId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Format Project Folders with File Counts & New Flag (N badge)
    const projectFolderItems = userProjects.map((p) => {
      // Gather all files directly or via schedules
      const directFiles = p.files || [];
      const scheduleFiles = p.schedules.flatMap((s) => s.files || []);
      const allProjectFiles = [...directFiles, ...scheduleFiles];
      const uniqueFiles = Array.from(new Map(allProjectFiles.map((f) => [f.id, f])).values());

      const hasNewFiles = uniqueFiles.some((f) => !f.isRead && new Date(f.createdAt) >= twelveHoursAgo);

      return {
        id: `proj-${p.id}`,
        projectId: p.id,
        driveFolderId: p.driveFolderId,
        name: `[Project] ${p.name}`,
        isFolder: true,
        fileCount: uniqueFiles.length,
        hasNewFiles,
        webViewLink: `/dashboard/projects/${p.id}`,
      };
    });

    // Format Individual Files with File Read & New Status
    const formattedUserFiles = userFiles.map((f) => {
      const isNew = !f.isRead && new Date(f.createdAt) >= twelveHoursAgo;
      return {
        id: f.id,
        name: f.filename,
        isFolder: false,
        mimeType: f.mimeType,
        webViewLink: f.fileUrl,
        driveFileId: f.driveFileId,
        isRead: f.isRead,
        isNew,
        createdAt: f.createdAt,
      };
    });

    // 3. Optional: Fetch Google Drive Root Folders/Files if Google auth connected
    let googleDriveFiles: any[] = [];
    try {
      const auth = await getAuthenticatedGoogleClient(userId);
      if (auth) {
        const drive = google.drive({ version: 'v3', auth });
        const res = await drive.files.list({
          pageSize: 50,
          q: "trashed = false and 'root' in parents",
          fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink, createdTime)',
          orderBy: 'folder, name',
        });

        googleDriveFiles = (res.data.files || []).map((gf: any) => ({
          id: gf.id, // Keep exact id for navigating inside
          name: gf.name,
          isFolder: gf.mimeType === 'application/vnd.google-apps.folder',
          mimeType: gf.mimeType,
          webViewLink: gf.webViewLink,
          isRead: true,
          isNew: false,
          createdAt: gf.createdTime,
        }));
      }
    } catch (gErr) {
      console.error('Google drive files error:', gErr);
    }

    // Combine items (Projects folders first, then files)
    const combined = [...projectFolderItems, ...formattedUserFiles, ...googleDriveFiles];

    // Remove duplicates by name
    const uniqueCombined = Array.from(new Map(combined.map((item) => [item.name, item])).values());

    return NextResponse.json(uniqueCombined);
  } catch (error: any) {
    console.error('Drive files API error:', error?.message);
    return NextResponse.json(
      { error: 'Failed to access drive files', details: error?.message },
      { status: 500 }
    );
  }
}
