'use client';

import React, { useState, Suspense } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  CircularProgress,
  Stack,
  Chip,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryError = searchParams.get('error');

  let displayError = error;
  if (!displayError && queryError) {
    if (queryError === 'invalid_client') {
      displayError = 'Google OAuth 설정(Vercel 환경변수 또는 구글 콘솔) 동기화가 진행 중입니다. 아래 [⚡ 관리자 계정 1-Click 입력]을 눌러 즉시 로그인하실 수 있습니다.';
    } else {
      displayError = `로그인 처리 결과: ${queryError}`;
    }
  }

  const handleFillAdmin = () => {
    setEmail('admin');
    setPassword('Jeff1732!');
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      
      setToken(data.token);
      router.push('/dashboard');

    } catch (err) {
      setError('로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
      console.error(err);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5" sx={{ fontWeight: 800 }}>
          MostlyOn Sign In
        </Typography>

        <Box sx={{ width: '100%', mt: 3 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            href="/api/auth/google/initiate"
            sx={{
              py: 1.2,
              borderColor: '#4285F4',
              color: '#4285F4',
              fontWeight: 700,
              '&:hover': {
                borderColor: '#3367D6',
                backgroundColor: 'rgba(66, 133, 244, 0.04)',
              },
            }}
          >
            Google 계정으로 로그인 (1-Click SSO)
          </Button>

          <Divider sx={{ my: 2 }}>또는 이메일 / 관리자 로그인</Divider>

          <Box component="form" onSubmit={handleSubmit}>
            {displayError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {displayError}
              </Alert>
            )}

            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <Chip
                icon={<AdminPanelSettingsIcon style={{ fontSize: 16 }} />}
                label="⚡ 관리자 계정(admin) 1-Click 자동 입력"
                onClick={handleFillAdmin}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ cursor: 'pointer', fontWeight: 700 }}
              />
            </Stack>
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="이메일 또는 관리자 ID (admin)"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="비밀번호"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.2, fontWeight: 700 }}
            >
              로그인
            </Button>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    }>
      <LoginFormContent />
    </Suspense>
  );
}
