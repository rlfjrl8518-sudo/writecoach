import { NextRequest } from 'next/server';
import { ensureImage, imageEnabled } from '@/lib/imageGen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST {su, variant} → {url} — 그 수의 사진 훈련용 이미지를 (없으면 생성해) 돌려준다 */
export async function POST(req: NextRequest) {
  if (!imageEnabled()) return Response.json({ error: 'IMAGE_OFF' }, { status: 503 });
  let body: { su?: number; variant?: number };
  try { body = await req.json(); } catch { return Response.json({ error: 'BAD_JSON' }, { status: 400 }); }
  const su = Number(body.su), variant = Math.max(0, Math.min(999, Number(body.variant) || 0));
  if (!Number.isInteger(su) || su < 1 || su > 24) return Response.json({ error: 'BAD_SU' }, { status: 400 });
  try {
    const key = await ensureImage(su, variant);
    return Response.json({ url: `/api/image/${key}` });
  } catch (e) {
    console.error('[image]', e);
    const msg = String((e as Error).message || e);
    return Response.json({ error: msg.includes('NO_IMAGE') ? 'NO_IMAGE_FOR_SU' : 'GENERATE_FAILED' }, { status: msg.includes('NO_IMAGE') ? 400 : 502 });
  }
}
