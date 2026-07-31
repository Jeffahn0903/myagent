import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Target Date Parser for Korean Natural Language (오늘, 내일, 목요일, 7월 23일 등)
function parseTargetDateFromPrompt(prompt: string): { targetDateStr: string; dateLabel: string } | null {
  const now = new Date();
  const currentDayOfWeek = now.getDay();

  if (prompt.includes('오늘')) {
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    return { targetDateStr: `${YYYY}-${MM}-${DD}`, dateLabel: '오늘' };
  }

  if (prompt.includes('내일')) {
    const tomorrow = new Date(now.getTime() + 86400000);
    const YYYY = tomorrow.getFullYear();
    const MM = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const DD = String(tomorrow.getDate()).padStart(2, '0');
    return { targetDateStr: `${YYYY}-${MM}-${DD}`, dateLabel: '내일' };
  }

  if (prompt.includes('모레')) {
    const dayAfter = new Date(now.getTime() + 86400000 * 2);
    const YYYY = dayAfter.getFullYear();
    const MM = String(dayAfter.getMonth() + 1).padStart(2, '0');
    const DD = String(dayAfter.getDate()).padStart(2, '0');
    return { targetDateStr: `${YYYY}-${MM}-${DD}`, dateLabel: '모레' };
  }

  const daysMap: Record<string, number> = {
    '일요일': 0, '일': 0,
    '월요일': 1, '월': 1,
    '화요일': 2, '화': 2,
    '수요일': 3, '수': 3,
    '목요일': 4, '목': 4,
    '금요일': 5, '금': 5,
    '토요일': 6, '토': 6,
  };

  const weekDayMatch = prompt.match(/(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)\s*일정/);
  if (weekDayMatch && weekDayMatch[1]) {
    const dayName = weekDayMatch[1];
    const targetDay = daysMap[dayName];
    if (targetDay !== undefined) {
      let diff = targetDay - currentDayOfWeek;
      if (diff <= 0) diff += 7;
      const targetDate = new Date(now.getTime() + diff * 86400000);
      const YYYY = targetDate.getFullYear();
      const MM = String(targetDate.getMonth() + 1).padStart(2, '0');
      const DD = String(targetDate.getDate()).padStart(2, '0');
      return { targetDateStr: `${YYYY}-${MM}-${DD}`, dateLabel: `${dayName}` };
    }
  }

  const monthDayMatch = prompt.match(/(\d{1,2})월\s*(\d{1,2})일/) || prompt.match(/(\d{1,2})\/(\d{1,2})/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1], 10);
    const day = parseInt(monthDayMatch[2], 10);
    const year = now.getFullYear();
    const MM = String(month).padStart(2, '0');
    const DD = String(day).padStart(2, '0');
    return { targetDateStr: `${year}-${MM}-${DD}`, dateLabel: `${month}월 ${day}일` };
  }

  return null;
}

