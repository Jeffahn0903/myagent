'use client';

import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, CircularProgress, Stack, Divider } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

interface DailyForecast {
  date: string;
  dayName: string;
  maxTemp: number;
  minTemp: number;
  code: number;
  icon: string;
  description: string;
}

interface WeatherData {
  temp: number;
  feels_like: number;
  description: string;
  icon: string;
  city: string;
  weeklyForecast?: DailyForecast[];
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWeather = async (lat = 37.5665, lon = 126.978) => {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch (err) {
      console.error('Weather widget fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          loadWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          loadWeather();
        },
        { timeout: 5000 }
      );
    } else {
      loadWeather();
    }
  }, []);

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2.5,
        borderRadius: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: '#1e293b' }}>
        <WbSunnyIcon sx={{ color: '#f59e0b' }} /> 현재 & 주간 날씨
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, minHeight: 180 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {weather && (
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {/* Top Section: Current Weather */}
          <Box sx={{ text: 'center', textAlign: 'center', py: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
              <img src={weather.icon} alt={weather.description} width={48} height={48} />
              <Typography variant="h3" sx={{ fontWeight: 800, color: '#0f172a' }}>
                {Math.round(weather.temp)}°C
              </Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              체감 온도 {Math.round(weather.feels_like)}°C
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 0.5, fontWeight: 700, color: '#2563eb' }}>
              {weather.description} • {weather.city}
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* Bottom Section: 7-Day Weekly Forecast */}
          <Box sx={{ pt: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
            >
              <CalendarMonthIcon sx={{ fontSize: 14, color: '#3b82f6' }} /> 📅 7일간 주간 일기예보
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              sx={{
                justify: 'space-between',
                overflowX: 'auto',
                pb: 0.5,
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 2 },
              }}
            >
              {weather.weeklyForecast?.map((day, idx) => (
                <Paper
                  key={day.date || idx}
                  elevation={0}
                  sx={{
                    p: 0.8,
                    minWidth: 50,
                    flexGrow: 1,
                    textAlign: 'center',
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? idx === 0 ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.04)'
                        : idx === 0 ? '#eff6ff' : '#f8fafc',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? idx === 0 ? '#2563eb' : 'rgba(255,255,255,0.08)'
                        : idx === 0 ? '#93c5fd' : '#f1f5f9',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      fontWeight: 700,
                      color: (theme) =>
                        theme.palette.mode === 'dark'
                          ? idx === 0 ? '#60a5fa' : '#cbd5e1'
                          : idx === 0 ? '#1d4ed8' : '#334155',
                      fontSize: '0.7rem',
                    }}
                  >
                    {day.dayName}
                  </Typography>

                  <Typography variant="body1" sx={{ my: 0.3, fontSize: '1.1rem' }}>
                    {day.icon}
                  </Typography>

                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, fontSize: '0.65rem', color: '#64748b' }}>
                    <span style={{ color: '#ef4444' }}>{day.maxTemp}°</span> / <span style={{ color: '#3b82f6' }}>{day.minTemp}°</span>
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
