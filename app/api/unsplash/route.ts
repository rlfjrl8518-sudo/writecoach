import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || '';
  const orientation = searchParams.get('orientation') || 'landscape';

  // /photos/random?query=X는 매칭되는 사진 전체에서 균등 무작위라 관련성이 낮은 것도 자주 걸린다.
  // /search/photos는 관련성 순으로 정렬해주므로, 상위 N개 중에서만 고르면 주제 적합도가 크게 올라간다.
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=${orientation}&content_filter=high&per_page=15`,
    { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  );

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
