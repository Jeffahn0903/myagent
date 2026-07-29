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

    // Fetch all user projects with budgets and transactions
    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        budget: {
          include: {
            transactions: {
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const budgetsData = projects.map((p) => {
      const budget = p.budget;
      const contractAmount = budget?.contractAmount || 0;
      const targetBudget = budget?.targetBudget || 0;
      const transactions = budget?.transactions || [];

      // Calculate totals
      const totalIncomeScheduled = transactions
        .filter((t) => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalIncomeCollected = transactions
        .filter((t) => t.type === 'INCOME' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenseScheduled = transactions
        .filter((t) => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpensePaid = transactions
        .filter((t) => t.type === 'EXPENSE' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + t.amount, 0);

      const netProfitForecast = contractAmount - totalExpenseScheduled;
      const profitMarginPct = contractAmount > 0 ? (netProfitForecast / contractAmount) * 100 : 0;

      return {
        projectId: p.id,
        projectName: p.name,
        projectStatus: p.status,
        budgetId: budget?.id || null,
        contractAmount,
        targetBudget,
        notes: budget?.notes || '',
        totalIncomeScheduled,
        totalIncomeCollected,
        totalExpenseScheduled,
        totalExpensePaid,
        netProfitForecast,
        profitMarginPct,
        transactions,
        updatedAt: budget?.updatedAt || p.updatedAt,
      };
    });

    return NextResponse.json(budgetsData);
  } catch (error: any) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json({ error: '예산 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, contractAmount, targetBudget, notes } = body;

    if (!projectId) {
      return NextResponse.json({ error: '프로젝트 ID가 필요합니다.' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId, userId },
    });

    if (!project) {
      return NextResponse.json({ error: '해당 프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const numContract = parseFloat(contractAmount) || 0;
    const numBudget = parseFloat(targetBudget) || 0;

    const budget = await prisma.projectBudget.upsert({
      where: { projectId },
      update: {
        contractAmount: numContract,
        targetBudget: numBudget,
        notes: notes || '',
      },
      create: {
        projectId,
        contractAmount: numContract,
        targetBudget: numBudget,
        notes: notes || '',
        userId,
      },
      include: {
        transactions: true,
      },
    });

    await logActivity({
      userId,
      action: 'UPDATE',
      entityType: 'PROJECT',
      title: `[예산 설정] ${project.name}`,
      details: `수주금액: ${numContract.toLocaleString()}원, 목표예산: ${numBudget.toLocaleString()}원 설정`,
      targetUrl: '/dashboard/budgets',
    });

    return NextResponse.json({ success: true, budget });
  } catch (error: any) {
    console.error('Error setting project budget:', error);
    return NextResponse.json({ error: '프로젝트 예산 설정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
