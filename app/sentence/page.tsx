'use client';
import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  loadDB, saveDB, saveDBLocal, loadSettings, groupByMonth,
  mergeSentenceType, mergeSentenceExpressions,
  mergeSentenceRole, mergeSentenceExpressionType,
  type SentenceEntry, type SentenceAnalysis, type SentenceExamples, type SentenceType, type ImageEntry,
} from '@/lib/db';
import { analyzeSentence, generateSentenceExamples } from '@/lib/openai';
import { pushData } from '@/lib/supabase';

const SENTENCE_TYPES: SentenceType[] = ['기사 리드', '칼럼', '에세이', '소설', 'SNS 게시글', '기타'];

function RefLink({ url, style }: { url: string; style?: React.CSSProperties }) {
  return (
    <a
      href={url.trim()} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{ fontSize: 10, marginTop: 3, display: 'block', color: 'var(--accent)', opacity: 0.8, textDecoration: 'none', wordBreak: 'break-all', ...style }}
    >
      🔗 {url}
    </a>
  );
}

function StarLoader({ streamLen, label }: { streamLen: number; label?: string }) {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(n => (n + 1) % 3), 500); return () => clearInterval(t); }, []);
  return (
    <div className="star-loader">
      <div className="pixel-font" style={{ fontSize: 16, color: 'var(--moon)', letterSpacing: 8 }}>
        {['★ ☆ ☆', '★ ★ ☆', '★ ★ ★'][f]}
      </div>
      <span className="star-loader-text">
        {streamLen > 0 ? `${streamLen}자 수신 중...` : (label || '연결 중...')}
      </span>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="pixel-font" style={{ fontSize: 6.5, color: color || 'var(--dim-star)', marginBottom: 7 }}>{title}</div>
      {children}
    </div>
  );
}

const ROLE_COLOR: Record<string, string> = {
  '장면 묘사':  'var(--good)',
  '대상 설명':  'var(--accent)',
  '행동 전개':  'var(--moon)',
  '감정 표현':  '#E07B7B',
  '분위기 형성': '#9B7BE0',
  '생각 전달':  'var(--dim-star)',
  '정보 전달':  'var(--card-border)',
};

const EXPR_COLOR: Record<string, string> = {
  '구체적 표현': 'var(--accent)',
  '추상적 표현': 'var(--dim-star)',
  '감각 표현':  'var(--good)',
  '감정 표현':  '#E07B7B',
  '비유 표현':  '#9B7BE0',
  '강조 표현':  'var(--moon)',
};

