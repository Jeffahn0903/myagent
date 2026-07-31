import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { historyIdA, historyIdB } = body;

    if (!historyIdA || !historyIdB) {
      return NextResponse.json({ error: '비교할 두 회의록 버전을 선택해 주세요.' }, { status: 400 });
    }

    const [histA, histB] = await Promise.all([
      prisma.meetingSummaryHistory.findUnique({ where: { id: historyIdA } }),
      prisma.meetingSummaryHistory.findUnique({ where: { id: historyIdB } }),
    ]);

    if (!histA || !histB) {
      return NextResponse.json({ error: '비교 대상 회의록 히스토리를 찾을 수 없습니다.' }, { status: 404 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    const prompt = `
You are an expert AI Executive Assistant.
Compare the following two versions of meeting minutes and highlight the key differences.

[Version ${histA.version} (${new Date(histA.createdAt).toLocaleString('ko-KR')})]
Title: ${histA.title}
Summary:
${histA.summaryMarkdown}

[Version ${histB.version} (${new Date(histB.createdAt).toLocaleString('ko-KR')})]
Title: ${histB.title}
Summary:
${histB.summaryMarkdown}

Please provide a clean, structured comparison in Korean (markdown format) focusing on:
1. ➕ **새로 추가된 주요 내용 및 결정 사항**
2. ➖ **수정되거나 제외된 부분**
3. 🗓️ **일정 및 타스크(할 일) 변동 사항**
`;

    let diffSummary = '';

    if (apiKey) {
      const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        if (diffSummary) break;
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
            diffSummary = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        } catch (err) {
          console.warn(`Gemini Compare ${model} warning:`, err);
        }
      }
    }

    if (!diffSummary) {
      diffSummary = `🔍 **v${histA.version} ➡️ v${histB.version} 버전 비교 결과**\n\n` +
        `- **버전 v${histA.version} 작성일**: ${new Date(histA.createdAt).toLocaleString('ko-KR')}\n` +
        `- **버전 v${histB.version} 작성일**: ${new Date(histB.createdAt).toLocaleString('ko-KR')}\n\n` +
        `💡 **버전 v${histB.version} 요약**: ${histB.summaryMarkdown.slice(0, 200)}...`;
    }

    return NextResponse.json({
      success: true,
      versionA: histA.version,
      versionB: histB.version,
      diffSummary,
    });
  } catch (error: any) {
    console.error('Error comparing meeting histories:', error);
    return NextResponse.json({ error: '버전 비교 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
