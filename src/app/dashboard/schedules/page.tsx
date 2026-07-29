'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { Container, Typography, Box, CircularProgress, Alert, Button, Stack } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import AddIcon from '@mui/icons-material/Add';
import ScheduleFormDialog, { ScheduleData } from '@/components/ScheduleFormDialog';
import ScheduleDetailWorkspaceDialog from '@/components/ScheduleDetailWorkspaceDialog';

// Interfaces
interface Schedule {
  id: string;
  title: string;
  content: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  customerId: string | null;
}

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const toDatetimeLocal = (dateStr: string | Date) => {
  const date = new Date(dateStr);
  const ten = (i: number) => (i < 10 ? '0' : '') + i;
  const YYYY = date.getFullYear();
  const MM = ten(date.getMonth() + 1);
  const DD = ten(date.getDate());
  const HH = ten(date.getHours());
  const mm = ten(date.getMinutes());
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
};

export default function SchedulesPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');

  // Dialog States
  const [newScheduleDialogOpen, setNewScheduleDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [slotInfo, setSlotInfo] = useState<{ start: Date; end: Date } | null>(null);

  // Calendar Controlled States
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<any>('month');

  const fetchSchedules = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/schedules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch schedules');
      const data = await res.json();
      setSchedules(data);
    } catch (err) {
      setError('Could not load schedules.');
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      setLoading(true);
      fetchSchedules().finally(() => setLoading(false));
    }
  }, [token, authLoading, router, fetchSchedules]);

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/google/calendar/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Sync failed');
      setSyncMessage(data.message || 'Google Calendar synced successfully');
      fetchSchedules();
    } catch (err: any) {
      setError(err?.message || 'Failed to sync Google Calendar.');
    } finally {
      setSyncingCalendar(false);
    }
  };

  const events: BigCalendarEvent[] = useMemo(() => {
    return schedules.map((schedule) => {
      const start = new Date(schedule.startTime);
      const end = new Date(schedule.endTime);
      const isAllDay =
        start.getHours() === 0 &&
        start.getMinutes() === 0 &&
        end.getHours() === 23 &&
        end.getMinutes() >= 58;

      return {
        title: schedule.title,
        start,
        end,
        allDay: isAllDay,
        resource: schedule,
      };
    });
  }, [schedules]);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setSlotInfo({ start, end });
    setNewScheduleDialogOpen(true);
  }, []);

  const handleSelectEvent = useCallback(
    (event: BigCalendarEvent) => {
      const s = event.resource as Schedule;
      router.push(`/dashboard/schedules/${s.id}`);
    },
    [router]
  );

  const handleSaveNewSchedule = async (scheduleData: ScheduleData) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(scheduleData),
      });
      if (!res.ok) throw new Error('Failed to save schedule');
      setNewScheduleDialogOpen(false);
      setSlotInfo(null);
      await fetchSchedules();
    } catch (err) {
      setError('Failed to save schedule.');
    }
  };

  if (authLoading || loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            My Schedules
          </Typography>
          <Stack direction="row" spacing={1}>
            {user?.hasGoogleAuth && (
              <Button
                variant="outlined"
                startIcon={syncingCalendar ? <CircularProgress size={16} /> : <SyncIcon />}
                onClick={handleSyncCalendar}
                disabled={syncingCalendar}
              >
                Sync Google Calendar
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setSlotInfo(null);
                setNewScheduleDialogOpen(true);
              }}
            >
              새 일정 추가
            </Button>
          </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {syncMessage && <Alert severity="success" sx={{ mb: 2 }}>{syncMessage}</Alert>}

        <Box sx={{ height: '70vh', mt: 2 }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            date={date}
            onNavigate={(newDate) => setDate(newDate)}
            view={view}
            onView={(newView) => setView(newView)}
          />
        </Box>
      </Box>

      {/* New Schedule Creation Dialog */}
      <ScheduleFormDialog
        open={newScheduleDialogOpen}
        onClose={() => {
          setNewScheduleDialogOpen(false);
          setSlotInfo(null);
        }}
        onSave={handleSaveNewSchedule}
        schedule={
          slotInfo
            ? {
                ...({} as ScheduleData),
                startTime: toDatetimeLocal(slotInfo.start),
                endTime: toDatetimeLocal(slotInfo.end),
              }
            : null
        }
      />

      {/* Schedule Detail & Meeting Minutes Workspace Dialog */}
      <ScheduleDetailWorkspaceDialog
        open={!!selectedScheduleId}
        scheduleId={selectedScheduleId}
        onClose={() => setSelectedScheduleId(null)}
        onScheduleUpdated={fetchSchedules}
        onScheduleDeleted={fetchSchedules}
      />
    </Container>
  );
}
