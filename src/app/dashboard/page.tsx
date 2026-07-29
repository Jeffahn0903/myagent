'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Alert,
  Button,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TaskIcon from '@mui/icons-material/Task';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useRouter } from 'next/navigation';
import WeatherWidget from '@/components/WeatherWidget';
import NewsWidget from '@/components/NewsWidget';
import ActivityWidget from '@/components/ActivityWidget';
import ScheduleFormDialog, { ScheduleData } from '@/components/ScheduleFormDialog';
import TaskFormDialog, { TaskData } from '@/components/TaskFormDialog';
import ScheduleDetailWorkspaceDialog from '@/components/ScheduleDetailWorkspaceDialog';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  _count?: {
    schedules: number;
    tasks: number;
  };
  tasks?: { isCompleted: boolean }[];
}

interface Schedule {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string | null;
}

interface ScheduleRef {
  id: string;
  title: string;
}

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate?: string | null;
  scheduleId?: string | null;
  schedule?: ScheduleRef | null;
  project?: {
    id: string;
    name: string;
  } | null;
}

interface DriveFile {
  id: string;
  projectId?: string;
  name: string;
  isFolder?: boolean;
  mimeType?: string;
  fileCount?: number;
  hasNewFiles?: boolean;
  webViewLink?: string;
  iconLink?: string;
  isRead?: boolean;
  isNew?: boolean;
}

