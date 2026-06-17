'use client';
import { useState, useEffect } from 'react';
import { loadDB, saveDB, loadSettings, mergeCopyType, type CopyEntry, type CopyAnalysis } from '@/lib/db';
import { analyzeCopy } from '@/lib/openai';

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
      <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginTop: 6 }}>HOOK STRENGTH</div>
    </div>
  );
}

function AnalysisView({ a }: { a: CopyAnalysis }) {
  return (
    <div className="animate-fade-in">
      <HookGauge value={a.hookStrength} />
      <div className="px-divider" />
      <div style={{ marginBottom: 12 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 6 }}>카피 유형</div>
        <span className="px-badge px-badge-moon" style={{ fontSize: 9 }}>{a.type}</span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 6 }}>사용 기법</div>
        {(a.techniques || []).map(t => <span key={t} className="px-tag-expr">{t}</span>)}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 6 }}>예상 타겟</div>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderLeft: '2px solid var(--accent)' }}>
          {a.targetAudience}
        </div>
      </div>
      <div>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--moon)', marginBottom: 6 }}>개선안</div>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, padding: '10px 12px', background: 'rgba(255,217,125,0.06)', borderLeft: '2px solid var(--moon)' }}>
          {a.improvement}
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

  function handleDelete(id: number) {
    if (!confirm('이 카피를 삭제할까요?')) return;
    const db = loadDB();
    db.copies = db.copies.filter(c => c.id !== id);
    saveDB(db);
    setSaved(v => !v);
  }

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>広 COPY LAB</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        광고 카피를 수집하고 후킹 강도, 유형, 기법을 분석해요.
      </p>

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

          {/* 카피 유형 가이드 */}
          <div style={{ marginTop: 20 }}>
            <div className="px-divider-dim" />
            <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--card-border)', marginBottom: 8 }}>COPY TYPE GUIDE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['문제제기형', '공감형', '반전형', '숫자형', 'FOMO형', '호기심형', '증거제시형', '혜택강조형', '위험환기형'].map(t => (
                <span key={t} style={{ fontSize: 9, color: 'var(--card-border)', padding: '2px 6px', border: '1px solid var(--card-border)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 분석 결과 */}
        <div className="px-card" style={{ minHeight: 280 }}>
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ ANALYSIS</div>
          {loading && <StarLoader streamLen={streamLen} />}
          {!loading && !result && (
            <div className="px-empty">
              <div className="px-empty-icon">広</div>
              <p className="px-empty-text">카피를 입력하고<br />AI 분석 버튼을 눌러주세요</p>
            </div>
          )}
          {result && <AnalysisView a={result} />}
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
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        {entry.brand && <span className="px-badge px-badge-type">{entry.brand}</span>}
                        {entry.analysis && (
                          <>
                            <span className="px-badge px-badge-moon">{entry.analysis.type}</span>
                            <span className="px-badge px-badge-accent">{entry.analysis.hookStrength}/10</span>
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
                  <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--card-border)', borderTop: 'none', padding: '14px 16px' }}>
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
