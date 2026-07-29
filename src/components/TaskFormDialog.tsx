'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Chip,
  Box,
  Autocomplete,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskData {
  id?: string;
  title: string;
  dueDate: string | null;
  scheduleId?: string | null;
  projectId?: string | null;
  isCompleted: boolean;
}

interface ScheduleOption {
  id: string;
  title: string;
  startTime: string;
  projectId?: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (task: TaskData) => void;
  task?: TaskData | null;
}

const initialTaskState: TaskData = {
  title: '',
  dueDate: null,
  scheduleId: '',
  projectId: '',
  isCompleted: false,
};

// Helper: Extract Date (MM/DD) from title text (e.g. "07/22", "7/22", "7월 22일")
const extractDateFromText = (text: string): Date | null => {
  if (!text) return null;
  
  // Match MM/DD or M/D (e.g. 07/22 or 7/22)
  const matchSlash = text.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\b/);
  if (matchSlash) {
    const m = parseInt(matchSlash[1], 10);
    const d = parseInt(matchSlash[2], 10);
    const year = new Date().getFullYear();
    return new Date(year, m - 1, d);
  }
  
  // Match Korean style "M월 D일" or "MM월 DD일"
  const matchKorean = text.match(/\b(0?[1-9]|1[0-2])\s*월\s*(0?[1-9]|[12]\d|3[01])\s*일/);
  if (matchKorean) {
    const m = parseInt(matchKorean[1], 10);
    const d = parseInt(matchKorean[2], 10);
    const year = new Date().getFullYear();
    return new Date(year, m - 1, d);
  }
  
  return null;
};