const getDDayBadge = (dueDateStr?: string | null) => {
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

export default function DashboardPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [error, setError] = useState('');

  // Dialog States
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [projectsRes, schedulesRes, tasksRes] = await Promise.all([
        fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(Array.isArray(projectsData) ? projectsData : []);
      }

      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json();
        setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
      }
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      }

      fetch('/api/drive/files', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setDriveFiles(Array.isArray(data) ? data : []))
        .catch(() => {});
    } catch (err) {
      setError('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [token, authLoading, router, fetchData]);

  // Filter 2-Week Schedules (오늘 ~ 14일 뒤 이내 일정)
  const twoWeeksSchedules = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(today.getDate() + 14);
    twoWeeksLater.setHours(23, 59, 59, 999);

    return schedules.filter((s) => {
      const sTime = new Date(s.startTime);
      return sTime >= today && sTime <= twoWeeksLater;
    });
  }, [schedules]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    if (taskFilter === 'pending') return tasks.filter((t) => !t.isCompleted);
    if (taskFilter === 'completed') return tasks.filter((t) => t.isCompleted);
    return tasks;
  }, [tasks, taskFilter]);

  const handleToggleTask = async (task: Task) => {
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, isCompleted: !t.isCompleted } : t)));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !task.isCompleted }),
      });
    } catch (error) {
      fetchData();
      setError('타스크 업데이트에 실패했습니다.');
    }
  };

  const handleSaveSchedule = async (scheduleData: ScheduleData) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(scheduleData),
      });
      if (!res.ok) throw new Error('일정 등록 실패');
      setScheduleDialogOpen(false);
      fetchData();
    } catch (err) {
      setError('새 일정을 등록하지 못했습니다.');
    }
  };

  const handleSaveTask = async (taskData: TaskData) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) throw new Error('타스크 등록 실패');
      setTaskDialogOpen(false);
      fetchData();
    } catch (err) {
      setError('새 타스크를 등록하지 못했습니다.');
    }
  };

  if (authLoading || loading) {
    return (
      <Container maxWidth={false} sx={{ py: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  if (!user) return null;

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      <Box>
        {/* Global Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* 4 Core Vertical Smartphone-Styled Widget Cards (좌에서 우로 한 줄 배열) */}
        <Grid
          container
          spacing={2.5}
          sx={{
            mb: 3,
            flexWrap: { xs: 'nowrap', xl: 'wrap' },
            overflowX: { xs: 'auto', xl: 'visible' },
            pb: 1.5,
          }}
        >
          {/* CARD 1: 📁 프로젝트 (Projects Vertical Card Widget) - Max 5 */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ minWidth: { xs: 290, sm: 300, md: 310, xl: 'auto' } }}>
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 3,
                height: 460,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.8, color: 'primary.main' }}>
                  <FolderIcon fontSize="small" /> 프로젝트 ({projects.length})
                </Typography>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                  onClick={() => router.push('/dashboard/projects')}
                  sx={{ fontWeight: 600, fontSize: '0.8rem', p: 0.5 }}
                >
                  상세
                </Button>
              </Box>

              {projects.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2, my: 'auto' }}>
                  <FolderIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    등록된 프로젝트가 없습니다.
                  </Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => router.push('/dashboard/projects')} sx={{ mt: 1 }}>
                    새 프로젝트
                  </Button>
                </Box>
              ) : (
                <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
                  {projects.slice(0, 5).map((p, idx) => {
                    const totalT = p._count?.tasks || 0;
                    const compT = p.tasks?.filter((t) => t.isCompleted).length || 0;
                    const prog = totalT > 0 ? Math.round((compT / totalT) * 100) : 0;

                    return (
                      <React.Fragment key={p.id}>
                        {idx > 0 && <Divider component="li" />}
                        <ListItem
                          onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                          sx={{
                            py: 1.2,
                            px: 1,
                            borderRadius: 1.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <Box sx={{ flexGrow: 1 }}>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }} noWrap>
                                {p.name}
                              </Typography>
                              <Chip label={p.status} size="small" color={p.status === 'ACTIVE' ? 'primary' : 'default'} sx={{ height: 18, fontSize: '0.65rem' }} />
                            </Stack>
                            {(p.startDate || p.endDate) && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3, fontSize: '0.7rem' }}>
                                {p.startDate && new Date(p.startDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                {p.startDate && p.endDate ? ' ~ ' : ''}
                                {p.endDate && new Date(p.endDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                              </Typography>
                            )}
                            <Box sx={{ mt: 0.5 }}>
                              <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.3 }}>
                                <Typography variant="caption" color="text.secondary">
                                  달성률
                                </Typography>
                                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                                  {prog}%
                                </Typography>
                              </Stack>
                              <LinearProgress variant="determinate" value={prog} sx={{ height: 4, borderRadius: 2 }} />
                            </Box>
                          </Box>
                        </ListItem>
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Paper>
          </Grid>

          {/* CARD 2: 🗓️ 2주 이내 일정 (2-Week Schedules Vertical Card Widget) - Max 5 */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ minWidth: { xs: 290, sm: 300, md: 310, xl: 'auto' } }}>
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 3,
                height: 460,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.8, color: 'primary.main' }}>
                  <CalendarMonthIcon fontSize="small" /> 2주 이내 일정 ({twoWeeksSchedules.length})
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <IconButton color="primary" size="small" onClick={() => setScheduleDialogOpen(true)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon fontSize="small" />}
                    onClick={() => router.push('/dashboard/schedules')}
                    sx={{ fontWeight: 600, fontSize: '0.8rem', p: 0.5 }}
                  >
                    상세
                  </Button>
                </Stack>
              </Box>

              {twoWeeksSchedules.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2, my: 'auto' }}>
                  <ScheduleIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    2주 이내 예정된 일정이 없습니다.
                  </Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setScheduleDialogOpen(true)} sx={{ mt: 1 }}>
                    새 일정
                  </Button>
                </Box>
              ) : (
                <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
                  {twoWeeksSchedules.slice(0, 5).map((s, idx) => (
                    <React.Fragment key={s.id}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        onClick={() => router.push(`/dashboard/schedules/${s.id}`)}
                        sx={{
                          py: 1.2,
                          px: 1,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }} noWrap>
                            {s.title}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 0.3, alignItems: 'center' }}>
                            <Typography variant="caption" color="text.primary" sx={{ fontWeight: 600 }}>
                              {new Date(s.startTime).toLocaleDateString()} {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Stack>
                        </Box>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>

          {/* CARD 3: 🎯 타스크 카드 (Tasks Vertical Card Widget) - Max 5 */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ minWidth: { xs: 290, sm: 300, md: 310, xl: 'auto' } }}>
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 3,
                height: 460,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.8, color: 'primary.main' }}>
                  <TaskIcon fontSize="small" /> 내 할 일 ({filteredTasks.length})
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <IconButton color="primary" size="small" onClick={() => setTaskDialogOpen(true)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon fontSize="small" />}
                    onClick={() => router.push('/dashboard/tasks')}
                    sx={{ fontWeight: 600, fontSize: '0.8rem', p: 0.5 }}
                  >
                    상세
                  </Button>
                </Stack>
              </Box>

              {/* Filter Chips */}
              <Stack direction="row" spacing={0.5} sx={{ mb: 1.5 }}>
                <Chip
                  label="진행중"
                  size="small"
                  color={taskFilter === 'pending' ? 'primary' : 'default'}
                  onClick={() => setTaskFilter('pending')}
                  clickable
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
                <Chip
                  label="완료"
                  size="small"
                  color={taskFilter === 'completed' ? 'success' : 'default'}
                  onClick={() => setTaskFilter('completed')}
                  clickable
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
                <Chip
                  label="전체"
                  size="small"
                  color={taskFilter === 'all' ? 'primary' : 'default'}
                  variant={taskFilter === 'all' ? 'filled' : 'outlined'}
                  onClick={() => setTaskFilter('all')}
                  clickable
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              </Stack>

              {filteredTasks.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2, my: 'auto' }}>
                  <CheckCircleIcon sx={{ fontSize: 36, color: '#10b981', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {taskFilter === 'pending' ? '모든 타스크 완료! 🎉' : '등록된 타스크가 없습니다.'}
                  </Typography>
                </Box>
              ) : (
                <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
                  {filteredTasks.slice(0, 5).map((t, idx) => {
                    const dDayInfo = getDDayBadge(t.dueDate);
                    return (
                      <React.Fragment key={t.id}>
                        {idx > 0 && <Divider component="li" />}
                        <ListItem
                          dense
                          sx={{
                            py: 1,
                            px: 1,
                            borderRadius: 1,
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          secondaryAction={
                            <Checkbox
                              edge="end"
                              onChange={() => handleToggleTask(t)}
                              checked={t.isCompleted}
                              color="primary"
                              size="small"
                            />
                          }
                        >
                          <Box sx={{ flexGrow: 1, pr: 5, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                textDecoration: t.isCompleted ? 'line-through' : 'none',
                                color: t.isCompleted ? 'text.secondary' : 'text.primary',
                                fontSize: '0.85rem',
                              }}
                              noWrap
                            >
                              {t.title}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.3, alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                              {t.project && (
                                <Chip
                                  label={t.project.name}
                                  size="small"
                                  variant="outlined"
                                  sx={{ 
                                    height: 18, 
                                    fontSize: '0.65rem', 
                                    fontWeight: 'bold',
                                    maxWidth: 120,
                                    borderColor: 'primary.main',
                                    color: 'primary.main',
                                    '& .MuiChip-label': {
                                      px: 0.8,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }
                                  }}
                                />
                              )}
                              {dDayInfo && (
                                <Chip
                                  label={dDayInfo.label}
                                  color={dDayInfo.color}
                                  size="small"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }}
                                />
                              )}
                            </Stack>
                          </Box>
                        </ListItem>
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Paper>
          </Grid>

          {/* CARD 4: 📁 Drive 파일 카드 (Drive Files Vertical Card Widget) - Max 5 */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ minWidth: { xs: 290, sm: 300, md: 310, xl: 'auto' } }}>
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 3,
                height: 460,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.8, color: 'primary.main' }}>
                  <InsertDriveFileIcon fontSize="small" /> Drive 파일 ({driveFiles.length})
                </Typography>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                  onClick={() => router.push('/dashboard/settings')}
                  sx={{ fontWeight: 600, fontSize: '0.8rem', p: 0.5 }}
                >
                  설정
                </Button>
              </Box>

              {!user.hasGoogleAuth ? (
                <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2, my: 'auto' }}>
                  <FolderIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Google 계정 미연동
                  </Typography>
                  <Button size="small" variant="contained" href="/api/auth/google/initiate" sx={{ mt: 1 }}>
                    Google 연동
                  </Button>
                </Box>
              ) : driveFiles.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, my: 'auto', textAlign: 'center' }}>
                  Google Drive 파일이 없습니다.
                </Typography>
              ) : (
                <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
                  {driveFiles.slice(0, 5).map((f, idx) => (
                    <React.Fragment key={f.id}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        sx={{ py: 1, px: 0.5 }}
                        secondaryAction={
                          f.webViewLink ? (
                            <Tooltip title="열기 / 이동">
                              <IconButton
                                edge="end"
                                component="a"
                                href={f.webViewLink}
                                target={f.isFolder ? '_self' : '_blank'}
                                rel="noopener noreferrer"
                                size="small"
                                onClick={async () => {
                                  if (!f.isFolder && f.id && !f.id.startsWith('gdrive-') && !f.id.startsWith('proj-')) {
                                    try {
                                      await fetch(`/api/files/${f.id}/read`, {
                                        method: 'PATCH',
                                        headers: { Authorization: `Bearer ${token}` },
                                      });
                                      fetchData();
                                    } catch (e) {}
                                  }
                                }}
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null
                        }
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }} noWrap>
                                {f.name}
                              </Typography>

                              {f.isFolder && f.fileCount !== undefined && (
                                <Chip
                                  label={`파일 ${f.fileCount}개`}
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                              )}

                              {(f.hasNewFiles || f.isNew) && (
                                <Chip
                                  label="N"
                                  size="small"
                                  color="error"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, px: 0.5 }}
                                />
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Bottom 3-Column Auxiliary Grid: Weather (Narrow) | Live News (Center) | Activity Log (Right) */}
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 3, lg: 2.8 }}>
            <WeatherWidget />
          </Grid>
          <Grid size={{ xs: 12, md: 4.5, lg: 4.6 }}>
            <NewsWidget />
          </Grid>
          <Grid size={{ xs: 12, md: 4.5, lg: 4.6 }}>
            <ActivityWidget />
          </Grid>
        </Grid>

        {/* Dialog Modals */}
        <ScheduleFormDialog
          open={scheduleDialogOpen}
          onClose={() => setScheduleDialogOpen(false)}
          onSave={handleSaveSchedule}
        />
        <TaskFormDialog
          open={taskDialogOpen}
          onClose={() => setTaskDialogOpen(false)}
          onSave={handleSaveTask}
        />
        <ScheduleDetailWorkspaceDialog
          open={!!selectedScheduleId}
          scheduleId={selectedScheduleId}
          onClose={() => setSelectedScheduleId(null)}
          onScheduleUpdated={fetchData}
          onScheduleDeleted={fetchData}
        />
      </Box>
    </Container>
  );
}
