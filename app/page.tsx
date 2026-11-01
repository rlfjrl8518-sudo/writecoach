'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDB, computeDailyChars, loadGamification, type DB } from '@/lib/db';
import {
  computeInk, levelInfo, storyView, todayQuests, weeklyFor, weekKey, todayKey,
  currentStreak, fogLevel, getGame, WEEKLY_MONSTERS, INK,
} from '@/lib/game';
import { SPEAKERS, yearTitle, actOf } from '@/lib/story';
import StudyScene from '@/components/game/StudyScene';
import { Monster, Speaker } from '@/components/pixel/Pixel';
import { queuePendingScenes } from '@/components/game/GameLayer';

const PLACES = [
  { href: '/writing', name: '글방', icon: '✎', desc: '글쓰기 · 분석 · 첨삭' },
  { href: '/books', name: '서고', icon: '冊', desc: '독서 기록' },
  { href: '/sentence', name: '장터', icon: '文', desc: '문장 수집' },
  { href: '/copy', name: '간판 거리', icon: '広', desc: '카피 수집' },
  { href: '/expressions', name: '사전각', icon: '辭', desc: '표현 사전' },
  { href: '/training', name: '수련터', icon: '◎', desc: '도장 훈련 · 과제' },
  { href: '/report', name: '우체국', icon: '✉', desc: '스승의 월간 편지' },
  { href: '/calendar', name: '달력', icon: '暦', desc: '기록의 날들' },
];

