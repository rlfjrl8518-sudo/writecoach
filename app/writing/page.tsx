'use client';
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  loadDB, saveDB, saveDBLocal, loadSettings, mergeExpressions, mergeWeaknesses, groupByMonth,
  type WritingAnalysis, type WriteType, type WritingEntry,
} from '@/lib/db';
import { analyzeWriting, evaluateAppeal, type AppealResult } from '@/lib/openai';
import { pushData } from '@/lib/supabase';

const TYPES: WriteType[] = ['묘사문', '설명문', '감상문', '의견문', '기사 리드', '카피라이팅', '에세이', '스토리텔링'];

const TYPE_GOALS: Record<WriteType, string> = {
  '묘사문':     '표현력·감각 묘사 향상',
  '설명문':     '전달력·구조화 능력 향상',
  '감상문':     '감정·생각 정리 및 표현',
  '의견문':     '논리적 주장·설득력 향상',
  '기사 리드':  '핵심 요약 및 정보 전달',
  '카피라이팅': '후킹·설득·행동 유도',
  '에세이':     '경험·생각을 깊이 있게 서술',
  '스토리텔링': '이야기 구성 및 몰입감 향상',
};

const BREAKDOWN_KEYS: (keyof WritingAnalysis['score_breakdown'])[] = [
  '표현력', '전달력', '구체성', '논리성', '가독성',
];

function StarLoader({ streamLen = 0 }: { streamLen?: number }) {
  const [f, setF] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setF(n => (n + 1) % 3), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="star-loader">
      <div className="pixel-font" style={{ fontSize: 16, color: 'var(--moon)', letterSpacing: 8 }}>
        {['★ ☆ ☆', '★ ★ ☆', '★ ★ ★'][f]}
      </div>
      <span className="star-loader-text">
        {streamLen > 0 ? `${streamLen}자 수신 중...` : '연결 중...'}
      </span>
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  const cls = pct >= 70 ? 'px-bar-fill' : pct >= 45 ? 'px-bar-fill-moon' : 'px-bar-fill-bad';
  const col = pct >= 70 ? 'var(--accent)' : pct >= 45 ? 'var(--moon)' : 'var(--bad)';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim-star)', letterSpacing: '-0.01em' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: col, letterSpacing: '-0.02em' }}>{value}/10</span>
      </div>
      <div className="px-bar-wrap-thin"><div className={cls} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function StarRating({ score }: { score: number }) {
  const stars = Math.round(score / 20);
  return (
    <span className="px-stars">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < stars ? 'star-filled' : 'star-empty'}>{i < stars ? '★' : '☆'}</span>
      ))}
    </span>
  );
}

function scoreColor(s: number) {
  return s >= 80 ? 'var(--good)' : s >= 60 ? 'var(--moon)' : 'var(--bad)';
}

const VERDICT_STYLE = {
  '인용':     { bg: 'var(--good-dim)',   border: 'var(--good-border)',   color: 'var(--good)',   label: '✦ 인용 — 이의 수용' },
  '일부 인용': { bg: 'var(--moon-dim)',   border: 'var(--moon)',          color: 'var(--moon)',   label: '◈ 일부 인용' },
  '기각':     { bg: 'var(--bad-dim)',    border: 'var(--bad-border)',    color: 'var(--bad)',    label: '✕ 기각 — 원판정 유지' },
};

