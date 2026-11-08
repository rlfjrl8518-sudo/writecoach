/* 배경 그림의 종이 여백(테두리)을 잘라 내고 16:9(또는 원래 비율)로 다시 저장한다.
   node scripts/art/reprocess.mjs [접두어...] */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ASSETS, WIDTH } from './manifest.mjs';
import { trimBorder, bgWebp } from './lib.mjs';

const pre = process.argv.slice(2);
for (const a of ASSETS.filter(a => a.kind === 'bg' && (!pre.length || pre.some(p => a.id.startsWith(p))))) {
  const src = `art-src/${a.id}.png`;
  if (!existsSync(src)) continue;
  writeFileSync(`public/art/${a.id}.webp`, await bgWebp(readFileSync(src), a.ratio, WIDTH.bg));
  console.log('✓', a.id);
}
