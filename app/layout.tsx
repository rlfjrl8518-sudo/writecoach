import type { Metadata } from 'next';
import { Press_Start_2P, Noto_Serif_KR } from 'next/font/google';
import './globals.css';
import Navigation from '@/components/Navigation';
import PixelCharacter from '@/components/PixelCharacter';

/* next/font: 폰트를 빌드 타임에 셀프 호스팅 → CDN 왕복 없음 */
const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixel',
});

const serifFont = Noto_Serif_KR({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  preload: false,
});

export const metadata: Metadata = {
  title: 'WriteCoach — 별헤는 밤',
  description: 'AI 글쓰기 훈련 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pixelFont.variable} ${serifFont.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0d0d1a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="WriteCoach" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Pretendard: dynamic-subset (한국어 필요 글리프만 로드) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Navigation />
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 120px' }}>
          {children}
        </main>
        <PixelCharacter />
      </body>
    </html>
  );
}
