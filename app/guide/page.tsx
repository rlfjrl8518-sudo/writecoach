'use client';
import { useState } from 'react';

/* ── 아코디언 아이템 ── */
function AccordionItem({
  label, badge, badgeColor, desc, example,
}: {
  label: string; badge?: string; badgeColor?: string;
  desc: string; example?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: '1px solid var(--card-border)',
        cursor: 'pointer',
      }}
      onClick={() => setOpen(v => !v)}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0', gap: 12,
      }}>
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
        <span style={{
          flexShrink: 0, fontSize: 12, color: 'var(--dim-star)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>▾</span>
      </div>

      {open && (
        <div style={{ paddingBottom: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--dim-star)', lineHeight: 1.8, margin: '0 0 10px' }}>
            {desc}
          </p>
          {example && (
            <div style={{
              fontSize: 13, color: 'var(--text)',
              background: 'var(--bg-subtle)',
              borderLeft: `3px solid ${badgeColor || 'var(--accent)'}`,
              padding: '10px 14px',
              borderRadius: '0 8px 8px 0',
              lineHeight: 1.8,
            }}>
              {example}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 섹션 ── */
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
      <Section title="점수 항목" sub="AI가 글을 평가하는 9가지 기준">
        <AccordionItem
          badge="표현력" badgeColor="#3182F6"
          label="얼마나 독창적으로 표현했나"
          desc="진부한 표현 대신 신선하고 감각적인 표현을 사용했는지 평가해요. '예쁘다' 대신 '유리처럼 맑다'처럼 구체적이고 생생한 표현이 높은 점수를 받아요."
          example="낮은 예: 바람이 불었다 → 높은 예: 바람이 옷깃을 파고들었다"
        />
        <AccordionItem
          badge="전달력" badgeColor="#3182F6"
          label="읽는 사람에게 잘 전달되나"
          desc="글의 내용이 독자에게 명확하게 전달되는지 평가해요. 두루뭉술하거나 의미가 불분명한 문장이 많으면 점수가 낮아요."
          example="낮은 예: 그것은 어떤 면에서 볼 때 좋은 것 같았다 → 높은 예: 그 결정은 효율적이었다"
        />
        <AccordionItem
          badge="구체성" badgeColor="#3182F6"
          label="추상적이지 않고 구체적인가"
          desc="'많다', '좋다', '나쁘다' 같은 추상어 대신 수치, 색깔, 크기, 감각 등 구체적인 묘사를 사용했는지 봐요."
          example="낮은 예: 음식이 맛있었다 → 높은 예: 간장 향이 나는 국물이 혀 끝에 짭짤하게 닿았다"
        />
        <AccordionItem
          badge="문장다양성" badgeColor="#8B95A1"
          label="문장 길이와 구조가 다양한가"
          desc="짧은 문장과 긴 문장을 적절히 섞어 리듬감을 형성했는지 평가해요. 모든 문장이 같은 길이면 단조롭게 느껴져요."
          example="예) 아무 말도 하지 않았다. 그냥 창문 쪽을 바라보다가, 길게 숨을 내쉬었다."
        />
        <AccordionItem
          badge="카피라이팅적합성" badgeColor="#FF9F0A"
          label="후킹, 설득, 행동 유도 요소"
          desc="카피라이팅·기사 리드 유형에서 중점적으로 평가해요. 첫 문장이 관심을 끄는지, 독자가 행동하게 만드는지를 봐요."
          example="예) '3초 안에 읽히지 않으면 아무도 안 읽는다. 당신의 카피는 어떤가요?'"
        />
        <AccordionItem
          badge="논리성" badgeColor="#22B85A"
          label="주장과 근거가 자연스럽게 연결되나"
          desc="의견문·설명문에서 중요해요. 주장을 먼저 제시하고 근거를 뒷받침하는 구조가 얼마나 자연스럽게 이어지는지 평가해요."
          example="예) '이 방법이 효과적이다. 실제로 3주 만에 30% 향상된 결과가 나왔기 때문이다.'"
        />
        <AccordionItem
          badge="가독성" badgeColor="#22B85A"
          label="읽기 편한 흐름인가"
          desc="문단이 적절히 나뉘어 있는지, 한 문단에 너무 많은 내용이 담기지 않았는지, 리듬감 있게 읽히는지 평가해요."
        />
        <AccordionItem
          badge="구조다양성" badgeColor="#8B95A1"
          label="다양한 문장 구조를 활용했나"
          desc="'주체→행동'만 반복하지 않고, 원인→결과, 감상→설명 등 여러 구조를 혼용했는지 봐요. 아래 '문장 구조 유형' 항목을 참고하세요."
        />
        <AccordionItem
          badge="감각표현다양성" badgeColor="#FF9F0A"
          label="시·청·후·미·촉각을 골고루 쓰나"
          desc="시각 묘사에만 치우치지 않고 5감을 골고루 활용했는지 평가해요. 아래 '감각 표현 가이드' 항목을 참고하세요."
        />
      </Section>

      {/* ── 2. 문장 구조 유형 ── */}
      <Section title="문장 구조 유형" sub="문장이 어떤 논리적 흐름으로 구성됐는지 분류">
        <AccordionItem
          badge="장소→대상" badgeColor="#3182F6"
          label="공간을 먼저 설정하고 대상 등장"
          desc="특정 장소나 배경을 먼저 제시하고, 그 공간에 무엇이 있는지 묘사하는 구조예요."
          example="골목 끝에 낡은 책방이 있었다. / 창가에 먼지 쌓인 화분 하나가 놓여 있었다."
        />
        <AccordionItem
          badge="대상→상태" badgeColor="#3182F6"
          label="대상의 현재 상태를 묘사"
          desc="사물이나 사람을 먼저 등장시키고, 그것의 상태나 모습을 설명하는 구조예요."
          example="그의 손이 미세하게 떨리고 있었다. / 거리는 텅 비어 있었다."
        />
        <AccordionItem
          badge="주체→행동" badgeColor="#3182F6"
          label="누가 무엇을 하는지 직접 서술"
          desc="가장 기본적인 문장 구조예요. 주어가 명확하고 행동이 바로 따라와요. 직관적이지만 반복되면 단조로워질 수 있어요."
          example="아이가 소리쳤다. / 그는 자리에서 일어났다."
        />
        <AccordionItem
          badge="행동→결과" badgeColor="#22B85A"
          label="어떤 행동이 결과를 낳는지"
          desc="행동과 그 결과를 이어서 서술해요. 원인과 결과가 바로 연결되어 장면에 역동성을 줘요."
          example="문을 열자 찬 바람이 밀려왔다. / 버튼을 누르자 화면이 꺼졌다."
        />
        <AccordionItem
          badge="원인→결과" badgeColor="#22B85A"
          label="왜 그런 결과가 생겼는지"
          desc="행동→결과와 비슷하지만, 행동이 아닌 상황·조건이 원인이 돼요."
          example="비가 오래 내려 길이 미끄러웠다. / 잠을 못 자서 눈이 충혈됐다."
        />
        <AccordionItem
          badge="목표→행동" badgeColor="#FF9F0A"
          label="목적을 위해 어떤 행동을 하는지"
          desc="'~하기 위해 ~했다' 형태예요. 목표가 먼저 나와 독자가 의도를 먼저 파악해요."
          example="더 잘 쓰기 위해 매일 한 편씩 읽었다. / 살을 빼려고 엘리베이터 대신 계단을 탔다."
        />
        <AccordionItem
          badge="감상→설명" badgeColor="#FF9F0A"
          label="느낌을 먼저 말하고 이유 설명"
          desc="주관적 감상이나 인상을 먼저 서술하고, 뒤에 그 이유나 상황을 설명하는 구조예요."
          example="이상했다. 사람들이 모두 웃고 있었지만 소리가 없었다. / 불편했다. 아무도 서로를 보지 않았다."
        />
        <AccordionItem
          badge="비교→결론" badgeColor="#8B95A1"
          label="두 가지를 비교해 결론 도출"
          desc="두 상황·대상을 비교하고 차이에서 의미를 끌어내는 구조예요."
          example="어제와 달리 오늘은 발걸음이 가벼웠다. / 처음과 지금을 비교하면 많이 달라졌다는 걸 알 수 있다."
        />
        <AccordionItem
          badge="문제→원인" badgeColor="#F03E3E"
          label="현상을 관찰하고 원인 분석"
          desc="눈에 띄는 문제나 현상을 먼저 제시하고, 그 원인을 설명하는 구조예요."
          example="늦었다. 길이 막혔다. / 발이 아팠다. 신발이 발에 맞지 않았다."
        />
        <AccordionItem
          badge="현상→해석" badgeColor="#F03E3E"
          label="눈에 보이는 것에서 의미 도출"
          desc="관찰한 현상을 그대로 서술하고, 그 뒤에 자신의 해석이나 의미를 더하는 구조예요. 에세이·감상문에서 많이 써요."
          example="모두 고개를 숙이고 있었다. 무언가에 쫓기는 것 같았다. / 그는 한마디도 하지 않았다. 이미 결정한 것이었다."
        />
      </Section>

      {/* ── 3. 감각 표현 가이드 ── */}
      <Section title="감각 표현 가이드" sub="5감을 활용한 묘사로 글에 생동감을 더해요">
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

      {/* ── 4. 글쓰기 유형 ── */}
      <Section title="글쓰기 유형별 목표" sub="유형마다 AI가 중점적으로 평가하는 기준이 달라요">
        {[
          { badge: '묘사문', desc: '장면·인물·사물을 감각적으로 그려요. 표현력과 감각표현다양성이 핵심 평가 기준이에요.' },
          { badge: '설명문', desc: '개념이나 현상을 명확하게 전달해요. 전달력·논리성·구체성이 중요해요.' },
          { badge: '감상문', desc: '경험이나 작품에 대한 느낌을 정리해요. 솔직하고 깊이 있는 감상이 높은 점수를 받아요.' },
          { badge: '의견문', desc: '주장과 근거를 갖춰 설득해요. 논리성과 근거의 구체성이 핵심이에요.' },
          { badge: '기사 리드', desc: '핵심 정보를 5W1H로 첫 단락에 압축해요. 전달력과 카피라이팅적합성이 평가 기준이에요.' },
          { badge: '카피라이팅', desc: '관심을 끌고 행동을 유도하는 짧은 글이에요. 후킹·설득력·행동 유도가 중점 평가 항목이에요.' },
          { badge: '에세이', desc: '경험과 생각을 자유롭게 깊이 있게 서술해요. 표현력과 문장다양성, 논리적 흐름이 중요해요.' },
          { badge: '스토리텔링', desc: '사건·인물·감정이 있는 이야기를 구성해요. 장면 묘사력과 구조의 흐름이 핵심이에요.' },
        ].map(item => (
          <AccordionItem key={item.badge} badge={item.badge} label="" desc={item.desc} />
        ))}
      </Section>

      {/* ── 5. 카피 구조 ── */}
      <Section title="카피 구조 유형" sub="광고 카피가 어떤 설득 패턴을 쓰는지 분류">
        {[
          { badge: '문제→해결', desc: '독자의 고민을 먼저 제시하고 해결책을 제안해요.', example: '잠이 안 와요? 이 베개 하나로 해결했어요.' },
          { badge: '공감→제안', desc: '공감으로 시작해 자연스럽게 제안으로 이어져요.', example: '다이어트, 저도 포기할 뻔했어요. 그런데 이걸 바꿨더니 달랐어요.' },
          { badge: '위험→대비', desc: '위험이나 손실을 경고하고 대비책을 제시해요.', example: '보험 없이 사고가 나면 어떻게 될까요?' },
          { badge: '숫자→혜택', desc: '구체적인 수치로 신뢰성을 높이고 혜택을 강조해요.', example: '97%가 효과를 봤습니다. 3일 안에 결과를 확인하세요.' },
          { badge: '호기심→정보', desc: '궁금증을 먼저 유발하고 정보로 해소해요.', example: '아이폰이 유독 반응이 빠른 이유가 있었습니다.' },
          { badge: '질문→답변', desc: '독자가 가질 법한 질문을 먼저 던지고 답해요.', example: '왜 비쌀수록 오래 쓸까요? 재료가 다릅니다.' },
          { badge: '증거→결론', desc: '데이터나 사례를 먼저 제시하고 결론을 내려요.', example: '1만 명이 선택했습니다. 이유가 있었습니다.' },
          { badge: '반전→메시지', desc: '기대를 뒤엎어 강한 인상을 줘요.', example: '더 열심히 공부하지 마세요. 방법을 바꾸세요.' },
          { badge: '스토리→교훈', desc: '짧은 이야기로 메시지를 자연스럽게 전달해요.', example: '그는 3번 실패했어요. 4번째에 이 방법을 썼습니다.' },
          { badge: '행동→보상', desc: '구체적인 행동을 유도하고 그 보상을 제시해요.', example: '지금 신청하면 첫 달 무료로 써볼 수 있어요.' },
        ].map(item => (
          <AccordionItem key={item.badge} badge={item.badge} badgeColor="#FF9F0A" label="" desc={item.desc} example={item.example} />
        ))}
      </Section>
    </div>
  );
}
