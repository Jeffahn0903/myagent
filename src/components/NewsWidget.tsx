'use client';

import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Link,
  Divider,
  IconButton,
  Tooltip,
  Stack,
  Chip,
} from '@mui/material';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Article {
  title: string;
  description: string;
  url: string;
  source: {
    name: string;
  };
}

export default function NewsWidget() {
  const { token } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const [newsRes, savedRes] = await Promise.all([
          fetch('/api/news', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          token ? fetch('/api/news/saved', { headers: { Authorization: `Bearer ${token}` } }) : null,
        ]);

        if (!newsRes.ok) throw new Error('뉴스를 불러오지 못했습니다.');
        const data = await newsRes.json();
        setArticles(data);

        if (savedRes && savedRes.ok) {
          const savedData = await savedRes.json();
          if (Array.isArray(savedData)) {
            setSavedUrls(new Set(savedData.map((s: any) => s.url)));
          }
        }
      } catch (err) {
        setError('뉴스 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, [token]);

  const handleBookmark = async (article: Article) => {
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
      if (res.ok) {
        setSavedUrls((prev) => new Set([...prev, article.url]));
      }
    } catch (e) {}
  };

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <NewspaperIcon color="primary" /> 📰 실시간 맞춤 뉴스
        </Typography>
        <IconButton size="small" color="primary" onClick={() => router.push('/dashboard/news')}>
          <Tooltip title="뉴스 인사이트 보러가기">
            <ArrowForwardIcon fontSize="small" />
          </Tooltip>
        </IconButton>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {error && <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>{error}</Alert>}

      {articles.length > 0 && (
        <List disablePadding sx={{ maxHeight: 380, overflowY: 'auto' }}>
          {articles.slice(0, 6).map((article, index) => {
            const isSaved = savedUrls.has(article.url);
            return (
              <React.Fragment key={index}>
                {index > 0 && <Divider component="li" />}
                <ListItem
                  alignItems="flex-start"
                  sx={{ py: 1.2, px: 0.5 }}
                  secondaryAction={
                    token ? (
                      <Tooltip title={isSaved ? '스크랩됨' : '뉴스 스크랩 저장'}>
                        <IconButton
                          edge="end"
                          size="small"
                          color={isSaved ? 'secondary' : 'default'}
                          onClick={() => !isSaved && handleBookmark(article)}
                          disabled={isSaved}
                        >
                          {isSaved ? <BookmarkAddedIcon fontSize="small" /> : <BookmarkIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    ) : null
                  }
                >
                  <ListItemText
                    primary={
                      <Link
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.88rem', lineHeight: 1.4, pr: 2 }}
                      >
                        {article.title}
                      </Link>
                    }
                    secondary={
                      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mt: 0.5 }}>
                        출처: {article.source.name}
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
  );
}
