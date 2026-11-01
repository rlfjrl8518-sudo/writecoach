/* ═══════════════════════════════════════════════════════════════
   산마루 서재 이야기 — 스토리 데이터
   ───────────────────────────────────────────────────────────────
   세계관
   - 산마루 마을 언덕 위 '산마루 서재'에 노작가 묵당(墨堂, 가상의 인물)이 산다.
     30년 전 마지막 원고를 끝내지 못하고 펜을 놓았다.
   - 그 뒤로 마을에 '백지 안개'가 내린다. 아무도 기록하지 않은 날은 하얗게
     지워지고, 사람들은 자기 이야기를 조금씩 잊는다.
   - 제자(플레이어)가 매일 쓰는 글은 '먹'이 되어 안개를 걷는다.
   - 안개가 짙어질 때마다 서재의 책 속에서 옛 작가들이 걸어 나와 한 계절씩
     가르친다. (세상을 떠난 작가만 등장. 실존 인물에 대한 서술은 널리 알려진
     사실만 쓰고, 대사는 게임 속 인물의 말로 새로 쓴다. 지어낸 '명언'을
     실제 인용처럼 붙이지 않는다.)

   구조
   - 1년 = 4막(봄·여름·가을·겨울), 막마다 장 4개(가르침 3 + 시련 1).
   - 첫해와 둘째 해는 스승이 다르다. 셋째 해부터는 '심화' — 같은 스승을
     다시 만나되 요구량과 시련 기준이 오른다(year 값으로 계산).
   - 장의 요구 조건은 '이번 해가 시작된 뒤' 쌓은 기록으로 센다.
═══════════════════════════════════════════════════════════════ */

export type SpeakerId =
  | 'narr' | 'me' | 'muk'
  | 'yoon' | 'chekhov' | 'hemingway' | 'woolf'
  | 'yeonam' | 'kimyujeong' | 'orwell' | 'yisang'
  | BossId;

export type BossId =
  | 'naeili' | 'durumung' | 'neureoji' | 'baekjigwi'
  | 'ppeonhan' | 'eotbagi' | 'heurisi' | 'baekjiwang';

export interface Line { who: SpeakerId; text: string }

export interface Speaker {
  id: SpeakerId;
  name: string;
  /** 짧은 소개 — 실존 인물은 확인된 사실만 */
  bio?: string;
  color: string;
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  narr: { id: 'narr', name: '', color: 'var(--dim-star)' },
  me: { id: 'me', name: '나', color: 'var(--accent)' },
  muk: { id: 'muk', name: '묵당 선생', color: 'var(--moon)', bio: '산마루 서재의 주인. 30년 전 펜을 놓은 노작가(가상의 인물).' },

  yoon: { id: 'yoon', name: '윤동주', color: '#7fb2ff', bio: '시인(1917–1945). 유고 시집 『하늘과 바람과 별과 시』. 후쿠오카 형무소에서 세상을 떠났다.' },
  chekhov: { id: 'chekhov', name: '안톤 체호프', color: '#9be08a', bio: '러시아의 작가·의사(1860–1904). 짧은 단편과 희곡 『갈매기』 『벚꽃 동산』.' },
  hemingway: { id: 'hemingway', name: '어니스트 헤밍웨이', color: '#f2a65a', bio: '미국의 소설가(1899–1961). 『노인과 바다』. 『오후의 죽음』에서 이른바 빙산 이론을 말했다.' },
  woolf: { id: 'woolf', name: '버지니아 울프', color: '#c9a0ff', bio: '영국의 작가(1882–1941). 『댈러웨이 부인』, 에세이 『자기만의 방』.' },

  yeonam: { id: 'yeonam', name: '연암 박지원', color: '#e6d27a', bio: '조선 후기의 문장가(1737–1805). 『열하일기』. 옛것을 본받되 새롭게 만든다는 법고창신(法古創新)을 말했다.' },
  kimyujeong: { id: 'kimyujeong', name: '김유정', color: '#ff9fb0', bio: '소설가(1908–1937). 「봄봄」 「동백꽃」. 강원도 입말과 해학.' },
  orwell: { id: 'orwell', name: '조지 오웰', color: '#a8c4c8', bio: '영국의 작가(1903–1950). 『1984』, 에세이 「정치와 영어」에서 명료한 글을 위한 규칙을 제시했다.' },
  yisang: { id: 'yisang', name: '이상', color: '#b0b0d8', bio: '시인·소설가(1910–1937). 「날개」 「오감도」. 형식을 실험한 모더니스트.' },

  naeili: { id: 'naeili', name: '미루기 도깨비 내일이', color: 'var(--bad)' },
  durumung: { id: 'durumung', name: '추상 안개 두루뭉', color: 'var(--bad)' },
  neureoji: { id: 'neureoji', name: '군더더기 뱀 늘어지', color: 'var(--bad)' },
  baekjigwi: { id: 'baekjigwi', name: '백지귀(白紙鬼)', color: 'var(--bad)' },
  ppeonhan: { id: 'ppeonhan', name: '상투 앵무 뻔한말', color: 'var(--bad)' },
  eotbagi: { id: 'eotbagi', name: '꼬인 실타래 엇박이', color: 'var(--bad)' },
  heurisi: { id: 'heurisi', name: '흐릿이', color: 'var(--bad)' },
  baekjiwang: { id: 'baekjiwang', name: '백지왕', color: 'var(--bad)' },
};

