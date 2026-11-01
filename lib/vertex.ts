import 'server-only';
import { GoogleGenAI } from '@google/genai';

/**
 * 서버 전용 Gemini 클라이언트 (chunil-lab/src/lib/gemini.ts 패턴).
 * - GEMINI_API_KEY 가 있으면 AI Studio(Gemini Developer API)
 * - 아니면 Vertex AI + ADC (로컬: `gcloud auth application-default login`, Cloud Run: 실행 서비스 계정)
 * 이 계정의 Vertex에서는 Gemini 3.x만 동작한다(2.5 계열은 404).
 */
let client: GoogleGenAI | null = null;

export const aiEnabled = () =>
  Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_PROJECT) && process.env.AI_DISABLED !== '1';

function createClient() {
  if (process.env.GEMINI_API_KEY) return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
  });
}

export function gemini() {
  if (!aiEnabled()) throw new Error('AI_OFF');
  client ??= createClient();
  return client;
}

export const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';

/** 클라이언트가 고를 수 있는 모델 (그 외 값은 기본 모델로 대체) */
export const ALLOWED_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
];
