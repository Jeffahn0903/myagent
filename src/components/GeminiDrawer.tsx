'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Stack,
  Paper,
  CircularProgress,
  Chip,
  Avatar,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TaskIcon from '@mui/icons-material/Task';
import FolderIcon from '@mui/icons-material/Folder';
import { useAuth } from '@/contexts/AuthContext';
import { useColorMode } from '@/contexts/ThemeContext';

interface ProposedAction {
  action: string;
  data: any;
  confirmed?: boolean;
  cancelled?: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  actionExecuted?: { type: string; title: string } | null;
  proposedAction?: ProposedAction | null;
  timestamp: string;
}

interface GeminiDrawerProps {
  open: boolean;
  onClose: () => void;
  onDataCreated?: () => void;
}

export default function GeminiDrawer({ open, onClose, onDataCreated }: GeminiDrawerProps) {
  const { token, user } = useAuth();
  const { mode } = useColorMode();
  const isDark = mode === 'dark';

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'gemini',
      text: `안녕하세요 ${user?.name || '사용자'}님! ✨ Gemini AI 스마트 비서입니다.\n\n전체 일정, 프로젝트, 타스크 정보를 조회하거나 질문해보세요.\n\n일정이나 타스크 생성을 요청하시면 먼저 확인카드를 보여드리며, 수락 시에만 생성됩니다.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || !token || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: query }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '답변 생성 실패');

      const geminiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'gemini',
        text: data.responseText,
        proposedAction: data.proposedAction,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, geminiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'gemini',
          text: `오류가 발생했습니다: ${err?.message || 'Gemini AI에 연결할 수 없습니다.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, proposed: ProposedAction) => {
    if (!token) return;
    try {
      const res = await fetch('/api/ai/assistant/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: proposed.action, data: proposed.data }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                proposedAction: m.proposedAction ? { ...m.proposedAction, confirmed: true } : null,
                actionExecuted: {
                  type: proposed.action === 'CREATE_SCHEDULE' ? '일정' : proposed.action === 'CREATE_TASK' ? '타스크' : '프로젝트',
                  title: data.entity?.title || data.entity?.name || proposed.data.title || proposed.data.name,
                },
              }
            : m
        )
      );

      if (onDataCreated) {
        onDataCreated();
      }
    } catch (err: any) {
      alert(err?.message || '생성에 실패했습니다.');
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              proposedAction: m.proposedAction ? { ...m.proposedAction, cancelled: true } : null,
            }
          : m
      )
    );
  };

  const handlePresetClick = (presetText: string) => {
    handleSend(presetText);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 400, md: 440 },
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
            borderLeft: '1px solid',
            borderColor: isDark ? '#1e293b' : '#e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1250,
          },
        },
      }}
    >
      {/* Header Banner (Google Workspace Gemini Bar) */}
      <Box
        sx={{
          p: 2,
          px: 2.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isDark
            ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)',
          borderBottom: '1px solid',
          borderColor: isDark ? '#312e81' : '#ddd6fe',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Avatar
            sx={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              width: 36,
              height: 36,
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 20, color: '#ffffff' }} />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #8b5cf6 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Gemini AI Assistant
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              MyAgent 스마트 워크스페이스 비서
            </Typography>
          </Box>
        </Stack>

        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Suggested Action Chips (Quick Prompts) */}
      <Box sx={{ p: 1.5, px: 2, bgcolor: isDark ? '#1e293b' : '#f8fafc', borderBottom: '1px solid', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
          💡 추천 빠른 명령어 (클릭 시 실행):
        </Typography>
        <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
          <Chip
            icon={<AutoAwesomeIcon fontSize="small" />}
            label="📊 내 모든 정보 요약"
            size="small"
            color="primary"
            variant="filled"
            onClick={() => handlePresetClick('현재 내 계정에 등록된 모든 정보(일정, 프로젝트, 타스크, 고객/명함, AI 리포트)를 찾아 요약해서 알려줘')}
            clickable
            sx={{ fontSize: '0.75rem', height: 26, fontWeight: 700 }}
          />
          <Chip
            icon={<CalendarMonthIcon fontSize="small" />}
            label="내일 일정 알려줘"
            size="small"
            variant="outlined"
            onClick={() => handlePresetClick('내일 예정된 일정을 알려줘')}
            clickable
            sx={{ fontSize: '0.75rem', height: 26 }}
          />
          <Chip
            icon={<FolderIcon fontSize="small" />}
            label="프로젝트 요약"
            size="small"
            variant="outlined"
            onClick={() => handlePresetClick('현재 진행 중인 프로젝트 현황을 요약해줘')}
            clickable
            sx={{ fontSize: '0.75rem', height: 26 }}
          />
          <Chip
            icon={<TaskIcon fontSize="small" />}
            label="등록된 고객/명함 조회"
            size="small"
            variant="outlined"
            color="info"
            onClick={() => handlePresetClick('등록된 모든 고객 및 명함 정보 목록을 보여줘')}
            clickable
            sx={{ fontSize: '0.75rem', height: 26 }}
          />
          <Chip
            icon={<TaskIcon fontSize="small" />}
            label="할 일 등록 요청"
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => handlePresetClick('내일까지 완료할 타스크 "주간 보고서 작성" 추가해줘')}
            clickable
            sx={{ fontSize: '0.75rem', height: 24 }}
          />
          <Chip
            icon={<AutoAwesomeIcon fontSize="small" />}
            label="신규 일정 생성 요청"
            size="small"
            variant="outlined"
            color="secondary"
            onClick={() => handlePresetClick('내일 오후 3시 팀 미팅 일정 생성해줘')}
            clickable
            sx={{ fontSize: '0.75rem', height: 24 }}
          />
        </Stack>
      </Box>

      {/* Messages Scroll Area */}
      <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', maxWidth: '88%' }}>
              {m.sender === 'gemini' && (
                <Avatar sx={{ width: 28, height: 28, bgcolor: '#8b5cf6', mt: 0.5 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 16, color: '#ffffff' }} />
                </Avatar>
              )}

              <Box sx={{ width: '100%' }}>
                <Paper
                  elevation={1}
                  sx={{
                    p: 1.8,
                    borderRadius: m.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    bgcolor: m.sender === 'user' ? '#3b82f6' : isDark ? '#1e293b' : '#f5f3ff',
                    color: m.sender === 'user' ? '#ffffff' : isDark ? '#f8fafc' : '#1e1b4b',
                    border: m.sender === 'gemini' ? `1px solid ${isDark ? '#3730a3' : '#ddd6fe'}` : 'none',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.6,
                      fontSize: '0.88rem',
                    }}
                  >
                    {m.text}
                  </Typography>

                  {/* Proposed Action Confirmation Card */}
                  {m.proposedAction && !m.proposedAction.confirmed && !m.proposedAction.cancelled && (
                    <Paper
                      elevation={0}
                      sx={{
                        mt: 1.5,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: isDark ? '#0f172a' : '#ffffff',
                        border: `1px solid ${isDark ? '#3b82f6' : '#93c5fd'}`,
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1d4ed8', mb: 0.8, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        💡 {m.proposedAction.action === 'CREATE_SCHEDULE' ? '🗓️ 신규 일정 생성 제안' : m.proposedAction.action === 'CREATE_TASK' ? '🎯 신규 타스크 생성 제안' : '📁 신규 프로젝트 생성 제안'}
                      </Typography>

                      <Typography variant="body2" sx={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                        제목: "{m.proposedAction.data.title || m.proposedAction.data.name}"
                      </Typography>

                      {m.proposedAction.data.startTime && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.3 }}>
                          일시: {new Date(m.proposedAction.data.startTime).toLocaleString('ko-KR')}
                        </Typography>
                      )}

                      <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.5, fontStyle: 'italic' }}>
                        버튼을 누르면 데이터베이스에 최종 저장됩니다.
                      </Typography>

                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => handleConfirmAction(m.id, m.proposedAction!)}
                          sx={{ fontWeight: 700, fontSize: '0.78rem' }}
                        >
                          수락 및 생성
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          onClick={() => handleCancelAction(m.id)}
                          sx={{ fontSize: '0.78rem' }}
                        >
                          취소
                        </Button>
                      </Stack>
                    </Paper>
                  )}

                  {m.proposedAction?.cancelled && (
                    <Chip label="생성 요청이 취소되었습니다." size="small" variant="outlined" color="warning" sx={{ mt: 1, height: 22, fontSize: '0.7rem' }} />
                  )}

                  {/* Action Executed Badge */}
                  {m.actionExecuted && (
                    <Box
                      sx={{
                        mt: 1.5,
                        p: 1.2,
                        borderRadius: 2,
                        bgcolor: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20 }} />
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#10b981', display: 'block' }}>
                          ✅ 생성 완료!
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDark ? '#e2e8f0' : '#0f172a', fontWeight: 600 }}>
                          [{m.actionExecuted.type}] {m.actionExecuted.title}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Paper>
                <Typography suppressHydrationWarning variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: m.sender === 'user' ? 'right' : 'left', fontSize: '0.68rem' }}>
                  {m.timestamp}
                </Typography>
              </Box>
            </Stack>
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#8b5cf6' }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: '#8b5cf6' }}>
              <CircularProgress size={16} color="inherit" />
            </Avatar>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Gemini AI가 답변을 준비하고 있습니다...
            </Typography>
          </Box>
        )}
        <div ref={chatEndRef} />
      </Box>

      {/* Footer Chat Input Area */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: isDark ? '#1e293b' : '#e2e8f0',
          bgcolor: isDark ? '#0f172a' : '#ffffff',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Gemini에게 질문하거나 '내일 미팅 추가해줘' 같이 입력..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
            multiline
            maxRows={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: '0.88rem',
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            sx={{
              bgcolor: '#8b5cf6',
              color: '#ffffff',
              '&:hover': { bgcolor: '#7c3aed' },
              '&.Mui-disabled': { bgcolor: isDark ? '#334155' : '#cbd5e1' },
              p: 1.2,
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>
    </Drawer>
  );
}