/* ── 요구 조건 ── */
export type ReqKind =
  | 'writings'      // 글 n편
  | 'writtenDays'   // 글 쓴 날 n일
  | 'streak'        // 현재/최고 연속 n일 (이번 해 기준 최고 연속)
  | 'chars'         // 한 편에 n자 이상인 글
  | 'sentences'     // 문장 수집
  | 'copies'        // 카피 수집
  | 'expressions'   // 표현 사전 학습
  | 'bookNotes'     // 독서 메모
  | 'booksDone'     // 완독
  | 'drills'        // 글쓰기 도장 훈련
  | 'missions'      // 맞춤 과제 완료
  | 'proofreads'    // 첨삭 받은 글
  | 'typeWritings'; // 특정 유형 글

export interface Req {
  kind: ReqKind;
  n: number;
  /** typeWritings용 유형, chars용 최소 글자 수 */
  type?: string;
  min?: number;
  label: string;
  href: string;
}

/* ── 시련(보스) ── */
export type Dim = '표현력' | '전달력' | '구체성' | '논리성' | '가독성';

export interface Trial {
  boss: BossId;
  title: string;
  /** 시련 글의 주제 */
  prompt: string;
  /** 권장 유형 (강제는 아님) */
  type: string;
  minChars: number;
  maxChars?: number;
  /** 기준 — 분석 결과에서 이 값을 넘으면 격파 */
  dim?: Dim;
  dimMin?: number;
  scoreMin?: number;
  /** 보스 체력 막대 해설 */
  rule: string;
  /** 보스 등장 대사, 패배 시 대사, 격파 대사 */
  taunt: string[];
  lose: string;
  win: Line[];
}

export interface Chapter {
  id: string;          // 'y1-a1-c1' (year는 1·2만 정의, 3+ 심화는 2년 주기로 재사용)
  title: string;
  mentor: SpeakerId;
  /** 장에 들어설 때 재생되는 장면 */
  scene: Line[];
  reqs: Req[];
  /** 가르침 한 줄 요약 — 수련 기록의 '가르침 두루마리'에 남는다 */
  lesson: string;
  trial?: Trial;
}

export interface Act {
  id: string;
  season: '봄' | '여름' | '가을' | '겨울';
  title: string;
  mentor: SpeakerId;
  theme: string;
  chapters: Chapter[];
}

export interface Year {
  n: 1 | 2;
  title: string;
  prologue: Line[];
  epilogue: Line[];
  acts: Act[];
}

const W = (n: number, label = `글 ${n}편 쓰기`): Req => ({ kind: 'writings', n, label, href: '/writing' });
const D = (n: number): Req => ({ kind: 'writtenDays', n, label: `글 쓴 날 ${n}일 채우기`, href: '/writing' });
const S = (n: number): Req => ({ kind: 'streak', n, label: `${n}일 연속으로 쓰기`, href: '/writing' });
const C = (n: number, min: number): Req => ({ kind: 'chars', n, min, label: `${min}자 넘는 글 ${n}편`, href: '/writing' });
const SEN = (n: number): Req => ({ kind: 'sentences', n, label: `좋은 문장 ${n}개 수집`, href: '/sentence' });
const CPY = (n: number): Req => ({ kind: 'copies', n, label: `카피 ${n}개 수집`, href: '/copy' });
const EXP = (n: number): Req => ({ kind: 'expressions', n, label: `표현 ${n}개 익히기`, href: '/expressions' });
const BN = (n: number): Req => ({ kind: 'bookNotes', n, label: `독서 메모 ${n}개`, href: '/books' });
const BD = (n: number): Req => ({ kind: 'booksDone', n, label: `책 ${n}권 완독`, href: '/books' });
const DR = (n: number): Req => ({ kind: 'drills', n, label: `글쓰기 도장 훈련 ${n}회`, href: '/training' });
const MS = (n: number): Req => ({ kind: 'missions', n, label: `맞춤 과제 ${n}개 완료`, href: '/training' });
const PR = (n: number): Req => ({ kind: 'proofreads', n, label: `첨삭 ${n}번 받기`, href: '/writing' });
const TY = (type: string, n: number): Req => ({ kind: 'typeWritings', n, type, label: `${type} ${n}편`, href: `/writing?type=${encodeURIComponent(type)}` });

