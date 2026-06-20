import { jsonrepair } from 'jsonrepair';
import type {
  WritingAnalysis, SentenceAnalysis, CopyAnalysis, RewriteLevels,
  Settings, DB, Mission, MissionEvaluation, SentenceExamples,
} from './db';

/* ── OpenAI 호출 (스트리밍 지원) ── */
async function callOpenAI(
  apiKey: string, model: string, system: string, user: string,
  maxTokens: number, temp: number, jsonMode: boolean,
  onStream?: (chunk: string) => void,
): Promise<string> {
  const messages = system
    ? [{ role: 'system', content: system }, { role: 'user', content: user }]
    : [{ role: 'user', content: user }];

  const useStream = !!onStream;
  const body: Record<string, unknown> = {
    model, max_tokens: maxTokens, temperature: temp, messages, stream: useStream,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

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

  // SSE 스트리밍
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split('\n')) {
      const payload = line.startsWith('data: ') ? line.slice(6).trim() : '';
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as {
          error?: { message: string };
          choices: { delta: { content?: string } }[];
        };
        if (parsed.error) throw new Error(`OpenAI: ${parsed.error.message}`);
        const delta = parsed.choices[0]?.delta?.content ?? '';
        if (delta) { full += delta; onStream(delta); }
      } catch (e) {
        if (e instanceof SyntaxError) continue; // 정상적인 청크 파싱 실패, 무시
        throw e;
      }
    }
  }
  if (!full) throw new Error('OpenAI가 빈 응답을 반환했습니다. API 키·모델·한도를 확인해주세요.');
  return full;
}

/* ── Gemini 호출 (스트리밍 지원) ── */
async function callGemini(
  apiKey: string, model: string, system: string, user: string,
  maxTokens: number, temp: number, jsonMode: boolean,
  onStream?: (chunk: string) => void,
): Promise<string> {
  const generationConfig: Record<string, unknown> = { temperature: temp, maxOutputTokens: maxTokens };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: user }] }],
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

/* ── 라우터 ── */
async function callAI(
  s: Settings, system: string, user: string,
  maxTokens = 2000, temp = 0.3, jsonMode = false,
  onStream?: (chunk: string) => void,
): Promise<string> {
  if (s.provider === 'gemini') {
    if (!s.geminiApiKey) throw new Error('설정에서 Gemini API 키를 먼저 입력해주세요.');
    return callGemini(s.geminiApiKey, s.geminiModel, system, user, maxTokens, temp, jsonMode, onStream);
  }
  if (!s.apiKey) throw new Error('설정에서 OpenAI API 키를 먼저 입력해주세요.');
  return callOpenAI(s.apiKey, s.model, system, user, maxTokens, temp, jsonMode, onStream);
}

