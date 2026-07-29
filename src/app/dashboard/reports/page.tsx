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
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import FolderIcon from '@mui/icons-material/Folder';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

function SimpleMarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <Box key={index} sx={{ height: 6 }} />;
        }

        if (trimmed.startsWith('# ')) {
          return (
            <Typography key={index} variant="h5" sx={{ fontWeight: 800, color: 'primary.main', mt: 2.5, mb: 1 }}>
              {trimmed.replace(/^#\s+/, '')}
            </Typography>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <Typography key={index} variant="h6" sx={{ fontWeight: 700, color: 'primary.main', mt: 2, mb: 1 }}>
              {trimmed.replace(/^##\s+/, '')}
            </Typography>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <Typography key={index} variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mt: 1.5, mb: 0.5 }}>
              {trimmed.replace(/^###\s+/, '')}
            </Typography>
          );
        }

        if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
          const isChecked = trimmed.startsWith('- [x]');
          const text = trimmed.replace(/^- \[[ x]\]\s*/, '');
          return (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.5, pl: 1 }}>
              <Chip
                label={isChecked ? '완료' : '할 일'}
                size="small"
                color={isChecked ? 'success' : 'warning'}
                variant={isChecked ? 'filled' : 'outlined'}
                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
              />
              <Typography variant="body2" sx={{ fontWeight: isChecked ? 400 : 600, color: 'text.primary', textDecoration: isChecked ? 'line-through' : 'none' }}>
                {renderFormattedInlineText(text)}
              </Typography>
            </Box>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const text = trimmed.replace(/^[-*]\s+/, '');
          return (
            <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pl: 1.5, my: 0.3 }}>
              <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold' }}>•</Typography>
              <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6 }}>
                {renderFormattedInlineText(text)}
              </Typography>
            </Box>
          );
        }

        return (
          <Typography key={index} variant="body2" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
            {renderFormattedInlineText(trimmed)}
          </Typography>
        );
      })}
    </Box>
  );
}

function renderFormattedInlineText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 800 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

interface ReportItem {
  id: string;
  type: 'DAILY' | 'WEEKLY_RISK';
  title: string;
  content: string;
  summaryData?: string | null;
  createdAt: string;
}

