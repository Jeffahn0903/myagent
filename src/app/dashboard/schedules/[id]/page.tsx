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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  Tooltip,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddTaskIcon from '@mui/icons-material/AddTask';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';
import TaskIcon from '@mui/icons-material/Task';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderIcon from '@mui/icons-material/Folder';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

interface Customer {
  id: string;
  name: string;
  company?: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface ScheduleTask {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate?: string | null;
}

interface AttachedFile {
  id: string;
  filename: string;
  fileUrl?: string | null;
  driveFileId?: string | null;
  mimeType?: string | null;
  isRead?: boolean;
  createdAt: string;
}

interface ScheduleDetail {
  id: string;
  title: string;
  content: string | null;
  meetingNotes: string | null;
  aiSummary: string | null;
  attendees: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  customerId: string | null;
  projectId: string | null;
  customer?: Customer | null;
  project?: ProjectOption | null;
  tasks?: ScheduleTask[];
}

const toDatetimeLocal = (dateStr: string | Date) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const ten = (i: number) => (i < 10 ? '0' : '') + i;
  const YYYY = date.getFullYear();
  const MM = ten(date.getMonth() + 1);
  const DD = ten(date.getDate());
  const HH = ten(date.getHours());
  const mm = ten(date.getMinutes());
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
};

