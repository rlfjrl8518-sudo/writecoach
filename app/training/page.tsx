'use client';
import { useState, useEffect, useCallback } from 'react';
import { loadDB, saveDB, loadSettings, type Mission, type MissionEvaluation, type DB } from '@/lib/db';
import { generateMissions, evaluateMission, evaluateDrill, type DrillEvaluation } from '@/lib/openai';
import { getWrittenDays, getLevelInfo, toTurtleLevel } from '@/lib/journey';
import TurtleSprite from '@/components/TurtleSprite';
import { confirmDialog } from '@/components/ConfirmDialog';

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
              <span key={i} style={{ fontSize: 12, color: 'var(--moon)', padding: '3px 10px', borderRadius: 6, background: 'var(--moon-dim)', border: '1px solid rgba(138,123,69,0.35)', fontFamily: 'Pretendard, sans-serif', fontWeight: 500 }}>{s}</span>
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
          cursor: 'pointer', color: 'var(--text)', fontSize: 12,
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
  const analyzed  = db.writings.filter(w => w.analysis);
  const avgScore  = analyzed.length
    ? Math.round(analyzed.reduce((s, w) => s + w.analysis!.score, 0) / analyzed.length)
    : null;
  const streak = db.journey?.streak ?? 0;
  const level  = getLevelInfo(getWrittenDays(db.writings));

  const weakSynth   = db.weaknessSynthesis?.length   ? db.weaknessSynthesis   : null;
  const strSynth    = db.strengthSynthesis?.length   ? db.strengthSynthesis   : null;

  // 미합성 상태일 때 원본 상위 표시용
  const liveWeak: Record<string, number> = {};
  analyzed.forEach(w => {
    (w.analysis!.weaknesses || []).forEach(s => {
      const k = s.trim().toLowerCase().replace(/\s+/g, ' ');
      liveWeak[k] = (liveWeak[k] || 0) + 1;
    });
  });
  const weakRaw = Object.entries(liveWeak).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

  const scoreColor = avgScore == null ? 'var(--dim-star)'
    : avgScore >= 70 ? 'var(--good)'
    : avgScore >= 55 ? 'var(--accent)'
    : 'var(--moon)';

  return (
    <div className="px-card" style={{ marginBottom: 18 }}>
      <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 현재 데이터 요약</div>

      {/* 현황 칩 행 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: '작성 글',   value: `${db.writings.length}편`,              color: 'var(--text)' },
          { label: '평균 점수', value: avgScore != null ? `${avgScore}점` : '—', color: scoreColor },
          { label: '스트릭',   value: streak > 0 ? `🔥 ${streak}일 연속` : '오늘 미작성', color: streak > 0 ? 'var(--moon)' : 'var(--dim-star)' },
          { label: '레벨',     value: `Lv.${level.level} ${level.name}`,        color: 'var(--accent)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '8px 14px', background: 'var(--bg-subtle)',
            border: '1px solid var(--card-border)', borderRadius: 10,
            minWidth: 70,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: '-0.01em', fontFamily: 'Pretendard, sans-serif' }}>{value}</span>
            <span style={{ fontSize: 11, color: 'var(--dim-star)', marginTop: 3 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* 약점 / 강점 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* 약점 */}
        <div style={{ padding: '12px 14px', background: 'var(--bad-dim)', borderLeft: '3px solid var(--bad-border)', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bad)', marginBottom: 8 }}>주요 약점</div>
          {weakSynth ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {weakSynth.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, fontFamily: 'Pretendard, sans-serif' }}>
                  · {w.title}
                </div>
              ))}
            </div>
          ) : weakRaw.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {weakRaw.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--dim-star)', lineHeight: 1.6, fontFamily: 'Pretendard, sans-serif' }}>· {w}</div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4, opacity: 0.7 }}>성장 리포트에서 AI 진단을 받으면 더 정확해요</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--dim-star)' }}>글쓰기 분석 후 표시돼요</div>
          )}
        </div>

        {/* 강점 */}
        <div style={{ padding: '12px 14px', background: 'var(--good-dim)', borderLeft: '3px solid var(--good-border)', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--good)', marginBottom: 8 }}>주요 강점</div>
          {strSynth ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {strSynth.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, fontFamily: 'Pretendard, sans-serif' }}>
                  · {s.title}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--dim-star)' }}>성장 리포트에서 AI 강점 진단을 받으면 표시돼요</div>
          )}
        </div>
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
  /** 있으면 텍스트 대신 실제 사진으로 관찰/감각 훈련을 진행 (Picsum seed) */
  imageSeed?: string;
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

/* 핵심 4단계로 압축: 관찰(사실 포착) → 보여주기(감정→장면) → 동사 무덤(동작을 정밀하게)
   → 한 줄 통찰(의미 압축). 전부 실사진 기반 — "다른 사진" 버튼으로 매번 새 소재를 받는다. */