function mentorLine(db: DB, wroteToday: boolean, fog: number, questsDone: number, streak: number, name: string): string {
  const n = name || '자네';
  if (!db.writings.length) return `${n}, 첫 글은 서툴러도 되네. 글방으로 가 보게.`;
  if (fog >= 0.6) return '안개가 짙어졌어. 며칠 등불이 꺼져 있었지. 한 줄이라도 좋으니 다시 켜게.';
  if (!wroteToday && new Date().getHours() >= 21) return '밤이 깊었네. 오늘 등불은 아직이군. 세 줄이면 충분해.';
  if (!wroteToday) return `${n}, 오늘 글은 아직이군. 먹부터 갈아 두게.`;
  if (questsDone === 3) return '오늘 숙제는 끝났군. 차 한잔 하고 쉬게. 쉬는 것도 수련이야.';
  if (streak >= 7) return `${streak}일째 등불이 켜져 있네. 안개가 마을 밖까지 물러났어.`;
  return '오늘 등불은 켜졌네. 남은 숙제도 마저 하겠나?';
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
  const ink = computeInk(db);
  const lv = levelInfo(ink.total);
  const sv = storyView(db);
  const quests = todayQuests(db);
  const questsDone = quests.filter(q => q.done).length;
  const weekly = weeklyFor(db, weekKey(todayKey()));
  const monster = WEEKLY_MONSTERS[weekly.dim];
  const streak = currentStreak(db);
  const fog = fogLevel(db);
  const wroteToday = db.writings.some(w => (w.date || '').slice(0, 10) === todayKey());
  const dailyChars = computeDailyChars(db.writings);
  const dailyGoal = loadGamification().dailyGoal;
  const cur = sv.current;
  const act = cur ? actOf(g.year, cur.chapter.id) : null;
  const guest = cur && cur.chapter.mentor !== 'muk' ? cur.chapter.mentor : null;
  const robe = { robe: lv.rank.robe, color: lv.rank.color };
  const segs = 12;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 24 }}>
      {/* HUD */}
      <div className="g-panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
        <Speaker id="me" size={44} robe={robe} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15 }}>{g.name || '이름 없는 문하생'}</span>
            <span style={{ fontSize: 11, color: lv.rank.color }}>Lv.{lv.level} {lv.rank.title}</span>
          </div>
          <div className="g-meter" style={{ marginTop: 6 }}>
            {Array.from({ length: segs }, (_, i) => <i key={i} className={i < Math.round(lv.progress * segs) ? 'on' : ''} style={{ '--c': lv.rank.color } as React.CSSProperties} />)}
          </div>
          <div className="g-dim" style={{ fontSize: 10, marginTop: 4 }}>
            먹 {ink.total.toLocaleString()}{lv.next ? ` · 다음 단계까지 ${(lv.next - ink.total).toLocaleString()}` : ' · 최고 단계'}
          </div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 52 }}>
          <div style={{ fontSize: 20, color: streak ? 'var(--accent)' : 'var(--text-disabled)' }}>{streak ? '◆' : '◇'}</div>
          <div style={{ fontSize: 10 }} className="g-dim">등불 {streak}일</div>
        </div>
      </div>

      {/* 서재 장면 + 스승의 말 */}
      <StudyScene fog={fog} lampLit={wroteToday} guest={guest} robe={robe} />
      <div className="g-panel" style={{ marginTop: 8 }}>
        <div className="g-dialog">
          <div style={{ flex: 1 }}>
            <div className="who" style={{ color: 'var(--moon)' }}>묵당 선생</div>
            <div className="txt">{mentorLine(db, wroteToday, fog, questsDone, streak, g.name)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
          <Link href="/writing" className="g-btn primary">✎ 오늘의 글 쓰기</Link>
          <button className="g-btn" onClick={() => queuePendingScenes(loadDB())}>이야기 듣기</button>
        </div>
      </div>

      {/* 스승의 숙제 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">오늘의 숙제 <span className="g-dim" style={{ marginLeft: 'auto', fontSize: 10 }}>개당 +{INK.quest} · 모두 +{INK.questAll}</span></div>
        {quests.map(q => (
          <Link key={q.def.id} href={q.def.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', textDecoration: 'none', color: q.done ? 'var(--dim-star)' : 'var(--text)', borderBottom: '2px dashed var(--line-soft)' }}>
            <span style={{ width: 18, color: q.done ? 'var(--good)' : 'var(--text-disabled)' }}>{q.done ? '■' : '□'}</span>
            <span style={{ flex: 1, fontSize: 13, textDecoration: q.done ? 'line-through' : undefined }}>{q.def.label}</span>
            <span className="g-chip" style={{ color: 'var(--secondary)' }}>{q.def.place}</span>
          </Link>
        ))}
        <div style={{ marginTop: 10 }}>
          <div className="g-dim" style={{ fontSize: 10, marginBottom: 4 }}>오늘 쓴 글자 {dailyChars.toLocaleString()} / {dailyGoal.toLocaleString()}</div>
          <div className="g-meter">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.round(Math.min(1, dailyChars / dailyGoal) * 10) ? 'on' : ''} />)}</div>
        </div>
      </div>

      {/* 이야기 */}
      <div className="g-panel hi" style={{ marginTop: 12 }}>
        <div className="g-h">이야기 · {yearTitle(g.year)}</div>
        {cur ? (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              {cur.trial ? <Monster id={cur.trial.boss} size={56} className="anim-bob" /> : <Speaker id={cur.chapter.mentor} size={56} />}
              <div style={{ minWidth: 0 }}>
                <div className="g-dim" style={{ fontSize: 10 }}>{act?.season} · {act?.title} — {cur.index + 1}장</div>
                <div style={{ fontSize: 15, margin: '2px 0' }}>{cur.chapter.title}</div>
                <div className="g-dim" style={{ fontSize: 11 }}>스승: {SPEAKERS[cur.chapter.mentor].name}</div>
              </div>
            </div>
            {cur.reqs.map(r => (
              <Link key={r.req.label} href={r.req.href} style={{ display: 'block', textDecoration: 'none', color: 'var(--text)', margin: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{r.done ? '■' : '□'} {r.req.label}</span><span className="g-dim">{r.have}/{r.need}</span>
                </div>
                <div className="g-meter" style={{ marginTop: 3 }}>{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < Math.round((r.have / r.need) * 8) ? 'on' : ''} />)}</div>
              </Link>
            ))}
            {cur.trial && (
              <Link href={`/story/trial?ch=${cur.chapter.id}`} className={`g-btn ${cur.reqsDone ? 'danger' : ''}`} style={{ marginTop: 10, pointerEvents: cur.reqsDone ? undefined : 'none', opacity: cur.reqsDone ? 1 : 0.5 }}>
                ⚔ 시련에 도전 {cur.reqsDone ? '' : '(조건을 먼저 채우게)'}
              </Link>
            )}
            <Link href="/story" className="g-btn sm" style={{ marginTop: 10 }}>이야기 전체 보기 →</Link>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 13, marginBottom: 10 }}>이번 해의 이야기를 모두 마쳤다.</div>
            <Link href="/story" className="g-btn primary">다음 해로 →</Link>
          </div>
        )}
      </div>

      {/* 주간 요괴 */}
      <div className={`g-panel ${weekly.defeated ? '' : 'boss'}`} style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className={weekly.defeated ? '' : 'anim-bob'} style={{ opacity: weekly.defeated ? 0.35 : 1, filter: weekly.defeated ? 'grayscale(1)' : undefined }}>
          <Monster id={monster.sprite} size={64} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="g-h" style={{ color: weekly.defeated ? 'var(--good)' : 'var(--bad)', marginBottom: 4 }}>이번 주 요괴 · {monster.name}</div>
          <div style={{ fontSize: 12 }} className="g-dim">{monster.desc}</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>
            {weekly.defeated ? `퇴치 완료! (+${INK.weekly} 먹)` : `이번 주 글 중 ${weekly.dim} ${weekly.target}점 이상이면 퇴치 (지금 최고 ${weekly.best}) — 최근 평균 ${weekly.avg != null ? weekly.avg.toFixed(1) : '-'}점, 가장 약한 항목이라 나타났다.`}
          </div>
        </div>
      </div>

      {/* 마을 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">산마루 마을</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {PLACES.map(p => (
            <Link key={p.href} href={p.href} className="g-btn" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, minHeight: 64 }}>
              <span style={{ fontSize: 13 }}><span style={{ color: 'var(--accent)', marginRight: 6 }}>{p.icon}</span>{p.name}</span>
              <span className="g-dim" style={{ fontSize: 10 }}>{p.desc}</span>
            </Link>
          ))}
          <Link href="/journey" className="g-btn" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, minHeight: 64 }}>
            <span style={{ fontSize: 13 }}><span style={{ color: 'var(--accent)', marginRight: 6 }}>印</span>수련 기록</span>
            <span className="g-dim" style={{ fontSize: 10 }}>등급 · 인장 · 가르침</span>
          </Link>
          <Link href="/guide" className="g-btn" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 10, minHeight: 64 }}>
            <span style={{ fontSize: 13 }}><span style={{ color: 'var(--accent)', marginRight: 6 }}>?</span>안내서</span>
            <span className="g-dim" style={{ fontSize: 10 }}>채점 기준 · 사용법</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
