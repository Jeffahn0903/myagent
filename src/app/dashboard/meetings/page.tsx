'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Paper,
  Divider,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import FolderIcon from '@mui/icons-material/Folder';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EmailIcon from '@mui/icons-material/Email';

interface Project {
  id: string;
  name: string;
}

interface MeetingRoom {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  accessType: 'PUBLIC' | 'RESTRICTED';
  allowedEmails?: string | null;
  project?: Project | null;
  host: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    messages: number;
    attendees: number;
  };
}

export default function MeetingsDashboardPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal Dialog State
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [accessTypeInput, setAccessTypeInput] = useState<'PUBLIC' | 'RESTRICTED'>('PUBLIC');
  const [allowedEmailsInput, setAllowedEmailsInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Invite Modal State
  const [openInviteModal, setOpenInviteModal] = useState(false);
  const [inviteRoomId, setInviteRoomId] = useState('');
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [inviting, setInviting] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  const fetchRoomsAndProjects = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [roomsRes, projRes] = await Promise.all([
        fetch('/api/meetings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!roomsRes.ok) throw new Error('회의실 목록을 가져오지 못했습니다.');
      const rData = await roomsRes.json();
      setRooms(rData);

      if (projRes.ok) {
        const pData = await projRes.json();
        setProjects(pData);
      }
    } catch (err: any) {
      setError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      fetchRoomsAndProjects();
    }
  }, [token, authLoading, router, fetchRoomsAndProjects]);

  const handleOpenCreateModal = () => {
    setTitleInput('');
    setDescInput('');
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setDateInput(`${YYYY}-${MM}-${DD}T${hh}:${mm}`);
    setSelectedProjectId('');
    setAccessTypeInput('PUBLIC');
    setAllowedEmailsInput('');
    setOpenCreateModal(true);
  };

  const handleCreateRoom = async () => {
    if (!token || !titleInput) {
      setError('회의실 제목을 입력해 주세요.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: titleInput,
          description: descInput,
          date: dateInput,
          projectId: selectedProjectId || undefined,
          accessType: accessTypeInput,
          allowedEmails: allowedEmailsInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '회의실 생성 실패');

      setSuccessMsg('✨ 온라인 회의실이 성공적으로 개설되었습니다!');
      setOpenCreateModal(false);
      fetchRoomsAndProjects();
    } catch (err: any) {
      setError(err?.message || '생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = (roomId: string, accessType: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/dashboard/meetings/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const handleOpenInviteModal = (roomId: string) => {
    setInviteRoomId(roomId);
    setInviteEmailInput('');
    setOpenInviteModal(true);
  };

  const handleSendInvite = async () => {
    if (!token || !inviteRoomId || !inviteEmailInput) return;
    setInviting(true);
    setError('');
    try {
      const res = await fetch(`/api/meetings/${inviteRoomId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmailInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '초대 실패');

      setSuccessMsg(`📧 ${inviteEmailInput} 주소로 회의실 초대 접근 권한이 부여되었습니다.`);
      setOpenInviteModal(false);
      fetchRoomsAndProjects();
    } catch (err: any) {
      setError(err?.message || '초대 중 오류가 발생했습니다.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Top Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
            💬 프로젝트 온라인 회의실 (Meeting Rooms)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            프로젝트별 온라인 회의실을 개설하고, 구글 드라이브 방식 권한 설정(공개/초대전용) 및 실시간 파일 자동 등록을 지원합니다.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateModal}
          sx={{ fontWeight: 700, px: 2.5 }}
        >
          + 신규 회의실 개설
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}

      {loading ? (
        <Box sx={{ p: 8, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : rooms.length === 0 ? (
        <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <ForumIcon sx={{ fontSize: 56, color: 'text.secondary', opacity: 0.4, mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>
            개설된 온라인 회의실이 없습니다.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            상단 버튼을 눌러 프로젝트와 연결된 첫 온라인 회의실을 개설해 보세요.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateModal} sx={{ fontWeight: 700 }}>
            + 신규 회의실 개설
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {rooms.map((room) => {
            const isPublic = room.accessType === 'PUBLIC';
            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={room.id}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
                  }}
                >
                  <CardContent sx={{ p: 2.5, flexGrow: 1 }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Chip
                        icon={isPublic ? <PublicIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                        label={isPublic ? '🌐 공개 (링크 공유)' : '🔒 초대전용 (제한됨)'}
                        size="small"
                        color={isPublic ? 'success' : 'warning'}
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        방장: {room.host.name}
                      </Typography>
                    </Stack>

                    <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800, mb: 1 }}>
                      {room.title}
                    </Typography>

                    {room.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {room.description}
                      </Typography>
                    )}

                    <Stack spacing={1} sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarMonthIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          일시: {new Date(room.date).toLocaleString('ko-KR')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FolderIcon fontSize="small" color="primary" />
                        <Typography variant="body2" color="primary.main" sx={{ fontWeight: 700 }}>
                          연동 프로젝트: {room.project ? room.project.name : '미지정 (일반)'}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>

                  <Divider />

                  <CardActions sx={{ p: 2, justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="링크 복사">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          onClick={() => handleCopyLink(room.id, room.accessType)}
                        >
                          {copiedId === room.id ? '복사됨!' : '링크'}
                        </Button>
                      </Tooltip>
                      {!isPublic && (
                        <Tooltip title="이메일 초대">
                          <IconButton size="small" color="primary" onClick={() => handleOpenInviteModal(room.id)}>
                            <EmailIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>

                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<ForumIcon />}
                      onClick={() => router.push(`/dashboard/meetings/${room.id}`)}
                      sx={{ fontWeight: 700 }}
                    >
                      💬 회의실 입장
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Modal 1: Create Meeting Room */}
      <Dialog open={openCreateModal} onClose={() => setOpenCreateModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>💬 신규 온라인 회의실 개설</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="회의실 제목"
              fullWidth
              size="small"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="예: 3분기 프로젝트 디자인 및 예산 검토 회의"
            />

            <TextField
              label="회의 안건 및 설명"
              multiline
              rows={2}
              fullWidth
              size="small"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
            />

            <TextField
              label="회의 일시"
              type="datetime-local"
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>연동 프로젝트 선택</InputLabel>
              <Select value={selectedProjectId} label="연동 프로젝트 선택" onChange={(e) => setSelectedProjectId(e.target.value)}>
                <MenuItem value="">연동 안 함 (일반 회의실)</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>공개 및 접근 권한 설정 (Drive 스타일)</InputLabel>
              <Select value={accessTypeInput} label="공개 및 접근 권한 설정 (Drive 스타일)" onChange={(e) => setAccessTypeInput(e.target.value as any)}>
                <MenuItem value="PUBLIC">🌐 오픈 회의실 (링크가 있는 모든 사용자 접속 가능)</MenuItem>
                <MenuItem value="RESTRICTED">🔒 초대전용 회의실 (초대받은 이메일 사용자만 접속)</MenuItem>
              </Select>
            </FormControl>

            {accessTypeInput === 'RESTRICTED' && (
              <TextField
                label="초대할 이메일 주소 목록 (쉼표로 구분)"
                multiline
                rows={2}
                fullWidth
                size="small"
                value={allowedEmailsInput}
                onChange={(e) => setAllowedEmailsInput(e.target.value)}
                placeholder="user1@example.com, user2@company.com"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreateModal(false)}>취소</Button>
          <Button variant="contained" onClick={handleCreateRoom} disabled={creating} sx={{ fontWeight: 700 }}>
            {creating ? '개설 중...' : '회의실 개설'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal 2: Invite Email */}
      <Dialog open={openInviteModal} onClose={() => setOpenInviteModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>📧 이메일 초대 링크 발송</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              초대할 사용자의 이메일 주소를 입력하시면 해당 계정의 접속 권한이 부여됩니다.
            </Typography>
            <TextField
              label="초대 이메일 주소"
              type="email"
              fullWidth
              size="small"
              value={inviteEmailInput}
              onChange={(e) => setInviteEmailInput(e.target.value)}
              placeholder="invited@company.com"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenInviteModal(false)}>취소</Button>
          <Button variant="contained" onClick={handleSendInvite} disabled={inviting} sx={{ fontWeight: 700 }}>
            {inviting ? '초대 중...' : '권한 부여'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
