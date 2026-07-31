import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

interface FinalizeSchedulePayload {
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

interface FinalizeTaskPayload {
  title: string;
  dueDate?: string;
  priority?: string;
}

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
    const { summaryMarkdown, schedules, tasks } = body as {
      summaryMarkdown: string;
      schedules: FinalizeSchedulePayload[];
      tasks: FinalizeTaskPayload[];
    };

    const room = await prisma.meetingRoom.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!room) {
      return NextResponse.json({ error: '존재하지 않는 회의실입니다.' }, { status: 404 });
    }

    // 1. Create Schedules in DB
    let createdScheduleCount = 0;
    if (Array.isArray(schedules) && schedules.length > 0) {
      for (const s of schedules) {
        if (!s.title) continue;
        const start = s.startTime ? new Date(s.startTime) : new Date();
        const end = s.endTime ? new Date(s.endTime) : new Date(start.getTime() + 3600000);

        await prisma.schedule.create({
          data: {
            title: `[회의 후속] ${s.title}`,
            content: `회의 [${room.title}]에서 자동 생성된 후속 일정입니다.`,
            startTime: start,
            endTime: end,
            location: s.location || '온라인 회의',
            userId: userId,
            projectId: room.projectId || undefined,
          },
        });
        createdScheduleCount++;
      }
    }

    // 2. Create Tasks in DB
    let createdTaskCount = 0;
    if (Array.isArray(tasks) && tasks.length > 0) {
      for (const t of tasks) {
        if (!t.title) continue;
        const due = t.dueDate ? new Date(t.dueDate) : undefined;

        await prisma.task.create({
          data: {
            title: `[회의 후속] ${t.title}`,
            isCompleted: false,
            dueDate: due,
            userId: userId,
            projectId: room.projectId || undefined,
          },
        });
        createdTaskCount++;
      }
    }

    // 3. Post System AI Chat Message into Meeting Room
    const systemNotice = `🤖 [AI 회의록 확정 알림]\n회의록 및 요약 작성이 완료되었습니다.\n- 🗓️ 후속 일정: ${createdScheduleCount}건 등록\n- ✅ 후속 타스크: ${createdTaskCount}건 등록`;

    await prisma.chatMessage.create({
      data: {
        meetingRoomId: id,
        senderName: 'Gemini AI 회의 기록관',
        senderEmail: 'ai-agent@myagent.app',
        text: systemNotice,
      },
    });

    await logActivity({
      userId,
      action: 'UPDATE',
      entityType: 'SCHEDULE',
      title: `[회의록 확정] ${room.title}`,
      details: `일정 ${createdScheduleCount}건, 타스크 ${createdTaskCount}건 일괄 생성 완료`,
      targetUrl: `/dashboard/meetings/${id}`,
    });

    return NextResponse.json({
      success: true,
      createdScheduleCount,
      createdTaskCount,
    });
  } catch (error: any) {
    console.error('Error finalizing meeting minutes:', error);
    return NextResponse.json({ error: '회의록 확정 및 일괄 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
