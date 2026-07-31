'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import FolderIcon from '@mui/icons-material/Folder';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import LoginIcon from '@mui/icons-material/Login';

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

export default function PublicMeetingRoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params?.id as string;
  const queryEmail = searchParams.get('email') || '';

  const [room, setRoom] = useState<MeetingRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Guest Identity State
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState(queryEmail);
  const [openGuestModal, setOpenGuestModal] = useState(false);
  const [guestJoined, setGuestJoined] = useState(false);

  // Chat Input State
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSyncNotice, setFileSyncNotice] = useState('');

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

  const fetchHistoryList = useCallback(async () => {
    if (!roomId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/meetings/${roomId}/history`);
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

  const handleOpenHistoryModal = () => {
    setOpenHistoryModal(true);
    fetchHistoryList();
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load saved guest info from localStorage
    const savedName = localStorage.getItem('myagent_guest_name');
    const savedEmail = localStorage.getItem('myagent_guest_email') || queryEmail;
    if (savedName) setGuestName(savedName);
    if (savedEmail) setGuestEmail(savedEmail);
  }, [queryEmail]);

  const fetchRoomDetails = useCallback(async () => {
    if (!roomId) return;
    try {
      const emailToUse = guestEmail || queryEmail;
      const res = await fetch(`/api/meetings/${roomId}?email=${encodeURIComponent(emailToUse)}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.isRestricted) {
          setOpenGuestModal(true);
        }
        throw new Error(data.error || '회의실 접근 권한이 없습니다.');
      }

      setRoom(data);
      setMessages(data.messages || []);
      setError('');
    } catch (err: any) {
      setError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [roomId, guestEmail, queryEmail]);

  useEffect(() => {
    fetchRoomDetails();
    const interval = setInterval(() => {
      fetchRoomDetails();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchRoomDetails]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleGuestJoin = () => {
    if (!guestName.trim() || !guestEmail.trim()) {
      setError('이름과 이메일을 모두 입력해 주세요.');
      return;
    }
    localStorage.setItem('myagent_guest_name', guestName.trim());
    localStorage.setItem('myagent_guest_email', guestEmail.trim());
    setGuestJoined(true);
    setOpenGuestModal(false);
    fetchRoomDetails();
  };

  const handleCopyLink = () => {
    const origin = window.location.origin;
    const link = `${origin}/meetings/${roomId}`;
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
      formData.append('senderName', guestName || '외부 게스트');
      formData.append('senderEmail', guestEmail || 'guest@external.com');
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await fetch(`/api/meetings/${roomId}/messages`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '메시지 전송 실패');

      setInputMessage('');
      setSelectedFile(null);

      if (data.projectFileSynced && data.projectName) {
        setFileSyncNotice(`📁 전송된 파일이 [${data.projectName}] 프로젝트 보관함에 자동 수집되었습니다!`);
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
      <Box sx={{ py: 12, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          온라인 회의실 연결 중...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      {/* Public Top Header Bar */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 } }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800 }}>
                💬 {room?.title || '온라인 회의실'}
              </Typography>
              {room && (
                <Chip
                  icon={room.accessType === 'PUBLIC' ? <PublicIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                  label={room.accessType === 'PUBLIC' ? '🌐 외부 공개 회의실' : '🔒 이메일 초대 전용'}
                  size="small"
                  color={room.accessType === 'PUBLIC' ? 'success' : 'warning'}
                  variant="outlined"
                />
              )}
              {room?.project && (
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
              <Button variant="outlined" size="small" startIcon={<FolderIcon />} onClick={handleOpenHistoryModal} sx={{ fontWeight: 700 }}>
                📜 회의록 히스토리
              </Button>
              <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={handleCopyLink}>
                {copied ? '초대 링크 복사됨!' : '🔗 외부 공유 링크 복사'}
              </Button>
              <Button variant="contained" size="small" startIcon={<LoginIcon />} onClick={() => router.push('/login')} sx={{ fontWeight: 700 }}>
                로그인
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Paper>

      {/* Main Public Chatroom Container */}
      <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {error && !room ? (
          <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider', my: 'auto' }}>
            <LockIcon sx={{ fontSize: 56, color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800, mb: 1 }}>
              {error}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              초대받은 이메일 주소를 입력하여 회의실에 입장해 보세요.
            </Typography>
            <Button variant="contained" onClick={() => setOpenGuestModal(true)} sx={{ fontWeight: 700 }}>
              게스트 정보 입력 후 입장
            </Button>
          </Paper>
        ) : (
          <>
            {fileSyncNotice && (
              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2, borderRadius: 2 }}>
                {fileSyncNotice}
              </Alert>
            )}

            <Grid container spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
              {/* Left Side: Public Chatroom Thread */}
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
                        const isMe = guestEmail && m.senderEmail === guestEmail;
                        const isHostMsg = room?.host.email === m.senderEmail;
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
                      placeholder={guestName ? `${guestName}님, 메시지를 입력하세요...` : '이름을 등록하고 메시지를 입력하세요...'}
                      fullWidth
                      size="small"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onFocus={() => {
                        if (!guestName) setOpenGuestModal(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!guestName) {
                            setOpenGuestModal(true);
                          } else {
                            handleSendMessage();
                          }
                        }
                      }}
                    />

                    <Button
                      variant="contained"
                      color="primary"
                      endIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                      onClick={() => {
                        if (!guestName) {
                          setOpenGuestModal(true);
                        } else {
                          handleSendMessage();
                        }
                      }}
                      disabled={sending || (!inputMessage.trim() && !selectedFile)}
                      sx={{ px: 2.5, fontWeight: 700 }}
                    >
                      전송
                    </Button>
                  </Stack>
                </Paper>
              </Grid>

              {/* Right Side: Public Attendee List */}
              <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ height: '100%' }}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', height: '100%' }}>
                  <Typography variant="subtitle1" color="text.primary" sx={{ mb: 1.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                    👥 참석자 리스트 ({room?.attendees.length || 1}명)
                  </Typography>
                  <Divider sx={{ mb: 1.5 }} />

                  <List disablePadding sx={{ overflowY: 'auto', maxHeight: 'calc(100% - 60px)' }}>
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

                    {room?.attendees.map((att) => {
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
          </>
        )}
      </Container>

      {/* Guest Identification Dialog */}
      <Dialog open={openGuestModal} onClose={() => setOpenGuestModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>💬 회의실 게스트 입장</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              회의실에서 사용할 이름과 이메일 주소를 입력하시면 바로 대화에 참여하실 수 있습니다.
            </Typography>
            <TextField
              label="이름 (닉네임)"
              fullWidth
              size="small"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="예: 홍길동 팀장"
            />
            <TextField
              label="이메일 주소"
              type="email"
              fullWidth
              size="small"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenGuestModal(false)}>닫기</Button>
          <Button variant="contained" onClick={handleGuestJoin} disabled={!guestName.trim() || !guestEmail.trim()} sx={{ fontWeight: 700 }}>
            회의실 입장
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
                저장된 AI 회의록 히스토리가 없습니다. 방장이 [🤖 AI 회의 요약 & 회의 종료]를 실행하면 회의록이 자동 저장됩니다.
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
                      <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 800, mb: 1 }}>
                        📌 AI 회의 요약본 (v{historyList[selectedHistoryIndex].version})
                      </Typography>
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
    </Box>
  );
}
