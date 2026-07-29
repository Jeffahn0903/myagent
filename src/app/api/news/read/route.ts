import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// GET /api/news/read - Get all read news article URLs for the user
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const readArticles = await prisma.readNews.findMany({
      where: { userId },
      select: { url: true },
    });

    // Return array of read URLs for quick O(1) lookup on client side
    const readUrls = readArticles.map((a) => a.url);
    return NextResponse.json(readUrls);
  } catch (error) {
    console.error('Error fetching read news:', error);
    return NextResponse.json({ error: 'Failed to fetch read news' }, { status: 500 });
  }
}

// POST /api/news/read - Mark a news article as read
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Check if already marked as read
    const existing = await prisma.readNews.findFirst({
      where: { userId, url },
    });

    if (existing) {
      return NextResponse.json({ message: 'Already marked as read' });
    }

    const readArticle = await prisma.readNews.create({
      data: {
        title: title || '제목 없음',
        url,
        userId,
      },
    });

    return NextResponse.json(readArticle, { status: 201 });
  } catch (error) {
    console.error('Error marking news as read:', error);
    return NextResponse.json({ error: 'Failed to mark news as read' }, { status: 500 });
  }
}
