'use client';
import { useState, useEffect, useRef } from 'react';
import { loadSettings, saveSettings, loadDB, saveDB } from '@/lib/db';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', borderBottom: '1px solid var(--card-border)', paddingBottom: 8, marginBottom: 16, letterSpacing: '0.12em' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [provider,      setProvider]      = useState<'openai' | 'gemini'>('openai');
  const [apiKey,        setApiKey]        = useState('');
  const [model,         setModel]         = useState('gpt-4o-mini');
  const [showKey,       setShowKey]       = useState(false);
  const [geminiApiKey,  setGeminiApiKey]  = useState('');
  const [geminiModel,   setGeminiModel]   = useState('gemini-2.0-flash');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [saved,         setSaved]         = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = loadSettings();
    setProvider(s.provider || 'openai');
    setApiKey(s.apiKey || '');
    setModel(s.model || 'gpt-4o-mini');
    setGeminiApiKey(s.geminiApiKey || '');
    setGeminiModel(s.geminiModel || 'gemini-2.0-flash');
  }, []);

  function handleSave() {
    saveSettings({ provider, apiKey: apiKey.trim(), model, geminiApiKey: geminiApiKey.trim(), geminiModel });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleExport() {
    const db   = loadDB();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `writecoach_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.writings) throw new Error('올바른 형식이 아니에요.');
        if (!confirm(`${data.writings.length}편의 데이터를 가져올까요? 기존 데이터는 덮어써져요.`)) return;
        saveDB(data);
        alert('가져오기 완료!');
      } catch (err: unknown) {
        alert('오류: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleClear() {
    if (!confirm('모든 데이터를 삭제할까요? 되돌릴 수 없어요.')) return;
    if (!confirm('정말요? 기록이 영구 삭제돼요.')) return;
    localStorage.removeItem('wc_v2_data');
    alert('초기화 완료');
  }

  const db = typeof window !== 'undefined' ? loadDB() : null;
  const counts = {
    writings:  db?.writings.length ?? 0,
    sentences: db?.sentences.length ?? 0,
    copies:    db?.copies.length ?? 0,
    missions:  db?.missions.length ?? 0,
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="px-sec-title" style={{ marginBottom: 24 }}>⚙ SETTINGS</div>

      {/* 데이터 요약 */}
      <div className="px-card" style={{ marginBottom: 20, display: 'flex', gap: 20, padding: '14px 18px', flexWrap: 'wrap' }}>
        {[
          { label: '글', value: counts.writings, color: 'var(--moon)' },
          { label: '문장', value: counts.sentences, color: 'var(--accent)' },
          { label: '카피', value: counts.copies, color: 'var(--dim-star)' },
          { label: '과제', value: counts.missions, color: 'var(--good)' },
        ].map(item => (
          <div key={item.label} style={{ textAlign: 'center', minWidth: 50 }}>
            <div className="pixel-font" style={{ fontSize: 18, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 10, color: 'var(--dim-star)', marginTop: 3 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div className="px-card">
        {/* AI PROVIDER */}
        <Section title="AI PROVIDER">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {(['openai', 'gemini'] as const).map(p => (
              <button key={p} onClick={() => setProvider(p)} className="pixel-font"
                style={{
                  padding: '10px 22px', fontSize: 9, cursor: 'pointer', border: 'none',
                  background: provider === p ? 'var(--accent)' : 'var(--card-border)',
                  color: provider === p ? '#1a0a3a' : 'var(--dim-star)',
                  clipPath: provider === p ? 'polygon(6px 0%,calc(100% - 6px) 0%,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0% calc(100% - 6px),0% 6px)' : 'none',
                  transition: 'all .1s',
                }}
              >
                {p === 'openai' ? '✦ OpenAI' : '◈ Gemini'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim-star)' }}>
            현재 선택: <span className="pixel-font" style={{ fontSize: 8, color: 'var(--moon)' }}>
              {provider === 'openai' ? 'OpenAI GPT' : 'Google Gemini'}
            </span>
          </div>
        </Section>

        <div className="px-divider" />

        {/* OPENAI */}
        <Section title="OPENAI API">
          <div style={{ opacity: provider === 'openai' ? 1 : 0.4, transition: 'opacity .2s', pointerEvents: provider === 'openai' ? 'auto' : 'none' }}>
            <div style={{ marginBottom: 12 }}>
              <label className="px-label">API Key</label>
              <div style={{ position: 'relative' }}>
                <input className="px-input" type={showKey ? 'text' : 'password'} placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ fontFamily: 'monospace', paddingRight: 48 }} />
                <button onClick={() => setShowKey(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 14 }}>
                  {showKey ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div>
              <label className="px-label">모델</label>
              <select className="px-select" value={model} onChange={e => setModel(e.target.value)}>
                <option value="gpt-4o-mini">gpt-4o-mini — 빠르고 저렴 (추천)</option>
                <option value="gpt-4o">gpt-4o — 더 정확, 비용 높음</option>
                <option value="gpt-4-turbo">gpt-4-turbo — 구형 고성능</option>
              </select>
            </div>
          </div>
        </Section>

        <div className="px-divider" />

        {/* GEMINI */}
        <Section title="GOOGLE GEMINI API">
          <div style={{ opacity: provider === 'gemini' ? 1 : 0.4, transition: 'opacity .2s', pointerEvents: provider === 'gemini' ? 'auto' : 'none' }}>
            <div style={{ marginBottom: 12 }}>
              <label className="px-label">Gemini API Key</label>
              <div style={{ position: 'relative' }}>
                <input className="px-input" type={showGeminiKey ? 'text' : 'password'} placeholder="AIza..." value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} style={{ fontFamily: 'monospace', paddingRight: 48 }} />
                <button onClick={() => setShowGeminiKey(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 14 }}>
                  {showGeminiKey ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div>
              <label className="px-label">모델</label>
              <select className="px-select" value={geminiModel} onChange={e => setGeminiModel(e.target.value)}>
                <option value="gemini-2.0-flash">gemini-2.0-flash — 빠르고 저렴 (추천)</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash — 최신 빠른 모델</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro — 최신 고성능</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash — 구형 빠른</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro — 구형 고성능</option>
              </select>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--dim-star)', lineHeight: 1.7, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderLeft: '2px solid var(--card-border)' }}>
              <span style={{ color: 'var(--moon)' }}>키 발급:</span> aistudio.google.com → Get API Key
            </div>
          </div>
        </Section>

        <div className="px-divider" />

        {/* 저장 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button className="px-btn px-btn-accent" onClick={handleSave}>저장</button>
          {saved && <span style={{ fontSize: 11, color: 'var(--good)' }}>✓ 저장됐어요!</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim-star)', lineHeight: 1.8, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderLeft: '2px solid var(--card-border)' }}>
          <span style={{ color: 'var(--moon)' }}>보안:</span> API 키는 이 기기의 브라우저 저장소에만 저장돼요.
        </div>

        <div className="px-divider" />

        {/* 데이터 관리 */}
        <Section title="DATA MANAGEMENT">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="px-btn-ghost" onClick={handleExport}>↓ JSON 내보내기</button>
            <button className="px-btn-ghost" onClick={() => importRef.current?.click()}>↑ JSON 가져오기</button>
          </div>
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          <div style={{ fontSize: 11, color: 'var(--dim-star)', lineHeight: 1.8 }}>
            다른 기기에서 계속 쓰려면 JSON을 내보내고 가져오세요.
          </div>
        </Section>

        <div className="px-divider" />

        {/* 위험 구역 */}
        <Section title="DANGER ZONE">
          <button className="px-btn px-btn-danger" onClick={handleClear}>전체 데이터 초기화</button>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--bad)', opacity: 0.7 }}>이 작업은 되돌릴 수 없어요.</div>
        </Section>
      </div>
    </div>
  );
}
