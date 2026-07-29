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
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Query overdue and urgent tasks
    const [allTasks, projects] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        include: { project: true, schedule: true },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.project.findMany({
        where: { userId },
        include: { tasks: true },
      }),
    ]);

    // Filter delayed tasks: incomplete & dueDate < now
    const overdueTasks = allTasks.filter(
      (t) => !t.isCompleted && t.dueDate && new Date(t.dueDate) < now
    );

    // Filter urgent tasks: incomplete & dueDate between now and 3 days later
    const urgentTasks = allTasks.filter(
      (t) =>
        !t.isCompleted &&
        t.dueDate &&
        new Date(t.dueDate) >= now &&
        new Date(t.dueDate) <= threeDaysLater
    );

    // Delayed or at-risk projects: endDate past or incomplete tasks overload
    const atRiskProjects = projects.filter((p) => {
      const isPastEndDate = p.endDate && new Date(p.endDate) < now && p.status !== 'COMPLETED';
      const hasOverdueTasks = p.tasks.some((t) => !t.isCompleted && t.dueDate && new Date(t.dueDate) < now);
      return isPastEndDate || hasOverdueTasks;
    });

    const overdueSummary = overdueTasks.length > 0
      ? overdueTasks.map((t) => {
          const due = new Date(t.dueDate!);
          const diffDays = Math.ceil((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
          return `- 🔴 **[${diffDays}일 지연]** ${t.title}${t.project ? ` (소속: ${t.project.name})` : ''} - 마감일: ${due.toLocaleDateString()}`;
        }).join('\n')
      : '- 현재 지정된 일자를 초과한 지연 타스크가 없습니다. 👍';

    const urgentSummary = urgentTasks.length > 0
      ? urgentTasks.map((t) => {
          const due = new Date(t.dueDate!);
          const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));
          return `- 🟡 **[D-${diffDays} 마감임박]** ${t.title}${t.project ? ` (소속: ${t.project.name})` : ''} - 마감일: ${due.toLocaleDateString()}`;
        }).join('\n')
      : '- 3일 이내 마감 예정인 긴급 타스크가 없습니다.';

    const projectRiskSummary = atRiskProjects.length > 0
      ? atRiskProjects.map((p) => `- ⚠️ **${p.name}** (${p.status}): 목표완료일 ${p.endDate ? new Date(p.endDate).toLocaleDateString() : '미지정'}, 미완료 타스크 ${p.tasks.filter(t => !t.isCompleted).length}개`).join('\n')
      : '- 진행 지연 위험 요소가 있는 프로젝트가 없습니다.';

    const prompt = `당신은 위기 관리 및 프로젝트 리스크 분석 수석 전문가입니다.
사용자의 전체 업무/프로젝트 데이터 중 [지연된 업무(Overdue Tasks)]와 [마감 임박 긴급 업무(Urgent Tasks)]를 정밀 분석하여 [주간 리스크 및 긴급 대응 종합 보고서]를 마크다운으로 작성해 주세요.

[현재 시스템 리스크 현황 데이터]:
- 데이터 기준일: ${now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
- 🚨 지연된 타스크 (${overdueTasks.length}건):
${overdueSummary}

- ⚡ 마감 임박 긴급 타스크 D-3 이내 (${urgentTasks.length}건):
${urgentSummary}

- ⚠️ 지연/위험 감지 프로젝트 (${atRiskProjects.length}개):
${projectRiskSummary}

다음 4가지 구조로 가시성이 뛰어나고 직관적인 주간 지연/긴급 보고서를 작성해 주세요:
1. 🚨 **주간 지연 & 긴급 종합 평가 (Risk & Urgency Executive Summary)**
   - 지연건수(${overdueTasks.length}건) 및 긴급건수(${urgentTasks.length}건)에 기반한 종합 리스크 등급 (위험 / 경고 / 양호) 판정 및 진단
2. 🔴 **지연 타스크 원인 분석 & 우선 해결 권고 (Overdue Tasks Deep-Dive)**
   - 이미 마감일을 지난 타스크들의 지연 영향도와 빠른 수습 방안
3. 🟡 **마감 임박(D-3) 긴급 타스크 우선순위 안내 (Urgent Deadlines)**
   - 이번 주 내에 반드시 완료해야 하는 핵심 과제
4. 🛠️ **긴급 대응 및 병목 해소 체크리스트 (Emergency Mitigation Action Plan)**
   - 오늘 당장 수행해야 할 액션 체크리스트 4가지`;

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
          console.warn(`Gemini Weekly Risk Report ${model} warning:`, err);
        }
      }
    }

    if (!reportContent) {
      reportContent = `🚨 **주간 지연 & 긴급 종합 평가 (Risk & Urgency Executive Summary)**
- 현재 **지연된 타스크: ${overdueTasks.length}건**, **마감 임박 타스크: ${urgentTasks.length}건**으로 집계되었습니다.

🔴 **지연 타스크 원인 분석 & 우선 해결 권고 (Overdue Tasks Deep-Dive)**
${overdueSummary}

🟡 **마감 임박(D-3) 긴급 타스크 우선순위 안내 (Urgent Deadlines)**
${urgentSummary}

🛠️ **긴급 대응 및 병목 해소 체크리스트 (Emergency Mitigation Action Plan)**
- [ ] 지연 타스크의 마감 재설정 또는 신속 완료 처리
- [ ] D-3 마감 임박 타스크 우선 작업 진행
- [ ] 관련 프로젝트 담당자와 일정 재조율`;
    }

    const reportTitle = `[주간 지연·긴급 리포트] ${overdueTasks.length > 0 ? `⚠️ 지연 ${overdueTasks.length}건 감지` : '✅ 지연 없음'} (${now.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 주차)`;

    // Save to Database
    const savedReport = await prisma.report.create({
      data: {
        type: 'WEEKLY_RISK',
        title: reportTitle,
        content: reportContent,
        summaryData: JSON.stringify({
          overdueCount: overdueTasks.length,
          urgentCount: urgentTasks.length,
          atRiskProjectCount: atRiskProjects.length,
        }),
        userId,
      },
    });

    await logActivity({
      userId,
      action: 'CREATE',
      entityType: 'NOTE',
      title: reportTitle,
      details: 'Gemini AI 주간 지연 및 긴급 리스크 분석 보고서 생성 완료',
      targetUrl: '/dashboard/reports',
    });

    return NextResponse.json({
      success: true,
      report: savedReport,
    });
  } catch (error: any) {
    console.error('Error generating weekly risk report:', error);
    return NextResponse.json({ error: '주간 리포트 생성 중 오류가 발생했습니다.', details: error?.message }, { status: 500 });
  }
}
