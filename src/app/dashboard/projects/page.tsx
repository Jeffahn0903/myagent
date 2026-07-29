'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  LinearProgress,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  driveFolderId: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  totalFileCount?: number;
  hasNewFiles?: boolean;
  _count: {
    schedules: number;
    tasks: number;
    notes: number;
    files: number;
  };
  tasks: { isCompleted: boolean }[];
}

export default function ProjectsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create Dialog States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit Dialog States
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [editProjectStatus, setEditProjectStatus] = useState('');
  const [editDriveFolderId, setEditDriveFolderId] = useState('');
  const [editProjectStartDate, setEditProjectStartDate] = useState('');
  const [editProjectEndDate, setEditProjectEndDate] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);
    } catch (err: any) {
      setError('프로젝트 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      fetchProjects();
    }
  }, [token, authLoading, router, fetchProjects]);

  const handleCreateProject = async () => {
    if (!projectName.trim() || !token) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          startDate: projectStartDate || null,
          endDate: projectEndDate || null,
        }),
      });
      if (!res.ok) throw new Error('프로젝트 생성 실패');
      setCreateDialogOpen(false);
      setProjectName('');
      setProjectDescription('');
      setProjectStartDate('');
      setProjectEndDate('');
      fetchProjects();
    } catch (err: any) {
      setError(err?.message || '프로젝트 생성 오류');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditDialog = (project: Project) => {
    setEditingProjectId(project.id);
    setEditProjectName(project.name);
    setEditProjectDescription(project.description || '');
    setEditProjectStatus(project.status);
    setEditDriveFolderId(project.driveFolderId || '');
    setEditProjectStartDate(project.startDate ? new Date(project.startDate).toISOString().substring(0, 10) : '');
    setEditProjectEndDate(project.endDate ? new Date(project.endDate).toISOString().substring(0, 10) : '');
    setEditDialogOpen(true);
  };

  const handleUpdateProject = async () => {
    if (!editProjectName.trim() || !token || !editingProjectId) return;
    setUpdating(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${editingProjectId}`, {
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
      fetchProjects();
    } catch (err: any) {
      setError(err?.message || '프로젝트 정보 수정 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      <Box sx={{ my: 4 }}>
        {/* Header Ribbon */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
          }}
        >
          <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <FolderIcon sx={{ fontSize: 40, color: '#3b82f6' }} />
                <Box>
                  <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: '#ffffff' }}>
                    프로젝트 워크스페이스 (Projects)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                    일자별 미팅, 타스크, 회의록, 메모 및 Google Drive 프로젝트 폴더를 통합 관리하세요.
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                sx={{
                  bgcolor: '#3b82f6',
                  '&:hover': { bgcolor: '#2563eb' },
                  borderRadius: 2,
                  px: 2.5,
                  py: 1.2,
                  fontWeight: 600,
                }}
              >
                새 프로젝트 생성
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

        {/* Project Cards Grid */}
        {projects.length === 0 ? (
          <Box
            sx={{
              p: 6,
              textAlign: 'center',
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
              borderRadius: 3,
              border: '1px dashed',
              borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#cbd5e1'),
            }}
          >
            <FolderIcon sx={{ fontSize: 60, color: '#94a3b8', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              등록된 프로젝트가 없습니다.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
              첫 번째 프로젝트를 생성하여 일자별 미팅, 회의록 및 Google Drive 폴더를 연결해보세요.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
              프로젝트 시작하기
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {projects.map((project) => {
              const totalTasks = project._count.tasks;
              const completedTasks = project.tasks.filter((t) => t.isCompleted).length;
              const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
                  <Card
                    elevation={2}
                    sx={{
                      borderRadius: 3,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
                    }}
                  >
                    <CardContent sx={{ p: 3, flexGrow: 1 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            {project.name}
                          </Typography>
                          {project.hasNewFiles && (
                            <Chip label="N" color="error" size="small" sx={{ fontWeight: 800, height: 20, px: 0.5 }} />
                          )}
                        </Stack>
                        <Chip
                          label={project.status}
                          color={project.status === 'ACTIVE' ? 'primary' : 'default'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Stack>

                      {project.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }} noWrap>
                          {project.description}
                        </Typography>
                      )}

                      {/* Project Period */}
                      {(project.startDate || project.endDate) && (
                        <Box sx={{ mb: 2 }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                            {project.startDate && (
                              <Chip
                                size="small"
                                label={`시작: ${new Date(project.startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`}
                                variant="outlined"
                                sx={{ fontSize: '0.75rem' }}
                              />
                            )}
                            {project.endDate && (
                              <Chip
                                size="small"
                                label={`목표: ${new Date(project.endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`}
                                color="primary"
                                variant="outlined"
                                sx={{ fontSize: '0.75rem' }}
                              />
                            )}
                          </Stack>
                        </Box>
                      )}

                      {/* Progress Bar */}
                      <Box sx={{ mb: 2.5 }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            타스크 진행률
                          </Typography>
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                            {progress}% ({completedTasks}/{totalTasks})
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.06)' }}
                        />
                      </Box>

                      {/* Aggregated Counters */}
                      <Grid container spacing={1} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 6 }}>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1,
                              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc'),
                              borderRadius: 1.5,
                              textAlign: 'center',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              📅 미팅
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                              {project._count.schedules} 건
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1,
                              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc'),
                              borderRadius: 1.5,
                              textAlign: 'center',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              📁 파일 (Files)
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                              {project.totalFileCount || project._count.files} 개
                              {project.hasNewFiles && (
                                <Chip label="N" color="error" size="small" sx={{ height: 16, fontSize: '0.6rem', ml: 0.5 }} />
                              )}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </CardContent>

                    <CardActions sx={{ px: 3, pb: 2.5, pt: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                      <Stack direction="row" spacing={1}>
                        {project.driveFolderId && (
                          <Tooltip title="Google Drive 프로젝트 폴더 열기">
                            <IconButton
                              size="small"
                              component="a"
                              href={`https://drive.google.com/drive/folders/${project.driveFolderId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ border: '1px solid', borderColor: 'divider' }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="프로젝트 정보 수정">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditDialog(project)}
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>

                      <Button
                        size="small"
                        variant="contained"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                      >
                        상세 워크스페이스
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* Create Project Modal */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold' }}>새 프로젝트 생성</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="프로젝트 이름 (Required)"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              fullWidth
              required
              placeholder="예: 2026 신규 클라우드 ERP 구축"
            />
            <TextField
              label="프로젝트 설명 / 목표"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder="프로젝트 목적, 주요 일정 및 담당 범위를 작성하세요..."
            />
            <TextField
              label="프로젝트 시작일"
              type="date"
              value={projectStartDate}
              onChange={(e) => setProjectStartDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="완료 목표일"
              type="date"
              value={projectEndDate}
              onChange={(e) => setProjectEndDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Alert severity="info" sx={{ borderRadius: 1.5 }}>
              💡 Google 계정이 연결되어 있다면 Google Drive에 **[Project] 폴더**가 자동으로 생성됩니다.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>취소</Button>
          <Button onClick={handleCreateProject} variant="contained" disabled={creating}>
            {creating ? <CircularProgress size={20} color="inherit" /> : '프로젝트 생성'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Modal */}
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
              <InputLabel id="edit-project-status-label">진행 상태</InputLabel>
              <Select
                labelId="edit-project-status-label"
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
          <Button onClick={handleUpdateProject} variant="contained" disabled={updating}>
            {updating ? <CircularProgress size={20} color="inherit" /> : '수정 완료'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
