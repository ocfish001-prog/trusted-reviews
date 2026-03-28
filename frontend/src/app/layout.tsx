import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/layout/Navbar';
import MobileNav from '@/components/layout/MobileNav';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Trusted Reviews',
  description: 'Reviews from people you actually know.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TrustedReviews',
  },
  openGraph: {
    title: 'Trusted Reviews',
    description: 'Reviews from people you actually know.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-slate-50 text-slate-900 antialiased font-sans">
        <Navbar />
        <main className="min-h-screen pb-20 sm:pb-8">{children}</main>
        <MobileNav />
      </body>
    </html>
  );
}
