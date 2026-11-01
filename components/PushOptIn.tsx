'use client';
import { useCallback, useEffect, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   묵당 선생의 저녁 알림 — 정한 시각까지 오늘 한 줄도 안 썼으면 푸시 한 통.
   - 서버: /api/push/* (구독·설정은 GCS push/<해시>.json), 발송은 Cloud Run Job(scripts/push-cron.mjs)
   - 서비스 워커는 next-pwa 가 만든 /sw.js (+ worker/index.js 의 push·클릭 처리).
     `next dev` 에선 꺼져 있다.
═══════════════════════════════════════════════════════════════ */

type Prefs = { enabled: boolean; hour: number; devices: number; ids: string[]; lastSentDay: string };
type Unsupported = 'dev' | 'ios-install' | 'no-push' | null;

const isDev = process.env.NODE_ENV === 'development';

function detectUnsupported(): Unsupported {
  if (typeof window === 'undefined') return null;
  if (isDev) return 'dev';
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no-push';
  return null;
}

function b64ToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function endpointId(endpoint: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function currentSub(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function swReady(ms = 8000): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('SW_TIMEOUT')), ms)),
  ]);
}

/** 이 기기의 알림 상태 */
export function usePushStatus() {
  const [unsupported, setUnsupported] = useState<Unsupported>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>('unknown');
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [serverOff, setServerOff] = useState(false);
  const [subscribed, setSubscribed] = useState(false); // 이 기기가 서버에 등록돼 있음
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const u = detectUnsupported();
    setUnsupported(u);
    if (u) { setLoading(false); return; }
    setPermission(Notification.permission);
    try {
      const res = await fetch('/api/push/subscribe', { cache: 'no-store' });
      if (!res.ok) { setServerOff(true); setLoading(false); return; }
      const p: Prefs = await res.json();
      setPrefs(p);
      const sub = await currentSub();
      setSubscribed(!!sub && p.ids.includes(await endpointId(sub.endpoint)));
    } catch {
      setServerOff(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { unsupported, permission, prefs, setPrefs, serverOff, subscribed, loading, refresh, active: !!prefs?.enabled && subscribed };
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시`;

export default function PushOptIn() {
  const st = usePushStatus();
  const [hour, setHour] = useState(21);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => { if (st.prefs) setHour(st.prefs.hour); }, [st.prefs]);

  const say = (text: string, bad = false) => setMsg({ text, bad });

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        say(perm === 'denied' ? '알림이 막혀 있네. 브라우저 사이트 설정에서 알림을 허용해 주게.' : '허락을 받지 못했네. 다시 눌러 보게.', true);
        return;
      }
      const kr = await fetch('/api/push/key', { cache: 'no-store' });
      if (!kr.ok) { say('서재에 종이 아직 걸리지 않았네. (서버 알림 키 미설정)', true); return; }
      const { publicKey } = await kr.json();
      const reg = await swReady();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) as BufferSource });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), hour, enabled: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      st.setPrefs(await res.json());
      await st.refresh();
      say(`좋네. 매일 ${hourLabel(hour)}까지 소식이 없으면 내가 부르겠네.`);
    } catch (e) {
      say((e as Error).message === 'SW_TIMEOUT' ? '서비스 워커가 아직 깨어나지 않았네. 새로고침 뒤 다시 해 보게.' : '종을 거는 데 실패했네. 잠시 뒤 다시 해 보게.', true);
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg(null);
    try {
      const sub = await currentSub();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe().catch(() => {});
      }
      await st.refresh();
      say('알겠네. 이 기기로는 부르지 않겠네.');
    } catch {
      say('끄는 데 실패했네. 다시 해 보게.', true);
    } finally { setBusy(false); }
  }

  async function changeHour(h: number) {
    setHour(h);
    if (!st.active) return;
    try {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hour: h }),
      });
      if (res.ok) { st.setPrefs(await res.json()); say(`${hourLabel(h)}로 바꿨네.`); }
      else say('시각을 바꾸지 못했네.', true);
    } catch { say('시각을 바꾸지 못했네.', true); }
  }

  async function test() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.sent > 0) say('종을 울렸네. 곧 닿을 걸세.');
      else if (j.error === 'NO_SUBS') say('등록된 기기가 없네. 먼저 알림을 켜게.', true);
      else if (j.error === 'PUSH_OFF') say('서버 알림 키가 없네.', true);
      else say('종이 울리지 않았네. 알림을 껐다 다시 켜 보게.', true);
    } catch { say('종이 울리지 않았네.', true); }
    finally { setBusy(false); }
  }

  const hint = (text: string) => <div className="g-dim" style={{ fontSize: 11, lineHeight: 1.7 }}>{text}</div>;

  return (
    <div className="g-panel" style={{ marginBottom: 16 }}>
      <div className="g-h">묵당의 저녁 종</div>
      <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>
        정한 시각까지 오늘 한 줄도 없으면, 내가 한 번 부르겠네. 쓴 날은 조용히 있겠네.
      </div>

      {st.unsupported === 'dev' ? hint('개발 모드에선 동작 안 함 — 서비스 워커가 꺼져 있네. 배포본(next build)에서 시험하게.')
        : st.unsupported === 'ios-install' ? hint('아이폰·아이패드는 먼저 Safari 공유 버튼 → "홈 화면에 추가"로 서재를 설치하고, 홈 화면 아이콘으로 열어서 켜야 하네. (iOS 16.4 이상)')
        : st.unsupported === 'no-push' ? hint('이 브라우저는 푸시 알림을 받지 못하네. 크롬·엣지·사파리(설치형)에서 열어 보게.')
        : st.loading ? hint('종을 살피는 중…')
        : st.serverOff ? hint('지금은 서재 서버와 닿지 않네. (로그인/동기화가 켜진 배포본에서만 쓸 수 있네.)')
        : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <label className="g-dim" style={{ fontSize: 11 }} htmlFor="push-hour">부를 시각</label>
              <select id="push-hour" className="px-select" style={{ width: 'auto' }} value={hour}
                disabled={busy} onChange={e => changeHour(Number(e.target.value))}>
                {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {st.active ? (
                <>
                  <button className="g-btn sm" onClick={disable} disabled={busy}>알림 끄기</button>
                  <button className="g-btn sm" onClick={test} disabled={busy}>테스트 알림</button>
                </>
              ) : (
                <button className="g-btn primary sm" onClick={enable} disabled={busy || st.permission === 'denied'}>
                  {busy ? '종을 거는 중…' : '알림 켜기'}
                </button>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              {st.permission === 'denied' && hint('알림이 브라우저에서 막혀 있네. 사이트 설정에서 허용으로 바꾼 뒤 다시 오게.')}
              {st.active && hint(`켜짐 · 매일 ${hourLabel(st.prefs!.hour)} (한국 시간) · 등록 기기 ${st.prefs!.devices}대`)}
              {!st.active && st.prefs?.enabled && st.prefs.devices > 0 && hint(`다른 기기 ${st.prefs.devices}대에는 켜져 있네. 이 기기도 받으려면 켜게.`)}
            </div>
          </>
        )}
      {msg && <div style={{ fontSize: 11, marginTop: 8, color: msg.bad ? 'var(--bad)' : 'var(--good)' }}>{msg.text}</div>}
    </div>
  );
}
