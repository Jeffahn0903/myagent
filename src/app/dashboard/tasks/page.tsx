'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  IconButton,
  Alert,
  Checkbox,
  Stack,
  FormControlLabel,
  Switch,
  Chip,
  Paper,
  Divider,
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import SyncIcon from '@mui/icons-material/Sync';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import { useRouter } from 'next/navigation';
import TaskFormDialog, { TaskData } from '@/components/TaskFormDialog';

interface ScheduleRef {
  id: string;
  title: string;
}

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  createdAt: string;
  isCompleted: boolean;
  scheduleId?: string | null;
  schedule?: ScheduleRef | null;
  project?: {
    id: string;
    name: string;
  } | null;
}

const getDDayBadge = (dueDateStr: string | null) => {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const mm = String(due.getMonth() + 1).padStart(2, '0');
  const dd = String(due.getDate()).padStart(2, '0');
  const dateStr = `${mm}/${dd}`;

  if (diffDays === 0) return { label: `D-Day (${dateStr})`, color: 'error' as const };
  if (diffDays > 0) return { label: `D-${diffDays} (${dateStr})`, color: 'primary' as const };
  return { label: `D+${Math.abs(diffDays)} (${dateStr})`, color: 'warning' as const };
};

export default function TasksPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingTasks, setSyncingTasks] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      setError('Could not load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      fetchTasks();
    }
  }, [token, authLoading, router, fetchTasks]);

  const handleSyncTasks = async () => {
    setSyncingTasks(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/google/tasks/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Sync failed');
      setSyncMessage(data.message || 'Google Tasks synced successfully');
      fetchTasks();
    } catch (err: any) {
      setError(err?.message || 'Failed to sync Google Tasks.');
    } finally {
      setSyncingTasks(false);
    }
  };

  const handleOpenDialog = (task: Task | null = null) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
  };

  const handleSaveTask = async (taskData: TaskData) => {
    const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
    const method = editingTask ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(taskData),
      });

      if (!res.ok) throw new Error('Failed to save task');

      handleCloseDialog();
      await fetchTasks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('정말로 이 타스크를 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError('Failed to delete task.');
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !task.isCompleted }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      fetchTasks();
    } catch (error) {
      setError('Failed to update task.');
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

  const filteredTasks = tasks.filter((task) => !hideCompleted || !task.isCompleted);

  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            내 타스크 관리 (Tasks)
          </Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={hideCompleted}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  color="primary"
                />
              }
              label="완료된 항목 숨기기"
            />
            {user?.hasGoogleAuth && (
              <Button
                variant="outlined"
                startIcon={syncingTasks ? <CircularProgress size={16} /> : <SyncIcon />}
                onClick={handleSyncTasks}
                disabled={syncingTasks}
              >
                Sync Google Tasks
              </Button>
            )}
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              새 타스크 작성
            </Button>
          </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {syncMessage && <Alert severity="success" sx={{ mb: 2 }}>{syncMessage}</Alert>}

        <Paper elevation={2} sx={{ p: 2, borderRadius: 3 }}>
          {filteredTasks.length === 0 ? (
            <Typography variant="body1" color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
              {hideCompleted && tasks.length > 0
                ? '진행 중인 타스크가 없습니다. (모두 완료됨)'
                : '등록된 타스크가 없습니다.'}
            </Typography>
          ) : (
            <List disablePadding>
              {filteredTasks.map((task, idx) => {
                const dDayInfo = getDDayBadge(task.dueDate);
                return (
                  <React.Fragment key={task.id}>
                    {idx > 0 && <Divider component="li" />}
                    <ListItem
                      sx={{
                        py: 1.5,
                        px: 2,
                        borderRadius: 1.5,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      secondaryAction={
                        <Stack direction="row" spacing={1}>
                          <IconButton aria-label="edit" color="primary" onClick={() => handleOpenDialog(task)}>
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton aria-label="delete" color="error" onClick={() => handleDeleteTask(task.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      }
                    >
                      <Checkbox
                        edge="start"
                        checked={task.isCompleted}
                        onChange={() => handleToggleTask(task)}
                        color="primary"
                        sx={{ mr: 1 }}
                      />

                      <Box sx={{ flexGrow: 1, pr: 12, minWidth: 0 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            textDecoration: task.isCompleted ? 'line-through' : 'none',
                            color: task.isCompleted ? 'text.secondary' : 'text.primary',
                          }}
                        >
                          {task.title}
                        </Typography>

                        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                          {/* Project Badge */}
                          {task.project && (
                            <Chip
                              icon={<FolderIcon fontSize="small" />}
                              label={`프로젝트: ${task.project.name}`}
                              size="small"
                              color="secondary"
                              variant="outlined"
                              onClick={() => router.push(`/dashboard/projects/${task.project!.id}`)}
                              clickable
                            />
                          )}

                          {/* Schedule Badge */}
                          {task.schedule ? (
                            <Chip
                              icon={<CalendarMonthIcon fontSize="small" />}
                              label={`연결 일정: ${task.schedule.title}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                              onClick={() => router.push(`/dashboard/schedules/${task.schedule!.id}`)}
                              clickable
                            />
                          ) : (
                            <Chip label="독립 타스크" size="small" variant="outlined" sx={{ color: 'text.secondary' }} />
                          )}

                          {/* D-Day Badge */}
                          {dDayInfo && (
                            <Chip
                              icon={<EventAvailableIcon fontSize="small" />}
                              label={dDayInfo.label}
                              color={dDayInfo.color}
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          )}

                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 1 }}>
                            <span>생성일: {new Date(task.createdAt).toLocaleDateString()}</span>
                            {task.dueDate && (
                              <>
                                <span>|</span>
                                <span>마감일: {new Date(task.dueDate).toLocaleDateString()}</span>
                              </>
                            )}
                          </Typography>
                        </Stack>
                      </Box>
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Paper>
      </Box>

      <TaskFormDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveTask}
        task={
          editingTask
            ? {
                id: editingTask.id,
                title: editingTask.title,
                dueDate: editingTask.dueDate,
                scheduleId: editingTask.scheduleId,
                isCompleted: editingTask.isCompleted,
              }
            : null
        }
      />
    </Container>
  );
}
