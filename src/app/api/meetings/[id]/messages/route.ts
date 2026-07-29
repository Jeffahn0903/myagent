import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import path from 'path';
import { mkdir } from 'fs/promises';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await prisma.chatMessage.findMany({
      where: { meetingRoomId: id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(messages);
  } catch (error: any) {
    return NextResponse.json({ error: '메시지를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(request);

    let senderName = '참석자';
    let senderEmail = 'guest@myagent.app';

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        senderName = user.name || '사용자';
        senderEmail = user.email;
      }
    }

    const room = await prisma.meetingRoom.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!room) {
      return NextResponse.json({ error: '존재하지 않는 회의실입니다.' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';

    let text = '';
    let fileUrl: string | undefined = undefined;
    let fileName: string | undefined = undefined;
    let mimeType: string | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      text = (formData.get('text') as string) || '';
      senderName = (formData.get('senderName') as string) || senderName;
      senderEmail = (formData.get('senderEmail') as string) || senderEmail;

      const file = formData.get('file') as File | null;
      if (file && file.name) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadsDir, { recursive: true });

        const safeFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = path.join(uploadsDir, safeFilename);

        await writeFile(filePath, buffer);

        fileUrl = `/uploads/${safeFilename}`;
        fileName = file.name;
        mimeType = file.type || 'application/octet-stream';
      }
    } else {
      const body = await request.json();
      text = body.text || '';
      senderName = body.senderName || senderName;
      senderEmail = body.senderEmail || senderEmail;
      fileUrl = body.fileUrl;
      fileName = body.fileName;
      mimeType = body.mimeType;
    }

    if (!text && !fileUrl) {
      return NextResponse.json({ error: '메시지 내용을 입력해 주세요.' }, { status: 400 });
    }

    // 1. Register ChatMessage
    const message = await prisma.chatMessage.create({
      data: {
        meetingRoomId: id,
        senderName,
        senderEmail,
        text,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        mimeType: mimeType || null,
      },
    });

    // 2. CRITICAL FEATURE: Auto-sync file to Project Repository!
    let projectFileSynced = false;
    if (fileUrl && fileName && room.projectId) {
      await prisma.projectFile.create({
        data: {
          filename: fileName,
          fileUrl: fileUrl,
          mimeType: mimeType || 'application/octet-stream',
          projectId: room.projectId,
        },
      });
      projectFileSynced = true;
    }

    // 3. Register or update attendee status
    const existingAttendee = await prisma.meetingAttendee.findFirst({
      where: { meetingRoomId: id, email: senderEmail },
    });

    if (!existingAttendee) {
      await prisma.meetingAttendee.create({
        data: {
          meetingRoomId: id,
          name: senderName,
          email: senderEmail,
          role: senderEmail === room.hostId ? 'HOST' : 'ATTENDEE',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message,
      projectFileSynced,
      projectName: room.project?.name || null,
    });
  } catch (error: any) {
    console.error('Error posting chat message:', error);
    return NextResponse.json({ error: '메시지 전송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
