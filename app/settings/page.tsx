'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { normalizeDB, loadSettings, saveSettings, loadDB, saveDB, saveDBLocal, loadGamification, saveGamification, GCP_MODELS, type Settings } from '@/lib/db';
import {
  isSupabaseConfigured, getCurrentUser, signOut,
  onAuthChange, pushSettings,
} from '@/lib/supabase';
import { mergeDBs } from '@/lib/supabase';
import { syncNow, replaceRemote, detectBackend, getSyncUser, type BackendName } from '@/lib/sync';
import { confirmDialog } from '@/components/ConfirmDialog';
import PushOptIn from '@/components/PushOptIn';

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
  const [provider,      setProvider]      = useState<Settings['provider']>('gcp');
  const [gcpModel,      setGcpModel]      = useState<string>('gemini-3.8-flash');
  const [apiKey,        setApiKey]        = useState('');
  const [model,         setModel]         = useState('gpt-4o');
  const [showKey,       setShowKey]       = useState(false);
  const [geminiApiKey,  setGeminiApiKey]  = useState('');
  const [geminiModel,   setGeminiModel]   = useState('gemini-2.0-flash');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [unsplashAccessKey, setUnsplashAccessKey] = useState('');
  const [showUnsplashKey,   setShowUnsplashKey]   = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [dailyGoal,     setDailyGoal]     = useState(300);
  const importRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ── 클라우드 동기화 ──
  const [userEmail,    setUserEmail]    = useState<string | null>(null);
  const [syncMsg,      setSyncMsg]      = useState('');
  const [syncLoading,  setSyncLoading]  = useState(false);
  const [syncBackend,  setSyncBackend]  = useState<BackendName>(null);
  const [lastSync,     setLastSync]     = useState('');

  useEffect(() => {
    const s = loadSettings();
    setProvider(s.provider || 'gcp');
    setGcpModel(s.gcpModel || 'gemini-3.8-flash');
    setApiKey(s.apiKey || '');
    setModel(s.model || 'gpt-4o');
    setGeminiApiKey(s.geminiApiKey || '');
    setGeminiModel(s.geminiModel || 'gemini-2.0-flash');
    setUnsplashAccessKey(s.unsplashAccessKey || '');
    setDailyGoal(loadGamification().dailyGoal);
    detectBackend().then(b => { setSyncBackend(b); if (b === 'google') setUserEmail(getSyncUser()); });
    const onStatus = (e: Event) => { if ((e as CustomEvent).detail === 'synced') setLastSync(new Date().toLocaleTimeString('ko-KR')); };
    window.addEventListener('sync-status', onStatus);

    if (isSupabaseConfigured) {
      getCurrentUser().then(u => setUserEmail(u?.email ?? null));
      return onAuthChange(u => setUserEmail(u?.email ?? null));
    }
  }, []);

  function handleSave() {
    const s: Settings = {
      ...loadSettings(),
      provider, gcpModel, apiKey: apiKey.trim(), model, geminiApiKey: geminiApiKey.trim(), geminiModel, unsplashAccessKey: unsplashAccessKey.trim(),
    };
    saveSettings(s);
    saveGamification({ dailyGoal: Math.max(50, Math.min(5000, dailyGoal)) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    if (userEmail && syncBackend === 'supabase') pushSettings(s).catch(() => {});
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
      await syncNow();
      setSyncMsg('동기화 완료! 다른 기기의 기록까지 합쳐졌어요.');
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
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.writings) throw new Error('올바른 형식이 아니에요.');
        if (!await confirmDialog(`백업의 글 ${data.writings.length}편·책 ${(data.books ?? []).length}권을 지금 기록과 합칠까요? 지워지는 기록은 없어요. (같은 항목은 더 나중에 고친 쪽이 남아요)`, { confirmLabel: '합쳐서 가져오기' })) return;
        // 복구·기기 이전용 — 덮어쓰지 않고 합친다. 여러 기기의 백업을 차례로 넣어도 모두 남는다.
        saveDB(mergeDBs(loadDB(), normalizeDB(data)));
        await syncNow().catch(() => {});
        alert('가져오기 완료!');
      } catch (err: unknown) {
        alert('오류: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleClear() {
    if (!await confirmDialog('모든 데이터를 삭제할까요?\n글, 문장, 카피, 책 기록이 전부 영구 삭제돼요. 되돌릴 수 없어요.', { danger: true, confirmLabel: '전부 삭제' })) return;
    localStorage.removeItem('wc_v2_data');
    // 클라우드 원격도 빈 판으로 교체해야 다음 동기화 때 되살아나지 않는다
    try { await replaceRemote(loadDB()); } catch {}
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
          {/* 기본: 서버 GCP Vertex AI (키 불필요) */}
          <button
            onClick={() => setProvider('gcp')}
            style={{
              width: '100%', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', marginBottom: 14,
              background: provider === 'gcp' ? 'var(--accent-dim)' : 'var(--bg-subtle)',
              border: `1.5px solid ${provider === 'gcp' ? 'var(--accent)' : 'var(--card-border)'}`,
              borderRadius: 12, transition: 'all 0.12s',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: provider === 'gcp' ? 'var(--accent)' : 'var(--text)', marginBottom: 3, fontFamily: 'Pretendard, sans-serif', letterSpacing: '-0.01em' }}>GCP Vertex AI (기본, 키 불필요)</div>
            <div style={{ fontSize: 11, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif' }}>서버에서 Gemini 3.x로 바로 분석해요</div>
          </button>

          {/* 선택: 개인 API 키 (BYOK) */}
          <div style={{ fontSize: 11, color: 'var(--dim-star)', marginBottom: 8, fontFamily: 'Pretendard, sans-serif' }}>또는 내 API 키 사용 (선택)</div>
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

          {provider === 'gcp' ? (
            <div>
              <label className="px-label">모델</label>
              <select className="px-select" value={gcpModel} onChange={e => setGcpModel(e.target.value)}>
                {GCP_MODELS.map(m => (
                  <option key={m} value={m}>
                    {m}{m === 'gemini-3.8-flash' ? ' — 기본 (추천)' : m === 'gemini-3.1-pro-preview' ? ' — 고성능 · 느림' : m === 'gemini-3.1-flash-lite' ? ' — 가장 빠름' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (<>
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
                <option value="gpt-4o">gpt-4o — 고성능 (추천)</option>
                <option value="gpt-4o-mini">gpt-4o-mini — 빠름 · 저렴</option>
                <option value="gpt-4-turbo">gpt-4-turbo — 구형 고성능</option>
                <option value="gpt-5-mini">gpt-5-mini — reasoning 계열, 느릴 수 있음 (실험적)</option>
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
          </>)}
        </Section>

        <div className="px-divider" />

        {/* 글쓰기 도장 사진 (선택) */}
        <Section title="글쓰기 도장 사진 (선택)">
          <p style={{ fontSize: 12, color: 'var(--dim-star)', lineHeight: 1.7, marginBottom: 12 }}>
            비워두면 무작위 사진(Picsum)을 써요. 키를 넣으면 훈련 주제("쓸쓸함", "비 오는 거리" 등)에 더 맞는 사진을 Unsplash에서 가져와요.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="px-label" style={{ margin: 0 }}>Unsplash Access Key</label>
            <a
              href="https://unsplash.com/oauth/applications"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500, fontFamily: 'Pretendard, sans-serif' }}
            >
              무료로 발급하기 →
            </a>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              className="px-input"
              type={showUnsplashKey ? 'text' : 'password'}
              placeholder="(선택) Unsplash Access Key"
              value={unsplashAccessKey}
              onChange={e => setUnsplashAccessKey(e.target.value)}
              style={{ fontFamily: 'monospace', paddingRight: 48 }}
            />
            <button
              onClick={() => setShowUnsplashKey(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 14 }}
            >
              {showUnsplashKey ? '🙈' : '👁'}
            </button>
          </div>
        </Section>

        <div className="px-divider" />

        {/* 글쓰기 목표 */}
        <Section title="글쓰기 목표">
          <label className="px-label">일일 목표 글자 수</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {[100, 200, 300, 500, 1000].map(v => (
              <button
                key={v}
                onClick={() => setDailyGoal(v)}
                style={{
                  padding: '6px 14px', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'Pretendard, sans-serif', fontWeight: 600,
                  borderRadius: 8, border: `1.5px solid ${dailyGoal === v ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: dailyGoal === v ? 'var(--accent)' : 'transparent',
                  color: dailyGoal === v ? 'var(--on-accent)' : 'var(--dim-star)',
                  transition: 'all 0.12s',
                }}
              >{v}자</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim-star)', marginTop: 8, fontFamily: 'Pretendard, sans-serif' }}>
            매일 이 글자 수를 채우면 홈 화면에서 달성 표시가 됩니다.
          </div>
        </Section>

        <div className="px-divider" />

        {/* 저장 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button className="px-btn px-btn-accent" onClick={handleSave}>저장</button>
          {saved && <span style={{ fontSize: 11, color: 'var(--good)' }}>✓ 저장됐어요!</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim-star)', lineHeight: 1.8, padding: '8px 12px', background: 'var(--bg-subtle)', borderLeft: '2px solid var(--card-border)' }}>
          <span style={{ color: 'var(--moon)' }}>보안:</span> API 키는 이 기기의 브라우저 저장소에만 저장돼요.
        </div>

        <div className="px-divider" />

        {/* 클라우드 동기화 */}
        <Section title="CLOUD SYNC">
          {syncBackend === 'google' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 18, color: 'var(--accent)' }}>☁</span>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{userEmail ?? '구글 계정'}</div>
                  <div style={{ fontSize: 11, color: 'var(--good)', marginTop: 2 }}>
                    구글 계정 자동 동기화 · PC·모바일 같은 계정이면 따로 로그인할 필요 없어요{lastSync ? ` · 마지막 ${lastSync}` : ''}
                  </div>
                </div>
              </div>
              <button className="px-btn-ghost" onClick={handleManualSync} disabled={syncLoading} style={{ opacity: syncLoading ? 0.6 : 1 }}>
                {syncLoading ? '↻ 동기화 중...' : '↻ 지금 동기화'}
              </button>
              {syncMsg && <div style={{ fontSize: 11, marginTop: 8, color: syncMsg.startsWith('오류') ? 'var(--bad)' : 'var(--good)' }}>{syncMsg}</div>}
              <div style={{ fontSize: 11, color: 'var(--dim-star)', marginTop: 10, lineHeight: 1.7 }}>
                저장할 때·앱으로 돌아올 때·1분마다 자동으로 맞춰요. 두 기기에서 같은 글을 고치면 나중에 고친 쪽이 남아요.
              </div>
            </div>
          ) : !isSupabaseConfigured ? (
            <div style={{ fontSize: 12, color: 'var(--dim-star)', lineHeight: 1.8 }}>
              이 기능은 현재 비활성화 상태예요.
            </div>
          ) : userEmail ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 18, color: 'var(--accent)' }}>☁</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{userEmail}</div>
                  <div style={{ fontSize: 11, color: 'var(--good)', marginTop: 2 }}>동기화 활성화됨</div>
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
                  background: 'var(--accent)', color: 'var(--on-accent)',
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

        {/* 푸시 알림 — 묵당의 저녁 종 */}
        <PushOptIn />

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
