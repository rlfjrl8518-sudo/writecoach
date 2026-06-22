'use client';
import { useState } from 'react';

function AccordionItem({
  label, badge, badgeColor, desc, example,
}: {
  label: string; badge?: string; badgeColor?: string;
  desc: string; example?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }} onClick={() => setOpen(v => !v)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {badge && (
            <span style={{
              flexShrink: 0, fontSize: 11, fontWeight: 600,
              color: badgeColor || 'var(--accent)',
              background: badgeColor ? `${badgeColor}18` : 'var(--accent-dim)',
              padding: '3px 10px', borderRadius: 100,
            }}>
              {badge}
            </span>
          )}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {label}
          </span>
        </div>
        <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--dim-star)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </div>
      {open && (
        <div style={{ paddingBottom: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--dim-star)', lineHeight: 1.8, margin: '0 0 10px' }}>{desc}</p>
          {example && (
            <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--bg-subtle)', borderLeft: `3px solid ${badgeColor || 'var(--accent)'}`, padding: '10px 14px', borderRadius: '0 8px 8px 0', lineHeight: 1.8 }}>
              {example}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="px-card" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--dim-star)', marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
        분석 기준 가이드
      </div>
      <p style={{ fontSize: 14, color: 'var(--dim-star)', marginBottom: 28, lineHeight: 1.7 }}>
        AI 분석 결과에 나오는 용어들을 설명해요. 항목을 눌러 자세한 내용을 확인하세요.
      </p>

      {/* ── 1. 점수 항목 ── */}
      <Section title="점수 항목" sub="AI가 글을 평가하는 5가지 기준">

        {/* 항목별 점수 기준 */}
        <div style={{ marginBottom: 10, padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 8, borderLeft: '3px solid var(--moon)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--moon)', marginBottom: 8 }}>항목별 점수 기준 (각 0–10점)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 13, color: 'var(--dim-star)', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif' }}>
            <span style={{ fontWeight: 700, color: 'var(--bad)' }}>3-4점</span><span>평균 이하. 준비 없이 쓴 습작 수준</span>
            <span style={{ fontWeight: 700, color: 'var(--moon)' }}>5점</span><span>평균. 성실하게 썼지만 특별한 점 없음</span>
            <span style={{ fontWeight: 700, color: 'var(--moon)' }}>6점</span><span>평균 이상. 인상적인 표현이 하나 이상 있을 때</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>7점</span><span>좋은 글. 완성도가 높고 강점이 뚜렷함. 드물게 부여</span>
            <span style={{ fontWeight: 700, color: 'var(--good)' }}>8-10점</span><span>거의 부여하지 않음. 출판 가능한 수준</span>
          </div>
        </div>

        {/* 총점 해석 */}
        <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>총점 해석 (0–100점)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 13, color: 'var(--dim-star)', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif' }}>
            <span style={{ fontWeight: 700, color: 'var(--bad)' }}>~39점</span><span>기초 단계. 표현·구조 전반에 보완이 필요함</span>
            <span style={{ fontWeight: 700, color: 'var(--moon)' }}>40-54점</span><span>평균 수준. 대부분의 성실한 습작이 여기에 속함</span>
            <span style={{ fontWeight: 700, color: 'var(--moon)' }}>55-64점</span><span>평균 이상. 눈에 띄는 표현이 존재함</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>65-74점</span><span>좋은 글. 완성도가 높고 강점이 뚜렷함</span>
            <span style={{ fontWeight: 700, color: 'var(--good)' }}>75점~</span><span>우수한 글. 전문 작가 수준에 근접</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--dim-star)', lineHeight: 1.7, borderTop: '1px solid var(--card-border)', paddingTop: 8 }}>
            💡 <strong style={{ color: 'var(--text)' }}>50점이 평균입니다.</strong> 이전 AI 평가 도구와 달리 점수가 후하지 않아요. 60점대도 충분히 잘 쓴 글이에요.
          </div>
        </div>

        {/* 감점 기준 */}
        <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 8, borderLeft: '3px solid var(--bad-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad)', marginBottom: 6 }}>자동 감점 기준</div>
          <div style={{ fontSize: 13, color: 'var(--dim-star)', lineHeight: 1.8, fontFamily: 'Pretendard, sans-serif' }}>
            · 3문장 이하의 짧은 글 — 구체성·논리성 자동 1–2점 감점<br />
            · 근거 없이 감정·의견만 나열된 글 — 논리성 감점<br />
            · 같은 어휘·문장 구조가 반복될 경우 — 표현력 감점
          </div>
        </div>

        <AccordionItem
          badge="표현력" badgeColor="#3182F6"
          label="얼마나 독창적으로 표현했나"
          desc="진부하거나 상투적인 표현('예쁘다', '힘들었다', '좋았다')을 피하고 신선하고 구체적인 언어로 대체했는지 평가해요. 6점 이상을 받으려면 독자가 멈추고 되읽게 만드는 표현이 최소 하나는 있어야 해요."
          example="낮은 예: 바람이 불었다 → 높은 예: 바람이 옷깃을 파고들었다"
        />
        <AccordionItem
          badge="전달력" badgeColor="#3182F6"
          label="읽는 사람에게 잘 전달되나"
          desc="글의 의도가 독자에게 명확하게 닿는지 평가해요. '그것', '어떤 면에서', '~것 같다' 같이 모호한 표현이 많으면 점수가 낮아요. 한 문장을 읽고 다음 문장을 예측할 수 있어야 높은 점수를 받아요."
          example="낮은 예: 그것은 어떤 면에서 좋은 것 같았다 → 높은 예: 그 결정은 비용을 30% 줄였다"
        />
        <AccordionItem
          badge="구체성" badgeColor="#3182F6"
          label="추상적이지 않고 구체적인가"
          desc="'많다', '좋다', '나쁘다', '힘들었다' 같은 추상어 대신 수치, 색깔, 크기, 감각 등 구체적인 디테일을 사용했는지 봐요. 짧은 글일수록 이 기준이 더 엄격하게 적용돼요."
          example="낮은 예: 음식이 맛있었다 → 높은 예: 간장 향이 나는 국물이 혀 끝에 짭짤하게 닿았다"
        />
        <AccordionItem
          badge="논리성" badgeColor="#22B85A"
          label="주장과 근거가 자연스럽게 연결되나"
          desc="주장만 있고 근거가 없거나, 근거가 있어도 주장과 연결이 어색하면 낮은 점수를 받아요. 묘사문·감상문보다 의견문·설명문에서 특히 중요하게 평가돼요."
          example="낮은 예: 이 방법이 좋다. 많은 사람이 쓴다. → 높은 예: 이 방법은 효과적이다. 3주 만에 30% 향상된 실험 결과가 있기 때문이다."
        />
        <AccordionItem
          badge="가독성" badgeColor="#22B85A"
          label="읽기 편한 흐름인가"
          desc="문단이 너무 길거나 문장이 계속 같은 길이로 반복되면 점수가 낮아요. 짧은 문장과 긴 문장이 적절히 섞여 리듬감이 있어야 높은 점수를 받을 수 있어요."
        />
      </Section>

      {/* ── 2. 문장의 역할 ── */}
      <Section title="문장의 역할" sub="문장 해부 기능 — 이 문장이 글 안에서 어떤 기능을 수행하는지 7가지로 분류해요">
        {[
          {
            badge: '장면 묘사', color: 'var(--good)',
            label: '공간·시간·분위기를 감각적으로 그려냄',
            desc: '오감을 활용해 독자가 장면을 눈앞에 그릴 수 있게 만드는 문장이에요. 소설·에세이에서 가장 자주 나타나고, 몰입감을 높이는 데 핵심 역할을 해요.',
            example: '거리는 텅 비어 있었고, 간판만 희미하게 빛났다. / 새벽 공기가 차갑고 투명했다.',
          },
          {
            badge: '대상 설명', color: 'var(--accent)',
            label: '인물·사물·개념의 특성을 풀어서 전달',
            desc: '독자가 이해하기 쉽게 대상의 모습이나 성질을 설명해요. 설명문·기사에서 많이 쓰이며, 정보를 정확하게 전달하는 역할을 해요.',
            example: '이 제도는 2012년에 도입됐으며, 매년 약 3만 명이 혜택을 받는다.',
          },
          {
            badge: '행동 전개', color: 'var(--moon)',
            label: '인물이 무언가를 하거나 사건이 진행됨',
            desc: '누가 무엇을 했는지 서술하는 가장 기본적인 문장이에요. 이야기를 앞으로 밀고 나가는 역할을 해요.',
            example: '그는 말없이 문을 닫았다. / 아이가 뛰어갔다.',
          },
          {
            badge: '감정 표현', color: '#E07B7B',
            label: '내면의 감정·심리 상태를 드러냄',
            desc: '기쁨, 슬픔, 두려움 등 인물의 감정을 직접 또는 간접적으로 드러내요. 독자와 감정적으로 연결되는 순간을 만들어요.',
            example: '나는 외로웠다. / 가슴 깊은 곳이 서늘해졌다.',
          },
          {
            badge: '분위기 형성', color: '#9B7BE0',
            label: '글의 전반적인 톤·무드를 설정',
            desc: '장면 묘사보다 더 넓은 범위의 분위기를 만드는 문장이에요. 독자가 글의 전체적인 느낌을 받아들이게 해요.',
            example: '어딘가 이상했다. 모두 웃고 있었지만 소리가 없었다.',
          },
          {
            badge: '생각 전달', color: 'var(--dim-star)',
            label: '글쓴이의 의견·관점·통찰을 드러냄',
            desc: '사실이 아닌 글쓴이의 생각이나 해석을 제시하는 문장이에요. 에세이·의견문에서 핵심 역할을 해요.',
            example: '이 문제는 구조적 변화 없이는 해결되기 어렵다.',
          },
          {
            badge: '정보 전달', color: 'var(--card-border)',
            label: '사실·데이터를 객관적으로 전달',
            desc: '감정이나 의견 없이 사실을 있는 그대로 전달해요. 기사·보도자료에서 기본이 되는 유형이에요.',
            example: '서울시 인구는 2024년 기준 약 940만 명이다.',
          },
        ].map(item => (
          <AccordionItem key={item.badge} badge={item.badge} badgeColor={item.color} label={item.label} desc={item.desc} example={item.example} />
        ))}
      </Section>

      {/* ── 3. 표현 유형 ── */}
      <Section title="표현 유형" sub="문장 해부 기능 — 문장에서 어떤 방식의 표현을 사용했는지 6가지로 분류해요">
        {[
          {
            badge: '구체적 표현', color: 'var(--accent)',
            label: '수치·색깔·감각으로 선명하게 묘사',
            desc: '추상적 단어 대신 구체적인 디테일로 독자의 머릿속에 명확한 이미지를 만들어요. 글쓰기에서 가장 효과적인 표현 방식 중 하나예요.',
            example: '예) "많이 먹었다" → "그릇을 세 번 비웠다"',
          },
          {
            badge: '추상적 표현', color: 'var(--dim-star)',
            label: '직접 설명하기 어려운 개념·감각을 암시',
            desc: '구체적으로 특정할 수 없는 느낌이나 개념을 표현해요. 철학적이거나 사유적인 글에서 효과적이지만, 과하면 의미가 흐려져요.',
            example: '예) "삶은 언제나 불완전하다." / "존재의 무게"',
          },
          {
            badge: '감각 표현', color: 'var(--good)',
            label: '시·청·후·미·촉각을 활용한 묘사',
            desc: '오감 중 하나를 활용해 장면을 생생하게 그려내는 표현이에요. 어떤 감각을 썼는지(시각·청각·후각·미각·촉각)도 함께 분석돼요.',
            example: '예) "빗소리가 지붕을 두드렸다" (청각) / "된장찌개 냄새가 계단을 타고 내려왔다" (후각)',
          },
          {
            badge: '감정 표현', color: '#E07B7B',
            label: '감정·심리를 언어로 직접 드러냄',
            desc: '기쁨, 슬픔, 불안 등 감정 상태를 직접 서술하거나 간접적으로 전달하는 표현이에요. 독자와 감정적 공명을 만들어요.',
            example: '예) "그리움이 파도처럼 밀려왔다." / "가슴이 서늘해졌다."',
          },
          {
            badge: '비유 표현', color: '#9B7BE0',
            label: '낯선 대상을 친숙한 것에 빗대어 설명',
            desc: '직유(~같다, ~처럼)나 은유를 활용해 독자가 쉽고 인상적으로 이해하게 만들어요. 잘 쓴 비유 하나가 문단 전체를 살릴 수 있어요.',
            example: '예) "그의 웃음은 겨울 햇볕 같았다." / "머릿속이 얼어붙었다."',
          },
          {
            badge: '강조 표현', color: 'var(--moon)',
            label: '반복·대조·단언으로 메시지를 선명하게',
            desc: '특정 단어나 구절을 반복하거나 대조를 통해 강하게 각인시키는 표현이에요. 카피라이팅과 에세이 결말부에서 자주 쓰여요.',
            example: '예) "믿어라, 도전하라, 이겨라." / "가볍지만, 강합니다."',
          },
        ].map(item => (
          <AccordionItem key={item.badge} badge={item.badge} badgeColor={item.color} label={item.label} desc={item.desc} example={item.example} />
        ))}
      </Section>

      {/* ── 4. 감각 표현 가이드 ── */}
      <Section title="감각 표현 가이드" sub="감각 표현 유형일 때 — 어떤 감각을 활용했는지 분류해요">
        <AccordionItem
          badge="시각" badgeColor="#3182F6"
          label="색, 빛, 형태, 움직임 묘사"
          desc="가장 많이 쓰는 감각이에요. 색깔, 밝기, 크기, 형태, 움직임을 구체적으로 묘사하면 장면이 눈앞에 그려져요."
          example="붉은 노을이 창문에 번졌다. / 그림자가 길게 늘어졌다."
        />
        <AccordionItem
          badge="청각" badgeColor="#22B85A"
          label="소리, 목소리, 리듬 묘사"
          desc="소리를 묘사하면 장면의 분위기가 살아나요. 의성어나 비유를 활용하면 더 효과적이에요."
          example="멀리서 기차 소리가 났다. / 빗소리가 지붕을 두드렸다."
        />
        <AccordionItem
          badge="후각" badgeColor="#FF9F0A"
          label="냄새, 향기 묘사"
          desc="후각은 기억과 감정을 가장 강하게 자극하는 감각이에요. 글에서 가장 적게 쓰이지만, 쓰면 인상 깊은 장면이 돼요."
          example="비 온 뒤 흙냄새가 올라왔다. / 된장찌개 냄새가 계단을 타고 내려왔다."
        />
        <AccordionItem
          badge="미각" badgeColor="#F03E3E"
          label="맛, 질감 묘사"
          desc="음식 묘사에만 쓰이지 않아요. 공기, 눈물, 피, 긴장감도 미각으로 표현할 수 있어요."
          example="쓴맛이 목 안쪽까지 퍼졌다. / 긴장하면 입안이 텁텁해진다."
        />
        <AccordionItem
          badge="촉각" badgeColor="#8B95A1"
          label="온도, 감촉, 압력, 통증 묘사"
          desc="피부로 느끼는 감각이에요. 온도, 질감, 압력, 통증 등을 묘사하면 독자가 직접 경험하는 느낌을 줄 수 있어요."
          example="차가운 손잡이가 손바닥에 닿았다. / 어깨 위에 누군가의 손이 무겁게 얹혔다."
        />
      </Section>

      {/* ── 5. 글쓰기 유형별 목표 ── */}
      <Section title="글쓰기 유형별 목표" sub="유형마다 AI가 중점적으로 평가하는 기준이 달라요">
        {[
          { badge: '묘사문',      desc: '장면·인물·사물을 감각적으로 그려요. 표현력과 구체성이 핵심 평가 기준이에요.' },
          { badge: '설명문',      desc: '개념이나 현상을 명확하게 전달해요. 전달력·논리성·구체성이 중요해요.' },
          { badge: '감상문',      desc: '경험이나 작품에 대한 느낌을 정리해요. 솔직하고 깊이 있는 감상이 높은 점수를 받아요.' },
          { badge: '의견문',      desc: '주장과 근거를 갖춰 설득해요. 논리성과 근거의 구체성이 핵심이에요.' },
          { badge: '기사 리드',   desc: '핵심 정보를 5W1H로 첫 단락에 압축해요. 전달력과 가독성이 평가 기준이에요.' },
          { badge: '카피라이팅', desc: '관심을 끌고 행동을 유도하는 짧은 글이에요. 표현력·전달력·가독성이 중점 평가 항목이에요.' },
          { badge: '에세이',      desc: '경험과 생각을 자유롭게 깊이 있게 서술해요. 표현력과 논리적 흐름이 중요해요.' },
          { badge: '스토리텔링', desc: '사건·인물·감정이 있는 이야기를 구성해요. 장면 묘사력과 구성의 흐름이 핵심이에요.' },
        ].map(item => (
          <AccordionItem key={item.badge} badge={item.badge} label="" desc={item.desc} />
        ))}
      </Section>

      {/* ── 6. 카피 유형 ── */}
      <Section title="카피 유형" sub="카피 분석 — 이 카피가 어떤 방식으로 독자에게 접근하는지 분류">
        {[
          { badge: '브랜딩형',    desc: '제품·브랜드의 이미지와 정체성을 인식시키는 카피예요.',          example: '나이키: Just Do It. / 애플: Think Different.' },
          { badge: '혜택 전달형', desc: '사용자가 얻을 수 있는 구체적인 이득이나 결과를 전달해요.',     example: '30% 빠른 배터리 충전. / 한 달에 책 한 권 값으로 영화 무제한.' },
          { badge: '문제 제기형', desc: '독자가 겪고 있거나 인식하지 못한 문제를 먼저 제시해 관심을 끌어요.', example: '아직도 잠이 안 와요? / 왜 다이어트가 실패할 수밖에 없는지 아세요?' },
          { badge: '위험 환기형', desc: '손실·위험·불안을 상기시켜 행동을 촉구해요.',                   example: '준비 없이 노후를 맞이하면 어떻게 될까요?' },
          { badge: '감성 공감형', desc: '독자의 감정이나 경험에 공명해 정서적 연결을 만들어요.',         example: '열심히 했는데도 안 풀릴 때, 우리가 곁에 있을게요.' },
          { badge: '행동 유도형', desc: '독자에게 지금 당장 특정 행동을 하도록 직접 촉구해요.',         example: '지금 무료로 시작하세요. / 오늘만 50% 할인.' },
          { badge: '신뢰 확보형', desc: '수치·후기·인증·전문성을 내세워 신뢰를 먼저 쌓는 카피예요.',    example: '누적 판매 100만 개. / 의사 97%가 권장합니다.' },
          { badge: '정보 전달형', desc: '가치 있는 정보나 사실을 제공해 독자의 관심과 이해를 유도해요.', example: '커피가 집중력을 높이는 이유, 과학이 밝혔습니다.' },
          { badge: '혼합형',      desc: '두 가지 이상의 유형이 결합된 카피예요.',                        example: '97% 만족(신뢰) + 지금 신청하면 무료(행동 유도)' },
        ].map(item => (
          <AccordionItem key={item.badge} badge={item.badge} badgeColor="#FF9F0A" label="" desc={item.desc} example={item.example} />
        ))}
      </Section>

      {/* ── 7. 설득 포인트 ── */}
      <Section title="설득 포인트" sub="카피 분석 — 카피가 자극하는 독자의 욕구와 심리를 분류해요">
        {[
          { badge: '인정 욕구',   desc: '타인에게 인정받고 싶은 심리를 자극해요.' },
          { badge: '성취 욕구',   desc: '목표 달성, 성장, 발전에 대한 기대를 불러일으켜요.' },
          { badge: '소속감',      desc: '"이미 많은 사람이 선택했다"는 메시지와 함께 쓰여요.' },
          { badge: '안전·안정',   desc: '위험이나 손실을 피하고 싶은 심리를 자극해요.' },
          { badge: '편의성',      desc: '"더 쉽게", "더 빠르게"라는 메시지와 연결돼요.' },
          { badge: '경제적 이익', desc: '돈을 아끼거나 더 많이 벌고 싶은 욕구를 자극해요.' },
          { badge: '호기심',      desc: '"왜?", "어떻게?" 형태의 메시지와 연결돼요.' },
          { badge: '자기계발',    desc: '더 나은 자신이 되고 싶은 욕구를 건드려요.' },
          { badge: '희소성',      desc: '지금 안 하면 기회를 잃는다는 심리를 자극해요.' },
          { badge: '쾌락·즐거움', desc: '즐겁고 싶은 감정적 욕구를 자극해요.' },
        ].map(item => (
          <AccordionItem key={item.badge} badge={item.badge} badgeColor="var(--bad)" label="" desc={item.desc} />
        ))}
      </Section>

      {/* ── 8. 카피 기법 ── */}
      <Section title="카피 기법" sub="카피 분석에서 사용된 표현 기술을 분류해요">
        {[
          { badge: '대조',        desc: '상반된 두 가지를 나란히 놓아 메시지를 선명하게 만들어요.',    example: '가볍지만, 강합니다.' },
          { badge: '반복',        desc: '같은 표현이나 리듬을 반복해 독자에게 강하게 각인시켜요.',    example: '믿어라, 도전하라, 이겨라.' },
          { badge: '숫자',        desc: '구체적인 수치를 사용해 신뢰도와 임팩트를 높여요.',          example: '97%가 만족했습니다.' },
          { badge: '질문',        desc: '독자가 스스로 답을 떠올리게 만들어 참여를 유도해요.',       example: '아직도 이 방법을 모르세요?' },
          { badge: '명령',        desc: '직접적인 행동을 요청하는 어조로 즉각적인 반응을 이끌어요.', example: '지금 당장 시작하세요.' },
          { badge: '비유',        desc: '친숙한 것에 빗대어 낯선 개념을 쉽고 인상적으로 전달해요.', example: '이 크림은 피부의 물통 역할을 해요.' },
          { badge: '스토리텔링', desc: '짧은 이야기 형식으로 자연스럽게 메시지를 전달해요.',         example: '그녀는 3번 포기했어요. 4번째에 이걸 바꿨습니다.' },
          { badge: '긴급성',      desc: "'지금이 아니면 안 된다'는 시간 압박으로 즉각 행동을 유도해요.", example: '오늘 자정까지만 할인가 적용됩니다.' },
          { badge: '희소성',      desc: '수량이나 기회의 제한을 강조해 욕구와 결정을 자극해요.',     example: '선착순 100명에게만 제공합니다.' },
          { badge: '공포',        desc: '손실이나 위험에 대한 두려움을 건드려 행동 동기를 만들어요.', example: '보험이 없었다면 어떻게 됐을까요?' },
          { badge: '보상',        desc: '행동에 따르는 혜택이나 결과를 구체적으로 제시해요.',        example: '30일 뒤 달라진 나를 만납니다.' },
          { badge: '사회적 증거', desc: '다수의 선택이나 후기를 내세워 신뢰와 안도감을 줘요.',      example: '전문가 98%가 추천합니다.' },
        ].map(item => (
          <AccordionItem key={item.badge} badge={item.badge} badgeColor="var(--bad)" label="" desc={item.desc} example={item.example} />
        ))}
      </Section>
    </div>
  );
}
