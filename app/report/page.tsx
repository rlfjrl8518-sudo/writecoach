'use client';
import { useState, useEffect } from 'react';
import {
  loadDB, loadSettings, getTopEntries, getTopExpressions,
} from '@/lib/db';
import { generateMonthlyReport } from '@/lib/openai';

function StarLoader() {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(n => (n + 1) % 3), 500); return () => clearInterval(t); }, []);
  return (
    <div className="star-loader">
      <div className="pixel-font" style={{ fontSize: 16, color: 'var(--moon)', letterSpacing: 8 }}>
        {['★ ☆ ☆', '★ ★ ☆', '★ ★ ★'][f]}
      </div>
      <span className="star-loader-text">한 달치 데이터를 분석하고 있어요...</span>
    </div>
  );
}

function ReportContent({ text }: { text: string }) {
  const sections = text.split(/^###\s+/m).filter(Boolean);
  if (!sections.length) {
    return <div className="serif-font" style={{ fontSize: 14, lineHeight: 2, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{text}</div>;
  }
  return (
    <div>
      {sections.map((sec, i) => {
        const nl    = sec.indexOf('\n');
        const title = nl === -1 ? sec : sec.slice(0, nl).trim();
        const body  = nl === -1 ? '' : sec.slice(nl + 1).trim();
        return (
          <div key={i} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: i < sections.length - 1 ? '1px dashed var(--card-border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className="pixel-font" style={{ fontSize: 9, color: 'var(--moon)' }}>{i + 1}.</span>
              <span className="pixel-font" style={{ fontSize: 8, color: 'var(--accent)', letterSpacing: '0.08em' }}>{title.toUpperCase()}</span>
            </div>
            <div className="serif-font" style={{ fontSize: 14, color: 'var(--text)', lineHeight: 2, whiteSpace: 'pre-wrap', paddingLeft: 16, borderLeft: '2px solid var(--card-border)' }}>
              {body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportPage() {
  const [report,  setReport]  = useState('');
  const [loading, setLoading] = useState(false);
  const [month,   setMonth]   = useState(() => new Date().toISOString().slice(0, 7));
  const [err,     setErr]     = useState('');

  async function handleGenerate() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }

    const db = loadDB();
    const monthWritings = db.writings.filter(w => w.date.startsWith(month) && w.analysis);
    if (monthWritings.length === 0) { setErr(`${month}에 분석된 글이 없어요. (최소 1편 필요)`); return; }

    setLoading(true); setErr(''); setReport('');

    const scores     = monthWritings.map(w => w.analysis!.score);
    const partialDB  = { ...db, writings: monthWritings };
    const weakTop5   = getTopEntries(db.weaknesses, 5).map(([k, v]) => `${k}(${v}회)`);
    const exprTop5   = getTopExpressions(partialDB, 5).map(([k, v]) => `${k}(${v.count}회)`);
    const structTop5 = getTopEntries(db.structures, 5).map(([k, v]) => `${k}(${v}회)`);
    const senses     = db.senses;
    const allWords   = monthWritings.flatMap(w => w.analysis!.repeated_words || []);
    const wordCount: Record<string, number> = {};
    allWords.forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });
    const top10Words = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);

    const payload = {
      year:  month.slice(0, 4),
      month: month.slice(5, 7),
      total_count: monthWritings.length,
      avg_score:   Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      max_score:   Math.max(...scores),
      min_score:   Math.min(...scores),
      top5_weaknesses:         weakTop5,
      top5_expressions:        exprTop5,
      top5_structures:         structTop5,
      sense_distribution:      senses,
      top10_repeated_words:    top10Words,
      total_writings_lifetime: db.writings.length,
      total_sentences_collected: db.sentences.length,
      total_copies_collected:  db.copies.length,
    };

    try {
      const text = await generateMonthlyReport(s, payload);
      setReport(text);
    } catch (e: unknown) {
      setErr('오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  function handleDownload() {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `writecoach_report_${month}.txt`;
    a.click();
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="px-sec-title" style={{ marginBottom: 24 }}>◈ MONTHLY REPORT</div>

      <div className="px-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 180px' }}>
            <label className="px-label">분석 월</label>
            <input className="px-input" type="month" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <button className="px-btn px-btn-moon" onClick={handleGenerate} disabled={loading}>
            {loading ? '★ 생성 중...' : '✦ 리포트 생성'}
          </button>
        </div>
        {err && (
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--bad)', padding: '8px 12px', borderLeft: '2px solid var(--bad-border)', background: 'var(--bad-dim)' }}>
            {err}
          </div>
        )}
      </div>

      {loading && <div className="px-card" style={{ textAlign: 'center' }}><StarLoader /></div>}

      {!loading && report && (
        <div className="px-card-accent" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div className="pixel-font" style={{ fontSize: 9, color: 'var(--moon)', marginBottom: 4 }}>{month} 월간 성장 리포트</div>
              <div className="serif-font" style={{ fontSize: 12, color: 'var(--dim-star)' }}>별헤는 밤처럼, 한 줄씩 쌓아온 기록</div>
            </div>
            <button className="px-btn-ghost-moon" onClick={handleDownload}>↓ 저장</button>
          </div>
          <div className="px-divider-moon" />
          <div style={{ marginTop: 20 }}><ReportContent text={report} /></div>
        </div>
      )}

      {!loading && !report && (
        <div className="px-empty">
          <div className="px-empty-icon">✦</div>
          <p className="px-empty-text">분석할 월을 선택하고<br />리포트 생성 버튼을 눌러주세요</p>
          <p className="px-empty-sub">해당 월에 분석된 글이 1편 이상 있어야 해요</p>
        </div>
      )}
    </div>
  );
}
