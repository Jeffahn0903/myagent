'use client';

import React, { useState, useEffect } from 'react';
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
  SelectChangeEvent,
  Stack,
  Box,
  Typography,
  CircularProgress,
  Divider,
  Grid,
  Paper,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '@/contexts/AuthContext';

interface Customer {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

export interface ScheduleData {
  title: string;
  content: string;
  startTime: string;
  endTime: string;
  location: string;
  customerId: string | null;
  projectId?: string | null;
  attendees?: string | null;
}

interface ScheduleFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (schedule: ScheduleData) => void;
  schedule?: ScheduleData | null;
}

const initialScheduleState: ScheduleData = {
  title: '',
  content: '',
  startTime: '',
  endTime: '',
  location: '',
  customerId: null,
  projectId: null,
  attendees: '',
};

export default function ScheduleFormDialog({
  open,
  onClose,
  onSave,
  schedule,
}: ScheduleFormDialogProps) {
  const { token } = useAuth();
  const [formData, setFormData] = useState<ScheduleData>(initialScheduleState);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  
  // Quick project creation state
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProjectLoading, setCreatingProjectLoading] = useState(false);

  useEffect(() => {
    if (open && token) {
      // Fetch customers
      fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setCustomers(Array.isArray(data) ? data : []))
        .catch(() => {});

      // Fetch projects
      fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setProjects(Array.isArray(data) ? data : []))
        .catch(() => {});

      if (schedule) {
        setFormData({
          ...schedule,
          projectId: schedule.projectId || null,
          attendees: schedule.attendees || '',
        });
      } else {
        setFormData(initialScheduleState);
      }
      setIsCreatingProject(false);
      setNewProjectName('');
    }
  }, [open, token, schedule]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectCustomer = (event: SelectChangeEvent<string>) => {
    setFormData((prev) => ({ ...prev, customerId: event.target.value || null }));
  };

  const handleSelectProject = (event: SelectChangeEvent<string>) => {
    setFormData((prev) => ({ ...prev, projectId: event.target.value || null }));
  };

  // Create project on the fly
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
      setFormData((prev) => ({ ...prev, projectId: createdProject.id }));
      setIsCreatingProject(false);
      setNewProjectName('');
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingProjectLoading(false);
    }
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        {schedule ? '일정 수정' : '새 일정 작성'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            name="title"
            label="일정 제목 (Title)"
            type="text"
            fullWidth
            value={formData.title}
            onChange={handleChange}
            required
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                name="startTime"
                label="시작 일시"
                type="datetime-local"
                fullWidth
                value={formData.startTime}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                name="endTime"
                label="종료 일시"
                type="datetime-local"
                fullWidth
                value={formData.endTime}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
            </Grid>
          </Grid>

          {/* Project Select & Quick Create */}
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <FormControl fullWidth size="small">
                <InputLabel id="project-select-label">📁 관련 프로젝트 선택</InputLabel>
                <Select
                  labelId="project-select-label"
                  name="projectId"
                  value={formData.projectId || ''}
                  label="📁 관련 프로젝트 선택"
                  onChange={handleSelectProject}
                >
                  <MenuItem value="">
                    <em>프로젝트 미선택</em>
                  </MenuItem>
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
                sx={{ whitespace: 'nowrap', py: 0.8 }}
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
            name="location"
            label="장소 (Location)"
            type="text"
            fullWidth
            value={formData.location}
            onChange={handleChange}
          />

          <TextField
            name="attendees"
            label="👥 회의 참석자 (쉼표 구분)"
            placeholder="홍길동, 김철수, john@example.com"
            type="text"
            fullWidth
            value={formData.attendees || ''}
            onChange={handleChange}
          />

          <FormControl fullWidth>
            <InputLabel>관련 고객 선택</InputLabel>
            <Select
              name="customerId"
              value={formData.customerId || ''}
              label="관련 고객 선택"
              onChange={handleSelectCustomer}
            >
              <MenuItem value="">
                <em>선택 안 함</em>
              </MenuItem>
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            name="content"
            label="일정 상세 내용 / 안건"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={formData.content}
            onChange={handleChange}
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
  );
}
