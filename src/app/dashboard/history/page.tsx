'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Stack,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link as MuiLink,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TaskIcon from '@mui/icons-material/Task';
import FolderIcon from '@mui/icons-material/Folder';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

interface ActivityLogItem {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  entityType: 'SCHEDULE' | 'TASK' | 'PROJECT' | 'CUSTOMER' | 'FILE' | 'NOTE' | string;
  title: string;
  details?: string | null;
  targetUrl?: string | null;
  createdAt: string;
}

export default function ActivityHistoryPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchActivityLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/activity', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('변경 이력을 가져오지 못했습니다.');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
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
      return;
    }
    fetchActivityLogs();
  }, [token, authLoading, router, fetchActivityLogs]);

  // Action Icon & Colors Helper
  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return <Chip icon={<AddCircleIcon fontSize="small" />} label="생성" color="success" size="small" sx={{ fontWeight: 700 }} />;
      case 'UPDATE':
        return <Chip icon={<EditIcon fontSize="small" />} label="수정" color="info" size="small" sx={{ fontWeight: 700 }} />;
      case 'DELETE':
        return <Chip icon={<DeleteIcon fontSize="small" />} label="삭제" color="error" size="small" sx={{ fontWeight: 700 }} />;
      default:
        return <Chip label={action} size="small" />;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType.toUpperCase()) {
      case 'SCHEDULE':
        return <CalendarMonthIcon sx={{ color: '#3b82f6' }} />;
      case 'PROJECT':
        return <FolderIcon sx={{ color: '#8b5cf6' }} />;
      case 'TASK':
        return <TaskIcon sx={{ color: '#e11d48' }} />;
      case 'CUSTOMER':
        return <PeopleIcon sx={{ color: '#10b981' }} />;
      default:
        return <DescriptionIcon sx={{ color: '#64748b' }} />;
    }
  };

  // Filtering Logic
  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action.toUpperCase() !== actionFilter) return false;
    if (entityFilter !== 'ALL' && log.entityType.toUpperCase() !== entityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = log.title.toLowerCase().includes(q);
      const matchDetails = log.details ? log.details.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchDetails) return false;
    }
    return true;
  });

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <MuiLink color="inherit" href="/dashboard" underline="hover">
            대시보드
          </MuiLink>
          <Typography color="text.primary" sx={{ fontWeight: 600 }}>
            변경이력 (Activity Logs)
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <HistoryIcon sx={{ fontSize: 40, color: '#3b82f6' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff' }}>
              📜 워크스페이스 변경 이력
            </Typography>
            <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
              일정, 프로젝트, 타스크, 고객 정보의 생성·수정·삭제 로그를 최신순으로 확인하고 해당 메뉴로 즉시 이동합니다.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Filter Control Bar */}
      <Paper elevation={1} sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          {/* Action Filter */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 0.8, display: 'block' }}>
              <FilterListIcon fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'middle' }} /> 동작 구분 (Action):
            </Typography>
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
              {['ALL', 'CREATE', 'UPDATE', 'DELETE'].map((act) => (
                <Chip
                  key={act}
                  label={act === 'ALL' ? '전체' : act === 'CREATE' ? '생성 [CREATE]' : act === 'UPDATE' ? '수정 [UPDATE]' : '삭제 [DELETE]'}
                  variant={actionFilter === act ? 'filled' : 'outlined'}
                  color={act === 'CREATE' ? 'success' : act === 'UPDATE' ? 'info' : act === 'DELETE' ? 'error' : 'primary'}
                  onClick={() => setActionFilter(act)}
                  clickable
                />
              ))}
            </Stack>
          </Grid>

          {/* Entity Type Filter */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 0.8, display: 'block' }}>
              📁 영역 구분 (Entity):
            </Typography>
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
              {[
                { key: 'ALL', label: '전체' },
                { key: 'SCHEDULE', label: '일정' },
                { key: 'PROJECT', label: '프로젝트' },
                { key: 'TASK', label: '타스크' },
                { key: 'CUSTOMER', label: '고객' },
              ].map((ent) => (
                <Chip
                  key={ent.key}
                  label={ent.label}
                  variant={entityFilter === ent.key ? 'filled' : 'outlined'}
                  color="secondary"
                  onClick={() => setEntityFilter(ent.key)}
                  clickable
                  size="small"
                />
              ))}
            </Stack>
          </Grid>

          {/* Search Query */}
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="제목 및 내역 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Main Activity Log List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={40} />
        </Box>
      ) : filteredLogs.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
            borderRadius: 3,
            border: '1px solid',
            borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'transparent'),
          }}
        >
          <HistoryIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">
            조건에 해당하는 변경 이력이 없습니다.
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 3 }}>
          <List disablePadding>
            {filteredLogs.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 && <Divider component="li" />}
                <ListItem
                  sx={{
                    py: 2,
                    px: 2,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 2,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                    <Box sx={{ pt: 0.5 }}>{getEntityIcon(item.entityType)}</Box>

                    <Box>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        {getActionBadge(item.action)}
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {item.title}
                        </Typography>
                      </Stack>

                      {item.details && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {item.details}
                        </Typography>
                      )}

                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        🕒 {new Date(item.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Right Action Button to Navigate */}
                  {item.targetUrl && (
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      onClick={() => router.push(item.targetUrl!)}
                      sx={{
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        alignSelf: { xs: 'flex-end', sm: 'center' },
                      }}
                    >
                      해당 메뉴로 이동
                    </Button>
                  )}
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Container>
  );
}
