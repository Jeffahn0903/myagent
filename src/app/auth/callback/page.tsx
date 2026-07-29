'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Container, Box, CircularProgress, Typography } from '@mui/material';

function CallbackHandler() {
  const searchParams = useSearchParams();
  const { setToken } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const token = searchParams.get('token');
    if (token) {
      processedRef.current = true;
      setToken(token);
      window.location.href = '/dashboard';
    } else {
      processedRef.current = true;
      window.location.href = '/login?error=invalid_token';
    }
  }, [searchParams, setToken]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <CircularProgress />
      <Typography variant="h6" sx={{ mt: 2 }}>
        Signing you in with Google...
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
