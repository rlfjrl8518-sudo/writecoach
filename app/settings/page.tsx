'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadSettings, saveSettings, loadDB, saveDB, saveDBLocal } from '@/lib/db';
import {
  isSupabaseConfigured, getCurrentUser, signOut,
  onAuthChange, pushData, pullData, mergeDBs, pushSettings,
} from '@/lib/supabase';

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
  const router = useRouter();

  // ── 클라우드 동기화 ──
  const [userEmail,    setUserEmail]    = useState<string | null>(null);
  const [syncMsg,      setSyncMsg]      = useState('');
  const [syncLoading,  setSyncLoading]  = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setProvider(s.provider || 'openai');
    setApiKey(s.apiKey || '');
    setModel(s.model || 'gpt-4o-mini');
    setGeminiApiKey(s.geminiApiKey || '');
    setGeminiModel(s.geminiModel || 'gemini-2.0-flash');

    if (isSupabaseConfigured) {
      getCurrentUser().then(u => setUserEmail(u?.email ?? null));
      return onAuthChange(u => setUserEmail(u?.email ?? null));
    }
  }, []);

  function handleSave() {
    const s = { provider, apiKey: apiKey.trim(), model, geminiApiKey: geminiApiKey.trim(), geminiModel };
    saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    if (userEmail) pushSettings(s).catch(() => {});
  }

  async function handleLogout() {
    await signOut();
    setUserEmail(null);
    localStorage.removeItem('wc_onboarded');
    router.push('/login');
  }

  async function handleManualSync() {
    setSyncLoading(true); setSyncMsg('');
    try {
      const remote = await pullData();
      const local  = loadDB();
      if (remote) {
        const merged = mergeDBs(local, remote);
        saveDBLocal(merged);
        await pushData(merged);
        setSyncMsg('동기화 완료! 페이지를 새로고침하면 적용돼요.');
      } else {
        await pushData(local);
        setSyncMsg('로컬 데이터를 클라우드에 올렸어요.');
      }
    } catch (e: unknown) {
      setSyncMsg('오류: ' + (e instanceof Error ? e.message : String(e)));
    }
    setSyncLoading(false);
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
    <div style={{ maxWidth: 680 }}>
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

      {/* 분석 기준 가이드 링크 */}
      <Link href="/guide" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
        <div className="px-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'var(--accent)', flexShrink: 0,
            }}>
              ◈
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                분석 기준 가이드
              </div>
              <div style={{ fontSize: 12, color: 'var(--dim-star)', marginTop: 3, lineHeight: 1.5 }}>
                점수 항목·문장 구조·감각 표현 설명
              </div>
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--dim-star)' }}>›</span>
        </div>
      </Link>

      <div className="px-card">
        {/* AI 서비스 */}
        <Section title="AI 서비스">
          {/* 제공업체 선택 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {([
              { id: 'openai', name: 'OpenAI', sub: 'GPT-4o · GPT-4o mini', color: '#10a37f' },
              { id: 'gemini', name: 'Gemini', sub: 'Flash · Pro', color: '#4285F4' },
            ] as const).map(p => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                style={{
                  padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                  background: provider === p.id ? `${p.color}14` : 'var(--bg-subtle)',
                  border: `1.5px solid ${provider === p.id ? p.color : 'var(--card-border)'}`,
                  borderRadius: 12, transition: 'all 0.12s',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: provider === p.id ? p.color : 'var(--text)', marginBottom: 3, fontFamily: 'Pretendard, sans-serif', letterSpacing: '-0.01em' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif' }}>{p.sub}</div>
              </button>
            ))}
          </div>

          {/* API 키 입력 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="px-label" style={{ margin: 0 }}>API 키</label>
              <a
                href={provider === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://aistudio.google.com/apikey'}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500, fontFamily: 'Pretendard, sans-serif' }}
              >
                키 발급하기 →
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                className="px-input"
                type={provider === 'openai' ? (showKey ? 'text' : 'password') : (showGeminiKey ? 'text' : 'password')}
                placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'}
                value={provider === 'openai' ? apiKey : geminiApiKey}
                onChange={e => provider === 'openai' ? setApiKey(e.target.value) : setGeminiApiKey(e.target.value)}
                style={{ fontFamily: 'monospace', paddingRight: 48 }}
              />
              <button
                onClick={() => provider === 'openai' ? setShowKey(v => !v) : setShowGeminiKey(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 14 }}
              >
                {(provider === 'openai' ? showKey : showGeminiKey) ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* 모델 선택 */}
          <div>
            <label className="px-label">모델</label>
            {provider === 'openai' ? (
              <select className="px-select" value={model} onChange={e => setModel(e.target.value)}>
                <option value="gpt-5-chat-latest">gpt-5-chat-latest — 최신 최고성능</option>
                <option value="gpt-4o-mini">gpt-4o-mini — 빠름 · 저렴</option>
                <option value="gpt-4o">gpt-4o — 고성능</option>
                <option value="gpt-4-turbo">gpt-4-turbo — 구형 고성능</option>
              </select>
            ) : (
              <select className="px-select" value={geminiModel} onChange={e => setGeminiModel(e.target.value)}>
                <option value="gemini-2.0-flash">gemini-2.0-flash — 빠름 · 저렴 (추천)</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash — 최신 빠른 모델</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro — 최신 고성능</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash — 구형 빠른</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro — 구형 고성능</option>
              </select>
            )}
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

        {/* 클라우드 동기화 */}
        <Section title="CLOUD SYNC">
          {!isSupabaseConfigured ? (
            <div style={{ fontSize: 12, color: 'var(--dim-star)', lineHeight: 1.8 }}>
              이 기능은 현재 비활성화 상태예요.
            </div>
          ) : userEmail ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 18, color: '#3182F6' }}>☁</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{userEmail}</div>
                  <div style={{ fontSize: 11, color: '#22B85A', marginTop: 2 }}>동기화 활성화됨</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  className="px-btn-ghost"
                  onClick={handleManualSync}
                  disabled={syncLoading}
                  style={{ opacity: syncLoading ? 0.6 : 1 }}
                >
                  {syncLoading ? '↻ 동기화 중...' : '↻ 지금 동기화'}
                </button>
                <button className="px-btn-ghost" onClick={handleLogout}>로그아웃</button>
              </div>
              {syncMsg && (
                <div style={{ fontSize: 11, color: syncMsg.startsWith('오류') ? 'var(--bad)' : 'var(--good)', lineHeight: 1.7 }}>
                  {syncMsg}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              <div style={{ fontSize: 32, color: 'var(--card-border)', marginBottom: 14 }}>☁</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.01em' }}>기기간 동기화</div>
              <div style={{ fontSize: 13, color: 'var(--dim-star)', lineHeight: 1.8, marginBottom: 20 }}>
                Google 계정으로 로그인하면<br />어떤 기기에서든 내 기록에 접근할 수 있어요.
              </div>
              <Link href="/login" style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '12px 28px',
                  background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 12,
                  cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  fontFamily: 'Pretendard, sans-serif',
                  letterSpacing: '-0.01em', transition: 'all 0.12s',
                }}>
                  로그인하기
                </button>
              </Link>
            </div>
          )}
        </Section>

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
