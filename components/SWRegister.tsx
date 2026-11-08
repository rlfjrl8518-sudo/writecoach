'use client';
import { useEffect } from 'react';

/* next-pwa의 자동 등록(register: true)은 App Router에서 동작하지 않는다 → 직접 등록.
   서비스 워커가 있어야 휴대폰에서 '앱 설치'가 뜨고, 푸시도 받는다. */
export default function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const reg = () => navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[sw]', e));
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true });
  }, []);
  return null;
}
