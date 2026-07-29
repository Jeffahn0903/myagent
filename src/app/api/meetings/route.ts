import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch meeting rooms hosted by user or invited
    const rooms = await prisma.meetingRoom.findMany({
      where: {
        OR: [
          { hostId: userId },
          { accessType: 'PUBLIC' },
          {
            allowedEmails: {
              contains: user.email,
            },
          },
        ],
      },
      include: {
        project: true,
        host: {
          select: { id: true, name: true, email: true },
        },
        attendees: true,
        _count: {
          select: { messages: true, attendees: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(rooms);
  } catch (error: any) {
    console.error('Error fetching meeting rooms:', error);
    return NextResponse.json({ error: '회의실 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, date, projectId, accessType, allowedEmails } = body;

    if (!title) {
      return NextResponse.json({ error: '회의실 제목을 입력해 주세요.' }, { status: 400 });
    }

    const meetingDate = date ? new Date(date) : new Date();

    const room = await prisma.meetingRoom.create({
      data: {
        title,
        description: description || '',
        date: meetingDate,
        accessType: accessType || 'PUBLIC',
        allowedEmails: allowedEmails || '',
        projectId: projectId || null,
        hostId: userId,
        attendees: {
          create: {
            name: user.name || '호스트',
            email: user.email,
            role: 'HOST',
          },
        },
      },
      include: {
        project: true,
        host: {
          select: { id: true, name: true, email: true },
        },
        attendees: true,
      },
    });

    await logActivity({
      userId,
      action: 'CREATE',
      entityType: 'SCHEDULE',
      title: `[온라인 회의실 개설] ${title}`,
      details: `공개설정: ${accessType === 'PUBLIC' ? '오픈 공개' : '이메일 초대전용'}, 일시: ${meetingDate.toLocaleString('ko-KR')}`,
      targetUrl: `/dashboard/meetings/${room.id}`,
    });

    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    console.error('Error creating meeting room:', error);
    return NextResponse.json({ error: '회의실 개설 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
