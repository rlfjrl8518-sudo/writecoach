'use client';
import { useEffect, useRef, useState } from 'react';
import { loadDB, saveDB, loadSettings, aiReady, type Mission, type DB } from '@/lib/db';
import { generateMissions, evaluateMission } from '@/lib/openai';
import { confirmDialog } from '@/components/ConfirmDialog';
import PunctBar from './PunctBar';

/* 보충 과제 — 최근 글의 약점을 분석해 AI가 내는 맞춤 과제 (옛 '훈련 > AI 맞춤 과제') */
const TYPE_LABEL: Record<string, string> = { writing: '글쓰기', expression: '표현', structure: '구조', sense: '감각', copy: '카피' };

function MissionItem({ m, onSubmit, onDelete }: { m: Mission; onSubmit: (id: number, text: string) => Promise<void>; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(m.submission ?? '');
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const ev = m.evaluation;
  return (
    <div className="g-panel" style={{ padding: 12, opacity: m.completed && !open ? 0.7 : 1, '--frame': m.completed ? 'var(--good)' : 'var(--card-border)' } as React.CSSProperties}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span className="g-chip" style={{ color: 'var(--secondary)', flexShrink: 0 }}>{TYPE_LABEL[m.type] ?? m.type}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13 }}>{m.completed ? '● ' : ''}{m.title}</div>
          <div className="g-dim" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 4, fontFamily: 'var(--font-read)' }}>{m.description}</div>
        </div>
        <button className="g-btn sm" onClick={onDelete} aria-label="삭제">✕</button>
      </div>
      {ev && !open && <div style={{ fontSize: 12, marginTop: 8, color: ev.passed ? 'var(--good)' : 'var(--moon)' }}>{ev.passed ? '통과' : '재도전'} · {ev.score}점 — {ev.feedback}</div>}
      {open ? (
        <div style={{ marginTop: 10 }}>
          <textarea ref={ta} className="px-textarea" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 140 }} placeholder="과제에 맞춰 쓰게." />
          <PunctBar target={ta} value={text} onChange={setText} />
          <button className="g-btn primary" disabled={busy || !text.trim()} onClick={async () => { setBusy(true); await onSubmit(m.id, text.trim()); setBusy(false); setOpen(false); }}>{busy ? '스승이 읽는 중…' : '스승에게 보이기'}</button>
          <button className="g-btn sm" onClick={() => setOpen(false)}>닫기</button>
        </div>
      ) : (
        <button className="g-btn sm" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>{ev ? '다시 쓰기' : '쓰기'}</button>
      )}
    </div>
  );
}

export default function Missions() {
  const [db, setDb] = useState<DB | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const refresh = () => setDb(loadDB());
  useEffect(refresh, []);
  if (!db) return null;

  async function generate() {
    const s = loadSettings();
    if (!aiReady(s)) { setErr('설정에서 AI를 먼저 연결해 주세요.'); return; }
    if (!loadDB().writings.some(w => w.analysis)) { setErr('분석받은 글이 한 편 이상 있어야 약점을 짚을 수 있네.'); return; }
    setBusy(true); setErr('');
    try {
      const raw = await generateMissions(s, loadDB());
      const now = new Date().toISOString();
      const fresh = loadDB();
      fresh.missions = [...raw.map((m, i) => ({ ...m, id: Date.now() + i, completed: false, createdAt: now })), ...fresh.missions];
      saveDB(fresh); refresh();
    } catch (e) { setErr('오류: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  }
  async function submit(id: number, text: string) {
    const s = loadSettings();
    const fresh = loadDB();
    const m = fresh.missions.find(x => x.id === id);
    if (!m) return;
    try {
      const ev = await evaluateMission(s, m, text);
      m.submission = text; m.evaluation = ev; if (ev.passed) m.completed = true;
      // 보충 과제도 수련 기록(등불)에 남긴다
      fresh.drillLogs = [...(fresh.drillLogs ?? []), { id: Date.now(), drill: '보충 과제', avg: Math.round(ev.score / 10), createdAt: new Date().toISOString() }];
      saveDB(fresh); refresh();
    } catch (e) { setErr('채점 오류: ' + (e instanceof Error ? e.message : String(e))); }
  }
  async function remove(id: number) {
    if (!await confirmDialog('이 과제를 지울까?', { danger: true, confirmLabel: '삭제' })) return;
    const fresh = loadDB();
    fresh.missions = fresh.missions.filter(m => m.id !== id);
    fresh._deletedIds = [...(fresh._deletedIds ?? []), id];
    saveDB(fresh); refresh();
  }
  const pending = db.missions.filter(m => !m.completed);
  const done = db.missions.filter(m => m.completed).slice(0, 5);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="g-btn" onClick={generate} disabled={busy}>{busy ? '약점을 살피는 중…' : '✦ 내 약점으로 과제 3개 받기'}</button>
        <span className="g-dim" style={{ fontSize: 11 }}>남은 {pending.length} · 마친 {db.missions.length - pending.length}</span>
      </div>
      {err && <div style={{ color: 'var(--bad)', fontSize: 12, margin: '6px 0' }}>{err}</div>}
      {pending.map(m => <MissionItem key={m.id} m={m} onSubmit={submit} onDelete={() => remove(m.id)} />)}
      {done.length > 0 && <div className="g-dim" style={{ fontSize: 11, margin: '10px 4px 4px' }}>최근 마친 과제</div>}
      {done.map(m => <MissionItem key={m.id} m={m} onSubmit={submit} onDelete={() => remove(m.id)} />)}
    </div>
  );
}
