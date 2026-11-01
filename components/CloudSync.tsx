'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { onAuthChange, isSupabaseConfigured } from '@/lib/supabase';
import { saveDB, loadDB } from '@/lib/db';
import {
  detectBackend, syncNow, requestSync, flushOnHide, importLegacySupabaseOnce, isApplyingRemote,
  type SyncStatus,
} from '@/lib/sync';

export type { SyncStatus };

/** 동기화 오류 상태에서 사용자가 직접 재시도할 때 (Navigation의 동기화 아이콘) */
export async function retrySync() { await syncNow(); }

// 이 화면들은 db-saved를 듣고 스스로 다시 그린다 — 새로고침 안내가 필요 없다
const LIVE_PAGES = ['/', '/story', '/journey'];

export default function CloudSync() {
  const path = usePathname();
  const [banner, setBanner] = useState(false);

  useEffect(() => {
    const mountedAt = Date.now();
    // 개발 모드 전용 테스트 훅 — E2E가 앱과 똑같은 저장 경로(수정 시각 기록 포함)를 쓰도록
    if (process.env.NODE_ENV !== 'production') Object.assign(window, { __wc: { saveDB, loadDB } });
    let interval: ReturnType<typeof setInterval> | null = null;

    async function start() {
      const b = await detectBackend();
      if (!b) {
        window.dispatchEvent(new CustomEvent('sync-status', { detail: isSupabaseConfigured ? 'offline' : 'none' }));
        return;
      }
      if (b === 'google') await importLegacySupabaseOnce();
      await syncNow();
    }
    start();

    const unsubAuth = onAuthChange(() => { start(); });

    const onSaved = () => { if (!isApplyingRemote()) requestSync(); };
    const onVisible = () => { if (document.visibilityState === 'visible') syncNow(); else flushOnHide(); };
    const onOnline = () => syncNow();
    const onHide = () => flushOnHide();
    const onRemote = () => {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '');
      // 앱을 막 열었을 때 받아온 거라면 조용히 새로고침, 아니면 안내만
      if (Date.now() - mountedAt < 5000 && !typing) { window.location.reload(); return; }
      setBanner(true);
    };

    window.addEventListener('db-saved', onSaved);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onOnline);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('db-remote-applied', onRemote);
    interval = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60_000);

    return () => {
      unsubAuth();
      window.removeEventListener('db-saved', onSaved);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onOnline);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('db-remote-applied', onRemote);
      if (interval) clearInterval(interval);
    };
  }, []);

  if (!banner || LIVE_PAGES.includes(path)) return null;
  return (
    <div className="g-panel hi anim-in" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 88, zIndex: 620, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, maxWidth: 'calc(100vw - 32px)' }}>
      <span>다른 기기의 기록을 반영했어요.</span>
      <button className="g-btn sm primary" onClick={() => window.location.reload()}>새로고침</button>
      <button className="g-btn sm" onClick={() => setBanner(false)}>닫기</button>
    </div>
  );
}
