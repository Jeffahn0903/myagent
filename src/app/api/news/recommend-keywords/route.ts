import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { newsKeywords: true },
    });

    const currentKeywords = user?.newsKeywords || 'AI, 비즈니스, IT, 클라우드';

    // 1. Fetch read articles (last 20)
    const readArticles = await prisma.readNews.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 2. Fetch recent articles from external news search (fallback google rss or newsapi)
    // We can fetch from Google News RSS using the current keywords
    let recentArticles: { title: string; url: string }[] = [];
    try {
      const encodedKeywords = encodeURIComponent(currentKeywords.replace(/,/g, ' '));
      const rssUrl = `https://news.google.com/rss/search?q=${encodedKeywords}&hl=ko&gl=KR&ceid=KR:ko`;
      const res = await fetch(rssUrl);
      if (res.ok) {
        const xml = await res.text();
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null && recentArticles.length < 25) {
          const itemContent = match[1];
          const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
          if (titleMatch && linkMatch) {
            recentArticles.push({
              title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
              url: linkMatch[1].trim(),
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch recent news for unread check:', e);
    }

    const readUrls = new Set(readArticles.map((a) => a.url));
    const unreadArticles = recentArticles.filter((a) => !readUrls.has(a.url)).slice(0, 15);

    if (readArticles.length === 0) {
      return NextResponse.json({
        message: '사용자가 읽은 기사 이력이 아직 부족하여 키워드 추천을 건너뛰었습니다. 기사를 몇 개 읽어보세요!',
        keywords: currentKeywords,
        skipped: true,
      });
    }

    const readTitles = readArticles.map((a, i) => `${i + 1}. ${a.title}`).join('\n');
    const unreadTitles = unreadArticles.map((a, i) => `${i + 1}. ${a.title}`).join('\n');

    const prompt = `사용자가 최근 읽은 기사와 읽지 않고 무시한 기사를 분석하여, 사용자의 관심 뉴스 키워드를 최신화하고자 합니다.

[사용자가 클릭하여 읽은 뉴스 기사 목록]:
${readTitles}

[목록에 있었으나 사용자가 읽지 않은 뉴스 기사 목록]:
${unreadTitles}

[기존 설정된 주요 관심 키워드]:
${currentKeywords}

위 데이터를 분석하여, 사용자가 관심 있어 하는 구체적이고 뾰족한 최신 기술 및 비즈니스 키워드들을 5~6개 추천해 주세요.
(예: 생성형AI가 많다면 '생성형AI', '챗봇'; 클라우드가 많다면 'SaaS', '클라우드')

주의: 반드시 쉼표(,)로 구분된 단어들로만 구성된 한 줄의 텍스트로 대답해 주세요. (예: AI, 클라우드, SaaS, 디지털전환, 반도체)
그 외의 분석 글이나 추가 텍스트(예: "추천 키워드:", "다음과 같이...")는 일체 포함하지 마세요.`;

    let recommendedKeywords = currentKeywords;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text.trim() && text.includes(',')) {
            recommendedKeywords = text.replace(/\n/g, '').trim();
          }
        }
      } catch (e) {
        console.warn('Gemini API call failed in recommend-keywords:', e);
      }
    }

    // Sanitize recommended keywords
    if (recommendedKeywords !== currentKeywords) {
      await prisma.user.update({
        where: { id: userId },
        data: { newsKeywords: recommendedKeywords },
      });
    }

    return NextResponse.json({
      message: `읽은 뉴스 분석을 통해 관심 키워드가 업데이트되었습니다: ${recommendedKeywords}`,
      keywords: recommendedKeywords,
      updated: recommendedKeywords !== currentKeywords,
    });
  } catch (error: any) {
    console.error('Error in recommend-keywords:', error);
    return NextResponse.json({ error: '추천 키워드 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
