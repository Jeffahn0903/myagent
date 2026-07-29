import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { getAuthenticatedGoogleClient } from '@/lib/google';
import { google } from 'googleapis';

// GET /api/schedules - Get all schedules for the logged-in user
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedules = await prisma.schedule.findMany({
      where: { userId },
      include: { customer: true, project: true, tasks: true },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/schedules - Create a new schedule for the logged-in user
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      title,
      content,
      meetingNotes,
      aiSummary,
      attendees,
      startTime,
      endTime,
      location,
      customerId,
      projectId,
    } = await request.json();

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Title, start time, and end time are required' },
        { status: 400 }
      );
    }

    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, userId },
      });
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
    }

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
      });
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    // Google Calendar Integration - Sync on creation
    let googleEventId: string | null = null;
    try {
      const auth = await getAuthenticatedGoogleClient(userId);
      if (auth) {
        const calendar = google.calendar({ version: 'v3', auth });
        const gcalEvent = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: title,
            description: content || '',
            location: location || '',
            start: {
              dateTime: new Date(startTime).toISOString(),
            },
            end: {
              dateTime: new Date(endTime).toISOString(),
            },
          },
        });
        if (gcalEvent.data.id) {
          googleEventId = gcalEvent.data.id;
          console.log(`Successfully created Google Calendar Event ID: ${googleEventId}`);
        }
      }
    } catch (e: any) {
      console.warn('Google Calendar sync skipped or failed during schedule creation:', e?.message || e);
    }

    const newSchedule = await prisma.schedule.create({
      data: {
        title,
        content: content || null,
        meetingNotes: meetingNotes || null,
        aiSummary: aiSummary || null,
        attendees: attendees || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location: location || null,
        googleEventId,
        userId,
        customerId: customerId || null,
        projectId: projectId || null,
      },
      include: { customer: true, project: true, tasks: true },
    });

    await logActivity({
      userId,
      action: 'CREATE',
      entityType: 'SCHEDULE',
      title: `신규 일정 생성: "${newSchedule.title}"`,
      details: `일시: ${new Date(newSchedule.startTime).toLocaleString()} / 장소: ${newSchedule.location || '미지정'}`,
      targetUrl: `/dashboard/schedules/${newSchedule.id}`,
    });

    return NextResponse.json(newSchedule, { status: 201 });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
}
