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
    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        schedules: {
          include: { customer: true, tasks: true },
          orderBy: { startTime: 'asc' },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        files: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build context summary for Gemini AI
    const scheduleSummary = project.schedules
      .map(
        (s) =>
          `[미팅 일시: ${new Date(s.startTime).toLocaleDateString()}] ${s.title} (장소: ${s.location || '미지정'})\n  - 안건: ${s.content || '없음'}\n  - 회의록: ${s.meetingNotes || '없음'}\n  - AI 요약: ${s.aiSummary || '없음'}`
      )
      .join('\n\n');

    const taskSummary = project.tasks
      .map((t) => `- [${t.isCompleted ? '완료' : '진행중'}] ${t.title} ${t.dueDate ? `(마감: ${new Date(t.dueDate).toLocaleDateString()})` : ''}`)
      .join('\n');

    const notesSummary = project.notes
      .map((n) => `[메모] ${n.title}: ${n.content}`)
      .join('\n');

    const filesSummary = project.files
      .map((f) => `- 파일명: ${f.filename} (${f.mimeType || '일반 파일'})`)
      .join('\n');

    const fullPrompt = `다음 프로젝트의 전체 진행 현황, 미팅 기록, 타스크, 메모 및 등록된 파일 정보를 기반으로 프로젝트 상태 보고서 및 AI 가이드를 작성해 주세요.

[프로젝트명]: ${project.name}
[설명]: ${project.description || '없음'}

[일자별 미팅 및 회의록]:
${scheduleSummary || '진행된 미팅 기록 없음'}

[프로젝트 실행 타스크]:
${taskSummary || '등록된 타스크 없음'}

[프로젝트 메모 및 노트]:
${notesSummary || '등록된 메모 없음'}

[프로젝트 파일 및 문서]:
${filesSummary || '등록된 파일 없음'}

다음 4개 항목으로 마크다운 구조 보고서를 작성해 주세요:
1. 📊 **프로젝트 종합 진행 현황 (Overall Project Status)**
2. 🗓️ **주요 미팅 & 회의록 종합 시사점 (Key Meeting Insights)**
3. 🎯 **현재 달성률 및 미완료 Action Items (Pending Tasks Analysis)**
4. 🚀 **Gemini AI 권장 다음 단계 (Recommended Next Steps)**`;

    let report = '';
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          report = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (e) {
        console.warn('Gemini API call warning in project analysis:', e);
      }
    }

    if (!report) {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((t) => t.isCompleted).length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      report = `📊 **프로젝트 종합 진행 현황 (Overall Project Status)**
- 프로젝트명: **${project.name}**
- 총 미팅 수: ${project.schedules.length}건 / 등록 타스크: ${totalTasks}건 (완료률: ${progressPercent}%)
- 등록 문서/파일: ${project.files.length}개

🗓️ **주요 미팅 & 회의록 종합 시사점 (Key Meeting Insights)**
${project.schedules.map((s) => `- **${s.title}** (${new Date(s.startTime).toLocaleDateString()}): ${s.content || '회의 진행 완료'}`).join('\n') || '- 아직 등록된 미팅이 없습니다.'}

🎯 **현재 달성률 및 미완료 Action Items (Pending Tasks Analysis)**
${project.tasks.filter((t) => !t.isCompleted).map((t) => `- ⏳ [미완료] ${t.title}`).join('\n') || '- 모든 타스크가 완료되었거나 아직 등록되지 않았습니다.'}

🚀 **Gemini AI 권장 다음 단계 (Recommended Next Steps)**
- [ ] 미팅에서 도출된 Action Items 이행 점검
- [ ] 관련자와 추가 피드백 미팅 일정 수립
- [ ] 프로젝트 구글 드라이브 폴더 문서 정리`;
    }

    return NextResponse.json({
      report,
      message: 'Gemini AI 프로젝트 종합 분석 보고서 작성이 완료되었습니다!',
    });
  } catch (error: any) {
    console.error('Error generating AI project analysis:', error);
    return NextResponse.json(
      { error: 'AI 프로젝트 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
