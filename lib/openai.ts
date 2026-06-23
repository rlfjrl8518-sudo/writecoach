import { jsonrepair } from 'jsonrepair';
import type {
  WritingAnalysis, SentenceAnalysis, CopyAnalysis, RewriteLevels,
  Settings, DB, Mission, MissionEvaluation, SentenceExamples,
  DictResult, ExpressionAnalysis, ExpressionCategory, ExpressionSense, ExpressionLevel, ExpressionUseContext,
} from './db';

/* ── OpenAI 호출 (스트리밍 지원) ── */
async function callOpenAI(
  apiKey: string, model: string, system: string, user: string,
  maxTokens: number, temp: number, jsonMode: boolean,
  onStream?: (chunk: string) => void,
  schema?: object,
): Promise<string> {
  const messages = system
    ? [{ role: 'system', content: system }, { role: 'user', content: user }]
    : [{ role: 'user', content: user }];

  const useStream = !!onStream;
  const body: Record<string, unknown> = {
    model, max_tokens: maxTokens, temperature: temp, messages, stream: useStream,
  };
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

/* ── Gemini 호출 (스트리밍 지원) ── */
async function callGemini(
  apiKey: string, model: string, system: string, user: string,
  maxTokens: number, temp: number, jsonMode: boolean,
  onStream?: (chunk: string) => void,
  schema?: object,
): Promise<string> {
  const generationConfig: Record<string, unknown> = { temperature: temp, maxOutputTokens: maxTokens };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  } else if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }
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
  schema?: object,
): Promise<string> {
  if (s.provider === 'gemini') {
    if (!s.geminiApiKey) throw new Error('설정에서 Gemini API 키를 먼저 입력해주세요.');
    return callGemini(s.geminiApiKey, s.geminiModel, system, user, maxTokens, temp, jsonMode, onStream, schema);
  }
  if (!s.apiKey) throw new Error('설정에서 OpenAI API 키를 먼저 입력해주세요.');
  return callOpenAI(s.apiKey, s.model, system, user, maxTokens, temp, jsonMode, onStream, schema);
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

const WRITING_TYPE_FOCUS: Record<string, string> = {
  '묘사문':
    '【묘사문 평가 포인트】피드백은 다음에 집중하라: 오감 활용 여부(시각 외 감각이 있는가), 장면의 입체감(독자가 눈앞에 그릴 수 있는가), 추상어 남용(\'아름답다/쓸쓸하다\' 대신 구체적 묘사가 있는가). 개선 제안은 "이 문장에서 시각 대신 청각이나 촉각으로 바꿔보면 어떨까요?" 같이 감각 전환 위주로 제안하라.',
  '설명문':
    '【설명문 평가 포인트】피드백은 다음에 집중하라: 정보의 명확성(한 문장에 한 개념인가), 독자 수준 고려(전문용어를 설명 없이 쓰지 않았는가), 흐름(일반→구체 또는 원인→결과 순서가 지켜지는가). 개선 제안은 "이 개념을 예시나 비유로 풀어주면 훨씬 이해하기 쉬울 것 같아요" 위주로 하라.',
  '감상문':
    '【감상문 평가 포인트】피드백은 다음에 집중하라: 감상의 진정성(상투적 감동 표현인가 vs 자기만의 해석인가), 경험-감상 연결(왜 그렇게 느꼈는지 구체적 근거가 있는가), 감정 서술의 구체성(\'감동받았다\' 대신 어떤 장면이 왜 와닿았는지). 개선 제안은 "이 감상에서 어떤 장면이 특히 인상 깊었는지 한 줄 더 써주면 훨씬 깊이 있어 보일 것 같아요" 위주로 하라.',
  '의견문':
    '【의견문 평가 포인트】피드백은 다음에 집중하라: 주장-근거 구조(주장만 있고 근거가 없지는 않은가), 근거의 설득력(구체적 사례·데이터·경험이 있는가), 반론 인식(반대 입장을 언급하고 넘어가는가). 개선 제안은 "이 주장을 뒷받침할 구체적 사례나 수치를 하나 추가해보면 어떨까요?" 위주로 하라.',
  '기사 리드':
    '【기사 리드 평가 포인트】피드백은 다음에 집중하라: 5W1H 완성도(누가/언제/어디서/무엇을/왜/어떻게가 첫 단락에 담겼는가), 첫 문장 후킹력(읽고 싶게 만드는가), 정보 밀도(군더더기 없이 핵심만 담겼는가). 개선 제안은 "첫 문장에 숫자나 구체적 팩트를 넣으면 더 강한 인상을 줄 수 있어요" 위주로 하라.',
  '카피라이팅':
    '【카피라이팅 평가 포인트】피드백은 다음에 집중하라: 첫 줄 후킹(0.3초 안에 멈추게 만드는가), 독자 심리 자극(욕구/두려움/호기심 중 어떤 것을 건드리는가), 행동 유도(읽고 나서 무언가 하고 싶어지는가). 개선 제안은 "\'~하세요\' 대신 \'~하면 어떻게 될지 상상해보세요\' 같은 유도형으로 바꾸면 더 끌릴 것 같아요" 위주로 하라.',
  '에세이':
    '【에세이 평가 포인트】피드백은 다음에 집중하라: 관점의 독창성(누구나 할 법한 말인가 vs 이 사람만의 시각인가), 경험-통찰 연결(구체적 경험이 보편적 통찰로 이어지는가), 문체의 일관성(문어체와 구어체가 뒤섞이지 않는가). 개선 제안은 "이 관찰에서 나만의 해석을 한 문장 덧붙이면 에세이다운 깊이가 생길 것 같아요" 위주로 하라.',
  '스토리텔링':
    '【스토리텔링 평가 포인트】피드백은 다음에 집중하라: 장면 전환의 자연스러움(끊기는 느낌 없이 흐르는가), 긴장감·흡입력(독자가 다음 장면이 궁금해지는가), 인물·감정의 생동감(인물이 살아있는 느낌인가). 개선 제안은 "이 장면에서 인물의 내면 반응을 한 줄 넣으면 독자가 훨씬 몰입하게 될 것 같아요" 위주로 하라.',
};

export async function analyzeWriting(
  s: Settings, type: string, topic: string, text: string,
  onStream?: (chunk: string) => void,
): Promise<WritingAnalysis> {
  const cleanText = text.replace(/\n{3,}/g, '\n\n').trim();
  const typeFocus = WRITING_TYPE_FOCUS[type] ?? '';
  const user = `유형: ${type || '미지정'}\n주제: ${topic || '미지정'}\n본문:\n${cleanText}
${typeFocus ? `\n${typeFocus}\n` : ''}
아래 JSON 형식 그대로 출력 (값만 교체, 모든 값은 큰따옴표 문자열, bad·fixes는 최소 3개씩):
{"breakdown":"7,8,6,7,8","good":"잘된점1|잘된점2","bad":"개선점1|개선점2|개선점3","fixes":"원문→개선문|원문→개선문|원문→개선문","tips":"제안1|제안2|제안3","exprs":"핵심표현1|핵심표현2"}`;

  const raw = await callAI(s, WRITING_SYS, user, 2500, 0.3, true, onStream);
  const r = safeParseJSON<FlatWritingAnalysis>(raw);

  const sp   = (v: string) => (v || '').split('|').map(x => x.trim()).filter(Boolean);
  const nums = (v: string) => ((v || '').match(/\d+/g) ?? []).map(n => Math.min(10, parseInt(n, 10) || 0));

  const bd = nums(r.breakdown);
  while (bd.length < 5) bd.push(0);
  const score = Math.round(bd.reduce((a, b) => a + b, 0) / 50 * 100);

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

interface FlatSentenceAnalysis {
  sentenceRole: string;
  roleDesc: string;
  expressionType: string;
  expressionSense: string;
  expressionEffect: string;
  strengths: string;
  keyExpressions: string;
}

const SENTENCE_SYS = `너는 글쓰기 코치다. JSON 객체만 출력하라. 설명·마크다운 금지.
모든 값은 단순 문자열이다. 배열·중첩 객체 사용 금지.

[sentenceRole] 아래 7개 중 하나:
장면 묘사 / 대상 설명 / 행동 전개 / 감정 표현 / 분위기 형성 / 생각 전달 / 정보 전달

[roleDesc] 이 문장이 해당 역할을 어떻게 수행하는지 2문장 이내 설명

[expressionType] 아래 6개 중 하나:
구체적 표현 / 추상적 표현 / 감각 표현 / 감정 표현 / 비유 표현 / 강조 표현

[expressionSense] expressionType이 "감각 표현"일 때만 아래 중 하나, 아니면 빈 문자열:
시각 / 청각 / 후각 / 미각 / 촉각

[expressionEffect] 이 표현이 독자에게 미치는 효과 (1문장)

[strengths] 이 문장의 강점 (1-2문장, 왜 이 문장이 효과적인가)

[keyExpressions] 핵심 표현 2-4개, 쉼표로 나열`;

export async function analyzeSentence(
  s: Settings, sentence: string, source: string, sentenceType: string,
  _onStream?: (chunk: string) => void,
): Promise<SentenceAnalysis> {
  const user = `출처: ${source || '미지정'}
유형: ${sentenceType || '기타'}
문장: "${sentence}"

아래 JSON 형식 그대로 출력 (값만 교체, 모든 값은 큰따옴표 문자열):
{"sentenceRole":"장면 묘사","roleDesc":"역할 설명","expressionType":"감각 표현","expressionSense":"청각","expressionEffect":"효과 설명","strengths":"강점 설명","keyExpressions":"표현1,표현2"}`;

  const raw = await callAI(s, SENTENCE_SYS, user, 1200, 0.3, true);
  const flat = safeParseJSON<FlatSentenceAnalysis>(raw);

  return {
    sentenceRole:        flat.sentenceRole || '',
    sentenceRoleDesc:    flat.roleDesc || '',
    expressionType:      flat.expressionType || '',
    expressionSense:     flat.expressionSense || '',
    expressionEffect:    flat.expressionEffect || '',
    sentenceStrengths:   flat.strengths || '',
    keyExpressions:      (flat.keyExpressions || '').split(',').map(x => x.trim()).filter(Boolean),
  };
}

export async function generateSentenceExamples(
  s: Settings, sentence: string, role: string,
  onStream?: (chunk: string) => void,
): Promise<SentenceExamples> {
  const sys = '너는 글쓰기 예문 생성 전문가다. 주어진 문장의 역할과 표현 방식을 활용한 예문을 생성한다. JSON 형식으로만 응답하라.';
  const user = `원문: ${sentence}
문장 역할: ${role || '장면 묘사'}

아래 4가지 유형으로 각 5개씩 예문을 생성하라:
응답 형식(JSON 객체만, 설명 없이):
{"sameStructure":["같은 역할의 문장 5개"],"applied":["역할을 변형 응용한 문장 5개"],"copyExamples":["이 역할을 활용한 광고 카피 5개"],"descriptive":["이 역할을 활용한 문학적 묘사문 5개"]}`;
  const raw = await callAI(s, sys, user, 3000, 0.7, true, onStream);
  return safeParseJSON<SentenceExamples>(raw);
}

const COPY_SYS = `너는 카피라이팅 분석 전문가다. JSON 객체만 출력하라. 설명·마크다운 금지.

분석 원칙 (반드시 준수):
- 평가 금지 (좋다·나쁘다 금지)
- 점수 금지. 개선안 금지.
- 업종 가정 금지.
- 오직 객관적 분석만.

[copyType] 반드시 아래 9개 중 하나:
"브랜딩형" | "혜택 전달형" | "문제 제기형" | "위험 환기형" | "감성 공감형" | "행동 유도형" | "신뢰 확보형" | "정보 전달형" | "혼합형"

[expressionFeatures] 해당되는 기법만 배열로:
대조/반복/숫자/질문/명령/비유/스토리텔링/긴급성/희소성/공포/보상/사회적 증거`;

export async function analyzeCopy(
  s: Settings, copy: string, brand: string, source: string,
  _onStream?: (chunk: string) => void,
): Promise<CopyAnalysis> {
  const user = `카피: "${copy}"
브랜드: ${brand || '미지정'}
경로: ${source || '미지정'}

아래 JSON 형식 그대로 출력하라 (값만 교체):
{"copyType":"브랜딩형","mainTarget":"이 카피가 향하는 주요 타겟","persuasionPoints":["자극하는 욕구/심리 1","욕구/심리 2"],"coreMessage":"이 카피가 전달하는 핵심 메시지 한 문장","expressionFeatures":["대조","숫자"],"analysisSummary":"2-3문장 객관적 분석 요약"}`;
  const raw = await callAI(s, COPY_SYS, user, 1200, 0.3, true);
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
  const analyzed = db.writings.filter(w => w.analysis);
  const avgScore = analyzed.length
    ? Math.round(analyzed.reduce((acc, w) => acc + w.analysis!.score, 0) / analyzed.length)
    : 0;

  const liveWeak: Record<string, number> = {};
  analyzed.forEach(w => {
    (w.analysis!.weaknesses || []).forEach(k => { const n = k.trim().toLowerCase().replace(/\s+/g, ' '); liveWeak[n] = (liveWeak[n] || 0) + 1; });
  });
  const weakTop = Object.entries(liveWeak).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

  const sys = '너는 글쓰기 코치다. 사용자 데이터를 분석해 맞춤 훈련 과제 3개를 생성하라. JSON 배열만 반환. 설명 없이.';
  const user = `데이터:
- 평균점수: ${avgScore}
- 주요 약점: ${weakTop.join(', ') || '없음'}
- 총 글 수: ${db.writings.length}

응답 형식(JSON 배열만, 설명 없이):
[{"title":"과제명","description":"훈련 방법 설명 (따뜻한 말투)","type":"writing"},{"title":"과제명","description":"...","type":"expression"},{"title":"과제명","description":"...","type":"writing"}]
type은 writing/expression/copy 중 하나`;
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

/* ── Expression Lab(표현 사전) ── */
const EXPR_CATEGORIES: ExpressionCategory[] = ['평가 표현', '감정 표현', '행동 표현', '상태 표현', '묘사 표현', '시간 표현', '공간 표현', '비유 표현', '설득 표현'];
const EXPR_SENSES: ExpressionSense[] = ['시각', '청각', '후각', '미각', '촉각', '복합 감각'];
const EXPR_LEVELS: ExpressionLevel[] = ['초급', '중급', '고급'];
const EXPR_CONTEXTS: ExpressionUseContext[] = ['묘사문', '설명문', '기사 리드', '에세이', '광고 카피', 'SNS 글'];

export interface ExpressionSuggestion { text: string; reason: string }

const SUGGEST_SYS = `너는 한국어 어휘 큐레이터다. 글을 쓰다가 막힌 사람이 표현하고 싶은 느낌·상황·단어를 입력하면,
그 자리에 바로 쓸 수 있는 실제로 존재하는 자연스러운 한국어 표현(단어 또는 짧은 구) 6-8개를 추천한다.

[원칙]
- 입력이 막연한 느낌·상황 묘사("쓸쓸한 가을 저녁 분위기")면 그 느낌에 어울리는 표현들을 추천한다.
- 입력이 이미 구체적인 표현("빛바랜")이면 같은 결의 유의어·인접 표현들을 폭넓게 추천한다.
- 추천 표현은 서로 다른 결·어감을 보여줘야 한다. 같은 말을 토씨만 바꾼 표현 금지.
- 실제로 쓰이지 않는 억지 조합·신조어는 만들지 않는다.
- 각 표현마다 "왜 이 자리에 어울리는지" 한 줄 이유를 단다.

JSON 객체만 출력 (설명·마크다운 금지):
{"items":"표현1::이유1|표현2::이유2|표현3::이유3|표현4::이유4|표현5::이유5|표현6::이유6"}`;

export async function suggestExpressions(
  s: Settings, query: string,
  onStream?: (chunk: string) => void,
): Promise<ExpressionSuggestion[]> {
  const wordOnly = /단어/.test(query);
  const user = `입력: "${query}"${wordOnly ? '\n사용자가 "단어"를 명시했으니, 여러 단어로 이루어진 구는 제외하고 한 단어로 된 표현만 추천하라.' : ''}`;
  const raw = await callAI(s, SUGGEST_SYS, user, 800, 0.7, true, onStream);
  const r = safeParseJSON<{ items: string }>(raw);
  return (r.items || '').split('|').map(chunk => {
    const [text, ...rest] = chunk.split('::');
    return { text: (text || '').trim(), reason: rest.join('::').trim() };
  }).filter(it => it.text);
}

const EXPRESSION_SYS = `너는 한국어 표현(어휘·구) 학습 콘텐츠를 만드는 전문가다. JSON 객체만 출력하라. 설명·마크다운 금지.
사전 정보가 주어지면 그 의미·품사·예문을 우선 참고하고, 없으면 표현 자체의 형태와 맥락으로 직접 추론하라.

[category] 아래 9개 중 하나만:
${EXPR_CATEGORIES.join(' / ')}

[sense] 아래 6개 중 하나만. 감각과 무관한 표현(예: 설득·논리 표현)이면 빈 문자열:
${EXPR_SENSES.join(' / ')}

[level] 아래 3개 중 하나:
초급(일상에서 흔히 쓰는 표현) / 중급(글쓰기에서 의도적으로 골라 쓰는 표현) / 고급(문학적·전문적이거나 낯선 표현)

[contexts] 이 표현이 잘 어울리는 글 유형을 아래 6개 중 1-3개 골라 "|"로 구분:
${EXPR_CONTEXTS.join(' / ')}

[similar] 의미가 비슷한 대체 표현 3-4개. 사전 유의어가 있으면 우선 활용하고, 없으면 직접 생각해낸다.
[opposite] 의미가 반대되는 표현 2-3개. 자연스러운 반대말이 없으면 빈 문자열로 둔다.
[descEx] 이 표현을 활용한 묘사문 예문 1개 (1-2문장)
[explEx] 이 표현을 활용한 설명문 예문 1개 (1-2문장)
[copyEx] 이 표현을 활용한 광고 카피 예문 1개 (짧고 강하게)
[mission] 이 표현을 직접 사용해보는 짧은 글쓰기 과제 1개. "'표현'을 사용해 [구체적 상황/대상]을 [글자 수]자 내외로 써보세요" 형태로 구체적으로 작성.`;

interface FlatExpressionAnalysis {
  meaning: string; category: string; sense: string; level: string; contexts: string;
  similar: string; opposite: string; descEx: string; explEx: string; copyEx: string; mission: string;
}

export async function analyzeExpression(
  s: Settings, text: string, dict: DictResult | null,
  onStream?: (chunk: string) => void,
): Promise<ExpressionAnalysis> {
  const dictInfo = dict
    ? `뜻: ${dict.meaning || '없음'}\n품사: ${dict.pos || '없음'}\n예문: ${dict.examples.join(' / ') || '없음'}\n유의어: ${dict.synonyms.join(', ') || '없음'}`
    : '사전 검색 결과 없음 — 표현 자체로 직접 추론할 것';
  const user = `표현: "${text}"\n[사전 정보]\n${dictInfo}\n\n아래 JSON 형식 그대로 출력 (값만 교체, 모든 값은 큰따옴표 문자열):\n{"meaning":"쉬운 재해석 문장","category":"묘사 표현","sense":"시각","level":"중급","contexts":"묘사문|에세이","similar":"표현1|표현2|표현3","opposite":"표현1|표현2","descEx":"묘사문 예문","explEx":"설명문 예문","copyEx":"광고 카피 예문","mission":"미션 지시문"}`;

  const raw = await callAI(s, EXPRESSION_SYS, user, 1500, 0.4, true, onStream);
  const r = safeParseJSON<FlatExpressionAnalysis>(raw);
  const sp = (v: string) => (v || '').split('|').map(x => x.trim()).filter(Boolean);

  const category = (EXPR_CATEGORIES as string[]).includes(r.category) ? r.category as ExpressionCategory : '';
  const sense = (EXPR_SENSES as string[]).includes(r.sense) ? r.sense as ExpressionSense : '';
  const level = (EXPR_LEVELS as string[]).includes(r.level) ? r.level as ExpressionLevel : '';
  const useContexts = sp(r.contexts).filter((c): c is ExpressionUseContext => (EXPR_CONTEXTS as string[]).includes(c));

  return {
    easyMeaning: r.meaning || '',
    category, sense, level, useContexts,
    similar: sp(r.similar),
    opposite: sp(r.opposite),
    sampleSentences: { descriptive: r.descEx || '', explanatory: r.explEx || '', copy: r.copyEx || '' },
    mission: r.mission || '',
  };
}

export interface DrillEvaluation {
  scores: { 관찰력: number; 구체성: number; 표현다양성: number; 감정전달력: number; 문장밀도: number; 독창성: number; 추상어비율: number; 감각표현비율: number };
  feedback: string;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
  explanation: string;
}

export async function evaluateDrill(
  s: Settings,
  drillName: string,
  purpose: string,
  scene: string,
  instruction: string,
  constraints: string[],
  answer: string,
  onStream?: (chunk: string) => void,
): Promise<DrillEvaluation> {
  const sys = `너는 글쓰기 트레이너다. 훈련 유형과 목적에 맞게 사용자 답변을 분석한다.
훈련: ${drillName} — ${purpose}
${constraints.length ? `금지 표현 위반 여부 반드시 확인: ${constraints.join(', ')}` : ''}

점수 기준 (각 0-10):
관찰력: 사실을 정확히 포착했는가
구체성: 추상 대신 구체적 장면·사실로 표현했는가
표현다양성: 다양한 표현 방식을 활용했는가
감정전달력: 감정을 직접 말하지 않고 전달했는가
문장밀도: 군더더기 없이 핵심만 담았는가
독창성: 예상을 벗어난 독창적 발상인가
추상어비율: 0-100 (추상적 단어가 전체의 몇%)
감각표현비율: 0-100 (오감을 활용한 표현이 전체의 몇%)

아래 JSON 형식 그대로 출력 (값만 교체, 모든 값은 큰따옴표 문자열):
{"scores":"관찰력:7|구체성:8|표현다양성:6|감정전달력:7|문장밀도:8|독창성:9|추상어비율:30|감각표현비율:60","feedback":"전반적 피드백 2-3문장 (따뜻하고 구체적으로)","strengths":"잘된점1|잘된점2","improvements":"개선점1|개선점2","model":"모범답안 (1-3문장)","why":"왜 좋은 답변인지 핵심 해설 1-2문장"}`;

  const user = `[상황/장면]\n${scene}\n\n[작성 지시]\n${instruction}\n\n[사용자 답변]\n${answer}`;
  const raw = await callAI(s, sys, user, 1200, 0.3, true, onStream);

  const r = safeParseJSON<{ scores: string; feedback: string; strengths: string; improvements: string; model: string; why: string }>(raw);
  const sp = (v: string) => (v || '').split('|').map(x => x.trim()).filter(Boolean);

  const scoreMap: Record<string, number> = { 관찰력: 0, 구체성: 0, 표현다양성: 0, 감정전달력: 0, 문장밀도: 0, 독창성: 0, 추상어비율: 0, 감각표현비율: 0 };
  sp(r.scores).forEach(item => {
    const col = item.indexOf(':');
    if (col !== -1) scoreMap[item.slice(0, col).trim()] = Math.min(100, parseInt(item.slice(col + 1).trim(), 10) || 0);
  });

  return {
    scores: scoreMap as DrillEvaluation['scores'],
    feedback: r.feedback || '',
    strengths: sp(r.strengths),
    improvements: sp(r.improvements),
    modelAnswer: r.model || '',
    explanation: r.why || '',
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
