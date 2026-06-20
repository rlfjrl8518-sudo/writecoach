'use client';
import { useState, useEffect } from 'react';
import { loadDB, saveDB, loadSettings, getTopEntries, type Mission, type MissionEvaluation, type DB } from '@/lib/db';
import { generateMissions, evaluateMission } from '@/lib/openai';

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
          fontSize: 8,
          color: ev.passed ? 'var(--good)' : 'var(--bad)',
          padding: '3px 8px',
          border: `1px solid ${ev.passed ? 'var(--good-border)' : 'var(--bad-border)'}`,
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
              <span key={i} style={{
                display: 'inline-block',
                fontSize: 12, color: 'var(--good)',
                padding: '3px 10px', borderRadius: 6,
                background: 'var(--good-dim)',
                border: '1px solid var(--good-border)',
                fontFamily: 'Pretendard, sans-serif', fontWeight: 500,
              }}>{s}</span>
            ))}
          </div>
        </div>
      )}
      {ev.improvements.length > 0 && (
        <div>
          <span style={{ fontSize: 12, color: 'var(--moon)', fontFamily: 'Pretendard, sans-serif', fontWeight: 600, display: 'block', marginBottom: 6 }}>발전시킬 점</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {ev.improvements.map((s, i) => (
              <span key={i} style={{
                display: 'inline-block',
                fontSize: 12, color: 'var(--moon)',
                padding: '3px 10px', borderRadius: 6,
                background: 'var(--moon-dim)',
                border: '1px solid rgba(255,159,10,0.35)',
                fontFamily: 'Pretendard, sans-serif', fontWeight: 500,
              }}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MissionCard({
  m, onToggle, onDelete, onEvaluate,
}: {
  m: Mission;
  onToggle: () => void;
  onDelete: () => void;
  onEvaluate: (id: number, submission: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(m.submission ?? '');
  const [evaluating, setEvaluating] = useState(false);
  const [streamLen, setStreamLen] = useState(0);
  const color = TYPE_COLOR[m.type] || 'var(--accent)';

  async function handleSubmit() {
    if (!text.trim()) return;
    setEvaluating(true);
    setStreamLen(0);
    await onEvaluate(m.id, text.trim());
    setEvaluating(false);
  }

  return (
    <div className={`px-mission-card${m.completed ? ' completed' : ''}`} style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <button
          onClick={onToggle}
          style={{
            width: 20, height: 20, flexShrink: 0, marginTop: 2,
            background: m.completed ? 'var(--good-border)' : 'transparent',
            border: `2px solid ${m.completed ? 'var(--good-border)' : 'var(--card-border)'}`,
            cursor: 'pointer', color: '#001508', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {m.completed ? '✓' : ''}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="pixel-font" style={{ fontSize: 7, color }}>
              {TYPE_LABEL[m.type] || m.type}
            </span>
            <span style={{
              fontSize: 12, fontFamily: 'Pretendard, sans-serif', fontWeight: 600,
              color: m.completed ? 'var(--dim-star)' : 'var(--text)',
              textDecoration: m.completed ? 'line-through' : 'none',
            }}>
              {m.title}
            </span>
            {m.evaluation && (
              <span className="pixel-font" style={{
                fontSize: 7,
                color: m.evaluation.passed ? 'var(--good)' : 'var(--bad)',
                padding: '2px 6px',
                border: `1px solid ${m.evaluation.passed ? 'var(--good-border)' : 'var(--bad-border)'}`,
              }}>
                {m.evaluation.score}pt
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--dim-star)', lineHeight: 1.8, margin: 0, fontFamily: 'Pretendard, sans-serif' }}>
            {m.description}
          </p>
          <div style={{ fontSize: 11, color: 'var(--card-border)', marginTop: 6, fontFamily: 'Pretendard, sans-serif' }}>
            {m.createdAt.slice(0, 10)}
          </div>

          {/* 평가 결과 (이미 있으면 항상 표시) */}
          {m.evaluation && !expanded && (
            <EvalResult ev={m.evaluation} />
          )}

          {/* 제출 패널 */}
          {expanded && (
            <div style={{ marginTop: 14 }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="이 미션에 맞게 작성한 글을 여기에 붙여넣으세요..."
                style={{
                  width: '100%', minHeight: 140, padding: '10px 12px',
                  background: 'var(--bg-input)', border: '1px solid var(--card-border)',
                  color: 'var(--text)', fontSize: 12, lineHeight: 1.8,
                  fontFamily: 'Pretendard, sans-serif', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <button
                  className="px-btn px-btn-accent"
                  onClick={handleSubmit}
                  disabled={evaluating || !text.trim()}
                >
                  {evaluating
                    ? (streamLen > 0 ? `★ ${streamLen}자 평가 중...` : '★ 연결 중...')
                    : '✦ AI 평가 받기'}
                </button>
                <button
                  className="px-btn-ghost-sm"
                  onClick={() => setExpanded(false)}
                >닫기</button>
              </div>
              {m.evaluation && <EvalResult ev={m.evaluation} />}
            </div>
          )}

          {/* 제출하기 버튼 (평가 패널 열기) */}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              style={{
                marginTop: 10, background: 'none', border: 'none',
                cursor: 'pointer', color: color, fontSize: 13,
                fontFamily: 'Pretendard, sans-serif', fontWeight: 600,
                padding: 0, letterSpacing: '-0.01em',
              }}
            >
              {m.evaluation ? '↺ 다시 제출' : '▶ 제출하고 평가 받기'}
            </button>
          )}
        </div>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.5, flexShrink: 0 }}
        >✕</button>
      </div>
    </div>
  );
}

function DataSnapshot({ db }: { db: DB }) {
  const analyzed  = db.writings.filter(w => w.analysis);
  const avgScore  = analyzed.length
    ? Math.round(analyzed.reduce((s, w) => s + w.analysis!.score, 0) / analyzed.length)
    : null;
  const weakTop3  = getTopEntries(db.weaknesses, 3).map(([k]) => k);
  const senseBot2 = Object.entries(db.senses).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => k);
  const structTop2 = getTopEntries(db.structures, 2).map(([k]) => k);

  return (
    <div className="px-card" style={{ marginBottom: 18 }}>
      <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 현재 데이터 요약</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim-star)', marginBottom: 6, letterSpacing: '-0.01em' }}>평균 점수</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: avgScore && avgScore >= 70 ? 'var(--good)' : 'var(--moon)', lineHeight: 1 }}>
            {avgScore ?? '—'}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 2 }}>{avgScore ? '점' : ''}</span>
          </div>
        </div>
        <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--bad)', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim-star)', marginBottom: 6, letterSpacing: '-0.01em' }}>주요 약점</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad)', letterSpacing: '-0.01em' }}>{weakTop3.length ? weakTop3.join(', ') : '없음'}</div>
        </div>
        <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--moon)', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim-star)', marginBottom: 6, letterSpacing: '-0.01em' }}>부족한 감각</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--moon)', letterSpacing: '-0.01em' }}>{senseBot2.length ? senseBot2.join(', ') : '없음'}</div>
        </div>
        <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim-star)', marginBottom: 6, letterSpacing: '-0.01em' }}>자주 쓰는 구조</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.01em' }}>{structTop2.length ? structTop2.join(', ') : '없음'}</div>
        </div>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const [db,      setDb]      = useState<DB | null>(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const [saved,   setSaved]   = useState(false);

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
      const newMissions: Mission[] = raw.map((m, i) => ({
        ...m, id: Date.now() + i, completed: false, createdAt: now,
      }));
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
    const fresh = loadDB();
    const m = fresh.missions.find(m => m.id === id);
    if (m) m.completed = !m.completed;
    saveDB(fresh);
    setSaved(v => !v);
  }

  function deleteMission(id: number) {
    const fresh = loadDB();
    fresh.missions = fresh.missions.filter(m => m.id !== id);
    saveDB(fresh);
    setSaved(v => !v);
  }

  function clearCompleted() {
    if (!confirm('완료된 과제를 모두 삭제할까요?')) return;
    const fresh = loadDB();
    fresh.missions = fresh.missions.filter(m => !m.completed);
    saveDB(fresh);
    setSaved(v => !v);
  }

  if (!db) return null;

  const pending   = db.missions.filter(m => !m.completed);
  const completed = db.missions.filter(m => m.completed);

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>◎ 훈련 과제</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        내 글쓰기 데이터를 분석해 맞춤 훈련 과제를 생성하고, 제출한 글을 AI가 직접 평가해요.
      </p>

      <DataSnapshot db={db} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="px-btn px-btn-accent" onClick={handleGenerate} disabled={loading}>
          {loading ? '★ 생성 중...' : '✦ 과제 3개 생성'}
        </button>
        {completed.length > 0 && (
          <button className="px-btn-ghost-sm" onClick={clearCompleted}>완료 과제 정리</button>
        )}
        <span style={{ fontSize: 11, color: 'var(--dim-star)' }}>
          진행 <span className="pixel-font" style={{ fontSize: 9, color: 'var(--accent)' }}>{pending.length}</span>개 · 완료 <span className="pixel-font" style={{ fontSize: 9, color: 'var(--good)' }}>{completed.length}</span>개
        </span>
      </div>

      {err && (
        <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--bad)', padding: '8px 12px', borderLeft: '2px solid var(--bad-border)', background: 'var(--bad-dim)' }}>
          {err}
        </div>
      )}

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
            {pending.map(m => (
              <MissionCard
                key={m.id} m={m}
                onToggle={() => toggleMission(m.id)}
                onDelete={() => deleteMission(m.id)}
                onEvaluate={handleEvaluate}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && completed.length > 0 && (
        <div>
          <div className="px-divider-dim" style={{ marginBottom: 14 }} />
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--card-border)', marginBottom: 12 }}>✓ 완료된 과제</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completed.map(m => (
              <MissionCard
                key={m.id} m={m}
                onToggle={() => toggleMission(m.id)}
                onDelete={() => deleteMission(m.id)}
                onEvaluate={handleEvaluate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
