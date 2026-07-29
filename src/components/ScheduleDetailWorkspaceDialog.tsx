'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Box,
  Typography,
  Divider,
  Paper,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddTaskIcon from '@mui/icons-material/AddTask';
import CloseIcon from '@mui/icons-material/Close';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TaskIcon from '@mui/icons-material/Task';
import FolderIcon from '@mui/icons-material/Folder';
import { useAuth } from '@/contexts/AuthContext';

interface Customer {
  id: string;
  name: string;
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

export interface ScheduleDetailData {
  id: string;
  title: string;
  content: string | null;
  meetingNotes: string | null;
  aiSummary: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  customerId: string | null;
  projectId: string | null;
  customer?: Customer | null;
  project?: ProjectOption | null;
  tasks?: ScheduleTask[];
}

interface ScheduleDetailWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  scheduleId: string | null;
  onScheduleUpdated?: () => void;
  onScheduleDeleted?: () => void;
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

export default function ScheduleDetailWorkspaceDialog({
  open,
  onClose,
  scheduleId,
  onScheduleUpdated,
  onScheduleDeleted,
}: ScheduleDetailWorkspaceDialogProps) {
  const { token } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleDetailData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Left Form State
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [content, setContent] = useState('');

  // Right Side State
  const [meetingNotes, setMeetingNotes] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

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

  const fetchScheduleDetails = useCallback(async () => {
    if (!token || !scheduleId) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('일정을 불러오지 못했습니다.');
      const data: ScheduleDetailData = await res.json();
      setSchedule(data);
      setTitle(data.title || '');
      setStartTime(toDatetimeLocal(data.startTime));
      setEndTime(toDatetimeLocal(data.endTime));
      setLocation(data.location || '');
      setCustomerId(data.customerId || '');
      setProjectId(data.projectId || '');
      setContent(data.content || '');
      setMeetingNotes(data.meetingNotes || '');
      setAiSummary(data.aiSummary || '');
      setTasks(data.tasks || []);
    } catch (err: any) {
      setError(err?.message || '일정 상세 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [token, scheduleId]);

  useEffect(() => {
    if (open && scheduleId) {
      fetchOptions();
      fetchScheduleDetails();
    }
  }, [open, scheduleId, fetchOptions, fetchScheduleDetails]);

  // Left side: Save Schedule Details
  const handleSaveScheduleInfo = async () => {
    if (!scheduleId || !token) return;
    setSavingSchedule(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          startTime,
          endTime,
          location,
          customerId: customerId || null,
          projectId: projectId || null,
          content,
          meetingNotes,
          aiSummary,
        }),
      });
      if (!res.ok) throw new Error('일정 업데이트 실패');
      setSuccessMsg('일정 정보가 성공적으로 저장되었습니다!');
      if (onScheduleUpdated) onScheduleUpdated();
    } catch (err: any) {
      setError(err?.message || '저장 중 오류 발생');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async () => {
    if (!scheduleId || !token) return;
    if (!window.confirm('정말로 이 일정을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('삭제 실패');
      if (onScheduleDeleted) onScheduleDeleted();
      onClose();
    } catch (err: any) {
      setError('일정 삭제 중 오류가 발생했습니다.');
    }
  };

  // Right side: Gemini AI Summarization
  const handleGenerateAiSummary = async () => {
    if (!scheduleId || !token) return;
    setGeneratingAi(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ meetingNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gemini AI 회의록 정리 실패');

      setAiSummary(data.aiSummary);
      setTasks(data.tasks || []);
      setSuccessMsg(data.message || 'Gemini AI가 회의록을 정돈하고 타스크를 생성했습니다!');
      if (onScheduleUpdated) onScheduleUpdated();
    } catch (err: any) {
      setError(err?.message || 'Gemini AI 회의록 처리 중 오류가 발생했습니다.');
    } finally {
      setGeneratingAi(false);
    }
  };

  // Right side: Task Management
  const handleAddTaskForSchedule = async () => {
    if (!scheduleId || !token || !newTaskTitle.trim()) return;
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTaskTitle }),
      });
      if (!res.ok) throw new Error('타스크 생성 실패');
      const newTask = await res.json();
      setTasks((prev) => [newTask, ...prev]);
      setNewTaskTitle('');
    } catch (err: any) {
      setError('타스크 추가 중 오류 발생');
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (err) {}
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth scroll="paper">
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc'), borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CalendarMonthIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            일정 및 미팅 회의록 워크스페이스
          </Typography>
          {title && <Chip label={title} color="primary" size="small" variant="outlined" />}
        </Stack>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

            <Grid container spacing={3}>
              {/* LEFT COLUMN: Schedule Information */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: (theme) => (theme.palette.mode === 'dark' ? 'divider' : '#e2e8f0'),
                    height: '100%',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    📌 일정 정보 작성 & 수정
                  </Typography>

                  <Stack spacing={2}>
                    <TextField
                      label="일정 제목 (Title)"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      fullWidth
                      required
                    />

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="시작 일시"
                          type="datetime-local"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                          required
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="종료 일시"
                          type="datetime-local"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                          required
                        />
                      </Grid>
                    </Grid>

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

                    <TextField
                      label="장소 (Location)"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      fullWidth
                      placeholder="회의실 또는 온라인 미팅 주소"
                    />

                    <FormControl fullWidth size="small">
                      <InputLabel>관련 고객 선택</InputLabel>
                      <Select
                        value={customerId}
                        label="관련 고객 선택"
                        onChange={(e) => setCustomerId(e.target.value)}
                      >
                        <MenuItem value=""><em>선택 안 함</em></MenuItem>
                        {customers.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="일정 상세 내용 / 안건"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      multiline
                      rows={3}
                      fullWidth
                    />

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', pt: 1 }}>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleDeleteSchedule}
                      >
                        삭제
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleSaveScheduleInfo}
                        disabled={savingSchedule}
                      >
                        {savingSchedule ? <CircularProgress size={20} /> : '일정 저장'}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>

              {/* RIGHT COLUMN: Meeting Minutes & Gemini AI & Tasks */}
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={3}>
                  {/* Meeting Notes Editor */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#ffffff'),
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        📝 미팅 회의록 (Meeting Notes)
                      </Typography>
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={generatingAi ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={handleGenerateAiSummary}
                        disabled={generatingAi}
                        sx={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                          fontWeight: 600,
                        }}
                      >
                        Gemini AI 회의록 정리
                      </Button>
                    </Box>

                    <TextField
                      placeholder="미팅 중 논의된 내용, 전달 사항, 결정 사항 등을 자유롭게 작성하세요..."
                      multiline
                      rows={5}
                      fullWidth
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      sx={{ mb: 2 }}
                    />

                    {/* Gemini AI Summary Result Box */}
                    {aiSummary && (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : '#f5f3ff'),
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: (theme) => (theme.palette.mode === 'dark' ? '#6d28d9' : '#ddd6fe'),
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, color: (theme) => (theme.palette.mode === 'dark' ? '#c084fc' : '#6d28d9') }}>
                          <AutoAwesomeIcon fontSize="small" /> Gemini AI 정돈 회의록
                        </Typography>
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            fontFamily: 'inherit',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: (theme) => (theme.palette.mode === 'dark' ? '#e0e7ff' : '#4c1d95'),
                            m: 0,
                          }}
                        >
                          {aiSummary}
                        </Typography>
                      </Paper>
                    )}
                  </Paper>

                  {/* Tasks Section for this Schedule */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#ffffff'),
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                      <TaskIcon color="primary" /> 이 일정의 실행 타스크 (Action Items)
                    </Typography>

                    {/* Add Task Input */}
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <TextField
                        size="small"
                        placeholder="이 미팅에서 발생한 할 일 추가..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTaskForSchedule();
                        }}
                        fullWidth
                      />
                      <Button
                        variant="contained"
                        startIcon={<AddTaskIcon />}
                        onClick={handleAddTaskForSchedule}
                        sx={{ whitespace: 'nowrap' }}
                      >
                        추가
                      </Button>
                    </Stack>

                    {/* Task List */}
                    {tasks.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ p: 1, textAlign: 'center' }}>
                        등록된 타스크가 없습니다. 회의록에서 AI가 자동으로 타스크를 생성할 수도 있습니다.
                      </Typography>
                    ) : (
                      <List dense disablePadding>
                        {tasks.map((task, idx) => (
                          <React.Fragment key={task.id}>
                            {idx > 0 && <Divider component="li" />}
                            <ListItem
                              secondaryAction={
                                <IconButton edge="end" size="small" onClick={() => handleDeleteTask(task.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              }
                            >
                              <Checkbox
                                edge="start"
                                checked={task.isCompleted}
                                onChange={() => handleToggleTask(task)}
                                color="primary"
                              />
                              <ListItemText
                                primary={
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      textDecoration: task.isCompleted ? 'line-through' : 'none',
                                      color: task.isCompleted ? 'text.secondary' : 'text.primary',
                                    }}
                                  >
                                    {task.title}
                                  </Typography>
                                }
                              />
                            </ListItem>
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </Paper>
                </Stack>
              </Grid>
            </Grid>
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          p: 2,
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc'),
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: 'space-between',
        }}
      >
        <Button
          onClick={handleDeleteSchedule}
          color="error"
          variant="outlined"
          startIcon={<DeleteIcon />}
          sx={{ fontWeight: 600 }}
        >
          일정 삭제
        </Button>
        <Button onClick={onClose} variant="contained">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}
