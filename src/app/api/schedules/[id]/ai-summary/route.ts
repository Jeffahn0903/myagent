import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawNotes = body.meetingNotes;

    const schedule = await prisma.schedule.findFirst({
      where: { id, userId },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const textToProcess = rawNotes || schedule.meetingNotes || schedule.content || '';
    if (!textToProcess.trim()) {
      return NextResponse.json(
        { error: '회의록 내용(Meeting Notes)을 먼저 입력해 주세요.' },
        { status: 400 }
      );
    }

    let structuredSummary = '';
    let extractedActionItems: string[] = [];

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        const prompt = `다음 회의록 메모를 정돈하여 전문가 수준의 표준 회의록으로 구조화해 주세요.
반드시 아래 4가지 마크다운 구성을 포함해 주세요:
1. 📌 **회의 핵심 요약 (Executive Summary)**
2. 💬 **주요 논의 사항 (Discussion Topics)**
3. ✅ **의결 및 결정 사항 (Key Decisions)**
4. 🎯 **후속 조치 및 Action Items (Tasks)**

원문 회의록 내용 중 구체적으로 해야 할 행동(Action Item, 할 일, 과제 등)이 언급되어 있다면, 이를 절대 누락하지 말고 '후속 조치 및 Action Items' 부분에 "- [ ] 타스크 내용" 형식으로 명확히 작성해 주세요. (예: "[과제1] 질문 리스트 작성하여 전달" -> "- [ ] 질문 리스트 작성하여 전달"). 만약 특별한 태스크가 명시되지 않은 경우에만 일반적인 후속 조치를 포함해 주세요.

[원문 회의록]:
${textToProcess}`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          structuredSummary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (e) {
        console.warn('Gemini API call warning, using fallback parser:', e);
      }
    }

    // Fallback/Reinforcement Parser: Parse specific lines looking for task-like keywords
    const lines = textToProcess.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const fallbackActions: string[] = [];
    const topicLines: string[] = [];

    lines.forEach((line: string) => {
      const isTaskLine = 
        line.startsWith('- [ ]') ||
        line.startsWith('- [x]') ||
        /^[*\-•\d\.\s]*\[(과제|태스크|할일|TODO|ACTION)[\d]*\]/i.test(line) ||
        /^(TODO|ACTION|할일|과제|태스크):/i.test(line) ||
        line.includes('전달') ||
        line.includes('공유') ||
        line.includes('작성') ||
        line.includes('수정') ||
        line.includes('개발') ||
        line.includes('준비') ||
        line.includes('검토');

      if (isTaskLine) {
        const cleanText = line
          .replace(/^[-*•\d\.\s]+/, '') // Remove bullets
          .replace(/^\[\s*\]/, '')      // Remove empty brackets
          .replace(/^\[(과제|태스크|할일|TODO|ACTION)[\d]*\]\s*/i, '') // Remove [과제1]
          .trim();
        if (cleanText && cleanText.length > 2) {
          fallbackActions.push(cleanText);
        }
      } else {
        topicLines.push(line);
      }
    });

    if (!structuredSummary) {
      structuredSummary = `📌 **회의 핵심 요약 (Executive Summary)**
- 미팅 관련 주요 논의 사항을 정리 및 공유하였습니다.
- 논의 주제: ${schedule.title}

💬 **주요 논의 사항 (Discussion Topics)**
${topicLines.map((t: string) => `- ${t}`).join('\n') || '- 주요안건 검토 및 상호 협의 진행'}

✅ **의결 및 결정 사항 (Key Decisions)**
- 상호 협의된 추진 방향에 따라 다음 일정 진행
- 회의 내용 기반으로 담당자별 Action Items 이행 결정

🎯 **후속 조치 및 Action Items (Tasks)**
${fallbackActions.map((a: string) => `- [ ] ${a}`).join('\n') || '- [ ] 회의록 검토 및 피드백 공유\n- [ ] 후속 미팅 일정 확정'}`;

      extractedActionItems = fallbackActions.length > 0
        ? fallbackActions
        : ['회의록 검토 및 피드백 공유', '후속 미팅 일정 확정'];
    } else {
      // Extract from Gemini output
      const matches = structuredSummary.match(/- \[\s*\]\s*(.+)/g);
      if (matches) {
        extractedActionItems = matches.map((m) => m.replace(/- \[\s*\]\s*/, '').trim());
      }
      
      // Merge with fallback actions if Gemini missed them
      fallbackActions.forEach((fallbackAct) => {
        if (!extractedActionItems.some((act) => act.toLowerCase().includes(fallbackAct.toLowerCase()) || fallbackAct.toLowerCase().includes(act.toLowerCase()))) {
          extractedActionItems.push(fallbackAct);
        }
      });
    }

    // Save AI summary and raw meeting notes to schedule (we do not auto-create Tasks in DB now)
    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: {
        meetingNotes: textToProcess,
        aiSummary: structuredSummary,
      },
    });

    return NextResponse.json({
      schedule: updatedSchedule,
      aiSummary: structuredSummary,
      candidateTasks: extractedActionItems.filter(Boolean),
      message: `Gemini AI 회의록 분석 완료! 아래에서 필요한 타스크를 선택하여 등록해 보세요.`,
    });
  } catch (error: any) {
    console.error('Error generating AI meeting summary:', error);
    return NextResponse.json(
      { error: 'AI 회의록 요약 중 오류가 발생했습니다.', details: error?.message },
      { status: 500 }
    );
  }
}
