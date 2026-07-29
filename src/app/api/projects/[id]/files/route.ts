import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const files = await prisma.projectFile.findMany({
      where: {
        OR: [
          { projectId: id },
          { schedule: { projectId: id } },
        ],
      },
      include: { schedule: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(files);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { filename, fileUrl, driveFileId, mimeType } = await request.json();
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    const file = await prisma.projectFile.create({
      data: {
        filename,
        fileUrl: fileUrl || null,
        driveFileId: driveFileId || null,
        mimeType: mimeType || null,
        projectId: id,
      },
    });

    return NextResponse.json(file, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add file' }, { status: 500 });
  }
}
