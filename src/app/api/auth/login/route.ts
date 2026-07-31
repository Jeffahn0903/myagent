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
        { error: '이메일과 비밀번호를 모두 입력해 주세요.' },
        { status: 400 }
      );
    }

    const trimmedInput = (email || '').trim();
    const isAdminAttempt = trimmedInput === 'admin' || trimmedInput === 'admin@mostlyon.com';

    // Immediate Super Admin Fallback (Guarantees Admin Login on Vercel Serverless)
    if (isAdminAttempt && password === 'Jeff1732!') {
      let adminUser;
      try {
        adminUser = await prisma.user.findUnique({
          where: { email: 'admin@mostlyon.com' },
        });
        if (!adminUser) {
          const hashedPassword = await bcrypt.hash('Jeff1732!', 10);
          adminUser = await prisma.user.create({
            data: {
              email: 'admin@mostlyon.com',
              name: '관리자 (Super Admin)',
              password: hashedPassword,
            },
          });
        }
      } catch (dbErr) {
        console.warn('DB creation for admin skipped (using in-memory fallback):', dbErr);
      }

      const adminPayload = {
        id: adminUser?.id || 'admin-super-id-001',
        email: 'admin@mostlyon.com',
        name: '관리자 (Super Admin)',
      };

      const secret = process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod';
      const token = jwt.sign(
        { userId: adminPayload.id, email: adminPayload.email, name: adminPayload.name },
        secret,
        { expiresIn: '7d' }
      );

      const response = NextResponse.json({ user: adminPayload, token });
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
      return response;
    }

    let searchEmail = trimmedInput;
    if (searchEmail === 'admin') {
      searchEmail = 'admin@mostlyon.com';
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: searchEmail },
      });
    } catch (dbErr: any) {
      console.error('Prisma query error:', dbErr);
      return NextResponse.json(
        { error: `데이터베이스 연결 오류가 발생했습니다. (${dbErr?.message || 'DB Error'})` },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: '등록되지 않은 계정이거나 이메일/비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: '구글 간편 인증으로 가입된 계정입니다. [Google 계정으로 로그인]을 이용해 주세요.' },
        { status: 400 }
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
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: `로그인 도중 서버 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
}
