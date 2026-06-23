'use client';
import { useState, useEffect, useCallback } from 'react';
import { loadDB, saveDB, loadSettings, type Mission, type MissionEvaluation, type DB } from '@/lib/db';
import { generateMissions, evaluateMission, evaluateDrill, type DrillEvaluation } from '@/lib/openai';

/* ── 공통 로더 ── */
function StarLoader({ label }: { label: string }) {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(n => (n + 1) % 3), 500); return () => clearInterval(t); }, []);
  return (
    <div className="star-loader">
      <div className="pixel-font" style={{ fontSize: 16, color: 'var(--moon)', letterSpacing: 8 }}>
        {['★ ☆ ☆', '★ ★ ☆', '★ ★ ★'][f]}
      </div>
      <span className="star-loader-text">{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION A — 기존 AI 맞춤 과제
══════════════════════════════════════════════════════════ */

const TYPE_COLOR: Record<string, string> = {
  writing: 'var(--accent)', expression: 'var(--moon)', structure: 'var(--good)',
  sense: 'var(--dim-star)', copy: 'var(--bad)',
};
const TYPE_LABEL: Record<string, string> = {
  writing: '글쓰기', expression: '표현', structure: '구조', sense: '감각', copy: '카피',
};

function EvalResult({ ev }: { ev: MissionEvaluation }) {
  return (
    <div style={{
      marginTop: 14, padding: '14px 16px',
      background: ev.passed ? 'var(--good-dim)' : 'var(--bad-dim)',
      border: `1px solid ${ev.passed ? 'var(--good-border)' : 'var(--bad-border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="pixel-font" style={{
          fontSize: 8, color: ev.passed ? 'var(--good)' : 'var(--bad)',
          padding: '3px 8px', border: `1px solid ${ev.passed ? 'var(--good-border)' : 'var(--bad-border)'}`,
        }}>
          {ev.passed ? '✓ 합격' : '✕ 재도전'}
        </span>
        <span className="pixel-font" style={{ fontSize: 14, color: ev.passed ? 'var(--good)' : 'var(--moon)' }}>
          {ev.score}pt
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, margin: '0 0 10px', fontFamily: 'Pretendard, sans-serif' }}>
        {ev.feedback}
      </p>
      {ev.strengths.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--good)', fontFamily: 'Pretendard, sans-serif', fontWeight: 600, display: 'block', marginBottom: 6 }}>잘된 점</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {ev.strengths.map((s, i) => (
              <span key={i} style={{ fontSize: 12, color: 'var(--good)', padding: '3px 10px', borderRadius: 6, background: 'var(--good-dim)', border: '1px solid var(--good-border)', fontFamily: 'Pretendard, sans-serif', fontWeight: 500 }}>{s}</span>
            ))}
          </div>
        </div>
      )}
      {ev.improvements.length > 0 && (
        <div>
          <span style={{ fontSize: 12, color: 'var(--moon)', fontFamily: 'Pretendard, sans-serif', fontWeight: 600, display: 'block', marginBottom: 6 }}>발전시킬 점</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {ev.improvements.map((s, i) => (
              <span key={i} style={{ fontSize: 12, color: 'var(--moon)', padding: '3px 10px', borderRadius: 6, background: 'var(--moon-dim)', border: '1px solid rgba(255,159,10,0.35)', fontFamily: 'Pretendard, sans-serif', fontWeight: 500 }}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MissionCard({ m, onToggle, onDelete, onEvaluate }: {
  m: Mission; onToggle: () => void; onDelete: () => void;
  onEvaluate: (id: number, submission: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(m.submission ?? '');
  const [evaluating, setEvaluating] = useState(false);
  const color = TYPE_COLOR[m.type] || 'var(--accent)';

  async function handleSubmit() {
    if (!text.trim()) return;
    setEvaluating(true);
    await onEvaluate(m.id, text.trim());
    setEvaluating(false);
  }

  return (
    <div className={`px-mission-card${m.completed ? ' completed' : ''}`} style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <button onClick={onToggle} style={{
          width: 20, height: 20, flexShrink: 0, marginTop: 2,
          background: m.completed ? 'var(--good-border)' : 'transparent',
          border: `2px solid ${m.completed ? 'var(--good-border)' : 'var(--card-border)'}`,
          cursor: 'pointer', color: '#001508', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {m.completed ? '✓' : ''}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="pixel-font" style={{ fontSize: 7, color }}>{TYPE_LABEL[m.type] || m.type}</span>
            <span style={{ fontSize: 12, fontFamily: 'Pretendard, sans-serif', fontWeight: 600, color: m.completed ? 'var(--dim-star)' : 'var(--text)', textDecoration: m.completed ? 'line-through' : 'none' }}>
              {m.title}
            </span>
            {m.evaluation && (
              <span className="pixel-font" style={{ fontSize: 7, color: m.evaluation.passed ? 'var(--good)' : 'var(--bad)', padding: '2px 6px', border: `1px solid ${m.evaluation.passed ? 'var(--good-border)' : 'var(--bad-border)'}` }}>
                {m.evaluation.score}pt
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--dim-star)', lineHeight: 1.8, margin: 0, fontFamily: 'Pretendard, sans-serif' }}>{m.description}</p>
          <div style={{ fontSize: 11, color: 'var(--card-border)', marginTop: 6, fontFamily: 'Pretendard, sans-serif' }}>{m.createdAt.slice(0, 10)}</div>
          {m.evaluation && !expanded && <EvalResult ev={m.evaluation} />}
          {expanded && (
            <div style={{ marginTop: 14 }}>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder="이 미션에 맞게 작성한 글을 여기에 붙여넣으세요..."
                style={{ width: '100%', minHeight: 140, padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--card-border)', color: 'var(--text)', fontSize: 12, lineHeight: 1.8, fontFamily: 'Pretendard, sans-serif', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <button className="px-btn px-btn-accent" onClick={handleSubmit} disabled={evaluating || !text.trim()}>
                  {evaluating ? '★ 평가 중...' : '✦ AI 평가 받기'}
                </button>
                <button className="px-btn-ghost-sm" onClick={() => setExpanded(false)}>닫기</button>
              </div>
              {m.evaluation && <EvalResult ev={m.evaluation} />}
            </div>
          )}
          {!expanded && (
            <button onClick={() => setExpanded(true)} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 13, fontFamily: 'Pretendard, sans-serif', fontWeight: 600, padding: 0, letterSpacing: '-0.01em' }}>
              {m.evaluation ? '↺ 다시 제출' : '▶ 제출하고 평가 받기'}
            </button>
          )}
        </div>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.5, flexShrink: 0 }}>✕</button>
      </div>
    </div>
  );
}

function DataSnapshot({ db }: { db: DB }) {
  const analyzed = db.writings.filter(w => w.analysis);
  const avgScore = analyzed.length ? Math.round(analyzed.reduce((s, w) => s + w.analysis!.score, 0) / analyzed.length) : null;
  const liveWeak: Record<string, number> = {};
  analyzed.forEach(w => {
    (w.analysis!.weaknesses || []).forEach(s => { const k = s.trim().toLowerCase().replace(/\s+/g, ' '); liveWeak[k] = (liveWeak[k] || 0) + 1; });
  });
  const weakTop3 = Object.entries(liveWeak).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const weakSynthTitles = (db.weaknessSynthesis || []).map(w => w.title);
  const weakDisplay = weakSynthTitles.length ? weakSynthTitles.join('\n') : (weakTop3.length ? weakTop3.join('\n') : '없음');

  // 문장 역할 상위 2개
  const roleTop2 = Object.entries(db.sentenceRoles || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  // 표현 유형 상위 2개
  const exprTop2 = Object.entries(db.sentenceExpressionTypes || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);

  return (
    <div className="px-card" style={{ marginBottom: 18 }}>
      <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 현재 데이터 요약</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {[
          { label: '평균 점수',    value: avgScore ? `${avgScore}점` : '—',                               color: avgScore && avgScore >= 70 ? 'var(--good)' : 'var(--moon)', border: 'var(--accent)' },
          { label: '주요 약점',    value: weakDisplay,                                                    color: 'var(--bad)',       border: 'var(--bad)' },
          { label: '주로 쓰는 역할', value: roleTop2.length ? roleTop2.join(', ') : '없음',              color: 'var(--good)',      border: 'var(--good)' },
          { label: '주로 쓰는 표현', value: exprTop2.length ? exprTop2.join(', ') : '없음',              color: 'var(--accent)',    border: 'var(--accent)' },
        ].map(({ label, value, color, border }) => (
          <div key={label} style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderLeft: `3px solid ${border}`, borderRadius: '0 8px 8px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim-star)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: '-0.01em', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION B — 글쓰기 도장
══════════════════════════════════════════════════════════ */

interface DrillProblem {
  scene: string;
  instruction: string;
  constraints?: string[];
}
interface DrillTypeDef {
  id: number;
  name: string;
  purpose: string;
  time: string;
  color: string;
  accent: string;
  problems: DrillProblem[];
}

const DRILLS: DrillTypeDef[] = [
  {
    id: 1, name: '관찰 훈련', purpose: '사실과 해석을 구분하는 능력', time: '3-5분', color: 'var(--accent)', accent: 'var(--accent-dim)',
    problems: [
      { scene: '비 오는 버스 정류장', instruction: '보이는 사실만 5개 작성하세요. 해석·감정·추측은 금지입니다.', constraints: ['외로워 보인다', '기다리는 것 같다', '쓸쓸하다', '누군가를'] },
      { scene: '새벽 3시 편의점 내부', instruction: '보이는 사실만 5개 작성하세요. 해석·감정·추측은 금지입니다.', constraints: ['피곤해 보인다', '힘들어 보인다', '~인 것 같다'] },
      { scene: '일요일 오후 공원 벤치', instruction: '보이는 사실만 5개 작성하세요. 해석·감정·추측은 금지입니다.', constraints: ['쓸쓸해 보인다', '행복해 보인다', '~것 같다'] },
    ],
  },
  {
    id: 2, name: '감각 묘사 훈련', purpose: '오감을 활용한 묘사 능력', time: '3-5분', color: 'var(--moon)', accent: 'var(--moon-dim)',
    problems: [
      { scene: '새벽 5시 전통시장', instruction: '시각 표현 금지. 청각만으로 이 장면을 묘사하세요.', constraints: ['보인다', '보이다', '빛난다', '색', '형태', '모습'] },
      { scene: '겨울 목욕탕 탈의실', instruction: '시각 표현 금지. 후각과 촉각만으로 묘사하세요.', constraints: ['보인다', '보이다', '색깔', '빛', '눈에'] },
      { scene: '비 오는 일요일 오후 집 안', instruction: '시각 표현 금지. 청각과 촉각만으로 묘사하세요.', constraints: ['보인다', '보이다', '보여', '빛', '색'] },
    ],
  },
  {
    id: 3, name: '문장 확장 훈련', purpose: '단순 문장을 구체적 장면으로 발전시키는 능력', time: '3-5분', color: 'var(--good)', accent: 'var(--good-dim)',
    problems: [
      { scene: '"비가 온다."', instruction: '이 문장을 구체적인 장면이 보이도록 1-3문장으로 확장하세요. 감각 묘사를 포함하세요.' },
      { scene: '"사람들이 웃는다."', instruction: '이 문장을 구체적인 장면이 보이도록 1-3문장으로 확장하세요. 어디서, 어떻게, 누가를 담으세요.' },
      { scene: '"그는 집으로 돌아왔다."', instruction: '이 문장을 구체적인 장면이 보이도록 1-3문장으로 확장하세요. 감각과 감정을 간접적으로 담으세요.' },
    ],
  },
  {
    id: 4, name: '문장 압축 훈련', purpose: '불필요한 설명을 제거하고 핵심만 남기는 능력', time: '3-5분', color: '#7c6aff', accent: 'rgba(124,106,255,0.1)',
    problems: [
      { scene: '"그는 오늘 하루 종일 상사에게 혼나 기분이 좋지 않은 상태로 집에 돌아왔다."', instruction: '20자 이하로 압축하세요. 핵심 의미와 여운을 유지하세요.' },
      { scene: '"오랜만에 고향에 가보니 어릴 때 많이 놀던 골목길이 아파트 단지로 바뀌어 있었다."', instruction: '20자 이하로 압축하세요. 감정을 직접 말하지 않고 상황으로만 표현하세요.' },
      { scene: '"매일 아침 습관처럼 켜던 라디오에서 더 이상 좋아하던 프로그램이 방송되지 않는다는 것을 알게 되었다."', instruction: '20자 이하로 압축하세요. 여운이 남도록 압축하세요.' },
    ],
  },
  {
    id: 5, name: '보여주기 훈련', purpose: '감정을 직접 표현하지 않고 전달하는 능력', time: '5-7분', color: 'var(--bad)', accent: 'var(--bad-dim)',
    problems: [
      { scene: '감정: 슬픔', instruction: '"슬프다", "우울하다", "힘들다", "그립다" 사용 금지. 이 감정을 장면·행동·사물로만 표현하세요.', constraints: ['슬프다', '슬픔', '우울하다', '힘들다', '그립다', '눈물'] },
      { scene: '감정: 설렘', instruction: '"설렌다", "두근거린다", "기대된다", "좋다" 사용 금지. 장면·행동·사물로만 표현하세요.', constraints: ['설렌다', '설레다', '두근', '기대된다', '좋다', '행복'] },
      { scene: '감정: 외로움', instruction: '"외롭다", "쓸쓸하다", "혼자", "고독" 사용 금지. 장면·행동·사물로만 표현하세요.', constraints: ['외롭다', '외로움', '쓸쓸하다', '혼자', '고독'] },
    ],
  },
  {
    id: 6, name: '일본식 카피 훈련', purpose: '일상 장면을 통찰 있는 한 줄 카피로 전환하는 능력', time: '5분', color: 'var(--moon)', accent: 'var(--moon-dim)',
    problems: [
      { scene: '퇴근 후 빈 지하철', instruction: '이 장면을 한 줄 카피로 작성하세요. 관찰형/공감형/통찰형/감성형 중 하나로.' },
      { scene: '비 오는 일요일 오후', instruction: '이 장면을 한 줄 카피로 작성하세요. 일상에서 의미를 발견하는 시선으로.' },
      { scene: '첫눈 오는 날 아침 지하철 플랫폼', instruction: '이 장면을 한 줄 카피로 작성하세요. 여운이 남도록.' },
    ],
  },
  {
    id: 7, name: '관찰 → 의미 발견', purpose: '일상 속에서 통찰을 발견하는 능력', time: '5분', color: 'var(--accent)', accent: 'var(--accent-dim)',
    problems: [
      { scene: '아버지가 돋보기를 찾고 있다.', instruction: '이 장면이 의미하는 바를 한 문장으로 작성하세요. 시간·관계·변화를 담으세요.' },
      { scene: '할머니가 아무도 없는데 밥을 많이 지었다.', instruction: '이 장면이 의미하는 바를 한 문장으로 작성하세요.' },
      { scene: '오래된 쇼핑몰 빈 가게에 임대 문의 전화번호가 붙어 있다.', instruction: '이 장면이 의미하는 바를 한 문장으로 작성하세요. 감정을 직접 말하지 말고.' },
    ],
  },
  {
    id: 8, name: '카피 리라이팅', purpose: '평범한 문장을 인상적인 문장으로 바꾸는 능력', time: '5분', color: '#7c6aff', accent: 'rgba(124,106,255,0.1)',
    problems: [
      { scene: '"암보험 준비하세요."', instruction: '이 카피를 더 인상적으로 다시 써보세요. 직접적인 광고 문구보다 공감이나 통찰로 접근하세요.' },
      { scene: '"우리 제품은 품질이 좋습니다."', instruction: '이 카피를 더 인상적으로 다시 써보세요. 구체적인 장면이나 경험으로 표현하세요.' },
      { scene: '"건강을 위해 운동하세요."', instruction: '이 카피를 더 인상적으로 다시 써보세요. 직접 설명 대신 감정·상황으로 접근하세요.' },
    ],
  },
  {
    id: 9, name: '카피 해부 훈련', purpose: '좋은 문장의 구조와 의미를 분석하는 능력', time: '7-10분', color: 'var(--good)', accent: 'var(--good-dim)',
    problems: [
      { scene: '"컵은 두 개였다."', instruction: `아래 4가지를 각각 작성하세요:\n1. 보이는 사실 (이 문장이 서술하는 것)\n2. 생략된 정보 (말하지 않지만 느껴지는 것)\n3. 숨겨진 감정 (키워드 1-2개)\n4. 왜 인상적인가 (1문장)` },
      { scene: '"가로등이 꺼지기 전에 집에 도착하고 싶었다."', instruction: `아래 4가지를 각각 작성하세요:\n1. 보이는 사실\n2. 생략된 정보\n3. 숨겨진 감정\n4. 왜 인상적인가` },
      { scene: '"그 문자는 3년 뒤에 읽었다."', instruction: `아래 4가지를 각각 작성하세요:\n1. 보이는 사실\n2. 생략된 정보\n3. 숨겨진 감정\n4. 왜 인상적인가` },
    ],
  },
];

/* ── 점수 바 ── */
function DrillBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const col = pct >= 70 ? 'var(--good)' : pct >= 45 ? 'var(--moon)' : 'var(--bad)';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--dim-star)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{value}{max === 100 ? '%' : '/10'}</span>
      </div>
      <div className="px-bar-wrap-thin">
        <div className={pct >= 70 ? 'px-bar-fill' : pct >= 45 ? 'px-bar-fill-moon' : 'px-bar-fill-bad'} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── 드릴 결과 ── */
function DrillResult({ result }: { result: DrillEvaluation }) {
  const { scores } = result;
  return (
    <div className="animate-fade-in" style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 10 }}>✦ 분석 결과</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
          <DrillBar label="관찰력" value={scores.관찰력} />
          <DrillBar label="구체성" value={scores.구체성} />
          <DrillBar label="표현 다양성" value={scores.표현다양성} />
          <DrillBar label="감정 전달력" value={scores.감정전달력} />
          <DrillBar label="문장 밀도" value={scores.문장밀도} />
          <DrillBar label="독창성" value={scores.독창성} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <DrillBar label="추상어 비율" value={scores.추상어비율} max={100} />
          <DrillBar label="감각 표현 비율" value={scores.감각표현비율} max={100} />
        </div>
      </div>

      {result.feedback && (
        <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--accent)', borderRadius: '0 6px 6px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.9, margin: 0 }}>{result.feedback}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {result.strengths.map((s, i) => (
          <span key={i} style={{ fontSize: 12, color: 'var(--good)', padding: '4px 10px', borderRadius: 6, background: 'var(--good-dim)', border: '1px solid var(--good-border)' }}>{s}</span>
        ))}
        {result.improvements.map((s, i) => (
          <span key={i} style={{ fontSize: 12, color: 'var(--moon)', padding: '4px 10px', borderRadius: 6, background: 'var(--moon-dim)', border: '1px solid rgba(255,159,10,0.35)' }}>{s}</span>
        ))}
      </div>

      {result.modelAnswer && (
        <div style={{ marginBottom: 12 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--moon)', marginBottom: 6 }}>✦ 모범답안</div>
          <div style={{ padding: '12px 14px', background: 'var(--moon-dim)', borderLeft: '3px solid var(--moon)', borderRadius: '0 6px 6px 0', fontSize: 13, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
            {result.modelAnswer}
          </div>
        </div>
      )}
      {result.explanation && (
        <div>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginBottom: 6 }}>✦ 해설</div>
          <p style={{ fontSize: 12, color: 'var(--dim-star)', lineHeight: 1.9, margin: 0 }}>{result.explanation}</p>
        </div>
      )}
    </div>
  );
}

/* ── 드릴 세션 (활성 훈련) ── */
function DrillSession({ drill, onClose }: { drill: DrillTypeDef; onClose: () => void }) {
  const [probIdx, setProbIdx] = useState(() => Math.floor(Math.random() * drill.problems.length));
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<'write' | 'evaluating' | 'result'>('write');
  const [result, setResult] = useState<DrillEvaluation | null>(null);
  const [err, setErr] = useState('');
  const [streamLen, setStreamLen] = useState(0);

  const prob = drill.problems[probIdx];

  async function handleEvaluate() {
    if (!answer.trim()) return;
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    setPhase('evaluating'); setErr(''); setStreamLen(0);
    try {
      const ev = await evaluateDrill(
        s, drill.name, drill.purpose, prob.scene, prob.instruction, prob.constraints || [], answer.trim(),
        (chunk) => setStreamLen(l => l + chunk.length),
      );
      setResult(ev);
      setPhase('result');
    } catch (e: unknown) {
      setErr('평가 오류: ' + (e instanceof Error ? e.message : String(e)));
      setPhase('write');
    }
  }

  function nextProblem() {
    setProbIdx(i => (i + 1) % drill.problems.length);
    setAnswer(''); setResult(null); setPhase('write'); setErr('');
  }

  function retry() {
    setAnswer(''); setResult(null); setPhase('write'); setErr('');
  }

  return (
    <div style={{ marginTop: 12, padding: '20px', background: 'var(--bg-subtle)', border: `1px solid ${drill.color}44`, borderRadius: 10 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: drill.color }}>{drill.name}</span>
          <span style={{ fontSize: 11, color: 'var(--dim-star)', marginLeft: 10 }}>{drill.purpose}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 16 }}>✕</button>
      </div>

      {/* 문제 */}
      <div style={{ marginBottom: 16 }}>
        <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginBottom: 8 }}>✦ 상황 / 장면</div>
        <div style={{ padding: '14px 16px', background: 'var(--bg-card)', border: `1px solid ${drill.color}44`, borderRadius: 8, fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.7 }}>
          {prob.scene}
        </div>
      </div>
      <div style={{ marginBottom: prob.constraints?.length ? 12 : 16 }}>
        <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginBottom: 6 }}>✦ 작성 지시</div>
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{prob.instruction}</p>
      </div>
      {prob.constraints && prob.constraints.length > 0 && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--bad-dim)', border: '1px solid var(--bad-border)', borderRadius: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--bad)', fontWeight: 600, marginRight: 8 }}>✕ 사용 금지:</span>
          {prob.constraints.map((c, i) => (
            <span key={i} style={{ fontSize: 11, color: 'var(--bad)', marginRight: 8 }}>"{c}"</span>
          ))}
        </div>
      )}

      {/* 답변 입력 */}
      {phase !== 'evaluating' && (
        <>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="여기에 작성하세요..."
            disabled={phase === 'result'}
            style={{
              width: '100%', minHeight: 120, padding: '12px 14px',
              background: phase === 'result' ? 'var(--bg-subtle)' : 'var(--bg-input)',
              border: `1px solid ${phase === 'result' ? 'var(--card-border)' : drill.color + '66'}`,
              color: 'var(--text)', fontSize: 13, lineHeight: 1.9,
              fontFamily: 'Pretendard, sans-serif', resize: 'vertical', boxSizing: 'border-box', borderRadius: 6,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {phase === 'write' && (
              <>
                <button className="px-btn px-btn-accent" onClick={handleEvaluate} disabled={!answer.trim()}>✦ AI 평가 받기</button>
                <button className="px-btn-ghost-sm" onClick={nextProblem}>다른 문제</button>
              </>
            )}
            {phase === 'result' && (
              <>
                <button className="px-btn-ghost-sm" onClick={retry}>↺ 다시 도전</button>
                <button className="px-btn-ghost-sm" onClick={nextProblem}>다음 문제 →</button>
              </>
            )}
          </div>
        </>
      )}

      {phase === 'evaluating' && <StarLoader label={streamLen > 0 ? `${streamLen}자 분석 중...` : '평가 중...'} />}
      {err && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--bad)', padding: '8px 12px', background: 'var(--bad-dim)' }}>{err}</div>}
      {phase === 'result' && result && <DrillResult result={result} />}
    </div>
  );
}

/* ── 도장 그리드 ── */
function DrillDojo({ onDrillSelect, activeDrillId }: { onDrillSelect: (id: number) => void; activeDrillId: number | null }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--dim-star)', lineHeight: 1.8, marginBottom: 20 }}>
        관찰력부터 카피 감각까지 — 3~10분 짧은 훈련을 매일 반복해 문장력을 키워요.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {DRILLS.map(d => (
          <button
            key={d.id}
            onClick={() => onDrillSelect(d.id)}
            style={{
              textAlign: 'left', padding: '14px 16px',
              background: activeDrillId === d.id ? d.accent : 'var(--bg-card)',
              border: `1px solid ${activeDrillId === d.id ? d.color : 'var(--card-border)'}`,
              borderLeft: `3px solid ${d.color}`,
              borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: d.color }}>{d.name}</span>
              <span className="pixel-font" style={{ fontSize: 6, color: 'var(--dim-star)' }}>{d.time}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--dim-star)', margin: 0, lineHeight: 1.6 }}>{d.purpose}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   메인 페이지
══════════════════════════════════════════════════════════ */

export default function TrainingPage() {
  const [db,      setDb]      = useState<DB | null>(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const [saved,   setSaved]   = useState(false);
  const [tab,     setTab]     = useState<'missions' | 'dojo'>('missions');
  const [activeDrillId, setActiveDrillId] = useState<number | null>(null);

  useEffect(() => { setDb(loadDB()); }, [saved]);

  async function handleGenerate() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    if (!db) return;
    if (db.writings.length === 0) { setErr('글쓰기 기록이 1편 이상 있어야 과제를 생성할 수 있어요.'); return; }
    setLoading(true); setErr('');
    try {
      const raw = await generateMissions(s, db);
      const now = new Date().toISOString();
      const newMissions: Mission[] = raw.map((m, i) => ({ ...m, id: Date.now() + i, completed: false, createdAt: now }));
      const fresh = loadDB();
      fresh.missions = [...newMissions, ...fresh.missions];
      saveDB(fresh);
      setSaved(v => !v);
    } catch (e: unknown) {
      setErr('오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  async function handleEvaluate(id: number, submission: string) {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    const fresh = loadDB();
    const mission = fresh.missions.find(m => m.id === id);
    if (!mission) return;
    try {
      const ev = await evaluateMission(s, mission, submission);
      mission.submission = submission;
      mission.evaluation = ev;
      if (ev.passed) mission.completed = true;
      saveDB(fresh);
      setSaved(v => !v);
    } catch (e: unknown) {
      setErr('평가 오류: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  function toggleMission(id: number) {
    const fresh = loadDB(); const m = fresh.missions.find(m => m.id === id);
    if (m) m.completed = !m.completed; saveDB(fresh); setSaved(v => !v);
  }
  function deleteMission(id: number) {
    const fresh = loadDB(); fresh.missions = fresh.missions.filter(m => m.id !== id);
    saveDB(fresh); setSaved(v => !v);
  }
  function clearCompleted() {
    if (!confirm('완료된 과제를 모두 삭제할까요?')) return;
    const fresh = loadDB(); fresh.missions = fresh.missions.filter(m => !m.completed);
    saveDB(fresh); setSaved(v => !v);
  }

  const handleDrillSelect = useCallback((id: number) => {
    setActiveDrillId(prev => prev === id ? null : id);
  }, []);

  if (!db) return null;

  const pending   = db.missions.filter(m => !m.completed);
  const completed = db.missions.filter(m => m.completed);

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>◎ 훈련</div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--card-border)', paddingBottom: 0 }}>
        {[
          { key: 'missions' as const, label: 'AI 맞춤 과제' },
          { key: 'dojo'     as const, label: '글쓰기 도장' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', fontSize: 13, fontWeight: tab === key ? 700 : 500,
            color: tab === key ? 'var(--accent)' : 'var(--dim-star)',
            background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', marginBottom: -1, fontFamily: 'Pretendard, sans-serif',
          }}>{label}</button>
        ))}
      </div>

      {/* ── AI 맞춤 과제 탭 ── */}
      {tab === 'missions' && (
        <>
          <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
            내 글쓰기 데이터를 분석해 맞춤 훈련 과제를 생성하고, 제출한 글을 AI가 직접 평가해요.
          </p>
          <DataSnapshot db={db} />
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="px-btn px-btn-accent" onClick={handleGenerate} disabled={loading}>
              {loading ? '★ 생성 중...' : '✦ 과제 3개 생성'}
            </button>
            {completed.length > 0 && <button className="px-btn-ghost-sm" onClick={clearCompleted}>완료 과제 정리</button>}
            <span style={{ fontSize: 11, color: 'var(--dim-star)' }}>
              진행 <span className="pixel-font" style={{ fontSize: 9, color: 'var(--accent)' }}>{pending.length}</span>개 · 완료 <span className="pixel-font" style={{ fontSize: 9, color: 'var(--good)' }}>{completed.length}</span>개
            </span>
          </div>
          {err && <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--bad)', padding: '8px 12px', borderLeft: '2px solid var(--bad-border)', background: 'var(--bad-dim)' }}>{err}</div>}
          {loading && <StarLoader label="데이터를 분석하고 과제를 생성하고 있어요..." />}
          {!loading && db.missions.length === 0 && (
            <div className="px-empty">
              <div className="px-empty-icon">◎</div>
              <p className="px-empty-text">과제 생성 버튼을 눌러<br />맞춤 훈련 과제를 받아보세요</p>
              <p className="px-empty-sub">글쓰기 분석 기록이 많을수록 정확도가 높아요</p>
            </div>
          )}
          {!loading && pending.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 진행 중인 과제</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(m => <MissionCard key={m.id} m={m} onToggle={() => toggleMission(m.id)} onDelete={() => deleteMission(m.id)} onEvaluate={handleEvaluate} />)}
              </div>
            </div>
          )}
          {!loading && completed.length > 0 && (
            <div>
              <div className="px-divider-dim" style={{ marginBottom: 14 }} />
              <div className="pixel-font" style={{ fontSize: 7, color: 'var(--card-border)', marginBottom: 12 }}>✓ 완료된 과제</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {completed.map(m => <MissionCard key={m.id} m={m} onToggle={() => toggleMission(m.id)} onDelete={() => deleteMission(m.id)} onEvaluate={handleEvaluate} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 글쓰기 도장 탭 ── */}
      {tab === 'dojo' && (
        <>
          <DrillDojo onDrillSelect={handleDrillSelect} activeDrillId={activeDrillId} />
          {activeDrillId !== null && (() => {
            const drill = DRILLS.find(d => d.id === activeDrillId);
            return drill ? <DrillSession key={activeDrillId} drill={drill} onClose={() => setActiveDrillId(null)} /> : null;
          })()}
        </>
      )}
    </div>
  );
}
