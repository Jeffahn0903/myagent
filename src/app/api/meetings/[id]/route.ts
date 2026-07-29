import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(request);

    const room = await prisma.meetingRoom.findUnique({
      where: { id },
      include: {
        project: true,
        host: {
          select: { id: true, name: true, email: true },
        },
        attendees: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: '존재하지 않거나 삭제된 회의실입니다.' }, { status: 404 });
    }

    // Permission Verification (Google Drive style: PUBLIC vs RESTRICTED)
    if (room.accessType === 'RESTRICTED') {
      let userEmail = '';
      if (userId) {
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (currentUser) userEmail = currentUser.email;
      }

      // Check header or query parameter for guest email check
      const { searchParams } = new URL(request.url);
      const guestEmail = searchParams.get('email') || userEmail;

      const isHost = userId === room.hostId || (userEmail && userEmail === room.host.email);
      const allowedList = (room.allowedEmails || '').split(',').map((e) => e.trim().toLowerCase());
      const isAllowed = guestEmail && allowedList.includes(guestEmail.toLowerCase());

      if (!isHost && !isAllowed) {
        return NextResponse.json(
          {
            error: '접근 권한이 제한된 회의실입니다. 방장의 이메일 초대 링크로 입장해야 합니다.',
            isRestricted: true,
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(room);
  } catch (error: any) {
    console.error('Error fetching meeting room details:', error);
    return NextResponse.json({ error: '회의실 상세 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, accessType, allowedEmails } = body;

    const room = await prisma.meetingRoom.findUnique({ where: { id } });
    if (!room || room.hostId !== userId) {
      return NextResponse.json({ error: '권한이 없거나 존재하지 않는 회의실입니다.' }, { status: 403 });
    }

    const updated = await prisma.meetingRoom.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(accessType ? { accessType } : {}),
        ...(allowedEmails !== undefined ? { allowedEmails } : {}),
      },
    });

    return NextResponse.json({ success: true, room: updated });
  } catch (error: any) {
    console.error('Error updating meeting room:', error);
    return NextResponse.json({ error: '회의실 정보 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const room = await prisma.meetingRoom.findUnique({ where: { id } });

    if (!room || room.hostId !== userId) {
      return NextResponse.json({ error: '회의실을 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    await prisma.meetingRoom.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting meeting room:', error);
    return NextResponse.json({ error: '회의실 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
