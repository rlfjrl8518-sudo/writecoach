'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  loadDB, saveDB, saveDBLocal, loadSettings,
  type ExpressionLabEntry, type ExpressionAnalysis, type DictResult,
  type ExpressionCategory,
} from '@/lib/db';
import { pushData } from '@/lib/supabase';
import { analyzeExpression, suggestExpressions, type ExpressionSuggestion } from '@/lib/openai';

const CATEGORIES: ExpressionCategory[] = ['평가 표현', '감정 표현', '행동 표현', '상태 표현', '묘사 표현', '시간 표현', '공간 표현', '비유 표현', '설득 표현'];

interface BadgeStyle { bg: string; color: string }
const CATEGORY_STYLE: Record<string, BadgeStyle> = {
  '평가 표현': { bg: 'var(--accent-dim)', color: 'var(--accent)' },
  '감정 표현': { bg: 'var(--bad-dim)',    color: 'var(--bad)' },
  '행동 표현': { bg: 'var(--moon-dim)',   color: 'var(--moon)' },
  '상태 표현': { bg: 'var(--bg-input)',   color: 'var(--dim-star)' },
  '묘사 표현': { bg: 'var(--good-dim)',   color: 'var(--good)' },
  '시간 표현': { bg: 'var(--accent-dim)', color: 'var(--accent)' },
  '공간 표현': { bg: 'var(--moon-dim)',   color: 'var(--moon)' },
  '비유 표현': { bg: 'var(--good-dim)',   color: 'var(--good)' },
  '설득 표현': { bg: 'var(--bad-dim)',    color: 'var(--bad)' },
};
const LEVEL_STYLE: Record<string, BadgeStyle> = {
  '초급': { bg: 'var(--good-dim)', color: 'var(--good)' },
  '중급': { bg: 'var(--moon-dim)', color: 'var(--moon)' },
  '고급': { bg: 'var(--bad-dim)',  color: 'var(--bad)' },
};
const badgeStyle = (m: Record<string, BadgeStyle>, key?: string): BadgeStyle => m[key ?? ''] ?? { bg: 'var(--bg-input)', color: 'var(--dim-star)' };

function StarLoader({ streamLen }: { streamLen: number }) {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(n => (n + 1) % 3), 500); return () => clearInterval(t); }, []);
  return (
    <div className="star-loader">
      <div className="pixel-font" style={{ fontSize: 16, color: 'var(--moon)', letterSpacing: 8 }}>
        {['★ ☆ ☆', '★ ★ ☆', '★ ★ ★'][f]}
      </div>
      <span className="star-loader-text">{streamLen > 0 ? `${streamLen}자 수신 중...` : '연결 중...'}</span>
    </div>
  );
}

function ExprSection({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="pixel-font" style={{ fontSize: 6.5, color: color || 'var(--dim-star)', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

function AnalysisView({ a, dict, dictSearched }: { a: ExpressionAnalysis; dict?: DictResult; dictSearched?: boolean }) {
  return (
    <div className="animate-fade-in">
      {dictSearched && !dict && (
        <div style={{
          marginBottom: 14, padding: '10px 14px',
          background: 'var(--bad-dim)', border: '1px solid var(--bad-border)',
          borderRadius: 8, fontSize: 12, color: 'var(--bad)', lineHeight: 1.7,
          fontFamily: 'Pretendard, sans-serif',
        }}>
          ⚠ 표준 국어 사전에 등재되지 않은 표현입니다. 아래 내용은 AI가 추론한 것으로 실제 용법과 다를 수 있어요.
        </div>
      )}
      <ExprSection label="✦ 쉬운 의미">
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, padding: '10px 14px', background: 'var(--bg-subtle)', borderLeft: '2px solid var(--moon)', fontWeight: 500 }}>
          {a.easyMeaning}
        </div>
      </ExprSection>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {a.category && <span className="px-badge" style={badgeStyle(CATEGORY_STYLE, a.category)}>{a.category}</span>}
        {a.sense && <span className="px-badge px-badge-moon">{a.sense}</span>}
        {a.level && <span className="px-badge" style={badgeStyle(LEVEL_STYLE, a.level)}>{a.level}</span>}
      </div>
      {a.useContexts.length > 0 && (
        <ExprSection label="✦ 추천 상황" color="var(--accent)">
          {a.useContexts.map(c => <span key={c} className="px-tag-expr">{c}</span>)}
        </ExprSection>
      )}
      {a.similar.length > 0 && (
        <ExprSection label="✦ 유사 표현" color="var(--good)">
          {a.similar.map(s => <span key={s} className="px-tag-expr">{s}</span>)}
        </ExprSection>
      )}
      {a.opposite.length > 0 && (
        <ExprSection label="✦ 반대 표현" color="var(--bad)">
          {a.opposite.map(s => <span key={s} className="px-tag-expr">{s}</span>)}
        </ExprSection>
      )}
      <ExprSection label="✦ 응용 예문" color="var(--dim-star)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {a.sampleSentences.descriptive && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}><b style={{ color: 'var(--good)' }}>묘사문 ·</b> {a.sampleSentences.descriptive}</div>}
          {a.sampleSentences.explanatory && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}><b style={{ color: 'var(--accent)' }}>설명문 ·</b> {a.sampleSentences.explanatory}</div>}
          {a.sampleSentences.copy && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}><b style={{ color: 'var(--bad)' }}>광고 카피 ·</b> {a.sampleSentences.copy}</div>}
        </div>
      </ExprSection>
      {a.mission && (
        <ExprSection label="✦ 표현 미션" color="var(--moon)">
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, padding: '10px 14px', background: 'var(--moon-dim)', borderLeft: '2px solid var(--moon)' }}>
            {a.mission}
          </div>
        </ExprSection>
      )}
      {dict && (dict.meaning || dict.examples.length > 0) && (
        <ExprSection label="✦ 우리말샘 사전" color="var(--dim-star)">
          {dict.meaning && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, marginBottom: 6 }}>{dict.pos && <span style={{ color: 'var(--dim-star)' }}>[{dict.pos}] </span>}{dict.meaning}</div>}
          {dict.examples.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--dim-star)', lineHeight: 1.8 }}>
              {dict.examples.slice(0, 3).map((ex, i) => <li key={i}>{ex}</li>)}
            </ul>
          )}
        </ExprSection>
      )}
    </div>
  );
}

