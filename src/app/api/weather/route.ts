import { NextResponse } from 'next/server';

const getWeatherDescription = (code: number): string => {
  if (code === 0) return '맑음';
  if (code === 1 || code === 2) return '구름 조금';
  if (code === 3) return '흐림';
  if (code >= 45 && code <= 48) return '안개';
  if (code >= 51 && code <= 57) return '이슬비';
  if (code >= 61 && code <= 67) return '비';
  if (code >= 71 && code <= 77) return '눈';
  if (code >= 80 && code <= 82) return '소나기';
  if (code >= 95 && code <= 99) return '뇌우';
  return '맑음';
};

const getWeatherIconEmoji = (code: number): string => {
  if (code === 0 || code === 1) return '☀️';
  if (code === 2 || code === 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code >= 95 && code <= 99) return '⚡';
  return '☀️';
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat') || '37.5665';
  const lon = searchParams.get('lon') || '126.9780';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo fetch failed');
    const data = await res.json();
    const current = data.current_weather;

    // Parse 7-day daily forecast
    const weeklyForecast = (data.daily?.time || []).slice(0, 7).map((dateStr: string, idx: number) => {
      const d = new Date(dateStr);
      const dayName = d.toLocaleDateString('ko-KR', { weekday: 'short' });
      const code = data.daily?.weathercode?.[idx] ?? 0;
      const maxTemp = Math.round(data.daily?.temperature_2m_max?.[idx] ?? 25);
      const minTemp = Math.round(data.daily?.temperature_2m_min?.[idx] ?? 18);

      return {
        date: dateStr,
        dayName: idx === 0 ? '오늘' : idx === 1 ? '내일' : dayName,
        maxTemp,
        minTemp,
        code,
        icon: getWeatherIconEmoji(code),
        description: getWeatherDescription(code),
      };
    });

    return NextResponse.json({
      temp: current.temperature,
      feels_like: current.temperature,
      description: getWeatherDescription(current.weathercode),
      icon: 'https://openweathermap.org/img/wn/02d@2x.png',
      city: '내 위치 주변',
      weeklyForecast,
    });
  } catch (error) {
    console.error('Error fetching weather:', error);
    // Fallback weekly forecast data if offline
    const today = new Date();
    const fallbackWeekly = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(today.getTime() + idx * 86400000);
      const dayName = d.toLocaleDateString('ko-KR', { weekday: 'short' });
      return {
        date: d.toISOString().split('T')[0],
        dayName: idx === 0 ? '오늘' : idx === 1 ? '내일' : dayName,
        maxTemp: 26 + (idx % 3),
        minTemp: 20 + (idx % 2),
        code: 1,
        icon: '☀️',
        description: '맑음',
      };
    });

    return NextResponse.json({
      temp: 24,
      feels_like: 24,
      description: '맑음',
      icon: 'https://openweathermap.org/img/wn/01d@2x.png',
      city: '내 위치 주변',
      weeklyForecast: fallbackWeekly,
    });
  }
}