function ExamplesView({ ex }: { ex: SentenceExamples }) {
  const sections: { key: keyof SentenceExamples; title: string; color: string }[] = [
    { key: 'sameStructure', title: '같은 역할 예문', color: 'var(--accent)' },
    { key: 'applied',       title: '응용 변형 예문', color: 'var(--moon)' },
    { key: 'copyExamples',  title: '광고 카피 응용', color: 'var(--bad)' },
    { key: 'descriptive',   title: '묘사문 응용',     color: 'var(--good)' },
  ];
  return (
    <div style={{ marginTop: 14 }}>
      {sections.map(({ key, title, color }) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color, marginBottom: 8 }}>◎ {title}</div>
          {ex[key].map((line, i) => (
            <div key={i} style={{
              padding: '8px 12px', marginBottom: 5,
              background: 'var(--bg-subtle)', borderLeft: `2px solid ${color}`,
              fontSize: 12, color: 'var(--text)', lineHeight: 1.8,
              fontFamily: 'Pretendard, sans-serif',
            }}>
              {line}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function AnalysisView({
  a, entry, onGenerateExamples, generatingExamples, exStreamLen,
}: {
  a: SentenceAnalysis;
  entry?: SentenceEntry;
  onGenerateExamples?: () => void;
  generatingExamples?: boolean;
  exStreamLen?: number;
}) {
  const isNew = !!(a.sentenceRole);
  const [savedExprs, setSavedExprs] = useState<Set<string>>(new Set());

  function saveExpr(text: string) {
    const db = loadDB();
    db.expressionEntries = db.expressionEntries ?? [];
    if (!db.expressionEntries.some(e => e.text === text)) {
      db.expressionEntries.push({ id: Date.now(), text, favorite: false, useCount: 0, createdAt: new Date().toISOString() });
      saveDB(db);
    }
    setSavedExprs(s => new Set(s).add(text));
  }

  function ExprTag({ text }: { text: string }) {
    const isSaved = savedExprs.has(text);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, margin: '2px 2px' }}>
        <span className="px-tag-expr" style={{ margin: 0 }}>{text}</span>
        <button onClick={() => saveExpr(text)} disabled={isSaved} title="표현사전에 저장"
          style={{ background: 'none', border: 'none', cursor: isSaved ? 'default' : 'pointer', color: isSaved ? 'var(--good)' : 'var(--dim-star)', fontSize: 12, padding: 0, opacity: isSaved ? 1 : 0.6 }}>
          {isSaved ? '✓' : '辭+'}
        </button>
      </span>
    );
  }

  if (!isNew) {
    return (
      <div className="animate-fade-in">
        {a.sentenceKind && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'Pretendard, sans-serif', fontWeight: 600 }}>{a.sentenceKind}</span>
            {a.sentenceRoleDesc && <div style={{ fontSize: 12, color: 'var(--dim-star)', marginTop: 4, lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif' }}>{a.sentenceRoleDesc}</div>}
          </div>
        )}
        {(a.learningPoints || []).length > 0 && (
          <Section title="✦ 학습 포인트" color="var(--accent)">
            {(a.learningPoints || []).map((pt, i) => (
              <div key={i} style={{ padding: '7px 12px', marginBottom: 5, background: 'var(--bg-subtle)', borderLeft: '2px solid var(--accent)', fontSize: 12, color: 'var(--text)', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif' }}>
                <span className="pixel-font" style={{ fontSize: 7, color: 'var(--accent)', marginRight: 6 }}>0{i + 1}</span>
                {pt}
              </div>
            ))}
          </Section>
        )}
        {(a.keyExpressions || []).length > 0 && (
          <Section title="✦ 핵심 표현" color="var(--good)">
            {(a.keyExpressions || []).map(e => <ExprTag key={e} text={e} />)}
          </Section>
        )}
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 12, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif' }}>
          이전 분석 형식입니다. 재분석하면 새 형식으로 볼 수 있어요.
        </div>
        {onGenerateExamples && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
            {!entry?.examples && !generatingExamples && (
              <button className="px-btn-ghost-sm" onClick={onGenerateExamples} style={{ fontSize: 10 }}>
                ✦ 예문 20개 생성
              </button>
            )}
            {generatingExamples && <StarLoader streamLen={exStreamLen || 0} label="예문 생성 중..." />}
            {entry?.examples && <ExamplesView ex={entry.examples} />}
          </div>
        )}
      </div>
    );
  }

  const roleColor = ROLE_COLOR[a.sentenceRole || ''] || 'var(--accent)';
  const exprColor = EXPR_COLOR[a.expressionType || ''] || 'var(--accent)';

  return (
    <div className="animate-fade-in">

      {/* 1. 문장의 역할 */}
      <div style={{
        marginBottom: 14, padding: '14px 16px',
        background: 'var(--bg-subtle)',
        border: `1.5px solid ${roleColor}22`,
        borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)' }}>문장의 역할</div>
          <span style={{
            fontSize: 13, fontWeight: 700, color: roleColor,
            background: `${roleColor}18`, padding: '3px 12px',
            borderRadius: 20, fontFamily: 'Pretendard, sans-serif',
          }}>
            {a.sentenceRole}
          </span>
        </div>
        {a.sentenceRoleDesc && (
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, fontFamily: 'Pretendard, sans-serif' }}>
            {a.sentenceRoleDesc}
          </div>
        )}
      </div>

      {/* 2. 사용된 표현 */}
      <div style={{
        marginBottom: 14, padding: '14px 16px',
        background: 'var(--bg-subtle)',
        border: `1.5px solid ${exprColor}22`,
        borderRadius: 10,
      }}>
        <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', marginBottom: 8 }}>사용된 표현</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: a.expressionSense ? 8 : 0, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: exprColor,
            background: `${exprColor}18`, padding: '3px 12px',
            borderRadius: 20, fontFamily: 'Pretendard, sans-serif',
          }}>
            {a.expressionType}
          </span>
          {a.expressionSense && (
            <span style={{
              fontSize: 12, color: 'var(--good)',
              background: 'var(--good-dim)', padding: '3px 10px',
              borderRadius: 20, fontFamily: 'Pretendard, sans-serif',
              border: '1px solid var(--good-border)',
            }}>
              {a.expressionSense}
            </span>
          )}
        </div>
        {a.expressionEffect && (
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, fontFamily: 'Pretendard, sans-serif' }}>
            {a.expressionEffect}
          </div>
        )}
      </div>

      {/* 3. 문장의 강점 */}
      {a.sentenceStrengths && (
        <div style={{ marginBottom: 14 }}>
          <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--good-border)', marginBottom: 7 }}>✦ 문장의 강점</div>
          <div style={{
            fontSize: 13, color: 'var(--text)', lineHeight: 1.9,
            padding: '10px 14px', background: 'var(--good-dim)',
            borderLeft: '3px solid var(--good-border)', borderRadius: '0 6px 6px 0',
            fontFamily: 'Pretendard, sans-serif',
          }}>
            {a.sentenceStrengths}
          </div>
        </div>
      )}

      {/* 핵심 표현 */}
      {(a.keyExpressions || []).length > 0 && (
        <Section title="✦ 핵심 표현" color="var(--good)">
          {(a.keyExpressions || []).map(e => <ExprTag key={e} text={e} />)}
        </Section>
      )}

      {/* 예문 생성 */}
      {onGenerateExamples && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
          {!entry?.examples && !generatingExamples && (
            <button
              className="px-btn-ghost-sm"
              onClick={onGenerateExamples}
              style={{ fontSize: 10 }}
            >
              ✦ 예문 20개 생성 (같은 역할·응용·카피·묘사)
            </button>
          )}
          {generatingExamples && <StarLoader streamLen={exStreamLen || 0} label="예문 생성 중..." />}
          {entry?.examples && <ExamplesView ex={entry.examples} />}
        </div>
      )}
    </div>
  );
}