interface RankedSuggestion extends ExpressionSuggestion { inDict: boolean; preview?: string; isQuery?: boolean }

export default function ExpressionsPage() {
  const [query, setQuery] = useState('');
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RankedSuggestion[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [streamLen, setStreamLen] = useState(0);
  const [dictNote, setDictNote] = useState('');
  const [result, setResult] = useState<ExpressionAnalysis | null>(null);
  const [resultDict, setResultDict] = useState<DictResult | undefined>(undefined);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [err, setErr] = useState('');
  const [entries, setEntries] = useState<ExpressionLabEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [searchedText, setSearchedText] = useState('');
  const [savedNow, setSavedNow] = useState(false);

  useEffect(() => {
    const db = loadDB();
    setEntries([...(db.expressionEntries ?? [])].reverse());
  }, [saved]);

  async function lookupDict(q: string): Promise<DictResult | undefined> {
    try {
      const res = await fetch(`/api/urimalsam?q=${encodeURIComponent(q)}`);
      const json = await res.json() as { ok: boolean; data?: DictResult; error?: string };
      if (json.ok && json.data) return json.data;
      setDictNote(json.error || '사전 검색 결과가 없어요. AI가 직접 의미를 추론해요.');
      return undefined;
    } catch {
      setDictNote('사전 조회에 실패했어요. AI가 직접 의미를 추론해요.');
      return undefined;
    }
  }

  // 추천 후보를 사전에 조용히 대조 — UI 메시지(dictNote)는 건드리지 않는다
  async function peekDict(q: string): Promise<DictResult | undefined> {
    try {
      const res = await fetch(`/api/urimalsam?q=${encodeURIComponent(q)}`);
      const json = await res.json() as { ok: boolean; data?: DictResult };
      return json.ok ? json.data : undefined;
    } catch { return undefined; }
  }

  function checkApiKey(): boolean {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return false; }
    return true;
  }

  async function handleSuggest() {
    if (!checkApiKey()) return;
    const q = query.trim();
    if (!q) { setErr('찾고 싶은 느낌·상황이나 표현을 입력해주세요.'); return; }
    setSuggestLoading(true); setErr(''); setSuggestions(null); setResult(null); setSearchedText('');

    try {
      const wordOnly = /단어/.test(q);
      const list = await suggestExpressions(loadSettings(), q);
      const candidates = wordOnly ? list.filter(it => !it.text.includes(' ')) : list;
      // 입력한 단어 자체도 검색 결과에 포함시킨다 (지금까진 비슷한/대체 표현만 나왔음)
      const isSingleWord = !q.includes(' ');
      const withQuery: (ExpressionSuggestion & { isQuery?: boolean })[] =
        isSingleWord && !candidates.some(c => c.text === q)
          ? [{ text: q, reason: '', isQuery: true }, ...candidates]
          : candidates;
      const checked: RankedSuggestion[] = await Promise.all(withQuery.map(async it => {
        const dict = await peekDict(it.text);
        return { ...it, inDict: !!dict, preview: dict?.meaning };
      }));
      setSuggestions([...checked.filter(c => c.isQuery), ...checked.filter(c => !c.isQuery && c.inDict), ...checked.filter(c => !c.isQuery && !c.inDict)]);
    } catch (e: unknown) {
      setErr('추천 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setSuggestLoading(false); }
  }

  async function handleInspect(candidate: string) {
    if (!checkApiKey()) return;
    setDetailLoading(true); setErr(''); setResult(null); setStreamLen(0); setDictNote(''); setSavedNow(false);

    try {
      const dict = await lookupDict(candidate);
      const analysis = await analyzeExpression(loadSettings(), candidate, dict ?? null,
        (chunk) => setStreamLen(l => l + chunk.length));
      setResult(analysis);
      setResultDict(dict);
      setSearchedText(candidate);
      setAnalysisOpen(true);
      setSavedNow(entries.some(e => e.text === candidate));
    } catch (e: unknown) {
      setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setDetailLoading(false); }
  }

  function handleSaveToLab() {
    if (!result || !searchedText) return;
    const db = loadDB();
    db.expressionEntries = db.expressionEntries ?? [];
    if (db.expressionEntries.some(e => e.text === searchedText)) { setSavedNow(true); return; }
    db.expressionEntries.push({
      id: Date.now(), text: searchedText, dict: resultDict, analysis: result,
      favorite: false, useCount: 0, createdAt: new Date().toISOString(),
    });
    saveDB(db);
    setSavedNow(true);
    setSaved(v => !v);
  }

  async function handleDelete(id: number) {
    if (!confirm('이 표현을 삭제할까요?')) return;
    const db = loadDB();
    db.expressionEntries = (db.expressionEntries ?? []).filter(e => e.id !== id);
    db._deletedIds = [...(db._deletedIds ?? []), id];
    saveDBLocal(db);
    setSaved(v => !v);
    try { await pushData(db); } catch {}
  }

  function handleToggleFavorite(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    const db = loadDB();
    const found = (db.expressionEntries ?? []).find(x => x.id === id);
    if (found) { found.favorite = !found.favorite; saveDB(db); }
    setSaved(v => !v);
  }

  function handleMarkUsed(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    const db = loadDB();
    const found = (db.expressionEntries ?? []).find(x => x.id === id);
    if (found) { found.useCount++; found.lastStudiedAt = new Date().toISOString(); saveDB(db); }
    setSaved(v => !v);
  }

  const filtered = entries.filter(e =>
    (!filterCategory || e.analysis?.category === filterCategory) &&
    (!favoriteOnly || e.favorite)
  );

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>辭 표현 사전</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        글이 막힐 때, 표현하고 싶은 느낌이나 상황을 적으면 어울리는 표현을 AI가 추천해줘요.
      </p>

      {/* 서브 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Link href="/writing" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
            border: '1.5px solid var(--card-border)', background: 'transparent', color: 'var(--dim-star)',
            fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
          }}>✏ 글쓰기</button>
        </Link>
        <button style={{
          padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
          border: '1.5px solid var(--accent)', background: 'var(--accent)', color: '#fff',
          fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
        }}>辭 표현사전</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }} className="grid-2">

        {/* 입력 */}
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 표현 찾기</div>
          <div style={{ marginBottom: 12 }}>
            <label className="px-label">어떤 느낌·상황을 표현하고 싶나요?</label>
            <input
              className="px-input" placeholder="예) 쓸쓸한 가을 저녁 분위기, 예고 없이 닥친 위험, 빛바랜..."
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !suggestLoading) handleSuggest(); }}
            />
          </div>
          <button className="px-btn px-btn-accent" onClick={handleSuggest} disabled={suggestLoading}>
            {suggestLoading ? '★ 추천 중...' : '✦ 표현 추천받기'}
          </button>
          {err && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--bad)', padding: '8px 12px', borderLeft: '2px solid var(--bad-border)', background: 'var(--bad-dim)' }}>
              {err}
            </div>
          )}

          {suggestions && suggestions.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="px-divider-dim" />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim-star)', marginBottom: 12, letterSpacing: '-0.01em' }}>검색 결과 — 골라서 자세히 보기</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestions.map(sug => (
                  <button
                    key={sug.text}
                    onClick={() => handleInspect(sug.text)}
                    disabled={detailLoading}
                    style={{
                      textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: 8,
                      border: `1.5px solid ${searchedText === sug.text ? 'var(--accent)' : sug.isQuery ? 'var(--moon)' : 'var(--card-border)'}`,
                      background: searchedText === sug.text ? 'var(--accent-dim)' : 'var(--bg-subtle)',
                      fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{sug.text}</span>
                      {sug.isQuery && (
                        <span className="px-badge" style={{ background: 'var(--moon-dim)', color: 'var(--moon)', fontSize: 10 }}>
                          검색어
                        </span>
                      )}
                      <span className="px-badge" style={sug.inDict
                        ? { background: 'var(--good-dim)', color: 'var(--good)', fontSize: 10 }
                        : { background: 'var(--bad-dim)', color: 'var(--bad)', fontSize: 10, border: '1px solid var(--bad-border)' }}>
                        {sug.inDict ? '사전 확인' : '미확인'}
                      </span>
                    </div>
                    {sug.preview && <div style={{ fontSize: 11.5, color: 'var(--dim-star)', marginTop: 3, lineHeight: 1.5 }}>{sug.preview}</div>}
                    {sug.reason && <div style={{ fontSize: 11.5, color: 'var(--dim-star)', marginTop: 3, lineHeight: 1.5, fontStyle: 'italic' }}>{sug.reason}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 분석 결과 */}
        <div className="px-card" style={{ minHeight: detailLoading || !result ? 280 : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: analysisOpen ? 14 : 0 }}>
            <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)' }}>✦ {searchedText || '분석 결과'}</div>
            {(result || detailLoading) && (
              <button onClick={() => setAnalysisOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--card-border)', fontSize: 11, lineHeight: 1, padding: '2px 4px' }}>
                {analysisOpen ? '▲ 접기' : '▼ 펼치기'}
              </button>
            )}
          </div>
          {analysisOpen && detailLoading && <StarLoader streamLen={streamLen} />}
          {analysisOpen && !detailLoading && !result && (
            <div className="px-empty">
              <div className="px-empty-icon">辭</div>
              <p className="px-empty-text">느낌·상황을 입력해 표현을 추천받고<br />그중 하나를 골라보세요</p>
            </div>
          )}
          {dictNote && result && (
            <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--dim-star)' }}>{dictNote}</div>
          )}
          {analysisOpen && result && (
            <>
              <AnalysisView a={result} dict={resultDict} dictSearched={true} />
              <button
                className={savedNow ? 'px-btn-ghost' : 'px-btn px-btn-accent'}
                style={{ marginTop: 4 }}
                onClick={handleSaveToLab}
                disabled={savedNow}
              >
                {savedNow ? '✓ 표현사전에 저장됨' : '辭 내 표현사전에 저장'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 표현 목록 */}
      {entries.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <div className="px-sec-title" style={{ marginBottom: 0 }}>✦ 등록된 표현 ({filtered.length}/{entries.length}개)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="px-select" style={{ fontSize: 12, padding: '6px 10px' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">전체 카테고리</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                className={favoriteOnly ? 'px-btn px-btn-moon' : 'px-btn-ghost'}
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={() => setFavoriteOnly(v => !v)}
              >★ 즐겨찾기</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(entry => {
              const a = entry.analysis;
              return (
                <div key={entry.id}>
                  <div className="px-card" style={{ cursor: 'pointer', padding: '12px 16px' }} onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{entry.text}</span>
                          {a?.category && <span className="px-badge" style={{ ...badgeStyle(CATEGORY_STYLE, a.category), fontSize: 11 }}>{a.category}</span>}
                          {a?.level && <span className="px-badge" style={{ ...badgeStyle(LEVEL_STYLE, a.level), fontSize: 11 }}>{a.level}</span>}
                          {entry.useCount > 0 && <span style={{ fontSize: 10, color: 'var(--dim-star)' }}>· {entry.useCount}회 사용</span>}
                        </div>
                        {a?.easyMeaning && <p style={{ fontSize: 12.5, color: 'var(--dim-star)', lineHeight: 1.6, margin: 0 }}>{a.easyMeaning}</p>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                        <button onClick={e => handleToggleFavorite(entry.id, e)} title="즐겨찾기"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: entry.favorite ? 'var(--moon)' : 'var(--card-border)' }}>
                          {entry.favorite ? '★' : '☆'}
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.6 }}>✕</button>
                      </div>
                    </div>
                  </div>
                  {expanded === entry.id && (
                    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--card-border)', borderTop: 'none', padding: '14px 16px' }}>
                      {a && <AnalysisView a={a} dict={entry.dict} dictSearched={!!entry.analysis} />}
                      <button className="px-btn-ghost" style={{ fontSize: 11, padding: '5px 14px', marginTop: 4 }} onClick={e => handleMarkUsed(entry.id, e)}>
                        ✓ 이 표현 사용했어요
                      </button>
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
