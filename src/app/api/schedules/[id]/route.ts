import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { getAuthenticatedGoogleClient } from '@/lib/google';
import { google } from 'googleapis';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/schedules/[id] - Get a single schedule with customer, project & tasks
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedule = await prisma.schedule.findFirst({
      where: {
        id,
        userId,
      },
      include: { customer: true, project: true, tasks: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error(`Error fetching schedule ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}

// PUT /api/schedules/[id] - Update a schedule and sync to Google Calendar
export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingSchedule = await prisma.schedule.findFirst({
      where: { id, userId },
    });

    if (!existingSchedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Title, start time, and end time are required' }, { status: 400 });
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

    // Google Calendar Sync - Update or Create event
    let finalGoogleEventId = existingSchedule.googleEventId;

    if (finalGoogleEventId) {
      // Scenario A: Existing Event -> Update it
      try {
        const auth = await getAuthenticatedGoogleClient(userId);
        if (auth) {
          const calendar = google.calendar({ version: 'v3', auth });
          await calendar.events.patch({
            calendarId: 'primary',
            eventId: finalGoogleEventId,
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
          console.log(`Successfully updated Google Calendar Event ID: ${finalGoogleEventId}`);
        }
      } catch (e: any) {
        console.warn('Google Calendar update skipped or failed during schedule modification:', e?.message || e);
      }
    } else {
      // Scenario B: No Event yet -> Create one if Google Auth is connected
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
            finalGoogleEventId = gcalEvent.data.id;
            console.log(`Created new Google Calendar Event on update: ${finalGoogleEventId}`);
          }
        }
      } catch (e: any) {
        console.warn('Google Calendar creation on update skipped or failed:', e?.message || e);
      }
    }

    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: {
        title,
        content: content !== undefined ? content : existingSchedule.content,
        meetingNotes: meetingNotes !== undefined ? meetingNotes : existingSchedule.meetingNotes,
        aiSummary: aiSummary !== undefined ? aiSummary : existingSchedule.aiSummary,
        attendees: attendees !== undefined ? attendees : existingSchedule.attendees,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location: location !== undefined ? location : existingSchedule.location,
        googleEventId: finalGoogleEventId,
        customerId: customerId !== undefined ? customerId : existingSchedule.customerId,
        projectId: projectId !== undefined ? projectId : existingSchedule.projectId,
      },
      include: { customer: true, project: true, tasks: true },
    });

    return NextResponse.json(updatedSchedule);
  } catch (error) {
    console.error(`Error updating schedule ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}

// DELETE /api/schedules/[id] - Delete a schedule and sync to Google Calendar
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { id, userId },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Google Calendar Sync - Delete event if it exists
    if (schedule.googleEventId) {
      try {
        const auth = await getAuthenticatedGoogleClient(userId);
        if (auth) {
          const calendar = google.calendar({ version: 'v3', auth });
          await calendar.events.delete({
            calendarId: 'primary',
            eventId: schedule.googleEventId,
          });
          console.log(`Successfully deleted Google Calendar Event ID: ${schedule.googleEventId}`);
        }
      } catch (e: any) {
        console.warn('Google Calendar deletion skipped or failed during schedule delete:', e?.message || e);
      }
    }

    await prisma.schedule.delete({
      where: { id },
    });

    try {
      await logActivity({
        userId,
        action: 'DELETE',
        entityType: 'SCHEDULE',
        title: `일정 삭제: "${schedule.title}"`,
        details: `일정이 삭제되었습니다.`,
        targetUrl: `/dashboard/schedules`,
      });
    } catch (e) {}

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting schedule ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
