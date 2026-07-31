'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Container, Box, CircularProgress, Typography } from '@mui/material';

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setToken } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const token = searchParams.get('token');
    if (token) {
      processedRef.current = true;
      // Synchronously write to localStorage first before navigating!
      try {
        localStorage.setItem('authToken', token);
      } catch (e) {}
      setToken(token);
      router.push('/dashboard');
    } else {
      processedRef.current = true;
      router.push('/login?error=invalid_token');
    }
  }, [searchParams, setToken, router]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <CircularProgress />
      <Typography variant="h6" sx={{ mt: 2 }}>
        Sign In 성공! 대시보드로 이동 중...
      </Typography>
    </Box>
  );
}

export default function AuthCallbackPage() {
  return (
    <Container maxWidth="sm">
      <Suspense fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      }>
        <CallbackHandler />
      </Suspense>
    </Container>
  );
}
