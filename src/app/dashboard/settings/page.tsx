'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import SyncIcon from '@mui/icons-material/Sync';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import SaveIcon from '@mui/icons-material/Save';

export default function SettingsPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newsKeywords, setNewsKeywords] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [hasGoogleAuth, setHasGoogleAuth] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('설정을 불러오지 못했습니다.');
      const data = await res.json();
      setName(data.name || '');
      setEmail(data.email || '');
      setNewsKeywords(data.newsKeywords || 'AI, 비즈니스, IT, 클라우드');
      setHasGoogleAuth(data.hasGoogleAuth || false);
    } catch (err: any) {
      setError(err?.message || '설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      fetchSettings();
    }
  }, [token, authLoading, router, fetchSettings]);

  const handleSaveSettings = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name,
          newsKeywords,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '설정 저장 실패');

      setSuccessMsg('설정이 성공적으로 저장되었습니다!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err?.message || '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncGoogle = async () => {
    if (!token) return;
    setSyncing(true);
    setSuccessMsg('');
    setError('');
    try {
      await Promise.all([
        fetch('/api/google/calendar/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/google/tasks/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setSuccessMsg('Google 캘린더 및 타스크 동기화가 완료되었습니다!');
    } catch (err) {
      setError('Google 데이터 동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddKeywordPreset = (preset: string) => {
    const currentList = newsKeywords
      ? newsKeywords.split(',').map((k) => k.trim()).filter(Boolean)
      : [];
    if (!currentList.includes(preset)) {
      setNewsKeywords([...currentList, preset].join(', '));
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3.5,
          mb: 4,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <SettingsIcon sx={{ fontSize: 40, color: '#3b82f6' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff' }}>
              시스템 & 계정 설정 (Settings)
            </Typography>
            <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
              프로필 관리, 구글 계정 연동 상태, 캘린더/타스크 동기화 및 관심 뉴스 키워드를 설정하세요.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Global Alerts */}
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}

      <Grid container spacing={3}>
        {/* Left Column: Account Profile & Google Integration */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            {/* User Profile Card */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon color="primary" /> 사용자 프로필 (User Profile)
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="이메일 계정 (ID)"
                  value={email}
                  disabled
                  fullWidth
                  helperText="이메일 계정은 변경할 수 없습니다."
                />
                <TextField
                  label="사용자 이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                />
              </Stack>
            </Paper>

            {/* Password Change Card */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon color="primary" /> 비밀번호 변경 (Password)
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="현재 비밀번호"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  fullWidth
                  placeholder="비밀번호 변경 시에만 입력"
                />
                <TextField
                  label="새 비밀번호 (최소 6자)"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  fullWidth
                />
              </Stack>
            </Paper>

            {/* Connected Services Card */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SyncIcon color="primary" /> 연결된 계정 & 서비스 (Integrations)
              </Typography>

              <Card elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Google Workspace 계정 연동
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Google Calendar, Google Tasks, Google Drive 연동 상태
                    </Typography>
                  </Box>
                  {hasGoogleAuth ? (
                    <Chip label="연결됨 🟢" color="success" size="small" sx={{ fontWeight: 600 }} />
                  ) : (
                    <Chip label="미연동 🔴" color="error" size="small" sx={{ fontWeight: 600 }} />
                  )}
                </Stack>
              </Card>

              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  component="a"
                  href="/api/auth/google/initiate"
                  startIcon={<SyncIcon />}
                >
                  {hasGoogleAuth ? 'Google 계정 다시 연결' : 'Google 계정 연결하기'}
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                  onClick={handleSyncGoogle}
                  disabled={syncing || !hasGoogleAuth}
                >
                  수동 동기화 실행
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </Grid>

        {/* Right Column: Custom News Keywords & Save */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            {/* Custom News Keywords Card */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <NewspaperIcon color="primary" /> 관심 뉴스 키워드 설정 (Custom News Keywords)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                원하는 뉴스 키워드를 쉼표(,)로 구분하여 입력해 주세요. 실시간 뉴스 위젯과 뉴스 분석 메뉴에서 이 키워드를 기반으로 뉴스가 제공됩니다.
              </Typography>

              <TextField
                label="관심 뉴스 키워드 목록"
                value={newsKeywords}
                onChange={(e) => setNewsKeywords(e.target.value)}
                multiline
                rows={3}
                fullWidth
                placeholder="예: AI, 비즈니스, 스타트업, 반도체, 클라우드"
                sx={{ mb: 2 }}
              />

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                추천 키워드 프리셋 (클릭하여 추가):
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 3, flexWrap: 'wrap' }}>
                {['인공지능', '챗봇', '클라우드', '반도체', '영업', '스타트업', 'IT산업', '디지털전환'].map((k) => (
                  <Chip
                    key={k}
                    label={`+ ${k}`}
                    size="small"
                    variant="outlined"
                    onClick={() => handleAddKeywordPreset(k)}
                    clickable
                  />
                ))}
              </Stack>

              <Divider sx={{ mb: 3 }} />

              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                onClick={handleSaveSettings}
                disabled={saving}
                sx={{ py: 1.2, fontWeight: 700, borderRadius: 2 }}
              >
                모든 설정 저장하기
              </Button>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
