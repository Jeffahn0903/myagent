import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// GET /api/news/saved - Get all saved news articles for the user
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const savedArticles = await prisma.savedNews.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(savedArticles);
  } catch (error) {
    console.error('Error fetching saved news:', error);
    return NextResponse.json({ error: 'Failed to fetch saved news' }, { status: 500 });
  }
}

// POST /api/news/saved - Save / Bookmark a news article
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, url, source } = await request.json();

    if (!title || !url) {
      return NextResponse.json({ error: 'Title and URL are required' }, { status: 400 });
    }

    // Check if already saved by user
    const existing = await prisma.savedNews.findFirst({
      where: { userId, url },
    });

    if (existing) {
      return NextResponse.json({ message: '이미 스크랩된 뉴스입니다.', article: existing });
    }

    const savedArticle = await prisma.savedNews.create({
      data: {
        title,
        description: description || null,
        url,
        source: typeof source === 'string' ? source : source?.name || '뉴스',
        userId,
      },
    });

    return NextResponse.json(savedArticle, { status: 201 });
  } catch (error: any) {
    console.error('Error saving news:', error);
    return NextResponse.json({ error: '뉴스 스크랩 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/news/saved?id=xxx - Remove saved news article
export async function DELETE(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.savedNews.deleteMany({
      where: { id, userId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting saved news:', error);
    return NextResponse.json({ error: 'Failed to delete saved news' }, { status: 500 });
  }
}
