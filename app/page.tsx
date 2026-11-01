'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDB, type DB } from '@/lib/db';
import { pathView, todayView, currentStreak, bestStreak, fogLevel, getGame, rankOf, weekKey, todayKey, addDays } from '@/lib/game';
import { chapterOf } from '@/lib/curriculum';
import StudyScene from '@/components/game/StudyScene';
import { Speaker, Monster } from '@/components/pixel/Pixel';
import { queuePendingScenes } from '@/components/game/GameLayer';

function mentorLine(db: DB, lit: boolean, done: boolean, fog: number, streak: number, name: string): string {
  const n = name || '자네';
  if (!db.writings.length && !(db.drillLogs ?? []).length) return `${n}, 첫 수는 '사실과 해석 가르기'일세. 10분이면 되네.`;
  if (fog >= 0.6) return '안개가 짙어졌어. 며칠 등불이 꺼져 있었지. 오늘 한 수면 다시 걷히네.';
  if (done) return streak >= 7 ? `${streak}일째 등불이 켜져 있네. 안개가 마을 밖까지 물러났어.` : '오늘 수련은 끝났네. 차 한잔 하고 쉬게. 쉬는 것도 수련이야.';
  if (lit) return '등불은 켜졌네. 오늘 수를 끝까지 마치면 백지첩 한 장이 돌아오지.';
  if (new Date().getHours() >= 21) return '밤이 깊었네. 오늘 등불은 아직이군. 워밍업 한 문장이라도 쓰고 자게.';
  return `${n}, 먹을 갈아 두었네. 오늘의 수를 시작하겠나?`;
}

