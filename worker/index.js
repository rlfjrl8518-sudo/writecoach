/* eslint-disable no-restricted-globals */
// next-pwa customWorkerDir — 빌드 시 public/worker-<id>.js 로 묶여 sw.js 에서 importScripts 된다.
// 묵당 선생의 '오늘 아직 안 썼네' 알림 (scripts/push-cron.mjs 가 보냄)

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || '산마루 서재';
  const options = {
    body: data.body || '자네, 오늘 한 줄은 썼는가.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'writecoach-daily',
    renotify: true,
    data: { url: data.url || '/practice' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/practice', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(target) : w)).catch(() => self.clients.openWindow(target));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
