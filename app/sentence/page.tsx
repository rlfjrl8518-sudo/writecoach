'use client';
import { useState, useEffect } from 'react';
import { loadDB, saveDB, loadSettings, type SentenceEntry, type SentenceAnalysis } from '@/lib/db';
import { analyzeSentence } from '@/lib/openai';

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

function AnalysisView({ a }: { a: SentenceAnalysis }) {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 12 }}>
        <span className="px-badge px-badge-accent" style={{ marginRight: 8 }}>{a.structure}</span>
      </div>
      <InfoRow label="역할" value={a.role} />
      <InfoRow label="전달방식" value={a.deliveryMethod} />
      <InfoRow label="응용가능성" value={a.applicability} />
      <div style={{ marginTop: 10 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 6 }}>핵심 표현</div>
        {(a.keyExpressions || []).map(e => <span key={e} className="px-tag-expr">{e}</span>)}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderLeft: '2px solid var(--accent)' }}>
      <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--accent)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>{value}</div>
    </div>
  );
}

export default function SentencePage() {
  const [source,   setSource]   = useState('');
  const [sentence, setSentence] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [streamLen, setStreamLen] = useState(0);
  const [result,   setResult]   = useState<SentenceAnalysis | null>(null);
  const [err,      setErr]      = useState('');
  const [history,  setHistory]  = useState<SentenceEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    const db = loadDB();
    setHistory([...db.sentences].reverse());
  }, [saved]);

  async function handleAnalyze() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    if (!sentence.trim()) { setErr('문장을 입력해주세요.'); return; }
    setLoading(true); setErr(''); setResult(null); setStreamLen(0);
    try {
      const res = await analyzeSentence(s, sentence, source,
        (chunk) => setStreamLen(l => l + chunk.length));
      setResult(res);
      const db = loadDB();
      db.sentences.push({ id: Date.now(), source, sentence, analysis: res, createdAt: new Date().toISOString() });
      if (res.structure && db.structures) {
        db.structures[res.structure] = (db.structures[res.structure] || 0) + 1;
      }
      saveDB(db);
      setSaved(v => !v);
    } catch (e: unknown) {
      setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  function handleSaveOnly() {
    if (!sentence.trim()) { setErr('문장을 입력해주세요.'); return; }
    const db = loadDB();
    db.sentences.push({ id: Date.now(), source, sentence, createdAt: new Date().toISOString() });
    saveDB(db);
    setSentence(''); setSource(''); setSaved(v => !v);
  }

  function handleDelete(id: number) {
    if (!confirm('이 문장을 삭제할까요?')) return;
    const db = loadDB();
    db.sentences = db.sentences.filter(s => s.id !== id);
    saveDB(db);
    setSaved(v => !v);
  }

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>文 SENTENCE LAB</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        좋은 문장을 수집하고 구조를 분석해요. 읽다가 마음에 든 문장을 모아보세요.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }} className="grid-2">

        {/* 입력 */}
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 문장 입력</div>
          <div style={{ marginBottom: 12 }}>
            <label className="px-label">출처</label>
            <input className="px-input" placeholder="책 이름, 작가, URL 등" value={source} onChange={e => setSource(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="px-label">문장</label>
            <textarea
              className="px-textarea" rows={6}
              placeholder="수집하고 싶은 문장을 입력해주세요..."
              value={sentence} onChange={e => setSentence(e.target.value)}
              style={{ minHeight: 120 }}
            />
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
        </div>

        {/* 분석 결과 */}
        <div className="px-card" style={{ minHeight: 260 }}>
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ ANALYSIS</div>
          {loading && <StarLoader streamLen={streamLen} />}
          {!loading && !result && (
            <div className="px-empty">
              <div className="px-empty-icon">文</div>
              <p className="px-empty-text">문장을 입력하고<br />AI 분석 버튼을 눌러주세요</p>
            </div>
          )}
          {result && <AnalysisView a={result} />}
        </div>
      </div>

      {/* 수집 목록 */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ 수집 문장 ({history.length}개)</div>
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
                      {entry.analysis && (
                        <span className="px-badge px-badge-accent" style={{ marginBottom: 6, display: 'inline-block' }}>{entry.analysis.structure}</span>
                      )}
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {entry.sentence}
                      </p>
                      {entry.source && (
                        <span style={{ fontSize: 10, color: 'var(--dim-star)', marginTop: 4, display: 'block' }}>— {entry.source}</span>
                      )}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.6, flexShrink: 0 }}>✕</button>
                  </div>
                </div>
                {expanded === entry.id && entry.analysis && (
                  <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--card-border)', borderTop: 'none', padding: '14px 16px' }}>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap', marginBottom: 14 }}>{entry.sentence}</p>
                    <AnalysisView a={entry.analysis} />
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
