'use client';
import { useEffect, useState } from 'react';

/* ═══════════════════════════════════════════════════════════
   turtle.sheet.png 그리드 좌표
   7열(레벨: 1/10/20/35/50/70/100) × 7행(대표컷/기본/기쁨/고민/피곤/실패/의욕)
   1행(대표컷)은 사용하지 않음 — 기본 행부터 사용

   시트(1606×979px) 실제 픽셀을 스캔해 라벨 텍스트를 제외한
   각 열/행 콘텐츠의 시작 좌표·크기를 읽어 넣은 값이다(균등분할이
   아니라 실측값 — 열/행마다 그림 크기가 달라 균등분할로는
   칸이 어긋난다). 칸이 어긋나 보이면 아래 COL_LEFT/COL_W,
   ROW_TOP/ROW_H 표나 COL_OFFSET_X / ROW_OFFSET_Y 배열의
   px 값을 조정하면 된다.
═══════════════════════════════════════════════════════════ */
const SHEET_URL = '/turtle.sheet.png';
const SHEET_W = 1606;
const SHEET_H = 979;

/** 열(레벨) 순서: Lv.1, 10, 20, 35, 50, 70, 100 */
const COL_LEFT = [171, 341, 544, 741, 941, 1140, 1356];
const COL_W    = [131, 148, 150, 166, 173, 187, 188];

/** 행(감정) 순서: 기본, 기쁨, 고민, 피곤, 실패, 의욕 (대표컷 행 제외) */
const ROW_TOP = [251, 368, 478, 594, 708, 821];
const ROW_H   = [106, 96, 105, 98, 95, 130];

/** 열(레벨)별 미세 보정 px — 순서: Lv.1, 10, 20, 35, 50, 70, 100 */
const COL_OFFSET_X: number[] = [0, 0, 0, 0, 0, 0, 0];
/** 행(감정)별 미세 보정 px — 순서: 기본, 기쁨, 고민, 피곤, 실패, 의욕 */
const ROW_OFFSET_Y: number[] = [0, 0, 0, 0, 0, 0];

export type TurtleLevel = 1 | 10 | 20 | 35 | 50 | 70 | 100;
export type TurtleEmotion = 'default' | 'happy' | 'thinking' | 'tired' | 'fail' | 'motivated';

const LEVEL_COL: Record<TurtleLevel, number> = { 1: 0, 10: 1, 20: 2, 35: 3, 50: 4, 70: 5, 100: 6 };
const EMOTION_ROW: Record<TurtleEmotion, number> = {
  default: 0, happy: 1, thinking: 2, tired: 3, fail: 4, motivated: 5,
};

export const TURTLE_FALLBACK_EMOJI: Record<TurtleEmotion, string> = {
  default: '🐢', happy: '🐢✨', thinking: '🐢💭', tired: '🐢💧', fail: '🐢💦', motivated: '🐢🔥',
};

/* 시트 로드 성공/실패를 앱 전체에서 한 번만 확인해 공유 */
let sheetStatus: 'unknown' | 'ok' | 'error' = 'unknown';
let sheetPromise: Promise<'ok' | 'error'> | null = null;
function checkSheet(): Promise<'ok' | 'error'> {
  if (sheetStatus !== 'unknown') return Promise.resolve(sheetStatus);
  if (!sheetPromise) {
    sheetPromise = new Promise(resolve => {
      const img = new window.Image();
      img.onload = () => { sheetStatus = 'ok'; resolve('ok'); };
      img.onerror = () => { sheetStatus = 'error'; resolve('error'); };
      img.src = SHEET_URL;
    });
  }
  return sheetPromise;
}

interface Props {
  level: TurtleLevel;
  emotion?: TurtleEmotion;
  /** 표시 너비(px). 높이는 해당 칸의 실제 비율에 맞춰 자동 계산된다. */
  size?: number;
  grayscale?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function TurtleSprite({ level, emotion = 'default', size = 96, grayscale = false, className, style }: Props) {
  const [failed, setFailed] = useState(sheetStatus === 'error');

  useEffect(() => {
    let alive = true;
    checkSheet().then(status => { if (alive) setFailed(status === 'error'); });
    return () => { alive = false; };
  }, []);

  const filter = grayscale ? 'grayscale(1) opacity(0.35)' : undefined;

  if (failed) {
    return (
      <span
        className={className}
        role="img"
        aria-label={`${emotion} turtle`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, fontSize: size * 0.5, lineHeight: 1,
          filter, ...style,
        }}
      >
        {TURTLE_FALLBACK_EMOJI[emotion]}
      </span>
    );
  }

  const col = LEVEL_COL[level] ?? 0;
  const row = EMOTION_ROW[emotion] ?? 0;

  const cellLeft = COL_LEFT[col] + (COL_OFFSET_X[col] ?? 0);
  const cellW = COL_W[col];
  const cellTop = ROW_TOP[row] + (ROW_OFFSET_Y[row] ?? 0);
  const cellH = ROW_H[row];

  const scale = size / cellW;
  const width = size;
  const height = cellH * scale;
  const bgW = SHEET_W * scale;
  const bgH = SHEET_H * scale;
  const posX = cellLeft * scale;
  const posY = cellTop * scale;

  return (
    <div
      className={className}
      role="img"
      aria-label={`${emotion} turtle`}
      style={{
        width, height,
        backgroundImage: `url(${SHEET_URL})`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `-${posX}px -${posY}px`,
        backgroundRepeat: 'no-repeat',
        flexShrink: 0,
        filter,
        ...style,
      }}
    />
  );
}
