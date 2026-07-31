'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  Stack,
  Avatar,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import GoogleIcon from '@mui/icons-material/Google';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface UserItem {
  id: string;
  email: string;
  name: string;
  hasGoogleAuth: boolean;
  createdAt: string;
  stats: {
    projectsCount: number;
    schedulesCount: number;
    tasksCount: number;
    budgetsCount: number;
  };
}

export default function AdminUsersDashboardPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsersList = useCallback(async () => {
    if (!token && !user) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setTotalCount(data.totalUsers || 0);
      } else {
        setError(data.error || '회원 목록을 불러오지 못했습니다.');
      }
    } catch (err: any) {
      setError(err?.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!token && !user) {
      router.push('/login');
      return;
    }
    fetchUsersList();
  }, [token, user, authLoading, router, fetchUsersList]);

  // Filtered users search
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const googleUsersCount = useMemo(() => users.filter((u) => u.hasGoogleAuth).length, [users]);

  if (loading || authLoading) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          전체 회원 가입 내역을 불로오는 중...
        </Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          border: '1px solid',
          borderColor: '#334155',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 0.5 }}>
              <AdminPanelSettingsIcon color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                🔑 Super Admin 시스템 회원 관리 대시보드
              </Typography>
            </Stack>
            <Typography variant="body2" color="gray">
              MostlyOn 서비스에 가입된 모든 사용자 계정 목록 및 이용 현황을 실시간 관리합니다.
            </Typography>
          </Box>

          <Chip
            icon={<CheckCircleIcon fontSize="small" style={{ color: '#4ade80' }} />}
            label={`관리자 접속 중: ${user?.email || 'admin'}`}
            variant="outlined"
            sx={{ color: '#ffffff', borderColor: '#475569', fontWeight: 700 }}
          />
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    총 가입 회원수
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                    {totalCount}명
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}>
                  <PeopleIcon color="primary" />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Google SSO 회원
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#4285F4' }}>
                    {googleUsersCount}명
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#e8f0fe', width: 48, height: 48 }}>
                  <GoogleIcon sx={{ color: '#4285F4' }} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    일반 이메일 가입
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: 'success.main' }}>
                    {totalCount - googleUsersCount}명
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'action.hover', width: 48, height: 48 }}>
                  <PeopleIcon color="action" />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Users Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            👥 가입 회원 전체 목록 ({filteredUsers.length}명)
          </Typography>

          <TextField
            size="small"
            placeholder="이름 또는 이메일 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 800 }}>사용자</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>이메일 ID</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>가입 수단</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>가입 일시</TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'center' }}>워크스페이스 활동</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      검색 조건에 맞는 가입 사용자가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 14, fontWeight: 700 }}>
                          {u.name ? u.name[0] : 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            {u.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {u.id.slice(0, 10)}...
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {u.email}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      {u.hasGoogleAuth ? (
                        <Chip
                          icon={<GoogleIcon style={{ fontSize: 14 }} />}
                          label="Google SSO 연동"
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ fontWeight: 700 }}
                        />
                      ) : (
                        <Chip
                          label="일반 이메일 가입"
                          size="small"
                          color="default"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(u.createdAt).toLocaleString('ko-KR')}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                        <Chip label={`📁 프로젝트 ${u.stats.projectsCount}개`} size="small" variant="filled" color="primary" />
                        <Chip label={`🗓️ 일정 ${u.stats.schedulesCount}건`} size="small" variant="outlined" />
                        <Chip label={`✅ 타스크 ${u.stats.tasksCount}건`} size="small" variant="outlined" />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
}