const DRILLS: DrillTypeDef[] = [
  {
    id: 1, name: '관찰 훈련', purpose: '사실과 해석을 구분하는 능력', time: '3-5분', color: 'var(--accent)', accent: 'var(--accent-dim)',
    problems: [
      { scene: '오늘의 관찰 사진', imageSeed: 'wc-obs-1', instruction: '사진을 보고, 보이는 사실만 5개 작성하세요. 해석·감정·추측은 금지입니다.', constraints: ['보인다', '것 같다', '해 보인다', '느껴진다'] },
    ],
  },
  {
    id: 2, name: '보여주기 훈련', purpose: '감정을 직접 말하지 않고 장면으로 전달하는 능력', time: '3-5분', color: 'var(--moon)', accent: 'var(--moon-dim)',
    problems: [
      { scene: '감정: 슬픔', imageSeed: 'wc-show-1', instruction: '사진 속 장면을 활용해, "슬프다/슬픔/우울하다/힘들다/그립다" 없이 슬픔이 느껴지도록 2-4문장으로 쓰세요.', constraints: ['슬프다', '슬픔', '우울하다', '힘들다', '그립다', '눈물'] },
      { scene: '감정: 설렘', imageSeed: 'wc-show-2', instruction: '사진 속 장면을 활용해, "설렌다/두근거린다/기대된다/좋다" 없이 설렘이 느껴지도록 2-4문장으로 쓰세요.', constraints: ['설렌다', '설레다', '두근', '기대된다', '좋다', '행복'] },
      { scene: '감정: 불안', imageSeed: 'wc-show-3', instruction: '사진 속 장면을 활용해, "불안하다/초조하다/걱정되다/긴장된다" 없이 불안이 느껴지도록 2-4문장으로 쓰세요.', constraints: ['불안하다', '불안', '초조하다', '걱정되다', '긴장된다'] },
      { scene: '감정: 그리움', imageSeed: 'wc-show-4', instruction: '사진 속 장면을 활용해, "그립다/보고싶다/그리움" 없이 그리움이 느껴지도록 2-4문장으로 쓰세요.', constraints: ['그립다', '그리움', '보고싶다', '보고 싶다'] },
      { scene: '감정: 외로움', imageSeed: 'wc-show-5', instruction: '사진 속 장면을 활용해, "외롭다/쓸쓸하다/혼자/고독" 없이 외로움이 느껴지도록 2-4문장으로 쓰세요.', constraints: ['외롭다', '외로움', '쓸쓸하다', '혼자', '고독'] },
    ],
  },
  {
    /* 사라 카우프먼 <동사의 힘>(Verb Your Enthusiasm)의 4가지 축을 각각 문제 모드로 구현:
       (A) 죽은 동사 무덤 — 이다/있다/하다/되다류 제거
       (B) 수동태의 책임 회피 — "실수가 있었다"류, 능동태로 주어·책임을 복원
       (C) 동사가 조절하는 읽기 속도 — 같은 장면을 느린 동사/빠른 동사 두 버전으로
       (D) 정지한 사물에 생명 불어넣기 — 무생물에 동작 동사 적용 */
    id: 3, name: '동사의 힘 훈련', purpose: '동사 하나로 장면의 생생함·속도·책임을 조율하는 능력', time: '3-6분', color: 'var(--good)', accent: 'var(--good-dim)',
    problems: [
      { scene: '오늘의 장면 사진', imageSeed: 'wc-verb-1', instruction: '[죽은 동사 무덤] 사진 속 장면을 2-3문장으로 묘사하세요. "이다/있다/하다/되다"와 그 활용형(이었다·있었다·했다·됐다 등)은 무덤에 묻혔습니다 — 더 구체적이고 생생한 동사로 바꿔 쓰세요.', constraints: ['이다', '있다', '없다', '하다', '되다', '이었다', '있었다', '했다', '됐다', '했었다'] },
      { scene: '"그 과정에서 실수가 있었다."', instruction: '[수동태의 책임] 이 문장은 수동태 뒤에 책임질 사람이 숨어 있습니다. 누가 무엇을 했는지 분명히 드러나도록 능동태로 다시 쓰세요.' },
      { scene: '"고객님께 불편을 드려 죄송합니다. 해당 건은 확인 후 조치될 예정입니다."', instruction: '[수동태의 책임] 누가 무슨 잘못을 했고, 누가 무엇을 하겠다는 건지 주어와 행동을 분명히 밝혀 능동태로 다시 쓰세요.' },
      { scene: '"이번 분기 예산이 초과 집행되었다."', instruction: '[수동태의 책임] "되었다" 뒤에 숨은 행위자를 찾아, 누가 예산을 초과해서 썼는지 드러나도록 능동태로 다시 쓰세요.' },
      { scene: '오늘의 장면 사진', imageSeed: 'wc-pace-1', instruction: '[동사와 속도] 사진 속 장면을 두 버전으로 묘사하세요 — (1) 독자가 천천히 읽게 되는 느릿한 동사로 2문장, (2) 독자를 빠르게 몰아가는 동사로 2문장. 같은 장면, 다른 속도여야 합니다.' },
      { scene: '오늘의 장면 사진', imageSeed: 'wc-animate-1', instruction: '[사물에 생명 불어넣기] 사진 속 움직이지 않는 사물 하나를 골라, 마치 살아 움직이는 것처럼 동작 동사로 표현하는 문장을 2-3개 쓰세요. (예: 전선이 벽을 타고 달린다, 그림자가 바닥에 드리워진다)' },
    ],
  },
  {
    id: 4, name: '한 줄 통찰 훈련', purpose: '평범한 장면에서 의미를 발견해 한 줄로 압축하는 능력', time: '5분', color: 'var(--secondary)', accent: 'var(--good-dim)',
    problems: [
      { scene: '오늘의 장면 사진', imageSeed: 'wc-line-1', instruction: '사진 속 장면을 보고, 그 안에 담긴 의미나 이야기를 한 줄의 카피로 압축하세요. 설명하지 말고, 여운이 남도록 짧게 쓰세요 (20자 내외 권장).' },
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
          <span key={i} style={{ fontSize: 12, color: 'var(--moon)', padding: '4px 10px', borderRadius: 6, background: 'var(--moon-dim)', border: '1px solid rgba(138,123,69,0.35)' }}>{s}</span>
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
  const [imgSeedOverride, setImgSeedOverride] = useState<string | null>(null);

  const prob = drill.problems[probIdx];
  const imgSeed = imgSeedOverride ?? prob.imageSeed;

  useEffect(() => { setImgSeedOverride(null); }, [probIdx]);
  function shuffleImage() { setImgSeedOverride('wc-' + Math.random().toString(36).slice(2, 10)); }

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
        imgSeed ? `https://picsum.photos/seed/${imgSeed}/640/400` : undefined,
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
    // 문제가 하나뿐인 드릴(관찰/동사무덤/한줄통찰)은 probIdx가 안 바뀌므로 사진을 직접 새로 뽑아준다.
    // 문제가 여러 개인 드릴(보여주기)은 probIdx 변경 useEffect가 곧바로 새 문제의 기본 사진으로 되돌린다.
    if (prob.imageSeed) setImgSeedOverride('wc-' + Math.random().toString(36).slice(2, 10));
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
        {imgSeed ? (
          <div style={{ position: 'relative' }}>
            <img
              key={imgSeed}
              src={`https://picsum.photos/seed/${imgSeed}/640/400`}
              alt={prob.scene}
              loading="lazy"
              style={{
                width: '100%', aspectRatio: '16 / 10', objectFit: 'cover',
                borderRadius: 8, border: `1px solid ${drill.color}44`,
                background: 'var(--bg-subtle)', display: 'block',
              }}
            />
            {phase === 'write' && (
              <button
                onClick={shuffleImage}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  background: 'rgba(0,0,0,0.55)', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                }}
              >
                ↻ 다른 사진
              </button>
            )}
          </div>
        ) : (
          <div style={{ padding: '14px 16px', background: 'var(--bg-card)', border: `1px solid ${drill.color}44`, borderRadius: 8, fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.7 }}>
            {prob.scene}
          </div>
        )}
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
                {drill.problems.length > 1 && <button className="px-btn-ghost-sm" onClick={nextProblem}>다른 문제</button>}
              </>
            )}
            {phase === 'result' && (
              <>
                <button className="px-btn-ghost-sm" onClick={retry}>↺ 다시 도전</button>
                <button className="px-btn-ghost-sm" onClick={nextProblem}>{drill.problems.length > 1 ? '다음 문제 →' : '↻ 새 사진으로'}</button>
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
        실제 사진을 보고 쓰는 4가지 핵심 훈련 — 관찰 → 보여주기 → 동사의 힘 → 한 줄 통찰. 3~6분씩 매일 반복해 문장력을 키워요.
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
    const fresh = loadDB();
    fresh.missions = fresh.missions.filter(m => m.id !== id);
    fresh._deletedIds = [...(fresh._deletedIds ?? []), id];
    saveDB(fresh); setSaved(v => !v);
  }
  async function clearCompleted() {
    if (!await confirmDialog('완료된 과제를 모두 삭제할까요?', { danger: true, confirmLabel: '삭제' })) return;
    const fresh = loadDB();
    const removedIds = fresh.missions.filter(m => m.completed).map(m => m.id);
    fresh.missions = fresh.missions.filter(m => !m.completed);
    fresh._deletedIds = [...(fresh._deletedIds ?? []), ...removedIds];
    saveDB(fresh); setSaved(v => !v);
  }

  const handleDrillSelect = useCallback((id: number) => {
    setActiveDrillId(prev => prev === id ? null : id);
  }, []);

  if (!db) return null;

  const pending   = db.missions.filter(m => !m.completed);
  const completed = db.missions.filter(m => m.completed);

  const currentLevel = toTurtleLevel(getLevelInfo(getWrittenDays(db.writings)).level);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <TurtleSprite level={currentLevel} emotion="motivated" size={48} />
        <div className="px-sec-title" style={{ marginBottom: 0, border: 'none', padding: 0, flex: 1 }}>◎ 훈련</div>
      </div>

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
