import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Fetch user's data context for today
    const [schedulesToday, allTasks, activeProjects, recentActivities] = await Promise.all([
      prisma.schedule.findMany({
        where: {
          userId,
          startTime: { gte: startOfDay, lte: endOfDay },
        },
        include: { customer: true, project: true },
        orderBy: { startTime: 'asc' },
      }),
      prisma.task.findMany({
        where: { userId },
        include: { project: true, schedule: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.findMany({
        where: { userId, status: 'ACTIVE' },
        include: {
          tasks: true,
          schedules: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const completedTasksToday = allTasks.filter((t) => t.isCompleted);
    const pendingTasks = allTasks.filter((t) => !t.isCompleted);

    const scheduleSummary = schedulesToday.length > 0
      ? schedulesToday.map((s, idx) => `${idx + 1}. [${s.startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}] ${s.title}${s.customer ? ` (고객: ${s.customer.name})` : ''}${s.project ? ` (프로젝트: ${s.project.name})` : ''}`).join('\n')
      : '오늘 예정된 일정이 없습니다.';

    const completedSummary = completedTasksToday.length > 0
      ? completedTasksToday.slice(0, 5).map((t) => `- ✅ ${t.title}${t.project ? ` [${t.project.name}]` : ''}`).join('\n')
      : '- 오늘 완료 처리된 타스크가 없습니다.';

    const pendingSummary = pendingTasks.length > 0
      ? pendingTasks.slice(0, 5).map((t) => `- ⏳ ${t.title}${t.dueDate ? ` (마감: ${new Date(t.dueDate).toLocaleDateString()})` : ''}`).join('\n')
      : '- 미완료 진행 중 타스크가 없습니다.';

    const projectSummary = activeProjects.length > 0
      ? activeProjects.map((p) => `- 📁 **${p.name}**: 진행 중 타스크 ${p.tasks.filter(t => !t.isCompleted).length}개, 연동 일정 ${p.schedules.length}개`).join('\n')
      : '- 현재 진행 중인 프로젝트가 없습니다.';

    const prompt = `당신은 수석 비즈니스 컨설턴트 및 AI 경영 보좌관입니다.
사용자의 오늘 업무 이력과 프로젝트/일정 데이터를 분석하여 전문가 수준의 [일간 업무 진행 Executive 보고서]를 마크다운 형식으로 작성해 주세요.

[오늘의 업무 데이터 현황]:
- 날짜: ${now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
- 오늘 진행 일정 (${schedulesToday.length}건):
${scheduleSummary}

- 완료된 타스크 (${completedTasksToday.length}건):
${completedSummary}

- 진행 중 미완료 타스크 (${pendingTasks.length}건):
${pendingSummary}

- 진행 중인 핵심 프로젝트 (${activeProjects.length}개):
${projectSummary}

다음 4가지 섹션을 명확히 구분하여 가시성 높고 품격 있는 마크다운 보고서를 작성해 주세요:
1. 📊 **오늘의 업무 총평 & 종합 요약 (Executive Summary)**
   - 전체 업무 달성도 및 주요 활동 소회 요약
2. 🗓️ **오늘의 주요 일정 & 미팅 성과 (Schedules & Meetings)**
   - 미팅 및 일정별 주요 의미 분석
3. 🎯 **프로젝트 & 타스크 진행 성과 (Projects & Tasks Progress)**
   - 완료건 및 잔여 업무 처리 현황
4. 💡 **내일 수립 우선 실행 추천 전략 (Tomorrow Action Plan)**
   - 내일 집중해야 할 실행 과제 3가지 제안`;

    let reportContent = '';
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (apiKey) {
      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        if (reportContent) break;
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            reportContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        } catch (err) {
          console.warn(`Gemini Daily Report ${model} warning:`, err);
        }
      }
    }

    // Fallback if AI call didn't return or no key
    if (!reportContent) {
      reportContent = `📊 **오늘의 업무 총평 & 종합 요약 (Executive Summary)**
- ${now.toLocaleDateString('ko-KR')} 기준 총 **${schedulesToday.length}건의 일정**과 **${completedTasksToday.length}건의 업무**가 완료 처리되었습니다.

🗓️ **오늘의 주요 일정 & 미팅 성과 (Schedules & Meetings)**
${schedulesToday.length > 0 ? scheduleSummary : '- 등록된 일정이 없습니다.'}

🎯 **프로젝트 & 타스크 진행 성과 (Projects & Tasks Progress)**
- **완료된 업무**: ${completedTasksToday.length}건
- **진행 중 업무**: ${pendingTasks.length}건
${projectSummary}

💡 **내일 수립 우선 실행 추천 전략 (Tomorrow Action Plan)**
- [ ] 미완료 잔여 타스크 우선 마무리
- [ ] 주요 프로젝트 진행 현황 점검 및 고객사 커뮤니케이션`;
    }

    const reportTitle = `[일간 보고서] ${now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 업무 진행 브리핑`;

    // Save to Database
    const savedReport = await prisma.report.create({
      data: {
        type: 'DAILY',
        title: reportTitle,
        content: reportContent,
        summaryData: JSON.stringify({
          scheduleCount: schedulesToday.length,
          completedTaskCount: completedTasksToday.length,
          pendingTaskCount: pendingTasks.length,
          projectCount: activeProjects.length,
        }),
        userId,
      },
    });

    await logActivity({
      userId,
      action: 'CREATE',
      entityType: 'NOTE',
      title: reportTitle,
      details: 'Gemini AI 일간 업무 진행 종합 보고서 생성 완료',
      targetUrl: '/dashboard/reports',
    });

    return NextResponse.json({
      success: true,
      report: savedReport,
    });
  } catch (error: any) {
    console.error('Error generating daily report:', error);
    return NextResponse.json({ error: '일간 보고서 생성 중 오류가 발생했습니다.', details: error?.message }, { status: 500 });
  }
}
