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
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DeleteIcon from '@mui/icons-material/Delete';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  title: string;
  amount: number;
  dueDate: string;
  actualDate?: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'OVERDUE';
  notes?: string | null;
  projectBudget?: {
    project?: {
      name: string;
    };
  };
}

interface ProjectBudgetData {
  projectId: string;
  projectName: string;
  projectStatus: string;
  budgetId?: string | null;
  contractAmount: number;
  targetBudget: number;
  notes: string;
  totalIncomeScheduled: number;
  totalIncomeCollected: number;
  totalExpenseScheduled: number;
  totalExpensePaid: number;
  netProfitForecast: number;
  profitMarginPct: number;
  transactions: Transaction[];
  updatedAt: string;
}

function SimpleMarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <Box key={index} sx={{ height: 6 }} />;

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
      return <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function BudgetsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'PROJECTS' | 'TIMELINE' | 'AI_FORECAST'>('PROJECTS');
  const [budgets, setBudgets] = useState<ProjectBudgetData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // AI Forecast state
  const [aiReport, setAiReport] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dialog States
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [contractInput, setContractInput] = useState('');
  const [targetBudgetInput, setTargetBudgetInput] = useState('');
  const [budgetNotesInput, setBudgetNotesInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  const [openTxModal, setOpenTxModal] = useState(false);
  const [txProjectId, setTxProjectId] = useState('');
  const [txType, setTxType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [txCategory, setTxCategory] = useState('선금');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDueDate, setTxDueDate] = useState('');
  const [txStatus, setTxStatus] = useState<'SCHEDULED' | 'COMPLETED'>('SCHEDULED');
  const [txNotes, setTxNotes] = useState('');
  const [savingTx, setSavingTx] = useState(false);

  // Quick Project Creation State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProjectLoading, setCreatingProjectLoading] = useState(false);

  const handleQuickCreateProject = async () => {
    if (!token || !newProjectName.trim()) return;
    setCreatingProjectLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: '자금/예산 설정 중 생성된 프로젝트',
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setNewProjectName('');
        setIsCreatingProject(false);
        fetchBudgetData();
        setSelectedProjectId(data.id);
      }
    } catch (err) {
      console.error('Quick project creation error:', err);
    } finally {
      setCreatingProjectLoading(false);
    }
  };

  const fetchBudgetData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [budgetsRes, txRes] = await Promise.all([
        fetch('/api/budgets', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/budgets/transactions', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!budgetsRes.ok) throw new Error('예산 데이터를 불러오지 못했습니다.');
      const bData = await budgetsRes.json();
      setBudgets(bData);

      if (txRes.ok) {
        const tData = await txRes.json();
        setTransactions(tData);
      }
    } catch (err: any) {
      setError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token && !user) {
      router.push('/login');
    } else {
      fetchBudgetData();
    }
  }, [token, user, authLoading, router, fetchBudgetData]);

  // Overall Financial Totals
  const totalContractVal = budgets.reduce((sum, b) => sum + b.contractAmount, 0);
  const totalCollectedVal = budgets.reduce((sum, b) => sum + b.totalIncomeCollected, 0);
  const totalPaidExpenseVal = budgets.reduce((sum, b) => sum + b.totalExpensePaid, 0);
  const totalScheduledExpenseVal = budgets.reduce((sum, b) => sum + b.totalExpenseScheduled, 0);
  const totalNetExpected = totalContractVal - totalScheduledExpenseVal;
  const overallMarginPct = totalContractVal > 0 ? (totalNetExpected / totalContractVal) * 100 : 0;

  // Open Budget Dialog
  const handleOpenBudgetModal = (item?: ProjectBudgetData) => {
    if (item) {
      setSelectedProjectId(item.projectId);
      setContractInput(item.contractAmount ? item.contractAmount.toString() : '');
      setTargetBudgetInput(item.targetBudget ? item.targetBudget.toString() : '');
      setBudgetNotesInput(item.notes || '');
    } else if (budgets.length > 0) {
      setSelectedProjectId(budgets[0].projectId);
      setContractInput('');
      setTargetBudgetInput('');
      setBudgetNotesInput('');
    }
    setOpenBudgetModal(true);
  };

  // Save Project Budget
  const handleSaveBudget = async () => {
    if (!token || !selectedProjectId) return;
    setSavingBudget(true);
    setError('');
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: selectedProjectId,
          contractAmount: contractInput,
          targetBudget: targetBudgetInput,
          notes: budgetNotesInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '예산 설정 실패');

      setSuccessMsg('프로젝트 수주금액 및 예산 설정이 완료되었습니다.');
      setOpenBudgetModal(false);
      fetchBudgetData();
    } catch (err: any) {
      setError(err?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSavingBudget(false);
    }
  };

  // Open Transaction Dialog
  const handleOpenTxModal = (type: 'INCOME' | 'EXPENSE' = 'INCOME') => {
    setTxType(type);
    setTxCategory(type === 'INCOME' ? '선금' : '외주비');
    setTxTitle('');
    setTxAmount('');
    const today = new Date().toISOString().split('T')[0];
    setTxDueDate(today);
    setTxStatus('SCHEDULED');
    setTxNotes('');
    if (budgets.length > 0) setSelectedProjectId(budgets[0].projectId);
    setOpenTxModal(true);
  };

  // Save Transaction Item
  const handleSaveTx = async () => {
    if (!token || !selectedProjectId || !txTitle || !txAmount || !txDueDate) {
      setError('필수 항목을 모두 입력해 주세요.');
      return;
    }
    setSavingTx(true);
    setError('');
    try {
      const res = await fetch('/api/budgets/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: selectedProjectId,
          type: txType,
          category: txCategory,
          title: txTitle,
          amount: txAmount,
          dueDate: txDueDate,
          status: txStatus,
          notes: txNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '스케줄 등록 실패');

      setSuccessMsg('입출금 스케줄이 성공적으로 등록되었습니다.');
      setOpenTxModal(false);
      fetchBudgetData();
    } catch (err: any) {
      setError(err?.message || '스케줄 등록 중 오류가 발생했습니다.');
    } finally {
      setSavingTx(false);
    }
  };

  // Toggle Transaction Status (SCHEDULED <-> COMPLETED)
  const handleToggleTxStatus = async (txId: string, currentStatus: string) => {
    if (!token) return;
    const newStatus = currentStatus === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED';
    try {
      const res = await fetch(`/api/budgets/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchBudgetData();
      }
    } catch (e) {}
  };

  // Delete Transaction
  const handleDeleteTx = async (txId: string) => {
    if (!token || !confirm('이 입출금 내역을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/budgets/transactions/${txId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchBudgetData();
      }
    } catch (e) {}
  };

  // Generate AI Cash Flow Forecast
  const handleGenerateAiForecast = async () => {
    if (!token) return;
    setGeneratingAi(true);
    setError('');
    try {
      const res = await fetch('/api/budgets/ai-forecast', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 예측 생성 실패');

      setAiReport(data.report);
      setActiveTab('AI_FORECAST');
    } catch (err: any) {
      setError(err?.message || 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Top Title & Actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
            💰 자금 & 예산 관리 (Project Budgets & Cash Flow)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            프로젝트 수주금액, 외주비/지출 예산, 일별 입출금 시점 관리 및 Gemini 3.6 AI 현금 흐름을 정밀 예측합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<MonetizationOnIcon />}
            onClick={() => handleOpenBudgetModal()}
            sx={{ fontWeight: 700 }}
          >
            + 프로젝트 예산 설정
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenTxModal('INCOME')}
            sx={{ fontWeight: 700 }}
          >
            + 입출금 스케줄 추가
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={generatingAi ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
            onClick={handleGenerateAiForecast}
            disabled={generatingAi}
            sx={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
              fontWeight: 700,
            }}
          >
            {generatingAi ? '현금흐름 AI 분석 중...' : '✨ Gemini AI 현금 흐름 예측'}
          </Button>
        </Stack>
      </Box>

      {/* Top 4 Financial Metric Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    총 수주 계약금액 (Total Revenue)
                  </Typography>
                  <Typography variant="h5" color="primary.main" sx={{ mt: 0.5, fontWeight: 800 }}>
                    {totalContractVal.toLocaleString()} 원
                  </Typography>
                </Box>
                <AccountBalanceWalletIcon sx={{ fontSize: 36, color: '#2563eb', opacity: 0.8 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
                    🟢 누적 수금/매출 (Collected)
                  </Typography>
                  <Typography variant="h5" color="success.main" sx={{ mt: 0.5, fontWeight: 800 }}>
                    {totalCollectedVal.toLocaleString()} 원
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 36, color: '#10b981' }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="error.main" sx={{ fontWeight: 700 }}>
                    🔴 누적 집행/지출 (Paid Expense)
                  </Typography>
                  <Typography variant="h5" color="error.main" sx={{ mt: 0.5, fontWeight: 800 }}>
                    {totalPaidExpenseVal.toLocaleString()} 원
                  </Typography>
                </Box>
                <TrendingDownIcon sx={{ fontSize: 36, color: '#ef4444' }} />
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
                    예상 순이익 (Net Margin %)
                  </Typography>
                  <Typography variant="h5" color={totalNetExpected >= 0 ? 'text.primary' : 'error.main'} sx={{ mt: 0.5, fontWeight: 800 }}>
                    {totalNetExpected.toLocaleString()} 원
                  </Typography>
                  <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 700 }}>
                    수주 대비 마진율 {overallMarginPct.toFixed(1)}%
                  </Typography>
                </Box>
                <MonetizationOnIcon sx={{ fontSize: 36, color: '#8b5cf6', opacity: 0.8 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}

      {/* Navigation Tabs */}
      <Paper elevation={0} sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab value="PROJECTS" label="📊 프로젝트별 손익 현황" icon={<AssessmentIcon />} iconPosition="start" sx={{ fontWeight: 700, py: 1.5 }} />
          <Tab value="TIMELINE" label="🗓️ 입출금 스케줄 & 현금 흐름" icon={<CalendarMonthIcon />} iconPosition="start" sx={{ fontWeight: 700, py: 1.5 }} />
          <Tab value="AI_FORECAST" label="🔮 Gemini AI 현금 흐름 예측" icon={<AutoAwesomeIcon />} iconPosition="start" sx={{ fontWeight: 700, py: 1.5 }} />
        </Tabs>
      </Paper>

      {/* Tab 1: Project Budgets List & Cards */}
      {activeTab === 'PROJECTS' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" color="text.primary" sx={{ mb: 2, fontWeight: 800 }}>
            📁 등록된 프로젝트별 수주금액 & 비용 예산
          </Typography>

          {loading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : budgets.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                등록된 프로젝트가 없습니다. 먼저 프로젝트를 등록한 후 예산을 설정해 보세요.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc') }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>프로젝트명</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>총 수주 금액 (매출)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>목표 비용 예산</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>누적 집행 비용</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>예상 순이익 (마진율)</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>예산 집행률</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>관리</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {budgets.map((b) => {
                    const spentPct = b.targetBudget > 0 ? Math.min(Math.round((b.totalExpenseScheduled / b.targetBudget) * 100), 100) : 0;
                    return (
                      <TableRow key={b.projectId} hover>
                        <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {b.projectName}
                          <Chip label={b.projectStatus} size="small" sx={{ ml: 1, fontSize: '0.65rem' }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {b.contractAmount > 0 ? `${b.contractAmount.toLocaleString()} 원` : '미설정'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {b.targetBudget > 0 ? `${b.targetBudget.toLocaleString()} 원` : '미설정'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {b.totalExpensePaid.toLocaleString()} 원
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: b.netProfitForecast >= 0 ? 'success.main' : 'error.main' }}>
                          {b.netProfitForecast.toLocaleString()} 원
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            ({b.profitMarginPct.toFixed(1)}%)
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress variant="determinate" value={spentPct} color={spentPct > 90 ? 'error' : 'primary'} sx={{ height: 8, borderRadius: 4 }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 35, fontWeight: 700 }}>
                              {spentPct}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Button size="small" variant="outlined" onClick={() => handleOpenBudgetModal(b)}>
                            예산 수정
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Tab 2: Cash Flow Timeline */}
      {activeTab === 'TIMELINE' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 800 }}>
              🗓️ 일별 입금 & 출금 스케줄 타임라인 ({transactions.length}건)
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" color="success" startIcon={<AddIcon />} onClick={() => handleOpenTxModal('INCOME')}>
                + 입금(매출) 스케줄 추가
              </Button>

              <Button variant="outlined" size="small" color="error" startIcon={<AddIcon />} onClick={() => handleOpenTxModal('EXPENSE')}>
                + 출금(외주비) 스케줄 추가
              </Button>
            </Stack>
          </Box>

          {transactions.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                등록된 입출금 스케줄이 없습니다. 상단 버튼을 클릭하여 입금 또는 출금 스케줄을 추가해 보세요.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc') }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>입출금 구분</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>예정일 / 제목</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>관련 프로젝트</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>카테고리</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>금액</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>상태</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((t) => {
                    const isIncome = t.type === 'INCOME';
                    const isCompleted = t.status === 'COMPLETED';
                    return (
                      <TableRow key={t.id} hover>
                        <TableCell>
                          <Chip
                            label={isIncome ? '🟢 입금 (매출)' : '🔴 출금 (비용)'}
                            size="small"
                            color={isIncome ? 'success' : 'error'}
                            variant={isCompleted ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            {t.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            예정일: {new Date(t.dueDate).toLocaleDateString('ko-KR')}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {t.projectBudget?.project?.name || '미지정'}
                        </TableCell>
                        <TableCell>
                          <Chip label={t.category} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: isIncome ? 'success.main' : 'error.main' }}>
                          {isIncome ? '+' : '-'}{t.amount.toLocaleString()} 원
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={isCompleted ? <CheckCircleIcon fontSize="small" /> : <HourglassEmptyIcon fontSize="small" />}
                            label={isCompleted ? '완료' : '예정'}
                            size="small"
                            color={isCompleted ? 'success' : 'default'}
                            onClick={() => handleToggleTxStatus(t.id, t.status)}
                            clickable
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleDeleteTx(t.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Tab 3: Gemini AI Cash Flow Forecast */}
      {activeTab === 'AI_FORECAST' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', minHeight: 450 }}>
          <Box sx={{ pb: 2, mb: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              🔮 Gemini 3.6 AI 현금 흐름 & 자금 운용 정밀 예측 보고서
            </Typography>
            {aiReport && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={() => {
                  navigator.clipboard.writeText(aiReport);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? '복사 완료!' : '보고서 복사'}
              </Button>
            )}
          </Box>

          {generatingAi ? (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>
                Gemini 3.6 AI가 전체 입출금 시점과 손익 데이터를 분석 중입니다...
              </Typography>
            </Box>
          ) : aiReport ? (
            <Box
              sx={{
                '& p': { mb: 2, lineHeight: 1.7, color: 'text.primary' },
                '& h1, & h2, & h3': { color: 'primary.main', mt: 3, mb: 1.5, fontWeight: 700 },
                '& ul, & ol': { pl: 3, mb: 2 },
                '& li': { mb: 0.8, color: 'text.primary', lineHeight: 1.6 },
              }}
            >
              <SimpleMarkdownRenderer content={aiReport} />
            </Box>
          ) : (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <AutoAwesomeIcon sx={{ fontSize: 56, color: 'secondary.main', opacity: 0.5, mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>
                아직 생성된 AI 현금 흐름 예측 보고서가 없습니다.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                버튼을 누르시면 Gemini 3.6 AI가 프로젝트별 입금과 외주비 출금 일정을 정밀 분석하여 리스크 진단을 제공합니다.
              </Typography>
              <Button variant="contained" color="secondary" startIcon={<AutoAwesomeIcon />} onClick={handleGenerateAiForecast}>
                ✨ Gemini AI 현금 흐름 예측 보고서 생성
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {/* Dialog 1: Register Project Budget */}
      <Dialog open={openBudgetModal} onClose={() => setOpenBudgetModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>💰 프로젝트 수주금액 & 비용 예산 설정</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <FormControl fullWidth size="small">
                  <InputLabel>프로젝트 선택</InputLabel>
                  <Select value={selectedProjectId} label="프로젝트 선택" onChange={(e) => setSelectedProjectId(e.target.value)}>
                    {budgets.map((b) => (
                      <MenuItem key={b.projectId} value={b.projectId}>
                        {b.projectName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setIsCreatingProject(!isCreatingProject)}
                  sx={{ whiteSpace: 'nowrap', height: 40, fontWeight: 700 }}
                >
                  새 프로젝트
                </Button>
              </Stack>

              {isCreatingProject && (
                <Paper elevation={0} sx={{ p: 1.5, border: '1px dashed', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                    ✨ 신규 프로젝트 인라인 즉시 생성
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      placeholder="새 프로젝트명을 입력하세요 (예: 플립비)"
                      size="small"
                      fullWidth
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickCreateProject();
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleQuickCreateProject}
                      disabled={creatingProjectLoading || !newProjectName.trim()}
                      sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
                    >
                      {creatingProjectLoading ? '생성 중...' : '생성'}
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Box>

            <TextField
              label="총 수주 계약금액 (매출 원)"
              type="number"
              fullWidth
              size="small"
              value={contractInput}
              onChange={(e) => setContractInput(e.target.value)}
              placeholder="예: 10000000"
            />

            <TextField
              label="목표 비용 예산 (외주비+경비 원)"
              type="number"
              fullWidth
              size="small"
              value={targetBudgetInput}
              onChange={(e) => setTargetBudgetInput(e.target.value)}
              placeholder="예: 7000000"
            />

            <TextField
              label="예산 비고 및 메모"
              multiline
              rows={2}
              fullWidth
              size="small"
              value={budgetNotesInput}
              onChange={(e) => setBudgetNotesInput(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenBudgetModal(false)}>취소</Button>
          <Button variant="contained" onClick={handleSaveBudget} disabled={savingBudget} sx={{ fontWeight: 700 }}>
            {savingBudget ? '저장 중...' : '예산 저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog 2: Register Transaction Item */}
      <Dialog open={openTxModal} onClose={() => setOpenTxModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {txType === 'INCOME' ? '🟢 입금(매출) 스케줄 추가' : '🔴 출금(비용) 스케줄 추가'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>프로젝트 선택</InputLabel>
              <Select value={selectedProjectId} label="프로젝트 선택" onChange={(e) => setSelectedProjectId(e.target.value)}>
                {budgets.map((b) => (
                  <MenuItem key={b.projectId} value={b.projectId}>
                    {b.projectName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>구분 카테고리</InputLabel>
              <Select value={txCategory} label="구분 카테고리" onChange={(e) => setTxCategory(e.target.value)}>
                {txType === 'INCOME' ? [
                  <MenuItem key="선금" value="선금">선금 (계약금)</MenuItem>,
                  <MenuItem key="중도금" value="중도금">중도금</MenuItem>,
                  <MenuItem key="잔금" value="잔금">잔금</MenuItem>,
                  <MenuItem key="기타수입" value="기타">기타 수입</MenuItem>,
                ] : [
                  <MenuItem key="외주비" value="외주비">외주용역비</MenuItem>,
                  <MenuItem key="인건비" value="인건비">인건비</MenuItem>,
                  <MenuItem key="서버비" value="장비/서버비">장비/서버비</MenuItem>,
                  <MenuItem key="기타지출" value="기타">기타 지출</MenuItem>,
                ]}
              </Select>
            </FormControl>

            <TextField
              label="항목 제목"
              fullWidth
              size="small"
              value={txTitle}
              onChange={(e) => setTxTitle(e.target.value)}
              placeholder="예: 1차 중도금 수금 / 개발 외주비 지급"
            />

            <TextField
              label="금액 (원)"
              type="number"
              fullWidth
              size="small"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              placeholder="예: 3000000"
            />

            <TextField
              label="입출금 예정일"
              type="date"
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={txDueDate}
              onChange={(e) => setTxDueDate(e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>처리 상태</InputLabel>
              <Select value={txStatus} label="처리 상태" onChange={(e) => setTxStatus(e.target.value as any)}>
                <MenuItem value="SCHEDULED">⏳ 예정됨</MenuItem>
                <MenuItem value="COMPLETED">✅ 완료됨 (입금/지급완료)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenTxModal(false)}>취소</Button>
          <Button variant="contained" onClick={handleSaveTx} disabled={savingTx} sx={{ fontWeight: 700 }}>
            {savingTx ? '등록 중...' : '스케줄 등록'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
