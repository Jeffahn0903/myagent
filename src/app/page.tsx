'use client';

import React from 'react';
import { Container, Typography, Box, Button } from '@mui/material';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          my: 4,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          minHeight: '60vh',
        }}
      >
        <Typography variant="h2" component="h1" gutterBottom>
          Welcome to MostlyOn
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Your personal service for sales, management, and business correspondence.
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Streamline your customer information, schedules, and tasks all in one place. 
          Connect your external services and let your agent handle the rest.
        </Typography>
        <Box sx={{ mt: 4 }}>
          {user ? (
            <Link href="/dashboard" passHref>
              <Button variant="contained" size="large">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login" passHref>
              <Button variant="contained" size="large">
                Login to Get Started
              </Button>
            </Link>
          )}
        </Box>
      </Box>
    </Container>
  );
}
