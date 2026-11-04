import { vapidPublicKey } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — 브라우저 구독에 쓸 VAPID 공개 키 */
export async function GET() {
  const publicKey = vapidPublicKey();
  if (!publicKey) return Response.json({ error: 'PUSH_OFF' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return Response.json({ publicKey }, { headers: { 'Cache-Control': 'no-store' } });
}
