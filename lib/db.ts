export type WriteType = '에세이' | '일기' | '기획서' | '논설' | '소설' | '리뷰' | '기타';
export type CopyType = '문제제기형' | '공감형' | '반전형' | '숫자형' | 'FOMO형' | '호기심형' | '증거제시형' | '혜택강조형' | '위험환기형';
export type StructureType = '장소→대상' | '대상→상태' | '주체→행동' | '행동→결과' | '원인→결과' | '목표→행동' | '감상→설명';
export type AuthorStyle = '윤동주' | '김훈' | '무라카미 하루키' | '헤밍웨이';

export interface ScoreBreakdown {
  표현력: number; 전달력: number; 구체성: number; 문장다양성: number;
  카피라이팅적합성: number; 논리성: number; 가독성: number;
  구조다양성: number; 감각표현다양성: number;
}
export interface SenseCount { 시각: number; 청각: number; 후각: number; 미각: number; 촉각: number; }
export interface Expression { text: string; category: string; alternative: string[]; }
export interface Structure { type: StructureType; example: string; }

export interface WritingAnalysis {
  score: number;
  score_breakdown: ScoreBreakdown;
  strengths: string[];
  weaknesses: string[];
  repeated_words: string[];
  improvement_examples: string[];
  improvement_suggestions: string[];
  expressions: Expression[];
  structures: Structure[];
  senses: SenseCount;
}

export interface WritingEntry {
  id: number;
  date: string;
  type: WriteType;
  topic: string;
  text: string;
  status: '미분석' | '분석완료';
  analysis?: WritingAnalysis;
  createdAt: string;
}

export interface SentenceAnalysis {
  structure: StructureType;
  role: string;
  keyExpressions: string[];
  deliveryMethod: string;
  applicability: string;
}

export interface SentenceEntry {
  id: number;
  source: string;
  sentence: string;
  analysis?: SentenceAnalysis;
  createdAt: string;
}

export interface CopyAnalysis {
  hookStrength: number;
  type: CopyType;
  techniques: string[];
  targetAudience: string;
  improvement: string;
}

export interface CopyEntry {
  id: number;
  copy: string;
  brand: string;
  source: string;
  analysis?: CopyAnalysis;
  createdAt: string;
}

export interface RewriteLevels {
  level1: string; level2: string; level3: string; level4: string; level5: string;
}

export interface RewriteEntry {
  id: number;
  original: string;
  levels: RewriteLevels;
  variations?: string[];
  authorStyles?: Partial<Record<AuthorStyle, string>>;
  createdAt: string;
}

export interface Mission {
  id: number;
  title: string;
  description: string;
  type: 'writing' | 'expression' | 'structure' | 'sense' | 'copy';
  completed: boolean;
  createdAt: string;
}

export interface ExpressionRecord { count: number; category: string; alternatives: string[]; }

export interface DB {
  writings: WritingEntry[];
  sentences: SentenceEntry[];
  copies: CopyEntry[];
  rewrites: RewriteEntry[];
  expressions: Record<string, ExpressionRecord>;
  weaknesses: Record<string, number>;
  structures: Record<string, number>;
  senses: Record<string, number>;
  copyTypes: Record<string, number>;
  missions: Mission[];
}

const DB_KEY = 'wc_v2_data';
const EMPTY: DB = {
  writings: [], sentences: [], copies: [], rewrites: [],
  expressions: {}, weaknesses: {}, structures: {}, senses: {}, copyTypes: {},
  missions: [],
};

export function loadDB(): DB {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<DB>) };
  } catch { return { ...EMPTY }; }
}
export function saveDB(db: DB) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function mergeExpressions(db: DB, exprs: Expression[]) {
  exprs.forEach(e => {
    if (!e.text) return;
    const k = norm(e.text);
    if (!db.expressions[k]) db.expressions[k] = { count: 0, category: e.category || '', alternatives: [] };
    db.expressions[k].count++;
    (e.alternative || []).forEach(a => {
      if (!db.expressions[k].alternatives.includes(a)) db.expressions[k].alternatives.push(a);
    });
  });
}
export function mergeWeaknesses(db: DB, list: string[]) {
  list.forEach(w => { if (w) db.weaknesses[norm(w)] = (db.weaknesses[norm(w)] || 0) + 1; });
}
export function mergeStructures(db: DB, list: Structure[]) {
  list.forEach(s => { if (s.type) db.structures[s.type] = (db.structures[s.type] || 0) + 1; });
}
export function mergeSenses(db: DB, s: SenseCount) {
  (Object.entries(s) as [string, number][]).forEach(([k, v]) => {
    db.senses[k] = (db.senses[k] || 0) + v;
  });
}
export function mergeCopyType(db: DB, t: string) {
  if (t) db.copyTypes[t] = (db.copyTypes[t] || 0) + 1;
}

export function getAnalyzedWritings(db: DB) { return db.writings.filter(w => w.analysis); }

export function getTotalChars(db: DB) {
  return db.writings.reduce((s, w) => s + w.text.length, 0);
}

export function getLast30DaysScores(db: DB) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return getAnalyzedWritings(db)
    .filter(w => new Date(w.date) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => ({ date: w.date.slice(5), score: w.analysis!.score, topic: w.topic || w.type }));
}

export function getMonthlyWritingStats(db: DB) {
  const map: Record<string, number[]> = {};
  getAnalyzedWritings(db).forEach(w => {
    const m = w.date.slice(0, 7);
    if (!map[m]) map[m] = [];
    map[m].push(w.analysis!.score);
  });
  return Object.keys(map).sort().map(m => ({
    month: m,
    avg: Math.round(map[m].reduce((a, b) => a + b, 0) / map[m].length),
    count: map[m].length,
  }));
}

export function getTopEntries(rec: Record<string, number>, n = 10) {
  return Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, n);
}
export function getTopExpressions(db: DB, n = 10) {
  return Object.entries(db.expressions).sort((a, b) => b[1].count - a[1].count).slice(0, n);
}

export function getAvgScore(db: DB): number | null {
  const a = getAnalyzedWritings(db);
  if (!a.length) return null;
  return Math.round(a.reduce((s, w) => s + w.analysis!.score, 0) / a.length);
}

/* Settings */
const SETTINGS_KEY = 'wc_settings';
export interface Settings {
  provider: 'openai' | 'gemini';
  apiKey: string;
  model: string;
  geminiApiKey: string;
  geminiModel: string;
}
const DEFAULTS: Settings = {
  provider: 'openai', apiKey: '', model: 'gpt-4o-mini',
  geminiApiKey: '', geminiModel: 'gemini-2.0-flash',
};
export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return s ? { ...DEFAULTS, ...s } : DEFAULTS;
  } catch { return DEFAULTS; }
}
export function saveSettings(s: Settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
