'use client';

import * as React from 'react';
import { CustomThemeProvider } from '@/contexts/ThemeContext';

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return <CustomThemeProvider>{children}</CustomThemeProvider>;
}
