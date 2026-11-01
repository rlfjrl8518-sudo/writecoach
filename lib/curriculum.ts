/* ═══════════════════════════════════════════════════════════════
   『백지첩』 24수 — 글습관의 단 하나의 학습 축
   ───────────────────────────────────────────────────────────────
   컨셉
   - 노작가 묵당(墨堂, 가상 인물)은 평생 모은 문장 기법 24가지를 『백지첩』에 적었다.
     30년 전 펜을 놓자 책장이 하얗게 지워졌고, 그날부터 마을에 '백지 안개'가 내렸다.
   - 제자는 하루 한 수씩 배운다. 한 수를 익히면 백지첩 한 장이 되살아난다.
   - 장(章)마다 AI 채점 항목 하나를 집중해서 기른다. 장의 끝에서 그 약점이 요괴로
     나타나고(시련), 그 항목 점수로 판정한다.
   - 24수를 마치면 '심화 회차' — 같은 24수를 더 높은 기준으로 다시 돈다.
   하루의 수련 = ① 가르침 → ② 워밍업(고쳐 쓰기) → ③ 사진 훈련 → ④ 짧은 글.
═══════════════════════════════════════════════════════════════ */

export type Dim = '표현력' | '전달력' | '구체성' | '논리성' | '가독성';
export type BossId = 'durumung' | 'ppeonhan' | 'heurisi' | 'neureoji' | 'eotbagi' | 'baekjigwi';
export type SpeakerId = 'narr' | 'me' | 'muk' | BossId;
export interface Line { who: SpeakerId; text: string }

export const SPEAKER_NAME: Record<SpeakerId, string> = {
  narr: '', me: '나', muk: '묵당 선생',
  durumung: '추상 안개 두루뭉', ppeonhan: '상투 앵무 뻔한말', heurisi: '흐릿이',
  neureoji: '군더더기 뱀 늘어지', eotbagi: '꼬인 실타래 엇박이', baekjigwi: '백지귀(白紙鬼)',
};
export const isBoss = (id: SpeakerId) => !['narr', 'me', 'muk'].includes(id);

/** 사진 훈련 채점 방식 — lib/openai.ts evaluateDrill에 넘기는 이름과 목적 */
export interface Drill {
  name: string;
  purpose: string;
  instruction: string;
  /** 사진 없이 문장을 고쳐 쓰는 훈련이면 scene에 원문 */
  scene?: string;
  /** 이미지 생성 지시(영어) — 이 훈련에 필요한 요소가 반드시 보이도록 */
  image?: string;
  constraints?: string[];
}

export interface Su {
  n: number;              // 1~24
  title: string;
  /** 묵당의 가르침 — 기법을 구체적으로 */
  teach: string[];
  /** 예시: 고치기 전 → 고친 뒤 */
  example: { before: string; after: string };
  /** 워밍업: 고쳐 쓸 문장들 (하나를 골라 준다) */
  warmup: { task: string; items: string[] };
  drill: Drill;
  /** 짧은 글 — 오늘의 수를 적용 */
  write: { prompt: string; type: string; min: number; check: string };
}

export interface Chapter {
  n: number;              // 1~6
  title: string;
  dim: Dim | '종합';
  intro: Line[];
  sus: Su[];
  boss: {
    id: BossId;
    prompt: string;
    type: string;
    minChars: number;
    maxChars?: number;
    /** 1회차 기준 — 항목 6점(5=평균, 7=드묾) 또는 종합 점수. 회차마다 오른다(lib/game.ts) */
    dimMin?: number;
    scoreMin?: number;
    taunt: string[];
    lose: string;
    win: Line[];
  };
}

/* 공통 이미지 지시 — 생성기는 한글을 깨뜨리므로 글자는 금지 */
export const IMAGE_STYLE = 'Photorealistic documentary photograph, natural light, set in contemporary South Korea, 16:9 landscape. No visible text, letters, signs with writing, logos or watermarks. Not staged, not stock-photo smiling.';

