/* ═══════════════════════════════════════════════════════════════
   픽셀 스프라이트 데이터 — 16×16 격자
   - 인물: 얼굴 틀 + 머리·모자·안경·수염·옷깃을 코드로 조합한다.
   - 요괴: 손으로 그린 틀 6종(도깨비·안개·뱀·유령·새·실타래)을 색만 바꿔 쓴다.
   격자 문자 → 색은 palette로 매핑, '.'은 투명.
═══════════════════════════════════════════════════════════════ */
import type { SpeakerId } from '@/lib/story';

export type Grid = string[];
export type Palette = Record<string, string>;
export interface SpriteDef { grid: Grid; palette: Palette }

export type Emotion = 'default' | 'happy' | 'sad' | 'angry' | 'think';

const N = 16;
function blank(): string[][] { return Array.from({ length: N }, () => Array(N).fill('.')); }
function rect(g: string[][], x0: number, y0: number, x1: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < N && x >= 0 && x < N) g[y][x] = c;
}
function dot(g: string[][], pts: [number, number][], c: string) { pts.forEach(([x, y]) => { if (y >= 0 && y < N && x >= 0 && x < N) g[y][x] = c; }); }

/* ── 인물 ── */
type Hair = 'short' | 'cap' | 'gat' | 'bun' | 'slick' | 'wavy' | 'sides' | 'topknot';
type Glasses = 'round' | 'pince' | null;
type Beard = 'full' | 'goatee' | 'mustache' | 'trim' | null;
type Collar = 'dopo' | 'suit' | 'uniform' | 'sweater' | 'dress' | 'hanbok';

export interface PersonSpec {
  skin: string; hair: string; hairStyle: Hair; glasses?: Glasses; beard?: Beard; beardColor?: string;
  clothes: string; collar: Collar; accent?: string;
}

