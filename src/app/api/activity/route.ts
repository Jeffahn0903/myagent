import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let logs = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // If no explicit log entries exist yet, dynamically synthesize activity log from existing items
    if (logs.length === 0) {
      const [schedules, projects, tasks, customers] = await Promise.all([
        prisma.schedule.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.project.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.customer.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      ]);

      const synthetic: any[] = [];

      schedules.forEach((s) => {
        synthetic.push({
          id: `synth-sched-${s.id}`,
          action: 'CREATE',
          entityType: 'SCHEDULE',
          title: `일정 생성: "${s.title}"`,
          details: `장소: ${s.location || '미지정'} / 일시: ${new Date(s.startTime).toLocaleString()}`,
          targetUrl: `/dashboard/schedules/${s.id}`,
          createdAt: s.createdAt,
        });
      });

      projects.forEach((p) => {
        synthetic.push({
          id: `synth-proj-${p.id}`,
          action: 'CREATE',
          entityType: 'PROJECT',
          title: `프로젝트 생성: "${p.name}"`,
          details: `상태: ${p.status} / ${p.description || ''}`,
          targetUrl: `/dashboard/projects/${p.id}`,
          createdAt: p.createdAt,
        });
      });

      tasks.forEach((t) => {
        synthetic.push({
          id: `synth-task-${t.id}`,
          action: t.isCompleted ? 'UPDATE' : 'CREATE',
          entityType: 'TASK',
          title: t.isCompleted ? `타스크 완료 처리: "${t.title}"` : `신규 타스크 추가: "${t.title}"`,
          details: t.dueDate ? `마감일: ${new Date(t.dueDate).toLocaleDateString()}` : '마감일 미정',
          targetUrl: '/dashboard/tasks',
          createdAt: t.updatedAt || t.createdAt,
        });
      });

      customers.forEach((c) => {
        synthetic.push({
          id: `synth-cust-${c.id}`,
          action: 'CREATE',
          entityType: 'CUSTOMER',
          title: `고객 정보 등록: "${c.name}"`,
          details: `회사: ${c.company || '미등록'} / 이메일: ${c.email || '없음'}`,
          targetUrl: '/dashboard/customers',
          createdAt: c.createdAt,
        });
      });

      // Sort synthetic logs by newest first
      synthetic.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      logs = synthetic;
    }

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: '변경 이력을 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
