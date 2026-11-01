'use client';
import type { ReactNode } from 'react';
import { Speaker } from '@/components/pixel/Pixel';
import type { SpeakerId } from '@/lib/curriculum';

/* 산마루 서재 내부 — 창(밤하늘·안개), 책장, 책상, 등불. 일러스트라 테마와 무관하게 고정 색. */
const BOOK_COLORS = ['#a3203a', '#1f6fa8', '#3e8e41', '#c8961e', '#6b4a8a', '#8a5a3a', '#2a6a6a', '#b0562a'];

function hash(n: number) { return Math.abs(Math.sin(n * 9301 + 49297) * 233280) % 1; }

export default function StudyScene({ fog, lampLit, guest, robe, children, height = 220 }: {
  fog: number; lampLit: boolean; guest?: SpeakerId | null; robe: { robe: string; color: string }; children?: ReactNode; height?: number;
}) {
  const books = Array.from({ length: 3 }, (_, row) => Array.from({ length: 9 }, (_, i) => ({
    c: BOOK_COLORS[Math.floor(hash(row * 20 + i) * BOOK_COLORS.length)],
    h: 18 + Math.floor(hash(row * 7 + i * 3) * 8),
  })));
  return (
    <div className="g-stage" style={{ height, background: '#1b1626', boxShadow: '0 0 0 4px var(--card-border)', margin: 4 }}>
      {/* 벽 무늬 */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, #211a2e 0 24px, #1b1626 24px 48px)' }} />
      {/* 창 */}
      <div style={{ position: 'absolute', left: '6%', top: 20, width: 120, height: 96, background: '#0c1030', boxShadow: '0 0 0 6px #4a3424, inset 0 0 0 2px #2a1e14', overflow: 'hidden' }}>
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ position: 'absolute', left: `${hash(i) * 100}%`, top: `${hash(i + 50) * 80}%`, width: i % 4 ? 2 : 4, height: i % 4 ? 2 : 4, background: '#f7e26b', animation: `g-twinkle ${1.2 + (i % 3) * 0.5}s steps(2) infinite` }} />
        ))}
        <i style={{ position: 'absolute', right: 14, top: 12, width: 16, height: 16, background: '#f2ecd8', boxShadow: '-4px 4px 0 0 #0c1030' }} />
        {/* 창살 */}
        <i style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 4, background: '#4a3424' }} />
        <i style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: '#4a3424' }} />
        {/* 백지 안개 */}
        <div style={{ position: 'absolute', inset: -10, opacity: fog, transition: 'opacity 400ms steps(4)', animation: 'g-fog 6s steps(6) infinite alternate' }}>
          {[0, 1, 2, 3].map(i => <i key={i} style={{ position: 'absolute', left: i * 34 - 10, top: 30 + (i % 2) * 22, width: 60, height: 20, background: '#e8e8f0', boxShadow: '8px -8px 0 0 #e8e8f0, 24px -4px 0 0 #e8e8f0' }} />)}
        </div>
      </div>
      {/* 책장 */}
      <div style={{ position: 'absolute', right: '4%', top: 14, width: 150, height: 150, background: '#4a3424', boxShadow: 'inset 0 0 0 4px #2a1e14' }}>
        {books.map((row, r) => (
          <div key={r} style={{ position: 'absolute', left: 8, right: 8, top: 10 + r * 46, height: 34, display: 'flex', alignItems: 'flex-end', gap: 2, borderBottom: '4px solid #2a1e14' }}>
            {row.map((b, i) => <i key={i} style={{ width: 12, height: b.h, background: b.c, boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.2)' }} />)}
          </div>
        ))}
      </div>
      {/* 바닥 */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, background: '#3a2a1c', backgroundImage: 'repeating-linear-gradient(90deg, #3a2a1c 0 40px, #33251a 40px 44px)' }} />
      {/* 책상 + 등불 */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 28, width: 170, height: 18, background: '#6b4a2e', boxShadow: 'inset 0 4px 0 #8a6a44' }} />
      <div style={{ position: 'absolute', left: 'calc(50% - 75px)', bottom: 46, width: 14, height: 18, background: lampLit ? '#f7e26b' : '#5a5a6a', boxShadow: lampLit ? '0 0 0 4px rgba(247,226,107,0.25), 0 0 0 12px rgba(247,226,107,0.08)' : 'none', animation: lampLit ? 'g-twinkle 2s steps(2) infinite' : undefined }} />
      <div style={{ position: 'absolute', left: 'calc(50% + 40px)', bottom: 46, width: 22, height: 8, background: '#1a1a22' }} />
      {/* 인물 */}
      <div style={{ position: 'absolute', left: 'calc(50% - 120px)', bottom: 28 }}><Speaker id="muk" size={80} /></div>
      <div style={{ position: 'absolute', left: 'calc(50% + 50px)', bottom: 28 }} className="anim-bob"><Speaker id="me" size={72} robe={robe} flip /></div>
      {guest && <div style={{ position: 'absolute', left: 'calc(50% - 34px)', bottom: 40 }} className="anim-in"><Speaker id={guest} size={68} /></div>}
      {children}
    </div>
  );
}
