'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Art, portraitSrc, useLook, fallbackTo } from '@/components/art/Art';
import { seasonOf, timeOf, type Season } from '@/lib/story';
import type { Emotion } from '@/lib/curriculum';

/* ═══════════════════════════════════════════════════════════════
   살아 있는 서재 — 실제 계절·시간대의 서재 그림 위에
   창밖 안개(쉰 날만큼 짙어짐) · 등불(오늘 썼으면 켜짐) · 계절 입자 ·
   묵당과 제자 · 기억이 열릴 때마다 놓이는 물건 · 드나드는 고양이.
   모든 위치는 16:9 그림 기준 %. 휴대폰에선 그림을 높이에 맞춰 가운데를 보여 준다.
═══════════════════════════════════════════════════════════════ */

/** 물건 자리 — [x 중심 %, 바닥 y %, 너비 %] (서재 그림의 책상·의자·바닥 위치에 맞춤) */
const SLOTS: Record<string, [number, number, number]> = {
  inkstone: [44.5, 71, 5],
  teacup: [57, 71, 3.4],
  persimmon: [66, 71.5, 4.4],
  radio: [17.5, 70, 6.2],
  plum: [23, 70, 3],
  brushes: [87.5, 70, 2.8],
  scroll: [32.5, 50, 3.6],
  windbell: [50, 13, 2.8],
  letters: [34, 95, 6],
  bookstack: [9, 97, 7],
  plant: [76, 92, 5.4],
  lantern: [92, 93, 5.4],
};
const WINDOW: [number, number, number, number] = [32, 7, 69, 64]; // 창(문) 영역 x1,y1,x2,y2 %

const PARTICLE: Record<Season, { n: number; color: string; size: [number, number]; round: boolean; dur: [number, number] } | null> = {
  spring: { n: 14, color: '#f4c6cf', size: [5, 9], round: false, dur: [9, 15] },
  summer: null,
  autumn: { n: 10, color: '#c8642e', size: [7, 11], round: false, dur: [10, 16] },
  winter: { n: 26, color: '#ffffff', size: [3, 6], round: true, dur: [8, 14] },
};
const r = (i: number, s: number) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

export default function LivingStudy({ fog, lampLit, objects = [], cat, mukEmotion = 'default', meEmotion = 'default', onMuk, onCat, children, now }: {
  fog: number; lampLit: boolean; objects?: string[]; cat?: 'sit' | 'sleep' | null;
  mukEmotion?: Emotion; meEmotion?: Emotion; onMuk?: () => void; onCat?: () => void; children?: ReactNode; now?: Date;
}) {
  const look = useLook();
  const [t, setT] = useState(() => now ?? new Date());
  useEffect(() => { if (now) return; const id = setInterval(() => setT(new Date()), 60_000); return () => clearInterval(id); }, [now]);
  const season = seasonOf(t);
  const time = timeOf(t);
  const bg = `study_${season}_${time}`;
  const p = PARTICLE[season];
  const parts = useMemo(() => (p ? Array.from({ length: p.n }, (_, i) => ({
    left: r(i, 1) * 100, delay: -r(i, 2) * p.dur[1], dur: p.dur[0] + r(i, 3) * (p.dur[1] - p.dur[0]),
    size: p.size[0] + r(i, 4) * (p.size[1] - p.size[0]), dx: (r(i, 5) - 0.3) * 60, rot: r(i, 6) * 540,
  })) : []), [p]);
  const fireflies = season === 'summer' && time !== 'day';
  const [wx1, wy1, wx2, wy2] = WINDOW;

  return (
    <div className="g-stage study-stage">
      <div className="study-inner">
        <Art id={bg} className="stage-img" />
        {/* 창밖: 계절 입자 · 반딧불 · 안개 */}
        <div style={{ position: 'absolute', left: `${wx1}%`, top: `${wy1}%`, width: `${wx2 - wx1}%`, height: `${wy2 - wy1}%`, overflow: 'hidden', pointerEvents: 'none' }}>
          {p && parts.map((q, i) => (
            <i key={i} className="particle" style={{ left: `${q.left}%`, width: q.size, height: p.round ? q.size : q.size * 0.62, background: p.color, borderRadius: p.round ? '50%' : '60% 0 60% 0', opacity: 0.85, animation: `fall ${q.dur}s linear ${q.delay}s infinite`, ['--dx' as string]: `${q.dx}px`, ['--rot' as string]: `${q.rot}deg` }} />
          ))}
          {fireflies && Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ position: 'absolute', left: `${r(i, 7) * 100}%`, top: `${40 + r(i, 8) * 55}%`, width: 4, height: 4, borderRadius: '50%', background: '#f6f0a0', boxShadow: '0 0 8px 3px rgba(246,240,160,0.6)', animation: `float-soft ${3 + r(i, 9) * 3}s ease-in-out ${-r(i, 10) * 4}s infinite, ink-pulse ${2 + r(i, 11) * 2}s ease-in-out infinite` }} />
          ))}
          <div className="fog-layer" style={{ opacity: Math.min(1, fog * 1.1) }} />
        </div>
        {/* 쉰 날이 길면 서재 전체에 옅은 백지 기운 */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(248,246,238,1)', opacity: fog * 0.22, pointerEvents: 'none', transition: 'opacity 1.5s ease' }} />
        {/* 밤인데 등불이 꺼져 있으면 어둡게 */}
        {!lampLit && time !== 'day' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,30,0.38)', pointerEvents: 'none' }} />}
        {lampLit && <div className="lamp-glow" style={{ left: '74%', top: '42%', width: '18%', aspectRatio: '1' }} />}

        {/* 물건 */}
        {objects.filter(o => SLOTS[o]).map(o => {
          const [x, y, w] = SLOTS[o];
          return <Art key={o} id={`obj_${o}`} className="study-obj anim-in" style={{ left: `${x}%`, bottom: `${100 - y}%`, width: `${w}%` }} />;
        })}

        {/* 인물 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitSrc('muk', mukEmotion)} onError={fallbackTo(portraitSrc('muk'))} alt="묵당 선생" onClick={onMuk} draggable={false}
          className="study-actor muk anim-bob" style={{ cursor: onMuk ? 'pointer' : undefined }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitSrc('me', meEmotion, look)} onError={fallbackTo(portraitSrc('me', 'default', look))} alt="" draggable={false}
          className="study-actor me anim-bob" style={{ animationDelay: '-2s', pointerEvents: 'none' }} />

        {cat && (
          <button onClick={onCat} className="study-cat" aria-label="고양이 먹물" style={{ left: cat === 'sleep' ? '71%' : '72%' }}>
            <Art id={cat === 'sleep' ? 'obj_cat_sleep' : 'obj_cat'} style={{ width: '100%' }} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
