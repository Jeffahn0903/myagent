import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, actualDate, amount, title, category, notes } = body;

    const existing = await prisma.cashTransaction.findUnique({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: '해당 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updated = await prisma.cashTransaction.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(status === 'COMPLETED'
          ? { actualDate: actualDate ? new Date(actualDate) : new Date() }
          : status === 'SCHEDULED'
          ? { actualDate: null }
          : {}),
        ...(amount !== undefined ? { amount: parseFloat(amount) || 0 } : {}),
        ...(title ? { title } : {}),
        ...(category ? { category } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: any) {
    console.error('Error updating cash transaction:', error);
    return NextResponse.json({ error: '입출금 내역 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.cashTransaction.deleteMany({
      where: { id, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting cash transaction:', error);
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
