'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDB, saveDB, type DB } from '@/lib/db';
import { storyView, getGame } from '@/lib/game';
import { getYear, yearTitle, SPEAKERS } from '@/lib/story';
import { Speaker, Monster } from '@/components/pixel/Pixel';
import { playScene, hasSeen } from '@/components/game/ScenePlayer';
import { confirmDialog } from '@/components/ConfirmDialog';

const SEASON_COLOR: Record<string, string> = { 봄: '#f15bb5', 여름: '#7cff6b', 가을: '#ff8c42', 겨울: '#37c4ff' };

export default function StoryPage() {
  const [db, setDb] = useState<DB | null>(null);
  useEffect(() => {
    const load = () => setDb(loadDB());
    load();
    window.addEventListener('db-saved', load);
    return () => window.removeEventListener('db-saved', load);
  }, []);
  if (!db) return null;

  const g = getGame(db);
  const year = getYear(g.year);
  const sv = storyView(db);
  const byId = new Map(sv.chapters.map(c => [c.chapter.id, c]));

  async function startNextYear() {
    if (!await confirmDialog(`${g.year + 1}번째 해를 시작할까요? 새 해의 장 조건은 지금부터 쌓는 기록으로 셉니다. (먹·등급·인장은 그대로)`, { confirmLabel: '새 해 시작' })) return;
    const fresh = loadDB();
    const gg = getGame(fresh);
    fresh.game = { ...gg, year: gg.year + 1, yearStart: new Date().toISOString() };
    saveDB(fresh);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 24 }}>
      <Link href="/" className="g-btn sm">← 서재로</Link>
      <div className="g-panel hi" style={{ marginTop: 8 }}>
        <div className="g-h">산마루 서재 이야기</div>
        <div style={{ fontSize: 18, marginBottom: 6 }}>{yearTitle(g.year)}</div>
        <div className="g-dim" style={{ fontSize: 12, lineHeight: 1.7, fontFamily: 'var(--font-read)' }}>
          쓰지 않은 날은 하얗게 지워진다. 매일의 글이 먹이 되어 백지 안개를 걷는다.
          계절마다 서재의 책 속에서 옛 작가가 걸어 나와 가르침을 주고, 그 계절의 끝에는 글쓰기의 약점이 요괴가 되어 나타난다.
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="g-btn sm" onClick={() => playScene({ id: `prologue-${g.year}`, title: yearTitle(g.year), lines: year.prologue, replay: true })}>프롤로그 다시 보기</button>
          <span className="g-chip" style={{ color: 'var(--accent)' }}>{sv.clearedCount} / {sv.chapters.length} 장</span>
        </div>
      </div>

      {year.acts.map(act => (
        <div key={act.id} className="g-panel" style={{ marginTop: 12, '--frame': SEASON_COLOR[act.season] } as React.CSSProperties}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <Speaker id={act.mentor} size={56} />
            <div>
              <div style={{ fontSize: 11, color: SEASON_COLOR[act.season] }}>{act.season} · {act.theme}</div>
              <div style={{ fontSize: 16 }}>{act.title}</div>
              <div className="g-dim" style={{ fontSize: 11, marginTop: 2 }}>{SPEAKERS[act.mentor].name} — {SPEAKERS[act.mentor].bio}</div>
            </div>
          </div>
          {act.chapters.map(ch => {
            const v = byId.get(ch.id)!;
            const locked = v.status === 'locked';
            const sceneId = `${g.year}:${ch.id}`;
            return (
              <div key={ch.id} style={{ padding: '10px 4px', borderTop: '2px dashed var(--line-soft)', opacity: locked ? 0.45 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: v.status === 'done' ? 'var(--good)' : v.status === 'current' ? 'var(--accent)' : 'var(--text-disabled)' }}>
                    {v.status === 'done' ? '■' : v.status === 'current' ? '▶' : '□'}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>{v.index + 1}장 · {locked ? '???' : ch.title}</span>
                  {v.trial && !locked && <Monster id={v.trial.boss} size={28} style={{ opacity: v.trialPassed ? 0.35 : 1 }} />}
                  {!locked && hasSeen(sceneId) && (
                    <button className="g-btn sm" onClick={() => playScene({ id: sceneId, title: ch.title, lines: ch.scene, replay: true })}>장면</button>
                  )}
                </div>
                {v.status === 'done' && (
                  <div style={{ fontSize: 12, color: 'var(--moon)', marginTop: 4, marginLeft: 22, fontFamily: 'var(--font-read)' }}>「{ch.lesson}」</div>
                )}
                {v.status === 'current' && (
                  <div style={{ marginLeft: 22, marginTop: 6 }}>
                    {v.reqs.map(r => (
                      <Link key={r.req.label} href={r.req.href} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: r.done ? 'var(--good)' : 'var(--text)', textDecoration: 'none', padding: '2px 0' }}>
                        <span>{r.done ? '■' : '□'} {r.req.label}</span><span className="g-dim">{r.have}/{r.need}</span>
                      </Link>
                    ))}
                    {v.trial && (
                      <div style={{ marginTop: 8 }}>
                        <div className="g-dim" style={{ fontSize: 11 }}>시련 조건: {v.trial.rule}</div>
                        <Link href={`/story/trial?ch=${ch.id}`} className={`g-btn ${v.reqsDone ? 'danger' : ''}`} style={{ marginTop: 6, pointerEvents: v.reqsDone ? undefined : 'none', opacity: v.reqsDone ? 1 : 0.5 }}>
                          ⚔ {v.trial.title}에게 도전
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {sv.yearDone && (
        <div className="g-panel hi" style={{ marginTop: 12, textAlign: 'center' }}>
          <div className="g-h" style={{ justifyContent: 'center' }}>한 해의 끝</div>
          <button className="g-btn" onClick={() => playScene({ id: `epilogue-${g.year}`, title: `${yearTitle(g.year)} · 끝`, lines: year.epilogue, replay: true })}>에필로그 보기</button>
          <button className="g-btn primary" onClick={startNextYear}>{g.year + 1}번째 해 시작 →</button>
        </div>
      )}
    </div>
  );
}
