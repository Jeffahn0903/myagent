'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  TextField,
} from '@mui/material';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';

interface Article {
  title: string;
  description: string;
  url: string;
  publishedAt?: string;
  source: {
    name: string;
  };
}

interface SavedArticle {
  id: string;
  title: string;
  description: string | null;
  url: string;
  source: string | null;
  createdAt: string;
}

export default function NewsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(0);
  const [liveArticles, setLiveArticles] = useState<Article[]>([]);
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [readUrls, setReadUrls] = useState<Set<string>>(new Set());
  const [newsKeywords, setNewsKeywords] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [recommendingKeywords, setRecommendingKeywords] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const [newKeywordInput, setNewKeywordInput] = useState('');

  const keywordList = newsKeywords ? newsKeywords.split(',').map(k => k.trim()).filter(Boolean) : [];

  const handleDeleteKeyword = async (keywordToDelete: string) => {
    if (!token) return;
    const updatedList = keywordList.filter((k) => k !== keywordToDelete);
    const updatedKeywordsString = updatedList.join(', ');
    setNewsKeywords(updatedKeywordsString);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newsKeywords: updatedKeywordsString }),
      });
      if (!res.ok) throw new Error('키워드 삭제 실패');
      
      // Instantly refresh news matching new keywords
      const newsRes = await fetch('/api/news', { headers: { Authorization: `Bearer ${token}` } });
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setLiveArticles(Array.isArray(newsData) ? newsData : []);
      }
    } catch (err: any) {
      setError(err?.message || '키워드 업데이트 중 오류가 발생했습니다.');
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newKeywordInput.trim()) return;
    const trimmed = newKeywordInput.trim().replace(/,/g, '');
    if (keywordList.includes(trimmed)) {
      setError('이미 등록된 키워드입니다.');
      setNewKeywordInput('');
      return;
    }
    const updatedList = [...keywordList, trimmed];
    const updatedKeywordsString = updatedList.join(', ');
    setNewsKeywords(updatedKeywordsString);
    setNewKeywordInput('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newsKeywords: updatedKeywordsString }),
      });
      if (!res.ok) throw new Error('키워드 추가 실패');

      // Instantly refresh news matching new keywords
      const newsRes = await fetch('/api/news', { headers: { Authorization: `Bearer ${token}` } });
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setLiveArticles(Array.isArray(newsData) ? newsData : []);
      }
    } catch (err: any) {
      setError(err?.message || '키워드 업데이트 중 오류가 발생했습니다.');
    }
  };

  // Fetch Live News, Saved News, Read Status & Keywords
  const fetchNewsData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [newsRes, savedRes, readRes, settingsRes] = await Promise.all([
        fetch('/api/news', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/news/saved', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/news/read', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setLiveArticles(Array.isArray(newsData) ? newsData : []);
      }

      if (savedRes.ok) {
        const savedData = await savedRes.json();
        setSavedArticles(Array.isArray(savedData) ? savedData : []);
      }

      if (readRes.ok) {
        const readData = await readRes.json();
        setReadUrls(new Set(Array.isArray(readData) ? readData : []));
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setNewsKeywords(settingsData.newsKeywords || 'AI, 비즈니스, IT, 클라우드');
      }
    } catch (err) {
      setError('뉴스 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push('/login');
    } else {
      fetchNewsData();
    }
  }, [token, authLoading, router, fetchNewsData]);

  // Save / Bookmark News Article
  const handleSaveArticle = async (article: Article) => {
    if (!token) return;
    try {
      const res = await fetch('/api/news/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '뉴스 스크랩 실패');
      setSuccessMsg(`'${article.title.slice(0, 20)}...' 뉴스를 스크랩함에 저장했습니다!`);
      fetchNewsData();
    } catch (err: any) {
      setError(err?.message || '뉴스 스크랩 중 오류가 발생했습니다.');
    }
  };

  // Remove Saved Article
  const handleRemoveSavedArticle = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`/api/news/saved?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedArticles(savedArticles.filter((a) => a.id !== id));
    } catch (err) {}
  };

  // Mark Article as Read
  const handleMarkAsRead = async (article: Article) => {
    if (!token) return;
    try {
      await fetch('/api/news/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: article.title, url: article.url }),
      });
      setReadUrls((prev) => {
        const next = new Set(prev);
        next.add(article.url);
        return next;
      });
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };

  // Run Gemini AI News Analysis
  const handleRunAiAnalysis = async () => {
    if (!token) return;
    setAnalyzingAi(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/news/ai-analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 뉴스 분석 실패');
      setAiReport(data.report);
      setSuccessMsg(data.message || 'Gemini AI 뉴스 종합 분석이 완료되었습니다!');
      setActiveTab(2);
    } catch (err: any) {
      setError(err?.message || 'AI 뉴스 분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Gemini AI News Keyword Recommendation & Update based on read history
  const handleRecommendKeywords = async () => {
    if (!token) return;
    setRecommendingKeywords(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/news/recommend-keywords', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '관심 키워드 추천 업데이트 실패');
      setSuccessMsg(data.message);
      if (data.keywords) {
        setNewsKeywords(data.keywords);
        // Refetch matching news
        const newsRes = await fetch('/api/news', { headers: { Authorization: `Bearer ${token}` } });
        if (newsRes.ok) {
          const newsData = await newsRes.json();
          setLiveArticles(Array.isArray(newsData) ? newsData : []);
        }
      }
    } catch (err: any) {
      setError(err?.message || '맞춤 관심 키워드 분석 업데이트 중 오류가 발생했습니다.');
    } finally {
      setRecommendingKeywords(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Container maxWidth={false} sx={{ py: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  const savedUrls = new Set(savedArticles.map((s) => s.url));

  // Extract and Sort Unique Collection Dates
  const uniqueDates = Array.from(new Set(liveArticles.map((art) => art.publishedAt || todayStr))).sort((a, b) => b.localeCompare(a));

  // Filter Live Articles by selected date
  const filteredLiveArticles = selectedDate === 'all'
    ? liveArticles
    : liveArticles.filter((art) => (art.publishedAt || todayStr) === selectedDate);

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3.5,
          mb: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <NewspaperIcon sx={{ fontSize: 40, color: '#3b82f6' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff' }}>
                  뉴스 스크랩 & Gemini AI 인사이트 (News Insights)
                </Typography>
                <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                  맞춤 관심 키워드 뉴스 탐색, 주요 뉴스 스크랩 및 Gemini AI 시장 심층 분석 보고서
                </Typography>
              </Box>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchNewsData}
                disabled={loading}
                sx={{ color: '#ffffff', borderColor: '#3b82f6' }}
              >
                뉴스 다시 조회
              </Button>
              <Button
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => router.push('/dashboard/settings')}
                sx={{ color: '#ffffff', borderColor: '#3b82f6' }}
              >
                키워드 설정
              </Button>
              <Button
                variant="contained"
                startIcon={analyzingAi ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                onClick={handleRunAiAnalysis}
                disabled={analyzingAi}
                sx={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', fontWeight: 600 }}
              >
                Gemini AI 뉴스 심층 분석
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Global Alerts */}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{successMsg}</Alert>}

      {/* Active Keywords Ribbon with AI recommendation trigger */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2.5,
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc'),
          border: '1px solid',
          borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
        }}
      >
        <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.primary', display: 'flex', alignItems: 'center' }}>
                🔍 나의 맞춤 키워드:
              </Typography>
              {keywordList.map((k, idx) => (
                <Chip
                  key={idx}
                  label={`# ${k}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => handleDeleteKeyword(k)}
                  sx={{ fontWeight: 600 }}
                />
              ))}

              <Box component="form" onSubmit={handleAddKeyword} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1.5 }}>
                <TextField
                  size="small"
                  placeholder="새 키워드 입력..."
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  sx={{
                    width: 140,
                    '& .MuiInputBase-root': {
                      height: 28,
                      fontSize: '0.75rem',
                      px: 1,
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon sx={{ width: 14, height: 14 }} />}
                  sx={{
                    height: 28,
                    fontSize: '0.7rem',
                    px: 1,
                    minWidth: 48,
                  }}
                >
                  추가
                </Button>
              </Box>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={recommendingKeywords ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleRecommendKeywords}
              disabled={recommendingKeywords}
              sx={{ fontWeight: 700 }}
            >
              🤖 읽은 이력 기반 키워드 맞춤 추천
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Workspace Navigation Tabs */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'transparent' }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} indicatorColor="primary" textColor="primary">
          <Tab label={`📰 맞춤 실시간 뉴스 (${liveArticles.length})`} />
          <Tab label={`🔖 내가 스크랩한 뉴스 (${savedArticles.length})`} />
          <Tab label="🤖 Gemini AI 뉴스 심층 보고서" />
        </Tabs>
      </Paper>

      {/* TAB 0: Live Keyword News Feed split into Date Sidebar & Main Feed */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Left Date List Sidebar */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#ffffff'),
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                <CalendarTodayIcon color="primary" fontSize="small" /> 수집 일자별 분류
              </Typography>
              <Divider sx={{ mb: 1.5 }} />
              <List component="nav" disablePadding>
                <ListItemButton
                  selected={selectedDate === 'all'}
                  onClick={() => setSelectedDate('all')}
                  sx={{ borderRadius: 1.5, mb: 0.5 }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: selectedDate === 'all' ? 800 : 500, color: 'text.primary' }}>
                        전체 보기
                      </Typography>
                    }
                    secondary={`${liveArticles.length}개의 뉴스`}
                  />
                </ListItemButton>
                {uniqueDates.map((date) => {
                  const count = liveArticles.filter((art) => (art.publishedAt || todayStr) === date).length;
                  return (
                    <ListItemButton
                      key={date}
                      selected={selectedDate === date}
                      onClick={() => setSelectedDate(date)}
                      sx={{ borderRadius: 1.5, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: selectedDate === date ? 800 : 500, color: 'text.primary' }}>
                            {date}
                          </Typography>
                        }
                        secondary={`${count}개의 뉴스`}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          </Grid>

          {/* Right Main News Grid */}
          <Grid size={{ xs: 12, md: 9 }}>
            {filteredLiveArticles.length === 0 ? (
              <Paper elevation={0} sx={{ p: 6, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 3 }}>
                <NewspaperIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  해당 날짜에 수집된 뉴스가 없습니다.
                </Typography>
              </Paper>
            ) : (
              <Grid container spacing={2.5}>
                {filteredLiveArticles.map((article, idx) => {
                  const isSaved = savedUrls.has(article.url);
                  const isRead = readUrls.has(article.url);
                  return (
                    <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                      <Card
                        elevation={2}
                        sx={{
                          borderRadius: 3,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          opacity: isRead ? 0.75 : 1,
                          transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s',
                          border: isRead ? '1px solid' : '1px solid transparent',
                          borderColor: 'divider',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
                        }}
                      >
                        <CardContent sx={{ p: 2.5, flexGrow: 1 }}>
                          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <Chip label={article.source.name || '뉴스'} size="small" color="primary" variant="outlined" />
                              <Chip
                                label={isRead ? '읽음' : '읽지 않음'}
                                size="small"
                                color={isRead ? 'default' : 'success'}
                                variant={isRead ? 'outlined' : 'filled'}
                                icon={isRead ? <CheckCircleIcon fontSize="small" /> : undefined}
                                sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700 }}
                              />
                            </Stack>
                            <Tooltip title={isSaved ? '이미 스크랩됨' : '뉴스 스크랩 저장'}>
                              <IconButton
                                color={isSaved ? 'secondary' : 'default'}
                                onClick={() => !isSaved && handleSaveArticle(article)}
                                disabled={isSaved}
                                size="small"
                              >
                                {isSaved ? <BookmarkAddedIcon /> : <BookmarkIcon />}
                              </IconButton>
                            </Tooltip>
                          </Stack>

                          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.4, color: isRead ? 'text.secondary' : 'text.primary' }}>
                            {article.title}
                          </Typography>
                        </CardContent>

                        <CardActions sx={{ px: 2.5, pb: 2, pt: 0, justifyContent: 'space-between' }}>
                          <Button
                            size="small"
                            startIcon={<OpenInNewIcon fontSize="small" />}
                            component="a"
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleMarkAsRead(article)}
                          >
                            기사 읽기
                          </Button>
                          <Button
                            size="small"
                            variant={isSaved ? 'outlined' : 'contained'}
                            color={isSaved ? 'secondary' : 'primary'}
                            startIcon={<BookmarkIcon fontSize="small" />}
                            onClick={() => !isSaved && handleSaveArticle(article)}
                            disabled={isSaved}
                          >
                            {isSaved ? '스크랩됨' : '스크랩'}
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Grid>
        </Grid>
      )}

      {/* TAB 1: Saved Articles */}
      {activeTab === 1 && (
        <Grid container spacing={2.5}>
          {savedArticles.length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <Paper elevation={0} sx={{ p: 5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 3 }}>
                <BookmarkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="h6" color="text.secondary">
                  스크랩한 뉴스가 없습니다.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                  실시간 뉴스 탭에서 관심 있는 뉴스를 **[스크랩]** 버튼을 눌러 저장해보세요.
                </Typography>
                <Button variant="contained" onClick={() => setActiveTab(0)}>
                  실시간 뉴스 보러가기
                </Button>
              </Paper>
            </Grid>
          ) : (
            savedArticles.map((article) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={article.id}>
                <Card elevation={2} sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ p: 2.5, flexGrow: 1 }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Chip label={article.source || '스크랩 뉴스'} size="small" color="secondary" />
                      <IconButton size="small" color="error" onClick={() => handleRemoveSavedArticle(article.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>

                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.4 }}>
                      {article.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      스크랩 일시: {new Date(article.createdAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>

                  <CardActions sx={{ px: 2.5, pb: 2, pt: 0, justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNewIcon fontSize="small" />}
                      component="a"
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      기사 이동
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* TAB 2: Gemini AI Analysis Report */}
      {activeTab === 2 && (
        <Paper elevation={2} sx={{ p: 3.5, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon color="secondary" /> Gemini AI 뉴스 심층 분석 및 연관 시장 정보 탐색 보고서
            </Typography>
            <Button
              variant="contained"
              startIcon={analyzingAi ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleRunAiAnalysis}
              disabled={analyzingAi}
              sx={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
            >
              분석 재실행
            </Button>
          </Box>

          {!aiReport ? (
            <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
              <AutoAwesomeIcon sx={{ fontSize: 48, color: '#8b5cf6', mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                스크랩된 뉴스를 기반으로 Gemini AI 종합 분석을 실행해보세요!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                상단 **[Gemini AI 뉴스 심층 분석]** 버튼을 누르면 스크랩된 기사들의 시장 트렌드, 비즈니스 인사이트 및 추가 연관 리서치 주제를 자동 탐색해 줍니다.
              </Typography>
              <Button variant="contained" color="secondary" onClick={handleRunAiAnalysis}>
                지금 분석 실행
              </Button>
            </Box>
          ) : (
            <Paper elevation={0} sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid #ddd6fe' }}>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'inherit',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  m: 0,
                }}
              >
                {aiReport}
              </Typography>
            </Paper>
          )}
        </Paper>
      )}
    </Container>
  );
}