/* ═══════════════════ 첫해 — 「먹을 가는 해」 ═══════════════════ */
const YEAR1: Year = {
  n: 1,
  title: '첫해 · 먹을 가는 해',
  prologue: [
    { who: 'narr', text: '산마루 마을에는 이상한 안개가 내린다. 아무도 기록하지 않은 날은 하얗게 지워지고, 사람들은 자기 이야기를 조금씩 잊어 간다.' },
    { who: 'narr', text: '마을 사람들은 그것을 \'백지 안개\'라 불렀다.' },
    { who: 'narr', text: '안개 속에서 길을 잃은 당신은 언덕 꼭대기, 불이 켜진 서재의 문을 두드린다.' },
    { who: 'muk', text: '…문이 열려 있었나. 들어오게. 바람이 차다.' },
    { who: 'muk', text: '나는 묵당이라 하네. 한때는 글을 썼지. 지금은 먹만 갈고 있어.' },
    { who: 'me', text: '안개가… 마을을 덮고 있어요.' },
    { who: 'muk', text: '알고 있네. 저 안개는 쓰지 않은 날들이야. 쓰지 않은 날은 없었던 날이 되지.' },
    { who: 'muk', text: '걷어 내는 방법은 하나뿐일세. 매일 쓰는 것. 하루 한 편이면 등불 하나가 켜지네.' },
    { who: 'muk', text: '자네, 내 문하에 들겠나? 대단한 재주는 필요 없네. 내일도 오기만 하면 돼.' },
  ],
  epilogue: [
    { who: 'narr', text: '겨울 끝, 서재의 창으로 첫 햇빛이 든다. 마을의 안개가 처음으로 완전히 걷혔다.' },
    { who: 'muk', text: '자네가 온 지 한 해가 지났군. 책 속의 손님들도 모두 돌아갔네.' },
    { who: 'muk', text: '…사실 나는 30년 동안 원고 한 장을 끝내지 못했네. 마지막 장(章)이 완벽하지 않을까 봐서.' },
    { who: 'muk', text: '백지귀는 내 안에서 나온 놈이었어. 그놈을 이긴 건 자네의 매일이었고.' },
    { who: 'muk', text: '그래서 오늘, 나도 다시 쓰기로 했네. 서툴러도.' },
    { who: 'muk', text: '자, 두 번째 해일세. 서고 깊은 곳에 닫힌 서가가 있네. 거기 손님들은 더 까다롭다네.' },
  ],
  acts: [
    {
      id: 'y1-a1', season: '봄', title: '등불을 켜는 법', mentor: 'yoon', theme: '매일 쓰기 · 습관',
      chapters: [
        {
          id: 'y1-a1-c1', title: '서재의 문', mentor: 'muk',
          scene: [
            { who: 'muk', text: '첫날이니 거창한 건 바라지 않네. 오늘 있었던 일 하나를 써 오게.' },
            { who: 'muk', text: '잘 쓰려고 하지 말고, 쓰기만 하게. 잘 쓰는 건 그 다음 문제야.' },
          ],
          reqs: [W(1, '첫 글 1편 쓰기')],
          lesson: '잘 쓰기 전에, 쓰기부터.',
        },
        {
          id: 'y1-a1-c2', title: '별을 세는 사람', mentor: 'yoon',
          scene: [
            { who: 'narr', text: '서가에서 낡은 시집 한 권이 떨어진다. 책장이 넘어가더니, 교복 차림의 청년이 걸어 나온다.' },
            { who: 'yoon', text: '안녕하세요. 윤동주라고 합니다. 묵당 선생님이 부르셔서요.' },
            { who: 'muk', text: '이 친구는 스물일곱 해를 살았네. 그 짧은 동안에 남긴 시가 지금도 읽히지.' },
            { who: 'yoon', text: '저는 대단한 걸 쓰지 않았어요. 매일 저 자신을 들여다보고, 부끄러운 건 부끄럽다고 적었을 뿐이에요.' },
            { who: 'yoon', text: '사흘만 이어서 써 볼까요? 사흘이 지나면 등불이 꺼지지 않는 법을 알게 될 거예요.' },
          ],
          reqs: [S(3), W(3)],
          lesson: '하루를 정직하게 들여다보는 것이 첫 문장이 된다.',
        },
        {
          id: 'y1-a1-c3', title: '서고의 먼지', mentor: 'yoon',
          scene: [
            { who: 'yoon', text: '쓰는 사람은 먼저 읽는 사람이에요. 저도 구하기 힘든 시집을 빌려 한 자 한 자 손으로 베껴 적었어요.' },
            { who: 'yoon', text: '읽고 있는 책을 서고에 올려 두고, 마음에 걸린 문장을 메모해 보세요.' },
            { who: 'muk', text: '남의 문장을 손으로 옮겨 보면 그 사람의 호흡이 들리지.' },
          ],
          reqs: [BN(2), SEN(2), D(5)],
          lesson: '읽은 것만큼 쓸 수 있다.',
        },
        {
          id: 'y1-a1-c4', title: '시련 · 미루기 도깨비', mentor: 'yoon',
          scene: [
            { who: 'narr', text: '서재 마루 밑에서 키득거리는 소리가 난다. 털북숭이 도깨비가 고개를 내민다.' },
            { who: 'naeili', text: '오늘은 피곤하잖아? 내일 쓰면 되지. 내일, 내일, 내일!' },
            { who: 'yoon', text: '저 녀석은 "내일"을 먹고 자라요. 오늘 한 편을 끝까지 쓰면 힘을 잃어요.' },
          ],
          reqs: [D(7)],
          lesson: '"내일"은 쓰지 않을 핑계의 다른 이름이다.',
          trial: {
            boss: 'naeili', title: '미루기 도깨비 내일이', type: '감상문',
            prompt: '오늘 미루고 싶었던 일 하나와, 그래도 해낸(혹은 해내지 못한) 이유',
            minChars: 300, scoreMin: 40,
            rule: '300자 이상, 종합 40점 이상이면 격파',
            taunt: ['내일 써도 되잖아~', '한 줄만 쓰고 자자~', '완벽하게 쓸 수 있을 때 쓰자~'],
            lose: '키득키득… 거봐, 내일 다시 오라고~',
            win: [
              { who: 'naeili', text: '끄으… 오늘을 써 버리면… 내가 먹을 내일이 없잖아…' },
              { who: 'yoon', text: '봄이 다 갔네요. 이제 당신은 내일을 기다리지 않고 오늘 쓰는 사람이에요.' },
              { who: 'yoon', text: '저는 책으로 돌아갈게요. 별 하나에 시를, 잊지 마세요.' },
            ],
          },
        },
      ],
    },
    {
      id: 'y1-a2', season: '여름', title: '깨진 병 조각의 빛', mentor: 'chekhov', theme: '관찰 · 보여주기',
      chapters: [
        {
          id: 'y1-a2-c1', title: '의사의 눈', mentor: 'chekhov',
          scene: [
            { who: 'narr', text: '한여름 밤, 서재에 안경 쓴 수염의 신사가 앉아 차를 마시고 있다.' },
            { who: 'chekhov', text: '체호프요. 나는 의사였소. 환자를 볼 때처럼 세상을 보시오. 진단보다 증상을 먼저.' },
            { who: 'chekhov', text: '"슬펐다"라고 쓰는 건 진단이오. 독자는 증상을 보고 싶어 하지.' },
            { who: 'muk', text: '수련터에 관찰 훈련이 있네. 보이는 사실만 적는 연습이지.' },
          ],
          reqs: [DR(2), W(2)],
          lesson: '감정을 이름 붙이지 말고, 증상을 보여 줘라.',
        },
        {
          id: 'y1-a2-c2', title: '둑 위의 반짝임', mentor: 'chekhov',
          scene: [
            { who: 'chekhov', text: '형에게 편지로 이런 얘기를 한 적이 있소. 달밤을 쓰려거든 "달이 밝았다"고 하지 말고, 방앗간 둑 위에서 반짝이는 깨진 병 조각을 보여 주라고.' },
            { who: 'chekhov', text: '작은 것 하나가 장면 전체를 데려오는 법이오. 묘사문을 써 보시오. 오감 중 시각 말고 하나는 꼭 넣어서.' },
          ],
          reqs: [TY('묘사문', 2), SEN(5)],
          lesson: '작은 구체 하나가 큰 추상 열 개보다 멀리 간다.',
        },
        {
          id: 'y1-a2-c3', title: '장터의 목소리', mentor: 'chekhov',
          scene: [
            { who: 'chekhov', text: '시장에 가 보시오. 사람들이 어떤 말을 하는지, 어떤 간판이 사람을 붙잡는지.' },
            { who: 'muk', text: '좋은 카피는 짧은 관찰이야. 장터에서 눈에 걸린 문구를 모아 오게.' },
          ],
          reqs: [CPY(3), EXP(3), D(20)],
          lesson: '사람들이 실제로 쓰는 말 속에 살아 있는 문장이 있다.',
        },
        {
          id: 'y1-a2-c4', title: '시련 · 추상 안개 두루뭉', mentor: 'chekhov',
          scene: [
            { who: 'narr', text: '장터 골목에 뿌연 덩어리가 굴러다닌다. 닿는 것마다 윤곽이 사라진다.' },
            { who: 'durumung', text: '아름다웠다… 행복했다… 뭔가 특별했다… 다 비슷하잖아…' },
            { who: 'chekhov', text: '저놈은 "아름답다", "특별하다" 같은 말을 먹고 크오. 구체적인 사물 하나로 찔러야 하오.' },
          ],
          reqs: [D(25)],
          lesson: '추상어 하나를 지울 때마다 장면이 하나 생긴다.',
          trial: {
            boss: 'durumung', title: '추상 안개 두루뭉', type: '묘사문',
            prompt: '최근에 머문 장소 한 곳 — "아름답다/좋았다/특별했다" 없이 그곳을 보여 주기',
            minChars: 400, dim: '구체성', dimMin: 6,
            rule: '400자 이상, 구체성 6점 이상이면 격파',
            taunt: ['그냥 "좋았다"고 써~', '다들 비슷하게 느꼈을 거야~', '뭉뚱그리면 편하잖아~'],
            lose: '뭉게뭉게… 아직 잘 안 보이는걸?',
            win: [
              { who: 'durumung', text: '윤곽이… 너무 선명해… 숨을 데가 없어…' },
              { who: 'chekhov', text: '훌륭하오. 이제 당신 글에서는 독자가 냄새를 맡을 수 있소.' },
              { who: 'chekhov', text: '나는 벚꽃 동산으로 돌아가겠소. 진단은 독자에게 맡기시오.' },
            ],
          },
        },
      ],
    },
    {
      id: 'y1-a3', season: '가을', title: '물 아래의 빙산', mentor: 'hemingway', theme: '퇴고 · 간결함',
      chapters: [
        {
          id: 'y1-a3-c1', title: '서서 쓰는 사내', mentor: 'hemingway',
          scene: [
            { who: 'narr', text: '서재 한구석, 덩치 큰 사내가 선반에 원고를 올려 두고 서서 연필을 깎는다.' },
            { who: 'hemingway', text: '헤밍웨이다. 빙산이 위엄 있게 움직이는 건 8분의 1만 물 위에 있기 때문이지. 나는 그렇게 썼다.' },
            { who: 'hemingway', text: '네가 아는 걸 다 쓰지 마. 알고 나서 빼. 빠진 자리를 독자가 느낀다.' },
            { who: 'muk', text: '붉은 펜(첨삭)을 받아 보게. 무엇이 빠져도 되는지 보일 걸세.' },
          ],
          reqs: [PR(2), W(3)],
          lesson: '아는 것을 다 쓰지 말고, 알고 나서 빼라.',
        },
        {
          id: 'y1-a3-c2', title: '서른아홉 번의 결말', mentor: 'hemingway',
          scene: [
            { who: 'hemingway', text: '『무기여 잘 있거라』의 마지막 장은 수십 번 고쳐 썼다. 문제가 뭐였냐고? 맞는 단어를 찾는 것.' },
            { who: 'hemingway', text: '한 줄 통찰 훈련을 해. 한 줄에 다 담지 못하면, 아직 뭘 말하려는지 모르는 거다.' },
          ],
          reqs: [DR(3), MS(1)],
          lesson: '고쳐 쓰기는 실패가 아니라 글쓰기의 본체다.',
        },
        {
          id: 'y1-a3-c3', title: '사전각의 열쇠', mentor: 'hemingway',
          scene: [
            { who: 'muk', text: '간결함은 가난한 어휘가 아닐세. 고를 수 있는 단어가 많아야 하나를 고르지.' },
            { who: 'hemingway', text: '사전각에 가서 단어를 모아 와. 그리고 버릴 줄도 알아야 해.' },
          ],
          reqs: [EXP(6), BN(5), D(45)],
          lesson: '많이 알아야 적게 쓸 수 있다.',
        },
        {
          id: 'y1-a3-c4', title: '시련 · 군더더기 뱀 늘어지', mentor: 'hemingway',
          scene: [
            { who: 'narr', text: '서고 바닥을 긴 뱀이 기어간다. 몸통에 "그리고", "또한", "~것 같다"가 비늘처럼 붙어 있다.' },
            { who: 'neureoji', text: '그리고… 또한… 어떻게 보면… 사실은… 그러니까 말하자면…' },
            { who: 'hemingway', text: '꼬리를 잘라. 600자 안에서 끝내. 짧은 문장이 무기다.' },
          ],
          reqs: [D(55)],
          lesson: '문장이 짧아지면 생각이 선명해진다.',
          trial: {
            boss: 'neureoji', title: '군더더기 뱀 늘어지', type: '에세이',
            prompt: '올가을 버린 것 하나 (물건이든 습관이든)',
            minChars: 250, maxChars: 600, dim: '가독성', dimMin: 6,
            rule: '250~600자, 가독성 6점 이상이면 격파',
            taunt: ['조금만 더 설명하자~', '혹시 모르니 한 번 더 말하자~', '"것 같다"를 붙이면 안전해~'],
            lose: '스르륵… 아직 꼬리가 길어~',
            win: [
              { who: 'neureoji', text: '꼬리가… 없…' },
              { who: 'hemingway', text: '좋아. 깨끗하다. 이제 물 아래에 뭐가 있는지, 독자가 궁금해할 거다.' },
              { who: 'hemingway', text: '난 바다로 간다. 한 문장이라도 진실하게 써.' },
            ],
          },
        },
      ],
    },
    {
      id: 'y1-a4', season: '겨울', title: '자기만의 방', mentor: 'woolf', theme: '나의 목소리',
      chapters: [
        {
          id: 'y1-a4-c1', title: '방 한 칸과 시간', mentor: 'woolf',
          scene: [
            { who: 'narr', text: '눈 내리는 밤, 창가에 긴 얼굴의 여인이 서 있다. 손에는 얇은 에세이집.' },
            { who: 'woolf', text: '버지니아 울프예요. 『자기만의 방』에서 나는 글을 쓰려면 돈과 자기만의 방이 필요하다고 했죠.' },
            { who: 'woolf', text: '오늘 당신의 방은 어디인가요? 매일 같은 시간, 같은 자리. 그게 당신의 방이에요.' },
          ],
          reqs: [S(7), TY('에세이', 1)],
          lesson: '글은 정해진 시간과 자리에서 자란다.',
        },
        {
          id: 'y1-a4-c2', title: '의식의 흐름', mentor: 'woolf',
          scene: [
            { who: 'woolf', text: '마음은 하루에도 수천 가지 인상을 받아요. 그 흐름을 따라가 보세요.' },
            { who: 'woolf', text: '남이 좋다고 한 문장 말고, 당신 마음에 남은 문장을 모아요. 그게 당신 취향의 지도예요.' },
          ],
          reqs: [SEN(12), C(2, 800)],
          lesson: '취향은 모은 문장들의 지도다.',
        },
        {
          id: 'y1-a4-c3', title: '끝까지 읽은 책', mentor: 'woolf',
          scene: [
            { who: 'woolf', text: '책을 한 권 끝까지 읽는 건, 다른 사람의 방에 끝까지 머무는 일이에요.' },
            { who: 'muk', text: '이 겨울엔 한 권을 끝내게. 그리고 그 책에 답장을 쓰듯 감상문을.' },
          ],
          reqs: [BD(1), TY('감상문', 1), D(80)],
          lesson: '끝까지 머문 사람만 답장을 쓸 수 있다.',
        },
        {
          id: 'y1-a4-c4', title: '최종 시련 · 백지귀', mentor: 'muk',
          scene: [
            { who: 'narr', text: '서재의 불이 꺼진다. 묵당 선생의 책상 위, 30년 묵은 원고 더미에서 하얀 형체가 일어난다.' },
            { who: 'baekjigwi', text: '완벽하지 않으면 쓰지 마라. 부끄러운 글을 남길 바엔 아무것도 남기지 마라.' },
            { who: 'muk', text: '…저놈이 내 펜을 30년 동안 붙잡고 있었네.' },
            { who: 'woolf', text: '완벽한 글로는 못 이겨요. 당신다운 글로 이겨야 해요.' },
          ],
          reqs: [D(90)],
          lesson: '완벽한 글은 없다. 끝낸 글이 있을 뿐.',
          trial: {
            boss: 'baekjigwi', title: '백지귀', type: '에세이',
            prompt: '내가 글을 쓰는 이유 — 혹은 쓰지 못했던 이유',
            minChars: 800, scoreMin: 58,
            rule: '800자 이상, 종합 58점 이상이면 격파',
            taunt: ['그 문장, 부끄럽지 않나?', '누가 이걸 읽겠어?', '조금 더 준비되면 써.'],
            lose: '…거봐. 아직 완벽하지 않잖아.',
            win: [
              { who: 'baekjigwi', text: '불완전한데… 왜… 지워지지 않는 거지…' },
              { who: 'woolf', text: '끝냈으니까요. 끝낸 글은 지워지지 않아요.' },
              { who: 'muk', text: '……고맙네. 정말로.' },
            ],
          },
        },
      ],
    },
  ],
};

