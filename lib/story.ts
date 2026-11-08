/* ═══════════════════════════════════════════════════════════════
   장기 이야기 — 『백지첩』의 바깥 줄기
   ───────────────────────────────────────────────────────────────
   두 축이 겹친다.
   ① 백지첩 24수(lib/curriculum.ts) — 실력의 축. 장마다 요괴를 놓아 보낸다.
   ② 묵당의 기억(여기) — 관계의 축. 수련한 날 수가 쌓이면 한 조각씩 열린다(1일~365일).
      조각마다 서재에 물건이 하나 놓인다. 서재가 곧 '내가 쓴 날들의 기록'이 된다.
   그리고 실제 달력을 따르는 24절기 — 매 절기 묵당의 한마디와 그 절기의 글감.

   큰 줄거리: 30년 전 묵당은 제자 서하와 함께 백지첩을 썼다. 서하의 첫 원고에
   "완벽하지 않으면 내놓지 마라"라고 한 날 서하는 산을 내려갔고, 그 말이 묵당 자신의
   펜까지 묶어 백지귀가 되었다. 제자(나)가 매일 쓰는 동안 묵당은 뜯지 않은 편지를 열고,
   다시 쓰기 시작하고, 서하가 산에 오른다. 1년째 되는 날, 비어 있던 스물다섯 번째 수를
   묵당이 제자에게 건넨다 — "그 장은 자네가 쓰게."
═══════════════════════════════════════════════════════════════ */
import type { Line } from './curriculum';

/* ── 서재의 물건 ── */
export interface StudyObject { id: string; name: string; note: string }
export const OBJECTS: Record<string, StudyObject> = {
  inkstone: { id: 'inkstone', name: '묵당의 벼루', note: '첫날 받은 벼루. 가운데가 손가락 모양으로 닳았다.' },
  teacup: { id: 'teacup', name: '청자 찻잔', note: '사흘째부터 내 몫으로 나온 찻잔.' },
  cat: { id: 'cat', name: '먹물', note: '서재에 드나드는 고양이. 사흘 연속 오면 마루에서 잔다.' },
  radio: { id: 'radio', name: '나무 라디오', note: '신문사 시절 원고를 쓸 때 늘 켜 두던 라디오.' },
  brushes: { id: 'brushes', name: '붓 네 자루', note: '한 자루는 묵당의 손에 맞지 않는다. 서하의 붓.' },
  bookstack: { id: 'bookstack', name: '실로 맨 책', note: '백지첩의 초고. 예문은 서하의 글씨였다.' },
  plant: { id: 'plant', name: '난초 화분', note: '한 달을 물 줘야 겨우 마음을 여는 꽃.' },
  scroll: { id: 'scroll', name: '산수 족자', note: '묵당이 붓을 놓기 전 마지막으로 그린 그림.' },
  letters: { id: 'letters', name: '붉은 실로 묶은 편지', note: '스무 해 동안 뜯지 않은 편지 한 다발.' },
  windbell: { id: 'windbell', name: '풍경', note: '바닷가 책방 처마에 달려 있던 것과 같은 풍경.' },
  lantern: { id: 'lantern', name: '한지 등', note: '답장을 쓰던 밤에 켠 등. 그 뒤로 끄지 않았다.' },
  persimmon: { id: 'persimmon', name: '감 세 알', note: '새벽 수련을 같이 하자며 묵당이 깎아 둔 감.' },
  plum: { id: 'plum', name: '매화 한 가지', note: '서하가 산을 오르며 꺾어 온 매화.' },
};

