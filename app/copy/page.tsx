'use client';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { loadDB, saveDB, saveDBLocal, loadSettings, mergeCopyType, groupByMonth, type CopyEntry, type CopyAnalysis } from '@/lib/db';
import { pushData } from '@/lib/supabase';
import { analyzeCopy } from '@/lib/openai';

const COPY_GUIDE = [
  { type: '브랜딩형',    desc: '브랜드 이미지·정체성 인식' },
  { type: '혜택 전달형', desc: '얻을 수 있는 이득·결과 제시' },
  { type: '문제 제기형', desc: '독자가 가진 문제를 먼저 꺼냄' },
  { type: '위험 환기형', desc: '손실·불안을 상기시켜 행동 촉구' },
  { type: '감성 공감형', desc: '감정·경험에 공명해 연결 형성' },
  { type: '행동 유도형', desc: '지금 당장 특정 행동을 직접 요청' },
  { type: '신뢰 확보형', desc: '수치·후기·인증으로 신뢰 구축' },
  { type: '정보 전달형', desc: '유용한 사실·정보로 관심 유도' },
  { type: '혼합형',      desc: '두 가지 이상 유형 결합' },
];

function RefLink({ url }: { url: string }) {
  return (
    <a
      href={url.trim()} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{ fontSize: 10, color: 'var(--accent)', opacity: 0.8, textDecoration: 'none', wordBreak: 'break-all', display: 'block', marginTop: 3 }}
    >
      🔗 {url}
    </a>
  );
}

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

function CopySection({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="pixel-font" style={{ fontSize: 6.5, color: color || 'var(--dim-star)', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

function AnalysisView({ a }: { a: CopyAnalysis }) {
  // v2
  if (a.copyType || a.mainTarget) {
    return (
      <div className="animate-fade-in">
        <CopySection label="✦ 카피 유형">
          <span className="px-badge px-badge-moon" style={{ fontSize: 13, padding: '4px 14px' }}>{a.copyType}</span>
        </CopySection>
        {a.mainTarget && (
          <CopySection label="✦ 주요 타겟">
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, padding: '8px 12px', background: 'var(--bg-subtle)', borderLeft: '2px solid var(--accent)' }}>
              {a.mainTarget}
            </div>
          </CopySection>
        )}
        {a.persuasionPoints && a.persuasionPoints.length > 0 && (
          <CopySection label="✦ 설득 포인트">
            {a.persuasionPoints.map(p => <span key={p} className="px-tag-expr">{p}</span>)}
          </CopySection>
        )}
        {a.coreMessage && (
          <CopySection label="✦ 핵심 메시지">
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, padding: '10px 14px', background: 'var(--bg-subtle)', borderLeft: '2px solid var(--accent)', fontWeight: 500 }}>
              {a.coreMessage}
            </div>
          </CopySection>
        )}
        {a.expressionFeatures && a.expressionFeatures.length > 0 && (
          <CopySection label="✦ 표현 특징">
            {a.expressionFeatures.map(f => <span key={f} className="px-tag-expr">{f}</span>)}
          </CopySection>
        )}
        {a.analysisSummary && (
          <CopySection label="✦ 분석 요약">
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8 }}>{a.analysisSummary}</div>
          </CopySection>
        )}
      </div>
    );
  }
  // v1 legacy
  return (
    <div className="animate-fade-in">
      {a.type && (
        <CopySection label="✦ 카피 유형">
          <span className="px-badge px-badge-moon" style={{ fontSize: 13, padding: '4px 12px' }}>{a.type}</span>
        </CopySection>
      )}
      {a.techniques && a.techniques.length > 0 && (
        <CopySection label="✦ 표현 특징">
          {a.techniques.map(t => <span key={t} className="px-tag-expr">{t}</span>)}
        </CopySection>
      )}
      {a.targetAudience && (
        <CopySection label="✦ 주요 타겟">
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, padding: '8px 12px', background: 'var(--bg-subtle)', borderLeft: '2px solid var(--accent)' }}>
            {a.targetAudience}
          </div>
        </CopySection>
      )}
    </div>
  );
}

