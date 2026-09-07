import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense, type ReactNode } from 'react';
import './globals.css';
import { MobileNavigation } from '@/components/mobile-navigation';
import { AppProvider } from '@/components/providers/app-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'eagle.',
  description: 'AVE-style encrypted market dashboard clone built with Next.js',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en' className={inter.variable}>
      <body>
        <AppProvider>
          {children}
          <Suspense fallback={null}>
            <MobileNavigation />
          </Suspense>
        </AppProvider>
      </body>
    </html>
  );
}
