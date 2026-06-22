import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

interface SearchSense { definition?: string; pos?: string; target_code?: number | string; }
interface SearchItem { word?: string; sense?: SearchSense | SearchSense[]; }
interface SearchResponse {
  channel?: { total?: number | string; item?: SearchItem | SearchItem[] };
  error?: { error_code?: string; message?: string };
}

interface ViewExample { example?: string; source?: string; }
interface ViewRelation { word?: string; type?: string }
interface ViewSenseInfo {
  definition?: string; pos?: string;
  example_info?: ViewExample | ViewExample[];
  relation_info?: ViewRelation | ViewRelation[];
}
interface ViewResponse {
  channel?: { item?: { senseInfo?: ViewSenseInfo } };
  error?: { error_code?: string; message?: string };
}

const asArray = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const stripMarkup = (s: string) => s.replace(/[{}]/g, '');
const stripHomographNo = (s: string) => s.replace(/\d+$/, ''); // 우리말샘 동형어 번호("사과001") 제거

// 우리말샘은 에러 시 req_type=json이어도 XML로 응답하는 경우가 있어 직접 파싱
function extractXmlError(xml: string): string | null {
  const code = xml.match(/<error_code>\s*([^<]+)\s*<\/error_code>/)?.[1];
  const msg = xml.match(/<message>\s*([^<]+)\s*<\/message>/)?.[1];
  return code || msg ? `우리말샘 API 오류 (${code ?? '?'}): ${(msg ?? '알 수 없는 오류').trim()}` : null;
}

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch(url);
  const text = await res.text();
  const xmlError = extractXmlError(text);
  if (xmlError) return { ok: false, error: xmlError };
  try { return { ok: true, data: JSON.parse(text) as T }; }
  catch { return { ok: false, error: '우리말샘 응답을 해석하지 못했어요.' }; }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return Response.json({ ok: false, error: '검색어가 없어요.' }, { status: 400 });

  const apiKey = process.env.KORDIC_API_KEY;
  if (!apiKey) return Response.json({ ok: false, error: '우리말샘 API 키가 설정되지 않았어요.' });

  // 1단계: 검색 — 표현(어휘)의 뜻·품사·target_code를 얻는다
  const searchParams = new URLSearchParams({ key: apiKey, q, req_type: 'json', num: '10' });
  const searchRes = await fetchJson<SearchResponse>(`https://opendict.korean.go.kr/api/search?${searchParams}`);
  if (!searchRes.ok) return Response.json({ ok: false, error: searchRes.error });
  if (searchRes.data.error) {
    return Response.json({ ok: false, error: `우리말샘 API 오류 (${searchRes.data.error.error_code}): ${searchRes.data.error.message}` });
  }

  const firstItem = asArray(searchRes.data.channel?.item)[0];
  const firstSense = asArray(firstItem?.sense)[0];
  if (!firstItem || !firstSense?.target_code) {
    return Response.json({ ok: false, error: '검색 결과가 없어요.' });
  }

  const result = {
    meaning: firstSense.definition ?? '',
    pos: firstSense.pos ?? '',
    examples: [] as string[],
    synonyms: [] as string[],
    related: [] as string[],
  };

  // 2단계: 상세 조회 — 예문·유의어·관련어를 얻는다 (실패해도 1단계 결과는 반환)
  const viewParams = new URLSearchParams({ key: apiKey, q: String(firstSense.target_code), method: 'target_code', req_type: 'json' });
  const viewRes = await fetchJson<ViewResponse>(`https://opendict.korean.go.kr/api/view?${viewParams}`);
  if (viewRes.ok && !viewRes.data.error) {
    const senseInfo = viewRes.data.channel?.item?.senseInfo;
    result.examples = asArray(senseInfo?.example_info).map(e => e.example).filter((s): s is string => !!s).map(stripMarkup);
    const relations = asArray(senseInfo?.relation_info);
    result.synonyms = relations.filter(r => (r.type ?? '').includes('비슷')).map(r => r.word).filter((s): s is string => !!s).map(stripHomographNo);
    result.related  = relations.filter(r => !(r.type ?? '').includes('비슷')).map(r => r.word).filter((s): s is string => !!s).map(stripHomographNo);
  }

  return Response.json({ ok: true, data: result });
}
