'use client';
import { useState, useEffect } from 'react';
import { loadDB, saveDB, loadSettings, type AuthorStyle, type RewriteLevels } from '@/lib/db';
import { rewriteText, generateVariations, transformAuthorStyle } from '@/lib/openai';

const AUTHORS: AuthorStyle[] = ['윤동주', '김훈', '무라카미 하루키', '헤밍웨이'];

const LEVELS = [
  { key: 'level1', label: 'LEVEL 1', sub: '자연스럽게 수정', cls: 'px-level-1', color: 'var(--dim-star)' },
  { key: 'level2', label: 'LEVEL 2', sub: '표현력 강화',     cls: 'px-level-2', color: 'var(--moon)' },
  { key: 'level3', label: 'LEVEL 3', sub: '작가 수준',       cls: 'px-level-3', color: 'var(--accent)' },
  { key: 'level4', label: 'LEVEL 4', sub: '광고 카피',       cls: 'px-level-4', color: 'var(--good)' },
  { key: 'level5', label: 'LEVEL 5', sub: '기사 리드',       cls: 'px-level-5', color: 'var(--bad)' },
] as const;

function StarLoader({ text, streamLen = 0 }: { text: string; streamLen?: number }) {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(n => (n + 1) % 3), 500); return () => clearInterval(t); }, []);
  return (
    <div className="star-loader" style={{ padding: '24px 0' }}>
      <div className="pixel-font" style={{ fontSize: 14, color: 'var(--moon)', letterSpacing: 6 }}>
        {['★ ☆ ☆', '★ ★ ☆', '★ ★ ★'][f]}
      </div>
      <span className="star-loader-text">
        {streamLen > 0 ? `${streamLen}자 수신 중...` : text}
      </span>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button onClick={doCopy} className="px-btn-ghost-sm" style={{ marginTop: 8, fontSize: 7 }}>
      {copied ? '✓ 복사됨' : '복사'}
    </button>
  );
}

