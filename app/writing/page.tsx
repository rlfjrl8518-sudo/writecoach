'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  loadDB, saveDB, loadSettings, mergeExpressions, mergeWeaknesses,
  mergeStructures, mergeSenses, type WritingAnalysis, type WriteType, type WritingEntry,
} from '@/lib/db';
import { analyzeWriting } from '@/lib/openai';

const TYPES: WriteType[] = ['에세이', '일기', '기획서', '논설', '소설', '리뷰', '기타'];

const BREAKDOWN_KEYS: (keyof WritingAnalysis['score_breakdown'])[] = [
  '표현력', '전달력', '구체성', '문장다양성', '카피라이팅적합성',
  '논리성', '가독성', '구조다양성', '감각표현다양성',
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
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--dim-star)' }}>{label}</span>
        <span className="pixel-font" style={{ fontSize: 7, color: col }}>{value}/10</span>
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

/* 분석 결과 + 히스토리 두 곳에서 공통으로 사용 */
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
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginTop: 6 }}>TOTAL / 100</div>
        </div>
      </div>

      {/* 강점 / 약점 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--good-border)', marginBottom: 6 }}>✦ 잘 된 부분</div>
          <div>{(a.strengths || []).map(s => <span key={s} className="px-tag-good">{s}</span>)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--bad-border)', marginBottom: 6 }}>✦ 개선 필요</div>
          <div>{(a.weaknesses || []).map(w => <span key={w} className="px-tag-weak">{w}</span>)}</div>
        </div>
      </div>

      {/* 코치 코멘트 — 수정 방향성 */}
      {(a.improvement_suggestions || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--accent)', marginBottom: 8 }}>✦ 코치 코멘트</div>
          {a.improvement_suggestions.map((s, i) => (
            <div key={i} style={{
              fontSize: 12, color: 'var(--text)', lineHeight: 1.9,
              marginBottom: 8, padding: '10px 14px',
              background: 'rgba(167,139,250,0.07)',
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
          {a.improvement_examples.map((ex, i) => (
            <div key={i} style={{
              fontSize: 11, color: 'var(--text)', lineHeight: 1.8,
              marginBottom: 6, padding: '8px 12px',
              background: 'rgba(255,217,125,0.06)',
              borderLeft: '2px solid var(--moon)',
            }}>
              {ex}
            </div>
          ))}
        </div>
      )}

      {!compact && (
        <>
          <div className="px-divider" />

          {/* Breakdown */}
          <div style={{ marginBottom: 14 }}>
            <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 10, letterSpacing: '0.1em' }}>BREAKDOWN (각 10점)</div>
            {BREAKDOWN_KEYS.map(k => (
              <BreakdownBar key={k} label={k} value={a.score_breakdown?.[k] ?? 0} />
            ))}
          </div>

          {/* 반복 단어 */}
          {(a.repeated_words || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 6 }}>✦ 반복 단어</div>
              {a.repeated_words.map(w => <span key={w} className="px-tag-dim">{w}</span>)}
            </div>
          )}

          {/* 감각 분포 */}
          {a.senses && (
            <>
              <div className="px-divider" />
              <div>
                <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 8 }}>✦ SENSES</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {Object.entries(a.senses).map(([k, v]) => (
                    <div key={k} style={{ textAlign: 'center', minWidth: 36 }}>
                      <div className="pixel-font" style={{ fontSize: 9, color: 'var(--moon)' }}>{v}</div>
                      <div style={{ fontSize: 9, color: 'var(--dim-star)', marginTop: 2 }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function WritingPage() {
  const today = new Date().toISOString().split('T')[0];
  const [date,   setDate]   = useState(today);
  const [type,   setType]   = useState<WriteType>('에세이');
  const [topic,  setTopic]  = useState('');
  const [text,   setText]   = useState('');
  const [loading, setLoading] = useState(false);
  const [streamLen, setStreamLen] = useState(0);
  const [result,  setResult]  = useState<WritingAnalysis | null>(null);
  const [err,    setErr]    = useState('');
  const [saved,  setSaved]  = useState(false);
  const [history, setHistory] = useState<WritingEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const db = loadDB();
    setHistory([...db.writings].reverse());
  }, [saved]);

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
      dispatchScore(res.score);
      const db = loadDB();
      db.writings.push({ id: Date.now(), date, type, topic, text, status: '분석완료', analysis: res, createdAt: new Date().toISOString() });
      mergeExpressions(db, res.expressions || []);
      mergeWeaknesses(db, res.weaknesses || []);
      mergeStructures(db, res.structures || []);
      if (res.senses) mergeSenses(db, res.senses);
      saveDB(db);
      setSaved(s => !s);
    } catch (e: unknown) {
      setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  function handleSaveOnly() {
    if (!text.trim()) { setErr('글을 작성해주세요.'); return; }
    const db = loadDB();
    db.writings.push({ id: Date.now(), date, type, topic, text, status: '미분석', createdAt: new Date().toISOString() });
    saveDB(db);
    setText(''); setTopic(''); setSaved(s => !s);
  }

  function handleDelete(id: number) {
    if (!confirm('이 글을 삭제할까요?')) return;
    const db = loadDB();
    db.writings = db.writings.filter(w => w.id !== id);
    saveDB(db);
    setSaved(s => !s);
  }

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>✏ WRITING LAB</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }} className="grid-2">

        {/* 입력 패널 */}
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ NEW ENTRY</div>
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
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-pixel, monospace)', fontSize: 7, color: 'var(--card-border)' }}>
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
        <div className="px-card" style={{ minHeight: 340 }}>
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ ANALYSIS</div>

          {loading && <StarLoader streamLen={streamLen} />}

          {!loading && !result && (
            <div className="px-empty">
              <div className="px-empty-icon">✦</div>
              <p className="px-empty-text">글을 작성하고<br />AI 분석 버튼을 눌러주세요</p>
            </div>
          )}

          {result && <AnalysisDetail a={result} />}
        </div>
      </div>

      {/* 기록 목록 */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ HISTORY ({history.length}편)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(entry => (
              <div key={entry.id}>
                {/* 헤더 행 */}
                <div
                  className="px-card"
                  style={{ cursor: 'pointer', padding: '12px 16px' }}
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)' }}>{entry.date}</span>
                    <span className="px-badge px-badge-type">{entry.type}</span>
                    {entry.analysis
                      ? <span className="px-badge px-badge-accent">{entry.analysis.score}pt</span>
                      : <span className="px-badge px-badge-pending">미분석</span>
                    }
                    <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.topic || entry.text.slice(0, 40)}
                    </span>
                    <span className="pixel-font" style={{ fontSize: 6.5, color: 'var(--card-border)' }}>
                      {expanded === entry.id ? '▲' : '▼'}
                    </span>
                    <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.6 }}>✕</button>
                  </div>
                </div>

                {/* 확장 패널 */}
                {expanded === entry.id && (
                  <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--card-border)', borderTop: 'none', padding: '16px' }}>
                    {/* 원문 */}
                    <div style={{ marginBottom: entry.analysis ? 16 : 0 }}>
                      <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginBottom: 8 }}>✦ 원문</div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderLeft: '2px solid var(--card-border)' }}>
                        {entry.text}
                      </p>
                    </div>

                    {/* 분석 전체 내역 */}
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
        </div>
      )}
    </div>
  );
}
