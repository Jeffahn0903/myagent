import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const room = await prisma.meetingRoom.findUnique({
      where: { id },
      include: {
        project: true,
        host: true,
        attendees: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: '존재하지 않는 회의실입니다.' }, { status: 404 });
    }

    if (room.messages.length === 0) {
      return NextResponse.json({
        error: '회의실 대화 기록이 없어 AI 요약을 생성할 수 없습니다. 대화를 나누거나 파일을 공유한 후 다시 시도해 주세요.',
      }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    // Format chat history & attachments for Gemini
    const chatLog = room.messages
      .map((m) => {
        const fileTag = m.fileName ? ` [첨부파일: ${m.fileName}]` : '';
        return `[${new Date(m.createdAt).toLocaleTimeString('ko-KR')}] ${m.senderName} (${m.senderEmail}): ${m.text}${fileTag}`;
      })
      .join('\n');

    const prompt = `
You are an expert AI Executive Assistant & Meeting Minutes Analyst.
Analyze the following online meeting transcript and extract structured meeting minutes, follow-up schedules, and follow-up tasks.

[Meeting Information]
- Title: ${room.title}
- Description: ${room.description || '없음'}
- Meeting Date: ${new Date(room.date).toLocaleString('ko-KR')}
- Linked Project: ${room.project?.name || '일반 회의'}
- Attendees: ${room.attendees.map((a) => a.name).join(', ')}

[Chat History & Files]
${chatLog}

Please return JSON strictly adhering to the following JSON structure without markdown code fence wrapper or preamble:
{
  "summaryMarkdown": "Write a clean, structured meeting summary in Korean (markdown format with 📌 핵심 요약, 💡 주요 결정 사항, 📝 논의 내용).",
  "suggestedSchedules": [
    {
      "title": "Concise Schedule Title in Korean",
      "startTime": "ISO 8601 Date String e.g. 2026-08-01T14:00:00",
      "endTime": "ISO 8601 Date String e.g. 2026-08-01T15:00:00",
      "location": "Online or Offline location"
    }
  ],
  "suggestedTasks": [
    {
      "title": "Actionable task title in Korean",
      "dueDate": "YYYY-MM-DD",
      "priority": "HIGH or MEDIUM or LOW"
    }
  ]
}
`;

    let rawText = '';

    if (apiKey) {
      const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        if (rawText) break;
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
            rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        } catch (err) {
          console.warn(`Gemini Meeting Summary ${model} warning:`, err);
        }
      }
    }

    if (!rawText) {
      // Clean fallback if API key is not available
      const firstLines = room.messages.slice(0, 3).map((m) => `- ${m.senderName}: ${m.text}`).join('\n');
      return NextResponse.json({
        summaryMarkdown: `📌 **회의 핵심 요약**\n- **회의명**: ${room.title}\n- **참석자**: ${room.attendees.map((a) => a.name).join(', ')}\n\n💡 **주요 대화 요약**\n${firstLines || '- 회의 대화 내용 기록 완료'}`,
        suggestedSchedules: [
          {
            title: `${room.title} 후속 미팅`,
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
            location: '온라인',
          },
        ],
        suggestedTasks: [
          {
            title: `${room.title} 회의 결과 검토 및 문서화`,
            dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
            priority: 'HIGH',
          },
        ],
      });
    }

    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(rawText);
      return NextResponse.json(parsed);
    } catch (e) {
      return NextResponse.json({
        summaryMarkdown: rawText,
        suggestedSchedules: [],
        suggestedTasks: [],
      });
    }
  } catch (error: any) {
    console.error('Error generating AI meeting summary:', error);
    return NextResponse.json({ error: 'AI 회의 요약 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
