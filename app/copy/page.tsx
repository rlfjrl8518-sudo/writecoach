'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadDB, saveDB, saveDBLocal, loadSettings, mergeCopyType, type CopyEntry, type CopyAnalysis } from '@/lib/db';
import { pushData } from '@/lib/supabase';
import { analyzeCopy } from '@/lib/openai';

const COPY_GUIDE = [
  { type: '문제 해결형',  struct: '문제→해결',   desc: '문제를 제시하고 해결책 제안' },
  { type: '공감 제안형',  struct: '공감→제안',   desc: '상황 공감 후 행동 제안' },
  { type: '위험 대비형',  struct: '위험→대비',   desc: '리스크를 상기시키고 대비 필요성 제시' },
  { type: '호기심 자극형', struct: '호기심→정보', desc: '궁금증 유발 후 정보 제공' },
  { type: '혜택 강조형',  struct: '숫자→혜택',   desc: '수치·조건으로 혜택 강조' },
  { type: '질문 답변형',  struct: '질문→답변',   desc: '질문으로 시작해 답 제시' },
  { type: '근거 설득형',  struct: '증거→결론',   desc: '데이터·후기·사례 기반 설득' },
  { type: '반전 제시형',  struct: '반전→메시지', desc: '상식을 뒤집어 관심 유도' },
  { type: '스토리 전달형', struct: '스토리→교훈', desc: '경험·사례로 메시지 전달' },
  { type: '행동 유도형',  struct: '행동→보상',   desc: '행동 시 얻는 결과 강조' },
];

function StarLoader({ streamLen }: { streamLen: number }) {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(n => (n + 1) % 3), 500); return () => clearInterval(t); }, []);
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

function HookGauge({ value }: { value: number }) {
  const pct = value * 10;
  const color = value >= 8 ? 'var(--good)' : value >= 5 ? 'var(--moon)' : 'var(--bad)';
  const cls   = value >= 8 ? 'px-bar-fill-good' : value >= 5 ? 'px-bar-fill-moon' : 'px-bar-fill-bad';
  const label = value >= 8 ? '강력함' : value >= 5 ? '보통' : '약함';
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div className="pixel-font" style={{ fontSize: 28, color, marginBottom: 4 }}>
        {value}<span style={{ fontSize: 11 }}>/10</span>
      </div>
      <div style={{ fontSize: 10, color, marginBottom: 8 }}>{label}</div>
      <div className="px-bar-wrap"><div className={cls} style={{ width: `${pct}%` }} /></div>
      <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginTop: 6 }}>후킹 강도</div>
    </div>
  );
}

function AnalysisView({ a }: { a: CopyAnalysis }) {
  return (
    <div className="animate-fade-in">
      <HookGauge value={a.hookStrength} />
      <div className="px-divider" />
      <div style={{ marginBottom: 12 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 8 }}>카피 유형</div>
        <span className="px-badge px-badge-moon" style={{ fontSize: 13, padding: '4px 12px' }}>{a.type}</span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 6 }}>사용 기법</div>
        {(a.techniques || []).map(t => <span key={t} className="px-tag-expr">{t}</span>)}
      </div>
      <div>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 6 }}>예상 타겟</div>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, padding: '8px 12px', background: 'var(--bg-subtle)', borderLeft: '2px solid var(--accent)' }}>
          {a.targetAudience}
        </div>
      </div>
    </div>
  );
}

