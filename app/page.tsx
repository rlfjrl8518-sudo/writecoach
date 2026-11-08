'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadDB, type DB, type WritingEntry } from '@/lib/db';
import { pathView, todayView, streakInfo, fogLevel, getGame, rankOf, weekKey, todayKey, addDays, practiceDays } from '@/lib/game';
import { chapterOf, WORDS, SPEAKER_NAME, type Emotion } from '@/lib/curriculum';
import { currentTerm, studyObjects, unlockedMemories, nextMemory, dayRand, timeOf, seasonOf, SEASON_NAME, MEMORIES } from '@/lib/story';
import LivingStudy from '@/components/game/LivingStudy';
import { Monster, Speaker } from '@/components/art/Art';
import { queuePendingScenes } from '@/components/game/GameLayer';
import { playScene } from '@/components/game/ScenePlayer';

/* ── 묵당의 한마디: 기록에서 사실을 짚어 '알아봐 주는' 말 ── */
function sentences(t: string) { return t.split(/(?<=[.!?。…])\s+|\n+/).map(x => x.trim()).filter(x => x.length > 1); }
function recognize(db: DB): { text: string; emo: Emotion } | null {
  const ws = [...db.writings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const w = ws[0]; if (!w) return null;
  const prev = ws[1];
  const title = (w.topic || '').replace(/^\[[^\]]+\]\s*/, '').slice(0, 18) || w.type;
  const ago = Math.round((Date.now() - new Date(w.createdAt).getTime()) / 86400000);
  const when = ago <= 0 ? '오늘' : ago === 1 ? '어제' : `${ago}일 전에`;
  const avg = (x: WritingEntry) => { const s = sentences(x.text); return s.length ? Math.round(x.text.length / s.length) : 0; };
  const a = avg(w), b = prev ? avg(prev) : 0;
  if (prev && b && a && b - a >= 6) return { text: `${when} 쓴 「${title}」, 문장 평균이 ${b}자에서 ${a}자로 줄었군. 덜어내는 손이 생겼어.`, emo: 'happy' };
  const bd = w.analysis?.score_breakdown;
  if (bd) {
    const top = Object.entries(bd).sort((x, y) => y[1] - x[1])[0];
    const low = Object.entries(bd).sort((x, y) => x[1] - y[1])[0];
    if (dayRand(todayKey(), 3) < 0.5) return { text: `${when} 쓴 「${title}」은 ${top[0]}이 제일 좋았어. ${w.text.length}자를 끝까지 썼고.`, emo: 'happy' };
    return { text: `「${title}」, ${low[0]}이 아직 약하더군. 오늘 수련에서 그걸 의식해 보게.`, emo: 'think' };
  }
  return { text: `${when} 「${title}」을 ${w.text.length}자 썼더군. 끝낸 글은 지워지지 않는다.`, emo: 'happy' };
}

function mentorLines(db: DB, lit: boolean, done: boolean, fog: number, streak: number, name: string): { text: string; emo: Emotion }[] {
  const n = name || '자네';
  const out: { text: string; emo: Emotion }[] = [];
  const h = new Date().getHours();
  if (!db.writings.length && !(db.drillLogs ?? []).length) out.push({ text: `${n}, 첫 수는 '사실과 해석 가르기'일세. 10분이면 된다.`, emo: 'default' });
  else if (fog >= 0.6) out.push({ text: '안개가 짙어졌어. 며칠 등불이 꺼져 있었지. 괜찮다. 오늘 한 수면 다시 걷힌다.', emo: 'sad' });
  else if (done) out.push(streak >= 7 ? { text: `${streak}일째 등불이 켜져 있군. 안개가 마을 밖까지 물러났어.`, emo: 'happy' } : { text: '오늘 수련은 끝났다. 차 한잔 하고 쉬게. 쉬는 것도 수련이야.', emo: 'happy' });
  else if (lit) out.push({ text: '등불은 켜졌다. 오늘 수를 끝까지 마치면 백지첩 한 장이 돌아오지.', emo: 'default' });
  else if (h >= 21 || h < 4) out.push({ text: '밤이 깊었다. 등불은 아직이군. 한 문장이라도 쓰고 자게.', emo: 'think' });
  else if (h < 9) out.push({ text: `일찍 왔군, ${n}. 새벽 문장이 제일 정직하지.`, emo: 'happy' });
  else out.push({ text: `${n}, 먹을 갈아 두었다. 오늘의 수를 시작하겠나?`, emo: 'default' });
  const rec = recognize(db); if (rec) out.push(rec);
  const t = currentTerm();
  out.push({ text: `${t.name}일세. ${t.line}`, emo: 'think' });
  return out;
}