export const CHAPTERS: Chapter[] = [
  /* ─────────────── 1장 보는 눈 (구체성) ─────────────── */
  {
    n: 1, title: '보는 눈', dim: '구체성',
    intro: [
      { who: 'muk', text: '백지첩 첫 장은 "보는 눈"일세. 잘 쓰는 사람은 먼저 잘 보는 사람이야.' },
      { who: 'muk', text: '"아름답다", "평화롭다" 같은 말은 본 게 아니라 느낀 걸세. 이번 장에선 본 것만 쓰는 법을 익히네.' },
    ],
    sus: [
      {
        n: 1, title: '사실과 해석 가르기',
        teach: ['눈에 보이는 것(사실)과 내 머릿속의 판단(해석)을 갈라 보게.', '"피곤해 보였다"는 해석, "눈 밑이 거뭇하고 하품을 두 번 했다"는 사실일세.', '사실을 쌓으면 해석은 독자가 알아서 하네.'],
        example: { before: '카페는 분위기가 좋았다.', after: '창가 자리마다 노트북이 열려 있었고, 커피 머신이 3분마다 우유를 데웠다.' },
        warmup: { task: '해석을 지우고, 그렇게 판단하게 만든 사실로 바꿔 쓰게.', items: ['그는 화가 나 보였다.', '거리는 활기찼다.', '방이 지저분했다.', '아이는 신이 났다.'] },
        drill: { name: '관찰 훈련', purpose: '사실과 해석을 구분하는 능력', instruction: '사진을 보고 보이는 사실만 5개 쓰게. 해석·감정·추측은 금지.', constraints: ['보인다', '것 같다', '해 보인다', '느껴진다', '아름답', '평화롭'], image: 'A busy everyday scene dense with concrete, countable, observable details: several people from behind or at a distance doing different things, objects on tables, weather cues, shadows. A corner of a traditional market or a neighborhood street.' },
        write: { prompt: '오늘 지나친 장소 한 곳을, 판단하는 말 없이 사실 5가지로', type: '묘사문', min: 150, check: '해석어(좋았다·멋졌다·~해 보였다) 없이 사실로만 썼는가' },
      },
      {
        n: 2, title: '숫자와 이름',
        teach: ['"많은 사람", "오래된 건물"은 흐릿하네.', '숫자를 세고 이름을 불러 주게. "열두 명", "1974년에 지은 연립".', '이름 하나가 장면을 그 자리에 못 박네.'],
        example: { before: '많은 사람이 오래 기다렸다.', after: '마흔 명 남짓이 우산을 쓴 채 40분을 서 있었다.' },
        warmup: { task: '흐릿한 말을 숫자나 고유한 이름으로 바꿔 쓰게.', items: ['꽤 비싼 음식을 먹었다.', '오래된 책이 많았다.', '어떤 노래가 흘러나왔다.', '한참 걸었다.'] },
        drill: { name: '관찰 훈련', purpose: '수량과 이름으로 구체화하는 능력', instruction: '사진 속 장면을 3문장으로 쓰게. 문장마다 숫자나 구체적인 이름(사물·장소의 종류)을 하나 이상 넣게.', constraints: ['많은', '여러', '몇몇', '다양한'], image: 'A scene with clearly countable items and identifiable specific objects: a bakery display, bus stop with a few people, bicycles lined up, specific food items or tools.' },
        write: { prompt: '최근에 먹은 한 끼를 숫자와 이름으로', type: '묘사문', min: 150, check: '숫자·고유한 이름이 문장마다 있는가' },
      },
      {
        n: 3, title: '오감 중 둘',
        teach: ['우리는 눈으로만 쓰는 버릇이 있네.', '소리, 냄새, 촉감을 하나만 더해도 독자는 그 자리에 서 있게 되지.', '시각 말고 감각 둘을 넣는 연습일세.'],
        example: { before: '비 오는 골목을 걸었다.', after: '빗물이 홈통을 두드렸고, 젖은 시멘트 냄새가 신발 밑창까지 올라왔다.' },
        warmup: { task: '시각 말고 다른 감각 하나를 더해 고쳐 쓰게.', items: ['아침 지하철은 붐볐다.', '부엌에서 찌개가 끓었다.', '바닷가에 앉아 있었다.'] },
        drill: { name: '관찰 훈련', purpose: '시각 외 감각으로 장면을 살리는 능력', instruction: '사진 속 장소에 서 있다고 생각하고, 시각을 뺀 감각(소리·냄새·촉감·맛) 두 가지 이상으로 3-4문장을 쓰게.', image: 'A sensory-rich place where sounds, smells and textures are implied: a steaming street food stall at night, a rainy alley with puddles, a bakery kitchen, a laundromat.' },
        write: { prompt: '지금 내가 있는 곳을 소리와 냄새로', type: '묘사문', min: 150, check: '시각 외 감각이 둘 이상인가' },
      },
      {
        n: 4, title: '클로즈업',
        teach: ['풍경 전체를 쓰려 하지 말게. 카메라를 한 물건에 바짝 대게.', '닳은 모서리, 손때, 긁힌 자국 — 작은 디테일 하나가 사람의 시간을 말해 주네.'],
        example: { before: '할머니 방에는 오래된 물건이 많았다.', after: '자개장 손잡이 하나만 유난히 반들거렸다. 사십 년 동안 매일 아침 열린 칸이었다.' },
        warmup: { task: '전체 묘사를, 하나의 디테일에 바짝 다가간 문장으로 바꾸게.', items: ['아버지의 차는 낡았다.', '교실은 오래되었다.', '그녀의 방은 정리되어 있었다.'] },
        drill: { name: '관찰 훈련', purpose: '한 디테일로 이야기를 담는 능력', instruction: '사진에서 물건 하나만 골라, 그 물건의 닳은 흔적이나 세부를 2-3문장으로 클로즈업하게. 그 흔적이 말해 주는 시간을 마지막 문장에 담게.', image: 'A close-up still life of a well-used everyday object showing wear and history: worn leather work gloves, a chipped enamel mug, an old wooden cutting board, scuffed school shoes.' },
        write: { prompt: '내가 가장 오래 쓴 물건 하나를 클로즈업으로', type: '묘사문', min: 180, check: '전체가 아니라 한 디테일에 집중했는가' },
      },
    ],
    boss: {
      id: 'durumung', prompt: '최근에 머문 장소 한 곳 — "아름답다/좋았다/특별했다" 없이 보여 주기', type: '묘사문', minChars: 400, dimMin: 6,
      taunt: ['그냥 "좋았다"고 써~', '다들 비슷하게 느꼈을 거야~', '뭉뚱그리면 편하잖아~'],
      lose: '뭉게뭉게… 아직 잘 안 보이는걸?',
      win: [{ who: 'durumung', text: '윤곽이… 너무 선명해… 숨을 데가 없어…' }, { who: 'muk', text: '백지첩 첫 장이 돌아왔네. 이제 자네 글에선 독자가 냄새를 맡을 수 있어.' }],
    },
  },

  /* ─────────────── 2장 보여주기 (표현력) ─────────────── */
  {
    n: 2, title: '보여주기', dim: '표현력',
    intro: [
      { who: 'muk', text: '둘째 장은 "보여주기"일세. 감정을 이름으로 부르지 않고 장면으로 건네는 법이야.' },
      { who: 'muk', text: '"슬펐다"고 쓰면 독자는 고개만 끄덕이네. 식은 밥그릇을 보여 주면 독자가 슬퍼하지.' },
    ],
    sus: [
      {
        n: 5, title: '감정의 이름 지우기',
        teach: ['감정 단어(슬프다·기쁘다·불안하다)를 지우게.', '그 자리를, 그 감정일 때 눈에 띄는 장면으로 채우게.'],
        example: { before: '나는 너무 긴장됐다.', after: '면접실 문 앞에서 이력서 모서리를 세 번째로 접었다 폈다.' },
        warmup: { task: '감정 단어를 지우고 장면으로 보여 주게.', items: ['나는 몹시 외로웠다.', '그는 정말 행복했다.', '엄마는 걱정이 많았다.', '나는 화가 났다.'] },
        drill: { name: '보여주기 훈련', purpose: '감정을 직접 말하지 않고 장면으로 전달하는 능력', instruction: '사진 속 장면을 활용해 "외롭다/쓸쓸하다/혼자/고독" 없이 외로움이 느껴지도록 2-4문장으로 쓰게.', constraints: ['외롭다', '외로움', '쓸쓸하다', '혼자', '고독'], image: 'A scene that evokes loneliness purely through environment and composition, no visible faces or tears: a single lit window in a dark apartment block, one bowl and one spoon on a table, an empty playground swing at dusk.' },
        write: { prompt: '최근 크게 느낀 감정 하나 — 그 감정의 이름을 쓰지 말고', type: '감상문', min: 180, check: '감정 단어 없이 장면·행동으로 전했는가' },
      },
      {
        n: 6, title: '몸이 먼저 말한다',
        teach: ['사람의 마음은 몸이 먼저 드러내네. 손, 발끝, 목소리, 숨.', '감정을 행동 하나로 번역하게. "떨렸다" 대신 "컵을 두 손으로 쥐었다".'],
        example: { before: '그는 당황했다.', after: '그는 대답 대신 이미 닫힌 노트북을 다시 열었다.' },
        warmup: { task: '감정을 그 사람의 몸짓 하나로 번역하게.', items: ['아이는 부끄러웠다.', '그녀는 실망했다.', '친구는 미안해했다.'] },
        drill: { name: '보여주기 훈련', purpose: '행동과 몸짓으로 감정을 전하는 능력', instruction: '사진 속 인물(또는 인물이 있었을 법한 흔적)의 몸짓을 근거로, 감정 단어 없이 그 사람의 마음을 2-4문장으로 보여 주게.', constraints: ['슬프다', '기쁘다', '불안하다', '화나다', '긴장'], image: 'A person seen from behind or from the side, face not clearly visible, with expressive body language: hunched shoulders at a bus stop in rain, hands gripping a paper cup, someone pausing at a door with a hand on the handle.' },
        write: { prompt: '누군가를 기다렸던 순간 — 내 몸이 한 일로만', type: '스토리텔링', min: 180, check: '감정을 몸짓·행동으로 번역했는가' },
      },
      {
        n: 7, title: '사물에 기대기',
        teach: ['감정을 사물에 맡기게. 시든 화분, 두 개 놓인 칫솔, 꺼지지 않은 현관 센서등.', '사물은 거짓말을 안 하네. 그래서 독자가 믿지.'],
        example: { before: '이별 후 공허했다.', after: '칫솔꽂이에 칫솔이 하나만 남자 컵이 자꾸 기울었다.' },
        warmup: { task: '감정을 사물 하나에 맡겨 다시 쓰게.', items: ['이사 가는 날 섭섭했다.', '시험에 떨어져 우울했다.', '오랜만에 고향에 가니 그리웠다.'] },
        drill: { name: '보여주기 훈련', purpose: '사물로 감정을 대신 전하는 능력', instruction: '사진 속 사물 하나를 골라, 그 사물만으로 "그리움"이 느껴지도록 2-3문장을 쓰게.', constraints: ['그립다', '그리움', '보고싶다', '보고 싶다', '추억'], image: 'A quiet still life where objects suggest absence and longing: a pair of old slippers by a door, an unopened letter on a wooden desk, a faded family photo frame turned slightly, a coat still hanging on a hook.' },
        write: { prompt: '지금 곁에 없는 사람을, 그가 남긴 물건 하나로', type: '에세이', min: 200, check: '감정을 사물 하나가 대신 말하게 했는가' },
      },
      {
        n: 8, title: '비유 하나',
        teach: ['비유는 독자가 이미 아는 것으로 모르는 것을 보여 주는 다리일세.', '흔한 비유(별처럼 빛나는) 말고, 자네 생활에서 건진 비유 하나면 충분하네. 많이 쓰면 흐려져.'],
        example: { before: '월요일 아침은 힘들었다.', after: '월요일 아침은 충전기를 꽂아 두지 않은 휴대폰 같았다. 켜지긴 하는데 15%였다.' },
        warmup: { task: '상투적인 비유를, 생활에서 건진 새 비유로 바꾸게.', items: ['시간이 화살처럼 지나갔다.', '그녀의 눈은 별처럼 빛났다.', '마음이 얼음처럼 차가웠다.'] },
        drill: { name: '보여주기 훈련', purpose: '신선한 비유로 대상을 새롭게 보이게 하는 능력', instruction: '사진 속 대상 하나를 골라, 흔하지 않은 비유 하나로 2문장을 쓰게. "~처럼/~같이"가 들어간 문장은 하나만.', image: 'An ordinary but visually interesting subject that invites metaphor: tangled power lines over an alley, a stack of plastic chairs, a crowded escalator from above, steam rising from a manhole at dawn.' },
        write: { prompt: '요즘의 나를, 내 생활에서 건진 비유 하나로', type: '에세이', min: 200, check: '흔하지 않은 비유를 하나만 정확히 썼는가' },
      },
    ],
    boss: {
      id: 'ppeonhan', prompt: '봄(또는 지금 계절)을 "따스한 햇살/설렘/소중한 추억" 없이', type: '묘사문', minChars: 400, dimMin: 6,
      taunt: ['눈부신 햇살! 깍!', '소중한 추억! 깍!', '행복한 하루! 깍깍!'],
      lose: '깍깍! 그 말 어디서 들어 봤는데~',
      win: [{ who: 'ppeonhan', text: '깍…? 그 말은… 흉내 낼 수가 없어…' }, { who: 'muk', text: '둘째 장이 돌아왔군. 이제 자네 문장엔 자네 생활 냄새가 나.' }],
    },
  },

  /* ─────────────── 3장 동사의 힘 (전달력) ─────────────── */
  {
    n: 3, title: '동사의 힘', dim: '전달력',
    intro: [
      { who: 'muk', text: '셋째 장은 "동사"일세. 문장의 엔진은 형용사가 아니라 동사야.' },
      { who: 'muk', text: '누가 무엇을 했는지 동사가 또렷하면, 독자는 한 번에 알아듣네.' },
    ],
    sus: [
      {
        n: 9, title: '죽은 동사 묻기',
        teach: ['"이다·있다·하다·되다"는 아무 일도 안 하는 동사일세.', '"공원에 사람들이 있었다"를 "공원 벤치마다 사람들이 등을 기댔다"로. 동사가 일을 하게 하게.'],
        example: { before: '책상 위에 컵이 있었다.', after: '식은 컵이 책상 모서리에 아슬아슬하게 걸터앉았다.' },
        warmup: { task: '"있다/하다/되다"를 구체적인 동사로 바꾸게.', items: ['길에 낙엽이 많이 있었다.', '그는 운동을 했다.', '하늘이 어두워지게 되었다.', '창밖에 비가 있었다.'] },
        drill: { name: '동사의 힘 훈련', purpose: '구체적인 동사로 장면을 생생하게 만드는 능력', instruction: '사진 속 장면을 2-3문장으로 쓰게. "이다/있다/하다/되다"와 그 활용형은 금지 — 더 구체적인 동사로.', constraints: ['이다', '있다', '없다', '하다', '되다', '이었다', '있었다', '했다', '됐다'], image: 'A lively scene with many simultaneous actions to describe with verbs: a busy street market with people carrying, pouring, haggling; a construction site; a kitchen during dinner rush.' },
        write: { prompt: '오늘 아침 출근(등교) 길을 "있다/하다/되다" 없이', type: '묘사문', min: 180, check: '죽은 동사를 피하고 구체적 동사를 썼는가' },
      },
      {
        n: 10, title: '능동으로 책임 묻기',
        teach: ['"실수가 있었다", "조치될 예정이다" — 수동태 뒤에는 행위자가 숨네.', '누가 무엇을 했는지 주어를 세우게. 글이 단단해지고 믿음이 생기네.'],
        example: { before: '보고서 제출이 늦어지게 되었습니다.', after: '제가 자료 확인을 미뤄 보고서를 이틀 늦게 냈습니다.' },
        warmup: { task: '숨은 행위자를 찾아 능동태로 다시 쓰게.', items: ['그 과정에서 실수가 있었다.', '해당 건은 확인 후 조치될 예정입니다.', '이번 분기 예산이 초과 집행되었다.', '공지가 늦게 전달되었습니다.'] },
        drill: { name: '동사의 힘 훈련', purpose: '수동태 뒤에 숨은 행위자를 드러내는 능력', instruction: '아래 문장의 숨은 행위자를 밝혀, 누가 무엇을 했고 무엇을 하겠다는지 능동태로 다시 쓰게.', scene: '"고객님께 불편을 드려 죄송합니다. 해당 건은 내부 확인 후 순차적으로 조치될 예정입니다."' },
        write: { prompt: '최근 내가 한 실수 하나를, 주어를 숨기지 않고', type: '에세이', min: 180, check: '주어(행위자)가 분명한 능동문으로 썼는가' },
      },
      {
        n: 11, title: '동사로 속도 조절',
        teach: ['동사는 읽는 속도를 정하네.', '"머물다·스미다·번지다"는 느리게, "튀다·꽂히다·내달리다"는 빠르게.', '같은 장면도 동사만 바꾸면 다른 시간이 흐르지.'],
        example: { before: '그는 버스를 향해 갔다.', after: '그는 신호가 바뀌자마자 횡단보도를 내달려 닫히는 문틈에 어깨를 꽂았다.' },
        warmup: { task: '같은 장면을 느린 동사 한 문장, 빠른 동사 한 문장으로 쓰게.', items: ['고양이가 담장 위를 지나갔다.', '아침 햇빛이 방에 들어왔다.', '아이들이 운동장에 나갔다.'] },
        drill: { name: '동사의 힘 훈련', purpose: '동사로 읽기 속도를 조율하는 능력', instruction: '사진 속 장면을 두 버전으로 — (1) 느릿한 동사로 2문장, (2) 빠른 동사로 2문장. 같은 장면, 다른 속도.', image: 'A scene combining stillness and motion: a crosswalk at rush hour with a blurred cyclist and a still elderly person waiting, or rain hitting a window while a bus passes.' },
        write: { prompt: '하루 중 가장 빨랐던 1분과 가장 느렸던 1분', type: '스토리텔링', min: 200, check: '동사 선택으로 속도 차이를 만들었는가' },
      },
      {
        n: 12, title: '사물에 동작을',
        teach: ['움직이지 않는 것에 동작 동사를 주면 장면이 숨을 쉬네.', '"전선이 골목을 가로질렀다", "그림자가 계단을 한 칸씩 내려왔다". 과장 말고, 정확하게.'],
        example: { before: '창문에 햇빛이 비쳤다.', after: '햇빛이 블라인드 틈을 비집고 들어와 책상 위에 줄을 그었다.' },
        warmup: { task: '정지한 사물에 정확한 동작 동사를 주어 다시 쓰게.', items: ['방에 시계가 걸려 있었다.', '골목에 가로등이 서 있었다.', '탁자 위에 편지가 놓여 있었다.'] },
        drill: { name: '동사의 힘 훈련', purpose: '정지한 사물을 동작 동사로 살리는 능력', instruction: '사진 속 움직이지 않는 사물 2-3개를 골라, 각각을 정확한 동작 동사로 살려 내는 문장을 쓰게.', image: 'A still interior or alley full of static objects with strong light and shadow: sunlight through blinds onto a desk, wires and pipes along an old building wall, a staircase with long shadows.' },
        write: { prompt: '내 방(또는 책상)의 아침 풍경 — 사물들이 움직이듯', type: '묘사문', min: 180, check: '사물에 동작 동사를 정확하게 주었는가' },
      },
    ],
    boss: {
      id: 'heurisi', prompt: '누군가에게 길을 설명하거나 일을 부탁했던 장면 — 누가, 무엇을, 왜가 또렷하게', type: '스토리텔링', minChars: 450, dimMin: 6,
      taunt: ['그래서 누가 한 거야?', '무슨 일이 있었던 거지?', '음… 졸려…'],
      lose: '흐릿… 아직 잘 모르겠는데…',
      win: [{ who: 'heurisi', text: '아… 다 보여… 눈부셔…' }, { who: 'muk', text: '셋째 장이 돌아왔네. 자네 문장엔 이제 엔진이 달렸어.' }],
    },
  },

  /* ─────────────── 4장 덜어내기 (가독성) ─────────────── */
  {
    n: 4, title: '덜어내기', dim: '가독성',
    intro: [
      { who: 'muk', text: '넷째 장은 "덜어내기"일세. 이 장이 제일 아프네. 공들여 쓴 걸 지워야 하거든.' },
      { who: 'muk', text: '빼도 뜻이 같으면 빼게. 남은 문장이 훨씬 멀리 가네.' },
    ],
    sus: [
      {
        n: 13, title: '한 문장 한 생각',
        teach: ['한 문장에 생각을 둘 이상 싣지 말게.', '"~하고, ~해서, ~했는데"로 이어진 문장은 마침표로 끊게.'],
        example: { before: '어제 친구를 만났는데 오랜만이라 반가웠고 같이 밥을 먹으면서 이야기를 했는데 시간이 금방 갔다.', after: '어제 친구를 만났다. 일 년 만이었다. 국밥 두 그릇이 식는 동안 이야기가 끊기지 않았다.' },
        warmup: { task: '긴 문장을 한 문장 한 생각으로 끊어 다시 쓰게.', items: ['회의가 길어져서 점심을 못 먹었는데 오후에 또 회의가 있어서 결국 저녁에 몰아서 먹었고 속이 안 좋았다.', '주말에 집 정리를 하려고 했는데 막상 시작하니 버릴 게 많아서 고민하다가 결국 반만 했다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '한 문장에 한 생각만 담는 능력', instruction: '사진 속 장면을 5문장으로 쓰게. 한 문장에 생각 하나, 문장마다 15어절을 넘기지 말게.', image: 'A simple scene with a clear sequence of small events: a person at a crosswalk then a bus arriving, a cat approaching a bowl, a vendor setting up a stall in the morning.' },
        write: { prompt: '어제 하루를 한 문장 한 생각으로 7문장', type: '설명문', min: 150, check: '연결어미로 늘어진 문장 없이 끊어 썼는가' },
      },
      {
        n: 14, title: '수식어 덜기',
        teach: ['"정말, 너무, 매우, 굉장히"는 힘을 빼는 말일세.', '형용사 두 개를 겹치지 말고, 하나를 정확하게.'],
        example: { before: '정말 너무 아름답고 멋진 풍경이었다.', after: '능선이 세 겹으로 포개진 풍경이었다.' },
        warmup: { task: '강조 부사와 겹친 수식어를 덜어내고 정확한 말 하나로 바꾸게.', items: ['정말 너무 맛있고 훌륭한 음식이었다.', '굉장히 크고 넓은 강당이었다.', '매우 친절하고 상냥한 직원이었다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '수식어 없이 정확한 말로 쓰는 능력', instruction: '사진을 3문장으로 쓰게. "정말·너무·매우·굉장히·아주"는 금지, 형용사는 문장마다 하나까지.', constraints: ['정말', '너무', '매우', '굉장히', '아주', '엄청'], image: 'A visually striking but simple landscape or cityscape: mountain ridges in layers at dawn, a long bridge in fog, a field of reeds by a river.' },
        write: { prompt: '최근 본 가장 인상적인 장면을 수식어 없이', type: '묘사문', min: 150, check: '강조 부사·겹친 형용사를 덜어냈는가' },
      },
      {
        n: 15, title: '"것·수·있다" 줄이기',
        teach: ['"~하는 것은 ~할 수 있다는 것이다" 같은 문장은 같은 자리를 맴도네.', '"것", "수 있다", "~에 대해"를 줄이면 문장이 곧게 서네.'],
        example: { before: '중요한 것은 꾸준히 할 수 있는 것이라고 생각할 수 있다.', after: '꾸준함이 중요하다.' },
        warmup: { task: '"것/수 있다/~에 대해"를 줄여 곧게 다시 쓰게.', items: ['우리가 알아야 하는 것은 변화가 있을 수 있다는 것이다.', '이 문제에 대해 생각해 볼 수 있는 것은 많다.', '운동을 하는 것은 건강에 도움이 될 수 있는 것이다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '군더더기 표현 없이 곧게 쓰는 능력', instruction: '아래 문장을 뜻은 그대로 두고 절반 길이로 줄이게.', scene: '"이번 프로젝트를 진행하는 것에 있어서 가장 중요하다고 할 수 있는 것은 팀원들 간의 원활한 소통이 이루어질 수 있도록 하는 것이라고 생각되어집니다."' },
        write: { prompt: '내가 요즘 중요하게 여기는 것 하나 — "것·수 있다" 없이', type: '의견문', min: 180, check: '"것/수 있다/~에 대해/되어지다"를 줄였는가' },
      },
      {
        n: 16, title: '문장의 리듬',
        teach: ['짧은 문장만 이어지면 숨이 차고, 긴 문장만 이어지면 지치네.', '긴 문장 둘 뒤에 짧은 문장 하나. 그 짧은 문장에 힘을 싣게.'],
        example: { before: '나는 문을 열었다. 방은 조용했다. 아무도 없었다. 불을 켰다.', after: '퇴근길 내내 고민한 말을 되뇌며 현관문을 열었는데, 거실엔 냉장고 소리만 낮게 깔려 있었다. 아무도 없었다.' },
        warmup: { task: '단조로운 문장 길이를 긴 문장과 짧은 문장이 섞이게 다시 쓰게.', items: ['비가 왔다. 우산이 없었다. 뛰었다. 젖었다.', '나는 아침에 일어나서 씻고 옷을 입고 밥을 먹고 가방을 챙겨서 집을 나섰다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '문장 길이로 리듬과 강조를 만드는 능력', instruction: '사진 속 장면을 4-5문장으로 쓰게. 긴 문장과 짧은 문장을 섞고, 마지막은 5어절 이하의 짧은 문장으로 끝내 힘을 주게.', image: 'A scene with a quiet moment of tension or arrival: an empty train platform as the last train pulls in, a front door slightly open with light inside, a person standing at the edge of a pier.' },
        write: { prompt: '기다리던 소식을 받은 순간을, 리듬을 살려', type: '스토리텔링', min: 200, check: '긴 문장과 짧은 문장을 섞어 강조를 만들었는가' },
      },
    ],
    boss: {
      id: 'neureoji', prompt: '올해 버린 것 하나 (물건이든 습관이든)', type: '에세이', minChars: 250, maxChars: 600, dimMin: 6,
      taunt: ['조금만 더 설명하자~', '혹시 모르니 한 번 더 말하자~', '"것 같다"를 붙이면 안전해~'],
      lose: '스르륵… 아직 꼬리가 길어~',
      win: [{ who: 'neureoji', text: '꼬리가… 없…' }, { who: 'muk', text: '넷째 장이 돌아왔네. 덜어낸 자리에서 문장이 숨을 쉬지.' }],
    },
  },

  /* ─────────────── 5장 흐름 (논리성) ─────────────── */
  {
    n: 5, title: '흐름', dim: '논리성',
    intro: [
      { who: 'muk', text: '다섯째 장은 "흐름"일세. 문장 하나하나가 좋아도 순서가 엉키면 독자는 길을 잃네.' },
      { who: 'muk', text: '첫 문장이 붙잡고, 가운데가 받치고, 끝이 닫아야 하네.' },
    ],
    sus: [
      {
        n: 17, title: '첫 문장으로 붙잡기',
        teach: ['첫 문장은 독자에게 거는 내기일세.', '배경 설명("요즘 많은 사람들이")으로 시작하지 말고, 장면·질문·의외의 사실로 바로 들어가게.'],
        example: { before: '요즘 많은 사람들이 운동을 한다. 나도 운동을 시작했다.', after: '스쿼트 열 개에 무릎이 먼저 항복했다.' },
        warmup: { task: '배경 설명으로 시작하는 첫 문장을, 장면이나 질문으로 바로 들어가게 바꾸게.', items: ['현대 사회에서 스마트폰은 필수품이 되었다.', '여행은 누구에게나 설레는 일이다.', '나는 어릴 때부터 책을 좋아했다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '첫 문장으로 독자를 붙잡는 능력', instruction: '사진을 보고, 이 장면으로 시작하는 이야기의 첫 문장을 서로 다른 방식(장면·질문·의외의 사실)으로 3개 쓰게.', image: 'An intriguing everyday scene that begs a story: a single red umbrella left on a subway seat, a moving truck half-unloaded at night, a child alone at a ticket gate.' },
        write: { prompt: '최근 생긴 작은 사건 하나를, 첫 문장에 공들여', type: '스토리텔링', min: 200, check: '첫 문장이 배경 설명 없이 바로 붙잡는가' },
      },
      {
        n: 18, title: '주장과 근거',
        teach: ['주장은 한 문장으로 세우고, 근거는 두 개로 받치게.', '근거는 "다들 그렇다"가 아니라 사례·숫자·경험이어야 하네.'],
        example: { before: '아침 운동은 좋다. 건강에 좋기 때문이다.', after: '아침 운동을 권한다. 석 달째 6시에 걷자 오후 3시의 졸음이 사라졌고, 일정이 꼬여도 운동만은 빠지지 않았다.' },
        warmup: { task: '막연한 근거를 사례나 숫자로 바꿔 주장을 받치게.', items: ['독서는 중요하다. 왜냐하면 도움이 되기 때문이다.', '재택근무가 낫다. 편하니까.', '일찍 자야 한다. 건강에 좋다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '주장을 근거로 받치는 능력', instruction: '사진 속 상황에 대한 내 주장 한 문장을 세우고, 사진에서 찾은 근거 두 가지로 받치게 (총 3-4문장).', image: 'A scene that invites an opinion with visible evidence: overflowing recycling bins in an apartment complex, a crowded bike lane next to empty car lanes, people all looking at phones in a waiting room.' },
        write: { prompt: '내가 남에게 권하고 싶은 습관 하나 — 주장 1, 근거 2', type: '의견문', min: 250, check: '주장이 한 문장이고 근거가 구체적 사례·숫자인가' },
      },
      {
        n: 19, title: '연결어 없이 잇기',
        teach: ['"그리고, 그래서, 하지만"을 줄줄이 달면 흐름이 오히려 끊기네.', '앞 문장의 끝 단어를 다음 문장이 받아 이어 가게. 생각의 순서가 곧 접속사일세.'],
        example: { before: '비가 왔다. 그래서 우산을 샀다. 그런데 우산이 비쌌다. 그래도 샀다.', after: '비가 쏟아졌다. 편의점 우산은 만 이천 원. 비싸다는 생각보다 젖은 셔츠가 먼저였다.' },
        warmup: { task: '접속사를 빼고 문장끼리 자연스럽게 이어지도록 다시 쓰게.', items: ['나는 피곤했다. 그래서 일찍 잤다. 그런데 잠이 안 왔다. 그래서 책을 읽었다.', '회의를 했다. 그리고 결론이 났다. 하지만 아무도 만족하지 않았다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '접속사 없이 흐름을 잇는 능력', instruction: '사진 속 장면에서 일어난 일을 4문장으로 쓰게. "그리고·그래서·하지만·그런데·그러나"는 금지.', constraints: ['그리고', '그래서', '하지만', '그런데', '그러나', '그러므로'], image: 'A scene implying a small chain of cause and effect: a spilled coffee cup and wet papers, a flat bicycle tire and a person walking the bike, a fallen umbrella in the wind.' },
        write: { prompt: '작은 일이 꼬리를 물고 커졌던 하루', type: '스토리텔링', min: 200, check: '접속사에 기대지 않고 흐름을 이었는가' },
      },
      {
        n: 20, title: '끝맺음',
        teach: ['끝은 요약이 아니라 여운일세. "결국 소중한 하루였다"로 닫지 말게.', '처음 장면으로 돌아가거나, 작은 행동 하나로 끝내게.'],
        example: { before: '이렇게 해서 나는 많은 것을 깨달았고 소중한 경험이 되었다.', after: '돌아오는 길, 편의점에서 우산을 하나 더 샀다. 내일은 그 애 몫이었다.' },
        warmup: { task: '교훈으로 닫는 마지막 문장을, 장면이나 행동으로 바꾸게.', items: ['결국 가족이 가장 소중하다는 것을 깨달았다.', '이번 여행은 잊지 못할 추억이 되었다.', '앞으로 더 열심히 살아야겠다고 다짐했다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '여운 있는 끝맺음을 만드는 능력', instruction: '사진 속 장면이 어떤 이야기의 마지막이라고 생각하고, 마지막 두 문장을 쓰게. 교훈·요약 금지, 장면이나 행동으로 끝내게.', constraints: ['깨달았다', '소중한', '추억', '다짐했다', '결국'], image: 'A quiet closing scene: lights turning off in a small shop at night, two cups left on a table after guests left, a train disappearing into the distance at dusk.' },
        write: { prompt: '최근 끝난 무언가(만남·일·계절)를, 여운이 남게', type: '에세이', min: 220, check: '교훈·요약 없이 장면·행동으로 끝냈는가' },
      },
    ],
    boss: {
      id: 'eotbagi', prompt: '"매일 쓰는 것"은 정말 실력을 늘리는가 — 찬반 중 하나를 골라 논증', type: '의견문', minChars: 500, dimMin: 6,
      taunt: ['그러니까 아무튼~', '왜냐하면 그냥~', '결론은 나중에~'],
      lose: '엉킨다 엉킨다~',
      win: [{ who: 'eotbagi', text: '풀렸… 다…' }, { who: 'muk', text: '다섯째 장이 돌아왔네. 자네 글은 이제 길을 잃지 않아.' }],
    },
  },

  /* ─────────────── 6장 한 줄 (종합) ─────────────── */
  {
    n: 6, title: '한 줄', dim: '종합',
    intro: [
      { who: 'muk', text: '마지막 장은 "한 줄"일세. 지금까지 배운 걸 한 줄에, 한 편에 모으는 법이야.' },
      { who: 'muk', text: '그리고 이 장 끝에는 내 30년을 붙잡았던 놈이 기다리고 있네.' },
    ],
    sus: [
      {
        n: 21, title: '한 줄로 압축',
        teach: ['쓰기 전에 "그래서 하고 싶은 말이 뭔가"를 한 줄로 적어 보게.', '한 줄로 안 되면 아직 생각이 덜 익은 걸세.'],
        example: { before: '요즘 일도 많고 사람도 많이 만나고 정신이 없어서 나를 돌볼 시간이 없다는 생각이 들었다.', after: '바쁜 날일수록 나만 일정표에 없다.' },
        warmup: { task: '긴 생각을 20자 안팎의 한 줄로 압축하게.', items: ['어릴 때는 몰랐는데 커 보니 부모님이 얼마나 고생하셨는지 알게 되었다.', '좋아하는 일을 직업으로 삼으면 좋아하던 마음이 줄어드는 것 같다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '평범한 장면에서 의미를 발견해 한 줄로 압축하는 능력', instruction: '사진 속 장면에 담긴 이야기를 한 줄 카피로 압축하게. 설명하지 말고, 여운이 남게 (20자 안팎).', image: 'An everyday moment with a hidden story: an old man feeding pigeons alone, a convenience store worker at 3am, a child holding a parent’s finger at a crowded crossing.' },
        write: { prompt: '요즘 내 생활을 한 줄로 쓰고, 그 한 줄을 풀어 한 단락', type: '에세이', min: 200, check: '핵심이 한 줄로 서 있고 단락이 그 한 줄을 받치는가' },
      },
      {
        n: 22, title: '제목 짓기',
        teach: ['제목은 글의 첫 문장보다 먼저 읽히네.', '주제를 요약하지 말고(「나의 여름」), 글 속의 구체적인 사물이나 한 구절에서 따오게(「식은 보리차」).'],
        example: { before: '「할머니와의 추억」', after: '「반들거리는 자개장 손잡이」' },
        warmup: { task: '요약형 제목을 글 속 구체에서 따온 제목으로 바꾸게.', items: ['「나의 첫 직장 이야기」', '「여름 방학의 추억」', '「이사에 대한 생각」'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '구체에서 제목을 길어 올리는 능력', instruction: '사진이 어떤 에세이의 표지라고 생각하고, 사진 속 구체적인 사물에서 따온 제목 3개를 쓰게. 각각 한 줄로 이유를 덧붙이게.', image: 'An evocative still life suitable as an essay cover: a half-peeled tangerine on a windowsill in winter, a key on a red string, a rice cooker steaming in a small kitchen.' },
        write: { prompt: '지난 수련 중 쓴 글 하나에 새 제목을 짓고, 첫 단락을 다시 쓰기', type: '에세이', min: 200, check: '제목이 글 속 구체에서 나왔는가' },
      },
      {
        n: 23, title: '독자 한 사람',
        teach: ['"모두에게" 쓰면 아무에게도 닿지 않네.', '한 사람을 정하게. 그 사람이 모르는 말은 풀고, 아는 말은 줄이게.'],
        example: { before: '이 앱은 많은 기능이 있어 누구에게나 유용하다.', after: '퇴근 후 30분밖에 없는 당신이라면, 첫 화면의 버튼 하나만 누르면 된다.' },
        warmup: { task: '두루뭉술한 독자를 한 사람으로 정해 다시 쓰게.', items: ['이 책은 모든 사람에게 추천한다.', '건강을 위해 누구나 물을 많이 마셔야 한다.', '여러분 모두 한 번쯤 가 보세요.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '특정한 독자에게 맞춰 쓰는 능력', instruction: '사진 속 장소를 한 사람(예: 처음 서울에 온 사촌, 은퇴한 아버지)에게 소개하는 3-4문장을 쓰게. 첫 문장에서 그 사람을 부르게.', image: 'An inviting place worth recommending: a small neighborhood bookstore, a riverside walking path at sunset, a tiny noodle shop with a counter.' },
        write: { prompt: '내가 좋아하는 것 하나를, 그걸 모르는 한 사람에게', type: '설명문', min: 220, check: '독자 한 사람을 정하고 그에 맞춰 썼는가' },
      },
      {
        n: 24, title: '내 목소리',
        teach: ['스물셋 수를 익혔으면 이제 다 잊어도 되네.', '남이 쓸 법한 문장 말고, 자네만 쓸 수 있는 문장 — 자네의 단어, 자네의 리듬, 자네의 사물.', '그게 목소리일세.'],
        example: { before: '나는 평범한 회사원이다.', after: '나는 엑셀 셀 서식을 바꾸는 데 하루 중 가장 공을 들이는 사람이다.' },
        warmup: { task: '누구나 쓸 수 있는 자기소개를, 나만 쓸 수 있는 문장으로 바꾸게.', items: ['나는 평범한 사람이다.', '나는 음악을 좋아한다.', '나는 걱정이 많은 편이다.'] },
        drill: { name: '한 줄 통찰 훈련', purpose: '나만의 시선으로 장면을 해석하는 능력', instruction: '사진을 보고, 나만 떠올릴 수 있는 기억이나 시선을 섞어 3-4문장으로 쓰게. 남이 봐도 똑같이 쓸 문장은 지우게.', image: 'An open-ended, slightly ambiguous everyday scene that different people would read differently: an empty bus at night with one light on, laundry hanging between buildings, a door half open to a sunny room.' },
        write: { prompt: '나는 왜 쓰는가 — 백지첩을 마치며', type: '에세이', min: 400, check: '남이 쓸 수 없는 나만의 단어·사물·리듬이 있는가' },
      },
    ],
    boss: {
      id: 'baekjigwi', prompt: '내가 글을 쓰는 이유 — 혹은 쓰지 못했던 이유', type: '에세이', minChars: 800, scoreMin: 58,
      taunt: ['그 문장, 부끄럽지 않나?', '누가 이걸 읽겠어?', '조금 더 준비되면 써.'],
      lose: '…거봐. 아직 완벽하지 않잖아.',
      win: [
        { who: 'baekjigwi', text: '불완전한데… 왜… 지워지지 않는 거지…' },
        { who: 'muk', text: '끝냈으니까. 끝낸 글은 지워지지 않네.' },
        { who: 'muk', text: '……30년 동안 내 펜을 붙잡던 놈이 저놈이었어. 고맙네, 정말로.' },
      ],
    },
  },
];

export const ALL_SU: Su[] = CHAPTERS.flatMap(c => c.sus);
export const TOTAL_SU = ALL_SU.length;
export const chapterOf = (n: number) => CHAPTERS.find(c => c.sus.some(s => s.n === n))!;
export const suOf = (n: number) => ALL_SU.find(s => s.n === n);

/* ── 이야기 (프롤로그·에필로그) ── */
export const PROLOGUE: Line[] = [
  { who: 'narr', text: '산마루 마을에는 이상한 안개가 내린다. 아무도 기록하지 않은 날은 하얗게 지워지고, 사람들은 자기 이야기를 조금씩 잊어 간다.' },
  { who: 'narr', text: '안개 속에서 길을 잃은 당신은 언덕 꼭대기, 불이 켜진 서재의 문을 두드린다.' },
  { who: 'muk', text: '…들어오게. 나는 묵당이라 하네. 한때 글을 썼지.' },
  { who: 'muk', text: '이건 『백지첩』일세. 평생 모은 문장 기법 스물네 가지를 적어 둔 책이었지. 내가 펜을 놓자 전부 하얗게 지워졌어.' },
  { who: 'muk', text: '저 안개도 그날부터야. 쓰지 않은 날들이 쌓여 생긴 거지.' },
  { who: 'muk', text: '하루 한 수씩 가르쳐 주겠네. 자네가 익힐 때마다 이 책이 한 장씩 돌아올 걸세.' },
  { who: 'muk', text: '조건은 하나. 매일 오게. 하루 한 번 쓰면 등불이 켜지고, 등불이 켜진 날은 안개가 걷히네.' },
];
export const EPILOGUE: Line[] = [
  { who: 'narr', text: '마지막 장이 돌아오자, 서재 창밖의 안개가 처음으로 완전히 걷혔다.' },
  { who: 'muk', text: '백지첩이 다 돌아왔군. 스물네 장, 전부 자네 손으로.' },
  { who: 'muk', text: '그런데 말일세, 이 책은 한 번 읽고 덮는 책이 아니야. 같은 수도 두 번째엔 다르게 보이지.' },
  { who: 'muk', text: '다음 회차엔 기준을 올리겠네. 그리고 이번엔 나도 옆에서 같이 쓰겠어.' },
];

/* ── 짧은 글 대체 주제: 오늘의 질문 · 글감 낱말 ── */
export const QUESTIONS = [
  '오늘 가장 오래 바라본 것은?', '최근 누군가에게 하지 못한 말은?', '요즘 자주 지나치는데 한 번도 들어가 보지 않은 곳은?',
  '어릴 때 믿었다가 아니라는 걸 알게 된 것은?', '내 방에서 가장 오래된 물건의 사연은?', '최근 나를 웃게 만든 사소한 일은?',
  '1년 전의 나에게 알려 주고 싶은 것 하나는?', '내가 자주 하는 말버릇과 그 이유는?', '가장 최근에 마음이 바뀐 일은?',
  '아무도 모르는 나의 작은 습관은?', '오늘 하루를 색 하나로 고른다면, 그 이유는?', '요즘 가장 자주 듣는 소리는?',
  '내가 잘하지만 아무도 칭찬하지 않는 일은?', '최근 낯선 사람에게 받은 작은 친절은?', '이번 주에 버린 것 중 가장 아까운 것은?',
  '지금 가장 듣고 싶은 말은?', '가장 좋아하는 길과 그 길의 시간대는?', '최근 혼자 결정한 일은?',
  '내 휴대폰 사진첩의 마지막 사진 속 이야기는?', '오늘 먹은 것 중 가장 기억에 남는 한 입은?',
];
export const WORDS = [
  '우산', '거스름돈', '초인종', '귤껍질', '정류장', '열쇠', '빨래집게', '형광등', '편지봉투', '연필깎이', '지하철', '보리차',
  '운동화 끈', '창문', '라디오', '바둑알', '고무줄', '영수증', '자판기', '목도리', '계단', '수첩', '손톱깎이', '전단지',
  '안경닦이', '모래시계', '가로등', '종이컵', '냉장고 자석', '이어폰', '달력', '찻잔', '빈 화분', '기차표', '손수건', '분필',
];
