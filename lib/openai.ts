import { jsonrepair } from 'jsonrepair';
import type {
  WritingAnalysis, SentenceAnalysis, CopyAnalysis,
  Settings, DB, Mission, MissionEvaluation, SentenceExamples, WeaknessSynthesis, StrengthSynthesis,
  DictResult, ExpressionAnalysis, ExpressionCategory, ExpressionSense, ExpressionLevel, ExpressionUseContext,
  WriteType, ScoreBreakdown, ProofreadResult,
} from './db';

/** gpt-5-mini/gpt-5(-nano) 같은 reasoning 계열 판별 — gpt-5-chat-latest/gpt-4o 계열은
 *  일반 채팅 모델이라 여기 해당하지 않는다. 두 군데서 쓴다:
 *  1) temperature — reasoning 계열은 기본값(1) 외엔 거부한다
 *     ("Unsupported value: 'temperature' does not support 0.3 ... Only the default (1)
 *     value is supported").
 *  2) max_completion_tokens — reasoning 계열은 화면에 안 보이는 "추론 토큰"을 먼저 쓰고
 *     남은 예산으로 답을 쓴다. 호출부가 요청한 건 화면에 보일 답변 분량인데, 그 값을
 *     그대로 max_completion_tokens에 넣으면 추론만 하다 예산이 바닥나 빈 응답이 될 수
 *     있다("OpenAI가 빈 응답을 반환했습니다") — 추론용 여유분을 더 얹어준다. */
function isReasoningModel(model: string): boolean {
  return model.startsWith('gpt-5') && !model.includes('chat');
}
const REASONING_TOKEN_HEADROOM = 4000;

/* ── OpenAI 호출 (스트리밍 지원) ── */
async function callOpenAI(
  apiKey: string, model: string, system: string, user: string,
  maxTokens: number, temp: number, jsonMode: boolean,
  onStream?: (chunk: string) => void,
  schema?: object,
  imageUrl?: string,
): Promise<string> {
  // 비전 입력 — 이미지 URL은 OpenAI가 서버에서 직접 가져온다 (별도 fetch 불필요)
  const userContent: unknown = imageUrl
    ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: imageUrl } }]
    : user;
  const messages = system
    ? [{ role: 'system', content: system }, { role: 'user', content: userContent }]
    : [{ role: 'user', content: userContent }];

  const reasoning = isReasoningModel(model);
  const useStream = !!onStream;
  const body: Record<string, unknown> = {
    model, max_completion_tokens: reasoning ? maxTokens + REASONING_TOKEN_HEADROOM : maxTokens, messages, stream: useStream,
  };
  if (!reasoning) {
    body.temperature = temp;
  }
  // schema 제공 시 structured outputs(스키마 강제) — json_object보다 신뢰도 훨씬 높음
  if (schema) {
    body.response_format = { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } };
  } else if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!useStream) {
    const data = await res.json() as {
      error?: { message: string };
      choices: { message: { content: string } }[];
    };
    if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
    return data.choices[0].message.content;
  }

  // HTTP 에러를 스트리밍 전에 반드시 체크
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try { msg = (JSON.parse(txt) as { error?: { message: string } }).error?.message ?? msg; } catch { /* */ }
    throw new Error(`OpenAI: ${msg}`);
  }
  if (!res.body) throw new Error('OpenAI: 응답 스트림이 없습니다.');

  // SSE 스트리밍 — buf로 줄 경계 보존 (HTTP 청크가 SSE 라인 중간에 끊길 수 있음)
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  let buf = '';

  const processLine = (line: string) => {
    const payload = line.startsWith('data: ') ? line.slice(6).trim() : '';
    if (!payload || payload === '[DONE]') return;
    try {
      const parsed = JSON.parse(payload) as {
        error?: { message: string };
        choices: { delta: { content?: string } }[];
      };
      if (parsed.error) throw new Error(`OpenAI: ${parsed.error.message}`);
      const delta = parsed.choices[0]?.delta?.content ?? '';
      if (delta) { full += delta; onStream(delta); }
    } catch (e) {
      if (e instanceof SyntaxError) return;
      throw e;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // 스트림 종료 시 TextDecoder 내부 버퍼 flush + buf 잔여 처리
      buf += dec.decode();
      for (const line of buf.split('\n')) processLine(line);
      break;
    }
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) processLine(line);
  }
  if (!full) throw new Error('OpenAI가 빈 응답을 반환했습니다. API 키·모델·한도를 확인해주세요.');
  return full;
}

/** 이미지 URL → Gemini inline_data 파트. Gemini REST는 외부 URL을 직접 못 받아서
 *  브라우저에서 바이트를 받아 base64로 인코딩해 보낸다. fetch 실패(CORS 등)는 조용히
 *  건너뛴다 — 이미지 없이 텍스트만으로 평가가 진행된다. */
async function imageUrlToGeminiPart(url: string): Promise<{ inline_data: { mime_type: string; data: string } } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return { inline_data: { mime_type: res.headers.get('Content-Type') || 'image/jpeg', data: btoa(binary) } };
  } catch { return null; }
}

