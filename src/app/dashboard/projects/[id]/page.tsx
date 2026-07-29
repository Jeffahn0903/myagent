'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Divider,
  Breadcrumbs,
  Link as MuiLink,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TaskIcon from '@mui/icons-material/Task';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleIcon from '@mui/icons-material/People';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import AddTaskIcon from '@mui/icons-material/AddTask';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ScheduleFormDialog, { ScheduleData } from '@/components/ScheduleFormDialog';
import TaskFormDialog, { TaskData } from '@/components/TaskFormDialog';

interface Customer {
  id: string;
  name: string;
  company?: string | null;
}

interface ScheduleTask {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate?: string | null;
}

interface ScheduleItem {
  id: string;
  title: string;
  content: string | null;
  meetingNotes: string | null;
  aiSummary: string | null;
  attendees: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  customer?: Customer | null;
  tasks?: ScheduleTask[];
}

interface ProjectTask {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  scheduleId?: string | null;
}

interface ProjectNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface ProjectFile {
  id: string;
  filename: string;
  fileUrl: string | null;
  driveFileId: string | null;
  mimeType: string | null;
  isRead?: boolean;
  createdAt: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  driveFolderId: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  schedules: ScheduleItem[];
  tasks: ProjectTask[];
  notes: ProjectNote[];
  files: ProjectFile[];
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiReport, setAiReport] = useState('');

  // Dialog & Form States
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [filenameInput, setFilenameInput] = useState('');
  const [fileUrlInput, setFileUrlInput] = useState('');

  // Edit Project Info States
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [editProjectStatus, setEditProjectStatus] = useState('');
  const [editDriveFolderId, setEditDriveFolderId] = useState('');
  const [editProjectStartDate, setEditProjectStartDate] = useState('');
  const [editProjectEndDate, setEditProjectEndDate] = useState('');
  const [updatingProject, setUpdatingProject] = useState(false);

  const fetchProjectDetails = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('프로젝트 정보를 불러오지 못했습니다.');
      const data = await res.json();
      setProject(data);
    } catch (err: any) {
      setError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      fetchProjectDetails();
    }
  }, [token, authLoading, router, id, fetchProjectDetails]);

  // AI Comprehensive Project Analysis
  const handleRunAiAnalysis = async () => {
    if (!token || !id) return;
    setAnalyzingAi(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/projects/${id}/ai-analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 프로젝트 분석 실패');
      setAiReport(data.report);
      setSuccessMsg(data.message || 'Gemini AI 프로젝트 종합 분석이 완료되었습니다!');
      setActiveTab(3);
    } catch (err: any) {
      setError(err?.message || 'AI 프로젝트 분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Add Project Note
  const handleAddNote = async () => {
    if (!token || !id || !noteTitle.trim() || !noteContent.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: noteTitle, content: noteContent }),
      });
      if (!res.ok) throw new Error('메모 등록 실패');
      setNoteTitle('');
      setNoteContent('');
      fetchProjectDetails();
    } catch (err) {
      setError('메모 등록 중 오류가 발생했습니다.');
    }
  };

  // Add Project File
  const handleAddFile = async () => {
    if (!token || !id || !filenameInput.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filename: filenameInput, fileUrl: fileUrlInput }),
      });
      if (!res.ok) throw new Error('파일 등록 실패');
      setFilenameInput('');
      setFileUrlInput('');
      fetchProjectDetails();
    } catch (err) {
      setError('파일 등록 중 오류가 발생했습니다.');
    }
  };

  // Save Schedule inside Project
  const handleSaveSchedule = async (scheduleData: ScheduleData) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...scheduleData, projectId: id }),
      });
      if (!res.ok) throw new Error('일정 등록 실패');
      setScheduleDialogOpen(false);
      fetchProjectDetails();
    } catch (err) {
      setError('새 일정을 등록하지 못했습니다.');
    }
  };

  // Save Task inside Project (supports both creation and edit)
  const handleSaveTask = async (taskData: TaskData) => {
    const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
    const method = editingTask ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...taskData, projectId: id }),
      });
      if (!res.ok) throw new Error('타스크 저장 실패');
      setTaskDialogOpen(false);
      setEditingTask(null);
      fetchProjectDetails();
    } catch (err) {
      setError('타스크를 저장하지 못했습니다.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!token) return;
    if (!confirm('이 타스크를 정말로 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchProjectDetails();
      } else {
        throw new Error();
      }
    } catch (err) {
      setError('타스크 삭제 실패');
    }
  };

  const handleToggleTask = async (taskId: string, isCompleted: boolean) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !isCompleted }),
      });
      fetchProjectDetails();
    } catch (err) {}
  };

  const handleOpenEditDialog = () => {
    if (!project) return;
    setEditProjectName(project.name);
    setEditProjectDescription(project.description || '');
    setEditProjectStatus(project.status);
    setEditDriveFolderId(project.driveFolderId || '');
    setEditProjectStartDate(project.startDate ? new Date(project.startDate).toISOString().substring(0, 10) : '');
    setEditProjectEndDate(project.endDate ? new Date(project.endDate).toISOString().substring(0, 10) : '');
    setEditDialogOpen(true);
  };

  const handleUpdateProject = async () => {
    if (!editProjectName.trim() || !token || !id) return;
    setUpdatingProject(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editProjectName,
          description: editProjectDescription,
          status: editProjectStatus,
          driveFolderId: editDriveFolderId || null,
          startDate: editProjectStartDate || null,
          endDate: editProjectEndDate || null,
        }),
      });
      if (!res.ok) throw new Error('프로젝트 수정 실패');
      setEditDialogOpen(false);
      setSuccessMsg('프로젝트 정보가 성공적으로 수정되었습니다.');
      fetchProjectDetails();
    } catch (err: any) {
      setError(err?.message || '프로젝트 수정 중 오류가 발생했습니다.');
    } finally {
      setUpdatingProject(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Container maxWidth={false} sx={{ py: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  if (!project) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">프로젝트를 찾을 수 없습니다.</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard/projects')} sx={{ mt: 2 }}>
          프로젝트 목록으로 돌아가기
        </Button>
      </Container>
    );
  }

  // Extract All Stakeholders (Attendees & Customers)
  const allAttendeesSet = new Set<string>();
  project.schedules.forEach((s) => {
    if (s.customer) allAttendeesSet.add(`고객: ${s.customer.name} (${s.customer.company || ''})`);
    if (s.attendees) {
      s.attendees.split(',').forEach((a) => allAttendeesSet.add(a.trim()));
    }
  });
  const uniqueStakeholders = Array.from(allAttendeesSet).filter(Boolean);

  // Group items by Date for Timeline View
  const timelineGroup: { [date: string]: { schedules: ScheduleItem[]; notes: ProjectNote[] } } = {};
  project.schedules.forEach((s) => {
    const dateKey = new Date(s.startTime).toLocaleDateString();
    if (!timelineGroup[dateKey]) timelineGroup[dateKey] = { schedules: [], notes: [] };
    timelineGroup[dateKey].schedules.push(s);
  });
  project.notes.forEach((n) => {
    const dateKey = new Date(n.createdAt).toLocaleDateString();
    if (!timelineGroup[dateKey]) timelineGroup[dateKey] = { schedules: [], notes: [] };
    timelineGroup[dateKey].notes.push(n);
  });

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Breadcrumbs aria-label="breadcrumb">
          <MuiLink color="inherit" href="/dashboard" underline="hover">
            대시보드
          </MuiLink>
          <MuiLink color="inherit" href="/dashboard/projects" underline="hover">
            프로젝트 목록
          </MuiLink>
          <Typography color="text.primary" sx={{ fontWeight: 600 }}>
            {project.name}
          </Typography>
        </Breadcrumbs>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard/projects')} size="small">
          목록으로
        </Button>
      </Box>

      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3.5,
          mb: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <FolderIcon sx={{ fontSize: 40, color: '#3b82f6' }} />
              <Box>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff' }}>
                    {project.name}
                  </Typography>
                  <Chip
                    label={project.status}
                    color={project.status === 'ACTIVE' ? 'primary' : 'default'}
                    size="small"
                    sx={{ color: '#ffffff', fontWeight: 600 }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                  {project.description || '등록된 프로젝트 목적/설명이 없습니다.'}
                </Typography>
                {(project.startDate || project.endDate) && (
                  <Stack direction="row" spacing={2} sx={{ mt: 1, color: '#94a3b8', fontSize: '0.85rem' }}>
                    {project.startDate && (
                      <span>시작일: {new Date(project.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    )}
                    {project.endDate && (
                      <span>완료 목표일: {new Date(project.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    )}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center' }}>
              {project.driveFolderId && (
                <Button
                  variant="outlined"
                  startIcon={<OpenInNewIcon fontSize="small" />}
                  component="a"
                  href={`https://drive.google.com/drive/folders/${project.driveFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: '#ffffff', borderColor: '#3b82f6' }}
                >
                  Google Drive 폴더
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleOpenEditDialog}
                sx={{ color: '#ffffff', borderColor: '#cbd5e1' }}
              >
                정보 수정
              </Button>
              <Button
                variant="contained"
                startIcon={analyzingAi ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                onClick={handleRunAiAnalysis}
                disabled={analyzingAi}
                sx={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', fontWeight: 600 }}
              >
                Gemini AI 프로젝트 종합 분석
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Global Alerts */}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{successMsg}</Alert>}

      {/* Stakeholders & Related Persons Ribbon */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2.5,
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc'),
          border: '1px solid',
          borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
        }}
      >
        <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.primary' }}>
            <PeopleIcon color="primary" fontSize="small" /> 프로젝트 관계자 (Stakeholders):
          </Typography>
          {uniqueStakeholders.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              미팅에 참석자 정보가 등록되면 자동으로 이곳에 수집됩니다.
            </Typography>
          ) : (
            uniqueStakeholders.map((person, idx) => (
              <Chip key={idx} label={person} size="small" variant="outlined" color="primary" />
            ))
          )}
        </Stack>
      </Paper>

      {/* Workspace Navigation Tabs */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'transparent' }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} indicatorColor="primary" textColor="primary">
          <Tab label="🗓️ 일자별 타임라인 모아보기" />
          <Tab label={`🎯 프로젝트 타스크 (${project.tasks.length})`} />
          <Tab label={`📝 메모 & 파일 (${project.notes.length + project.files.length})`} />
          <Tab label="🤖 Gemini AI 종합 보고서" />
        </Tabs>
      </Paper>

      {/* TAB 0: Daily Timeline View */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                📅 일자별 미팅 및 활동 타임라인
              </Typography>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setScheduleDialogOpen(true)}>
                이 프로젝트에 일정 추가
              </Button>
            </Box>

            {Object.keys(timelineGroup).length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc'),
                  borderRadius: 2,
                }}
              >
                <CalendarMonthIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  이 프로젝트에 연결된 미팅 일정이 없습니다.
                </Typography>
              </Paper>
            ) : (
              Object.keys(timelineGroup).map((date) => (
                <Paper key={date} elevation={2} sx={{ p: 2.5, mb: 2.5, borderRadius: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#3b82f6', mb: 1.5, pb: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    🗓️ {date}
                  </Typography>

                  {/* Schedules on this date */}
                  <List disablePadding>
                    {timelineGroup[date].schedules.map((s) => (
                      <ListItem
                        key={s.id}
                        onClick={() => router.push(`/dashboard/schedules/${s.id}`)}
                        sx={{
                          py: 1.5,
                          px: 1.5,
                          mb: 1,
                          borderRadius: 2,
                          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa'),
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                              {s.title}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Typography variant="caption" color="text.secondary">
                                시간: {new Date(s.startTime).toLocaleTimeString()}
                              </Typography>
                              {s.location && <Chip label={`장소: ${s.location}`} size="small" variant="outlined" />}
                              {s.attendees && <Chip label={`참석자: ${s.attendees}`} size="small" color="info" variant="outlined" />}
                              {s.aiSummary && <Chip label="✨ Gemini 회의록 작성됨" size="small" color="secondary" />}
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}

                    {/* Notes on this date */}
                    {timelineGroup[date].notes.map((n) => (
                      <Paper
                        key={n.id}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          mb: 1,
                          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.15)' : '#f5f3ff'),
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: (theme) => (theme.palette.mode === 'dark' ? '#6d28d9' : '#ddd6fe'),
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: (theme) => (theme.palette.mode === 'dark' ? '#c084fc' : '#6d28d9') }}>
                          📝 메모: {n.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {n.content}
                        </Typography>
                      </Paper>
                    ))}
                  </List>
                </Paper>
              ))
            )}
          </Grid>

          {/* Side Summary Panel */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2.5, mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                <TaskIcon color="primary" /> 빠른 실행 타스크
              </Typography>
              <List dense disablePadding>
                {project.tasks.slice(0, 5).map((t) => (
                  <ListItem key={t.id} dense disableGutters>
                    <Checkbox
                      edge="start"
                      checked={t.isCompleted}
                      onChange={() => handleToggleTask(t.id, t.isCompleted)}
                    />
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ textDecoration: t.isCompleted ? 'line-through' : 'none', color: 'text.primary' }}>
                          {t.title}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              <Button variant="outlined" size="small" fullWidth startIcon={<AddIcon />} onClick={() => setTaskDialogOpen(true)} sx={{ mt: 1.5 }}>
                타스크 추가
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* TAB 1: Tasks Tab */}
      {activeTab === 1 && (
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              🎯 프로젝트 타스크 목록
            </Typography>
            <Button variant="contained" startIcon={<AddTaskIcon />} onClick={() => setTaskDialogOpen(true)}>
              타스크 추가
            </Button>
          </Box>

          <List disablePadding>
            {project.tasks.map((task, idx) => (
              <React.Fragment key={task.id}>
                {idx > 0 && <Divider component="li" />}
                <ListItem
                  sx={{
                    py: 1.5,
                    borderRadius: 1.5,
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                    }
                  }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        edge="end"
                        aria-label="edit"
                        size="small"
                        onClick={() => {
                          setEditingTask(task);
                          setTaskDialogOpen(true);
                        }}
                        sx={{ color: 'text.secondary' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        size="small"
                        onClick={() => handleDeleteTask(task.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <Checkbox
                    checked={task.isCompleted}
                    onChange={() => handleToggleTask(task.id, task.isCompleted)}
                    color="primary"
                    sx={{ mr: 1 }}
                  />
                  <ListItemText
                    onClick={() => {
                      setEditingTask(task);
                      setTaskDialogOpen(true);
                    }}
                    sx={{ cursor: 'pointer' }}
                    primary={
                      <Typography variant="subtitle1" sx={{ textDecoration: task.isCompleted ? 'line-through' : 'none', color: 'text.primary', fontWeight: 500 }}>
                        {task.title}
                      </Typography>
                    }
                    secondary={task.dueDate ? `마감일: ${new Date(task.dueDate).toLocaleDateString()}` : '마감일 미설정'}
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* TAB 2: Notes & Files Tab */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          {/* Notes Section */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                <NoteAddIcon color="primary" /> 프로젝트 노트 & 메모
              </Typography>

              <Stack spacing={1.5} sx={{ mb: 3 }}>
                <TextField
                  size="small"
                  label="메모 제목"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="메모 내용"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                />
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNote}>
                  메모 저장
                </Button>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <List disablePadding>
                {project.notes.map((note) => (
                  <Paper
                    key={note.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {note.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      {note.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      작성일: {new Date(note.createdAt).toLocaleString()}
                    </Typography>
                  </Paper>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Files & Drive Section */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                <InsertDriveFileIcon color="primary" /> 프로젝트 관련 파일 & Google Drive
              </Typography>

              <Stack spacing={1.5} sx={{ mb: 3 }}>
                <TextField
                  size="small"
                  label="파일명 (Filename)"
                  value={filenameInput}
                  onChange={(e) => setFilenameInput(e.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="파일 링크 / Google Drive URL (선택)"
                  value={fileUrlInput}
                  onChange={(e) => setFileUrlInput(e.target.value)}
                  fullWidth
                />
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddFile}>
                  파일 등록
                </Button>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <List disablePadding>
                {project.files.map((file) => {
                  const isNew = !file.isRead && (Date.now() - new Date(file.createdAt).getTime() < 12 * 60 * 60 * 1000);

                  return (
                    <ListItem key={file.id} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <InsertDriveFileIcon color="action" sx={{ mr: 1.5 }} />
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                              {file.filename}
                            </Typography>
                            {isNew && (
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
                      {file.fileUrl && (
                        <IconButton
                          size="small"
                          component="a"
                          href={file.fileUrl}
                          target="_blank"
                          onClick={async () => {
                            try {
                              await fetch(`/api/files/${file.id}/read`, {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              fetchProjectDetails();
                            } catch (e) {}
                          }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      )}
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* TAB 3: Gemini AI Comprehensive Project Analysis */}
      {activeTab === 3 && (
        <Paper elevation={2} sx={{ p: 3.5, borderRadius: 3, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
              <AutoAwesomeIcon color="secondary" /> Gemini AI 프로젝트 종합 분석 보고서
            </Typography>
            <Button
              variant="contained"
              startIcon={analyzingAi ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleRunAiAnalysis}
              disabled={analyzingAi}
              sx={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
            >
              분석 재실행
            </Button>
          </Box>

          {!aiReport ? (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : '#f5f3ff'),
                borderRadius: 2,
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 48, color: '#8b5cf6', mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: (theme) => (theme.palette.mode === 'dark' ? '#c084fc' : '#5b21b6') }}>
                Gemini AI 프로젝트 종합 분석 보고서를 작성해보세요!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                상단 **[Gemini AI 프로젝트 종합 분석]** 버튼을 누르면 이 프로젝트의 모든 미팅 회의록, 타스크, 메모 및 파일을 바탕으로 종합 현황 및 추천 액션을 자동 생성합니다.
              </Typography>
              <Button variant="contained" color="secondary" onClick={handleRunAiAnalysis}>
                지금 분석 실행
              </Button>
            </Box>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : '#f5f3ff'),
                borderRadius: 2,
                border: '1px solid',
                borderColor: (theme) => (theme.palette.mode === 'dark' ? '#6d28d9' : '#ddd6fe'),
              }}
            >
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'inherit',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: (theme) => (theme.palette.mode === 'dark' ? '#e0e7ff' : '#3730a3'),
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  m: 0,
                }}
              >
                {aiReport}
              </Typography>
            </Paper>
          )}
        </Paper>
      )}

      {/* Dialog Modals */}
      <ScheduleFormDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onSave={handleSaveSchedule}
      />
      <TaskFormDialog
        open={taskDialogOpen}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
        }}
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

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold' }}>프로젝트 정보 수정</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="프로젝트 이름"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="프로젝트 설명 / 목표"
              value={editProjectDescription}
              onChange={(e) => setEditProjectDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="detail-project-status-label">진행 상태</InputLabel>
              <Select
                labelId="detail-project-status-label"
                value={editProjectStatus}
                label="진행 상태"
                onChange={(e) => setEditProjectStatus(e.target.value as string)}
              >
                <MenuItem value="ACTIVE">ACTIVE (진행중)</MenuItem>
                <MenuItem value="COMPLETED">COMPLETED (완료)</MenuItem>
                <MenuItem value="ON_HOLD">ON_HOLD (보류)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="프로젝트 시작일"
              type="date"
              value={editProjectStartDate}
              onChange={(e) => setEditProjectStartDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="완료 목표일"
              type="date"
              value={editProjectEndDate}
              onChange={(e) => setEditProjectEndDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Google Drive 폴더 ID"
              value={editDriveFolderId}
              onChange={(e) => setEditDriveFolderId(e.target.value)}
              fullWidth
              placeholder="구글 드라이브 폴더의 고유 ID 값을 입력하세요"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
          <Button onClick={handleUpdateProject} variant="contained" disabled={updatingProject}>
            {updatingProject ? <CircularProgress size={20} color="inherit" /> : '수정 완료'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
