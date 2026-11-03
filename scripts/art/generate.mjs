/* 사용: node scripts/art/generate.mjs [접두어...] [--force]
   예) node scripts/art/generate.mjs muk me_a     (해당 접두어만)
   원본 PNG는 art-src/, 웹용은 public/art/<id>.webp */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ASSETS, WIDTH } from './manifest.mjs';
import { gen, cutout, toWebp, pool, bgWebp } from './lib.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const pre = args.filter(a => !a.startsWith('--'));
const want = a => !pre.length || pre.some(p => a.id === p || a.id.startsWith(p + '_') || a.id.startsWith(p));
const src = id => `art-src/${id}.png`;
const out = id => `public/art/${id}.webp`;

async function make(a) {
  if (!force && existsSync(out(a.id))) return 'skip';
  const refs = [];
  if (a.ref) refs.push(readFileSync(src(a.ref)));
  if (a.seed) refs.push(readFileSync(`art-src/seeds/${a.seed}`));
  const t = Date.now();
  const png = await gen(a.prompt, a.ratio, refs);
  writeFileSync(src(a.id), png);
  writeFileSync(out(a.id), a.kind === 'bg' ? await bgWebp(png, a.ratio, WIDTH.bg) : await toWebp(await cutout(png), WIDTH[a.kind], true));
  console.log(`✓ ${a.id} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  return 'ok';
}

const todo = ASSETS.filter(want);
// 참고 그림이 먼저 있어야 하므로 단계별로: ref 없는 것 → ref 있는 것
const stages = [todo.filter(a => !a.ref), todo.filter(a => a.ref)];
let fail = 0;
for (const s of stages) {
  await pool(s, Number(process.env.ART_CONCURRENCY || 2), async a => {
    if (a.ref && !existsSync(src(a.ref))) { console.log(`… ${a.id}: 참고 그림 ${a.ref} 없음`); fail++; return; }
    try { await make(a); } catch (e) { fail++; console.log(`✗ ${a.id}: ${e.message?.slice(0, 160)}`); }
  });
}
console.log(`끝 — 대상 ${todo.length}, 실패 ${fail}`);
