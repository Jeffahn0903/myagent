'use client';

import React, { useEffect, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  List,
  ListItem,
  CircularProgress,
  Divider,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TaskIcon from '@mui/icons-material/Task';
import FolderIcon from '@mui/icons-material/Folder';
import PeopleIcon from '@mui/icons-material/People';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  title: string;
  details?: string | null;
  targetUrl?: string | null;
  createdAt: string;
}

export default function ActivityWidget() {
  const { token } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/activity', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLogs(data.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return <Chip icon={<AddCircleIcon fontSize="small" />} label="생성" color="success" size="small" sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem' }} />;
      case 'UPDATE':
        return <Chip icon={<EditIcon fontSize="small" />} label="수정" color="info" size="small" sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem' }} />;
      case 'DELETE':
        return <Chip icon={<DeleteIcon fontSize="small" />} label="삭제" color="error" size="small" sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem' }} />;
      default:
        return <Chip label={action} size="small" sx={{ height: 22, fontSize: '0.72rem' }} />;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType.toUpperCase()) {
      case 'SCHEDULE':
        return <CalendarMonthIcon fontSize="small" sx={{ color: '#3b82f6' }} />;
      case 'PROJECT':
        return <FolderIcon fontSize="small" sx={{ color: '#8b5cf6' }} />;
      case 'TASK':
        return <TaskIcon fontSize="small" sx={{ color: '#e11d48' }} />;
      case 'CUSTOMER':
        return <PeopleIcon fontSize="small" sx={{ color: '#10b981' }} />;
      default:
        return <HistoryIcon fontSize="small" sx={{ color: '#64748b' }} />;
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" /> 📜 최근 변경이력 (Activity Logs)
        </Typography>
        <Button
          size="small"
          endIcon={<ArrowForwardIcon />}
          onClick={() => router.push('/dashboard/history')}
          sx={{ fontWeight: 700, textTransform: 'none' }}
        >
          변경이력 전체보기
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        워크스페이스에서 수행된 최근 5개의 추가·수정·삭제 변경 이력입니다.
      </Typography>

      <Divider sx={{ mb: 1 }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : logs.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">최근 기록된 변경 이력이 없습니다.</Typography>
        </Box>
      ) : (
        <List disablePadding sx={{ flexGrow: 1 }}>
          {logs.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <Divider component="li" />}
              <ListItem
                sx={{
                  py: 1.2,
                  px: 1,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>{getEntityIcon(item.entityType)}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      {getActionBadge(item.action)}
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {item.title}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                      🕒 {new Date(item.createdAt).toLocaleString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Box>
                </Stack>

                {item.targetUrl && (
                  <Button
                    size="small"
                    variant="text"
                    endIcon={<OpenInNewIcon fontSize="small" />}
                    onClick={() => router.push(item.targetUrl!)}
                    sx={{ minWidth: 'auto', px: 1, fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    이동
                  </Button>
                )}
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
}
