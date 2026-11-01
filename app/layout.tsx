import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './pixel.css';
import Navigation from '@/components/Navigation';
import PixelCharacter from '@/components/PixelCharacter';
import CloudSync from '@/components/CloudSync';
import ClientLayout from '@/components/ClientLayout';
import ConfirmDialogRoot from '@/components/ConfirmDialog';
import GameLayer from '@/components/game/GameLayer';
import ScenePlayer from '@/components/game/ScenePlayer';

const galmuri11 = localFont({ src: '../node_modules/galmuri/dist/Galmuri11.woff2', variable: '--font-galmuri11', display: 'swap' });
const galmuri14 = localFont({ src: '../node_modules/galmuri/dist/Galmuri14.woff2', variable: '--font-galmuri14', display: 'swap' });

export const metadata: Metadata = {
  title: '글습관 — 산마루 서재',
  description: '노작가의 서재에서 매일 쓰는 픽셀 글쓰기 수련 RPG',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${galmuri11.variable} ${galmuri14.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#101018" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="글습관" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* 다크 모드 플리커 방지: 첫 렌더 전에 data-theme 세팅 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('theme'),p=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',(s==='light')?'light':'dark');})();` }} />
        {/* Pretendard: dynamic-subset (한국어 필요 글리프만 로드) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <CloudSync />
        <ConfirmDialogRoot />
        <ClientLayout>
          <Navigation />
          <main className="main-layout">
            {children}
          </main>
          <PixelCharacter />
          <GameLayer />
          <ScenePlayer />
        </ClientLayout>
      </body>
    </html>
  );
}