function filterSchedulesByTargetDate(schedules: any[], targetDateStr: string) {
  return schedules.filter((s) => {
    const sDate = new Date(s.startTime);
    const YYYY = sDate.getFullYear();
    const MM = String(sDate.getMonth() + 1).padStart(2, '0');
    const DD = String(sDate.getDate()).padStart(2, '0');
    const formatted = `${YYYY}-${MM}-${DD}`;
    return formatted === targetDateStr;
  });
}

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const [user, schedules, projects, tasks, customers, savedNews, reports, activityLogs] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.schedule.findMany({
        where: { userId },
        include: { customer: true, project: true },
        orderBy: { startTime: 'asc' },
        take: 50,
      }),
      prisma.project.findMany({
        where: { userId },
        include: { _count: { select: { schedules: true, tasks: true, notes: true, files: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.findMany({
        where: { userId },
        include: { project: true, schedule: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.customer.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      }),
      prisma.savedNews.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.report.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const nowIso = new Date().toISOString();
    const todayStr = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });

    const schedulesSummary = schedules
      .map(
        (s) =>
          `- [일정 ID: ${s.id}] 제목: "${s.title}", 일시: ${new Date(s.startTime).toLocaleString('ko-KR')} ~ ${new Date(s.endTime).toLocaleString('ko-KR')}, 장소: ${s.location || '미지정'}, 관련프로젝트: ${s.project?.name || '없음'}, 고객: ${s.customer?.name || '없음'}`
      )
      .join('\n');

    const projectsSummary = projects
      .map(
        (p) =>
          `- [프로젝트 ID: ${p.id}] 이름: "${p.name}", 상태: ${p.status}, 설명: ${p.description || '없음'}, 일정수: ${p._count.schedules}, 타스크수: ${p._count.tasks}`
      )
      .join('\n');

    const tasksSummary = tasks
      .map(
        (t) =>
          `- [타스크 ID: ${t.id}] 제목: "${t.title}", 완료여부: ${t.isCompleted ? '완료' : '진행중'}, 마감일: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('ko-KR') : '미설정'}, 관련프로젝트: ${t.project?.name || '없음'}`
      )
      .join('\n');

    const customersSummary = customers
      .map(
        (c) =>
          `- [고객 ID: ${c.id}] 이름: "${c.name}", 회사: "${c.company || '미지정'}", 직함: "${c.position || '미지정'}", 연락처: ${c.phone || '없음'}, 이메일: ${c.email || '없음'}`
      )
      .join('\n');

    const savedNewsSummary = savedNews
      .map((n) => `- 스크랩 제목: "${n.title}", 언론사: ${n.source || '미지정'}, URL: ${n.url}`)
      .join('\n');

    const reportsSummary = reports
      .map((r) => `- [리포트 ID: ${r.id}] 유형: ${r.type}, 제목: "${r.title}", 작성일: ${new Date(r.createdAt).toLocaleDateString('ko-KR')}`)
      .join('\n');

    const activitySummary = activityLogs
      .map((a) => `- [${new Date(a.createdAt).toLocaleString('ko-KR')}] [${a.action}] ${a.title}: ${a.details || ''}`)
      .join('\n');

    const systemInstruction = `
You are Gemini AI Workspace Assistant for MostlyOn.
Current Date: ${todayStr} (${nowIso}).
User Name: ${user?.name || '사용자'}.
User Email: ${user?.email || '알수없음'}.
User Custom News Keywords: ${user?.newsKeywords || '미설정'}.

[Complete User Account Workspace Context]
---
1. PROJECTS (${projects.length}개):
${projectsSummary || '등록된 프로젝트 없음'}

2. SCHEDULES (${schedules.length}건):
${schedulesSummary || '등록된 일정 없음'}

3. TASKS (${tasks.length}건, 완료 ${tasks.filter(t => t.isCompleted).length}건, 진행중 ${tasks.filter(t => !t.isCompleted).length}건):
${tasksSummary || '등록된 타스크 없음'}

4. CUSTOMERS & BUSINESS CARDS (${customers.length}명):
${customersSummary || '등록된 고객/명함 정보 없음'}

5. SAVED NEWS (${savedNews.length}건):
${savedNewsSummary || '저장된 뉴스 없음'}

6. GENERATED AI REPORTS (${reports.length}건):
${reportsSummary || '생성된 AI 보고서 없음'}

7. RECENT ACTIVITIES (${activityLogs.length}건):
${activitySummary || '최근 활동 이력 없음'}
---

[CRITICAL INTENT RULES]
1. Q&A / ACCOUNT OVERVIEW (계정 정보 조회, 전체 요약, 찾아줘, 확인, 몇개있어, 보여줘):
   - Provide a complete, structured, highly polite breakdown in Korean of all requested data.
   - When user asks "등록된 모든 정보 알려줘" or "계정 정보 요약해줘", present a neat overview of Projects, Schedules, Tasks, Customers, Saved News, and AI Reports.
   - DO NOT PROPOSE OR GENERATE ANY CREATION ACTION BLOCK FOR QUERY PROMPTS.

2. CREATION REQUEST (추가해줘, 생성해줘, 등록해줘, 만들어줘):
   - ONLY when user explicitly asks to CREATE a new item, suggest a JSON action block at the end of the text.
`;

    let aiText = '';
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: systemInstruction }, { text: prompt }],
              },
            ],
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (e) {
        console.warn('Gemini API call warning:', e);
      }
    }

    // Fallback Logic with Strict Creation Confirmation
    if (!aiText) {
      const isCreateIntent = prompt.includes('추가') || prompt.includes('생성') || prompt.includes('등록') || prompt.includes('만들어');

      if (prompt.includes('일정') || prompt.includes('미팅') || prompt.includes('회의')) {
        if (isCreateIntent) {
          const titleMatch = prompt.match(/['"](.*?)['"]/) || prompt.match(/(.*?)(일정|미팅|회의)/);
          const title = titleMatch ? titleMatch[1].trim() : '신규 미팅 일정';
          aiText = `네, 요청하신 일정을 아래 정보로 생성해 드릴까요? 아래 **[수락 및 등록]** 버튼을 클릭하시면 일정이 생성됩니다.\n\n\`\`\`json\n{\n  "action": "CREATE_SCHEDULE",\n  "data": {\n    "title": "${title}",\n    "startTime": "${new Date(Date.now() + 86400000).toISOString()}",\n    "endTime": "${new Date(Date.now() + 90000000).toISOString()}"\n  }\n}\n\`\`\``;
        } else {
          const dateTarget = parseTargetDateFromPrompt(prompt);
          if (dateTarget) {
            const matching = filterSchedulesByTargetDate(schedules, dateTarget.targetDateStr);
            if (matching.length === 0) {
              aiText = `🗓️ **${dateTarget.dateLabel} (${dateTarget.targetDateStr})** 에 예정된 일정이 없습니다.`;
            } else {
              const listStr = matching
                .map(
                  (s) =>
                    `- 🗓️ **${s.title}**: ${new Date(s.startTime).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} ~ ${new Date(s.endTime).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} (${s.location || '장소 미지정'})`
                )
                .join('\n');
              aiText = `🗓️ **${dateTarget.dateLabel} (${dateTarget.targetDateStr}) 일정 목록입니다:**\n\n${listStr}`;
            }
          } else {
            if (schedules.length === 0) {
              aiText = `현재 등록된 일정이 없습니다.`;
            } else {
              const upcoming = schedules.filter((s) => new Date(s.startTime) >= new Date(Date.now() - 86400000));
              const listStr = upcoming
                .slice(0, 8)
                .map(
                  (s) =>
                    `- 🗓️ **${s.title}**: ${new Date(s.startTime).toLocaleString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })} (${s.location || '장소 미지정'})`
                )
                .join('\n');
              aiText = `🗓️ **다가오는 주요 일정 목록입니다:**\n\n${listStr}`;
            }
          }
        }
      } else if (prompt.includes('타스크') || prompt.includes('할일') || prompt.includes('할 일')) {
        if (isCreateIntent) {
          const titleMatch = prompt.match(/['"](.*?)['"]/) || prompt.match(/(.*?)(추가|생성|등록)/);
          const title = titleMatch ? titleMatch[1].trim() : '신규 Action Task';
          aiText = `네, 요청하신 타스크를 아래 정보로 생성해 드릴까요?\n\n\`\`\`json\n{\n  "action": "CREATE_TASK",\n  "data": {\n    "title": "${title}"\n  }\n}\n\`\`\``;
        } else {
          if (tasks.length === 0) {
            aiText = `현재 등록된 타스크가 없습니다.`;
          } else {
            const listStr = tasks
              .slice(0, 10)
              .map(
                (t) =>
                  `- [${t.isCompleted ? '완료' : '진행중'}] **${t.title}**${t.dueDate ? ` (마감: ${new Date(t.dueDate).toLocaleDateString('ko-KR')})` : ''}`
              )
              .join('\n');
            aiText = `🎯 **현재 등록된 타스크 목록입니다:**\n\n${listStr}`;
          }
        }
      } else if (prompt.includes('프로젝트')) {
        if (isCreateIntent) {
          const nameMatch = prompt.match(/['"](.*?)['"]/) || prompt.match(/(.*?)(프로젝트)/);
          const name = nameMatch ? nameMatch[1].trim() : '신규 프로젝트';
          aiText = `네, 요청하신 프로젝트를 아래 정보로 생성해 드릴까요?\n\n\`\`\`json\n{\n  "action": "CREATE_PROJECT",\n  "data": {\n    "name": "${name}"\n  }\n}\n\`\`\``;
        } else {
          if (projects.length === 0) {
            aiText = `현재 등록된 프로젝트가 없습니다.`;
          } else {
            const listStr = projects
              .map(
                (p) =>
                  `- 📁 **${p.name}** [상태: ${p.status}]: ${p.description || '설명 없음'} (일정 ${p._count.schedules}개 / 타스크 ${p._count.tasks}개)`
              )
              .join('\n');
            aiText = `📁 **진행 중인 프로젝트 현황입니다:**\n\n${listStr}`;
          }
        }
      } else {
        aiText = `현재 총 ${projects.length}개의 프로젝트, ${schedules.length}개의 일정, 그리고 ${tasks.length}개의 타스크가 등록되어 있습니다.\n\n"오늘 일정 알려줘" 또는 "내일 일정 알려줘" 같이 원하시는 날짜를 물어보세요!`;
      }
    }

    let proposedAction: { action: string; data: any } | null = null;

    // Parse JSON block to proposedAction WITHOUT writing to Database!
    const jsonMatch = aiText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const actionData = JSON.parse(jsonMatch[1]);
        if (actionData?.action && actionData?.data) {
          proposedAction = {
            action: actionData.action,
            data: actionData.data,
          };
        }
      } catch (err) {
        console.error('Error parsing proposed AI action:', err);
      }
    }

    // Clean JSON codeblock from human text output
    const cleanedText = aiText.replace(/```json[\s\S]*?```/g, '').trim();

    return NextResponse.json({
      responseText: cleanedText || aiText,
      proposedAction,
    });
  } catch (error: any) {
    console.error('Gemini Assistant Error:', error?.message);
    return NextResponse.json(
      { error: 'Gemini AI 처리 중 오류가 발생했습니다.', details: error?.message },
      { status: 500 }
    );
  }
}
