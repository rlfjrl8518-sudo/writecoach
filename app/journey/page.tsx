'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDB, type DB } from '@/lib/db';
import { computeInk, levelInfo, storyView, getGame, currentStreak, RANKS, inkForLevel } from '@/lib/game';
import { chaptersOf, getYear, SPEAKERS, type SpeakerId } from '@/lib/story';
import { Speaker, Monster } from '@/components/pixel/Pixel';

const MENTORS: SpeakerId[] = ['muk', 'yoon', 'chekhov', 'hemingway', 'woolf', 'yeonam', 'kimyujeong', 'orwell', 'yisang'];

export default function JourneyPage() {
  const [db, setDb] = useState<DB | null>(null);
  useEffect(() => { setDb(loadDB()); }, []);
  if (!db) return null;

  const g = getGame(db);
  const ink = computeInk(db);
  const lv = levelInfo(ink.total);
  const sv = storyView(db);
  const streak = currentStreak(db);

  // 가르침 두루마리 — 지난 해는 전부, 이번 해는 마친 장만
  const lessons: { year: number; title: string; lesson: string; mentor: SpeakerId }[] = [];
  for (let y = 1; y < g.year; y++) chaptersOf(y).forEach(c => lessons.push({ year: y, title: c.title, lesson: c.lesson, mentor: c.mentor }));
  sv.chapters.filter(c => c.status === 'done').forEach(c => lessons.push({ year: g.year, title: c.chapter.title, lesson: c.chapter.lesson, mentor: c.chapter.mentor }));

  // 만난 스승 — 장면을 본 장의 스승
  const met = new Set<SpeakerId>(['muk']);
  for (let y = 1; y <= g.year; y++) {
    getYear(y).acts.forEach(a => a.chapters.forEach(c => { if (g.seenScenes.includes(`${y}:${c.id}`)) met.add(c.mentor); }));
  }
  const wins = g.trials.filter(t => t.passed);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 24 }}>
      <Link href="/" className="g-btn sm">← 서재로</Link>

      {/* 제자 카드 */}
      <div className="g-panel hi" style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Speaker id="me" size={96} robe={{ robe: lv.rank.robe, color: lv.rank.color }} className="anim-bob" />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18 }}>{g.name || '이름 없는 문하생'}</div>
          <div style={{ fontSize: 13, color: lv.rank.color, margin: '4px 0 8px' }}>Lv.{lv.level} · {lv.rank.title}</div>
          <div className="g-meter">{Array.from({ length: 16 }, (_, i) => <i key={i} className={i < Math.round(lv.progress * 16) ? 'on' : ''} style={{ '--c': lv.rank.color } as React.CSSProperties} />)}</div>
          <div className="g-dim" style={{ fontSize: 11, marginTop: 6 }}>먹 {ink.total.toLocaleString()} {lv.next ? `/ 다음 ${lv.next.toLocaleString()}` : '(최고 단계)'} · 등불 {streak}일 · 최고 {db.journey?.maxStreak ?? 0}일</div>
        </div>
      </div>

      {/* 등급의 길 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">등급의 길</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {RANKS.map(r => {
            const reached = lv.level >= r.from;
            return (
              <div key={r.title} style={{ textAlign: 'center', padding: 8, opacity: reached ? 1 : 0.4, boxShadow: `0 0 0 2px ${lv.rank.title === r.title ? r.color : 'var(--line-soft)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Speaker id="me" size={44} robe={{ robe: r.robe, color: r.color }} style={{ filter: reached ? undefined : 'grayscale(1)' }} /></div>
                <div style={{ fontSize: 12, color: r.color, marginTop: 4 }}>{r.title}</div>
                <div className="g-dim" style={{ fontSize: 10 }}>Lv.{r.from} · 먹 {inkForLevel(r.from).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 먹 내역 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">먹이 쌓인 곳</div>
        {ink.parts.sort((a, b) => b.ink - a.ink).map(p => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, margin: '4px 0' }}>
            <span style={{ width: 84 }}>{p.label}</span>
            <div style={{ flex: 1, height: 8, background: 'var(--line-soft)' }}><div style={{ height: '100%', width: `${(p.ink / Math.max(1, ink.total)) * 100}%`, background: 'var(--accent)' }} /></div>
            <span className="g-dim" style={{ width: 56, textAlign: 'right' }}>{p.ink.toLocaleString()}</span>
          </div>
        ))}
        <div className="g-dim" style={{ fontSize: 11, marginTop: 8 }}>숙제를 모두 마친 날 {ink.questDays}일 · 주간 요괴 퇴치 {ink.weeklyWins}번</div>
      </div>

      {/* 인장 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">인장 <span className="g-dim" style={{ marginLeft: 'auto', fontSize: 10 }}>{ink.seals.filter(s => s.got).length} / {ink.seals.length}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
          {ink.seals.map(({ def, got }) => (
            <div key={def.id} title={def.desc} style={{ textAlign: 'center', padding: '10px 4px', opacity: got ? 1 : 0.35, boxShadow: `0 0 0 2px ${got ? 'var(--bad)' : 'var(--line-soft)'}` }}>
              <div style={{ width: 36, height: 36, margin: '0 auto 6px', background: got ? 'var(--bad)' : 'transparent', boxShadow: '0 0 0 2px var(--bad)', color: got ? '#fff' : 'var(--bad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                {def.name.slice(0, 2)}
              </div>
              <div style={{ fontSize: 11 }}>{def.name}</div>
              <div className="g-dim" style={{ fontSize: 9 }}>{def.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 만난 스승 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">서재의 손님들</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {MENTORS.map(id => {
            const ok = met.has(id);
            return (
              <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 6, boxShadow: '0 0 0 2px var(--line-soft)' }}>
                <div style={{ filter: ok ? undefined : 'brightness(0)', opacity: ok ? 1 : 0.5 }}><Speaker id={id} size={40} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: ok ? SPEAKERS[id].color : 'var(--dim-star)' }}>{ok ? SPEAKERS[id].name : '???'}</div>
                  <div className="g-dim" style={{ fontSize: 9, lineHeight: 1.4 }}>{ok ? SPEAKERS[id].bio : '아직 책 속에 있다'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 가르침 두루마리 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">가르침 두루마리 <span className="g-dim" style={{ marginLeft: 'auto', fontSize: 10 }}>{lessons.length}장</span></div>
        {lessons.length === 0 && <div className="g-dim" style={{ fontSize: 12 }}>장을 마칠 때마다 스승의 가르침이 여기에 남는다.</div>}
        {lessons.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '2px dashed var(--line-soft)' }}>
            <Speaker id={l.mentor} size={28} />
            <div>
              <div style={{ fontSize: 13, color: 'var(--moon)', fontFamily: 'var(--font-read)' }}>「{l.lesson}」</div>
              <div className="g-dim" style={{ fontSize: 10 }}>{l.year}번째 해 · {l.title} · {SPEAKERS[l.mentor].name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 시련 기록 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">물리친 요괴</div>
        {wins.length === 0 ? <div className="g-dim" style={{ fontSize: 12 }}>아직 없다.</div> : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {wins.map(t => (
              <div key={t.id} style={{ textAlign: 'center', width: 84 }}>
                <Monster id={t.boss} size={48} style={{ margin: '0 auto', filter: 'grayscale(0.6)' }} />
                <div style={{ fontSize: 10 }}>{SPEAKERS[t.boss].name}</div>
                <div className="g-dim" style={{ fontSize: 9 }}>{t.year}번째 해 · {t.createdAt.slice(0, 10)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
