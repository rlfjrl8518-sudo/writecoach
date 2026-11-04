import 'server-only';
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';

/* Web Push 발송 (VAPID). 비공개 키는 Secret Manager(vapid-private-key) → VAPID_PRIVATE_KEY */
export const VAPID_SUBJECT = 'mailto:rlfjrl8518@gmail.com';
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? '';
export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function init() {
  if (ready) return;
  webpush.setVapidDetails(VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

/** 구독 목록에 보낸다. 404/410(만료·해지)은 gone 으로 돌려줘 호출 쪽이 지운다. */
export async function sendToSubs(subs: WebPushSubscription[], payload: PushPayload) {
  init();
  const body = JSON.stringify({ url: '/practice', ...payload });
  let sent = 0;
  const gone: string[] = [];
  const errors: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s, body, { TTL: 60 * 60 * 6, urgency: 'normal' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
      else errors.push(String(code ?? (e as Error).message));
    }
  }));
  return { sent, gone, errors };
}
