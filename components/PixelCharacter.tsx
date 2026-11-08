'use client';
import { useState, useEffect, useRef } from 'react';
import { loadDB, loadSettings, aiReady } from '@/lib/db';
import { chatWithCoach } from '@/lib/openai';
import { isStreakBroken, getScoreEmotion } from '@/lib/journey';
import { Speaker } from './art/Art';
import type { Emotion } from './art/Art';

const POS_KEY = 'wc_char_pos';
const SIZE = 72;

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw) as { x: number; y: number };
  } catch { /* */ }
  const navH = window.innerWidth <= 640 ? 80 : 0;
  return { x: window.innerWidth - SIZE - 24, y: window.innerHeight - SIZE - 24 - navH };
}
function savePos(pos: { x: number; y: number }) {
  localStorage.setItem(POS_KEY, JSON.stringify(pos));
}
function clamp(pos: { x: number; y: number }) {
  return {
    x: Math.max(0, Math.min(window.innerWidth  - SIZE, pos.x)),
    y: Math.max(0, Math.min(window.innerHeight - SIZE, pos.y)),
  };
}

const TIERS = [
  // name은 lib/openai.ts COACH_PERSONAS의 키(말투 단계). bond는 화면에 보이는 '정' 단계.
  { min: 0,  max: 2,       name: '글 선생님',    bond: '서먹함',   outfitMain: '#5a6ab8', labelColor: '#8f9fe8', greeting: '어서 오시오. 오늘은 무엇을 쓰려 하오?' },
  { min: 3,  max: 8,       name: '선생님',       bond: '반가움',   outfitMain: '#2e86c1', labelColor: '#37c4ff', greeting: '왔군. 오늘도 먹을 갈아 두었다.' },
  { min: 9,  max: 19,      name: '선배',         bond: '편함',     outfitMain: '#3e8e41', labelColor: '#7cff6b', greeting: '또 왔나. 좋아, 그 습관이 실력이야.' },
  { min: 20, max: 35,      name: '글쟁이 아저씨', bond: '허물없음', outfitMain: '#b7770d', labelColor: '#f7e26b', greeting: '왔으면 앉아. 글이나 쓰자고.' },
  { min: 36, max: 59,      name: '영감님',        bond: '막역함',   outfitMain: '#d35400', labelColor: '#ff8c42', greeting: '에잉, 또 왔냐. …차 식기 전에 앉아.' },
  { min: 60, max: Infinity, name: '욕쟁이 영감',  bond: '피붙이',   outfitMain: '#922b21', labelColor: '#ef3e4a', greeting: '이 녀석, 오늘은 늦었구먼. 어서 써.' },
] as const;

type Tier = (typeof TIERS)[number];
interface ChatMessage { role: 'user' | 'assistant'; content: string; }

function getTier(count: number): Tier {
  return (TIERS.find(t => count >= t.min && count <= t.max) ?? TIERS[0]) as Tier;
}
function getCount() {
  const db = loadDB();
  return db.writings.length + db.sentences.length + db.copies.length;
}