function CopyPageInner() {
  const searchParams = useSearchParams();
  const [copy,      setCopy]      = useState('');
  const [brand,     setBrand]     = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamLen, setStreamLen] = useState(0);
  const [result,  setResult]  = useState<CopyAnalysis | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [err,     setErr]     = useState('');
  const [history, setHistory] = useState<CopyEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saved,   setSaved]   = useState(false);
  const [memo,        setMemo]        = useState('');
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editBrand,   setEditBrand]   = useState('');
  const [editUrl,     setEditUrl]     = useState('');
  const [editMemo,    setEditMemo]    = useState('');
  const [openMonths,  setOpenMonths]  = useState<Set<string>>(new Set());

  useEffect(() => {
    const db = loadDB();
    setHistory([...db.copies].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [saved]);

  const monthGroups = useMemo(() => groupByMonth(history, e => e.createdAt), [history]);

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
    const month = groupByMonth([entry], e => e.createdAt)[0]?.key;
    if (month) setOpenMonths(prev => new Set(prev).add(month));
    requestAnimationFrame(() => {
      document.getElementById(`entry-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [history, searchParams]);

  async function handleAnalyze() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    if (!copy.trim()) { setErr('카피를 입력해주세요.'); return; }
    setLoading(true); setErr(''); setResult(null); setStreamLen(0);
    try {
      const res = await analyzeCopy(s, copy, brand, '',
        (chunk) => setStreamLen(l => l + chunk.length));
      setResult(res);
      setAnalysisOpen(true);
      const db = loadDB();
      db.copies.push({ id: Date.now(), copy, brand, source: '', sourceUrl: sourceUrl || undefined, memo: memo || undefined, analysis: res, createdAt: new Date().toISOString() });
      mergeCopyType(db, res.copyType ?? res.type ?? '');
      saveDB(db);
      setCopy(''); setBrand(''); setSourceUrl(''); setMemo('');
      setSaved(v => !v);
    } catch (e: unknown) {
      setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  function handleSaveOnly() {
    if (!copy.trim()) { setErr('카피를 입력해주세요.'); return; }
    const db = loadDB();
    db.copies.push({ id: Date.now(), copy, brand, source: '', sourceUrl: sourceUrl || undefined, memo: memo || undefined, createdAt: new Date().toISOString() });
    saveDB(db);
    setCopy(''); setBrand(''); setSourceUrl(''); setMemo(''); setSaved(v => !v);
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

  function handleEditStart(entry: CopyEntry, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(entry.id);
    setEditBrand(entry.brand || '');
    setEditUrl(entry.sourceUrl || '');
    setEditMemo(entry.memo || '');
  }

  function handleEditSave(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    const db = loadDB();
    const found = db.copies.find(c => c.id === id);
    if (found) { found.brand = editBrand; found.sourceUrl = editUrl || undefined; found.memo = editMemo || undefined; saveDB(db); }
    setEditingId(null); setSaved(v => !v);
  }

  function handleEditCancel(e: React.MouseEvent) {
    e.stopPropagation(); setEditingId(null);
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
          border: '1.5px solid var(--accent)', background: 'var(--accent)', color: 'var(--on-accent)',
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
          <div style={{ marginBottom: 10 }}>
            <label className="px-label">브랜드</label>
            <input className="px-input" placeholder="브랜드명" value={brand} onChange={e => setBrand(e.target.value)} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="px-label">참고</label>
            <input className="px-input" placeholder="https://..." value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="px-label">나의 메모 <span style={{ fontSize: 10, color: 'var(--dim-star)', fontWeight: 400 }}>(선택)</span></label>
            <textarea
              className="px-textarea" rows={2}
              placeholder="인사이트, 느낌, 활용 아이디어..."
              value={memo} onChange={e => setMemo(e.target.value)}
              style={{ minHeight: 56 }}
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

          {/* 카피 구조 가이드 */}
          <div style={{ marginTop: 20 }}>
            <div className="px-divider-dim" />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim-star)', marginBottom: 12, letterSpacing: '-0.01em' }}>카피 유형 참고</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {COPY_GUIDE.map((g, i) => (
                <div key={g.type} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 0',
                  borderBottom: i < COPY_GUIDE.length - 1 ? '1px solid var(--card-border)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'Pretendard, sans-serif', fontWeight: 600, flexShrink: 0, minWidth: 88, letterSpacing: '-0.01em' }}>{g.type}</span>
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
                    {entry.createdAt && (
                      <span className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)' }}>
                        {new Date(entry.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {entry.brand && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{entry.brand}</span>}
                    <span className="pixel-font" style={{ marginLeft: 'auto', fontSize: 6.5, color: 'var(--card-border)' }}>
                      {expanded === entry.id ? '▲' : '▼'}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.copy}
                  </p>
                </div>
                {expanded === entry.id && (
                  <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--card-border)', borderTop: 'none', padding: '14px 16px' }}>
                    {editingId === entry.id ? (
                      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <label className="px-label">브랜드</label>
                          <input className="px-input" value={editBrand} onChange={e => setEditBrand(e.target.value)} placeholder="브랜드명" />
                        </div>
                        <div>
                          <label className="px-label">참고 URL</label>
                          <input className="px-input" value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://..." />
                        </div>
                        <div>
                          <label className="px-label">나의 메모</label>
                          <textarea className="px-textarea" rows={3} placeholder="인사이트, 느낌, 활용 아이디어..." value={editMemo} onChange={e => setEditMemo(e.target.value)} style={{ minHeight: 72 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="px-btn px-btn-accent" style={{ fontSize: 11, padding: '5px 14px' }} onClick={e => handleEditSave(entry.id, e)}>저장</button>
                          <button className="px-btn-ghost" style={{ fontSize: 11, padding: '5px 14px' }} onClick={handleEditCancel}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                          {entry.analysis ? (
                            <span className="px-badge px-badge-moon" style={{ fontSize: 12, padding: '3px 10px' }}>
                              {entry.analysis.copyType || entry.analysis.type}
                            </span>
                          ) : <span />}
                          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                            <button onClick={e => handleEditStart(entry, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 12, opacity: 0.7 }}>✎ 수정</button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.7 }}>✕ 삭제</button>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap', marginBottom: 6 }}>
                          {entry.copy}
                        </p>
                        {entry.sourceUrl && <RefLink url={entry.sourceUrl} />}
                        {entry.memo && (
                          <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--accent-dim)', borderLeft: '2px solid var(--accent)', fontSize: 12, color: 'var(--text)', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif', whiteSpace: 'pre-wrap' }}>
                            <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, display: 'block', marginBottom: 3, letterSpacing: '0.02em' }}>MY NOTE</span>
                            {entry.memo}
                          </div>
                        )}
                        {entry.analysis && <div style={{ height: 10 }} />}
                        {entry.analysis && <AnalysisView a={entry.analysis} />}
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

export default function CopyPage() {
  return (
    <Suspense>
      <CopyPageInner />
    </Suspense>
  );
}
