'use client';
import { useEffect } from 'react';
import { supabase, isSupabaseConfigured, pushData, pullData, pullSettings, onAuthChange, mergeDBs } from '@/lib/supabase';
import { loadDB, saveDBLocal, loadSettings, saveSettings } from '@/lib/db';
import type { DB } from '@/lib/db';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

export function setSyncStatus(status: SyncStatus) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: status }));
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function doSync(db: DB) {
  setSyncStatus('syncing');
  try {
    await pushData(db);
    setSyncStatus('synced');
  } catch {
    setSyncStatus('error');
  }
}

export default function CloudSync() {
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // 로그인/로그아웃 감지 → 로그인 시 데이터 풀
    const unsub = onAuthChange(async (user) => {
      if (!user) { setSyncStatus('offline'); return; }

      setSyncStatus('syncing');
      try {
        const [remote, remoteSettings] = await Promise.all([pullData(), pullSettings()]);

        // 클라우드 settings 적용 (API 키가 있을 때만 덮어씀)
        if (remoteSettings && (remoteSettings.apiKey || remoteSettings.geminiApiKey)) {
          const localSettings = loadSettings();
          if (!localSettings.apiKey && !localSettings.geminiApiKey) {
            saveSettings(remoteSettings);
          }
        }

        const local = loadDB();

        if (remote) {
          const merged = mergeDBs(local, remote);
          const localTotal  = local.writings.length  + local.sentences.length  + local.copies.length;
          const mergedTotal = merged.writings.length + merged.sentences.length + merged.copies.length;

          saveDBLocal(merged); // 로컬 업데이트 (sync 이벤트 없이)

          // 원격보다 로컬에 더 많은 데이터가 있으면 올려 보냄
          const remoteTotal = remote.writings.length + remote.sentences.length + remote.copies.length;
          if (mergedTotal > remoteTotal) await pushData(merged);

          // 새 데이터가 추가됐으면 페이지 새로고침
          if (mergedTotal > localTotal) window.location.reload();
        } else {
          // 클라우드에 데이터 없음 → 로컬 데이터 올리기
          await pushData(local);
        }
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    });

    // 저장 이벤트 수신 → 디바운스 후 클라우드로 push
    const handler = (e: Event) => {
      const db = (e as CustomEvent<DB>).detail;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => doSync(db), 1500);
    };
    window.addEventListener('db-saved', handler);

    // 현재 로그인 상태 체크
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) setSyncStatus('offline');
    });

    return () => {
      unsub();
      window.removeEventListener('db-saved', handler);
    };
  }, []);

  return null;
}