function SentencePageInner() {
  const [source,      setSource]      = useState('');
  const [sourceUrl,   setSourceUrl]   = useState('');
  const [sentence,    setSentence]    = useState('');
  const [sentType,    setSentType]    = useState<SentenceType>('기타');
  const [loading,     setLoading]     = useState(false);
  const [streamLen,   setStreamLen]   = useState(0);
  const [result,      setResult]      = useState<SentenceAnalysis | null>(null);
  const [resultEntry, setResultEntry] = useState<SentenceEntry | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [err,         setErr]         = useState('');
  const [history,     setHistory]     = useState<SentenceEntry[]>([]);
  const [expanded,    setExpanded]    = useState<number | null>(null);
  const [saved,       setSaved]       = useState(false);
  const [genEx,       setGenEx]       = useState(false);
  const [exStreamLen, setExStreamLen] = useState(0);
  const [memo,        setMemo]        = useState('');
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editSource,  setEditSource]  = useState('');
  const [editUrl,     setEditUrl]     = useState('');
  const [editMemo,    setEditMemo]    = useState('');
  const [openMonths,  setOpenMonths]  = useState<Set<string>>(new Set());

  const searchParams = useSearchParams();
  const [activeTab,   setActiveTab]   = useState<'text' | 'image'>(() =>
    searchParams.get('tab') === 'image' ? 'image' : 'text'
  );
  const [imgPreview,  setImgPreview]  = useState<string | null>(null);
  const [imgNote,     setImgNote]     = useState('');
  const [imgSaving,   setImgSaving]   = useState(false);
  const [imgHistory,  setImgHistory]  = useState<ImageEntry[]>([]);
  const [imgExpanded, setImgExpanded] = useState<number | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const db = loadDB();
    setHistory([...db.sentences].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setImgHistory([...(db.images ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [saved]);

  const monthGroups = useMemo(() => groupByMonth(history, e => e.createdAt), [history]);

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
    setActiveTab('text');
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
    if (!sentence.trim()) { setErr('문장을 입력해주세요.'); return; }
    setLoading(true); setErr(''); setResult(null); setResultEntry(null); setStreamLen(0);
    try {
      const res = await analyzeSentence(s, sentence, source, sentType,
        (chunk) => setStreamLen(l => l + chunk.length));
      setResult(res);
      setAnalysisOpen(true);
      const db = loadDB();
      const entry: SentenceEntry = {
        id: Date.now(), source, sourceUrl: sourceUrl || undefined, sentence, memo: memo || undefined, type: sentType,
        analysis: res, createdAt: new Date().toISOString(),
      };
      db.sentences.push(entry);
      mergeSentenceType(db, sentType);
      if (res.sentenceRole) mergeSentenceRole(db, res.sentenceRole);
      if (res.expressionType) mergeSentenceExpressionType(db, res.expressionType);
      if (res.keyExpressions && res.keyExpressions.length > 0) {
        mergeSentenceExpressions(db, res.keyExpressions);
      }
      saveDB(db);
      setResultEntry(entry);
      setSentence(''); setSource(''); setSourceUrl(''); setMemo('');
      setSaved(v => !v);
    } catch (e: unknown) {
      setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  async function handleGenerateExamples(entryId?: number) {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }

    const targetEntry = entryId
      ? history.find(e => e.id === entryId)
      : resultEntry;
    if (!targetEntry?.analysis) return;

    setGenEx(true); setExStreamLen(0);
    try {
      const role = targetEntry.analysis.sentenceRole || '';
      const ex = await generateSentenceExamples(s, targetEntry.sentence, role,
        (chunk) => setExStreamLen(l => l + chunk.length));
      const db = loadDB();
      const found = db.sentences.find(e => e.id === targetEntry.id);
      if (found) { found.examples = ex; saveDB(db); }
      if (!entryId && resultEntry) setResultEntry({ ...resultEntry, examples: ex });
      setSaved(v => !v);
    } catch (e: unknown) {
      setErr('예문 생성 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setGenEx(false); }
  }

  function handleSaveOnly() {
    if (!sentence.trim()) { setErr('문장을 입력해주세요.'); return; }
    const db = loadDB();
    db.sentences.push({ id: Date.now(), source, sourceUrl: sourceUrl || undefined, sentence, memo: memo || undefined, type: sentType, createdAt: new Date().toISOString() });
    mergeSentenceType(db, sentType);
    saveDB(db);
    setSentence(''); setSource(''); setSourceUrl(''); setMemo(''); setSaved(v => !v);
  }

  async function handleDelete(id: number) {
    if (!confirm('이 문장을 삭제할까요?')) return;
    const db = loadDB();
    db.sentences = db.sentences.filter(s => s.id !== id);
    db._deletedIds = [...(db._deletedIds ?? []), id];
    saveDBLocal(db);
    setSaved(v => !v);
    try { await pushData(db); } catch {}
  }

  function handleEditStart(entry: SentenceEntry, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(entry.id);
    setEditSource(entry.source || '');
    setEditUrl(entry.sourceUrl || '');
    setEditMemo(entry.memo || '');
  }

  function handleEditSave(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    const db = loadDB();
    const found = db.sentences.find(s => s.id === id);
    if (found) { found.source = editSource; found.sourceUrl = editUrl || undefined; found.memo = editMemo || undefined; saveDB(db); }
    setEditingId(null); setSaved(v => !v);
  }

  function handleEditCancel(e: React.MouseEvent) {
    e.stopPropagation(); setEditingId(null);
  }

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 900;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
      img.src = url;
    });
  }

  async function handleImgSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setImgPreview(compressed);
    e.target.value = '';
  }

  async function handleImgSave() {
    if (!imgPreview) return;
    setImgSaving(true);
    try {
      const db = loadDB();
      db.images.push({ id: Date.now(), imageData: imgPreview, note: imgNote.trim(), createdAt: new Date().toISOString() });
      saveDB(db);
      setImgPreview(null);
      setImgNote('');
      setSaved(v => !v);
    } finally { setImgSaving(false); }
  }

  async function handleImgDelete(id: number) {
    if (!confirm('이 이미지를 삭제할까요?')) return;
    const db = loadDB();
    db.images = db.images.filter(i => i.id !== id);
    db._deletedIds = [...(db._deletedIds ?? []), id];
    saveDBLocal(db);
    setSaved(v => !v);
    try { await pushData(db); } catch {}
  }

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>文 문장 · 이미지 수집</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        좋은 문장을 해부하거나, 눈에 띈 글을 이미지로 빠르게 저장해요.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button onClick={() => setActiveTab('text')} style={{
          padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
          border: `1.5px solid ${activeTab === 'text' ? 'var(--accent)' : 'var(--card-border)'}`,
          background: activeTab === 'text' ? 'var(--accent)' : 'transparent',
          color: activeTab === 'text' ? '#fff' : 'var(--dim-star)',
          fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
        }}>文 문장</button>
        <Link href="/copy" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
            border: '1.5px solid var(--card-border)',
            background: 'transparent', color: 'var(--dim-star)',
            fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
          }}>広 카피</button>
        </Link>
        <button onClick={() => setActiveTab('image')} style={{
          padding: '9px 22px', fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
          border: `1.5px solid ${activeTab === 'image' ? 'var(--accent)' : 'var(--card-border)'}`,
          background: activeTab === 'image' ? 'var(--accent)' : 'transparent',
          color: activeTab === 'image' ? '#fff' : 'var(--dim-star)',
          fontFamily: 'Pretendard, sans-serif', transition: 'all 0.12s',
        }}>📷 이미지</button>
      </div>

      {activeTab === 'text' && (<div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }} className="grid-2">

        {/* 입력 */}
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 문장 입력</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="px-label">출처</label>
              <input className="px-input" placeholder="책 이름, 작가 등" value={source} onChange={e => setSource(e.target.value)} />
            </div>
            <div>
              <label className="px-label">참고</label>
              <input className="px-input" placeholder="https://..." value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="px-label">유형</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SENTENCE_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setSentType(t)}
                  style={{
                    padding: '6px 14px', fontSize: 13, cursor: 'pointer',
                    fontFamily: 'Pretendard, sans-serif',
                    fontWeight: 500, letterSpacing: '-0.01em',
                    borderRadius: 8,
                    background: sentType === t ? 'var(--accent)' : 'transparent',
                    border: `1.5px solid ${sentType === t ? 'var(--accent)' : 'var(--card-border)'}`,
                    color: sentType === t ? '#fff' : 'var(--dim-star)',
                    transition: 'all 0.12s',
                  }}
                >{t}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="px-label">문장</label>
            <textarea
              className="px-textarea" rows={6}
              placeholder="수집하고 싶은 문장을 입력해주세요..."
              value={sentence} onChange={e => setSentence(e.target.value)}
              style={{ minHeight: 120 }}
            />
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
              {loading ? (streamLen > 0 ? `★ ${streamLen}자 수신 중...` : '★ 연결 중...') : '✦ AI 분석'}
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
        <div className="px-card" style={{ minHeight: loading || !result ? 260 : 'auto' }}>
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
              <div className="px-empty-icon">文</div>
              <p className="px-empty-text">문장을 입력하고<br />AI 분석 버튼을 눌러주세요</p>
              <p className="px-empty-sub" style={{ marginTop: 6 }}>역할 · 표현 분석 · 강점</p>
            </div>
          )}
          {analysisOpen && result && (
            <AnalysisView
              a={result}
              entry={resultEntry ?? undefined}
              onGenerateExamples={() => handleGenerateExamples()}
              generatingExamples={genEx}
              exStreamLen={exStreamLen}
            />
          )}
        </div>
      </div>

      {/* 수집 목록 */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>文 수집 문장 ({history.length}개)</div>
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
                      {group.items.map(entry => {
              const role = entry.analysis?.sentenceRole;
              const roleColor = ROLE_COLOR[role || ''] || 'var(--accent)';
              return (
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
                      {entry.source && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{entry.source}</span>}
                      <span className="pixel-font" style={{ marginLeft: 'auto', fontSize: 6.5, color: 'var(--card-border)' }}>
                        {expanded === entry.id ? '▲' : '▼'}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.sentence}
                    </p>
                  </div>
                  {expanded === entry.id && (
                    <div style={{
                      background: 'var(--bg-subtle)', border: '1px solid var(--card-border)',
                      borderTop: 'none', padding: '14px 16px',
                    }}>
                      {editingId === entry.id ? (
                        <div onClick={e => e.stopPropagation()}>
                          <input className="px-input" placeholder="출처 (책 이름, 작가 등)" value={editSource} onChange={e => setEditSource(e.target.value)} style={{ marginBottom: 6 }} />
                          <input className="px-input" placeholder="참고 (https://...)" value={editUrl} onChange={e => setEditUrl(e.target.value)} style={{ marginBottom: 6 }} />
                          <textarea className="px-textarea" rows={3} placeholder="나의 인사이트, 느낌, 메모..." value={editMemo} onChange={e => setEditMemo(e.target.value)} style={{ marginBottom: 8, minHeight: 72 }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="px-btn px-btn-accent" style={{ fontSize: 11, padding: '5px 14px' }} onClick={e => handleEditSave(entry.id, e)}>저장</button>
                            <button className="px-btn-ghost" style={{ fontSize: 11, padding: '5px 14px' }} onClick={handleEditCancel}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                              {entry.type && (
                                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--card-border)', color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif', fontWeight: 500 }}>{entry.type}</span>
                              )}
                              {role && (
                                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${roleColor}14`, border: `1px solid ${roleColor}44`, color: roleColor, fontFamily: 'Pretendard, sans-serif', fontWeight: 600 }}>
                                  {role}
                                </span>
                              )}
                              {!role && entry.analysis?.sentenceKind && (
                                <span className="px-badge px-badge-accent" style={{ fontSize: 12, padding: '3px 10px' }}>{entry.analysis.sentenceKind}</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                              <button onClick={e => handleEditStart(entry, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 12, opacity: 0.7 }}>✎ 수정</button>
                              <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 12, opacity: 0.7 }}>✕ 삭제</button>
                            </div>
                          </div>
                          <p style={{
                            fontSize: 13, color: 'var(--text)', lineHeight: 1.9,
                            whiteSpace: 'pre-wrap', marginBottom: 6,
                            borderLeft: '2px solid var(--dim-star)', paddingLeft: 12,
                          }}>{entry.sentence}</p>
                          {entry.source && <span style={{ fontSize: 10, color: 'var(--dim-star)', marginBottom: 4, display: 'block' }}>— {entry.source}</span>}
                          {entry.sourceUrl && <RefLink url={entry.sourceUrl} style={{ marginBottom: 6 }} />}
                          {entry.memo && (
                            <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--accent-dim)', borderLeft: '2px solid var(--accent)', fontSize: 12, color: 'var(--text)', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif', whiteSpace: 'pre-wrap' }}>
                              <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, display: 'block', marginBottom: 3, letterSpacing: '0.02em' }}>MY NOTE</span>
                              {entry.memo}
                            </div>
                          )}
                          {entry.analysis && (
                            <>
                              <div style={{ height: 10 }} />
                              <AnalysisView
                                a={entry.analysis}
                                entry={history.find(h => h.id === entry.id)}
                                onGenerateExamples={() => handleGenerateExamples(entry.id)}
                                generatingExamples={genEx}
                                exStreamLen={exStreamLen}
                              />
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>)}

      {/* ── 이미지 탭 ── */}
      {activeTab === 'image' && (
        <div>
          <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgSelect} />

          {!imgPreview ? (
            <button
              onClick={() => imgInputRef.current?.click()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                width: '100%', padding: '44px 24px',
                background: 'var(--bg-card)', border: '2px dashed var(--card-border)',
                borderRadius: 16, cursor: 'pointer', transition: 'all 0.12s', marginBottom: 24,
              }}
            >
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: 'var(--accent)' }}>📷</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.01em', fontFamily: 'Pretendard, sans-serif' }}>이미지 추가</div>
                <div style={{ fontSize: 13, color: 'var(--dim-star)', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif' }}>스크린샷 · 사진 · 캡처 이미지를 저장해요</div>
              </div>
            </button>
          ) : (
            <div className="px-card" style={{ marginBottom: 24 }}>
              <img src={imgPreview} alt="preview" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 10, marginBottom: 14, background: 'var(--bg-subtle)' }} />
              <input
                className="px-input" placeholder="메모 추가 (선택사항)"
                value={imgNote} onChange={e => setImgNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleImgSave()}
                style={{ marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="px-btn px-btn-accent" onClick={handleImgSave} disabled={imgSaving}>
                  {imgSaving ? '저장 중...' : '저장'}
                </button>
                <button className="px-btn-ghost" onClick={() => { setImgPreview(null); setImgNote(''); }}>취소</button>
              </div>
            </div>
          )}

          {imgHistory.length > 0 ? (
            <div>
              <div className="px-sec-title" style={{ marginBottom: 14 }}>📷 이미지 수집 ({imgHistory.length}개)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {imgHistory.map(entry => (
                  <div key={entry.id} className="px-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setImgExpanded(entry.id)}>
                    <img src={entry.imageData} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '10px 12px' }}>
                      {entry.note && (
                        <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4, lineHeight: 1.6, fontFamily: 'Pretendard, sans-serif', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                          {entry.note}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif' }}>
                        {new Date(entry.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !imgPreview && (
            <div className="px-empty">
              <div className="px-empty-icon">📷</div>
              <p className="px-empty-text">저장된 이미지가 없어요</p>
              <p className="px-empty-sub">급하게 본 글이나 캡처 화면을 바로 저장해보세요</p>
            </div>
          )}

          {imgExpanded !== null && (() => {
            const entry = imgHistory.find(e => e.id === imgExpanded);
            if (!entry) return null;
            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 20px 40px' }} onClick={() => setImgExpanded(null)}>
                <button onClick={() => setImgExpanded(null)} style={{ position: 'fixed', top: 56, right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 50, width: 38, height: 38, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>×</button>
                <img src={entry.imageData} alt="" style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} onClick={e => e.stopPropagation()} />
                <div style={{ marginTop: 16, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  {entry.note && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif' }}>{entry.note}</div>}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Pretendard, sans-serif' }}>{new Date(entry.createdAt).toLocaleDateString('ko-KR')}</span>
                    <button onClick={e => { e.stopPropagation(); handleImgDelete(entry.id); setImgExpanded(null); }} style={{ background: 'rgba(240,62,62,0.2)', color: '#ff6b6b', border: '1px solid rgba(240,62,62,0.4)', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 12, fontFamily: 'Pretendard, sans-serif' }}>삭제</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function SentencePage() {
  return (
    <Suspense>
      <SentencePageInner />
    </Suspense>
  );
}