/* ── AI 코치 채팅 ── */
const COACH_PERSONAS: Record<string, string> = {
  '글 선생님': '당신은 "글 선생님"이라는 AI 글쓰기 코치입니다. 정중하고 따뜻한 격식체를 사용합니다. 초보 작가를 세심하게 안내하며, 글쓰기 관련 질문에만 답합니다. 답변은 3문장 이내로 간결하게.',
  '선생님': '당신은 "선생님"이라는 AI 글쓰기 코치입니다. 친절하고 응원해주는 말투로 답합니다. 꾸준히 써온 사용자를 격려하며 실용적인 조언을 줍니다. 3문장 이내.',
  '선배': '당신은 "선배"라는 AI 글쓰기 코치입니다. 친근한 반말로 현실적인 조언을 합니다. 너무 길게 말하지 않고 핵심만. 2~3문장.',
  '글쟁이 아저씨': '당신은 "글쟁이 아저씨"라는 AI 글쓰기 코치입니다. 투박하지만 핵심을 꿰뚫는 조언을 합니다. 퉁명스럽지만 진심입니다. 2문장 이내.',
  '영감님': '당신은 "영감님"이라는 AI 글쓰기 코치입니다. 짧고 강렬하게. 군더더기 없이 핵심 한마디. 1~2문장.',
  '욕쟁이 영감': '당신은 "욕쟁이 영감"이라는 AI 글쓰기 코치입니다. 거칠지만 깊은 애정으로 조언합니다. 직설적이되 욕설 없이. 1~2문장.',
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
    throw new Error(`AI 응답에 JSON이 없습니다. 응답 앞부분: "${s.slice(0, 120)}"`);
  }

  const isArr = arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx);
  const start = isArr ? arrIdx : objIdx;
  const end = s.lastIndexOf(isArr ? ']' : '}');
  if (end > start) s = s.slice(start, end + 1);

  try {
    return JSON.parse(jsonrepair(s)) as T;
  } catch (e) {
    throw new Error(`JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/* ═══════════════════════════════════════════════════════════
   Public API — 각 함수는 onStream 콜백을 받아서 UI에 스트리밍 진행 표시 가능
═══════════════════════════════════════════════════════════ */

const WRITING_SYS = `너는 30년 경력의 전문 작가이자 카피라이터다.
글쓰기 능력을 데이터 기반으로 객관적으로 분석한다. 근거 없는 칭찬은 절대 하지 않는다.
strengths/weaknesses/improvement_suggestions/improvement_examples는 따뜻하고 상냥하게, 제안형("~해보시면 어떨까요") 사용.

[평가 — 각 항목 0-10점, 합산/90*100 = score]
표현력: 어휘 선택의 적절성과 참신성
전달력: 독자에게 의미가 명확히 전달되는가
구체성: 추상적 표현 대신 구체적 사례/묘사
문장다양성: 문장 길이와 구조의 다양성
카피라이팅적합성: 설득력, 호소력, 임팩트
논리성: 논증 구조의 명확성과 일관성
가독성: 읽기 쉬운 흐름과 리듬
구조다양성: 다양한 문장 구조 패턴 사용
감각표현다양성: 오감 활용의 풍부함

[표현 분류] 평가/감정/행동/상태/묘사
[구조 분류] 장소→대상/대상→상태/주체→행동/행동→결과/원인→결과/목표→행동/감상→설명/비교→결론/문제→원인/현상→해석

[유형별 핵심 평가 기준 — 글쓰기 유형에 맞춰 점수 비중 조정]
묘사문: 오감 표현, 이미지 환기 → 표현력·구체성·감각표현다양성 비중 높게
설명문: 논리적 전개, 정보 명확성 → 전달력·논리성·가독성 비중 높게
감상문: 감정 진정성, 개인적 관점 → 표현력·구체성 비중 높게
의견문: 주장 명확성, 근거 타당성 → 논리성·전달력 비중 높게
기사 리드: 6하원칙, 핵심 우선, 간결성 → 전달력·가독성·구체성 비중 높게
카피라이팅: 후킹, 설득력, 행동 유도 → 카피라이팅적합성·표현력 비중 높게
에세이: 주제 일관성, 깊이, 개성 있는 문체 → 표현력·논리성·구체성 비중 높게
스토리텔링: 서사 구조, 몰입감, 장면 묘사 → 구조다양성·감각표현다양성·표현력 비중 높게

반드시 아래 JSON 스키마를 그대로 지켜서 응답하라.`;

export async function analyzeWriting(
  s: Settings, type: string, topic: string, text: string,
  onStream?: (chunk: string) => void,
): Promise<WritingAnalysis> {
  const user = `유형: ${type || '미지정'}\n주제: ${topic || '미지정'}\n본문:\n${text}

응답 형식(JSON 객체만, 설명 없이):
{"score":0,"score_breakdown":{"표현력":0,"전달력":0,"구체성":0,"문장다양성":0,"카피라이팅적합성":0,"논리성":0,"가독성":0,"구조다양성":0,"감각표현다양성":0},"strengths":["키워드"],"weaknesses":["키워드"],"repeated_words":["단어"],"improvement_examples":["원문 → 개선예시"],"improvement_suggestions":["제안"],"expressions":[{"text":"표현","category":"평가","alternative":["대체"]}],"structures":[{"type":"주체→행동","example":"실제 문장"}],"senses":{"시각":0,"청각":0,"후각":0,"미각":0,"촉각":0}}`;
  const raw = await callAI(s, WRITING_SYS, user, 3000, 0.3, true, onStream);
  return safeParseJSON<WritingAnalysis>(raw);
}

const SENTENCE_SYS = `너는 문장 구조 분석 전문가다. 아래 JSON 스키마를 그대로 지켜서 응답하라.
[일반 구조] 장소→대상/대상→상태/주체→행동/행동→결과/원인→결과/목표→행동/감상→설명/비교→결론/문제→원인/현상→해석
[카피 구조] 문제→해결/공감→제안/위험→대비/숫자→혜택/호기심→정보/질문→답변/증거→결론/반전→메시지/스토리→교훈/행동→보상
[역할] 묘사/설명/주장/설득/정보전달/공감/문제제기/행동유도
[카피 기법] 대조/반복/숫자/질문/명령/비유/스토리텔링/긴급성/희소성/공포/보상/사회적 증거`;

export async function analyzeSentence(
  s: Settings, sentence: string, source: string, sentenceType: string,
  onStream?: (chunk: string) => void,
): Promise<SentenceAnalysis> {
  const isCopy = sentenceType === '광고 카피';
  const user = `출처: ${source || '미지정'}\n유형: ${sentenceType || '기타'}\n문장: ${sentence}

의미 단위로 분해하여 각 단위의 역할(label)과 텍스트(text)를 추출하라.
응답 형식(JSON 객체만, 설명 없이):
{"structures":["주체→행동"],"copyStructures":${isCopy ? '["문제→해결"]' : '[]'},"roles":["묘사","설명"],"semanticBreakdown":[{"label":"주체","text":"실제 텍스트"},{"label":"행동","text":"실제 텍스트"}],"keyExpressions":["핵심표현"],"copyTechniques":${isCopy ? '["대조"]' : '[]'},"learningPoints":["이 문장에서 배울 점 1","배울 점 2","배울 점 3"]}`;
  const raw = await callAI(s, SENTENCE_SYS, user, 1500, 0.3, true, onStream);
  return safeParseJSON<SentenceAnalysis>(raw);
}

export async function generateSentenceExamples(
  s: Settings, sentence: string, structures: string[],
  onStream?: (chunk: string) => void,
): Promise<SentenceExamples> {
  const sys = '너는 글쓰기 예문 생성 전문가다. 주어진 문장의 구조를 활용한 예문을 생성한다. JSON 형식으로만 응답하라.';
  const user = `원문: ${sentence}
구조: ${structures.join(', ')}

아래 4가지 유형으로 각 5개씩 예문을 생성하라:
응답 형식(JSON 객체만, 설명 없이):
{"sameStructure":["같은 구조로 쓴 문장 5개"],"applied":["구조를 응용한 변형 문장 5개"],"copyExamples":["해당 구조를 활용한 광고 카피 5개"],"descriptive":["해당 구조를 활용한 문학적 묘사문 5개"]}`;
  const raw = await callAI(s, sys, user, 3000, 0.7, true, onStream);
  return safeParseJSON<SentenceExamples>(raw);
}

const COPY_SYS = `너는 카피라이팅 전문가다. 아래 JSON 스키마를 그대로 지켜서 응답하라.
[카피 유형] 문제 해결형(문제→해결)/공감 제안형(공감→제안)/위험 대비형(위험→대비)/호기심 자극형(호기심→정보)/혜택 강조형(숫자→혜택)/질문 답변형(질문→답변)/근거 설득형(증거→결론)/반전 제시형(반전→메시지)/스토리 전달형(스토리→교훈)/행동 유도형(행동→보상)
[사용 기법] 대조/반복/숫자/질문/명령/스토리/비유`;

export async function analyzeCopy(
  s: Settings, copy: string, brand: string, source: string,
  onStream?: (chunk: string) => void,
): Promise<CopyAnalysis> {
  const user = `카피: ${copy}\n브랜드: ${brand || '미지정'}\n출처: ${source || '미지정'}

응답 형식(JSON 객체만, 설명 없이):
{"hookStrength":0,"type":"문제 해결형","techniques":["기법"],"targetAudience":"예상 타겟","improvement":"개선안"}`;
  const raw = await callAI(s, COPY_SYS, user, 1000, 0.3, true, onStream);
  return safeParseJSON<CopyAnalysis>(raw);
}

const REWRITE_SYS = `너는 글쓰기 트레이너다. 아래 JSON 스키마를 그대로 지켜서 응답하라.
Level1: 문법/자연스러움 수정 (원문 스타일 최대한 유지)
Level2: 표현력 강화 (더 생생하고 구체적으로)
Level3: 작가 수준 (문학적 감수성, 리듬감, 여운)
Level4: 광고 카피 스타일 (임팩트, 짧고 강하게, 핵심만)
Level5: 기사 리드 스타일 (육하원칙, 객관적, 핵심 먼저)`;

export async function rewriteText(
  s: Settings, text: string,
  onStream?: (chunk: string) => void,
): Promise<RewriteLevels> {
  const user = `원문:\n${text}\n\n응답 형식(JSON 객체만, 설명 없이):\n{"level1":"","level2":"","level3":"","level4":"","level5":""}`;
  const raw = await callAI(s, REWRITE_SYS, user, 2800, 0.5, true, onStream);
  return safeParseJSON<RewriteLevels>(raw);
}

export async function generateVariations(
  s: Settings, text: string,
  onStream?: (chunk: string) => void,
): Promise<string[]> {
  const sys = '같은 의미를 가진 문장을 10가지 다른 표현으로 작성하라. JSON 배열만 반환. 설명 없이.';
  const user = `원문:\n${text}\n\n응답 형식(JSON 배열만, 설명 없이):\n["버전1","버전2","버전3","버전4","버전5","버전6","버전7","버전8","버전9","버전10"]`;
  const raw = await callAI(s, sys, user, 2000, 0.8, true, onStream);
  return safeParseJSON<string[]>(raw);
}

export async function transformAuthorStyle(
  s: Settings, text: string, author: string,
): Promise<string> {
  const sys = `너는 ${author}의 문체를 완벽하게 구현하는 작가다. 주어진 내용을 ${author}의 고유한 문체로 변환한다. 변환된 텍스트만 출력하라. 마크다운, 설명, 코드블록 금지.`;
  return callAI(s, sys, `원문:\n${text}`, 1000, 0.7, false);
}

export async function generateMissions(
  s: Settings, db: DB,
): Promise<Omit<Mission, 'id' | 'completed' | 'createdAt'>[]> {
  const weakTop = Object.entries(db.weaknesses).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const senseBot = Object.entries(db.senses).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => k);
  const structTop = Object.entries(db.structures).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const analyzed = db.writings.filter(w => w.analysis);
  const avgScore = analyzed.length
    ? Math.round(analyzed.reduce((acc, w) => acc + w.analysis!.score, 0) / analyzed.length)
    : 0;

  const sys = '너는 글쓰기 코치다. 사용자 데이터를 분석해 맞춤 훈련 과제 3개를 생성하라. JSON 배열만 반환. 설명 없이.';
  const user = `데이터:
- 평균점수: ${avgScore}
- 주요 약점: ${weakTop.join(', ') || '없음'}
- 부족한 감각표현: ${senseBot.join(', ') || '없음'}
- 자주 쓰는 구조: ${structTop.join(', ') || '없음'}
- 총 글 수: ${db.writings.length}

응답 형식(JSON 배열만, 설명 없이):
[{"title":"과제명","description":"훈련 방법 설명 (따뜻한 말투)","type":"writing"},{"title":"과제명","description":"...","type":"expression"},{"title":"과제명","description":"...","type":"sense"}]
type은 writing/expression/structure/sense/copy 중 하나`;
  const raw = await callAI(s, sys, user, 1500, 0.5, true);
  const parsed = safeParseJSON<unknown>(raw);
  // OpenAI JSON 모드는 배열을 {"missions":[...]} 형태 객체로 감쌀 수 있음
  const arr = Array.isArray(parsed)
    ? parsed
    : (Object.values(parsed as Record<string, unknown>).find(v => Array.isArray(v)) as Omit<Mission, 'id' | 'completed' | 'createdAt'>[] | undefined);
  if (!arr?.length) throw new Error('과제 생성 결과가 올바르지 않아요. 다시 시도해주세요.');
  return arr;
}

export async function evaluateMission(
  s: Settings, mission: Mission, submission: string,
  onStream?: (chunk: string) => void,
): Promise<MissionEvaluation> {
  const sys = '너는 글쓰기 코치다. 훈련 과제에 대한 제출작을 평가한다. 엄격하되 따뜻하게. JSON 형식으로만 응답하라.';
  const user = `과제 제목: ${mission.title}
과제 내용: ${mission.description}
제출 글:
${submission}

응답 형식(JSON 객체만, 설명 없이):
{"score":0,"passed":true,"feedback":"종합 피드백 2-3문장 (제안형, 따뜻하게)","strengths":["잘 달성한 점 키워드"],"improvements":["더 발전시킬 점 키워드"]}
score 0-100 / passed는 score >= 60 이면 true`;
  const raw = await callAI(s, sys, user, 1500, 0.3, true, onStream);
  return safeParseJSON<MissionEvaluation>(raw);
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
