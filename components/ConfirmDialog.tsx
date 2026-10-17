'use client';
import { useEffect, useState } from 'react';

interface ConfirmRequest {
  id: number;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

let counter = 0;

/** 테마에 맞는 커스텀 확인창. 네이티브 confirm()을 대체한다 — await confirmDialog('...') */
export function confirmDialog(message: string, opts?: { confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const id = ++counter;
  return new Promise(resolve => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: number; result: boolean }>).detail;
      if (detail.id !== id) return;
      window.removeEventListener('confirm-dialog-response', handler);
      resolve(detail.result);
    };
    window.addEventListener('confirm-dialog-response', handler);
    window.dispatchEvent(new CustomEvent<ConfirmRequest>('confirm-dialog-request', { detail: { id, message, ...opts } }));
  });
}

export default function ConfirmDialogRoot() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    const handler = (e: Event) => setReq((e as CustomEvent<ConfirmRequest>).detail);
    window.addEventListener('confirm-dialog-request', handler);
    return () => window.removeEventListener('confirm-dialog-request', handler);
  }, []);

  function respond(result: boolean) {
    if (!req) return;
    window.dispatchEvent(new CustomEvent('confirm-dialog-response', { detail: { id: req.id, result } }));
    setReq(null);
  }

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') respond(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;

  return (
    <div
      onClick={() => respond(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="px-card animate-fade-in"
        style={{ maxWidth: 320, width: '100%', padding: '22px 20px 18px' }}
      >
        <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          {req.message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="px-btn-ghost" style={{ fontSize: 13, padding: '7px 16px' }} onClick={() => respond(false)}>
            취소
          </button>
          <button
            className={req.danger ? 'px-btn px-btn-danger' : 'px-btn px-btn-accent'}
            style={{ fontSize: 13, padding: '7px 16px' }}
            onClick={() => respond(true)}
            autoFocus
          >
            {req.confirmLabel || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
