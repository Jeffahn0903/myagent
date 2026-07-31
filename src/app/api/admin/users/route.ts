import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        googleAccessToken: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            projects: true,
            schedules: true,
            tasks: true,
            projectBudgets: true,
          },
        },
      },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      hasGoogleAuth: !!u.googleAccessToken,
      createdAt: u.createdAt,
      stats: {
        projectsCount: u._count.projects,
        schedulesCount: u._count.schedules,
        tasksCount: u._count.tasks,
        budgetsCount: u._count.projectBudgets,
      },
    }));

    return NextResponse.json({
      totalUsers: formatted.length,
      users: formatted,
    });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ error: '회원 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