export default function PixelCharacter() {
  const [tier, setTier]           = useState<Tier>(TIERS[0] as Tier);
  const [chatOpen, setChatOpen]    = useState(false);
  const [messages, setMessages]    = useState<ChatMessage[]>([]);
  const [input, setInput]          = useState('');
  const [aiLoading, setAiLoading]  = useState(false);
  const [noKey, setNoKey]          = useState(false);
  const [pos, setPos]              = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted]       = useState(false);
  const [inputActive, setInputActive] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>('default');

  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false });
  const endRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const db = loadDB();
    const t = getTier(getCount());
    setTier(t);
    setMessages([{ role: 'assistant', content: t.greeting }]);
    setPos(loadPos());
    // 묵당 선생 — 등불이 꺼져 있으면 시무룩, 글 분석 점수가 오면 표정이 바뀐다
    setEmotion(isStreakBroken(db.journey) ? 'sad' : 'default');
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScore = (e: Event) => setEmotion(getScoreEmotion((e as CustomEvent<{ score: number }>).detail.score).emotion);
    window.addEventListener('score-updated', onScore);
    return () => window.removeEventListener('score-updated', onScore);
  }, []);

  useEffect(() => {
    const handler = () => {
      setInputActive(false);
      setChatOpen(o => {
        const next = !o;
        window.dispatchEvent(new CustomEvent('coach-chat-state', { detail: next }));
        return next;
      });
    };
    window.addEventListener('toggle-coach-chat', handler);
    return () => window.removeEventListener('toggle-coach-chat', handler);
  }, []);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [chatOpen, messages]);

  // ── 드래그 (mouse + touch 통합) ──
  function getXY(e: MouseEvent | TouchEvent) {
    if ('touches' in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function startDrag(clientX: number, clientY: number) {
    dragRef.current = { startX: clientX, startY: clientY, startPosX: pos.x, startPosY: pos.y, moved: false };
    setIsDragging(true);
  }

  useEffect(() => {
    if (!isDragging) return;

    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      const { x, y } = getXY(e);
      const dx = x - dragRef.current.startX;
      const dy = y - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      const next = clamp({ x: dragRef.current.startPosX + dx, y: dragRef.current.startPosY + dy });
      setPos(next);
    }

    function onEnd(e: MouseEvent | TouchEvent) {
      setIsDragging(false);
      const { x, y } = 'changedTouches' in e
        ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
        : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
      const dx = x - dragRef.current.startX;
      const dy = y - dragRef.current.startY;
      const finalPos = clamp({ x: dragRef.current.startPosX + dx, y: dragRef.current.startPosY + dy });
      setPos(finalPos);
      savePos(finalPos);
      if (!dragRef.current.moved) { setInputActive(false); setChatOpen(o => !o); }
    }

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup',   onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onEnd);
    };
  }, [isDragging]);

  async function handleSend() {
    const text = input.trim();
    if (!text || aiLoading) return;
    setInput('');
    setNoKey(false);
    const s = loadSettings();
    if (!aiReady(s)) { setNoKey(true); return; }
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setAiLoading(true);
    try {
      const reply = await chatWithCoach(s, tier.name, messages, text);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : '알 수 없는 오류';
      setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${errMsg}` }]);
    } finally {
      setAiLoading(false);
    }
  }

  if (!mounted) return null;

  const isMobile = window.innerWidth <= 640;
  const chatW = isMobile ? window.innerWidth - 32 : 300;
  const chatH = isMobile ? window.innerHeight - 120 : 420;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const chatLeft = isMobile ? 16 : (pos.x + SIZE + 8 + chatW > vw ? pos.x - chatW - 8 : pos.x + SIZE + 8);
  const chatTop  = isMobile ? 60 : (pos.y + chatH > vh ? pos.y - chatH + SIZE : pos.y);

  return (
    <>
      {/* 채팅창 — display:none으로 숨김 (unmount 안 함 → 키보드 자동 트리거 방지) */}
      <div style={{
          position: 'fixed',
          left: Math.max(8, Math.min(vw - chatW - 8, chatLeft)),
          top:  Math.max(8, Math.min(vh - chatH - 8, chatTop)),
          width: chatW, height: chatH, zIndex: 301,
          background: 'var(--bg-card)', border: '1.5px solid var(--card-border)',
          borderRadius: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          display: chatOpen ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--card-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: tier.outfitMain + '18',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: tier.outfitMain, boxShadow: `0 0 6px ${tier.outfitMain}` }} />
              <span style={{ fontSize: 13, color: tier.labelColor }}>묵당 선생 <span style={{ fontSize: 10, color: 'var(--dim-star)' }}>· 정 {tier.bond}</span></span>
            </div>
            <button onClick={() => { setInputActive(false); setChatOpen(false); window.dispatchEvent(new CustomEvent('coach-chat-state', { detail: false })); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    maxWidth: '74%', padding: '8px 12px',
                    borderRadius: '14px 4px 14px 14px',
                    background: tier.outfitMain,
                    color: '#fff',
                    fontSize: 13, lineHeight: 1.6, fontFamily: 'Pretendard, sans-serif', whiteSpace: 'pre-wrap',
                  }}>{m.content}</div>
                </div>
              ) : (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  {/* 프로필 — 묵당 선생 */}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${tier.outfitMain}55` }}>
                    <Speaker id="muk" emotion={emotion} size={28} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* 이름 (첫 메시지 또는 이전이 유저 메시지일 때만) */}
                    {(i === 0 || messages[i - 1]?.role === 'user') && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: tier.labelColor, fontFamily: 'Pretendard, sans-serif', paddingLeft: 2 }}>
                        묵당 선생
                      </span>
                    )}
                    <div style={{
                      maxWidth: 210, padding: '8px 12px',
                      borderRadius: '4px 14px 14px 14px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text)',
                      fontSize: 13, lineHeight: 1.6, fontFamily: 'Pretendard, sans-serif', whiteSpace: 'pre-wrap',
                    }}>{m.content}</div>
                  </div>
                </div>
              )
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${tier.outfitMain}55` }}>
                  <Speaker id="muk" emotion={emotion} size={28} />
                </div>
                <div style={{ padding: '8px 14px', borderRadius: '4px 14px 14px 14px', background: 'var(--bg-subtle)', border: '1px solid var(--card-border)', color: 'var(--dim-star)', fontSize: 18, letterSpacing: 4 }}>···</div>
              </div>
            )}
            {noKey && <div style={{ fontSize: 12, color: 'var(--bad)', textAlign: 'center', lineHeight: 1.6 }}>설정에서 API 키를 먼저 입력해주세요.</div>}
            <div ref={endRef} />
          </div>

          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={inputRef}
              inputMode={isMobile ? (inputActive ? 'text' : 'none') : undefined}
              readOnly={isMobile ? !inputActive : false}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              onFocus={e => { if (isMobile && !inputActive) e.currentTarget.blur(); }}
              onClick={() => {
                if (isMobile && !inputActive) {
                  setInputActive(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }
              }}
              placeholder="스승에게 물어보기..."
              disabled={aiLoading}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10,
                border: '1.5px solid var(--card-border)',
                background: 'var(--bg-card)',
                color: 'var(--text)',
                fontSize: 13, fontFamily: 'Pretendard, sans-serif', outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={aiLoading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: tier.outfitMain, color: '#fff', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (aiLoading || !input.trim()) ? 0.4 : 1, transition: 'opacity 0.12s', flexShrink: 0,
              }}
            >↑</button>
          </div>
        </div>

      {/* 캐릭터 — 드래그 가능 (데스크톱 전용) */}
      {!isMobile && <div
        onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={e => { startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
        style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 300,
          width: SIZE, height: SIZE,
          cursor: isDragging ? 'grabbing' : 'grab',
          borderRadius: '50%', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-card)',
          userSelect: 'none', touchAction: 'none',
          animation: isDragging ? undefined : 'float-up 4s ease-in-out infinite',
          filter: chatOpen
            ? `drop-shadow(0 0 10px ${tier.outfitMain}aa)`
            : `drop-shadow(0 2px 6px rgba(0,0,0,0.35))`,
          transition: isDragging ? undefined : 'filter 0.2s',
        }}
      >
        <Speaker id="muk" emotion={emotion} size={SIZE * 0.8} style={{ pointerEvents: 'none' }} />
      </div>}
    </>
  );
}
