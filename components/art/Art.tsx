'use client';
/* ═══════════════════════════════════════════════════════════════
   그림 컴포넌트 — public/art/*.webp (scripts/art/generate.mjs로 생성)
   - Speaker: 인물. 작게(<120)는 얼굴 메달, 크게는 전신 스탠딩.
   - Monster: 요괴 전신.
   - Art: 배경·장면·소품.
═══════════════════════════════════════════════════════════════ */
import { useEffect, useState, type CSSProperties } from 'react';
import { loadDB } from '@/lib/db';
import { getGame } from '@/lib/game';
import { isBoss, type Emotion, type SpeakerId } from '@/lib/curriculum';

export type { Emotion };

/* 제자의 모습(a/b) — db-saved 때마다 갱신되는 작은 캐시 */
let lookCache: 'a' | 'b' | null = null;
function readLook(): 'a' | 'b' { try { return getGame(loadDB()).look ?? 'a'; } catch { return 'a'; } }
export function useLook(): 'a' | 'b' {
  const [l, setL] = useState<'a' | 'b'>(lookCache ?? 'a');
  useEffect(() => {
    const f = () => { lookCache = readLook(); setL(lookCache); };
    f();
    window.addEventListener('db-saved', f);
    return () => window.removeEventListener('db-saved', f);
  }, []);
  return l;
}

const EMO_SET: Partial<Record<SpeakerId, Emotion[]>> = {
  muk: ['happy', 'sad', 'angry', 'think'],
  me: ['happy', 'sad', 'angry', 'think'],
  seoha: ['happy', 'sad'],
};
export function portraitSrc(id: SpeakerId, emotion: Emotion = 'default', look: 'a' | 'b' = 'a') {
  if (isBoss(id)) return `/art/boss_${id}.webp`;
  const base = id === 'me' ? `me_${look}` : id;
  const e = emotion !== 'default' && EMO_SET[id]?.includes(emotion) ? `_${emotion}` : '';
  return `/art/${base}${e}.webp`;
}
/** 표정 그림이 없으면 기본 그림으로 */
export function fallbackTo(src: string) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => { const t = e.currentTarget; if (t.dataset.fb) return; t.dataset.fb = '1'; t.src = src; };
}
/** 얼굴 메달에서 얼굴이 오도록: [배경 크기 %, 세로 위치 %] */
const FACE: Partial<Record<SpeakerId, [number, number]>> = { muk: [250, 4], me: [260, 3], seoha: [260, 3] };

export function Speaker({ id, emotion, size = 64, className, style, flip, full }: {
  id: SpeakerId; emotion?: Emotion; size?: number; className?: string; style?: CSSProperties; flip?: boolean; full?: boolean;
  /** @deprecated 픽셀 시절 도포 색 — 무시 */ robe?: unknown;
}) {
  const look = useLook();
  if (id === 'narr') return null;
  if (isBoss(id)) return <Monster id={id} size={size} className={className} style={style} />;
  const src = portraitSrc(id, emotion, look);
  if (full || size >= 120) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" onError={fallbackTo(portraitSrc(id, 'default', look))} className={`art-portrait ${className ?? ''}`} draggable={false}
      style={{ height: size, width: 'auto', transform: flip ? 'scaleX(-1)' : undefined, ...style }} />;
  }
  const [bs, by] = FACE[id] ?? [250, 4];
  return (
    <span className={`art-medal ${className ?? ''}`} aria-hidden
      style={{ width: size, height: size, backgroundImage: `url(${src})`, backgroundSize: `${bs}% auto`, backgroundPosition: `50% ${by}%`, transform: flip ? 'scaleX(-1)' : undefined, ...style }} />
  );
}

export function Monster({ id, size = 96, className, style }: { id: string; size?: number; className?: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/art/boss_${id}.webp`} alt="" draggable={false} className={`art-monster ${className ?? ''}`}
    style={{ width: size, height: size, objectFit: 'contain', ...style }} />;
}

export function Art({ id, className, style, alt = '' }: { id: string; className?: string; style?: CSSProperties; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/art/${id}.webp`} alt={alt} draggable={false} className={className} decoding="async" style={style} />;
}