export default function ScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Edit States
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [content, setContent] = useState('');

  // Quick project creation state
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProjectLoading, setCreatingProjectLoading] = useState(false);

  // Meeting Notes & AI & Tasks State
  const [meetingNotes, setMeetingNotes] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  
  // Candidate tasks extracted by AI but not yet registered
  const [candidateTasks, setCandidateTasks] = useState<{ id: number; title: string; checked: boolean }[]>([]);
  const [registeringCandidateTasks, setRegisteringCandidateTasks] = useState(false);

  const fetchOptions = useCallback(async () => {
    if (!token) return;
    try {
      const [custRes, projRes] = await Promise.all([
        fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData);
      }
      if (projRes.ok) {
        const projData = await projRes.json();
        setProjects(Array.isArray(projData) ? projData : []);
      }
    } catch (err) {}
  }, [token]);

  const fetchAttachedFiles = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await fetch(`/api/schedules/${id}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAttachedFiles(Array.isArray(data) ? data : []);
      }
    } catch (err) {}
  }, [token, id]);

  const fetchScheduleDetails = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('일정 정보를 가져오지 못했습니다.');
      const data: ScheduleDetail = await res.json();
      setSchedule(data);
      setTitle(data.title || '');
      setStartTime(toDatetimeLocal(data.startTime));
      setEndTime(toDatetimeLocal(data.endTime));
      setLocation(data.location || '');
      setAttendees(data.attendees || '');
      setCustomerId(data.customerId || '');
      setProjectId(data.projectId || '');
      setContent(data.content || '');
      setMeetingNotes(data.meetingNotes || '');
      setAiSummary(data.aiSummary || '');
      setTasks(data.tasks || []);
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
      return;
    }
    fetchOptions();
    fetchScheduleDetails();
    fetchAttachedFiles();
  }, [token, authLoading, router, id, fetchOptions, fetchScheduleDetails, fetchAttachedFiles]);

  // Save Schedule Info (Left side edit mode)
  const handleSaveScheduleInfo = async () => {
    if (!token || !id) return;
    setSavingSchedule(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          startTime,
          endTime,
          location,
          attendees,
          customerId: customerId || null,
          projectId: projectId || null,
          content,
          meetingNotes,
          aiSummary,
        }),
      });
      if (!res.ok) throw new Error('일정 수정에 실패했습니다.');
      const updated = await res.json();
      setSchedule(updated);
      setIsEditing(false);
      setSuccessMsg('일정 정보 및 프로젝트 연결이 수정되었습니다!');
    } catch (err: any) {
      setError(err?.message || '수정 저장 오류');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Quick project creation
  const handleQuickCreateProject = async () => {
    if (!token || !newProjectName.trim()) return;
    setCreatingProjectLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newProjectName }),
      });
      if (!res.ok) throw new Error('프로젝트 생성 실패');
      const createdProject = await res.json();
      setProjects((prev) => [createdProject, ...prev]);
      setProjectId(createdProject.id);
      setIsCreatingProject(false);
      setNewProjectName('');
    } catch (err: any) {
      alert(err.message || '오류가 발생했습니다.');
    } finally {
      setCreatingProjectLoading(false);
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async () => {
    if (!token || !id) return;
    if (!window.confirm('정말로 이 일정을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('삭제 실패');
      router.push('/dashboard/schedules');
    } catch (err: any) {
      setError('일정 삭제 실패');
    }
  };

  // Upload File & Sync Google Drive & Link to Project
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !id) return;

    setUploadingFile(true);
    setError('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/schedules/${id}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '파일 업로드 실패');

      setAttachedFiles((prev) => [data, ...prev]);
      setSuccessMsg(`파일 "${data.filename}"이(가) 회의록에 첨부되었으며 구글 드라이브 및 프로젝트 파일함에 자동 등록되었습니다!`);
    } catch (err: any) {
      setError(err?.message || '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!token || !id) return;
    if (!window.confirm('이 회의록 첨부파일을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/schedules/${id}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('파일 삭제 실패');
      setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
      setSuccessMsg('첨부파일이 삭제되었습니다.');
    } catch (err: any) {
      setError('파일 삭제 중 오류가 발생했습니다.');
    }
  };

  // Gemini AI Meeting Summary & Task Auto-Extraction
  const handleGenerateAiSummary = async () => {
    if (!token || !id) return;
    setGeneratingAi(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/schedules/${id}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ meetingNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gemini AI 회의록 분석 실패');

      setAiSummary(data.aiSummary);
      if (Array.isArray(data.candidateTasks)) {
        setCandidateTasks(data.candidateTasks.map((t: string, idx: number) => ({
          id: idx,
          title: t,
          checked: true
        })));
      }
      setSuccessMsg(data.message || 'Gemini AI 분석이 완료되었습니다! 아래에서 등록할 타스크를 확인해 주세요.');
    } catch (err: any) {
      setError(err?.message || 'Gemini AI 회의록 분석 중 오류가 발생했습니다.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleRegisterCandidateTasks = async () => {
    const tasksToRegister = candidateTasks.filter((t) => t.checked && t.title.trim());
    if (tasksToRegister.length === 0) return;
    setRegisteringCandidateTasks(true);
    let successCount = 0;
    setError('');
    setSuccessMsg('');
    try {
      for (const t of tasksToRegister) {
        const res = await fetch(`/api/schedules/${id}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: t.title }),
        });
        if (res.ok) {
          const newTask = await res.json();
          setTasks((prev) => [newTask, ...prev]);
          successCount++;
        }
      }
      setSuccessMsg(`${successCount}개의 타스크가 정상적으로 추가 등록되었습니다!`);
      setCandidateTasks([]);
    } catch (err: any) {
      setError('일부 타스크 등록 중 오류가 발생했습니다.');
    } finally {
      setRegisteringCandidateTasks(false);
    }
  };

  // Task Actions (Left Column)
  const handleAddTask = async () => {
    if (!token || !id || !newTaskTitle.trim()) return;
    try {
      const res = await fetch(`/api/schedules/${id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTaskTitle }),
      });
      if (!res.ok) throw new Error('타스크 추가 실패');
      const newTask = await res.json();
      setTasks((prev) => [newTask, ...prev]);
      setNewTaskTitle('');
    } catch (err: any) {
      setError('타스크 추가 실패');
    }
  };

  const handleToggleTask = async (task: ScheduleTask) => {
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, isCompleted: !t.isCompleted } : t)));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !task.isCompleted }),
      });
    } catch (err) {
      fetchScheduleDetails();
    }
  };

  const handleSaveEditTask = async (taskId: string) => {
    if (!editingTaskTitle.trim()) return;
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, title: editingTaskTitle } : t)));
    setEditingTaskId(null);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editingTaskTitle }),
      });
    } catch (err) {
      fetchScheduleDetails();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (err) {}
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

  if (!schedule) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">일정을 찾을 수 없거나 접근 권한이 없습니다.</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard/schedules')} sx={{ mt: 2 }}>
          일정 목록으로 돌아가기
        </Button>
      </Container>
    );
  }

  const attendeeList = schedule.attendees
    ? schedule.attendees.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Breadcrumb & Navigation Bar */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Breadcrumbs aria-label="breadcrumb">
          <MuiLink color="inherit" href="/dashboard" underline="hover">
            대시보드
          </MuiLink>
          <MuiLink color="inherit" href="/dashboard/schedules" underline="hover">
            일정 목록
          </MuiLink>
          <Typography color="text.primary" sx={{ fontWeight: 600 }}>
            {schedule.title}
          </Typography>
        </Breadcrumbs>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteSchedule}
            size="small"
          >
            일정 삭제
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/dashboard/schedules')}
            size="small"
          >
            목록으로
          </Button>
        </Stack>
      </Box>

      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <CalendarMonthIcon sx={{ fontSize: 36, color: '#3b82f6' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff' }}>
                {schedule.title}
              </Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                {new Date(schedule.startTime).toLocaleString()} ~ {new Date(schedule.endTime).toLocaleString()}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            {schedule.project && (
              <Chip
                icon={<FolderIcon fontSize="small" style={{ color: '#ffffff' }} />}
                label={`프로젝트: ${schedule.project.name}`}
                color="secondary"
                variant="filled"
                onClick={() => router.push(`/dashboard/projects/${schedule.project!.id}`)}
                clickable
              />
            )}
            {schedule.customer && (
              <Chip label={`고객: ${schedule.customer.name}`} color="primary" variant="filled" />
            )}
            {schedule.location && (
              <Chip icon={<LocationOnIcon />} label={schedule.location} color="info" variant="outlined" sx={{ color: '#ffffff', borderColor: '#3b82f6' }} />
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Global Alerts */}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{successMsg}</Alert>}

      {/* Main Full-Width Split Workspace */}
      <Grid container spacing={3}>
        {/* LEFT COLUMN: Schedule Info & Attendees (Read/Edit Mode) + Action Items Tasks */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            {/* Card 1: Schedule Details & Attendees */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  📌 일정 정보 & 참석자
                </Typography>
                {!isEditing ? (
                  <Tooltip title="일정 정보 수정">
                    <IconButton color="primary" onClick={() => setIsEditing(true)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Stack direction="row" spacing={0.5}>
                    <IconButton color="success" onClick={handleSaveScheduleInfo} disabled={savingSchedule}>
                      {savingSchedule ? <CircularProgress size={20} /> : <SaveIcon />}
                    </IconButton>
                    <IconButton color="error" onClick={() => setIsEditing(false)}>
                      <CancelIcon />
                    </IconButton>
                  </Stack>
                )}
              </Box>

              <Divider sx={{ mb: 2.5 }} />

              {/* Read Mode vs Edit Mode */}
              {!isEditing ? (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      일정 제목
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {schedule.title}
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        시작 일시
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {new Date(schedule.startTime).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        종료 일시
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {new Date(schedule.endTime).toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      📁 연결된 프로젝트 (Project)
                    </Typography>
                    {schedule.project ? (
                      <Chip
                        label={schedule.project.name}
                        color="secondary"
                        size="small"
                        onClick={() => router.push(`/dashboard/projects/${schedule.project!.id}`)}
                        clickable
                        sx={{ mt: 0.5 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                        연결된 프로젝트 없음 (수정 버튼을 눌러 선택)
                      </Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      장소 (Location)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                      <LocationOnIcon fontSize="small" color="action" />
                      {schedule.location || '미지정'}
                    </Typography>
                  </Box>

                  {/* Attendees Info View */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      👥 회의 참석자 (Attendees)
                    </Typography>
                    {attendeeList.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        등록된 참석자가 없습니다. (수정 버튼을 눌러 추가하세요)
                      </Typography>
                    ) : (
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                        {attendeeList.map((att, i) => (
                          <Chip key={i} icon={<PeopleIcon fontSize="small" />} label={att} size="small" variant="outlined" color="primary" />
                        ))}
                      </Stack>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      관련 고객 (Customer)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {schedule.customer ? `${schedule.customer.name} (${schedule.customer.company || '소속 없음'})` : '선택 안 함'}
                    </Typography>
                  </Box>

                  {schedule.content && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        일정 상세 설명 / 안건
                      </Typography>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                          mt: 0.5,
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'transparent'),
                        }}
                      >
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>{schedule.content}</Typography>
                      </Paper>
                    </Box>
                  )}

                  <Box sx={{ pt: 1, textAlign: 'right' }}>
                    <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={handleDeleteSchedule}>
                      일정 삭제
                    </Button>
                  </Box>
                </Stack>
              ) : (
                /* Form Edit Mode */
                <Stack spacing={2}>
                  <TextField
                    label="일정 제목"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    fullWidth
                    required
                    size="small"
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        label="시작 일시"
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        fullWidth
                        slotProps={{ inputLabel: { shrink: true } }}
                        size="small"
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        label="종료 일시"
                        type="datetime-local"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        fullWidth
                        slotProps={{ inputLabel: { shrink: true } }}
                        size="small"
                        required
                      />
                    </Grid>
                  </Grid>

                  <Box>
                    <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>📁 관련 프로젝트 선택</InputLabel>
                        <Select
                          value={projectId}
                          label="📁 관련 프로젝트 선택"
                          onChange={(e) => setProjectId(e.target.value)}
                        >
                          <MenuItem value=""><em>프로젝트 미선택</em></MenuItem>
                          {projects.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {p.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setIsCreatingProject(!isCreatingProject)}
                        sx={{ whiteSpace: 'nowrap', py: 0.8 }}
                      >
                        새 프로젝트
                      </Button>
                    </Stack>

                    {isCreatingProject && (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          mt: 1,
                          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'),
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'),
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block', color: 'text.primary' }}>
                          ✨ 새 프로젝트 생성 (Google Drive 폴더 자동 생성)
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <TextField
                            size="small"
                            placeholder="프로젝트 이름 입력..."
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            fullWidth
                          />
                          <Button
                            variant="contained"
                            size="small"
                            onClick={handleQuickCreateProject}
                            disabled={creatingProjectLoading}
                          >
                            {creatingProjectLoading ? <CircularProgress size={16} color="inherit" /> : '생성'}
                          </Button>
                        </Stack>
                      </Paper>
                    )}
                  </Box>

                  <TextField
                    label="장소 (Location)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    fullWidth
                    size="small"
                  />

                  <TextField
                    label="👥 회의 참석자 (쉼표로 구분 입력)"
                    placeholder="홍길동, 김철수, john@example.com"
                    value={attendees}
                    onChange={(e) => setAttendees(e.target.value)}
                    fullWidth
                    size="small"
                    helperText="여러 명인 경우 쉼표(,)로 구분하여 입력하세요."
                  />

                  <FormControl fullWidth size="small">
                    <InputLabel>관련 고객 선택</InputLabel>
                    <Select
                      value={customerId}
                      label="관련 고객 선택"
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      <MenuItem value="">선택 안 함</MenuItem>
                      {customers.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="일정 안건 / 상세 설명"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    multiline
                    rows={3}
                    fullWidth
                    size="small"
                  />

                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                    <Button variant="outlined" onClick={() => setIsEditing(false)}>
                      취소
                    </Button>
                    <Button variant="contained" onClick={handleSaveScheduleInfo} disabled={savingSchedule}>
                      {savingSchedule ? <CircularProgress size={20} /> : '수정 완료'}
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Paper>

            {/* Card 2: Action Items & Tasks */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TaskIcon color="primary" /> 이 일정의 실행 타스크 (Tasks)
                </Typography>
                <Chip label={`${tasks.length} 개`} color="primary" size="small" variant="outlined" />
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                우측 회의록 분석 시 Gemini AI가 생성한 타스크가 자동으로 이곳에 추가되며, 직접 수정 및 추가할 수 있습니다.
              </Typography>

              {/* Add New Task Input */}
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="새로운 Action Item 타스크 입력..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask();
                  }}
                  fullWidth
                />
                <Button variant="contained" startIcon={<AddTaskIcon />} onClick={handleAddTask} sx={{ whitespace: 'nowrap' }}>
                  추가
                </Button>
              </Stack>

              {/* Task List */}
              {tasks.length === 0 ? (
                <Box
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'transparent'),
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    등록된 타스크가 없습니다. 회의록을 작성하고 Gemini AI 분석을 실행해 보세요.
                  </Typography>
                </Box>
              ) : (
                <List dense disablePadding>
                  {tasks.map((t, idx) => (
                    <React.Fragment key={t.id}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        sx={{ py: 1, px: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                        secondaryAction={
                          <Stack direction="row" spacing={0.5}>
                            {editingTaskId === t.id ? (
                              <IconButton size="small" color="success" onClick={() => handleSaveEditTask(t.id)}>
                                <SaveIcon fontSize="small" />
                              </IconButton>
                            ) : (
                              <IconButton size="small" color="primary" onClick={() => {
                                setEditingTaskId(t.id);
                                setEditingTaskTitle(t.title);
                              }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            )}
                            <IconButton size="small" color="error" onClick={() => handleDeleteTask(t.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        }
                      >
                        <Checkbox
                          edge="start"
                          checked={t.isCompleted}
                          onChange={() => handleToggleTask(t)}
                          color="primary"
                        />
                        {editingTaskId === t.id ? (
                          <TextField
                            size="small"
                            value={editingTaskTitle}
                            onChange={(e) => setEditingTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditTask(t.id);
                            }}
                            autoFocus
                            fullWidth
                            sx={{ mr: 6 }}
                          />
                        ) : (
                          <ListItemText
                            primary={
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 500,
                                  textDecoration: t.isCompleted ? 'line-through' : 'none',
                                  color: t.isCompleted ? 'text.secondary' : 'text.primary',
                                }}
                              >
                                {t.title}
                              </Typography>
                            }
                          />
                        )}
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Stack>
        </Grid>

        {/* RIGHT COLUMN: Full-Height Meeting Minutes Editor, File Attachments & Gemini AI Summarizer */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            {/* Editor & Gemini AI Paper */}
            <Paper elevation={2} sx={{ p: 3.5, borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionIcon color="primary" /> 미팅 회의록 (Full-Height Meeting Notes Editor)
                </Typography>
                <Button
                  variant="contained"
                  startIcon={generatingAi ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={handleGenerateAiSummary}
                  disabled={generatingAi}
                  sx={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    color: '#ffffff',
                    fontWeight: 600,
                    px: 2.5,
                    py: 1,
                    boxShadow: '0 4px 14px rgba(109, 40, 217, 0.3)',
                  }}
                >
                  Gemini AI 회의록 분석 & 타스크 생성
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                회의 중 발생한 메모나 필기 내용을 작성하고 상단의 **[Gemini AI 회의록 분석]** 버튼을 누르면 AI가 회의록을 표준 구조로 정돈하고 실행 타스크를 추출하여 좌측 영역에 생성합니다.
              </Typography>

              <TextField
                placeholder="미팅 중 논의된 내용, 전달 사항, 결정 사항 등을 자유롭게 입력하세요..."
                multiline
                minRows={12}
                maxRows={25}
                fullWidth
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                sx={{
                  mb: 3,
                  flexGrow: 1,
                  '& .MuiInputBase-root': {
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa',
                  },
                }}
              />

              {/* Gemini AI Result Section */}
              {aiSummary && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.15)' : '#f5f3ff',
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.3)' : '#ddd6fe',
                    boxShadow: '0 2px 10px rgba(139, 92, 246, 0.08)',
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                    <AutoAwesomeIcon sx={{ color: (theme) => theme.palette.mode === 'dark' ? '#c084fc' : '#7c3aed' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: (theme) => theme.palette.mode === 'dark' ? '#e9d5ff' : '#5b21b6' }}>
                      Gemini AI 회의록 정돈 & 요약 결과
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 2, borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.3)' : '#ddd6fe' }} />
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      fontFamily: 'inherit',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: (theme) => theme.palette.mode === 'dark' ? '#e9d5ff' : '#3730a3',
                      fontSize: '0.9rem',
                      lineHeight: 1.7,
                      m: 0,
                    }}
                  >
                    {aiSummary}
                  </Typography>
                </Paper>
              )}

              {/* Candidate Tasks Selection Box */}
              {candidateTasks.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    mt: 2.5,
                    borderRadius: 2.5,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    🎯 추출된 타스크 검토 및 선택 등록
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    회의록에서 행동 지침(Action Item)으로 추정되는 할 일 목록을 추출했습니다. 등록할 항목을 체크하거나 문구를 필요에 맞게 수정한 뒤 [선택한 타스크 등록]을 눌러주세요.
                  </Typography>

                  <Stack spacing={1.5}>
                    {candidateTasks.map((t) => (
                      <Stack key={t.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Checkbox
                          checked={t.checked}
                          onChange={(e) => {
                            setCandidateTasks(prev => prev.map(item => item.id === t.id ? { ...item, checked: e.target.checked } : item));
                          }}
                          size="small"
                        />
                        <TextField
                          size="small"
                          fullWidth
                          value={t.title}
                          onChange={(e) => {
                            setCandidateTasks(prev => prev.map(item => item.id === t.id ? { ...item, title: e.target.value } : item));
                          }}
                          sx={{
                            '& .MuiInputBase-root': {
                              height: 36,
                              fontSize: '0.85rem',
                            }
                          }}
                        />
                      </Stack>
                    ))}
                  </Stack>

                  <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setCandidateTasks([])}
                    >
                      취소
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={registeringCandidateTasks ? <CircularProgress size={16} color="inherit" /> : <AddTaskIcon />}
                      onClick={handleRegisterCandidateTasks}
                      disabled={registeringCandidateTasks || candidateTasks.filter(c => c.checked).length === 0}
                    >
                      선택한 타스크 등록
                    </Button>
                  </Box>
                </Paper>
              )}
            </Paper>

            {/* Meeting File Attachments Section (Google Drive Sync & Project Integration) */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AttachFileIcon color="primary" /> 📎 회의록 첨부파일 (Google Drive 자동 동기화)
                </Typography>

                <Button
                  component="label"
                  variant="contained"
                  startIcon={uploadingFile ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
                  disabled={uploadingFile}
                  sx={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    fontWeight: 600,
                    px: 2,
                  }}
                >
                  {uploadingFile ? '구글 드라이브 업로드 중...' : '파일 첨부하기'}
                  <input type="file" hidden onChange={handleFileUpload} />
                </Button>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                첨부한 파일은 **Google Drive**에 자동 업로드되며, 이 일정이 연동된 **프로젝트 통합 파일함**에서도 통합되어 관리됩니다.
              </Typography>

              <Divider sx={{ mb: 2 }} />

              {attachedFiles.length === 0 ? (
                <Box
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'transparent'),
                  }}
                >
                  <InsertDriveFileIcon sx={{ fontSize: 36, color: '#94a3b8', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    등록된 회의록 첨부파일이 없습니다. 상단의 **[파일 첨부하기]** 버튼을 눌러 추가하세요.
                  </Typography>
                </Box>
              ) : (
                <List dense disablePadding>
                  {attachedFiles.map((file, idx) => {
                    const isNew = !file.isRead && (Date.now() - new Date(file.createdAt).getTime() < 12 * 60 * 60 * 1000);

                    return (
                      <React.Fragment key={file.id}>
                        {idx > 0 && <Divider component="li" />}
                        <ListItem
                          sx={{ py: 1.5, px: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'action.hover' } }}
                          secondaryAction={
                            <Stack direction="row" spacing={1}>
                              {file.fileUrl && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<OpenInNewIcon fontSize="small" />}
                                  href={file.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={async () => {
                                    try {
                                      await fetch(`/api/files/${file.id}/read`, {
                                        method: 'PATCH',
                                        headers: { Authorization: `Bearer ${token}` },
                                      });
                                      fetchAttachedFiles();
                                    } catch (e) {}
                                  }}
                                >
                                  열기
                                </Button>
                              )}
                              <IconButton size="small" color="error" onClick={() => handleDeleteFile(file.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          }
                        >
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                            <InsertDriveFileIcon color="primary" />
                            <Box>
                              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {file.filename}
                                </Typography>
                                {isNew && (
                                  <Chip
                                    label="N"
                                    color="error"
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800, px: 0.5 }}
                                  />
                                )}
                                {file.driveFileId && (
                                  <Chip
                                    icon={<FolderIcon fontSize="small" />}
                                    label="Google Drive 동기화됨"
                                    color="success"
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
                                  />
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                등록일시: {new Date(file.createdAt).toLocaleString()}
                              </Typography>
                            </Box>
                          </Stack>
                        </ListItem>
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