/* ═══════════════════ 둘째 해 — 「닫힌 서가」 ═══════════════════ */
const YEAR2: Year = {
  n: 2,
  title: '둘째 해 · 닫힌 서가',
  prologue: [
    { who: 'narr', text: '봄. 묵당 선생은 다시 먹을 갈고 있다. 이번엔 자기 원고를 위해서.' },
    { who: 'muk', text: '닫힌 서가의 자물쇠가 풀렸네. 여기 손님들은 자네를 시험하러 올 걸세.' },
    { who: 'muk', text: '첫해엔 쓰는 사람이 되었지. 올해는 잘 쓰는 사람이 될 차례야.' },
    { who: 'narr', text: '그리고 마을 너머, 지워진 땅에서 더 큰 안개가 몰려오고 있었다.' },
  ],
  epilogue: [
    { who: 'muk', text: '내 원고가 끝났네. 마지막 장은 자네와의 두 해에 관한 이야기야.' },
    { who: 'muk', text: '이제 자네도 누군가에게 문을 열어 줄 수 있는 사람이 되었네.' },
    { who: 'muk', text: '그래도 쓰는 일엔 졸업이 없지. 내일도 오게. 손님들이 더 깊은 숙제를 들고 다시 올 걸세.' },
    { who: 'narr', text: '— 이후로는 「심화의 해」가 이어집니다. 같은 스승을 다시 만나지만, 요구는 더 높아집니다.' },
  ],
  acts: [
    {
      id: 'y2-a1', season: '봄', title: '옛것에서 새것을', mentor: 'yeonam', theme: '표현 · 법고창신',
      chapters: [
        {
          id: 'y2-a1-c1', title: '열하로 가는 길', mentor: 'yeonam',
          scene: [
            { who: 'narr', text: '닫힌 서가가 열리자 갓을 쓴 선비가 붓을 들고 나온다.' },
            { who: 'yeonam', text: '연암이라 하오. 청나라 열하까지 다녀오며 본 것을 『열하일기』에 적었지.' },
            { who: 'yeonam', text: '나는 옛것을 본받되 새롭게 만들라 했소. 법고창신이라. 남의 좋은 문장을 모으되, 그대로 쓰지는 마시오.' },
          ],
          reqs: [SEN(8), EXP(5)],
          lesson: '옛것을 본받되, 그대로 베끼지 마라.',
        },
        {
          id: 'y2-a1-c2', title: '장터의 글', mentor: 'yeonam',
          scene: [
            { who: 'yeonam', text: '나는 양반의 글만 글이라 여기지 않았소. 장사꾼의 말에도 문장이 있지.' },
            { who: 'yeonam', text: '카피를 모아 보시오. 그리고 직접 한 편 지어 보시오.' },
          ],
          reqs: [CPY(6), TY('카피라이팅', 2)],
          lesson: '사람을 움직이는 말은 어디에나 있다.',
        },
        {
          id: 'y2-a1-c3', title: '일기는 기록이다', mentor: 'yeonam',
          scene: [
            { who: 'yeonam', text: '여행길에선 매일 적었소. 날씨, 길, 사람, 술맛까지.' },
            { who: 'muk', text: '열흘을 끊지 말고 써 보게.' },
          ],
          reqs: [S(10), D(15)],
          lesson: '기록하는 자의 여행만 남는다.',
        },
        {
          id: 'y2-a1-c4', title: '시련 · 상투 앵무 뻔한말', mentor: 'yeonam',
          scene: [
            { who: 'ppeonhan', text: '눈부신 햇살! 소중한 추억! 잊지 못할 하루! 깍깍!' },
            { who: 'yeonam', text: '남의 말을 흉내만 내는 새요. 당신만의 표현으로 말해야 쫓을 수 있소.' },
          ],
          reqs: [D(20)],
          lesson: '누구나 쓰는 말은 아무도 기억하지 않는다.',
          trial: {
            boss: 'ppeonhan', title: '상투 앵무 뻔한말', type: '묘사문',
            prompt: '봄을 "따스한 햇살/벚꽃 엔딩/설렘" 없이 쓰기',
            minChars: 400, dim: '표현력', dimMin: 6,
            rule: '400자 이상, 표현력 6점 이상이면 격파',
            taunt: ['눈부신 햇살! 깍!', '소중한 추억! 깍!', '행복한 하루! 깍깍!'],
            lose: '깍깍! 그 말 어디서 들어 봤는데~',
            win: [
              { who: 'ppeonhan', text: '깍…? 그 말은… 흉내 낼 수가 없어…' },
              { who: 'yeonam', text: '허허, 이제야 당신의 목소리가 들리는구려.' },
            ],
          },
        },
      ],
    },
    {
      id: 'y2-a2', season: '여름', title: '봄봄의 입말', mentor: 'kimyujeong', theme: '대화 · 이야기',
      chapters: [
        {
          id: 'y2-a2-c1', title: '점순이네 울타리', mentor: 'kimyujeong',
          scene: [
            { who: 'kimyujeong', text: '김유정이오. 나는 강원도 산골 사람들이 실제로 하는 말 그대로 소설을 썼소.' },
            { who: 'kimyujeong', text: '「봄봄」의 그 데릴사위 녀석, 말투만 들어도 어떤 놈인지 알잖소? 인물은 입으로 보여 주는 거요.' },
          ],
          reqs: [TY('스토리텔링', 2), W(4)],
          lesson: '인물은 설명이 아니라 말투로 살아난다.',
        },
        {
          id: 'y2-a2-c2', title: '웃음 속의 슬픔', mentor: 'kimyujeong',
          scene: [
            { who: 'kimyujeong', text: '가난한 이야기도 웃기게 쓸 수 있소. 웃다 보면 아픈 게 더 잘 보이거든.' },
            { who: 'muk', text: '훈련 과제를 받아서 해 보게. 다른 결의 글을 써 볼 때야.' },
          ],
          reqs: [MS(2), DR(3)],
          lesson: '해학은 슬픔을 더 멀리 실어 나른다.',
        },
        {
          id: 'y2-a2-c3', title: '이야기꾼의 서고', mentor: 'kimyujeong',
          scene: [
            { who: 'kimyujeong', text: '이야기를 많이 들은 놈이 이야기를 잘 하오. 소설 한 권 끝까지 읽어 보시오.' },
          ],
          reqs: [BD(1), BN(6), D(35)],
          lesson: '많이 들은 사람이 잘 말한다.',
        },
        {
          id: 'y2-a2-c4', title: '시련 · 흐릿이', mentor: 'kimyujeong',
          scene: [
            { who: 'heurisi', text: '그래서… 무슨 얘기였더라… 누가 뭘 했다고…?' },
            { who: 'kimyujeong', text: '이야기가 흐릿하면 저놈이 붙소. 누가, 뭘, 왜 했는지 또렷하게!' },
          ],
          reqs: [D(45)],
          lesson: '독자가 따라오지 못하면 아무리 고와도 소용없다.',
          trial: {
            boss: 'heurisi', title: '흐릿이', type: '스토리텔링',
            prompt: '대사가 세 번 이상 오가는 짧은 이야기 — 둘 중 하나가 거짓말을 하고 있다',
            minChars: 600, dim: '전달력', dimMin: 6,
            rule: '600자 이상, 전달력 6점 이상이면 격파',
            taunt: ['그래서 누가 말한 거야?', '무슨 일이 있었던 거지?', '음… 졸려…'],
            lose: '흐릿… 아직 잘 모르겠는데…',
            win: [
              { who: 'heurisi', text: '아… 다 보여… 눈부셔…' },
              { who: 'kimyujeong', text: '허허, 이제 동네 사람들이 당신 얘기 들으러 모이겠소.' },
            ],
          },
        },
      ],
    },
    {
      id: 'y2-a3', season: '가을', title: '유리창 같은 문장', mentor: 'orwell', theme: '명료함 · 논리',
      chapters: [
        {
          id: 'y2-a3-c1', title: '정치와 언어', mentor: 'orwell',
          scene: [
            { who: 'orwell', text: '오웰이오. 「정치와 영어」라는 글에서 나는 흐린 글이 흐린 생각을 숨긴다고 했소.' },
            { who: 'orwell', text: '짧은 단어로 될 걸 긴 단어로 쓰지 말고, 뺄 수 있는 단어는 빼시오. 그리고 주장을 하려면 근거를.' },
          ],
          reqs: [TY('의견문', 2), PR(2)],
          lesson: '흐린 글은 흐린 생각을 숨긴다.',
        },
        {
          id: 'y2-a3-c2', title: '설명하는 사람', mentor: 'orwell',
          scene: [
            { who: 'orwell', text: '모르는 사람에게 설명해 보시오. 그게 당신이 아는지 확인하는 가장 빠른 방법이오.' },
          ],
          reqs: [TY('설명문', 2), EXP(6)],
          lesson: '설명할 수 있어야 안다고 할 수 있다.',
        },
        {
          id: 'y2-a3-c3', title: '기록의 의무', mentor: 'orwell',
          scene: [
            { who: 'orwell', text: '나는 탄광촌에 가서 보고 들은 대로 썼소. 사실은 기록되지 않으면 지워지오. 저 안개처럼.' },
          ],
          reqs: [TY('기사 리드', 1), C(3, 800), D(60)],
          lesson: '기록되지 않은 사실은 지워진다.',
        },
        {
          id: 'y2-a3-c4', title: '시련 · 꼬인 실타래 엇박이', mentor: 'orwell',
          scene: [
            { who: 'eotbagi', text: '그러므로 반대로… 왜냐하면 그런데… 결론적으로 아무튼…' },
            { who: 'orwell', text: '주장 하나, 근거 둘, 반론 하나. 실을 한 가닥씩 풀어 보시오.' },
          ],
          reqs: [D(70)],
          lesson: '주장 하나, 근거 둘, 반론 하나.',
          trial: {
            boss: 'eotbagi', title: '꼬인 실타래 엇박이', type: '의견문',
            prompt: '"매일 쓰는 것"은 정말 실력을 늘리는가 — 찬반 중 하나를 골라 논증하기',
            minChars: 600, dim: '논리성', dimMin: 6,
            rule: '600자 이상, 논리성 6점 이상이면 격파',
            taunt: ['그러니까 아무튼~', '왜냐하면 그냥~', '결론은 나중에~'],
            lose: '엉킨다 엉킨다~',
            win: [
              { who: 'eotbagi', text: '풀렸… 다…' },
              { who: 'orwell', text: '유리창 같은 문장이오. 생각이 그대로 비치는.' },
            ],
          },
        },
      ],
    },
    {
      id: 'y2-a4', season: '겨울', title: '날개', mentor: 'yisang', theme: '형식 실험 · 자기 문체',
      chapters: [
        {
          id: 'y2-a4-c1', title: '박제가 되어 버린 천재', mentor: 'yisang',
          scene: [
            { who: 'yisang', text: '이상이오. 나는 띄어쓰기도, 숫자도, 시의 모양도 마음대로 바꿔 보았소.' },
            { who: 'yisang', text: '규칙을 다 익혔으면, 이제 한 번 비틀어 보시오. 당신만 쓸 수 있는 모양으로.' },
          ],
          reqs: [TY('에세이', 2), DR(3)],
          lesson: '규칙을 익힌 자만 규칙을 비틀 수 있다.',
        },
        {
          id: 'y2-a4-c2', title: '거울', mentor: 'yisang',
          scene: [
            { who: 'yisang', text: '거울 속의 나는 왼손잡이요. 내 글을 거꾸로 보면 무엇이 보이오?' },
            { who: 'muk', text: '지난 글들을 다시 꺼내 첨삭을 받아 보게. 한 해 전의 자네가 보일 걸세.' },
          ],
          reqs: [PR(3), SEN(10)],
          lesson: '지난 글은 거울이다.',
        },
        {
          id: 'y2-a4-c3', title: '스물네 개의 계절', mentor: 'yisang',
          scene: [
            { who: 'muk', text: '두 해 동안 자네가 쓴 글이 내 원고보다 두껍네.' },
            { who: 'yisang', text: '날자. 한 번만 더 날자꾸나. — 내 소설의 마지막 줄이오. 당신도 한 번만 더.' },
          ],
          reqs: [BD(2), C(3, 1000), D(85)],
          lesson: '한 번만 더 쓰는 사람이 끝내 쓴다.',
        },
        {
          id: 'y2-a4-c4', title: '최종 시련 · 백지왕', mentor: 'muk',
          scene: [
            { who: 'narr', text: '지워진 땅의 안개가 하나로 뭉친다. 왕관을 쓴 거대한 백지.' },
            { who: 'baekjiwang', text: '세상엔 이미 글이 넘친다. 네 글 하나가 무슨 의미가 있지?' },
            { who: 'muk', text: '의미는 쓰고 나서 생기는 걸세. 가게.' },
          ],
          reqs: [D(95)],
          lesson: '의미는 쓰고 난 뒤에 생긴다.',
          trial: {
            boss: 'baekjiwang', title: '백지왕', type: '에세이',
            prompt: '두 해 동안 달라진 나 — 처음 이 서재에 왔던 날의 나에게',
            minChars: 1000, scoreMin: 62,
            rule: '1000자 이상, 종합 62점 이상이면 격파',
            taunt: ['넘치는 글 중 하나일 뿐.', '누가 기억하겠어?', '이미 누군가 썼을 이야기다.'],
            lose: '…세상은 여전히 하얗다.',
            win: [
              { who: 'baekjiwang', text: '하나의… 글이… 이렇게 무거울 수가…' },
              { who: 'muk', text: '봤나. 자네 글 하나가 왕을 쓰러뜨렸네.' },
            ],
          },
        },
      ],
    },
  ],
};