export function person(p: PersonSpec, emotion: Emotion = 'default'): SpriteDef {
  const g = blank();
  // 몸통
  rect(g, 2, 12, 13, 15, 'C');
  rect(g, 6, 11, 9, 11, 'S'); // 목
  // 얼굴
  rect(g, 4, 4, 11, 10, 'S');
  dot(g, [[3, 6], [3, 7], [12, 6], [12, 7]], 'S');
  dot(g, [[4, 10], [11, 10]], '.');
  rect(g, 5, 11, 10, 11, 'S');
  dot(g, [[5, 11], [10, 11]], '.');
  // 눈·입·눈썹
  dot(g, [[6, 7], [9, 7]], 'E');
  if (emotion === 'happy') { dot(g, [[6, 9], [9, 9]], 'M'); rect(g, 7, 10, 8, 10, 'M'); }
  else if (emotion === 'sad') { rect(g, 7, 9, 8, 9, 'M'); dot(g, [[6, 10], [9, 10]], 'M'); dot(g, [[5, 6], [10, 6]], 'H'); }
  else if (emotion === 'angry') { rect(g, 6, 9, 9, 9, 'M'); dot(g, [[5, 5], [6, 6], [10, 5], [9, 6]], 'H'); }
  else if (emotion === 'think') { dot(g, [[8, 9], [9, 9]], 'M'); dot(g, [[6, 6], [9, 6]], 'H'); }
  else rect(g, 7, 9, 8, 9, 'M');

  // 머리 / 모자
  switch (p.hairStyle) {
    case 'short': rect(g, 4, 2, 11, 3, 'H'); dot(g, [[3, 3], [3, 4], [3, 5], [12, 3], [12, 4], [12, 5]], 'H'); rect(g, 4, 4, 7, 4, 'H'); break;
    case 'topknot': rect(g, 4, 2, 11, 3, 'H'); rect(g, 7, 0, 8, 1, 'H'); dot(g, [[3, 3], [3, 4], [12, 3], [12, 4]], 'H'); rect(g, 4, 4, 11, 4, 'A'); break;
    case 'slick': rect(g, 4, 2, 11, 3, 'H'); dot(g, [[3, 3], [3, 4], [12, 3], [12, 4], [11, 4], [10, 4]], 'H'); break;
    case 'wavy': rect(g, 4, 2, 11, 3, 'H'); dot(g, [[3, 3], [3, 4], [3, 5], [12, 3], [12, 4], [12, 5], [5, 1], [8, 1], [10, 1]], 'H'); break;
    case 'sides': dot(g, [[3, 4], [3, 5], [3, 6], [4, 4], [12, 4], [12, 5], [12, 6], [11, 4], [6, 3], [7, 3], [9, 3]], 'H'); break;
    case 'bun': rect(g, 4, 2, 11, 3, 'H'); rect(g, 6, 0, 9, 1, 'H'); rect(g, 3, 3, 3, 9, 'H'); rect(g, 12, 3, 12, 9, 'H'); dot(g, [[4, 4], [11, 4], [5, 4]], 'H'); break;
    case 'cap': rect(g, 4, 1, 11, 3, 'K'); rect(g, 3, 4, 12, 4, 'K'); dot(g, [[7, 2], [8, 2]], 'A'); dot(g, [[3, 5], [12, 5]], 'H'); break;
    case 'gat': rect(g, 5, 0, 10, 2, 'K'); rect(g, 1, 3, 14, 3, 'K'); rect(g, 4, 4, 11, 4, 'H'); dot(g, [[3, 9], [12, 9], [3, 10], [12, 10]], 'K'); break;
  }
  // 안경
  if (p.glasses === 'round') {
    rect(g, 5, 6, 7, 6, 'G'); rect(g, 8, 6, 10, 6, 'G'); rect(g, 5, 8, 7, 8, 'G'); rect(g, 8, 8, 10, 8, 'G');
    dot(g, [[5, 7], [7, 7], [8, 7], [10, 7]], 'G');
  } else if (p.glasses === 'pince') {
    dot(g, [[5, 7], [7, 7], [8, 7], [10, 7], [5, 6], [6, 6], [9, 6], [10, 6]], 'G');
  }
  // 수염
  const bc = 'B';
  if (p.beard === 'full') { dot(g, [[4, 8], [11, 8], [4, 9], [5, 9], [10, 9], [11, 9]], bc); rect(g, 4, 10, 11, 10, bc); rect(g, 5, 11, 10, 12, bc); rect(g, 6, 9, 9, 9, bc); rect(g, 7, 10, 8, 10, 'M'); }
  else if (p.beard === 'trim') { dot(g, [[4, 9], [11, 9]], bc); rect(g, 4, 10, 11, 10, bc); rect(g, 5, 11, 10, 11, bc); rect(g, 6, 8, 9, 8, bc); }
  else if (p.beard === 'goatee') { rect(g, 7, 10, 8, 11, bc); rect(g, 6, 8, 9, 8, bc); }
  else if (p.beard === 'mustache') { rect(g, 6, 8, 9, 8, bc); }

  // 옷깃
  switch (p.collar) {
    case 'dopo': case 'hanbok':
      dot(g, [[5, 12], [6, 13], [7, 14], [8, 15], [10, 12], [9, 13]], 'W');
      if (p.collar === 'dopo') rect(g, 2, 15, 13, 15, 'A');
      break;
    case 'suit': rect(g, 7, 12, 8, 13, 'W'); rect(g, 7, 14, 8, 15, 'A'); dot(g, [[6, 12], [9, 12]], 'W'); break;
    case 'uniform': rect(g, 6, 12, 9, 12, 'C'); dot(g, [[7, 13], [7, 15]], 'A'); rect(g, 5, 12, 5, 12, 'W'); rect(g, 10, 12, 10, 12, 'W'); break;
    case 'sweater': rect(g, 5, 12, 10, 12, 'A'); dot(g, [[4, 14], [7, 14], [10, 14], [13, 14]], 'A'); break;
    case 'dress': rect(g, 5, 12, 10, 12, 'W'); dot(g, [[7, 13], [8, 13]], 'W'); break;
  }
  return {
    grid: g.map(r => r.join('')),
    palette: {
      S: p.skin, H: p.hair, E: '#101018', M: '#7a3030', C: p.clothes, W: '#f2ecd8',
      A: p.accent ?? '#f7e26b', K: '#1a1a22', G: '#c8c8d8', B: p.beardColor ?? p.hair,
    },
  };
}

const SKIN = '#f1c9a0', SKIN2 = '#e8b98d', PALE = '#f5d7c0';

