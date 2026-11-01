import { getImage } from '@/lib/imageGen';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const buf = await getImage(params.key).catch(() => null);
  if (!buf) return new Response('not found', { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