export default function CopyPage() {
  const [copy,    setCopy]    = useState('');
  const [brand,   setBrand]   = useState('');
  const [source,  setSource]  = useState('');
  const [loading, setLoading] = useState(false);
  const [streamLen, setStreamLen] = useState(0);
  const [result,  setResult]  = useState<CopyAnalysis | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [err,     setErr]     = useState('');
  const [history, setHistory] = useState<CopyEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    const db = loadDB();
    setHistory([...db.copies].reverse());
  }, [saved]);

  async function handleAnalyze() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    if (!copy.trim()) { setErr('카피를 입력해주세요.'); return; }
    setLoading(true); setErr(''); setResult(null); setStreamLen(0);
    try {
      const res = await analyzeCopy(s, copy, brand, source,
        (chunk) => setStreamLen(l => l + chunk.length));
      setResult(res);
      setAnalysisOpen(true);
      const db = loadDB();
      db.copies.push({ id: Date.now(), copy, brand, source, analysis: res, createdAt: new Date().toISOString() });
      mergeCopyType(db, res.type);
      saveDB(db);
      setSaved(v => !v);
    } catch (e: unknown) {
      setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  function handleSaveOnly() {
    if (!copy.trim()) { setErr('카피를 입력해주세요.'); return; }
    const db = loadDB();
    db.copies.push({ id: Date.now(), copy, brand, source, createdAt: new Date().toISOString() });
    saveDB(db);
    setCopy(''); setBrand(''); setSource(''); setSaved(v => !v);
  }

  async function handleDelete(id: number) {
    if (!confirm('이 카피를 삭제할까요?')) return;
    const db = loadDB();
    db.copies = db.copies.filter(c => c.id !== id);
    db._deletedIds = [...(db._deletedIds ?? []), id];
    saveDBLocal(db);
    setSaved(v => !v);
    try { await pushData(db); } catch {}
  }

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>文 문장 · 이미지 수집</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        좋은 문장을 수집하거나, 눈에 띈 글을 이미지로 빠르게 저장해요.
      </p>

      {/* 서브 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Link href="/sentence" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
            border: '1.5px solid var(--card-border)', background: 'transparent', color: 'var(--dim-star)',
            fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
          }}>文 문장</button>
        </Link>
        <button style={{
          padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
          border: '1.5px solid var(--accent)', background: 'var(--accent)', color: '#fff',
          fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
        }}>広 카피</button>
        <Link href="/sentence?tab=image" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
            border: '1.5px solid var(--card-border)', background: 'transparent', color: 'var(--dim-star)',
            fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
          }}>📷 이미지</button>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }} className="grid-2">

        {/* 입력 */}
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 카피 입력</div>
          <div style={{ marginBottom: 12 }}>
            <label className="px-label">카피</label>
            <textarea
              className="px-textarea" rows={5}
              placeholder={"수집한 광고 카피를 입력해주세요..."}
              value={copy} onChange={e => setCopy(e.target.value)}
              style={{ minHeight: 100 }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label className="px-label">브랜드</label>
              <input className="px-input" placeholder="브랜드명" value={brand} onChange={e => setBrand(e.target.value)} />
            </div>
            <div>
              <label className="px-label">출처</label>
              <input className="px-input" placeholder="광고 출처" value={source} onChange={e => setSource(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="px-btn px-btn-accent" onClick={handleAnalyze} disabled={loading}>
              {loading ? '★ 분석 중...' : '✦ AI 분석'}
            </button>
            <button className="px-btn-ghost" onClick={handleSaveOnly} disabled={loading}>저장만</button>
          </div>
          {err && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--bad)', padding: '8px 12px', borderLeft: '2px solid var(--bad-border)', background: 'var(--bad-dim)' }}>
              {err}
            </div>
          )}

          {/* 카피 구조 가이드 */}
          <div style={{ marginTop: 20 }}>
            <div className="px-divider-dim" />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim-star)', marginBottom: 12, letterSpacing: '-0.01em' }}>카피 구조 참고</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {COPY_GUIDE.map((g, i) => (
                <div key={g.type} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 0',
                  borderBottom: i < COPY_GUIDE.length - 1 ? '1px solid var(--card-border)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'Pretendard, sans-serif', fontWeight: 600, flexShrink: 0, minWidth: 88, letterSpacing: '-0.01em' }}>{g.type}</span>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'Pretendard, sans-serif', fontWeight: 500, flexShrink: 0, minWidth: 76 }}>{g.struct}</span>
                  <span style={{ fontSize: 12, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif', lineHeight: 1.5 }}>{g.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 분석 결과 */}
        <div className="px-card" style={{ minHeight: loading || !result ? 280 : 'auto' }}>
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
              <div className="px-empty-icon">広</div>
              <p className="px-empty-text">카피를 입력하고<br />AI 분석 버튼을 눌러주세요</p>
            </div>
          )}
          {analysisOpen && result && <AnalysisView a={result} />}
        </div>
      </div>

      {/* 수집 목록 */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ 수집 카피 ({history.length}개)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(entry => (
              <div key={entry.id}>
                <div
                  className="px-card"
                  style={{ cursor: 'pointer', padding: '12px 16px' }}
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {entry.brand && <span className="px-badge px-badge-type" style={{ fontSize: 12, padding: '3px 10px' }}>{entry.brand}</span>}
                        {entry.analysis && (
                          <>
                            <span className="px-badge px-badge-moon" style={{ fontSize: 12, padding: '3px 10px' }}>{entry.analysis.type}</span>
                            <span className="px-badge px-badge-accent" style={{ fontSize: 12, padding: '3px 10px' }}>후킹 {entry.analysis.hookStrength}/10</span>
                          </>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
                        {entry.copy.length > 80 ? entry.copy.slice(0, 80) + '…' : entry.copy}
                      </p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.6, flexShrink: 0 }}>✕</button>
                  </div>
                </div>
                {expanded === entry.id && (
                  <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--card-border)', borderTop: 'none', padding: '14px 16px' }}>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap', marginBottom: entry.analysis ? 14 : 0 }}>
                      {entry.copy}
                    </p>
                    {entry.analysis && <AnalysisView a={entry.analysis} />}
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