export const PEOPLE: Partial<Record<SpeakerId, PersonSpec>> = {
  muk: { skin: SKIN2, hair: '#e8e8e8', hairStyle: 'sides', glasses: 'round', beard: 'goatee', beardColor: '#e8e8e8', clothes: '#2a2f4a', collar: 'dopo', accent: '#c8961e' },
  yoon: { skin: SKIN, hair: '#1a1a22', hairStyle: 'cap', clothes: '#1c1c2a', collar: 'uniform', accent: '#f7e26b' },
  chekhov: { skin: PALE, hair: '#5a3a24', hairStyle: 'wavy', glasses: 'pince', beard: 'trim', clothes: '#3b3b4e', collar: 'suit', accent: '#5a2a2a' },
  hemingway: { skin: '#e3a57a', hair: '#d8d0c0', hairStyle: 'short', beard: 'full', beardColor: '#e8e2d4', clothes: '#c9b28a', collar: 'sweater', accent: '#a8946c' },
  woolf: { skin: PALE, hair: '#6b4a32', hairStyle: 'bun', clothes: '#4a3a5a', collar: 'dress' },
  yeonam: { skin: SKIN2, hair: '#2a2a2a', hairStyle: 'gat', beard: 'full', beardColor: '#3a3a3a', clothes: '#e8e2d0', collar: 'hanbok', accent: '#8a2a2a' },
  kimyujeong: { skin: SKIN, hair: '#1a1a22', hairStyle: 'short', clothes: '#d8cfb8', collar: 'hanbok' },
  orwell: { skin: PALE, hair: '#3a2a1a', hairStyle: 'slick', beard: 'mustache', clothes: '#4a5248', collar: 'suit', accent: '#2a2a2a' },
  yisang: { skin: PALE, hair: '#101018', hairStyle: 'slick', beard: 'mustache', clothes: '#2a2a3a', collar: 'suit', accent: '#9b2d3a' },
};

/** 제자(플레이어) — 등급에 따라 도포 색이 바뀐다 */
export function apprentice(robe: string, accent: string, emotion: Emotion = 'default'): SpriteDef {
  return person({ skin: SKIN, hair: '#2a1e18', hairStyle: 'topknot', clothes: robe, collar: 'dopo', accent }, emotion);
}

