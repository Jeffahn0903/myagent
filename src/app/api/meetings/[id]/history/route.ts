import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let historyList = await prisma.meetingSummaryHistory.findMany({
      where: { meetingRoomId: id },
      orderBy: { version: 'desc' },
    });

    // Fallback: If no records in MeetingSummaryHistory, extract from AI system chat messages!
    if (historyList.length === 0) {
      const room = await prisma.meetingRoom.findUnique({ where: { id } });
      const systemMsgs = await prisma.chatMessage.findMany({
        where: {
          meetingRoomId: id,
          senderName: 'Gemini AI 회의 기록관',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (systemMsgs.length > 0) {
        historyList = systemMsgs.map((m, idx) => ({
          id: m.id,
          meetingRoomId: id,
          title: room?.title || 'AI 회의 요약 내역',
          summaryMarkdown: m.text,
          schedulesJson: '[]',
          tasksJson: '[]',
          version: systemMsgs.length - idx,
          createdAt: m.createdAt,
        }));
      }
    }

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
