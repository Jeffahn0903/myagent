import type { Metadata } from 'next';
import './globals.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ThemeRegistry from '@/components/ThemeRegistry';
import { AuthProvider } from '@/contexts/AuthContext';
import MainLayout from '@/components/MainLayout';

export const metadata: Metadata = {
  title: 'MostlyOn | AI 스마트 워크스페이스',
  description: 'MostlyOn - AI 기반 비즈니스, 회의실, 예산 및 자금 현금흐름 통합 관리 서비스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ThemeRegistry>
            <MainLayout>{children}</MainLayout>
          </ThemeRegistry>
        </AuthProvider>
      </body>
    </html>
  );
}