export default function ReportsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'DAILY' | 'WEEKLY_RISK'>('DAILY');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [currentReport, setCurrentReport] = useState<ReportItem | null>(null);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);

  // Quick Stat Counters
  const [overdueCount, setOverdueCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [scheduleCountToday, setScheduleCountToday] = useState(0);
  const [activeProjectCount, setActiveProjectCount] = useState(0);

  // Fetch quick stats context
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const [tasksRes, schedRes, projRes] = await Promise.all([
        fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (tasksRes.ok) {
        const tasks = await tasksRes.json();
        const now = new Date();
        const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const overdue = tasks.filter((t: any) => !t.isCompleted && t.dueDate && new Date(t.dueDate) < now);
        const urgent = tasks.filter((t: any) => !t.isCompleted && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= threeDays);
        setOverdueCount(overdue.length);
        setUrgentCount(urgent.length);
      }

      if (schedRes.ok) {
        const scheds = await schedRes.json();
        const now = new Date();
        const todayScheds = scheds.filter((s: any) => {
          const st = new Date(s.startTime);
          return st.toDateString() === now.toDateString();
        });
        setScheduleCountToday(todayScheds.length);
      }

      if (projRes.ok) {
        const projs = await projRes.json();
        const active = projs.filter((p: any) => p.status === 'ACTIVE');
        setActiveProjectCount(active.length);
      }
    } catch (e) {}
  }, [token]);

  // Fetch report history
  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('보고서 목록을 가져오지 못했습니다.');
      const data = await res.json();
      setReports(data);

      // Select the latest report matching the current tab
      const latestOfTab = data.find((r: ReportItem) => r.type === activeTab);
      if (latestOfTab) {
        setCurrentReport(latestOfTab);
      }
    } catch (err: any) {
      setError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoadingHistory(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      fetchStats();
      fetchReports();
    }
  }, [token, authLoading, router, fetchStats, fetchReports]);

  // Handle Tab Switch
  const handleTabChange = (event: React.SyntheticEvent, newValue: 'DAILY' | 'WEEKLY_RISK') => {
    setActiveTab(newValue);
    const firstMatch = reports.find((r) => r.type === newValue);
    setCurrentReport(firstMatch || null);
  };

  // Generate Daily Report
  const handleGenerateDailyReport = async () => {
    if (!token) return;
    setGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/reports/daily', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '일간 보고서 생성 실패');

      setSuccessMsg('✨ Gemini AI 일간 업무 진행 보고서가 성공적으로 생성되었습니다!');
      setCurrentReport(data.report);
      setReports((prev) => [data.report, ...prev]);
    } catch (err: any) {
      setError(err?.message || '보고서 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // Generate Weekly Risk Report
  const handleGenerateWeeklyReport = async () => {
    if (!token) return;
    setGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/reports/weekly-risk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '주간 지연/긴급 리포트 생성 실패');

      setSuccessMsg('🚨 Gemini AI 주간 지연 & 긴급 리스포트 분석이 완료되었습니다!');
      setCurrentReport(data.report);
      setReports((prev) => [data.report, ...prev]);
    } catch (err: any) {
      setError(err?.message || '리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // Copy report content
  const handleCopyReport = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(currentReport.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredReports = reports.filter((r) => r.type === activeTab);

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Title & Actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
            📊 AI 종합 보고서 & 리스크 분석
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Gemini 3.6 AI가 일간 업무 진행 상황과 주간 지연/긴급 과제를 실시간으로 정밀 분석하여 보고합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          {activeTab === 'DAILY' ? (
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleGenerateDailyReport}
              disabled={generating}
              sx={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                fontWeight: 700,
                px: 2.5,
              }}
            >
              {generating ? 'Gemini 일간 분석 중...' : '✨ Gemini AI 일간 보고서 생성'}
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <WarningAmberIcon />}
              onClick={handleGenerateWeeklyReport}
              disabled={generating}
              color="warning"
              sx={{
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                fontWeight: 700,
                px: 2.5,
              }}
            >
              {generating ? 'Gemini 지연·긴급 분석 중...' : '🚨 Gemini AI 주간 지연·긴급 분석'}
            </Button>
          )}
        </Stack>
      </Box>

      {/* Top Quick Metric Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    오늘의 일정
                  </Typography>
                  <Typography variant="h5" color="text.primary" sx={{ mt: 0.5, fontWeight: 800 }}>
                    {scheduleCountToday} 건
                  </Typography>
                </Box>
                <CalendarMonthIcon sx={{ fontSize: 36, color: '#3b82f6', opacity: 0.8 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: overdueCount > 0 ? 'error.main' : 'divider',
              borderRadius: 3,
              bgcolor: overdueCount > 0 ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2') : 'background.paper',
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color={overdueCount > 0 ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 700 }}>
                    🚨 지연된 타스크 (Overdue)
                  </Typography>
                  <Typography variant="h5" color={overdueCount > 0 ? 'error.main' : 'text.primary'} sx={{ mt: 0.5, fontWeight: 800 }}>
                    {overdueCount} 건
                  </Typography>
                </Box>
                <AssignmentLateIcon sx={{ fontSize: 36, color: overdueCount > 0 ? '#ef4444' : '#9ca3af' }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: urgentCount > 0 ? 'warning.main' : 'divider',
              borderRadius: 3,
              bgcolor: urgentCount > 0 ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb') : 'background.paper',
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color={urgentCount > 0 ? 'warning.main' : 'text.secondary'} sx={{ fontWeight: 700 }}>
                    ⚡ 마감 임박 타스크 (D-3)
                  </Typography>
                  <Typography variant="h5" color={urgentCount > 0 ? 'warning.main' : 'text.primary'} sx={{ mt: 0.5, fontWeight: 800 }}>
                    {urgentCount} 건
                  </Typography>
                </Box>
                <WarningAmberIcon sx={{ fontSize: 36, color: urgentCount > 0 ? '#f59e0b' : '#9ca3af' }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    진행 중인 프로젝트
                  </Typography>
                  <Typography variant="h5" color="text.primary" sx={{ mt: 0.5, fontWeight: 800 }}>
                    {activeProjectCount} 개
                  </Typography>
                </Box>
                <FolderIcon sx={{ fontSize: 36, color: '#10b981', opacity: 0.8 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}

      {/* Main Tabs */}
      <Paper elevation={0} sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            value="DAILY"
            label="📅 일간 진행 보고서 (Daily Briefing)"
            icon={<EventNoteIcon />}
            iconPosition="start"
            sx={{ fontWeight: 700, py: 1.5 }}
          />
          <Tab
            value="WEEKLY_RISK"
            label="🚨 주간 지연 & 긴급 리포트 (Weekly Risk)"
            icon={<AssessmentIcon />}
            iconPosition="start"
            sx={{ fontWeight: 700, py: 1.5 }}
          />
        </Tabs>
      </Paper>

      {/* Content Layout */}
      <Grid container spacing={3}>
        {/* Left Side: Report View Workspace */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              minHeight: 500,
              bgcolor: 'background.paper',
            }}
          >
            {currentReport ? (
              <Box>
                {/* Report Header Bar */}
                <Box sx={{ pb: 2, mb: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800 }}>
                      {currentReport.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      작성 일시: {new Date(currentReport.createdAt).toLocaleString('ko-KR')}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyReport}
                  >
                    {copied ? '복사 완료!' : '리포트 복사'}
                  </Button>
                </Box>

                {/* Report Markdown Content */}
                <Box
                  sx={{
                    '& p': { mb: 2, lineHeight: 1.7, color: 'text.primary' },
                    '& h1, & h2, & h3': { color: 'primary.main', mt: 3, mb: 1.5, fontWeight: 700 },
                    '& ul, & ol': { pl: 3, mb: 2 },
                    '& li': { mb: 0.8, color: 'text.primary', lineHeight: 1.6 },
                    '& code': { bgcolor: 'action.selected', p: 0.5, borderRadius: 1, fontFamily: 'monospace' },
                    '& blockquote': { borderLeft: '4px solid #3b82f6', pl: 2, ml: 0, color: 'text.secondary', fontStyle: 'italic' },
                  }}
                >
                  <SimpleMarkdownRenderer content={currentReport.content} />
                </Box>
              </Box>
            ) : (
              <Box sx={{ py: 12, textAlign: 'center' }}>
                <AssessmentIcon sx={{ fontSize: 56, color: 'text.secondary', opacity: 0.4, mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {activeTab === 'DAILY' ? '생성된 일간 진행 보고서가 없습니다.' : '생성된 주간 지연/긴급 리포트가 없습니다.'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                  상단의 AI 생성 버튼을 누르시면 Gemini 3.6 AI가 현재 데이터를 종합 분석하여 보고서를 작성해 드립니다.
                </Typography>
                {activeTab === 'DAILY' ? (
                  <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={handleGenerateDailyReport} disabled={generating}>
                    {generating ? '분석 중...' : '✨ 일간 보고서 즉시 생성'}
                  </Button>
                ) : (
                  <Button variant="contained" color="warning" startIcon={<WarningAmberIcon />} onClick={handleGenerateWeeklyReport} disabled={generating}>
                    {generating ? '분석 중...' : '🚨 지연·긴급 리포트 즉시 생성'}
                  </Button>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Side: History Drawer / List */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography variant="subtitle1" color="text.primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
              <HistoryIcon color="primary" /> 히스토리 보관함 ({filteredReports.length}건)
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {loadingHistory ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            ) : filteredReports.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                저장된 이전 보고서가 없습니다.
              </Typography>
            ) : (
              <List disablePadding>
                {filteredReports.map((rep, idx) => {
                  const isSelected = currentReport?.id === rep.id;
                  return (
                    <React.Fragment key={rep.id}>
                      {idx > 0 && <Divider sx={{ my: 1 }} />}
                      <ListItem
                        component="div"
                        onClick={() => setCurrentReport(rep)}
                        sx={{
                          borderRadius: 2,
                          cursor: 'pointer',
                          bgcolor: isSelected ? 'action.selected' : 'transparent',
                          border: isSelected ? '1px solid' : '1px solid transparent',
                          borderColor: isSelected ? 'primary.main' : 'transparent',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {rep.type === 'DAILY' ? <EventNoteIcon color="primary" /> : <WarningAmberIcon color="warning" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" color="text.primary" noWrap sx={{ fontWeight: isSelected ? 800 : 600 }}>
                              {rep.title}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {new Date(rep.createdAt).toLocaleString('ko-KR')}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
