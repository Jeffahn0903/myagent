import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET /api/settings - Get user profile and settings
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        newsKeywords: true,
        googleAccessToken: true,
        googleTokenExpiry: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      hasGoogleAuth: !!user.googleAccessToken,
      googleAccessToken: undefined, // Don't expose token secret
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/settings - Update user profile and news keywords
export async function PUT(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, newsKeywords, currentPassword, newPassword } = await request.json();

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (newsKeywords !== undefined) {
      updateData.newsKeywords = newsKeywords.trim();
    }

    // Handle Password Change if requested
    if (newPassword && newPassword.trim()) {
      if (!currentPassword) {
        return NextResponse.json({ error: '현재 비밀번호를 입력해주세요.' }, { status: 400 });
      }
      const isMatch = await bcrypt.compare(currentPassword, currentUser.password);
      if (!isMatch) {
        return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: '새 비밀번호는 최소 6자 이상이어야 합니다.' }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        newsKeywords: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: '설정이 성공적으로 저장되었습니다.',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: '설정 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
