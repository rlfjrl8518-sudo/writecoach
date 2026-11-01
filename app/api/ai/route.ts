import { NextRequest } from 'next/server';
import { ThinkingLevel, type GenerateContentConfig, type Part } from '@google/genai';
import { aiEnabled, gemini, DEFAULT_MODEL, ALLOWED_MODELS } from '@/lib/vertex';

/**
 * 서버측 AI 호출 — GCP Vertex AI(Gemini 3.x). 사용자 API 키가 필요 없다.
 *
 * POST JSON {
 *   system: string, user: string,
 *   maxTokens?: number, temperature?: number,
 *   json?: boolean, schema?: object, imageUrl?: string,
 *   stream?: boolean, model?: string
 * }
 * - stream=false → 200 { text }
 * - stream=true  → 200 text/plain 스트림(텍스트 델타만 이어서 전송)
 * - 에러 → { error } (400 잘못된 요청, 413 너무 큼, 429 한도, 503 AI_OFF, 502 모델 오류)
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 200_000;          // 프롬프트 최대 ~200KB
const MAX_OUTPUT_TOKENS = 8000;
/** Gemini 3.x는 답변 전에 사고(thinking) 토큰을 쓴다 — thinking을 LOW로 낮추고 여유분을 더 준다 */
const THINKING_HEADROOM = 2000;
const IMAGE_MAX_BYTES = 5_000_000;

/* ── 단순 인메모리 IP 레이트 리밋 (인스턴스 단위) ── */
const RATE_WINDOW_MS = 5 * 60_000;
const RATE_MAX = 60;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    hits.forEach((v, k) => { if (!v.some(t => now - t < RATE_WINDOW_MS)) hits.delete(k); });
  }
  return arr.length > RATE_MAX;
}

function clientIp(req: NextRequest): string {
  return req.headers.get('x-goog-authenticated-user-email')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'local';
}

const err = (status: number, error: string) => Response.json({ error }, { status });

/** OpenAI strict JSON 스키마 → Vertex responseJsonSchema 호환으로 정리 (지원 안 하는 키 제거) */
const DROP_KEYS = new Set(['strict', '$schema', 'name']);
function cleanSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (DROP_KEYS.has(k)) continue;
    // properties 안의 키는 필드명이므로 그대로 두고 값만 재귀
    if (k === 'properties' && v && typeof v === 'object') {
      out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, cleanSchema(pv)]));
    } else {
      out[k] = cleanSchema(v);
    }
  }
  return out;
}

async function imagePart(url: string): Promise<Part | null> {
  try {
    if (!/^https:\/\//i.test(url)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!mime.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > IMAGE_MAX_BYTES) return null;
    return { inlineData: { mimeType: mime, data: buf.toString('base64') } };
  } catch { return null; }
}

interface Body {
  system?: string; user?: string;
  maxTokens?: number; temperature?: number;
  json?: boolean; schema?: object; imageUrl?: string;
  stream?: boolean; model?: string;
}

export async function POST(req: NextRequest) {
  if (!aiEnabled()) return err(503, 'AI_OFF');

  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) return err(413, '요청이 너무 큽니다.');
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return err(413, '요청이 너무 큽니다.');

  if (rateLimited(clientIp(req))) return err(429, '요청이 너무 많아요. 잠시 후 다시 시도해주세요.');

  let body: Body;
  try { body = JSON.parse(raw) as Body; } catch { return err(400, '잘못된 JSON 요청입니다.'); }
  const user = typeof body.user === 'string' ? body.user : '';
  if (!user.trim()) return err(400, 'user 프롬프트가 비어 있습니다.');
  const system = typeof body.system === 'string' ? body.system : '';

  const model = body.model && ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  const maxTokens = Math.min(Math.max(Number(body.maxTokens) || 2000, 50), MAX_OUTPUT_TOKENS);
  const temperature = Math.min(Math.max(Number(body.temperature ?? 0.3), 0), 2);

  const config: GenerateContentConfig = {
    maxOutputTokens: maxTokens + THINKING_HEADROOM,
    temperature,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  };
  if (system) config.systemInstruction = system;
  if (body.schema) {
    config.responseMimeType = 'application/json';
    config.responseJsonSchema = cleanSchema(body.schema);
  } else if (body.json) {
    config.responseMimeType = 'application/json';
  }

  const parts: Part[] = [{ text: user }];
  if (typeof body.imageUrl === 'string' && body.imageUrl) {
    const img = await imagePart(body.imageUrl);
    if (img) parts.push(img);
  }
  const contents = [{ role: 'user', parts }];

  try {
    if (!body.stream) {
      const res = await gemini().models.generateContent({ model, contents, config });
      const text = res.text ?? '';
      if (!text) return err(502, `AI가 빈 응답을 반환했습니다 (${res.candidates?.[0]?.finishReason ?? 'unknown'}).`);
      return Response.json({ text });
    }

    const iter = await gemini().models.generateContentStream({ model, contents, config });
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of iter) {
            const t = chunk.text;
            if (t) controller.enqueue(enc.encode(t));
          }
          controller.close();
        } catch (e) {
          console.error('[api/ai] stream error', e);
          controller.error(e);
        }
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/ai] error', msg);
    const status = /429|RESOURCE_EXHAUSTED/i.test(msg) ? 429 : 502;
    return err(status, status === 429 ? 'AI 사용량 한도에 걸렸어요. 잠시 후 다시 시도해주세요.' : `AI 호출 실패: ${msg.slice(0, 300)}`);
  }
}
