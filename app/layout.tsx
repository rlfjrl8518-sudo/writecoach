import type { Metadata } from 'next';
import { Gowun_Batang } from 'next/font/google';
import './globals.css';
import './ink.css';
import Navigation from '@/components/Navigation';
import PixelCharacter from '@/components/PixelCharacter';
import CloudSync from '@/components/CloudSync';
import ClientLayout from '@/components/ClientLayout';
import ConfirmDialogRoot from '@/components/ConfirmDialog';
import GameLayer from '@/components/game/GameLayer';
import ScenePlayer from '@/components/game/ScenePlayer';

const batang = Gowun_Batang({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-batang', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: '백지첩 — 산마루 서재의 글쓰기 수련',
  description: '노작가 묵당의 서재에서 하루 한 수씩, 매일 쓰는 글쓰기 수련',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={batang.variable} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ece3d0" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="백지첩" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* 다크 모드 플리커 방지: 첫 렌더 전에 data-theme 세팅 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('theme'),p=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',(s==='dark')?'dark':'light');})();` }} />
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
