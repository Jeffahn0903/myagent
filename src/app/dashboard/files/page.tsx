'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert,
  Stack,
  Chip,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link as MuiLink,
  Tooltip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import HomeIcon from '@mui/icons-material/Home';

interface ProjectOption {
  id: string;
  name: string;
  driveFolderId?: string | null;
}

interface FileItem {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType?: string;
  webViewLink?: string;
  driveFileId?: string;
  driveFolderId?: string | null;
  fileCount?: number;
  hasNewFiles?: boolean;
  projectId?: string | null;
  createdAt?: string;
  size?: string;
}

export default function FilesPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<FileItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Navigation State
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderHistory, setFolderHistory] = useState<{ id: string; name: string }[]>([]);

  // Dialog States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState<FileItem | null>(null);
  const [linkProjectId, setLinkProjectId] = useState('');

  const [syncing, setSyncing] = useState(false);

  // Fetch projects list for mapping dropdown
  const fetchProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.ok ? await res.json() : [];
        setProjects(data);
      }
    } catch (e) {}
  }, [token]);

  // Fetch current folder contents
  const fetchFiles = useCallback(async (folderId?: string) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      let url = '/api/drive/files';
      if (folderId) {
        url += `?folderId=${folderId}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('파일 목록을 불러오지 못했습니다.');
      const data = await res.json();
      setItems(data);
    } catch (err: any) {
      setError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchProjects();
      fetchFiles(currentFolder?.id);
    }
  }, [token, currentFolder, fetchFiles, fetchProjects]);

  // Navigate into folder
  const handleEnterFolder = (item: FileItem) => {
    // If it's a project virtual folder, it might link to a project detail page or have driveFolderId
    if (item.id.startsWith('proj-')) {
      if (item.driveFolderId) {
        setFolderHistory((prev) => [...prev, { id: item.driveFolderId!, name: item.name }]);
        setCurrentFolder({ id: item.driveFolderId!, name: item.name });
      } else {
        setError('해당 프로젝트에 구글 드라이브 폴더가 설정되어 있지 않습니다.');
      }
    } else {
      setFolderHistory((prev) => [...prev, { id: item.id, name: item.name }]);
      setCurrentFolder({ id: item.id, name: item.name });
    }
  };

  // Navigate back to parent folder
  const handleBack = () => {
    if (folderHistory.length <= 1) {
      setFolderHistory([]);
      setCurrentFolder(null);
    } else {
      const newHistory = folderHistory.slice(0, -1);
      const parent = newHistory[newHistory.length - 1];
      setFolderHistory(newHistory);
      setCurrentFolder(parent);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setFolderHistory([]);
      setCurrentFolder(null);
    } else {
      const newHistory = folderHistory.slice(0, index + 1);
      setFolderHistory(newHistory);
      setCurrentFolder(newHistory[newHistory.length - 1]);
    }
  };

  // Create Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !token) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newFolderName,
          projectId: selectedProjectId || null,
        }),
      });
      if (!res.ok) throw new Error('폴더 생성 실패');
      setNewFolderName('');
      setSelectedProjectId('');
      setCreateDialogOpen(false);
      fetchFiles(currentFolder?.id);
      fetchProjects();
    } catch (err: any) {
      alert(err?.message || '오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  // Link Folder
  const handleLinkFolder = async () => {
    if (!targetFolder || !token) return;
    setSyncing(true);
    try {
      // Stripping "gdrive-" prefix if present
      const cleanFolderId = targetFolder.id.startsWith('gdrive-') 
        ? targetFolder.id.replace('gdrive-', '') 
        : targetFolder.id;

      const res = await fetch('/api/drive/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          folderId: cleanFolderId,
          projectId: linkProjectId || null, // null for unlink
        }),
      });
      if (!res.ok) throw new Error('폴더 연동 실패');
      setLinkDialogOpen(false);
      setTargetFolder(null);
      setLinkProjectId('');
      fetchFiles(currentFolder?.id);
      fetchProjects();
    } catch (err: any) {
      alert(err?.message || '오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Title Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
            📁 파일 보관함
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            구글 드라이브와 연동하여 폴더별로 파일을 탐색하고 프로젝트와 손쉽게 매핑하여 관리합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          {currentFolder && (
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack} size="small">
              이전으로
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)} size="small">
            새 폴더 생성
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* Navigation Breadcrumbs */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Breadcrumbs aria-label="breadcrumb">
          <MuiLink
            component="button"
            variant="subtitle2"
            onClick={() => handleBreadcrumbClick(-1)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: !currentFolder ? 700 : 500, color: !currentFolder ? 'primary.main' : 'inherit', textDecoration: 'none', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            최상위 루트
          </MuiLink>
          {folderHistory.map((item, idx) => {
            const isLast = idx === folderHistory.length - 1;
            return (
              <Typography
                key={item.id}
                color={isLast ? 'primary.main' : 'text.primary'}
                sx={{ display: 'flex', alignItems: 'center', fontWeight: isLast ? 700 : 500, fontSize: '0.875rem' }}
              >
                {item.name}
              </Typography>
            );
          })}
        </Breadcrumbs>
      </Paper>

      {/* Main Files/Folders List */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              파일을 조회 중입니다...
            </Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <FolderIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              이 폴더에는 표시할 폴더나 파일이 없습니다.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {items.map((item, idx) => {
              // Find matching project if driveFolderId matches or if it's proj- prefix
              let linkedProj = null;
              if (item.id.startsWith('proj-')) {
                linkedProj = projects.find((p) => p.id === item.projectId);
              } else {
                // Stripping prefixes to check driveFolderId match
                const rawId = item.id.replace('gdrive-', '');
                linkedProj = projects.find((p) => p.driveFolderId === rawId);
              }

              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    sx={{
                      py: 1.8,
                      px: 2.5,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    secondaryAction={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        {item.webViewLink && (
                          <Tooltip title="구글 드라이브에서 열기" sx={{ display: 'inline-flex' }}>
                            <IconButton
                              component="a"
                              href={item.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="small"
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {item.isFolder && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={linkedProj ? <LinkOffIcon /> : <LinkIcon />}
                            onClick={() => {
                              setTargetFolder(item);
                              setLinkProjectId(linkedProj?.id || '');
                              setLinkDialogOpen(true);
                            }}
                          >
                            {linkedProj ? '연결 관리' : '프로젝트 연결'}
                          </Button>
                        )}
                      </Stack>
                    }
                  >
                    <ListItemIcon
                      onClick={() => item.isFolder && handleEnterFolder(item)}
                      sx={{ cursor: item.isFolder ? 'pointer' : 'default', minWidth: 40 }}
                    >
                      {item.isFolder ? (
                        <FolderIcon sx={{ color: '#eab308' }} />
                      ) : (
                        <InsertDriveFileIcon sx={{ color: '#3b82f6' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      onClick={() => item.isFolder && handleEnterFolder(item)}
                      sx={{ cursor: item.isFolder ? 'pointer' : 'default', pr: 20 }}
                      primary={
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {item.name}
                          </Typography>
                          {item.isFolder && item.fileCount !== undefined && (
                            <Chip label={`파일 ${item.fileCount}개`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                          )}
                          {linkedProj && (
                            <Chip
                              label={`연결: ${linkedProj.name}`}
                              color="secondary"
                              size="small"
                              variant="filled"
                              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {item.isFolder ? '폴더' : item.mimeType?.split('/').pop()?.toUpperCase() || '파일'}
                          {item.createdAt && ` • 생성일: ${new Date(item.createdAt).toLocaleDateString()}`}
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

      {/* Dialog: Create Folder */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>새 구글 드라이브 폴더 생성</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="폴더 이름 *"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              fullWidth
              autoFocus
              required
              placeholder="예: 2026 하반기 마케팅 기획"
            />
            <FormControl fullWidth>
              <InputLabel id="folder-proj-select-label">📁 연결할 프로젝트 (선택)</InputLabel>
              <Select
                labelId="folder-proj-select-label"
                value={selectedProjectId}
                label="📁 연결할 프로젝트 (선택)"
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <MenuItem value="">
                  <em>프로젝트 연결하지 않음</em>
                </MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>취소</Button>
          <Button
            onClick={handleCreateFolder}
            variant="contained"
            disabled={syncing || !newFolderName.trim()}
          >
            {syncing ? <CircularProgress size={20} color="inherit" /> : '폴더 생성'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Link Folder */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>프로젝트 연결 및 관리</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            구글 드라이브 폴더 <strong>[{targetFolder?.name}]</strong>를 시스템 내 프로젝트와 연결합니다.
          </Typography>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="link-proj-select-label">📁 연결할 프로젝트 선택</InputLabel>
              <Select
                labelId="link-proj-select-label"
                value={linkProjectId}
                label="📁 연결할 프로젝트 선택"
                onChange={(e) => setLinkProjectId(e.target.value)}
              >
                <MenuItem value="">
                  <em>연결 해제 (프로젝트 연결 안 함)</em>
                </MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLinkDialogOpen(false)}>취소</Button>
          <Button onClick={handleLinkFolder} variant="contained" disabled={syncing}>
            {syncing ? <CircularProgress size={20} color="inherit" /> : '설정 저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