/* ── 묵당의 기억 ── */
export interface Memory { id: string; day: number; title: string; obj?: string; bg?: string; lines: Line[] }
export const MEMORIES: Memory[] = [
  { id: 'm01', day: 1, title: '먹 냄새', obj: 'inkstone', lines: [
    { who: 'muk', text: '첫날인데 끝까지 썼군. 그게 제일 어려운 일이야.', emo: 'happy' },
    { who: 'muk', text: '이 벼루를 쓰게. 내가 서른 해 넘게 먹을 간 놈이지. 가운데가 손가락 모양으로 패였을 걸세.' },
    { who: 'muk', text: '먹은 천천히 갈아야 해. 서두르면 거칠어져. 글도 마찬가지고.', emo: 'think' },
  ] },
  { id: 'm02', day: 3, title: '사흘', obj: 'teacup', lines: [
    { who: 'muk', text: '사흘을 왔군. 사흘 오면 손님이고, 나흘째부터는 식구라더군.' },
    { who: 'muk', text: '그래서 찻잔을 하나 꺼냈지. 이제 이건 자네 잔이다.', emo: 'happy' },
  ] },
  { id: 'm03', day: 5, title: '마루 밑 손님', obj: 'cat', lines: [
    { who: 'narr', text: '마루 밑에서 먹물을 뒤집어쓴 듯한 고양이 한 마리가 기어 나왔다.' },
    { who: 'muk', text: '먹물이라 부른다. 내 벼루에 발을 담갔다가 붙은 이름이지.', emo: 'happy' },
    { who: 'muk', text: '저놈은 사람을 가려. 자주 오는 사람 곁에서만 자거든. 자네가 매일 오면 알게 될 걸세.' },
  ] },
  { id: 'm04', day: 7, title: '신문사 시절', obj: 'radio', bg: 'mem_city', lines: [
    { who: 'muk', text: '일주일이군. 오늘은 내 얘기를 좀 하지.', emo: 'think' },
    { who: 'muk', text: '나는 스무 해 동안 신문에 칼럼을 썼다. 매주 화요일 마감, 원고지 열두 장.' },
    { who: 'muk', text: '쓰고 싶은 날도, 쓰기 싫은 날도 화요일은 왔어. 그때 배웠지. 글은 기분이 아니라 약속으로 쓰는 거라고.' },
    { who: 'muk', text: '저 라디오는 그때부터 켜 두던 걸세. 조용하면 오히려 안 써지더군.', emo: 'happy' },
  ] },
  { id: 'm05', day: 14, title: '한 자루 남는 붓', obj: 'brushes', lines: [
    { who: 'narr', text: '붓걸이에 붓이 네 자루. 묵당은 늘 세 자루만 쓴다.' },
    { who: 'muk', text: '…그건 눈치챘나.', emo: 'sad' },
    { who: 'muk', text: '자네 전에도 제자가 하나 있었다. 서하라고. 그 붓은 그 아이 손에 맞춰 깎은 걸세.' },
    { who: 'muk', text: '오늘은 여기까지 하지. 먹이 마르겠어.' },
  ] },
  { id: 'm06', day: 21, title: '같이 쓴 책', obj: 'bookstack', bg: 'mem_together', lines: [
    { who: 'muk', text: '백지첩은 나 혼자 쓴 책이 아니야.', emo: 'think' },
    { who: 'muk', text: '기법은 내가 적고, 예문은 서하가 썼지. 그 아이 문장은 늘 나보다 반 박자 빨랐어.' },
    { who: 'muk', text: '봄이면 이 마루에 앉아 하루에 한 수씩 썼지. 지금 자네와 내가 하는 것처럼.', emo: 'happy' },
  ] },
  { id: 'm07', day: 30, title: '난초', obj: 'plant', lines: [
    { who: 'muk', text: '한 달일세. 난초는 한 달은 물을 줘야 겨우 뿌리를 내린다더군.' },
    { who: 'muk', text: '자네 문장도 그래. 처음 왔을 때와 비교해 보게. 문장 끝이 단단해졌어.', emo: 'happy' },
    { who: 'muk', text: '다음 달엔 조금 더 무거운 이야기를 해야겠군.', emo: 'think' },
  ] },
  { id: 'm08', day: 40, title: '빗길', bg: 'mem_leave', lines: [
    { who: 'muk', text: '서하가 첫 원고를 들고 왔던 날도 비가 왔다.', emo: 'sad' },
    { who: 'muk', text: '나는 반쯤 읽고 원고를 덮었어. 그리고 말했지. "완벽하지 않으면 세상에 내놓지 마라."' },
    { who: 'muk', text: '그 아이는 아무 말 없이 원고를 품에 안고 빗속으로 내려갔다. 우산을 접은 채로.' },
    { who: 'muk', text: '…좋은 원고였어. 그 말을 하는 데 서른 해가 걸렸군.', emo: 'sad' },
  ] },
  { id: 'm09', day: 50, title: '그 말', obj: 'scroll', lines: [
    { who: 'muk', text: '자네가 마지막 장에서 만날 놈 말일세. 백지귀.', emo: 'think' },
    { who: 'muk', text: '그놈이 무슨 말을 하는지 아나? "조금 더 준비되면 써." "부끄럽지 않나?"' },
    { who: 'muk', text: '내가 서하에게 한 말이야. 그 말이 그 아이를 떠나보내고, 돌아와서 내 펜까지 묶었지.' },
    { who: 'muk', text: '저 족자가 내가 붓을 놓기 전 마지막 그림일세. 끝을 못 봐서 여백이 저렇게 크지.', emo: 'sad' },
  ] },
  { id: 'm10', day: 60, title: '뜯지 않은 편지', obj: 'letters', bg: 'mem_letter', lines: [
    { who: 'narr', text: '책장 맨 아래 칸, 붉은 실로 묶은 편지 한 다발이 먼지를 쓰고 있다.' },
    { who: 'muk', text: '서하가 보낸 걸세. 떠나고 십 년쯤 지나서 오기 시작했지.' },
    { who: 'muk', text: '한 통도 안 뜯었다. 뭐라고 썼을지 무서워서.', emo: 'sad' },
    { who: 'muk', text: '…자네가 두 달을 매일 썼군. 나도 무언가 하나는 해야겠지.', emo: 'think' },
  ] },
  { id: 'm11', day: 75, title: '바닷가 책방', obj: 'windbell', bg: 'mem_sea', lines: [
    { who: 'narr', text: '묵당이 붉은 실을 풀었다. 편지 첫 장을 자네에게 내밀며, 읽어 달라고 했다.' },
    { who: 'narr', text: '"선생님. 바닷가 마을에 작은 책방을 열었습니다. 아이들에게 읽어 줄 이야기를 씁니다. 완벽하지 않은 글로요."' },
    { who: 'narr', text: '"그래도 매일 씁니다. 화요일 마감처럼요. 선생님이 가르쳐 주신 대로."' },
    { who: 'muk', text: '……그 아이가 멈추지 않았군. 나만 멈췄던 거야.', emo: 'sad' },
  ] },
  { id: 'm12', day: 90, title: '답장', obj: 'lantern', lines: [
    { who: 'muk', text: '답장을 쓰려고 붓을 들었는데, 첫 문장이 안 나오는군.', emo: 'think' },
    { who: 'muk', text: '서른 해 동안 남의 글만 고쳤더니 내 글 첫 줄이 이렇게 무겁군.' },
    { who: 'me', text: '선생님이 가르쳐 주셨잖아요. 해석 말고 사실부터 쓰라고.' },
    { who: 'muk', text: '…허허. 그렇지. "여기는 아직 비가 오면 지붕 귀퉁이가 샌다." 이걸로 시작하지.', emo: 'happy' },
  ] },
  { id: 'm13', day: 105, title: '새벽 수련', obj: 'persimmon', bg: 'mem_dawn', lines: [
    { who: 'muk', text: '요즘은 나도 새벽에 한 장씩 쓴다. 자네 몰래 하려 했는데 먹 냄새가 나서 들켰겠지.', emo: 'happy' },
    { who: 'muk', text: '감을 깎아 두었다. 내일부터는 같이 쓰세. 스승과 제자가 아니라, 같은 책상의 두 사람으로.' },
  ] },
  { id: 'm14', day: 120, title: '산을 오르는 사람', obj: 'plum', lines: [
    { who: 'narr', text: '안개가 걷힌 산길로 누군가 올라온다. 회색 단발, 그림책이 가득한 천 가방, 손에는 매화 한 가지.' },
    { who: 'seoha', text: '선생님. 답장 받고 바로 왔어요. 지붕은 아직도 새나요?', emo: 'happy' },
    { who: 'muk', text: '…새지. 아주 잘 새.', emo: 'happy' },
    { who: 'seoha', text: '네가 새 제자구나. 선생님한테 붓을 다시 쥐여 준 사람.' },
  ] },
  { id: 'm15', day: 150, title: '두 사람의 서재', lines: [
    { who: 'seoha', text: '선생님이 젊을 땐 어땠는지 알려 줄까? 원고를 하도 고쳐서 원고지에 구멍이 났었어.', emo: 'happy' },
    { who: 'muk', text: '쓸데없는 소리.', emo: 'angry' },
    { who: 'seoha', text: '그런데 그 구멍 난 원고가 제일 좋았어. 고친 자리가 다 보여서.' },
    { who: 'seoha', text: '너도 지운 자리를 부끄러워하지 마. 그게 네가 생각한 흔적이니까.' },
  ] },
  { id: 'm16', day: 180, title: '반년', lines: [
    { who: 'muk', text: '반년일세. 처음 자네가 문을 두드린 날, 창밖이 하얬던 걸 기억하나.', emo: 'think' },
    { who: 'muk', text: '지금은 마을 지붕이 다 보인다. 아랫마을 사람들이 요즘 일기를 쓴다더군. 안개가 걷히니 쓸 게 생긴 거지.' },
    { who: 'seoha', text: '책방에 그 얘기를 써서 보냈어요. 아이들이 "안개 걷는 사람" 이야기를 좋아해요.', emo: 'happy' },
  ] },
  { id: 'm17', day: 210, title: '빈 장', lines: [
    { who: 'muk', text: '자네에게 말 안 한 게 하나 있다.', emo: 'think' },
    { who: 'muk', text: '백지첩은 스물네 수가 아니야. 맨 끝에 한 장이 더 있지. 처음부터 비워 둔 장.' },
    { who: 'muk', text: '서하와 둘이서, 이 장은 언젠가 올 제자가 쓰게 하자고 했었지.' },
  ] },
  { id: 'm18', day: 240, title: '서하의 부탁', lines: [
    { who: 'seoha', text: '부탁이 있어. 우리 책방 아이들한테 읽어 줄 이야기 하나만 써 줄래?' },
    { who: 'seoha', text: '길 필요 없어. 네가 이 산에서 본 것 중 하나를, 본 그대로.' },
    { who: 'muk', text: '사실과 해석 가르기부터 하게. 첫 수일세.', emo: 'happy' },
  ] },
  { id: 'm19', day: 300, title: '서른 해 만의 원고', lines: [
    { who: 'narr', text: '묵당이 원고지 열두 장을 자네 앞에 내려놓았다. 화요일이었다.' },
    { who: 'muk', text: '서른 해 만에 끝낸 글일세. 제목은 「끝낸 글은 지워지지 않는다」.', emo: 'happy' },
    { who: 'muk', text: '고칠 데가 많아. 그래도 끝냈다. 읽어 주겠나, 첫 독자로.' },
  ] },
  { id: 'm20', day: 365, title: '붓을 건네다', bg: 'mem_brush', lines: [
    { who: 'narr', text: '일 년. 서재 창밖으로 다시 그 계절이 돌아왔다.' },
    { who: 'muk', text: '자네가 처음 온 날을 기억한다. 안개 속에서 길을 잃었다고 했지.', emo: 'think' },
    { who: 'muk', text: '자네는 매일 와서 한 장씩 썼고, 그 장들이 내 서재를 다시 채웠다. 나도, 서하도, 아랫마을도.' },
    { who: 'muk', text: '스물다섯 번째 수는 내가 가르칠 수 없다. 이 붓을 받게. 그 장은 자네가 쓰게.', emo: 'happy' },
    { who: 'muk', text: '…그리고 내일도 오게. 책은 끝나도 글은 안 끝나니까.' },
  ] },
];
export const memoryOf = (id: string) => MEMORIES.find(m => m.id === id);
export const unlockedMemories = (practiceDayCount: number) => MEMORIES.filter(m => m.day <= practiceDayCount);
export const nextMemory = (practiceDayCount: number) => MEMORIES.find(m => m.day > practiceDayCount) ?? null;
/** 서재에 놓인 물건 (기억이 열린 순서) */
export const studyObjects = (practiceDayCount: number) =>
  unlockedMemories(practiceDayCount).filter(m => m.obj).map(m => OBJECTS[m.obj!]);

