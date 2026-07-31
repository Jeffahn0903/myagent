import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const historyList = await prisma.meetingSummaryHistory.findMany({
      where: { meetingRoomId: id },
      orderBy: { version: 'desc' },
    });

    const formatted = historyList.map((h) => {
      let schedules: any[] = [];
      let tasks: any[] = [];
      try {
        if (h.schedulesJson) schedules = JSON.parse(h.schedulesJson);
      } catch (e) {}
      try {
        if (h.tasksJson) tasks = JSON.parse(h.tasksJson);
      } catch (e) {}

      return {
        ...h,
        schedules,
        tasks,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching meeting history:', error);
    return NextResponse.json({ error: '회의록 히스토리를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
