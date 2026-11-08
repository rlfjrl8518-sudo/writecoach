import { NextRequest } from 'next/server';
import { syncEnabled, userFrom } from '@/lib/syncStore';
import { readPrefs, updatePrefs } from '@/lib/pushStore';
import { pushConfigured, sendToSubs } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/** POST — 내 기기들에 시험 알림 한 통 */
export async function POST(req: NextRequest) {
  if (!pushConfigured()) return Response.json({ error: 'PUSH_OFF' }, { status: 503, headers: noStore });
  if (!syncEnabled()) return Response.json({ error: 'SYNC_OFF' }, { status: 503, headers: noStore });
  const user = userFrom(req.headers);
  if (!user) return Response.json({ error: 'NO_USER' }, { status: 401, headers: noStore });
  try {
    const prefs = await readPrefs(user);
    if (!prefs.subs.length) return Response.json({ error: 'NO_SUBS' }, { status: 404, headers: noStore });
    const r = await sendToSubs(prefs.subs, {
      title: '산마루 서재',
      body: '묵당이다. 이 종이 울리면 붓을 들게. 시험 삼아 한 번 울려 보았지.',
      url: '/practice',
      tag: 'writecoach-test',
    });
    if (r.gone.length) {
      const gone = new Set(r.gone);
      await updatePrefs(user, p => ({ ...p, subs: p.subs.filter(s => !gone.has(s.endpoint)) }));
    }
    return Response.json({ sent: r.sent, removed: r.gone.length, failed: r.errors.length }, { headers: noStore });
  } catch (e) {
    console.error('[push] test', e);
    return Response.json({ error: 'SEND_FAILED' }, { status: 502, headers: noStore });
  }
}