export default function HubPage() {
  const router = useRouter();
  const [db, setDb] = useState<DB | null>(null);
  const [say, setSay] = useState(0);
  const [gift, setGift] = useState<string | null>(null);
  useEffect(() => {
    const load = () => setDb(loadDB());
    load();
    window.addEventListener('db-saved', load);
    return () => window.removeEventListener('db-saved', load);
  }, []);
  const derived = useMemo(() => {
    if (!db) return null;
    const g = getGame(db);
    const tv = todayView(db);
    const si = streakInfo(db);
    const fog = fogLevel(db);
    const days = practiceDays(db).size;
    return { g, pv: pathView(db), tv, si, fog, days, rank: rankOf(db), lines: mentorLines(db, tv.lit, tv.done, fog, si.streak, g.name) };
  }, [db]);
  if (!db || !derived) return null;
  const { g, pv, tv, si, fog, days, rank, lines } = derived;

  const su = tv.su;
  const ch = su ? chapterOf(su.n) : null;
  const stepsDone = [tv.steps.warmup, tv.steps.write, tv.steps.revise].filter(Boolean).length;
  const line = lines[say % lines.length];
  const objs = studyObjects(days).map(o => o.id).filter(id => id !== 'cat');
  const today = todayKey();
  // 먹물: 기억 '마루 밑 손님'(5일) 이후. 자주 올수록 자주 보이고, 밤이나 사흘 연속이면 잠들어 있다.
  const catOn = days >= 5 && dayRand(today, 1) < 0.35 + Math.min(0.55, si.streak * 0.08);
  const catSleep = timeOf() === 'night' || (si.streak >= 3 && dayRand(today, 2) < 0.5);
  const giftWord = WORDS[Math.floor(dayRand(today, 4) * WORDS.length)];
  const term = currentTerm();
  const mems = unlockedMemories(days);
  const nm = nextMemory(days);
  const lastWeek = weekKey(addDays(today, -7));
  const letterReady = !g.letters.some(l => l.week === lastWeek) && db.writings.some(w => weekKey((w.date || w.createdAt).slice(0, 10)) === lastWeek);
  const trial = pv.trialChapter && !su ? pv.trialChapter : null;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', paddingBottom: 28 }}>
      {/* 서재 */}
      <LivingStudy fog={fog} lampLit={tv.lit} objects={objs} cat={catOn ? (catSleep ? 'sleep' : 'sit') : null}
        mukEmotion={line.emo} onMuk={() => setSay(s => s + 1)}
        onCat={() => setGift(giftWord)}>
        <div className="hub-say" onClick={() => setSay(s => s + 1)}>
          <span className="vn-name" style={{ position: 'static', display: 'inline-block', marginBottom: 6, fontSize: 13 }}>묵당 선생</span>
          <div key={say} className="t-read anim-in" style={{ fontSize: 'clamp(14px, 1.9vw, 17px)', lineHeight: 1.75 }}>{line.text}</div>
        </div>
        <div className="hub-chips">
          <span>{SEASON_NAME[seasonOf()]} · {term.name}</span>
          <span title="연속 수련일 · 먹 한 방울은 하루 거른 날을 메워 준다">등불 {si.streak}일{si.drops ? ` · 먹 ${'●'.repeat(si.drops)}` : ''}</span>
        </div>
      </LivingStudy>
      <div className="hub-say-m" onClick={() => setSay(s => s + 1)}>
        <span className="vn-name" style={{ position: 'static', display: 'inline-block', marginBottom: 6, fontSize: 12 }}>묵당 선생</span>
        <div key={say} className="t-read anim-in" style={{ fontSize: 15, lineHeight: 1.75 }}>{line.text}</div>
      </div>

      {gift && (
        <div className="g-panel anim-in" style={{ marginTop: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/obj_cat.webp" alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          <div style={{ flex: 1 }}>
            <div className="t-read" style={{ fontSize: 15 }}>먹물이 낱말 하나를 물고 왔다 — <b style={{ color: 'var(--seal)' }}>「{gift}」</b></div>
            <div className="g-dim" style={{ fontSize: 12, marginTop: 2 }}>오늘 한 편 쓰기의 글감으로 써 보겠나?</div>
          </div>
          <button className="g-btn primary sm" onClick={() => { try { localStorage.setItem('wc_gift_word', gift); } catch { /* */ } router.push('/practice'); }}>받아 쓰기</button>
          <button className="g-btn sm" onClick={() => setGift(null)}>나중에</button>
        </div>
      )}

      <div className="hub-grid">
        {/* 오늘의 수련 */}
        <div className="g-panel hi hub-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Speaker id="me" size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span className="t-title" style={{ fontSize: 17 }}>{g.name || '이름 없는 제자'}</span>
                <span className="seal" style={{ fontSize: 11 }}>{rank.title}</span>
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 8 }} aria-label={`백지첩 ${pv.masteredCount}/24`}>
                {pv.chapters.map(c => (
                  <div key={c.ch.n} style={{ flex: 1, display: 'flex', gap: 2 }}>
                    {c.sus.map(s => <i key={s.su.n} title={`제${s.su.n}수 ${s.su.title}`} style={{ flex: 1, height: 6, borderRadius: 3, background: s.mastered ? 'var(--seal)' : 'var(--line-soft)' }} />)}
                  </div>
                ))}
              </div>
              <div className="g-dim" style={{ fontSize: 12, marginTop: 5 }}>백지첩 {pv.masteredCount} / 24{pv.cycle > 1 ? ` · ${pv.cycle}회차` : ''} · 최고 등불 {si.best}일</div>
            </div>
          </div>

          {trial ? (
            <Link href={`/practice/trial?ch=${trial.ch.n}`} className="hub-cta boss">
              <Monster id={trial.ch.boss.id} size={74} className="anim-float" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="hub-cta-k">{trial.ch.n}장의 시련</span>
                <span className="hub-cta-t">{SPEAKER_NAME[trial.ch.boss.id]}</span>
                <span className="hub-cta-s">{trial.rule.text}</span>
              </span>
              <span className="hub-go">겨루기 →</span>
            </Link>
          ) : su ? (
            <Link href="/practice" className="hub-cta">
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="hub-cta-k">{tv.done ? '오늘 수련 완료 · 다음 수 미리 보기' : '오늘의 수련 · 10~15분'}</span>
                <span className="hub-cta-t">제{su.n}수 「{su.title}」</span>
                <span className="hub-cta-s">{ch?.n}장 {ch?.title} · {ch?.dim}</span>
              </span>
              <span className="hub-steps">{['고쳐 쓰기', '한 편 쓰기', '퇴고'].map((l, i) => <span key={l} className={i < stepsDone ? 'on' : ''}>{l}</span>)}</span>
            </Link>
          ) : (
            <Link href="/practice" className="hub-cta">
              <span className="hub-cta-t">백지첩을 모두 되살렸네 — 다음 회차로</span>
            </Link>
          )}
        </div>

        {/* 묵당의 기억 */}
        <div className="g-panel hub-side">
          <div className="g-h">묵당의 기억</div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
            {MEMORIES.map(m => <i key={m.id} title={m.day <= days ? m.title : `${m.day}일째`} style={{ flex: 1, height: 5, borderRadius: 3, background: m.day <= days ? 'var(--moon)' : 'var(--line-soft)' }} />)}
          </div>
          <div style={{ fontSize: 13.5 }}>
            {mems.length ? <>최근 · 「{mems[mems.length - 1].title}」</> : '아직 열린 기억이 없다.'}
          </div>
          <div className="g-dim" style={{ fontSize: 12, marginTop: 4 }}>
            {nm ? `수련한 날 ${days}일 · 다음 기억까지 ${nm.day - days}일` : '모든 기억이 열렸다.'}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {mems.length > 0 && <button className="g-btn sm" onClick={() => { const m = mems[mems.length - 1]; playScene({ id: `mem:${m.id}`, title: m.title, lines: m.lines, bg: m.bg, replay: true }); }}>다시 듣기</button>}
            <Link href="/journey?tab=memories" className="g-btn sm">기억첩</Link>
          </div>
        </div>
      </div>

      {letterReady && (
        <Link href="/journey?tab=letters" className="g-panel hub-letter anim-in">
          <span className="seal" style={{ fontSize: 16, padding: '6px 8px' }}>信</span>
          <span style={{ flex: 1 }}><b>묵당 선생의 주간 편지가 도착했다.</b><br /><span className="g-dim" style={{ fontSize: 12.5 }}>지난주 글을 다 읽고 썼다더군. 답장을 쓰면 다음 편지에서 읽어 준다.</span></span>
          <span className="g-dim">→</span>
        </Link>
      )}

      <div className="hub-links">
        <Link href="/writing" className="g-panel"><b>글방</b><span className="g-dim">자유 글쓰기 · 첨삭 · 문집</span></Link>
        <Link href="/books" className="g-panel"><b>서고</b><span className="g-dim">독서 기록 · 인용문은 필사 분석 재료로</span></Link>
        <Link href="/journey" className="g-panel"><b>기록</b><span className="g-dim">산마루 지도 · 편지 · 성장 리포트</span></Link>
        <button className="g-panel" onClick={() => queuePendingScenes(loadDB(), true)}><b>이야기 다시 보기</b><span className="g-dim">프롤로그 · 지금 장의 도입</span></button>
      </div>
    </div>
  );
}
