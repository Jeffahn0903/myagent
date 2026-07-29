import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactions = await prisma.cashTransaction.findMany({
      where: { userId },
      include: {
        projectBudget: {
          include: {
            project: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json(transactions);
  } catch (error: any) {
    console.error('Error fetching cash transactions:', error);
    return NextResponse.json({ error: '입출금 스케줄을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, type, category, title, amount, dueDate, status, notes } = body;

    if (!projectId || !type || !title || !amount || !dueDate) {
      return NextResponse.json({ error: '필수 입력 항목(프로젝트, 유형, 제목, 금액, 예정일)을 확인해 주세요.' }, { status: 400 });
    }

    // Find or auto-create project budget
    let budget = await prisma.projectBudget.findUnique({
      where: { projectId },
    });

    if (!budget) {
      budget = await prisma.projectBudget.create({
        data: {
          projectId,
          userId,
          contractAmount: 0,
          targetBudget: 0,
        },
      });
    }

    const numAmount = parseFloat(amount) || 0;
    const dueDateTime = new Date(dueDate);

    const transaction = await prisma.cashTransaction.create({
      data: {
        projectBudgetId: budget.id,
        userId,
        type, // "INCOME" | "EXPENSE"
        category: category || (type === 'INCOME' ? '선금' : '외주비'),
        title,
        amount: numAmount,
        dueDate: dueDateTime,
        actualDate: status === 'COMPLETED' ? new Date() : null,
        status: status || 'SCHEDULED',
        notes: notes || '',
      },
    });

    await logActivity({
      userId,
      action: 'CREATE',
      entityType: 'PROJECT',
      title: `[${type === 'INCOME' ? '입금 스케줄' : '출금 스케줄'}] ${title}`,
      details: `${numAmount.toLocaleString()}원 (${dueDateTime.toLocaleDateString()})`,
      targetUrl: '/dashboard/budgets',
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error: any) {
    console.error('Error creating cash transaction:', error);
    return NextResponse.json({ error: '입출금 스케줄 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
