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

    // 1. Create Schedules in DB safely
    const createdSchedules: Array<{ id: string; title: string; startTime: string }> = [];
    let createdScheduleCount = 0;
    if (Array.isArray(schedules) && schedules.length > 0) {
      for (const s of schedules) {
        if (!s.title) continue;

        let start = new Date();
        if (s.startTime) {
          const parsed = new Date(s.startTime);
          if (!isNaN(parsed.getTime())) start = parsed;
        }

        let end = new Date(start.getTime() + 3600000);
        if (s.endTime) {
          const parsed = new Date(s.endTime);
          if (!isNaN(parsed.getTime())) end = parsed;
        }

        try {
          const newSch = await prisma.schedule.create({
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
          createdSchedules.push({ id: newSch.id, title: newSch.title, startTime: start.toISOString() });
          createdScheduleCount++;
        } catch (schErr) {
          console.error('Schedule creation error:', schErr);
        }
      }
    }

    // 2. Create Tasks in DB safely
    const createdTasks: Array<{ id: string; title: string; dueDate?: string }> = [];
    let createdTaskCount = 0;
    if (Array.isArray(tasks) && tasks.length > 0) {
      for (const t of tasks) {
        if (!t.title) continue;

        let due: Date | undefined = undefined;
        if (t.dueDate) {
          const parsed = new Date(t.dueDate);
          if (!isNaN(parsed.getTime())) due = parsed;
        }

        try {
          const newTsk = await prisma.task.create({
            data: {
              title: `[회의 후속] ${t.title}`,
              isCompleted: false,
              dueDate: due,
              userId: userId,
              projectId: room.projectId || undefined,
            },
          });
          createdTasks.push({ id: newTsk.id, title: newTsk.title, dueDate: t.dueDate });
          createdTaskCount++;
        } catch (tskErr) {
          console.error('Task creation error:', tskErr);
        }
      }
    }

    // 3. PERSIST HISTORY IN DB
    let versionNumber = 1;
    try {
      const existingHistoriesCount = await prisma.meetingSummaryHistory.count({
        where: { meetingRoomId: id },
      });
      versionNumber = existingHistoriesCount + 1;

      await prisma.meetingSummaryHistory.create({
        data: {
          meetingRoomId: id,
          title: room.title,
          summaryMarkdown: summaryMarkdown || '회의 요약 작성 완료',
          schedulesJson: JSON.stringify(createdSchedules),
          tasksJson: JSON.stringify(createdTasks),
          version: versionNumber,
        },
      });
    } catch (histErr) {
      console.error('History persistence error:', histErr);
    }

    // 4. Post System AI Chat Message into Meeting Room
    try {
      const systemNotice = `🤖 [AI 회의록 확정 알림 - v${versionNumber}]\n회의록 및 요약 작성이 완료되었습니다.\n- 🗓️ 후속 일정: ${createdScheduleCount}건 등록\n- ✅ 후속 타스크: ${createdTaskCount}건 등록`;

      await prisma.chatMessage.create({
        data: {
          meetingRoomId: id,
          senderName: 'Gemini AI 회의 기록관',
          senderEmail: 'ai-agent@mostlyon.com',
          text: systemNotice,
        },
      });
    } catch (msgErr) {
      console.error('Chat notice error:', msgErr);
    }

    try {
      await logActivity({
        userId,
        action: 'UPDATE',
        entityType: 'SCHEDULE',
        title: `[회의록 확정 v${versionNumber}] ${room.title}`,
        details: `일정 ${createdScheduleCount}건, 타스크 ${createdTaskCount}건 일괄 생성 완료`,
        targetUrl: `/dashboard/meetings/${id}`,
      });
    } catch (logErr) {}

    return NextResponse.json({
      success: true,
      createdScheduleCount,
      createdTaskCount,
      version: versionNumber,
    });
  } catch (error: any) {
    console.error('Error finalizing meeting minutes:', error);
    return NextResponse.json({ error: error?.message || '회의록 확정 및 일괄 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
