import type { Metadata } from 'next';
import './globals.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ThemeRegistry from '@/components/ThemeRegistry';
import { AuthProvider } from '@/contexts/AuthContext';
import MainLayout from '@/components/MainLayout';

export const metadata: Metadata = {
  title: 'MyAgent',
  description: 'Sales & Business Management Service',
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
