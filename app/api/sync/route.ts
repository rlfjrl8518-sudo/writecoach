import { NextRequest } from 'next/server';
import { syncEnabled, userFrom, readUserDb, writeUserDb, ConflictError } from '@/lib/syncStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024;
const noStore = { 'Cache-Control': 'no-store' };

/** GET — 내 DB와 rev. 동기화를 쓸 수 없으면 503/401 (클라이언트는 다른 방식으로 대체) */
export async function GET(req: NextRequest) {
  if (!syncEnabled()) return Response.json({ error: 'SYNC_OFF' }, { status: 503, headers: noStore });
  const user = userFrom(req.headers);
  if (!user) return Response.json({ error: 'NO_USER' }, { status: 401, headers: noStore });
  try {
    const { data, rev } = await readUserDb(user);
    return Response.json({ data, rev, user }, { headers: noStore });
  } catch (e) {
    console.error('[sync] read', e);
    return Response.json({ error: 'READ_FAILED' }, { status: 502, headers: noStore });
  }
}

/** PUT {data, baseRev} — baseRev가 지금 판일 때만 저장. 아니면 409와 최신 판을 돌려준다. */
export async function PUT(req: NextRequest) {
  if (!syncEnabled()) return Response.json({ error: 'SYNC_OFF' }, { status: 503, headers: noStore });
  const user = userFrom(req.headers);
  if (!user) return Response.json({ error: 'NO_USER' }, { status: 401, headers: noStore });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: 'TOO_LARGE' }, { status: 413, headers: noStore });
  let body: { data?: unknown; baseRev?: string };
  try { body = JSON.parse(raw); } catch { return Response.json({ error: 'BAD_JSON' }, { status: 400, headers: noStore }); }
  if (!body.data || typeof body.data !== 'object' || !Array.isArray((body.data as { writings?: unknown }).writings)) {
    return Response.json({ error: 'BAD_DATA' }, { status: 400, headers: noStore });
  }
  try {
    const rev = await writeUserDb(user, body.data, String(body.baseRev ?? '0'));
    return Response.json({ rev }, { headers: noStore });
  } catch (e) {
    if (e instanceof ConflictError) {
      const cur = await readUserDb(user);
      return Response.json({ error: 'CONFLICT', data: cur.data, rev: cur.rev }, { status: 409, headers: noStore });
    }
    console.error('[sync] write', e);
    return Response.json({ error: 'WRITE_FAILED' }, { status: 502, headers: noStore });
  }
}