export default function RewritePage() {
  const [original,   setOriginal]   = useState('');
  const [levels,     setLevels]     = useState<RewriteLevels | null>(null);
  const [variations, setVariations] = useState<string[]>([]);
  const [authorResult, setAuthorResult] = useState<Partial<Record<AuthorStyle, string>>>({});
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorStyle>('윤동주');

  const [loadingLevels, setLoadingLevels] = useState(false);
  const [loadingVars,   setLoadingVars]   = useState(false);
  const [loadingAuthor, setLoadingAuthor] = useState(false);
  const [streamLen, setStreamLen] = useState(0);
  const [err,           setErr]           = useState('');

  function checkKey() {
    const s = loadSettings();
    const ok = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!ok) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return null; }
    return s;
  }

  async function handleRewrite() {
    const s = checkKey(); if (!s) return;
    if (!original.trim()) { setErr('원문을 입력해주세요.'); return; }
    setLoadingLevels(true); setErr(''); setLevels(null); setVariations([]); setAuthorResult({}); setStreamLen(0);
    try {
      const res = await rewriteText(s, original,
        (chunk) => setStreamLen(l => l + chunk.length));
      setLevels(res);
      const db = loadDB();
      db.rewrites.push({ id: Date.now(), original, levels: res, createdAt: new Date().toISOString() });
      saveDB(db);
    } catch (e: unknown) {
      setErr('오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoadingLevels(false); }
  }

  async function handleVariations() {
    const s = checkKey(); if (!s) return;
    if (!original.trim()) { setErr('원문을 입력해주세요.'); return; }
    setLoadingVars(true); setErr(''); setStreamLen(0);
    try {
      const res = await generateVariations(s, original,
        (chunk) => setStreamLen(l => l + chunk.length));
      setVariations(res);
    } catch (e: unknown) {
      setErr('오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoadingVars(false); }
  }

  async function handleAuthorStyle() {
    const s = checkKey(); if (!s) return;
    if (!original.trim()) { setErr('원문을 입력해주세요.'); return; }
    setLoadingAuthor(true); setErr('');
    try {
      const res = await transformAuthorStyle(s, original, selectedAuthor);
      setAuthorResult(prev => ({ ...prev, [selectedAuthor]: res }));
    } catch (e: unknown) {
      setErr('오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoadingAuthor(false); }
  }

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>↔ REWRITE LAB</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        같은 내용을 5가지 레벨로, 10가지 버전으로, 또는 특정 작가 스타일로 변환해요.
      </p>

      {/* 원문 입력 */}
      <div className="px-card" style={{ marginBottom: 18 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 원문 입력</div>
        <textarea
          className="px-textarea" rows={5}
          placeholder={"다시 쓰고 싶은 문장이나 단락을 입력해주세요..."}
          value={original} onChange={e => setOriginal(e.target.value)}
          style={{ minHeight: 110 }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="px-btn px-btn-accent" onClick={handleRewrite} disabled={loadingLevels || loadingVars || loadingAuthor}>
            {loadingLevels ? '★ 생성 중...' : '✦ 5레벨 다시쓰기'}
          </button>
          <button className="px-btn-ghost" onClick={handleVariations} disabled={loadingLevels || loadingVars || loadingAuthor}>
            {loadingVars ? '★ 생성 중...' : '◈ 10가지 버전'}
          </button>
        </div>
        {err && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--bad)', padding: '8px 12px', borderLeft: '2px solid var(--bad-border)', background: 'var(--bad-dim)' }}>
            {err}
          </div>
        )}
      </div>

      {/* 5레벨 결과 */}
      {(loadingLevels || levels) && (
        <div style={{ marginBottom: 18 }}>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ 5 LEVELS</div>
          {loadingLevels
            ? <StarLoader text="5가지 레벨로 다시 쓰고 있어요..." streamLen={streamLen} />
            : levels && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {LEVELS.map(lv => (
                  <div key={lv.key} className={`px-level-card ${lv.cls}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="pixel-font" style={{ fontSize: 7.5, color: lv.color }}>{lv.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--dim-star)' }}>{lv.sub}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.85, margin: 0, fontFamily: 'Pretendard, sans-serif', whiteSpace: 'pre-wrap' }}>
                      {levels[lv.key]}
                    </p>
                    <CopyBtn text={levels[lv.key]} />
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* 10가지 버전 */}
      {(loadingVars || variations.length > 0) && (
        <div style={{ marginBottom: 18 }}>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>◈ 같은 의미 10가지 버전</div>
          {loadingVars
            ? <StarLoader text="10가지 버전을 생성하고 있어요..." streamLen={streamLen} />
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {variations.map((v, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--card-border)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <span className="pixel-font" style={{ fontSize: 7, color: 'var(--accent)', marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, fontFamily: 'Pretendard, sans-serif' }}>{v}</span>
                      </div>
                    </div>
                    <CopyBtn text={v} />
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* 작가 스타일 변환 */}
      <div className="px-card">
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 작가 스타일 변환</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          {AUTHORS.map(a => (
            <button
              key={a}
              onClick={() => setSelectedAuthor(a)}
              className="pixel-font"
              style={{
                padding: '8px 16px', fontSize: 8, cursor: 'pointer', border: 'none',
                background: selectedAuthor === a ? 'var(--accent)' : 'var(--card-border)',
                color: selectedAuthor === a ? '#1a0a3a' : 'var(--dim-star)',
                clipPath: selectedAuthor === a
                  ? 'polygon(5px 0%,calc(100% - 5px) 0%,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0% calc(100% - 5px),0% 5px)'
                  : 'none',
                transition: 'all .1s',
              }}
            >
              {a}
            </button>
          ))}
          <button className="px-btn-ghost" onClick={handleAuthorStyle} disabled={loadingAuthor}>
            {loadingAuthor ? '★ 변환 중...' : '→ 변환'}
          </button>
        </div>

        {loadingAuthor && <StarLoader text={`${selectedAuthor} 스타일로 변환 중...`} />}

        {!loadingAuthor && authorResult[selectedAuthor] && (
          <div className="animate-fade-in" style={{ padding: '16px 18px', background: 'rgba(167,139,250,0.06)', border: '1px solid var(--accent)' }}>
            <div className="pixel-font" style={{ fontSize: 7, color: 'var(--accent)', marginBottom: 10 }}>{selectedAuthor} 스타일</div>
            <p className="serif-font" style={{ fontSize: 14, color: 'var(--text)', lineHeight: 2.1, margin: 0, whiteSpace: 'pre-wrap' }}>
              {authorResult[selectedAuthor]}
            </p>
            <CopyBtn text={authorResult[selectedAuthor]!} />
          </div>
        )}

        {!loadingAuthor && !authorResult[selectedAuthor] && (
          <div className="px-empty" style={{ padding: '24px 0' }}>
            <p className="px-empty-text" style={{ fontSize: 12 }}>원문을 입력하고 작가를 선택한 뒤 변환 버튼을 눌러주세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
