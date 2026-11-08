const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // worker/index.js — 푸시 수신(push)·알림 클릭(notificationclick) 처리. sw.js 가 importScripts 한다.
  customWorkerDir: 'worker',
  // 그림(public/art, 약 5.5MB)은 설치 때 한꺼번에 받지 않고 볼 때 캐시한다
  publicExcludes: ['!noprecache/**/*', '!art/**/*'],
  // App Router에서는 app-build-manifest.json이 운영 서버에 없어(404) 설치가 통째로 실패한다.
  // 글꼴 조각(woff2 수백 개)도 미리 받지 않고 볼 때 캐시한다(next-static 런타임 캐시).
  buildExcludes: [/app-build-manifest\.json$/, /\/media\/.*\.woff2$/],
  runtimeCaching: [
    {
      urlPattern: /\/art\/.*\.webp$/i,
      handler: 'CacheFirst',
      options: { cacheName: 'art', expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 } },
    },
    {
      urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'jsdelivr-fonts',
        expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'next-static', expiration: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 } },
    },
    {
      urlPattern: /\/_next\/image\?.*/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'next-image', expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 } },
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'google-fonts', expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 } },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloud Run(Docker) 배포용 — .next/standalone 에 최소 실행 파일만 모은다
  output: 'standalone',
  experimental: {
    // 번들에 넣지 않고 node_modules 로 추적 → standalone 이미지에 그대로 들어가
    // scripts/push-cron.mjs (Cloud Run Job) 도 같은 패키지를 쓸 수 있다
    serverComponentsExternalPackages: ['web-push', '@google-cloud/storage'],
  },
};

module.exports = withPWA(nextConfig);