/* ── Gemini 호출 (스트리밍 지원) ── */
async function callGemini(
  apiKey: string, model: string, system: string, user: string,
  maxTokens: number, temp: number, jsonMode: boolean,
  onStream?: (chunk: string) => void,
  schema?: object,
  imageUrl?: string,
): Promise<string> {
  const generationConfig: Record<string, unknown> = { temperature: temp, maxOutputTokens: maxTokens };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  } else if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }
  const imagePart = imageUrl ? await imageUrlToGeminiPart(imageUrl) : null;
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: imagePart ? [{ text: user }, imagePart] : [{ text: user }] }],
    generationConfig,
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };

  const endpointName = onStream ? 'streamGenerateContent' : 'generateContent';
  const params = new URLSearchParams({ model, endpoint: endpointName, key: apiKey });
  if (onStream) params.set('alt', 'sse');
  const res = await fetch(`/api/gemini?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!onStream) {
    const data = await res.json() as {
      error?: { message: string };
      candidates?: { content: { parts: { text: string }[] } }[];
    };
    if (data.error) throw new Error(`Gemini: ${data.error.message}`);
    if (!data.candidates?.length) throw new Error('Gemini: 빈 응답을 받았어요. 입력 내용 또는 API 키를 확인해주세요.');
    return data.candidates[0].content.parts[0].text;
  }

  // HTTP 에러를 스트리밍 전에 반드시 체크
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try { msg = (JSON.parse(txt) as { error?: { message: string } }).error?.message ?? msg; } catch { /* */ }
    throw new Error(`Gemini: ${msg}`);
  }
  if (!res.body) throw new Error('Gemini: 응답 스트림이 없습니다.');

  // SSE 스트리밍
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const payload = line.startsWith('data: ') ? line.slice(6).trim() : '';
      if (!payload) continue;
      try {
        const chunk = JSON.parse(payload) as {
          error?: { message: string };
          candidates?: { content: { parts: { text: string }[] } }[];
        };
        if (chunk.error) throw new Error(`Gemini: ${chunk.error.message}`);
        const delta = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (delta) { full += delta; onStream(delta); }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  if (!full) throw new Error('Gemini가 빈 응답을 반환했습니다. API 키·모델·한도를 확인해주세요.');
  return full;
}

/* ── GCP Vertex AI 호출 (서버 /api/ai, 키 불필요, 스트리밍 지원) ──
 *  thinking 토큰 여유분·이미지 fetch는 서버 라우트가 처리한다. */
async function callGCP(
  model: string, system: string, user: string,
  maxTokens: number, temp: number, jsonMode: boolean,
  onStream?: (chunk: string) => void,
  schema?: object,
  imageUrl?: string,
): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system, user, maxTokens, temperature: temp, json: jsonMode,
      schema, imageUrl, stream: !!onStream, model: model || undefined,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try { msg = (JSON.parse(txt) as { error?: string }).error ?? msg; } catch { /* */ }
    if (msg === 'AI_OFF') msg = '서버 AI가 설정되지 않았어요. 설정 탭에서 OpenAI/Gemini API 키 방식으로 바꿔주세요.';
    throw new Error(`AI: ${msg}`);
  }

  if (!onStream) {
    const data = await res.json() as { text?: string; error?: string };
    if (data.error) throw new Error(`AI: ${data.error}`);
    if (!data.text) throw new Error('AI가 빈 응답을 반환했습니다.');
    return data.text;
  }

  if (!res.body) throw new Error('AI: 응답 스트림이 없습니다.');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const tail = dec.decode();
      if (tail) { full += tail; onStream(tail); }
      break;
    }
    const delta = dec.decode(value, { stream: true });
    if (delta) { full += delta; onStream(delta); }
  }
  if (!full) throw new Error('AI가 빈 응답을 반환했습니다. 잠시 후 다시 시도해주세요.');
  return full;
}

/* ── 라우터 ── */
async function callAI(
  s: Settings, system: string, user: string,
  maxTokens = 2000, temp = 0.3, jsonMode = false,
  onStream?: (chunk: string) => void,
  schema?: object,
  imageUrl?: string,
): Promise<string> {
  if (s.provider === 'gcp') {
    return callGCP(s.gcpModel, system, user, maxTokens, temp, jsonMode, onStream, schema, imageUrl);
  }
  if (s.provider === 'gemini') {
    if (!s.geminiApiKey) throw new Error('설정에서 Gemini API 키를 먼저 입력해주세요.');
    return callGemini(s.geminiApiKey, s.geminiModel, system, user, maxTokens, temp, jsonMode, onStream, schema, imageUrl);
  }
  if (!s.apiKey) throw new Error('설정에서 OpenAI API 키를 먼저 입력해주세요.');
  return callOpenAI(s.apiKey, s.model, system, user, maxTokens, temp, jsonMode, onStream, schema, imageUrl);
}

/* ── AI 코치 채팅 ── */
/* 묵당 선생(산마루 서재의 노작가, 가상 인물) — 제자와 함께한 시간(기록 수)이 쌓일수록 말투가 허물없어진다.
   키는 components/PixelCharacter.tsx TIERS의 name과 같다. */
const MUKDANG = '당신은 글쓰기 수련 게임 "산마루 서재"의 스승 "묵당 선생"이다. 30년 전 마지막 원고를 끝내지 못하고 펜을 놓았다가 제자를 받으며 다시 쓰기 시작한 노작가다. 문장 하나를 귀하게 여기고, 말은 짧고 구체적이다. 제자를 "자네"라고 부른다. 말끝을 "~네"(~했네, ~겠네, ~이네 등)로 끝내지 말 것. "~다", "~지", "~군", "~게", "~나?/~는가?"를 섞어 쓰고 "~일세"는 많아야 한 번.';
const COACH_PERSONAS: Record<string, string> = {
  '글 선생님': `${MUKDANG} 아직 서먹한 사이다. 정중하고 차분한 하오체를 쓴다. 3문장 이내.`,
  '선생님': `${MUKDANG} 제자가 꾸준히 찾아와 반갑다. 따뜻하게 격려하되 실용적인 조언 하나를 꼭 준다. 3문장 이내.`,
  '선배': `${MUKDANG} 이제 편한 사이다. 반말을 섞어 현실적인 조언을 한다. 2~3문장.`,
  '글쟁이 아저씨': `${MUKDANG} 허물없는 사이다. 투박하고 퉁명스럽지만 핵심을 꿰뚫는다. 2문장 이내.`,
  '영감님': `${MUKDANG} 막역한 사이다. 짧고 강렬하게, 군더더기 없이 한마디. 1~2문장.`,
  '욕쟁이 영감': `${MUKDANG} 피붙이 같은 사이다. 거칠게 타박하지만 깊은 애정이 묻어난다. 욕설은 쓰지 않는다. 1~2문장.`,
};

export async function chatWithCoach(
  s: Settings,
  tierName: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string,
): Promise<string> {
  const persona = COACH_PERSONAS[tierName] ?? COACH_PERSONAS['선생님'];
  const system = `${persona}\n글쓰기와 창작에 관련된 질문에만 답하고, 무관한 질문은 글쓰기로 연결해 답하세요.`;

  // history를 user/assistant 교대 형식으로 context 구성
  const contextLines = history.slice(-6).map(m =>
    m.role === 'user' ? `사용자: ${m.content}` : `코치: ${m.content}`
  ).join('\n');
  const userPrompt = contextLines
    ? `이전 대화:\n${contextLines}\n\n사용자: ${userMessage}`
    : userMessage;

  return callAI(s, system, userPrompt, 300, 0.8);
}

/* ── 안전 JSON 파싱 ── */
function safeParseJSON<T>(raw: string): T {
  if (!raw || !raw.trim()) {
    throw new Error('AI가 빈 응답을 반환했습니다. 잠시 후 다시 시도해주세요.');
  }

  let s = raw.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  const objIdx = s.indexOf('{');
  const arrIdx = s.indexOf('[');
  if (objIdx === -1 && arrIdx === -1) {
    throw new Error(`AI 응답에 JSON이 없습니다. 응답: "${s.slice(0, 120)}"`);
  }

  const isArr = arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx);
  const start = isArr ? arrIdx : objIdx;
  const end = s.lastIndexOf(isArr ? ']' : '}');
  if (end > start) s = s.slice(start, end + 1);

  // 0단계: 숫자 뒤 한국어 키 보정: 6구체성":4 → 6,"구체성":4
  s = s.replace(/(\d)([가-힣][가-힣a-zA-Z0-9]*)"(\s*:)/g, '$1,"$2"$3');

  // 1단계: 따옴표 없는 한국어 KEY 보정: {문장종류: "값"} → {"문장종류": "값"}
  s = s.replace(/(?<=[{,]\s*)([가-힣][가-힣a-zA-Z0-9]*)(?=\s*:)/g, '"$1"');

  // 2단계: 네이티브 파싱 시도
  try { return JSON.parse(s) as T; } catch { /* fall through */ }

  // 3단계: jsonrepair 후 파싱 (따옴표 누락·화살표 값 등 처리)
  try { return JSON.parse(jsonrepair(s)) as T; } catch { /* fall through */ }

  // 진단: 전체 길이 + 앞 300자 표시
  throw new Error(`JSON 파싱 실패 (${s.length}자) — AI 응답: ${s.slice(0, 300).replace(/\n/g, ' ')}`);
}

/* ═══════════════════════════════════════════════════════════
   Public API — 각 함수는 onStream 콜백을 받아서 UI에 스트리밍 진행 표시 가능
═══════════════════════════════════════════════════════════ */

// 모든 값은 문자열 → AI가 JSON 구조 실수할 여지 없음
interface FlatWritingAnalysis {
  breakdown: string; // "7,8,6,7,8" (표현력,전달력,구체성,논리성,가독성)
  good: string;      // "잘된점1|잘된점2"
  bad: string;       // "개선점1|개선점2"
  fixes: string;     // "원문→개선|원문→개선"
  tips: string;
  exprs: string;
}

const WRITING_SYS = `너는 30년 경력의 냉철한 문학 편집자다. 등단 작가 지망생들의 습작을 매일 평가하며 혹평으로 유명하다.
AI는 점수를 후하게 주는 경향이 강하다. 너는 그 반대로, 의식적으로 박하게 평가해야 한다.
개선 제안은 따뜻하게, 제안형("~해보시면 어떨까요") 사용. 단, 점수 자체는 절대 따뜻하게 주지 않는다.
breakdown 순서(5개, 각 0-10): 표현력,전달력,구체성,논리성,가독성

[기본값 원칙 — 가장 중요]
모든 글의 출발점은 3점이다. 일반인이 평범하게 쓴 글은 그대로 3점에 머문다.
점수를 1점이라도 올리려면 그 점수를 줘야 하는 구체적 근거(실제 문장·표현)를 스스로 떠올릴 수 있어야 한다.
근거를 즉시 떠올릴 수 없으면 올리지 말고 3점에 둔다. "괜찮은 것 같다"는 느낌은 근거가 아니다.

[각 항목(표현력,전달력,구체성,논리성,가독성)별 점수 기준 — 모든 항목에 동일하게 적용]
0-2: 해당 항목이 거의 기능하지 않음 (의미 전달 실패, 추상어 나열, 비문 등)
3: 기본 출발점. 결격 사유는 없지만 인상에 남는 부분도 없는 평범한 수준. 대부분의 습작은 여기서 끝난다.
4: 평범한 수준에서 사소한 장점이 한두 개 보임. 그래도 평균 미달로 취급한다.
5: 평균. 성실하지만 특별한 인상을 주는 대목은 없다. 이 점수조차 쉽게 주지 않는다.
6: 평균을 넘김. 구체적이고 인상적인 표현·구조가 명확히 1개 이상 존재할 때만.
7: 좋은 글. 해당 항목에서 뚜렷한 강점이 여러 군데 있고 약점이 거의 없다. 매우 드물게 부여한다.
8-10: 거의 부여하지 않는다. 등단·출판 수준의 완성도에만 해당한다. 한 글에서 모든 항목에 8 이상을 주는 일은 없다고 봐도 된다.

[채점 절차 — 순서대로 따른다]
1. 먼저 글의 전체 인상과 무관하게 항목별로 "이 항목에 6점 이상을 줄 근거가 있는가?"를 자문한다.
2. 근거가 없으면 즉시 3-5점 구간에 고정한다.
3. 근거가 있으면 그 근거(구체적 문장/표현)를 weaknesses나 good에 반드시 인용해서 점수와 피드백을 일치시킨다.
4. 5개 항목 점수가 전부 비슷하게 나오는 것을 경계하라. 같은 글이라도 항목별로 편차가 있는 것이 정상이다.

[추가 원칙]
- 짧은 글(3문장 이하)은 구체성·논리성·전달력을 3점을 넘기지 않는 것을 기본으로 한다. 분량이 짧으면 입증할 근거 자체가 부족하기 때문이다.
- "잘 썼다", "좋은 표현이다", "전반적으로 매끄럽다" 같은 막연한 칭찬으로 점수를 올리지 마라. 구체적 인용 없는 칭찬은 무효다.
- 맞춤법·띄어쓰기 오류, 비문, 주술 불일치가 하나라도 있으면 가독성을 5점 이하로 제한한다.
- 클리셰(상투적 비유, "마치 ~처럼", 뻔한 결말 문구)가 있으면 표현력에서 감점한다.
- 애매하면 무조건 낮게 준다. 두 점수 사이에서 고민될 때는 항상 낮은 쪽을 선택한다.

[피드백 작성 원칙 — 정교하고 집요하게]
- bad(개선점)는 최소 3개 이상 찾아라. 표현·구조·논리·디테일·어휘 선택 중 서로 다른 층위에서 골라낸다. "더 구체적으로 쓰면 좋겠다" 같은 두루뭉술한 지적은 금지하고, 문제가 된 문장이나 단어를 직접 인용해 어디가, 왜 약한지 짚는다.
- 같은 문제를 여러 표현으로 반복하지 말고, 매번 새로운 구체적 지점을 파고든다. 사소해 보이는 결함도 놓치지 않는다 (예: 같은 어미·접속사 반복, 시점 흔들림, 비유의 논리적 어긋남, 문장 길이의 단조로움).
- good(잘된점)도 막연히 칭찬하지 말고, 정확히 어떤 단어/구절이 왜 효과적인지 근거를 들어 설명한다. 근거를 못 대면 good에 넣지 않는다.
- fixes(원문→개선)는 bad에서 짚은 약점과 1:1로 대응시켜, 실제로 무엇이 어떻게 달라졌는지 알 수 있게 만든다. 막연히 "더 좋게" 고치는 게 아니라 구체적 결함을 제거하는 방향으로 고친다.
- tips(개선 제안)는 이 글 한 편에 한정되지 않고, 글쓴이가 반복하고 있을 법한 습관적 약점을 짚어 다음 글에도 적용할 수 있도록 일반화한다.
- 전체적으로 "잘 쓴 글이다"라는 인상에 안주하지 말고, 완성도가 높아 보일수록 더 미세한 결함까지 찾아내려는 태도를 유지한다.`;

// [표현력, 전달력, 구체성, 논리성, 가독성] 가중치 — 합계가 달라도 되며 정규화해서 사용
const WRITING_TYPE_WEIGHTS: Record<string, [number, number, number, number, number]> = {
  '묘사문':     [2.5, 1.0, 2.0, 0.5, 1.0], // 표현력·구체성 핵심, 논리성 낮음
  '설명문':     [0.5, 2.0, 2.0, 1.5, 1.5], // 전달력·구체성·논리성 핵심
  '감상문':     [1.5, 1.5, 1.5, 0.5, 1.0], // 표현·전달·구체 균형, 논리성 낮음
  '의견문':     [0.5, 1.5, 1.5, 2.5, 1.0], // 논리성 최우선
  '기사 리드':  [0.5, 2.0, 2.0, 1.0, 2.0], // 전달력·구체성·가독성 핵심
  '카피라이팅': [2.5, 2.0, 1.0, 0.5, 1.0], // 표현력·전달력 핵심, 논리성 낮음
  '에세이':     [2.0, 1.5, 1.0, 1.0, 1.5], // 표현력 최우선, 가독성도 중요
  '스토리텔링': [2.0, 2.0, 1.0, 0.5, 1.5], // 표현력·전달력 핵심, 논리성 낮음
};

const WRITING_TYPE_FOCUS: Record<string, string> = {
  '묘사문':
    '【묘사문 채점 비중】 표현력(25%) > 구체성(20%) > 가독성(10%) > 전달력(10%) > 논리성(5%). 표현력·구체성이 점수를 주도한다. 논리성은 이 유형에서 거의 의미 없으므로 3점을 기본값으로 고정하라.\n【묘사문 피드백 포인트】 오감 활용 여부(시각 외 감각이 있는가), 장면의 입체감(독자가 눈앞에 그릴 수 있는가), 추상어 남용(\'아름답다/쓸쓸하다\' 대신 구체적 묘사가 있는가). 개선 제안은 감각 전환("이 문장에서 시각 대신 청각이나 촉각으로 바꿔보면 어떨까요?") 위주로 하라.',
  '설명문':
    '【설명문 채점 비중】 전달력(25%) > 구체성(20%) > 논리성(15%) > 가독성(15%) > 표현력(5%). 정보가 명확하게 전달되는지가 최우선이다. 표현력은 이 유형에서 부차적이다.\n【설명문 피드백 포인트】 정보의 명확성(한 문장에 한 개념인가), 독자 수준 고려(전문용어를 설명 없이 쓰지 않았는가), 흐름(일반→구체 또는 원인→결과 순서가 지켜지는가). 개선 제안은 "이 개념을 예시나 비유로 풀어주면 훨씬 이해하기 쉬울 것 같아요" 위주로 하라.',
  '감상문':
    '【감상문 채점 비중】 표현력(20%) = 전달력(20%) = 구체성(20%) > 가독성(15%) > 논리성(5%). 감정의 진정성과 구체성이 핵심이다. 논리성은 이 유형에서 거의 의미 없다.\n【감상문 피드백 포인트】 감상의 진정성(상투적 감동 표현인가 vs 자기만의 해석인가), 경험-감상 연결(왜 그렇게 느꼈는지 구체적 근거가 있는가), 감정 서술의 구체성(\'감동받았다\' 대신 어떤 장면이 왜 와닿았는지). 개선 제안은 "이 감상에서 어떤 장면이 특히 인상 깊었는지 한 줄 더 써주면 훨씬 깊이 있어 보일 것 같아요" 위주로 하라.',
  '의견문':
    '【의견문 채점 비중】 논리성(30%) > 전달력(20%) > 구체성(15%) > 가독성(10%) > 표현력(5%). 주장-근거 구조가 점수를 결정한다. 표현이 화려해도 논리가 없으면 낮은 점수다.\n【의견문 피드백 포인트】 주장-근거 구조(주장만 있고 근거가 없지는 않은가), 근거의 설득력(구체적 사례·데이터·경험이 있는가), 반론 인식(반대 입장을 언급하고 넘어가는가). 개선 제안은 "이 주장을 뒷받침할 구체적 사례나 수치를 하나 추가해보면 어떨까요?" 위주로 하라.',
  '기사 리드':
    '【기사 리드 채점 비중】 전달력(25%) = 구체성(25%) > 가독성(25%) > 논리성(10%) > 표현력(5%). 5W1H 완성도와 정보 밀도가 최우선이다.\n【기사 리드 피드백 포인트】 5W1H 완성도(누가/언제/어디서/무엇을/왜/어떻게가 첫 단락에 담겼는가), 첫 문장 후킹력(읽고 싶게 만드는가), 정보 밀도(군더더기 없이 핵심만 담겼는가). 개선 제안은 "첫 문장에 숫자나 구체적 팩트를 넣으면 더 강한 인상을 줄 수 있어요" 위주로 하라.',
  '카피라이팅':
    '【카피라이팅 채점 비중】 표현력(30%) > 전달력(25%) > 가독성(15%) > 구체성(10%) > 논리성(5%). 한 줄로 심리를 건드리는 힘이 전부다. 논리성은 광고 카피의 본질과 무관하므로 3점 고정을 기본으로 하라.\n【카피라이팅 피드백 포인트】 첫 줄 후킹(0.3초 안에 멈추게 만드는가), 독자 심리 자극(욕구/두려움/호기심 중 어떤 것을 건드리는가), 행동 유도(읽고 나서 무언가 하고 싶어지는가). 개선 제안은 "\'~하세요\' 대신 \'~하면 어떻게 될지 상상해보세요\' 같은 유도형으로 바꾸면 더 끌릴 것 같아요" 위주로 하라.',
  '에세이':
    '【에세이 채점 비중】 표현력(25%) > 전달력(20%) > 가독성(20%) > 논리성(15%) > 구체성(10%). 문체와 관점의 독창성이 핵심이다.\n【에세이 피드백 포인트】 관점의 독창성(누구나 할 법한 말인가 vs 이 사람만의 시각인가), 경험-통찰 연결(구체적 경험이 보편적 통찰로 이어지는가), 문체의 일관성(문어체와 구어체가 뒤섞이지 않는가). 개선 제안은 "이 관찰에서 나만의 해석을 한 문장 덧붙이면 에세이다운 깊이가 생길 것 같아요" 위주로 하라.',
  '스토리텔링':
    '【스토리텔링 채점 비중】 표현력(25%) = 전달력(25%) > 가독성(20%) > 구체성(10%) > 논리성(5%). 몰입감과 생동감이 최우선이다. 논리성은 플롯 일관성 정도만 보며 3점을 기본으로 하라.\n【스토리텔링 피드백 포인트】 장면 전환의 자연스러움(끊기는 느낌 없이 흐르는가), 긴장감·흡입력(독자가 다음 장면이 궁금해지는가), 인물·감정의 생동감(인물이 살아있는 느낌인가). 개선 제안은 "이 장면에서 인물의 내면 반응을 한 줄 넣으면 독자가 훨씬 몰입하게 될 것 같아요" 위주로 하라.',
};

export async function analyzeWriting(
  s: Settings, type: string, topic: string, text: string,
  onStream?: (chunk: string) => void,
  /** 수련 중이면 그 수의 기법과 점검 질문 — 개선점의 첫째를 이 기준으로 본다 */
  focus?: { title: string; checks: string[] },
): Promise<WritingAnalysis> {
  const cleanText = text.replace(/\n{3,}/g, '\n\n').trim();
  const typeFocus = WRITING_TYPE_FOCUS[type] ?? '';
  const suFocus = focus ? `\n이번 글은 기법 「${focus.title}」 수련이다. 점검 질문: ${focus.checks.join(' / ')}\nbad의 첫째와 fixes의 첫째는 반드시 이 기법 기준으로, 본문의 실제 문장을 인용해 쓸 것.\n` : '';
  const user = `유형: ${type || '미지정'}\n주제: ${topic || '미지정'}\n본문:\n${cleanText}
${typeFocus ? `\n${typeFocus}\n` : ''}${suFocus}
아래 JSON 형식 그대로 출력 (값만 교체, 모든 값은 큰따옴표 문자열, bad·fixes는 최소 3개씩):
{"breakdown":"7,8,6,7,8","good":"잘된점1|잘된점2","bad":"개선점1|개선점2|개선점3","fixes":"원문→개선문|원문→개선문|원문→개선문","tips":"제안1|제안2|제안3","exprs":"핵심표현1|핵심표현2"}`;

  const raw = await callAI(s, WRITING_SYS, user, 2500, 0.3, true, onStream);
  const r = safeParseJSON<FlatWritingAnalysis>(raw);

  const sp   = (v: string) => (v || '').split('|').map(x => x.trim()).filter(Boolean);
  const nums = (v: string) => ((v || '').match(/\d+/g) ?? []).map(n => Math.min(10, parseInt(n, 10) || 0));

  const bd = nums(r.breakdown);
  while (bd.length < 5) bd.push(0);

  // 유형별 가중치 적용 점수
  const w = WRITING_TYPE_WEIGHTS[type] ?? [1, 1, 1, 1, 1];
  const totalW = w.reduce((a, b) => a + b, 0);
  const weightedSum = bd.reduce((acc, val, i) => acc + val * (w[i] ?? 1), 0);
  const score = Math.round(weightedSum / (totalW * 10) * 100);

  return {
    score,
    score_breakdown: {
      표현력: bd[0] ?? 0, 전달력: bd[1] ?? 0, 구체성: bd[2] ?? 0,
      논리성: bd[3] ?? 0, 가독성: bd[4] ?? 0,
    },
    strengths:               sp(r.good),
    weaknesses:              sp(r.bad),
    improvement_examples:    sp(r.fixes),
    improvement_suggestions: sp(r.tips),
    expressions: sp(r.exprs).map(t => ({ text: t, category: '표현', alternative: [] })),
  };
}

/* ── 이의 제기 재심 ── */
export interface AppealResult {
  verdict: '인용' | '일부 인용' | '기각';
  revisedScore: number;
  revisedBreakdown: ScoreBreakdown;
  reasoning: string;
  acceptedPoints: string[];
  rejectedPoints: string[];
}

const APPEAL_SYS = `너는 글쓰기 심사 위원회의 수석 심사위원이다. 필자가 AI 평가에 이의를 제기했다. 원문과 이의 신청서를 다시 검토하고 최종 판정을 내려라.

[판정 원칙]
- 필자의 주장이 원문에서 실제로 확인 가능할 때만 수용한다.
- 글의 배경·의도·장르 특성에 대한 합리적 근거는 진지하게 검토한다.
- "열심히 썼다", "다시 봐달라" 등 감정적 호소나 근거 없는 주장은 즉시 기각한다.
- 점수 조정은 보수적으로: 상향 최대 +15점, 하향도 가능하다.
- 기각 시에도 주장을 성실히 검토했음을 구체적 논거로 보여준다.
- 필자에게 무조건 유리하게 판정하지 않는다. 공정하되 엄격하다.

JSON 객체만 출력하라. 설명·마크다운 금지.`;

export async function evaluateAppeal(
  s: Settings,
  type: WriteType,
  topic: string,
  text: string,
  original: WritingAnalysis,
  appealText: string,
  onStream?: (chunk: string) => void,
): Promise<AppealResult> {
  const bd = original.score_breakdown ?? {};
  const user = `[원문 정보]
유형: ${type} / 주제: ${topic || '없음'}

[원문]
${text}

[최초 AI 평가]
총점: ${original.score}/100
세부: 표현력 ${bd.표현력 ?? '?'} / 전달력 ${bd.전달력 ?? '?'} / 구체성 ${bd.구체성 ?? '?'} / 논리성 ${bd.논리성 ?? '?'} / 가독성 ${bd.가독성 ?? '?'}
강점: ${(original.strengths || []).join(', ') || '없음'}
약점: ${(original.weaknesses || []).join(', ') || '없음'}

[필자의 이의 신청]
${appealText}

아래 JSON 형식 그대로 출력 (값만 교체):
{"verdict":"기각","revisedScore":${original.score},"breakdown":"표현력:${bd.표현력 ?? 5}|전달력:${bd.전달력 ?? 5}|구체성:${bd.구체성 ?? 5}|논리성:${bd.논리성 ?? 5}|가독성:${bd.가독성 ?? 5}","reasoning":"재심 판정 이유 3-5문장. 엄격하되 논거 있게.","accepted":"수용한 주장1|수용한 주장2","rejected":"기각한 주장1|기각한 주장2"}`;

  const raw = await callAI(s, APPEAL_SYS, user, 1400, 0.3, true, onStream);
  const r = safeParseJSON<{ verdict: string; revisedScore: string | number; breakdown: string; reasoning: string; accepted: string; rejected: string }>(raw);

  const sp = (v: string) => (v || '').split('|').map(x => x.trim()).filter(Boolean);
  const verdict = (['인용', '일부 인용', '기각'] as const).includes(r.verdict as AppealResult['verdict'])
    ? r.verdict as AppealResult['verdict'] : '기각';

  const revised: ScoreBreakdown = { 표현력: bd.표현력 ?? 5, 전달력: bd.전달력 ?? 5, 구체성: bd.구체성 ?? 5, 논리성: bd.논리성 ?? 5, 가독성: bd.가독성 ?? 5 };
  sp(r.breakdown).forEach(item => {
    const col = item.indexOf(':');
    if (col !== -1) {
      const k = item.slice(0, col).trim() as keyof ScoreBreakdown;
      if (k in revised) revised[k] = Math.min(10, Math.max(0, parseInt(item.slice(col + 1).trim(), 10) || revised[k]));
    }
  });

  const revisedScore = Math.min(100, Math.max(0, Number(r.revisedScore) || original.score));

  return {
    verdict,
    revisedScore,
    revisedBreakdown: revised,
    reasoning: r.reasoning || '',
    acceptedPoints: sp(r.accepted),
    rejectedPoints: sp(r.rejected),
  };
}

export async function generateMonthlyReport(s: Settings, payload: object): Promise<string> {
  const prompt = `너는 사용자의 글쓰기 코치다. 데이터 기반으로 월간 성장 리포트를 작성하라.
데이터 기반으로만 분석하고 근거 없는 칭찬은 하지 마라. 사용자에게 전달하는 말투는 따뜻하고 상냥하게.

${JSON.stringify(payload, null, 2)}

아래 순서로 작성. 각 섹션은 ### 섹션명 으로 구분:
1. 이번 달 성장 요약
2. 가장 발전한 부분
3. 가장 부족한 부분
4. 반복되는 문제점
5. 자주 쓰는 표현과 구조
6. 다음 달 집중 과제
7. 추천 글쓰기 훈련 과제 3개`;
  return callAI(s, '', prompt, 2500, 0.4, false);
}

/* ── 약점 종합 진단 ── */
const WEAKNESS_SYNTH_SYS = `너는 글쓰기 코치다. 사용자의 여러 글에서 반복적으로 지적된 약점 피드백과 그 빈도가 주어진다.
이 목록을 그대로 나열하지 말고, 같은 근본 원인을 가리키는 항목들을 묶어서 사용자가 실제로 가진 핵심 약점 2~3가지로 종합 진단하라.

[원칙]
- 표현은 다르지만 같은 문제를 가리키는 피드백은 하나의 약점으로 합쳐라.
- 추상적으로 말하지 말고, 왜 이 약점이 반복되는지 구체적으로 짚어라.
- 가장 빈도 높고 중요한 것부터 순서대로 제시한다.
- 각 약점마다 바로 실천할 수 있는 구체적인 개선 방법을 하나씩 제안한다.
- 최대 3개까지만 제시한다.

JSON 객체만 출력 (설명·마크다운 금지):
{"weaknesses":[{"title":"핵심 약점 (8단어 이내)","explanation":"왜 반복되는지 구체적 진단 2-3문장","suggestion":"바로 실천할 수 있는 개선 방법 1문장"}]}`;

export async function synthesizeWeaknesses(
  s: Settings, items: { text: string; count: number }[],
): Promise<WeaknessSynthesis[]> {
  const user = `약점 피드백과 빈도:\n${items.map(i => `- ${i.text} (${i.count}회)`).join('\n')}`;
  const raw = await callAI(s, WEAKNESS_SYNTH_SYS, user, 1200, 0.4, true);
  const r = safeParseJSON<{ weaknesses: WeaknessSynthesis[] }>(raw);
  return r.weaknesses || [];
}

/* ── 강점 종합 진단 ── */
const STRENGTH_SYNTH_SYS = `너는 글쓰기 코치다. 사용자의 여러 글에서 반복적으로 칭찬된 강점 피드백과 그 빈도가 주어진다.
이 목록을 그대로 나열하지 말고, 같은 역량을 가리키는 항목들을 묶어서 사용자가 실제로 가진 핵심 강점 2~3가지로 종합 진단하라.

[원칙]
- 표현은 다르지만 같은 역량을 가리키는 피드백은 하나로 합쳐라.
- "잘한다"는 나열이 아니라, 어떤 글쓰기 상황에서 이 강점이 어떻게 발휘되는지 구체적으로 설명하라.
- 가장 빈도 높고 뚜렷한 것부터 순서대로 제시한다.
- 최대 3개까지만 제시한다.

JSON 객체만 출력 (설명·마크다운 금지):
{"strengths":[{"title":"핵심 강점 (8단어 이내)","explanation":"이 강점이 글에서 어떻게 드러나는지 구체적 설명 2문장"}]}`;

export async function synthesizeStrengths(
  s: Settings, items: { text: string; count: number }[],
): Promise<StrengthSynthesis[]> {
  const user = `강점 피드백과 빈도:\n${items.map(i => `- ${i.text} (${i.count}회)`).join('\n')}`;
  const raw = await callAI(s, STRENGTH_SYNTH_SYS, user, 1000, 0.4, true);
  const r = safeParseJSON<{ strengths: StrengthSynthesis[] }>(raw);
  return r.strengths || [];
}

/* ── 글쓰기 첨삭 ── */
const PROOFREAD_SYS = `너는 전문 글쓰기 첨삭가다. 글쓴이의 목소리와 개성을 최대한 살리면서 분석에서 지적된 약점 중심으로 최소한만 수정한다.
원문을 통째로 새로 쓰지 말고, 실제로 바꿔야 하는 부분만 손댄다. 맞춤법·비문·클리셰·추상어 등 명백한 문제 우선.
JSON 형식으로만 응답하라. 설명·마크다운 금지.`;

export async function proofreadWriting(
  s: Settings,
  type: string,
  topic: string,
  text: string,
  analysis: WritingAnalysis,
  onStream?: (chunk: string) => void,
): Promise<ProofreadResult> {
  const weaknesses = (analysis.weaknesses || []).slice(0, 5).join(', ');
  const suggestions = (analysis.improvement_suggestions || []).slice(0, 3).join(' / ');
  const user = `유형: ${type || '미지정'}
주제: ${topic || '미지정'}
원문:
${text}

지적된 약점: ${weaknesses || '없음'}
개선 제안: ${suggestions || '없음'}

아래 JSON 형식 그대로 출력하라:
{"corrected":"첨삭된 전문","changes":[{"original":"원문 구절","revised":"수정된 구절","reason":"이유 태그"}]}
changes는 3-5개. reason은 10자 이내 짧은 태그 (예: "클리셰 제거", "감각어 전환", "논리 보강", "비문 수정", "추상어 대체")`;
  const raw = await callAI(s, PROOFREAD_SYS, user, 3000, 0.4, true, onStream);
  return safeParseJSON<ProofreadResult>(raw);
}

/* ── 오늘의 수련 ② 고쳐 쓰기 — 한 문장 고쳐 쓰기·필사 분석 짧은 피드백 ── */
export interface WarmupFeedback { applied: boolean; feedback: string; better: string }
export async function evaluateWarmup(
  s: Settings, suTitle: string, technique: string, task: string, original: string, answer: string,
): Promise<WarmupFeedback> {
  const system = `당신은 글쓰기 수련 게임의 스승 "묵당 선생"이다. 제자가 오늘 배운 기법 「${suTitle}」을 한 문장 고쳐 쓰기에 적용했는지 짧고 정확하게 본다. 말투는 담백한 하게체 — "~다/~지/~군/~게"를 섞어 쓰고 "~일세"는 많아야 한 번. 말끝을 "~네"(~했네·~겠네·~이네)로 끝내지 말 것. 2문장 이내. 칭찬은 근거가 있을 때만.`;
  const user = `기법 설명: ${technique}\n과제: ${task}\n원문: ${original}\n제자의 답: ${answer}\n
JSON으로만 답하라: {"applied": true/false (기법을 실제로 적용했는가), "feedback": "구체적인 한두 문장 — 어느 단어가 왜 좋아졌는지 또는 무엇이 아직 남았는지", "better": "같은 기법을 더 잘 적용한 예시 한 문장"}`;
  const raw = await callAI(s, system, user, 600, 0.4, true);
  const r = safeParseJSON<{ applied?: boolean | string; feedback?: string; better?: string }>(raw);
  return { applied: r.applied === true || r.applied === 'true', feedback: r.feedback ?? '', better: r.better ?? '' };
}

/* ── 오늘의 수련 ④ 퇴고 — 고치기 전후를 비교해 짧게 본다 ── */
export interface RevisionFeedback { improved: boolean; feedback: string; next: string }
export async function evaluateRevision(
  s: Settings, suTitle: string, checks: string[], before: string, after: string, note: string, pointed: string[],
): Promise<RevisionFeedback> {
  const system = `당신은 글쓰기 수련 게임의 스승 "묵당 선생"이다. 제자가 자기 글을 퇴고했다. 고치기 전과 후를 비교해, 오늘 배운 기법 「${suTitle}」과 지적받은 점이 실제로 나아졌는지 정확하게 본다. 말투는 담백한 하게체 — "~다/~지/~군/~게"를 섞어 쓰고 "~일세"는 많아야 한 번. 말끝을 "~네"로 끝내지 말 것. 칭찬은 근거가 있을 때만, 고친 문장을 직접 인용해서.`;
  const user = `점검 질문: ${checks.join(' / ')}\n지적받은 점: ${pointed.join(' / ') || '없음'}\n제자가 적은 고친 이유: ${note || '(없음)'}\n\n[고치기 전]\n${before.slice(0, 2500)}\n\n[고친 뒤]\n${after.slice(0, 2500)}\n
JSON으로만 답하라: {"improved": true/false (기법과 지적 기준으로 실제로 나아졌는가), "feedback": "2~3문장 — 고친 문장을 인용해 무엇이 왜 나아졌는지, 또는 무엇이 그대로인지", "next": "다음 퇴고 때 볼 한 가지(한 문장)"}`;
  const raw = await callAI(s, system, user, 700, 0.4, true);
  const r = safeParseJSON<{ improved?: boolean | string; feedback?: string; next?: string }>(raw);
  return { improved: r.improved === true || r.improved === 'true', feedback: r.feedback ?? '', next: r.next ?? '' };
}

/* ── 주간 편지 — 한 주의 글을 묵당 선생이 편지로 첨삭 ── */
export async function writeWeeklyLetter(
  s: Settings, name: string, weekLabel: string,
  items: { title: string; type: string; text: string; score?: number; weak?: string[] }[],
  streak: number, learned: string[], lastReply?: string,
): Promise<string> {
  const system = `당신은 글쓰기 수련 게임 "산마루 서재"의 스승 "묵당 선생"(노작가)이다. 매주 일요일 제자에게 손편지를 쓴다. 말투는 담백한 하게체("자네", "~하게", "~다", "~지", "~군", "~는가?"). 말끝을 "~네"(~했네·~겠네·~이네)로 끝내지 말 것. "~일세"는 편지 전체에서 한두 번 이내. 따뜻하지만 정확하다.
편지 구성(전체 12~18문장, 소제목·목록·마크다운 금지, 문단만):
1) 이번 주 자네가 쓴 글에서 가장 좋았던 문장 하나를 그대로 인용하고 왜 좋은지.
2) 반복되는 약점 하나를, 실제 문장을 인용해 짚고 고친 예를 보여 줌.
3) 이번 주 익힌 기법과 연결해 다음 주에 시도할 구체적인 한 가지.
4) 등불(연속 수련일)에 대한 한마디와 짧은 맺음. 끝에 "— 묵당" 서명.
제자가 지난 편지에 답장을 보냈다면, 편지 첫머리에서 그 답장의 한 구절을 인용해 짧게 답하라.`;
  const body = items.slice(0, 8).map((it, i) => `[${i + 1}] (${it.type}) ${it.title}${it.score != null ? ` · ${it.score}점` : ''}\n${it.text.slice(0, 700)}${it.weak?.length ? `\n지적된 약점: ${it.weak.slice(0, 2).join(' / ')}` : ''}`).join('\n\n');
  const user = `제자 이름: ${name || '제자'}\n기간: ${weekLabel}\n현재 등불: ${streak}일 연속\n이번 주 익힌 기법: ${learned.join(', ') || '없음'}${lastReply ? `\n\n지난 편지에 제자가 보낸 답장:\n${lastReply.slice(0, 600)}` : ''}\n\n이번 주 글:\n${body}`;
  return (await callAI(s, system, user, 1600, 0.6)).trim();
}
