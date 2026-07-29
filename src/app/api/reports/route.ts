import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reports = await prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: '보고서 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
