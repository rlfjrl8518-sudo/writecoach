import { NextRequest } from 'next/server';
import { syncEnabled, userFrom } from '@/lib/syncStore';
import { readPrefs, updatePrefs, endpointId } from '@/lib/pushStore';
import type { PushSubscription as WebPushSubscription } from 'web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };
const err = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

function who(req: NextRequest) {
  if (!syncEnabled()) return { res: err('SYNC_OFF', 503) };
  const user = userFrom(req.headers);
  if (!user) return { res: err('NO_USER', 401) };
  return { user };
}

const view = (p: { enabled: boolean; hour: number; subs: WebPushSubscription[]; lastSentDay: string }) => ({
  enabled: p.enabled,
  hour: p.hour,
  devices: p.subs.length,
  ids: p.subs.map(s => endpointId(s.endpoint)), // 이 기기가 등록돼 있는지 확인용 (endpoint 자체는 내려주지 않음)
  lastSentDay: p.lastSentDay,
});

function validSub(s: unknown): s is WebPushSubscription {
  const o = s as WebPushSubscription;
  return !!o && typeof o.endpoint === 'string' && /^https:\/\//.test(o.endpoint) && o.endpoint.length < 2048
    && !!o.keys && typeof o.keys.p256dh === 'string' && typeof o.keys.auth === 'string';
}

/** GET — 지금 설정 */
export async function GET(req: NextRequest) {
  const w = who(req);
  if (w.res) return w.res;
  try {
    return Response.json(view(await readPrefs(w.user)), { headers: noStore });
  } catch (e) {
    console.error('[push] read', e);
    return err('READ_FAILED', 502);
  }
}

/** POST {subscription?, hour?, enabled?} — 구독 추가/갱신, 시각·켜기 설정 */
export async function POST(req: NextRequest) {
  const w = who(req);
  if (w.res) return w.res;
  let body: { subscription?: unknown; hour?: unknown; enabled?: unknown };
  try { body = await req.json(); } catch { return err('BAD_JSON', 400); }
  if (body.subscription !== undefined && !validSub(body.subscription)) return err('BAD_SUBSCRIPTION', 400);
  const hour = body.hour === undefined ? undefined : Number(body.hour);
  if (hour !== undefined && !(Number.isInteger(hour) && hour >= 0 && hour <= 23)) return err('BAD_HOUR', 400);
  try {
    const p = await updatePrefs(w.user, (p) => {
      if (body.subscription) {
        const s = body.subscription as WebPushSubscription;
        const clean: WebPushSubscription = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
        p.subs = [...p.subs.filter(x => x.endpoint !== clean.endpoint), clean];
      }
      if (hour !== undefined) p.hour = hour;
      if (typeof body.enabled === 'boolean') p.enabled = body.enabled;
      return p;
    });
    return Response.json(view(p), { headers: noStore });
  } catch (e) {
    console.error('[push] write', e);
    return err('WRITE_FAILED', 502);
  }
}

/** DELETE {endpoint} — 이 기기 구독 해제. 남은 기기가 없으면 알림도 끈다. */
export async function DELETE(req: NextRequest) {
  const w = who(req);
  if (w.res) return w.res;
  let body: { endpoint?: unknown };
  try { body = await req.json(); } catch { return err('BAD_JSON', 400); }
  if (typeof body.endpoint !== 'string') return err('BAD_ENDPOINT', 400);
  try {
    const p = await updatePrefs(w.user, (p) => {
      p.subs = p.subs.filter(s => s.endpoint !== body.endpoint);
      if (!p.subs.length) p.enabled = false;
      return p;
    });
    return Response.json(view(p), { headers: noStore });
  } catch (e) {
    console.error('[push] delete', e);
    return err('WRITE_FAILED', 502);
  }
}