/* ── 계절과 시간 (실제 시계) ── */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeOfDay = 'day' | 'dusk' | 'night';
export function seasonOf(d = new Date()): Season {
  const m = d.getMonth() + 1;
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}
export function timeOf(d = new Date()): TimeOfDay {
  const h = d.getHours();
  return h >= 5 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'dusk' : 'night';
}
export const studyBg = (d = new Date()) => `study_${seasonOf(d)}_${timeOf(d)}`;
export const SEASON_NAME: Record<Season, string> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };

/* ── 24절기 (양력 근삿값) — 매 절기 묵당의 한마디와 글감 ── */
export interface SolarTerm { name: string; m: number; d: number; line: string; prompt: string }
export const SOLAR_TERMS: SolarTerm[] = [
  { name: '소한', m: 1, d: 5, line: '소한이 대한 집에 놀러 갔다가 얼어 죽었다지. 대한보다 추운 날일세.', prompt: '올겨울 가장 추웠던 순간을 온도 말고 몸의 감각으로' },
  { name: '대한', m: 1, d: 20, line: '추위의 끝이야. 끝이 보이면 사람은 조금 더 버티지.', prompt: '끝이 보여서 버틸 수 있었던 일 하나' },
  { name: '입춘', m: 2, d: 4, line: '입춘일세. 아직 춥지만 이름부터 봄이 왔다. 이름이 먼저 오는 것들이 있어.', prompt: '아직 오지 않았지만 이미 이름을 붙여 둔 것' },
  { name: '우수', m: 2, d: 19, line: '눈이 비로 바뀌는 때야. 소리가 달라졌지. 들리나?', prompt: '창밖 소리 세 가지를 받아 적기' },
  { name: '경칩', m: 3, d: 5, line: '개구리가 깨는 날일세. 자네 안에서 겨우내 자던 문장 하나를 깨워 보게.', prompt: '겨우내 미뤄 둔 일 하나와 그걸 다시 시작할 첫 행동' },
  { name: '춘분', m: 3, d: 20, line: '낮과 밤이 같은 날. 오늘은 좋았던 것과 아쉬운 것을 하나씩 같은 무게로 써 보게.', prompt: '이번 주에 좋았던 일과 아쉬운 일, 같은 길이로' },
  { name: '청명', m: 4, d: 5, line: '하늘이 맑아지는 때야. 흐릿한 말을 하나 골라 맑게 닦아 보세.', prompt: '요즘 자주 쓰는 흐릿한 말 하나를 구체적인 장면으로' },
  { name: '곡우', m: 4, d: 20, line: '봄비가 곡식을 깨우지. 오늘 비 냄새를 맡아 두게. 언젠가 쓸 데가 있어.', prompt: '비 오기 직전의 냄새와 공기를' },
  { name: '입하', m: 5, d: 5, line: '여름 문턱일세. 나무 색이 연두에서 초록으로 넘어가는 걸 봐 두게.', prompt: '오늘 본 초록 세 가지를 서로 다르게' },
  { name: '소만', m: 5, d: 21, line: '조금씩 차오르는 때야. 자네 글도 요즘 조금씩 차오르고 있더군.', prompt: '요즘 조금씩 늘고 있는 것 하나' },
  { name: '망종', m: 6, d: 6, line: '씨 뿌리는 철이지. 오늘 쓴 한 줄이 가을에 한 편이 된다.', prompt: '언젠가 길게 쓰고 싶은 이야기의 첫 줄' },
  { name: '하지', m: 6, d: 21, line: '해가 가장 긴 날일세. 긴 날일수록 짧게 쓰는 연습을 하세.', prompt: '오늘 하루를 세 문장으로' },
  { name: '소서', m: 7, d: 7, line: '더위가 시작된다. 덥다고 쓰지 말고 더위가 한 일을 쓰게.', prompt: '더위가 사람이나 사물에게 한 일' },
  { name: '대서', m: 7, d: 22, line: '가장 더운 때야. 이런 날은 먹도 빨리 마르지. 짧게, 빨리.', prompt: '지금 이 순간을 10분 안에' },
  { name: '입추', m: 8, d: 7, line: '가을이 이름을 내밀었군. 아직 덥지만 저녁 바람이 달라졌을 걸세.', prompt: '계절이 바뀌고 있다는 작은 증거 하나' },
  { name: '처서', m: 8, d: 23, line: '모기 입이 비뚤어진다는 처서일세. 여름이 물러나는 소리를 들어 보게.', prompt: '이번 여름에 남기고 싶은 장면 하나' },
  { name: '백로', m: 9, d: 7, line: '이슬이 하얗게 맺히는 때야. 아침 일찍 풀잎을 봐 두게.', prompt: '아침에 가장 먼저 본 것을 클로즈업으로' },
  { name: '추분', m: 9, d: 23, line: '다시 낮과 밤이 같아졌다. 봄의 자네와 지금의 자네를 나란히 놓아 보게.', prompt: '반년 전의 나에게 쓰는 짧은 편지' },
  { name: '한로', m: 10, d: 8, line: '찬 이슬이 내린다. 차를 한 잔 더 우리지.', prompt: '요즘 마시는 것 하나와 그것을 마시는 시간' },
  { name: '상강', m: 10, d: 23, line: '서리가 내리는 때야. 단풍은 지금이 가장 짙지. 끝에 가까울수록 색이 진해지는 법일세.', prompt: '끝나 가고 있어서 더 소중한 것 하나' },
  { name: '입동', m: 11, d: 7, line: '겨울 문턱이다. 김장하는 집 마당 냄새가 산까지 올라와.', prompt: '겨울을 준비하는 누군가의 손을 묘사하기' },
  { name: '소설', m: 11, d: 22, line: '첫눈이 올 수도 있는 때야. 첫눈은 늘 예고 없이 오지. 좋은 문장처럼.', prompt: '예고 없이 찾아온 좋은 일 하나' },
  { name: '대설', m: 12, d: 7, line: '눈이 많이 오는 때일세. 하얀 걸 보면 백지가 생각나지. 이제 무섭지 않나?', prompt: '빈 종이 앞에서 나는 어떤 사람인가' },
  { name: '동지', m: 12, d: 21, line: '밤이 가장 긴 날이야. 팥죽 한 그릇 하고, 올해 쓴 글 중 하나를 다시 읽어 보게.', prompt: '올해 쓴 글 하나를 다시 읽고 고쳐 쓰기' },
];
/** 오늘이 속한 절기 (가장 최근에 시작된 절기) */
export function currentTerm(d = new Date()): SolarTerm & { year: number } {
  const y = d.getFullYear();
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  const sorted = [...SOLAR_TERMS].sort((a, b) => a.m * 100 + a.d - (b.m * 100 + b.d));
  let t = sorted[sorted.length - 1]; let year = y - 1;
  for (const s of sorted) if (s.m * 100 + s.d <= md) { t = s; year = y; }
  return { ...t, year };
}

/* ── 하루치 운(運) — 같은 날엔 같은 결과 (기기 간 일치) ── */
export function dayRand(key: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
