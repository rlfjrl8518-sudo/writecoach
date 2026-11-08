import 'server-only';
import { createHash } from 'crypto';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import { gemini } from './vertex';
import { IMAGE_STYLE, suOf } from './curriculum';

/* ═══════════════════════════════════════════════════════════════
   훈련용 이미지 생성 — Vertex gemini-2.5-flash-image
   - 프롬프트는 서버가 커리큘럼(lib/curriculum.ts)의 각 수 photo에서 만든다.
     (그 훈련에 필요한 요소 — 셀 수 있는 사물, 감정을 암시하는 사물, 움직임 등 — 가 반드시 보이게)
   - 같은 (수, 변형 번호)는 한 번만 생성하고 GCS에 webp로 캐시한다: images/<key>.webp
   - 이 프로젝트의 Vertex에서는 Imagen·3.x 이미지 모델이 404, 2.5-flash-image만 동작(2026-11 확인).
═══════════════════════════════════════════════════════════════ */
const MODEL = process.env.IMAGE_MODEL ?? 'gemini-2.5-flash-image';
const BUCKET = process.env.SYNC_BUCKET ?? '';
let storage: Storage | null = null;
const bucket = () => { storage ??= new Storage(); return storage.bucket(BUCKET); };

export const imageEnabled = () => !!BUCKET && !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.GEMINI_API_KEY);

// 같은 수라도 매번 다른 장면이 되도록 시간대·날씨·구도를 바꾼다
const TIMES = ['early morning', 'overcast noon', 'rainy late afternoon', 'golden hour', 'blue hour after sunset', 'late night under streetlights', 'snowy winter day', 'humid summer evening'];
const SHOTS = ['wide establishing shot', 'medium shot at eye level', 'slightly high angle', 'low angle', 'tight detail-focused framing'];

export function buildPrompt(suN: number, variant: number): string | null {
  const su = suOf(suN);
  if (!su?.photo) return null;
  const t = TIMES[variant % TIMES.length];
  const s = SHOTS[Math.floor(variant / TIMES.length + variant) % SHOTS.length];
  return `${IMAGE_STYLE}\nPurpose: a picture prompt for a Korean writing exercise on the technique "${su.title}" — the writer will write a short piece from this picture, so every detail they may need must be clearly visible.\nSubject: ${su.photo}\nVariation: ${t}, ${s}. Make every detail needed for the task clearly visible.`;
}

export function imageKey(suN: number, variant: number) {
  const p = buildPrompt(suN, variant) ?? '';
  return createHash('sha256').update(`${MODEL}|${p}`).digest('hex').slice(0, 24);
}

const objName = (key: string) => `images/${key}.webp`;

export async function getImage(key: string): Promise<Buffer | null> {
  if (!/^[a-f0-9]{24}$/.test(key)) return null;
  try { const [buf] = await bucket().file(objName(key)).download(); return buf; }
  catch (e) { if ((e as { code?: number }).code === 404) return null; throw e; }
}

const inflight = new Map<string, Promise<string>>();

/** 이미 있으면 바로, 없으면 생성해서 저장한 뒤 key를 돌려준다 */
export async function ensureImage(suN: number, variant: number): Promise<string> {
  const prompt = buildPrompt(suN, variant);
  if (!prompt) throw new Error('NO_IMAGE_FOR_SU');
  const key = imageKey(suN, variant);
  const f = bucket().file(objName(key));
  const [exists] = await f.exists();
  if (exists) return key;
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    const res = await gemini().models.generateContent({
      model: MODEL, contents: prompt,
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } as Record<string, unknown>,
    });
    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new Error('IMAGE_EMPTY');
    const webp = await sharp(Buffer.from(part.inlineData.data, 'base64')).resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await f.save(webp, { resumable: false, contentType: 'image/webp', metadata: { cacheControl: 'public, max-age=31536000, immutable', metadata: { su: String(suN), variant: String(variant) } } });
    return key;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}
