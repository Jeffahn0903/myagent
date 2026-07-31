import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    let searchEmail = email.trim();
    if (searchEmail === 'admin') {
      searchEmail = 'admin@mostlyon.com';
    }

    let user = await prisma.user.findUnique({
      where: { email: searchEmail },
    });

    // Auto-seed Super Admin account on demand if trying to log in as admin
    if (!user && (searchEmail === 'admin@mostlyon.com' || email.trim() === 'admin') && password === 'Jeff1732!') {
      const hashedPassword = await bcrypt.hash('Jeff1732!', 10);
      user = await prisma.user.create({
        data: {
          email: 'admin@mostlyon.com',
          name: '관리자 (Super Admin)',
          password: hashedPassword,
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: '등록되지 않은 계정이거나 이메일/비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod';
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn: '7d' }
    );
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    const response = NextResponse.json({ user: userWithoutPassword, token });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 도중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
