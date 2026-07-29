import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updated = await prisma.projectFile.update({
      where: { id },
      data: { isRead: true },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error marking file as read:', error);
    return NextResponse.json({ error: 'Failed to update file read status' }, { status: 500 });
  }
}
