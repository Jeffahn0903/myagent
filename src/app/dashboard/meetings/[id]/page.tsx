'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
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
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import FolderIcon from '@mui/icons-material/Folder';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';

interface Attendee {
  id: string;
  name: string;
  email: string;
  role: 'HOST' | 'ATTENDEE' | 'GUEST';
}

interface Message {
  id: string;
  senderName: string;
  senderEmail: string;
  text: string;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  createdAt: string;
}

interface MeetingRoom {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  accessType: 'PUBLIC' | 'RESTRICTED';
  allowedEmails?: string | null;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
  } | null;
  host: {
    id: string;
    name: string;
    email: string;
  };
  attendees: Attendee[];
  messages: Message[];
}

export default function MeetingRoomChatPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roomId = params?.id as string;

  const [room, setRoom] = useState<MeetingRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Chat Input State
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSyncNotice, setFileSyncNotice] = useState('');

  // AI Meeting Summarizer State
  const [generatingAi, setGeneratingAi] = useState(false);
  const [openSummaryModal, setOpenSummaryModal] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState<{
    summaryMarkdown: string;
    suggestedSchedules: Array<{ title: string; startTime?: string; endTime?: string; location?: string; selected?: boolean }>;
    suggestedTasks: Array<{ title: string; dueDate?: string; priority?: string; selected?: boolean }>;
  } | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // History Modal State
  const [openHistoryModal, setOpenHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyList, setHistoryList] = useState<Array<{
    id: string;
    title: string;
    summaryMarkdown: string;
    schedules: any[];
    tasks: any[];
    version: number;
    createdAt: string;
  }>>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [compareLoading, setCompareLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<string | null>(null);

  const fetchHistoryList = useCallback(async () => {
    if (!roomId) return;
    setHistoryLoading(true);
    setDiffResult(null);
    try {
      const res = await fetch(`/api/meetings/${roomId}/history?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
        setSelectedHistoryIndex(0);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [roomId]);

  const handleCompareVersions = async (index: number) => {
    if (index >= historyList.length - 1 || !roomId) return;
    const currentItem = historyList[index];
    const previousItem = historyList[index + 1];

    setCompareLoading(true);
    setDiffResult(null);
    try {
      const res = await fetch(`/api/meetings/${roomId}/compare-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historyIdA: previousItem.id,
          historyIdB: currentItem.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDiffResult(data.diffSummary);
      }
    } catch (err) {
      console.error('Compare error:', err);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleOpenHistoryModal = () => {
    setOpenHistoryModal(true);
    fetchHistoryList();
  };

  const handleGenerateAiSummary = async () => {
    if (!token || !roomId) return;
    setGeneratingAi(true);
    setError('');
    try {
      const res = await fetch(`/api/meetings/${roomId}/ai-summary`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 회의 요약 실패');

      setAiSummaryResult({
        summaryMarkdown: data.summaryMarkdown,
        suggestedSchedules: (data.suggestedSchedules || []).map((s: any) => ({ ...s, selected: true })),
        suggestedTasks: (data.suggestedTasks || []).map((t: any) => ({ ...t, selected: true })),
      });
      setOpenSummaryModal(true);
    } catch (err: any) {
      setError(err?.message || 'AI 요약 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleFinalizeMeeting = async () => {
    if (!token || !roomId || !aiSummaryResult) return;
    setFinalizing(true);
    try {
      const selectedSchedules = aiSummaryResult.suggestedSchedules.filter((s) => s.selected);
      const selectedTasks = aiSummaryResult.suggestedTasks.filter((t) => t.selected);

      const res = await fetch(`/api/meetings/${roomId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          summaryMarkdown: aiSummaryResult.summaryMarkdown,
          schedules: selectedSchedules,
          tasks: selectedTasks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '회의록 확정 실패');

      setFileSyncNotice(`✨ 회의록이 성공적으로 확정되었습니다! (일정 ${data.createdScheduleCount}건, 타스크 ${data.createdTaskCount}건 자동 등록 완료)`);
      setOpenSummaryModal(false);
      fetchRoomDetails();
      fetchHistoryList();
    } catch (err: any) {
      setError(err?.message || '회의록 확정 중 오류가 발생했습니다.');
    } finally {
      setFinalizing(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRoomDetails = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/meetings/${roomId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '회의실 접근 실패');
      }

      setRoom(data);
      setMessages(data.messages || []);
    } catch (err: any) {
      setError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [roomId, token]);

  useEffect(() => {
    if (authLoading) return;
    fetchRoomDetails();

    // Poll messages every 3 seconds for live chat feel
    const interval = setInterval(() => {
      fetchRoomDetails();
    }, 3000);

    return () => clearInterval(interval);
  }, [authLoading, fetchRoomDetails]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/meetings/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !selectedFile) || sending || !roomId) return;
    setSending(true);
    setError('');
    setFileSyncNotice('');

    try {
      const formData = new FormData();
      formData.append('text', inputMessage.trim());
      if (user) {
        formData.append('senderName', user.name || '사용자');
        formData.append('senderEmail', user.email);
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await fetch(`/api/meetings/${roomId}/messages`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '메시지 전송 실패');

      setInputMessage('');
      setSelectedFile(null);

      if (data.projectFileSynced && data.projectName) {
        setFileSyncNotice(`📁 전송된 파일이 [${data.projectName}] 프로젝트 보관함에 자동 등록되었습니다!`);
        setTimeout(() => setFileSyncNotice(''), 5000);
      }

      fetchRoomDetails();
    } catch (err: any) {
      setError(err?.message || '전송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth={false} sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          온라인 회의실 연결 중...
        </Typography>
      </Container>
    );
  }

  if (error || !room) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error || '회의실을 찾을 수 없습니다.'}
        </Alert>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard/meetings')}>
          회의실 목록으로 돌아가기
        </Button>
      </Container>
    );
  }

  const isPublic = room.accessType === 'PUBLIC';

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar Header */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <IconButton onClick={() => router.push('/dashboard/meetings')} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800 }}>
              {room.title}
            </Typography>
            <Chip
              icon={isPublic ? <PublicIcon fontSize="small" /> : <LockIcon fontSize="small" />}
              label={isPublic ? '🌐 공개' : '🔒 제한됨'}
              size="small"
              color={isPublic ? 'success' : 'warning'}
              variant="outlined"
            />
            {room.project && (
              <Chip
                icon={<FolderIcon fontSize="small" />}
                label={`📁 ${room.project.name}`}
                size="small"
                color="primary"
                variant="filled"
                sx={{ fontWeight: 700 }}
              />
            )}
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarMonthIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {new Date(room.date).toLocaleString('ko-KR')}
              </Typography>
            </Box>

            <Button
              variant="contained"
              size="small"
              startIcon={generatingAi ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleGenerateAiSummary}
              disabled={generatingAi}
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(45deg, #7c3aed 30%, #3b82f6 90%)',
                color: '#ffffff',
                boxShadow: '0 3px 10px rgba(124, 58, 237, 0.4)',
                '&:hover': { background: 'linear-gradient(45deg, #6d28d9 30%, #2563eb 90%)' },
              }}
            >
              {generatingAi ? 'AI 분석 중...' : '🤖 AI 회의 요약 & 회의 종료'}
            </Button>

            <Button variant="outlined" size="small" startIcon={<FolderIcon />} onClick={handleOpenHistoryModal} sx={{ fontWeight: 700 }}>
              📜 회의록 히스토리
            </Button>

            <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={handleCopyLink}>
              {copied ? '링크 복사됨!' : '초대 링크 복사'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {fileSyncNotice && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          {fileSyncNotice}
        </Alert>
      )}

      {/* Main Workspace Layout (Chat Area & Attendee Side Panel) */}
      <Grid container spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
        {/* Left Side: Live Chatroom Area */}
        <Grid size={{ xs: 12, md: 8, lg: 9 }} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {/* Messages Scroll Thread */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {messages.length === 0 ? (
                <Box sx={{ py: 12, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    대화 내용이 없습니다. 첫 메시지나 프로젝트 파일을 공유해 보세요!
                  </Typography>
                </Box>
              ) : (
                messages.map((m) => {
                  const isMe = user?.email === m.senderEmail;
                  const isHostMsg = room.host.email === m.senderEmail;
                  return (
                    <Box key={m.id} sx={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', mb: 1 }}>
                      <Box sx={{ maxWidth: '75%' }}>
                        {!isMe && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.3, fontWeight: 700 }}>
                            {m.senderName} {isHostMsg && <Chip label="방장" size="small" color="primary" sx={{ height: 18, fontSize: '0.6rem' }} />}
                          </Typography>
                        )}
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            bgcolor: isMe ? 'primary.main' : (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f5f9'),
                            color: isMe ? '#ffffff' : 'text.primary',
                          }}
                        >
                          {m.text && <Typography variant="body2" sx={{ whitespace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{m.text}</Typography>}

                          {m.fileUrl && (
                            <Box sx={{ mt: m.text ? 1 : 0, pt: m.text ? 1 : 0, borderTop: m.text ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                              <Button
                                size="small"
                                variant={isMe ? 'contained' : 'outlined'}
                                color={isMe ? 'secondary' : 'primary'}
                                startIcon={<DownloadIcon />}
                                component="a"
                                href={m.fileUrl}
                                target="_blank"
                                download={m.fileName || 'file'}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                📎 {m.fileName || '첨부 파일 다운로드'}
                              </Button>
                            </Box>
                          )}
                        </Paper>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: isMe ? 'right' : 'left', mt: 0.3, fontSize: '0.65rem' }}>
                          {new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Selected File Badge */}
            {selectedFile && (
              <Box sx={{ mb: 1, p: 1, borderRadius: 2, bgcolor: 'action.selected', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  📎 첨부 준비: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </Typography>
                <Button size="small" color="error" onClick={() => setSelectedFile(null)}>
                  취소
                </Button>
              </Box>
            )}

            {/* Input Form Bar */}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
              <Tooltip title="파일 첨부 (프로젝트 보관함 자동 등록)">
                <IconButton color="primary" onClick={() => fileInputRef.current?.click()}>
                  <AttachFileIcon />
                </IconButton>
              </Tooltip>

              <TextField
                placeholder="메시지를 입력하거나 파일을 첨부해 전송하세요..."
                fullWidth
                size="small"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <Button
                variant="contained"
                color="primary"
                endIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                onClick={handleSendMessage}
                disabled={sending || (!inputMessage.trim() && !selectedFile)}
                sx={{ px: 2.5, fontWeight: 700 }}
              >
                전송
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* Right Side: Attendee List Panel */}
        <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ height: '100%' }}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', height: '100%' }}>
            <Typography variant="subtitle1" color="text.primary" sx={{ mb: 1.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              👥 참석자 리스트 ({room.attendees.length}명)
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            <List disablePadding sx={{ overflowY: 'auto', maxHeight: 'calc(100% - 60px)' }}>
              {/* Virtual AI Agent Avatar */}
              <ListItem sx={{ px: 1, py: 0.8, bgcolor: 'action.hover', borderRadius: 2, mb: 1 }}>
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#7c3aed' }}>
                    <SmartToyIcon fontSize="small" />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Gemini AI 회의 기록관 <Chip label="AI Agent" size="small" color="secondary" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800 }} />
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      실시간 대화 및 첨부파일 기록 중
                    </Typography>
                  }
                />
              </ListItem>

              {room.attendees.map((att) => {
                const isHost = att.role === 'HOST' || att.email === room.host.email;
                return (
                  <ListItem key={att.id} sx={{ px: 1, py: 0.8 }}>
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: isHost ? 'primary.main' : 'action.selected' }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {att.name} {isHost && <Chip label="방장" size="small" color="primary" sx={{ height: 18, fontSize: '0.6rem' }} />}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {att.email}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Modal: AI Summary & Action Confirmation */}
      <Dialog open={openSummaryModal} onClose={() => setOpenSummaryModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon color="primary" /> 🤖 Gemini AI 회의 요약 & 회의 종료 확정
        </DialogTitle>
        <DialogContent dividers>
          {aiSummaryResult && (
            <Stack spacing={3}>
              {/* Meeting Summary Section */}
              <Box>
                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 800, mb: 1 }}>
                  📌 회의 핵심 요약 및 결정 사항 (Gemini 3.6 AI 작성)
                </Typography>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ whitespace: 'pre-wrap', lineHeight: 1.7, color: 'text.primary' }}>
                    {aiSummaryResult.summaryMarkdown}
                  </Typography>
                </Paper>
              </Box>

              {/* Extracted Schedules Section */}
              <Box>
                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 800, mb: 1 }}>
                  🗓️ 자동 추출된 후속 일정 ({aiSummaryResult.suggestedSchedules.length}건)
                </Typography>
                {aiSummaryResult.suggestedSchedules.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    추출된 후속 일정이 없습니다.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {aiSummaryResult.suggestedSchedules.map((s, idx) => (
                      <Paper key={idx} elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={!!s.selected}
                              onChange={(e) => {
                                const next = [...aiSummaryResult.suggestedSchedules];
                                next[idx].selected = e.target.checked;
                                setAiSummaryResult({ ...aiSummaryResult, suggestedSchedules: next });
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {s.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {s.startTime ? new Date(s.startTime).toLocaleString('ko-KR') : '일시 미정'} | 장소: {s.location || '온라인'}
                              </Typography>
                            </Box>
                          }
                        />
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Extracted Tasks Section */}
              <Box>
                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 800, mb: 1 }}>
                  ✅ 자동 추출된 후속 액션 아이템/타스크 ({aiSummaryResult.suggestedTasks.length}건)
                </Typography>
                {aiSummaryResult.suggestedTasks.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    추출된 후속 타스크가 없습니다.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {aiSummaryResult.suggestedTasks.map((t, idx) => (
                      <Paper key={idx} elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={!!t.selected}
                              onChange={(e) => {
                                const next = [...aiSummaryResult.suggestedTasks];
                                next[idx].selected = e.target.checked;
                                setAiSummaryResult({ ...aiSummaryResult, suggestedTasks: next });
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {t.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                마감일: {t.dueDate || '미정'} | 우선순위: {t.priority || 'MEDIUM'}
                              </Typography>
                            </Box>
                          }
                        />
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setOpenSummaryModal(false)}>취소</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleFinalizeMeeting}
            disabled={finalizing}
            startIcon={finalizing ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{ fontWeight: 800, px: 3 }}
          >
            {finalizing ? '일정 및 타스크 등록 중...' : '✅ 회의록 확정 및 일정/타스크 일괄 등록'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: AI Meeting Minutes History Viewer */}
      <Dialog open={openHistoryModal} onClose={() => setOpenHistoryModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          📜 회의록 히스토리 내역 ({historyList.length}건)
        </DialogTitle>
        <DialogContent dividers>
          {historyLoading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                회의록 히스토리를 불러오는 중...
              </Typography>
            </Box>
          ) : historyList.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                저장된 AI 회의록 히스토리가 없습니다. 상단 [🤖 AI 회의 요약 & 회의 종료]를 진행해 보세요.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {/* Left Version Selector */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                  버전 목록 (최신순)
                </Typography>
                <Stack spacing={1}>
                  {historyList.map((h, idx) => (
                    <Paper
                      key={h.id}
                      elevation={0}
                      onClick={() => setSelectedHistoryIndex(idx)}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: selectedHistoryIndex === idx ? 'primary.main' : 'divider',
                        bgcolor: selectedHistoryIndex === idx ? 'action.selected' : 'background.paper',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 800, color: selectedHistoryIndex === idx ? 'primary.main' : 'text.primary' }}>
                        버전 v{h.version}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                        {new Date(h.createdAt).toLocaleString('ko-KR')}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Grid>

              {/* Right History Details */}
              <Grid size={{ xs: 12, sm: 8 }}>
                {historyList[selectedHistoryIndex] && (
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 800 }}>
                          📌 AI 회의 요약본 (v{historyList[selectedHistoryIndex].version})
                        </Typography>
                        {selectedHistoryIndex < historyList.length - 1 && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={compareLoading ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
                            onClick={() => handleCompareVersions(selectedHistoryIndex)}
                            disabled={compareLoading}
                            sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                          >
                            🔍 이전 버전(v{historyList[selectedHistoryIndex + 1].version})과 변경점 비교
                          </Button>
                        )}
                      </Stack>

                      {diffResult && (
                        <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'secondary.main', color: '#ffffff', borderRadius: 2, border: '1px solid', borderColor: 'primary.light' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            🤖 Gemini AI 버전 변경사항 비교 분석 (v{historyList[selectedHistoryIndex + 1].version} ➡️ v{historyList[selectedHistoryIndex].version})
                          </Typography>
                          <Typography variant="body2" sx={{ whitespace: 'pre-wrap', lineHeight: 1.6 }}>
                            {diffResult}
                          </Typography>
                        </Paper>
                      )}

                      <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Typography variant="body2" sx={{ whitespace: 'pre-wrap', lineHeight: 1.7 }}>
                          {historyList[selectedHistoryIndex].summaryMarkdown}
                        </Typography>
                      </Paper>
                    </Box>

                    {historyList[selectedHistoryIndex].schedules.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 800, mb: 1 }}>
                          🗓️ 생성된 일정 ({historyList[selectedHistoryIndex].schedules.length}건)
                        </Typography>
                        <Stack spacing={0.5}>
                          {historyList[selectedHistoryIndex].schedules.map((s: any, i: number) => (
                            <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              - {s.title} ({s.startTime ? new Date(s.startTime).toLocaleDateString('ko-KR') : ''})
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {historyList[selectedHistoryIndex].tasks.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 800, mb: 1 }}>
                          ✅ 생성된 타스크 ({historyList[selectedHistoryIndex].tasks.length}건)
                        </Typography>
                        <Stack spacing={0.5}>
                          {historyList[selectedHistoryIndex].tasks.map((t: any, i: number) => (
                            <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              - {t.title} (마감일: {t.dueDate || '미정'})
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenHistoryModal(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