function AppealResultView({ appeal, originalScore, onReset }: { appeal: AppealResult; originalScore: number; onReset: () => void }) {
  const vs = VERDICT_STYLE[appeal.verdict];
  const scoreChanged = appeal.revisedScore !== originalScore;
  return (
    <div className="animate-fade-in">
      <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginBottom: 10 }}>✦ 재심 판정</div>

      {/* 판정 배너 */}
      <div style={{ padding: '12px 16px', background: vs.bg, border: `1.5px solid ${vs.border}`, borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: vs.color, fontFamily: 'Pretendard, sans-serif', marginBottom: scoreChanged ? 8 : 0 }}>
          {vs.label}
        </div>
        {scoreChanged && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif', textDecoration: 'line-through', opacity: 0.5 }}>{originalScore}</span>
            <span style={{ fontSize: 16, color: vs.color }}>→</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: vs.color, fontFamily: 'Pretendard, sans-serif' }}>{appeal.revisedScore}</span>
            <span style={{ fontSize: 12, color: vs.color, fontFamily: 'Pretendard, sans-serif' }}>점</span>
          </div>
        )}
      </div>

      {/* 판정 이유 */}
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.9, padding: '10px 14px', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--card-border)', borderRadius: '0 6px 6px 0', marginBottom: 14, fontFamily: 'Pretendard, sans-serif' }}>
        {appeal.reasoning}
      </div>

      {/* 수용 / 기각 포인트 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {appeal.acceptedPoints.length > 0 && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pixel-font" style={{ fontSize: 6, color: 'var(--good-border)', marginBottom: 6 }}>✦ 수용한 주장</div>
            {appeal.acceptedPoints.map(p => <span key={p} className="px-tag-good" style={{ display: 'block', marginBottom: 4 }}>{p}</span>)}
          </div>
        )}
        {appeal.rejectedPoints.length > 0 && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pixel-font" style={{ fontSize: 6, color: 'var(--bad-border)', marginBottom: 6 }}>✦ 기각한 주장</div>
            {appeal.rejectedPoints.map(p => <span key={p} className="px-tag-weak" style={{ display: 'block', marginBottom: 4 }}>{p}</span>)}
          </div>
        )}
      </div>

      <button className="px-btn-ghost" style={{ fontSize: 11 }} onClick={onReset}>↩ 다시 이의 제기</button>
    </div>
  );
}

function AnalysisDetail({ a, compact = false }: { a: WritingAnalysis; compact?: boolean }) {
  return (
    <div className="animate-fade-in">

      {/* 총점 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div className="px-score" style={{ borderColor: scoreColor(a.score), color: scoreColor(a.score), boxShadow: `3px 3px 0 ${scoreColor(a.score)}44` }}>
          {a.score}
        </div>
        <div>
          <StarRating score={a.score} />
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginTop: 6 }}>총점 / 100</div>
        </div>
      </div>

      {/* 강점 / 약점 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--good-border)', marginBottom: 6 }}>✦ 잘 된 부분</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(a.strengths || []).map(s => <span key={s} className="px-tag-good" style={{ display: 'block' }}>{s}</span>)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--bad-border)', marginBottom: 6 }}>✦ 개선 필요</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(a.weaknesses || []).map(w => <span key={w} className="px-tag-weak" style={{ display: 'block' }}>{w}</span>)}
          </div>
        </div>
      </div>

      {/* 코치 코멘트 */}
      {(a.improvement_suggestions || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--accent)', marginBottom: 8 }}>✦ 코치 코멘트</div>
          {a.improvement_suggestions.map((s, i) => (
            <div key={i} style={{
              fontSize: 12, color: 'var(--text)', lineHeight: 1.9,
              marginBottom: 8, padding: '10px 14px',
              background: 'var(--accent-dim)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: '0 4px 4px 0',
            }}>
              <span className="pixel-font" style={{ fontSize: 6, color: 'var(--accent)', marginRight: 6 }}>{i + 1}.</span>
              {s}
            </div>
          ))}
        </div>
      )}

      {/* 개선 예시 */}
      {(a.improvement_examples || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--moon)', marginBottom: 8 }}>✦ 이렇게 써보세요</div>
          {a.improvement_examples.map((ex, i) => {
            const arrow = ex.indexOf('→');
            const before = arrow !== -1 ? ex.slice(0, arrow).trim() : ex;
            const after  = arrow !== -1 ? ex.slice(arrow + 1).trim() : '';
            return (
              <div key={i} style={{
                marginBottom: 8, padding: '10px 14px',
                background: 'var(--moon-dim)',
                borderLeft: '3px solid var(--moon)',
                borderRadius: '0 6px 6px 0',
              }}>
                {after ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--dim-star)', textDecoration: 'line-through', marginBottom: 5, lineHeight: 1.7 }}>{before}</div>
                    <div style={{ fontSize: 13, color: 'var(--moon)', lineHeight: 1.8, fontWeight: 500 }}>→ {after}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>{ex}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!compact && (
        <>
          <div className="px-divider" />
          {/* Breakdown */}
          <div style={{ marginBottom: 14 }}>
            <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 10, letterSpacing: '0.1em' }}>세부 점수 (각 10점)</div>
            {BREAKDOWN_KEYS.map(k => (
              <BreakdownBar key={k} label={k} value={a.score_breakdown?.[k] ?? 0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const DRAFT_KEY = 'writing_draft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function WritingPageInner() {
  const searchParams = useSearchParams();
  const today = new Date().toISOString().split('T')[0];

  const [date,   setDate]   = useState(() => loadDraft()?.date ?? today);
  const [type,   setType]   = useState<WriteType>(() => loadDraft()?.type ?? '에세이');
  const [topic,  setTopic]  = useState(() => loadDraft()?.topic ?? '');
  const [text,   setText]   = useState(() => loadDraft()?.text ?? '');
  const [loading, setLoading] = useState(false);
  const [streamLen, setStreamLen] = useState(0);
  const [result,  setResult]  = useState<WritingAnalysis | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [appealOpen,   setAppealOpen]   = useState(false);
  const [appealText,   setAppealText]   = useState('');
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealStreamLen, setAppealStreamLen] = useState(0);
  const [appealResult, setAppealResult] = useState<AppealResult | null>(null);
  const [appealedFor,  setAppealedFor]  = useState<number | null>(null);
  const [err,    setErr]    = useState('');
  const [saved,  setSaved]  = useState(false);
  const [history, setHistory] = useState<WritingEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ date, type, topic, text })); } catch {}
  }, [date, type, topic, text]);

  useEffect(() => {
    const db = loadDB();
    setHistory([...db.writings].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
  }, [saved]);

  const monthGroups = useMemo(() => groupByMonth(history, e => e.date), [history]);

  useEffect(() => {
    if (monthGroups.length > 0) setOpenMonths(prev => prev.size === 0 ? new Set([monthGroups[0].key]) : prev);
  }, [monthGroups.length > 0]);

  function toggleMonth(key: string) {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const focusHandled = useRef(false);
  useEffect(() => {
    if (focusHandled.current || history.length === 0) return;
    const focusId = Number(searchParams.get('focus'));
    const entry = focusId ? history.find(e => e.id === focusId) : undefined;
    if (!entry) return;
    focusHandled.current = true;
    setExpanded(focusId);
    const month = groupByMonth([entry], e => e.date)[0]?.key;
    if (month) setOpenMonths(prev => new Set(prev).add(month));
    requestAnimationFrame(() => {
      document.getElementById(`entry-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [history, searchParams]);

  const dispatchScore = useCallback((score: number) => {
    window.dispatchEvent(new CustomEvent('score-updated', { detail: { score } }));
  }, []);

  async function handleAnalyze() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    if (!text.trim()) { setErr('글을 작성해주세요.'); return; }
    setLoading(true); setErr(''); setResult(null); setStreamLen(0);
    try {
      const res = await analyzeWriting(s, type, topic, text,
        (chunk) => setStreamLen(l => l + chunk.length));
      setResult(res);
      setAnalysisOpen(true);
      setAppealOpen(false); setAppealText(''); setAppealResult(null); setAppealedFor(null);
      dispatchScore(res.score);
      const db = loadDB();
      db.writings.push({ id: Date.now(), date, type, topic, text, status: '분석완료', analysis: res, createdAt: new Date().toISOString() });
      mergeExpressions(db, res.expressions || []);
      mergeWeaknesses(db, res.weaknesses || []);
      saveDB(db);
      setText(''); setTopic('');
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setSaved(s => !s);
    } catch (e: unknown) {
      setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  async function handleAppeal(resultToAppeal: WritingAnalysis, entryId?: number) {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    if (!appealText.trim()) { setErr('이의 신청 내용을 입력해주세요.'); return; }
    setAppealLoading(true); setErr(''); setAppealResult(null); setAppealStreamLen(0);
    try {
      const res = await evaluateAppeal(s, type, topic, text || '', resultToAppeal, appealText,
        (chunk) => setAppealStreamLen(l => l + chunk.length));
      setAppealResult(res);
      setAppealedFor(entryId ?? null);
      if (res.verdict !== '기각') dispatchScore(res.revisedScore);
    } catch (e: unknown) {
      setErr('재심 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setAppealLoading(false); }
  }

  function handleSaveOnly() {
    if (!text.trim()) { setErr('글을 작성해주세요.'); return; }
    const db = loadDB();
    db.writings.push({ id: Date.now(), date, type, topic, text, status: '미분석', createdAt: new Date().toISOString() });
    saveDB(db);
    setText(''); setTopic('');
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setSaved(s => !s);
  }

  async function handleAnalyzeEntry(entry: WritingEntry) {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    setAnalyzingId(entry.id); setErr('');
    try {
      const res = await analyzeWriting(s, entry.type, entry.topic, entry.text);
      dispatchScore(res.score);
      const db = loadDB();
      const idx = db.writings.findIndex(w => w.id === entry.id);
      if (idx !== -1) {
        db.writings[idx] = { ...db.writings[idx], status: '분석완료', analysis: res };
        mergeExpressions(db, res.expressions || []);
        mergeWeaknesses(db, res.weaknesses || []);
        saveDB(db);
      }
      setSaved(s => !s);
    } catch (e: unknown) {
      setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setAnalyzingId(null); }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 글을 삭제할까요?')) return;
    const db = loadDB();
    db.writings = db.writings.filter(w => w.id !== id);
    db._deletedIds = [...(db._deletedIds ?? []), id];
    saveDBLocal(db);
    setSaved(s => !s);
    try { await pushData(db); } catch {}
  }

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>✏ 글쓰기 연습</div>

      {/* 서브 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={{
          padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
          border: '1.5px solid var(--accent)', background: 'var(--accent)', color: '#fff',
          fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
        }}>✏ 글쓰기</button>
        <Link href="/expressions" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
            border: '1.5px solid var(--card-border)', background: 'transparent', color: 'var(--dim-star)',
            fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
          }}>辭 표현사전</button>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }} className="grid-2">

        {/* 입력 패널 */}
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 새 글 작성</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="px-label">날짜</label>
              <input className="px-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="px-label">유형</label>
              <select className="px-select" value={type} onChange={e => setType(e.target.value as WriteType)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5, fontFamily: 'Pretendard, sans-serif' }}>
                {TYPE_GOALS[type]}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="px-label">주제</label>
            <input className="px-input" placeholder="핵심 주제를 입력해주세요" value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="px-label">본문</label>
            <textarea
              className="px-textarea" rows={12}
              placeholder={"별처럼 흩어진 문장들을\n이곳에 모아주세요..."}
              value={text} onChange={e => setText(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="px-btn px-btn-accent" onClick={handleAnalyze} disabled={loading}>
              {loading ? (streamLen > 0 ? `★ ${streamLen}자 수신 중...` : '★ 연결 중...') : '✦ AI 분석'}
            </button>
            <button className="px-btn-ghost" onClick={handleSaveOnly} disabled={loading}>저장만</button>
            <span style={{ marginLeft: 'auto', fontFamily: 'Pretendard, sans-serif', fontSize: 12, fontWeight: 500, color: 'var(--dim-star)' }}>
              {text.length.toLocaleString()}자
            </span>
          </div>
          {err && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--bad)', padding: '8px 12px', borderLeft: '2px solid var(--bad-border)', background: 'var(--bad-dim)' }}>
              {err}
            </div>
          )}
        </div>

        {/* 분석 결과 */}
        <div className="px-card" style={{ minHeight: loading || !result ? 340 : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: analysisOpen ? 14 : 0 }}>
            <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)' }}>✦ 분석 결과</div>
            {(result || loading) && (
              <button onClick={() => setAnalysisOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--card-border)', fontSize: 11, lineHeight: 1, padding: '2px 4px' }}>
                {analysisOpen ? '▲ 접기' : '▼ 펼치기'}
              </button>
            )}
          </div>

          {analysisOpen && loading && <StarLoader streamLen={streamLen} />}

          {analysisOpen && !loading && !result && (
            <div className="px-empty">
              <div className="px-empty-icon">✦</div>
              <p className="px-empty-text">글을 작성하고<br />AI 분석 버튼을 눌러주세요</p>
            </div>
          )}

          {analysisOpen && result && <AnalysisDetail a={result} />}

          {/* 이의 제기 */}
          {result && !loading && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--card-border)', paddingTop: 14 }}>
              {!appealOpen && !appealResult && (
                <button
                  className="px-btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => { setAppealOpen(true); setAppealResult(null); }}
                >
                  ✉ 이의 제기하기
                </button>
              )}

              {appealOpen && !appealResult && (
                <div>
                  <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--moon)', marginBottom: 8 }}>✦ 이의 신청서</div>
                  <div style={{ fontSize: 12, color: 'var(--dim-star)', marginBottom: 8, lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif' }}>
                    글의 배경·의도·장르 특성 등 평가에 반영되지 않았다고 생각하는 근거를 구체적으로 설명해주세요. 감정적 호소나 근거 없는 요청은 기각됩니다.
                  </div>
                  <textarea
                    className="px-textarea" rows={5}
                    placeholder="예) 이 글은 일부러 단문 위주로 구성해 긴장감을 표현했습니다. 구체성 항목에서 감점된 부분은 의도적 여백이었고..."
                    value={appealText}
                    onChange={e => setAppealText(e.target.value)}
                    style={{ minHeight: 100, marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="px-btn px-btn-accent"
                      onClick={() => handleAppeal(result)}
                      disabled={appealLoading}
                      style={{ fontSize: 13 }}
                    >
                      {appealLoading
                        ? (appealStreamLen > 0 ? `★ ${appealStreamLen}자 수신 중...` : '★ 심사 중...')
                        : '✦ 이의 제기 제출'}
                    </button>
                    <button className="px-btn-ghost" style={{ fontSize: 13 }} onClick={() => { setAppealOpen(false); setAppealText(''); }}>취소</button>
                  </div>
                </div>
              )}

              {appealResult && (
                <AppealResultView
                  appeal={appealResult}
                  originalScore={result.score}
                  onReset={() => { setAppealResult(null); setAppealOpen(false); setAppealText(''); }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 기록 목록 */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ 작성 기록 ({history.length}편)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {monthGroups.map(group => {
              const isOpen = openMonths.has(group.key);
              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleMonth(group.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'var(--bg-subtle)', border: '1px solid var(--card-border)',
                      borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                      marginBottom: isOpen ? 8 : 0, fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    <span className="pixel-font" style={{ fontSize: 9, color: 'var(--card-border)' }}>{isOpen ? '▾' : '▸'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>📁 {group.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim-star)', marginLeft: 'auto' }}>{group.items.length}개</span>
                  </button>
                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {group.items.map(entry => (
              <div key={entry.id} id={`entry-${entry.id}`}>
                <div
                  className="px-card"
                  style={{ cursor: 'pointer', padding: '12px 16px' }}
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)' }}>{entry.date}</span>
                    <span className="pixel-font" style={{ marginLeft: 'auto', fontSize: 6.5, color: 'var(--card-border)' }}>
                      {expanded === entry.id ? '▲' : '▼'}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.topic || entry.text.slice(0, 40)}
                  </p>
                </div>

                {expanded === entry.id && (
                  <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--card-border)', borderTop: 'none', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="px-badge px-badge-type" style={{ fontSize: 12 }}>{entry.type}</span>
                        {entry.analysis
                          ? <span className="px-badge px-badge-accent" style={{ fontSize: 12 }}>{entry.analysis.score}점</span>
                          : <span className="px-badge px-badge-pending" style={{ fontSize: 12 }}>미분석</span>
                        }
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.7 }}>✕ 삭제</button>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginBottom: 8 }}>✦ 원문</div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap', padding: '10px 14px', background: 'var(--bg-subtle)', borderLeft: '2px solid var(--card-border)', marginBottom: 0 }}>
                        {entry.text}
                      </p>
                    </div>

                    {!entry.analysis && (
                      <div style={{ marginBottom: 14 }}>
                        <button
                          className="px-btn px-btn-accent"
                          onClick={() => handleAnalyzeEntry(entry)}
                          disabled={analyzingId !== null}
                          style={{ fontSize: 14 }}
                        >
                          {analyzingId === entry.id ? '★ 분석 중...' : '✦ 지금 AI 분석하기'}
                        </button>
                        {analyzingId === entry.id && (
                          <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--dim-star)' }}>잠시만 기다려주세요...</span>
                        )}
                      </div>
                    )}

                    {entry.analysis && (
                      <>
                        <div className="px-divider" />
                        <AnalysisDetail a={entry.analysis} compact={false} />
                      </>
                    )}
                  </div>
                )}
              </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WritingPage() {
  return (
    <Suspense>
      <WritingPageInner />
    </Suspense>
  );
}