export default function HubPage() {
  const [db, setDb] = useState<DB | null>(null);
  useEffect(() => {
    const load = () => setDb(loadDB());
    load();
    window.addEventListener('db-saved', load);
    return () => window.removeEventListener('db-saved', load);
  }, []);
  if (!db) return null;

  const g = getGame(db);
  const pv = pathView(db);
  const tv = todayView(db);
  const rank = rankOf(db);
  const streak = currentStreak(db);
  const fog = fogLevel(db);
  const su = tv.su;
  const ch = su ? chapterOf(su.n) : null;
  const robe = { robe: rank.robe, color: rank.color };
  const stepsDone = [tv.steps.warmup, tv.steps.drill, tv.steps.write].filter(Boolean).length;
  // 지난주에 쓴 글이 있는데 편지를 아직 안 받았으면 안내
  const lastWeek = weekKey(addDays(todayKey(), -7));
  const letterReady = !g.letters.some(l => l.week === lastWeek) && db.writings.some(w => weekKey((w.date || w.createdAt).slice(0, 10)) === lastWeek);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 24 }}>
      <div className="g-panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
        <Speaker id="me" size={44} robe={robe} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15 }}>{g.name || '이름 없는 제자'}</span>
            <span style={{ fontSize: 11, color: rank.color }}>{rank.title}</span>
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 6 }} aria-label={`백지첩 ${pv.masteredCount}/24`}>
            {pv.chapters.flatMap(c => c.sus).map(s => (
              <i key={s.su.n} title={`제${s.su.n}수 ${s.su.title}`} style={{ flex: 1, height: 10, background: s.mastered ? 'var(--accent)' : 'var(--line-soft)', boxShadow: s.su.n % 4 === 0 ? '2px 0 0 var(--card-border)' : undefined }} />
            ))}
          </div>
          <div className="g-dim" style={{ fontSize: 10, marginTop: 4 }}>백지첩 {pv.masteredCount} / 24{pv.cycle > 1 ? ` · ${pv.cycle}회차` : ''}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 56 }}>
          <div style={{ fontSize: 22, color: tv.lit ? 'var(--accent)' : 'var(--text-disabled)' }}>{tv.lit ? '◆' : '◇'}</div>
          <div style={{ fontSize: 10 }} className="g-dim">등불 {streak}일</div>
        </div>
      </div>

      <StudyScene fog={fog} lampLit={tv.lit} robe={robe} />

      <div className="g-panel hi" style={{ marginTop: 8 }}>
        <div className="g-dialog">
          <div style={{ flex: 1 }}>
            <div className="who" style={{ color: 'var(--moon)' }}>묵당 선생</div>
            <div className="txt">{mentorLine(db, tv.lit, tv.done, fog, streak, g.name)}</div>
          </div>
        </div>
        {pv.trialChapter && !su ? (
          <Link href={`/practice/trial?ch=${pv.trialChapter.ch.n}`} className="g-btn danger" style={{ width: 'calc(100% - 8px)', minHeight: 56, marginTop: 12, justifyContent: 'flex-start', gap: 12 }}>
            <Monster id={pv.trialChapter.ch.boss.id} size={36} />
            <span style={{ textAlign: 'left' }}><span style={{ fontSize: 15 }}>{pv.trialChapter.ch.n}장 시련</span><br /><span style={{ fontSize: 11, opacity: 0.85 }}>{pv.trialChapter.rule.text}</span></span>
          </Link>
        ) : su ? (
          <Link href="/practice" className="g-btn primary" style={{ width: 'calc(100% - 8px)', minHeight: 64, marginTop: 12, justifyContent: 'space-between', gap: 12 }}>
            <span style={{ textAlign: 'left' }}>
              <span style={{ fontSize: 11, opacity: 0.8 }}>{tv.done ? '오늘 수련 완료 · 다음 수 미리 보기' : '오늘의 수련 · 10~15분'}</span><br />
              <span style={{ fontSize: 17 }}>제{su.n}수 「{su.title}」</span><br />
              <span style={{ fontSize: 11, opacity: 0.8 }}>{ch?.n}장 {ch?.title} · {ch?.dim}</span>
            </span>
            <span style={{ display: 'flex', gap: 3 }}>{[0, 1, 2].map(i => <i key={i} style={{ width: 10, height: 10, background: i < stepsDone ? 'var(--on-accent)' : 'transparent', boxShadow: '0 0 0 2px var(--on-accent)' }} />)}</span>
          </Link>
        ) : (
          <Link href="/practice" className="g-btn primary" style={{ marginTop: 12 }}>백지첩을 모두 되살렸네 — 다음 회차로</Link>
        )}
        <button className="g-btn sm" onClick={() => queuePendingScenes(loadDB())}>이야기 다시 듣기</button>
      </div>

      {letterReady && (
        <Link href="/journey?tab=letters" className="g-panel" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, textDecoration: 'none', color: 'var(--text)', '--frame': 'var(--moon)' } as React.CSSProperties}>
          <span style={{ fontSize: 22, color: 'var(--moon)' }}>✉</span>
          <span style={{ fontSize: 13 }}>묵당 선생의 주간 편지가 도착했네. 지난주 글을 읽고 썼다더군.</span>
        </Link>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 12 }}>
        <Link href="/writing" className="g-btn" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, minHeight: 64 }}>
          <span style={{ fontSize: 13 }}><span style={{ color: 'var(--accent)', marginRight: 6 }}>✎</span>글방</span>
          <span className="g-dim" style={{ fontSize: 10 }}>자유 글쓰기 · 첨삭 · 문집</span>
        </Link>
        <Link href="/books" className="g-btn" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, minHeight: 64 }}>
          <span style={{ fontSize: 13 }}><span style={{ color: 'var(--accent)', marginRight: 6 }}>冊</span>서고</span>
          <span className="g-dim" style={{ fontSize: 10 }}>독서 기록 · 인용문은 워밍업 재료로</span>
        </Link>
        <Link href="/journey" className="g-btn" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, minHeight: 64 }}>
          <span style={{ fontSize: 13 }}><span style={{ color: 'var(--accent)', marginRight: 6 }}>印</span>기록</span>
          <span className="g-dim" style={{ fontSize: 10 }}>최고 등불 {bestStreak(db)}일 · 주간 편지 · 리포트</span>
        </Link>
      </div>
    </div>
  );
}
