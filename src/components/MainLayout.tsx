'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useColorMode } from '@/contexts/ThemeContext';
import {
  AppBar,
  Box,
  Button,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
} from '@mui/material';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import AddIcon from '@mui/icons-material/Add';
import SyncIcon from '@mui/icons-material/Sync';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ScheduleFormDialog, { ScheduleData } from '@/components/ScheduleFormDialog';
import TaskFormDialog, { TaskData } from '@/components/TaskFormDialog';
import GeminiDrawer from '@/components/GeminiDrawer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, token, logout } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const router = useRouter();
  const pathname = usePathname();

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [geminiOpen, setGeminiOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Quick Schedule Creation from Header
  const handleSaveSchedule = async (scheduleData: ScheduleData) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(scheduleData),
      });
      if (res.ok) {
        setScheduleDialogOpen(false);
        window.location.reload();
      }
    } catch (e) {}
  };

  // Quick Task Creation from Header
  const handleSaveTask = async (taskData: TaskData) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(taskData),
      });
      if (res.ok) {
        setTaskDialogOpen(false);
        window.location.reload();
      }
    } catch (e) {}
  };

  // Quick Google Sync from Header
  const handleSyncGoogle = async () => {
    if (!token) return;
    setSyncing(true);
    try {
      await fetch('/api/google/calendar/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetch('/api/google/tasks/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      window.location.reload();
    } catch (e) {
    } finally {
      setSyncing(false);
    }
  };

  const isDark = mode === 'dark';

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: isDark ? '#0f172a' : '#1e293b',
          borderBottom: '1px solid',
          borderColor: isDark ? '#1e293b' : '#334155',
          color: '#ffffff',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, md: 3 }, minHeight: 64 }}>
          {/* Left: Brand Logo & Main Navigation Tabs */}
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Typography
              variant="h6"
              component="div"
              sx={{ fontWeight: 800, letterSpacing: '-0.5px', mr: 1 }}
            >
              <Link href="/dashboard" style={{ textDecoration: 'none', color: '#3b82f6' }}>
                MyAgent✨
              </Link>
            </Typography>

            {user && (
              <Stack direction="row" spacing={0.5}>
                <Button
                  component={Link}
                  href="/dashboard"
                  sx={{
                    color: pathname === '/dashboard' ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname === '/dashboard' ? 700 : 500,
                    borderBottom: pathname === '/dashboard' ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  대시보드
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/schedules"
                  sx={{
                    color: pathname.startsWith('/dashboard/schedules') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/schedules') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/schedules') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  일정
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/tasks"
                  sx={{
                    color: pathname.startsWith('/dashboard/tasks') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/tasks') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/tasks') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  타스크
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/projects"
                  sx={{
                    color: pathname.startsWith('/dashboard/projects') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/projects') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/projects') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  프로젝트
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/files"
                  sx={{
                    color: pathname.startsWith('/dashboard/files') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/files') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/files') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  파일 보관함
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/reports"
                  sx={{
                    color: pathname.startsWith('/dashboard/reports') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/reports') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/reports') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  📊 AI 보고서
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/budgets"
                  sx={{
                    color: pathname.startsWith('/dashboard/budgets') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/budgets') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/budgets') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  💰 자금·예산
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/news"
                  sx={{
                    color: pathname.startsWith('/dashboard/news') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/news') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/news') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  뉴스 인사이트
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/customers"
                  sx={{
                    color: pathname.startsWith('/dashboard/customers') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/customers') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/customers') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  고객
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/history"
                  sx={{
                    color: pathname.startsWith('/dashboard/history') ? '#3b82f6' : '#cbd5e1',
                    fontWeight: pathname.startsWith('/dashboard/history') ? 700 : 500,
                    borderBottom: pathname.startsWith('/dashboard/history') ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                  }}
                >
                  변경이력
                </Button>
              </Stack>
            )}
          </Stack>

          {/* Right: User Greeting, Quick Action Buttons, Settings & Gemini Sparkle Toggle */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            {user ? (
              <>
                {/* Greeting Badge */}
                <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600, display: { xs: 'none', xl: 'block' } }}>
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}>{user.name}님</span>, 환영합니다! 👋
                </Typography>

                {/* Header Action Buttons */}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setScheduleDialogOpen(true)}
                  sx={{
                    bgcolor: '#3b82f6',
                    '&:hover': { bgcolor: '#2563eb' },
                    fontWeight: 600,
                    borderRadius: 2,
                    display: { xs: 'none', sm: 'inline-flex' },
                  }}
                >
                  새 일정
                </Button>

                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setTaskDialogOpen(true)}
                  sx={{
                    bgcolor: '#e11d48',
                    '&:hover': { bgcolor: '#be123c' },
                    fontWeight: 600,
                    borderRadius: 2,
                    display: { xs: 'none', sm: 'inline-flex' },
                  }}
                >
                  새 타스크
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
                  onClick={handleSyncGoogle}
                  disabled={syncing}
                  sx={{
                    borderColor: '#475569',
                    color: '#e2e8f0',
                    '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(255,255,255,0.05)' },
                    fontWeight: 600,
                    borderRadius: 2,
                    display: { xs: 'none', md: 'inline-flex' },
                  }}
                >
                  Google 동기화
                </Button>

                {/* Gemini AI Workspace Sparkle Button (Google Workspace Style) */}
                <Tooltip title="Gemini AI 스마트 비서 열기/닫기">
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => setGeminiOpen(!geminiOpen)}
                    sx={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      borderRadius: 2,
                      px: 1.8,
                      boxShadow: '0 2px 10px rgba(139, 92, 246, 0.4)',
                    }}
                  >
                    Gemini✨
                  </Button>
                </Tooltip>

                {/* Settings Page Link */}
                <Tooltip title="시스템 & 계정 설정">
                  <IconButton
                    component={Link}
                    href="/dashboard/settings"
                    color="inherit"
                    sx={{
                      bgcolor: pathname === '/dashboard/settings' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: pathname === '/dashboard/settings' ? '#3b82f6' : 'inherit',
                    }}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                {/* Dark Mode Toggle */}
                <Tooltip title={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
                  <IconButton onClick={toggleColorMode} color="inherit" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                    {mode === 'dark' ? <Brightness7Icon sx={{ color: '#f59e0b' }} /> : <Brightness4Icon sx={{ color: '#cbd5e1' }} />}
                  </IconButton>
                </Tooltip>

                {/* Logout Button */}
                <Tooltip title="로그아웃">
                  <IconButton onClick={handleLogout} color="inherit" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip title={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
                  <IconButton onClick={toggleColorMode} color="inherit">
                    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                  </IconButton>
                </Tooltip>
                <Button component={Link} href="/login" color="inherit">
                  로그인
                </Button>
                <Button component={Link} href="/register" variant="contained" color="primary" size="small">
                  회원가입
                </Button>
              </>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Page Layout Container */}
      <Box
        component="main"
        sx={{
          minHeight: 'calc(100vh - 64px)',
          transition: 'margin-right 0.3s ease-in-out',
          mr: geminiOpen ? { xs: 0, sm: '400px', md: '440px' } : 0,
        }}
      >
        {children}
      </Box>

      {/* Google Workspace Style Gemini Side Drawer */}
      <GeminiDrawer
        open={geminiOpen}
        onClose={() => setGeminiOpen(false)}
        onDataCreated={() => {
          router.refresh();
        }}
      />

      {/* Header Modal Dialogs */}
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
    </>
  );
}
