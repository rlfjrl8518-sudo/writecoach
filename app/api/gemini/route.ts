import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const model    = searchParams.get('model')    ?? '';
  const endpoint = searchParams.get('endpoint') ?? 'generateContent';
  const key      = searchParams.get('key')      ?? '';
  const alt      = searchParams.get('alt')      ?? '';

  const altParam = alt ? `&alt=${alt}` : '';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${key}${altParam}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await req.text(),
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