export const YEARS: Year[] = [YEAR1, YEAR2];

/** n번째 해의 정의. 3년차 이상은 첫해/둘째 해를 번갈아 '심화'로 재사용한다. */
export function getYear(n: number): Year {
  return n % 2 === 1 ? YEAR1 : YEAR2;
}
export function yearTitle(n: number): string {
  if (n <= 2) return getYear(n).title;
  return `${n}번째 해 · 심화 (${getYear(n).title.split(' · ')[1]})`;
}
/** 심화 배율 — 요구량은 해마다 25%씩. 시련 기준은 3년차부터 항목 +1, 종합은 해마다 +2(최대 +8).
 *  채점이 엄격하다(5점=평균, 6점=평균 이상, 7점=드묾, 8점↑=출판 수준; 실측으로 괜찮은 수필이 40점대).
 *  그래서 첫 두 해의 기준은 항목 6 / 종합 40~62, 심화도 항목 7을 넘기지 않는다. */
export function reqScale(year: number): number { return year <= 2 ? 1 : 1 + (year - 2) * 0.25; }
export function trialBoost(year: number): { dim: number; score: number } {
  return year <= 2 ? { dim: 0, score: 0 } : { dim: 1, score: Math.min(8, (year - 2) * 2) };
}

/** 장 id 목록(해 내부 순서) */
export function chaptersOf(year: number): Chapter[] {
  return getYear(year).acts.flatMap(a => a.chapters);
}
export function actOf(year: number, chapterId: string): Act | undefined {
  return getYear(year).acts.find(a => a.chapters.some(c => c.id === chapterId));
}
export function findChapter(year: number, chapterId: string): Chapter | undefined {
  return chaptersOf(year).find(c => c.id === chapterId);
}
