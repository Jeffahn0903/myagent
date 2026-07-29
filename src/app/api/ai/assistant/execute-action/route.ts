import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, data } = await request.json();
    if (!action || !data) {
      return NextResponse.json({ error: 'Action and data are required' }, { status: 400 });
    }

    if (action === 'CREATE_SCHEDULE' && data.title) {
      const start = data.startTime ? new Date(data.startTime) : new Date(Date.now() + 86400000);
      const end = data.endTime ? new Date(data.endTime) : new Date(start.getTime() + 3600000);

      const created = await prisma.schedule.create({
        data: {
          title: data.title,
          startTime: isNaN(start.getTime()) ? new Date() : start,
          endTime: isNaN(end.getTime()) ? new Date(start.getTime() + 3600000) : end,
          location: data.location || null,
          content: data.content || null,
          projectId: data.projectId || null,
          userId,
        },
      });

      await logActivity({
        userId,
        action: 'CREATE',
        entityType: 'SCHEDULE',
        title: `AI 일정 생성: "${created.title}"`,
        details: `Gemini AI 확인을 통해 신규 일정이 생성되었습니다.`,
        targetUrl: `/dashboard/schedules/${created.id}`,
      });

      return NextResponse.json({
        success: true,
        message: `🗓️ 일정 "${created.title}"이(가) 성공적으로 생성되었습니다!`,
        entity: created,
      });
    }

    if (action === 'CREATE_TASK' && data.title) {
      const due = data.dueDate ? new Date(data.dueDate) : null;
      const created = await prisma.task.create({
        data: {
          title: data.title,
          dueDate: due && !isNaN(due.getTime()) ? due : null,
          projectId: data.projectId || null,
          userId,
        },
      });

      await logActivity({
        userId,
        action: 'CREATE',
        entityType: 'TASK',
        title: `AI 타스크 생성: "${created.title}"`,
        details: `Gemini AI 확인을 통해 신규 타스크가 생성되었습니다.`,
        targetUrl: `/dashboard/tasks`,
      });

      return NextResponse.json({
        success: true,
        message: `🎯 타스크 "${created.title}"이(가) 성공적으로 추가되었습니다!`,
        entity: created,
      });
    }

    if (action === 'CREATE_PROJECT' && data.name) {
      const created = await prisma.project.create({
        data: {
          name: data.name,
          description: data.description || null,
          userId,
        },
      });

      await logActivity({
        userId,
        action: 'CREATE',
        entityType: 'PROJECT',
        title: `AI 프로젝트 생성: "${created.name}"`,
        details: `Gemini AI 확인을 통해 신규 프로젝트가 생성되었습니다.`,
        targetUrl: `/dashboard/projects/${created.id}`,
      });

      return NextResponse.json({
        success: true,
        message: `📁 프로젝트 "${created.name}"이(가) 성공적으로 생성되었습니다!`,
        entity: created,
      });
    }

    return NextResponse.json({ error: 'Unsupported action type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error executing proposed action:', error);
    return NextResponse.json({ error: 'Action execution failed', details: error?.message }, { status: 500 });
  }
}
