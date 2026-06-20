import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';
import PixelCharacter from '@/components/PixelCharacter';
import CloudSync from '@/components/CloudSync';
import ClientLayout from '@/components/ClientLayout';

export const metadata: Metadata = {
  title: '글습관 — AI 글쓰기 훈련',
  description: 'AI 글쓰기 훈련 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#3182F6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="글습관" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* 다크 모드 플리커 방지: 첫 렌더 전에 data-theme 세팅 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('theme'),p=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',(s==='dark'||(s===null&&p))?'dark':'light');})();` }} />
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
        <ClientLayout>
          <Navigation />
          <main className="main-layout">
            {children}
          </main>
          <PixelCharacter />
        </ClientLayout>
      </body>
    </html>
  );
}
