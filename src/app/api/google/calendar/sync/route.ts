import { NextResponse } from 'next/server';
import { getAuthenticatedGoogleClient } from '@/lib/google';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Past 30 days
      timeMax: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // Next 90 days
      singleEvents: true,
      orderBy: 'startTime',
    });

    const googleEvents = response.data.items || [];
    let syncedCount = 0;

    for (const event of googleEvents) {
      if (!event.summary || !event.start) continue;

      const title = event.summary;
      let startTime: Date;
      let endTime: Date;

      if (event.start.date) {
        // All-day event (Format: YYYY-MM-DD)
        const [sy, sm, sd] = event.start.date.split('-').map(Number);
        startTime = new Date(sy, sm - 1, sd, 0, 0, 0, 0);

        if (event.end?.date) {
          // Google Calendar end.date is exclusive!
          // E.g. For a 1-day event on July 29: start="2026-07-29", end="2026-07-30"
          const [ey, em, ed] = event.end.date.split('-').map(Number);
          const endDateExclusive = new Date(ey, em - 1, ed, 0, 0, 0, 0);
          // Subtract 1 second so it ends cleanly at 23:59:59 of the intended last day
          endTime = new Date(endDateExclusive.getTime() - 1000);
        } else {
          endTime = new Date(sy, sm - 1, sd, 23, 59, 59, 999);
        }
      } else {
        // Timed event
        startTime = new Date(event.start.dateTime || Date.now());
        endTime = new Date(event.end?.dateTime || startTime.getTime() + 3600000);
      }

      const content = event.description || null;
      const location = event.location || null;

      // Check if schedule with same title or same googleEventId already exists for this user
      const existing = await prisma.schedule.findFirst({
        where: {
          userId,
          OR: [
            { googleEventId: event.id },
            { title },
          ],
        },
      });

      if (!existing) {
        await prisma.schedule.create({
          data: {
            title,
            content,
            startTime,
            endTime,
            location,
            googleEventId: event.id,
            userId,
          },
        });
        syncedCount++;
      } else {
        // Update existing schedule with corrected local startTime and endTime
        await prisma.schedule.update({
          where: { id: existing.id },
          data: {
            startTime,
            endTime,
            content: content || existing.content,
            location: location || existing.location,
            googleEventId: event.id,
          },
        });
        syncedCount++;
      }
    }

    return NextResponse.json({
      message: `Google 캘린더 ${syncedCount}개 일정이 동기화(시간 보정 완료)되었습니다.`,
      totalFetched: googleEvents.length,
      syncedCount,
    });
  } catch (error: any) {
    console.error('Google Calendar Sync error:', error?.message);
    return NextResponse.json(
      { error: 'Failed to sync Google Calendar', details: error?.message },
      { status: 500 }
    );
  }
}