export default function TaskFormDialog({
  open,
  onClose,
  onSave,
  task,
}: TaskFormDialogProps) {
  const { token } = useAuth();
  const [formData, setFormData] = useState<TaskData>(initialTaskState);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // Sub-dialogs state for Quick Create
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);

  // Quick Create Inputs
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  const [newSchedTitle, setNewSchedTitle] = useState('');
  const [newSchedStart, setNewSchedStart] = useState('');
  const [newSchedEnd, setNewSchedEnd] = useState('');
  const [newSchedProjId, setNewSchedProjId] = useState('');

  // Fetch Schedules & Projects & Initialize Form Data
  useEffect(() => {
    if (open && token) {
      // Fetch schedules
      fetch('/api/schedules', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setSchedules(Array.isArray(data) ? data : []))
        .catch(() => {});

      // Fetch projects
      fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setProjects(Array.isArray(data) ? data : []))
        .catch(() => {});

      if (task) {
        setFormData({
          ...task,
          scheduleId: task.scheduleId || '',
          projectId: task.projectId || '',
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString().substring(0, 10) : '',
        });
      } else {
        setFormData(initialTaskState);
      }
    }
  }, [task, open, token]);

  // Recommendation 1: Auto-recommend schedule by date mentioned in the Task Title
  useEffect(() => {
    if (open && schedules.length > 0 && formData.title && !formData.scheduleId) {
      const extractedDate = extractDateFromText(formData.title);
      if (extractedDate) {
        const matched = schedules.find((s) => {
          const sDate = new Date(s.startTime);
          return sDate.getMonth() === extractedDate.getMonth() && sDate.getDate() === extractedDate.getDate();
        });
        if (matched) {
          setFormData((prev) => ({ 
            ...prev, 
            scheduleId: matched.id,
            projectId: matched.projectId || prev.projectId || ''
          }));
        }
      }
    }
  }, [formData.title, schedules, open, formData.scheduleId]);

  // Recommendation 2: Auto-recommend schedule by Task Due Date match
  useEffect(() => {
    if (open && schedules.length > 0 && formData.dueDate && !formData.scheduleId) {
      const due = new Date(formData.dueDate);
      const matched = schedules.find((s) => {
        const sDate = new Date(s.startTime);
        return (
          sDate.getFullYear() === due.getFullYear() &&
          sDate.getMonth() === due.getMonth() &&
          sDate.getDate() === due.getDate()
        );
      });
      if (matched) {
        setFormData((prev) => ({ 
          ...prev, 
          scheduleId: matched.id,
          projectId: matched.projectId || prev.projectId || ''
        }));
      }
    }
  }, [formData.dueDate, schedules, open, formData.scheduleId]);

  const handleChange = (event: any) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleScheduleChange = (scheduleIdVal: string) => {
    const selectedSched = schedules.find((s) => s.id === scheduleIdVal);
    setFormData((prev) => ({
      ...prev,
      scheduleId: scheduleIdVal,
      projectId: selectedSched?.projectId || prev.projectId || '',
    }));
  };

  const handleQuickCreateProject = async () => {
    if (!newProjName.trim() || !token) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newProjName, description: newProjDesc }),
      });
      if (res.ok) {
        const createdProject = await res.json();
        setProjects((prev) => [createdProject, ...prev]);
        setFormData((prev) => ({ ...prev, projectId: createdProject.id }));
        setNewProjName('');
        setNewProjDesc('');
        setQuickProjectOpen(false);
      }
    } catch (err) {
      console.error('Failed to create quick project:', err);
    }
  };

  const handleQuickCreateSchedule = async () => {
    if (!newSchedTitle.trim() || !newSchedStart || !newSchedEnd || !token) return;
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newSchedTitle,
          startTime: newSchedStart,
          endTime: newSchedEnd,
          projectId: newSchedProjId || null,
        }),
      });
      if (res.ok) {
        const createdSchedule = await res.json();
        setSchedules((prev) => [createdSchedule, ...prev]);
        setFormData((prev) => ({
          ...prev,
          scheduleId: createdSchedule.id,
          projectId: createdSchedule.projectId || prev.projectId || '',
        }));
        setNewSchedTitle('');
        setNewSchedStart('');
        setNewSchedEnd('');
        setNewSchedProjId('');
        setQuickScheduleOpen(false);
      }
    } catch (err) {
      console.error('Failed to create quick schedule:', err);
    }
  };

  const calculateDDayText = (dueDateStr: string | null) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: 'D-Day (오늘까지)', color: 'error' as const };
    if (diffDays > 0) return { label: `D-${diffDays} (D-Day까지 ${diffDays}일 남음)`, color: 'primary' as const };
    return { label: `D+${Math.abs(diffDays)} (${Math.abs(diffDays)}일 기한 초과)`, color: 'warning' as const };
  };

  const dDayInfo = calculateDDayText(formData.dueDate);

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {task ? '타스크 수정' : '새 타스크 작성'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              name="title"
              label="타스크 제목 (Action Item)"
              type="text"
              fullWidth
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="예: 회의 결과 공유서 작성 및 제출"
            />

            {/* Searchable Project Autocomplete + Inline Creation */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Autocomplete
                options={projects}
                getOptionLabel={(option) => option.name}
                value={projects.find((p) => p.id === formData.projectId) || null}
                onChange={(event, newValue) => {
                  setFormData((prev) => ({ ...prev, projectId: newValue ? newValue.id : '' }));
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="📁 관련 프로젝트 연결 (선택)"
                    placeholder="프로젝트 검색..."
                  />
                )}
                sx={{ flexGrow: 1 }}
              />
              <Button
                variant="outlined"
                onClick={() => setQuickProjectOpen(true)}
                sx={{ height: 56, minWidth: 110 }}
              >
                + 프로젝트
              </Button>
            </Box>

            {/* Searchable Schedule Autocomplete + Inline Creation */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Autocomplete
                options={schedules}
                getOptionLabel={(option) => {
                  const formattedDate = new Date(option.startTime).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  });
                  return `${option.title} (${formattedDate})`;
                }}
                value={schedules.find((s) => s.id === formData.scheduleId) || null}
                onChange={(event, newValue) => {
                  handleScheduleChange(newValue ? newValue.id : '');
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="📅 관련 일정 연결 (검색/선택)"
                    placeholder="일정 검색..."
                  />
                )}
                sx={{ flexGrow: 1 }}
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setNewSchedProjId(formData.projectId || '');
                  setQuickScheduleOpen(true);
                }}
                sx={{ height: 56, minWidth: 110 }}
              >
                + 일정 생성
              </Button>
            </Box>

            {/* Due Date & D-Day */}
            <Box>
              <TextField
                name="dueDate"
                label="🎯 마감일 선택 (디데이 설정)"
                type="date"
                fullWidth
                value={formData.dueDate || ''}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {dDayInfo && (
                <Chip
                  icon={<EventAvailableIcon fontSize="small" />}
                  label={dDayInfo.label}
                  color={dDayInfo.color}
                  sx={{ mt: 1, fontWeight: 'bold' }}
                />
              )}
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  name="isCompleted"
                  checked={formData.isCompleted}
                  onChange={handleChange}
                  color="primary"
                />
              }
              label="완료 처리"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose}>취소</Button>
          <Button onClick={handleSave} variant="contained">
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Project Dialog */}
      <Dialog open={quickProjectOpen} onClose={() => setQuickProjectOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>새 프로젝트 간편 생성</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="프로젝트 명 *"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="프로젝트 설명"
              value={newProjDesc}
              onChange={(e) => setNewProjDesc(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickProjectOpen(false)}>취소</Button>
          <Button onClick={handleQuickCreateProject} variant="contained" disabled={!newProjName.trim()}>
            생성
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Schedule Dialog */}
      <Dialog open={quickScheduleOpen} onClose={() => setQuickScheduleOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>새 일정 간편 생성</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="일정 명 *"
              value={newSchedTitle}
              onChange={(e) => setNewSchedTitle(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="시작 일시 *"
              type="datetime-local"
              value={newSchedStart}
              onChange={(e) => setNewSchedStart(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="종료 일시 *"
              type="datetime-local"
              value={newSchedEnd}
              onChange={(e) => setNewSchedEnd(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="quick-sched-proj-select-label">📁 관련 프로젝트 연결</InputLabel>
              <Select
                labelId="quick-sched-proj-select-label"
                value={newSchedProjId}
                label="📁 관련 프로젝트 연결"
                onChange={(e) => setNewSchedProjId(e.target.value)}
              >
                <MenuItem value="">
                  <em>프로젝트 연결 안 함</em>
                </MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickScheduleOpen(false)}>취소</Button>
          <Button
            onClick={handleQuickCreateSchedule}
            variant="contained"
            disabled={!newSchedTitle.trim() || !newSchedStart || !newSchedEnd}
          >
            생성
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
