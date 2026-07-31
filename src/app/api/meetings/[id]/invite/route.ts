import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(
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
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: '초대할 이메일을 입력해 주세요.' }, { status: 400 });
    }

    const room = await prisma.meetingRoom.findUnique({ where: { id } });
    if (!room) {
      return NextResponse.json({ error: '존재하지 않는 회의실입니다.' }, { status: 404 });
    }

    // Append to allowedEmails
    const currentEmails = (room.allowedEmails || '').split(',').map((e) => e.trim()).filter(Boolean);
    if (!currentEmails.includes(email.trim())) {
      currentEmails.push(email.trim());
    }

    const updated = await prisma.meetingRoom.update({
      where: { id },
      data: {
        allowedEmails: currentEmails.join(', '),
      },
    });

    // Create attendee entry if not existing
    const existingAttendee = await prisma.meetingAttendee.findFirst({
      where: { meetingRoomId: id, email: email.trim() },
    });

    if (!existingAttendee) {
      await prisma.meetingAttendee.create({
        data: {
          meetingRoomId: id,
          name: email.split('@')[0],
          email: email.trim(),
          role: 'ATTENDEE',
        },
      });
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    return NextResponse.json({
      success: true,
      allowedEmails: updated.allowedEmails,
      inviteLink: `${baseUrl}/meetings/${id}?email=${encodeURIComponent(email)}`,
    });
  } catch (error: any) {
    console.error('Error inviting email to meeting:', error);
    return NextResponse.json({ error: '초대 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
