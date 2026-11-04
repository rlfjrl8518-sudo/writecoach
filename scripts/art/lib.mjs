/* 그림 생성 공용 — Vertex gemini-2.5-flash-image + sharp
   - gen(prompt, ratio, refs[]) → PNG Buffer (refs가 있으면 그 그림을 참고해 같은 인물/장소로 편집)
   - cutout(png) → 테두리에서 이어진 흰 배경을 투명하게 (인물·요괴·소품용)
*/
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

const ai = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT || 'write-coach', location: process.env.ART_LOCATION || 'global' });
const MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';

export async function gen(prompt, ratio = '16:9', refs = []) {
  const parts = [...refs.map(b => ({ inlineData: { mimeType: 'image/png', data: b.toString('base64') } })), { text: prompt }];
  let lastErr;
  for (let i = 0; i < 8; i++) {
    try {
      const r = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ratio } },
      });
      const p = r.candidates?.[0]?.content?.parts?.find(x => x.inlineData?.data);
      if (p) return Buffer.from(p.inlineData.data, 'base64');
      lastErr = new Error('EMPTY ' + (r.candidates?.[0]?.finishReason ?? ''));
    } catch (e) { lastErr = e; }
    const quota = /429|RESOURCE_EXHAUSTED/.test(String(lastErr?.message ?? ''));
    await new Promise(res => setTimeout(res, (quota ? 15000 : 3000) * (i + 1)));
  }
  throw lastErr;
}

/** 흰 배경 제거: 네 변에서 시작해 배경색과 가까운 픽셀을 투명하게 채운다(flood fill). 경계는 부드럽게. */
export async function cutout(png, tol = 34, soft = 26) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  // 배경색 = 네 귀퉁이 8×8 평균
  let r = 0, g = 0, b = 0, n = 0;
  for (const [cx, cy] of [[0, 0], [W - 8, 0], [0, H - 8], [W - 8, H - 8]])
    for (let y = cy; y < cy + 8; y++) for (let x = cx; x < cx + 8; x++) { const i = (y * W + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  r /= n; g /= n; b /= n;
  const dist = i => Math.sqrt((data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2);
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    const d = dist(p * 4);
    if (d > tol + soft) continue;
    seen[p] = 1;
    // 완전 배경 → 0, 경계 근처 → 부분 투명
    data[p * 4 + 3] = d <= tol ? 0 : Math.round(255 * (d - tol) / soft);
    if (d > tol) continue; // 경계 픽셀에서는 더 번지지 않는다
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W);
  }
  // 투명 영역 쪽으로 남은 밝은 테두리(헤일로) 한 겹 줄이기
  const out = Buffer.from(data);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x;
    if (data[p * 4 + 3] !== 255) continue;
    const nb = [p - 1, p + 1, p - W, p + W].some(q => data[q * 4 + 3] === 0);
    if (nb && dist(p * 4) < tol * 2.2) out[p * 4 + 3] = 140;
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
}

export async function toWebp(buf, width, alpha = false) {
  return sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: alpha ? 82 : 80, alphaQuality: 90, effort: 5 }).toBuffer();
}

export async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

/** 배경: 종이 여백(테두리) 제거 → 원래 비율로 맞춰 webp */
export async function trimBorder(png) {
  const img = sharp(png);
  const { width: W, height: H } = await img.metadata();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const corner = px(4, 4);
  const near = (c) => Math.hypot(c[0] - corner[0], c[1] - corner[1], c[2] - corner[2]) < 26;
  // 한 줄(행/열)의 85% 이상이 모서리 색이면 여백으로 본다
  const rowIsBorder = y => { let n = 0; for (let x = 0; x < W; x += 4) if (near(px(x, y))) n++; return n / (W / 4) > 0.85; };
  const colIsBorder = x => { let n = 0; for (let y = 0; y < H; y += 4) if (near(px(x, y))) n++; return n / (H / 4) > 0.85; };
  let t = 0, b = H - 1, l = 0, r = W - 1;
  while (t < H * 0.12 && rowIsBorder(t)) t++;
  while (b > H * 0.88 && rowIsBorder(b)) b--;
  while (l < W * 0.12 && colIsBorder(l)) l++;
  while (r > W * 0.88 && colIsBorder(r)) r--;
  const pad = (t || l || b < H - 1 || r < W - 1) ? 6 : 0; // 테두리 선까지 살짝 더
  return { png: await sharp(png).extract({ left: l + pad, top: t + pad, width: r - l + 1 - pad * 2, height: b - t + 1 - pad * 2 }).png().toBuffer(), cut: [t, b, l, r, W, H] };
}


export async function bgWebp(png, ratio = '16:9', width = 1600) {
  const { png: cut } = await trimBorder(png);
  const [a, b] = ratio.split(':').map(Number);
  const r = a / b;
  const w = Math.round(r < 1 ? width * 0.6 : width);
  return sharp(cut).resize({ width: w, height: Math.round(w / r), fit: 'cover', position: 'centre' }).webp({ quality: 80, effort: 5 }).toBuffer();
}
