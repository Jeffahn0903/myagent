import { prisma } from '@/lib/prisma';

export interface LogActivityParams {
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'SCHEDULE' | 'TASK' | 'PROJECT' | 'CUSTOMER' | 'FILE' | 'NOTE';
  title: string;
  details?: string;
  targetUrl?: string;
}

export async function logActivity({
  userId,
  action,
  entityType,
  title,
  details,
  targetUrl,
}: LogActivityParams) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        title,
        details: details || null,
        targetUrl: targetUrl || null,
      },
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