/* ── 요괴 틀 ── */
const GOBLIN: Grid = [
  '................',
  '..K..........K..',
  '..KK........KK..',
  '...KGGGGGGGGK...',
  '...GGGGGGGGGG...',
  '..GGGGGGGGGGGG..',
  '..GGWWGGGGWWGG..',
  '..GGWEGGGGWEGG..',
  '..GGGGGGGGGGGG..',
  '..GGMMMMMMMMGG..',
  '..GGMWMWMWMMGG..',
  '...GGMMMMMMGG...',
  '....GGGGGGGG....',
  '...GGGGGGGGGG...',
  '..GG.GG..GG.GG..',
  '.KK..KK..KK..KK.',
];
const CLOUD: Grid = [
  '................',
  '................',
  '.....GGGG.......',
  '...GGGGGGGG.GG..',
  '..GGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGG.',
  '.GGGWWGGGGWWGGG.',
  '.GGGWEGGGGWEGGG.',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGMMMMGGGGGG',
  '.GGGGGGGGGGGGGG.',
  '..GGGGGGGGGGGG..',
  '...GG.GGGG.GG...',
  '..G....GG....G..',
  '................',
  '................',
];
const SNAKE: Grid = [
  '................',
  '.........GGGG...',
  '........GGGGGG..',
  '........GWEGWE..',
  '........GGGGGGM.',
  '.........GGGG..M',
  '..........GG....',
  '...KGKGK..GG....',
  '..GGGGGGGGGG....',
  '.GG.....GGGG....',
  '.GG.............',
  '.GKGKGKGKGKGG...',
  '..GGGGGGGGGGGG..',
  '............GG..',
  '..GKGKGKGKGKGG..',
  '.GGGGGGGGGGGG...',
];
const GHOST: Grid = [
  '.....GGGGGG.....',
  '...GGGGGGGGGG...',
  '..GGGGGGGGGGGG..',
  '..GKKKKKKKKKKG..',
  '.GGGEEGGGGEEGGG.',
  '.GGGEEGGGGEEGGG.',
  '.GGGGGGGGGGGGGG.',
  '.GKKKKMMMMKKKKG.',
  '.GGGGGMMMMGGGGG.',
  '.GKKKKKKKKKKKKG.',
  '.GGGGGGGGGGGGGG.',
  '.GKKKKKKKKKKKKG.',
  '.GGGGGGGGGGGGGG.',
  '.GG.GGG..GGG.GG.',
  '.G...GG..GG...G.',
  '................',
];
const KING: Grid = [
  '...Y..Y..Y..Y...',
  '...YYYYYYYYYY...',
  '..GGGGGGGGGGGG..',
  '..GKKKKKKKKKKG..',
  '.GGGEEGGGGEEGGG.',
  '.GGGEEGGGGEEGGG.',
  '.GGGGGGGGGGGGGG.',
  '.GKKKKMMMMKKKKG.',
  '.GGGGGMMMMGGGGG.',
  'GGKKKKKKKKKKKKGG',
  'GGGGGGGGGGGGGGGG',
  'GGKKKKKKKKKKKKGG',
  'GGGGGGGGGGGGGGGG',
  'GGG.GGGGGGGG.GGG',
  '.G..GGG..GGG..G.',
  '................',
];
const BIRD: Grid = [
  '................',
  '......GGGG......',
  '.....GGGGGG.....',
  '....GGWEGGGG....',
  '....GGGGGGGYY...',
  '....GGGGGGGYYY..',
  '...GGGGGGGGYY...',
  '...GGGGGGGG.....',
  '..KGGGGGGGGG....',
  '..KKGGGGGGGGG...',
  '..KKKGGGGGGGG...',
  '...KKGGGGGGG....',
  '.....GGGGGG.....',
  '......Y..Y......',
  '.....YY..YY.....',
  '................',
];
const KNOT: Grid = [
  '................',
  '...GG....GG.....',
  '..G..G..G..G....',
  '..G...GG...G....',
  '...G..GG..G.....',
  '....GGGGGG......',
  '...GGWEGWEGG....',
  '..G.GGGGGGG.G...',
  '.G..GGMMMGG..G..',
  '.G...GGGGG...G..',
  '..G..G...G..G...',
  '...GG.....GG....',
  '....G.....G.....',
  '...GG.....GG....',
  '..G.........G...',
  '................',
];

interface MonsterSpec { grid: Grid; body: string; dark?: string }
const MON: Record<string, MonsterSpec> = {
  naeili: { grid: GOBLIN, body: '#5aa36a', dark: '#2a4a2a' },
  durumung: { grid: CLOUD, body: '#b8b8c8' },
  neureoji: { grid: SNAKE, body: '#8a6abf', dark: '#4a3a7a' },
  baekjigwi: { grid: GHOST, body: '#f2f0e6', dark: '#b8c0d8' },
  ppeonhan: { grid: BIRD, body: '#e86a6a', dark: '#8a2a3a' },
  heurisi: { grid: CLOUD, body: '#8fa8b8' },
  eotbagi: { grid: KNOT, body: '#d8a040' },
  baekjiwang: { grid: KING, body: '#f2f0e6', dark: '#9aa8c8' },
  // 주간 요괴
  mitmit: { grid: BIRD, body: '#a8a890', dark: '#6a6a58' },
  ungeol: { grid: CLOUD, body: '#9a8ab8' },
  mungsil: { grid: CLOUD, body: '#c8b8a0' },
  galpang: { grid: KNOT, body: '#7ab8a8' },
  ppaek: { grid: SNAKE, body: '#b86a8a', dark: '#6a3a4a' },
};

export function monster(id: string): SpriteDef {
  const m = MON[id] ?? MON.durumung;
  return {
    grid: m.grid,
    palette: { G: m.body, K: m.dark ?? '#3a3a4a', W: '#ffffff', E: '#101018', M: '#3a1018', Y: '#f7e26b' },
  };
}

export function speakerSprite(id: SpeakerId, emotion: Emotion = 'default', robe?: { robe: string; color: string }): SpriteDef | null {
  if (id === 'narr') return null;
  if (id === 'me') return apprentice(robe?.robe ?? '#5a5a8a', robe?.color ?? '#8f8fb8', emotion);
  const p = PEOPLE[id];
  if (p) return person(p, emotion);
  return monster(id);
}
