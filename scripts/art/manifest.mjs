/* 『백지첩』 그림 목록 — node scripts/art/generate.mjs [id 접두어...]
   kind: bg(불투명 배경) · char(인물, 배경 제거) · obj(소품·요괴, 배경 제거)
   ref: 먼저 만든 그림을 참고해 같은 인물/같은 방으로 편집 (일관성)
*/
export const STYLE = 'Hand-painted 2D animated feature film art, soft watercolor and gouache on textured paper, warm natural light, gentle muted palette of ink black, rice-paper cream, moss green, indigo and faded vermilion, visible brush texture, nostalgic, calm and cozy. No text, no letters, no calligraphy characters, no watermark, no signature.';
const CUT = 'Isolated on a completely flat, plain pure white background (#FFFFFF), no floor, no cast shadow, no vignette, nothing else in the frame.';
const SAME_CHAR = 'Keep exactly the same character design as the reference image: same face, hairstyle, age, clothing, colors and art style.';

const ROOM = 'Interior of an old Korean hanok writing study on a misty mountain ridge: a low dark-wood desk in the center with an ink stone, a brush cup, a blank sheet of paper and a stack of bound books; paper sliding doors wide open in the back wall showing pine trees and a distant mountain; tall wooden bookshelves full of bound books on both sides; a small oil lamp on a side stool at the right; warm wooden floor. Symmetric wide shot, eye level, generous empty floor space in front of the desk on the left and right for characters to stand.';
const SEASONS = {
  spring: 'spring: blossoming cherry and azalea on the hills outside, fresh green, petals drifting',
  summer: 'summer: lush deep green forest outside, cicada-season haze, a bamboo blind half rolled',
  autumn: 'autumn: maple and ginkgo trees in red and gold outside, a few dry leaves on the floor',
  winter: 'winter: snow on the pine branches and the far mountain outside, a brazier with embers in the room',
};
const TIMES = {
  day: 'bright soft morning light streaming in',
  dusk: 'golden sunset light, long warm shadows, the lamp is lit',
  night: 'deep blue night, moon and stars outside, the room lit only by the warm glow of the oil lamp',
};

const BG = 'Full-bleed painting that fills the whole frame edge to edge, no border, no frame, no paper margin.';
const A = [];
const add = (id, kind, ratio, prompt, extra = {}) => A.push({ id, kind, ratio, prompt: kind === 'bg' ? `${prompt}
${BG}` : prompt, ...extra });

/* ── 서재: 계절 × 시간 (실제 날짜·시각을 따른다) ── */
add('study_base', 'bg', '16:9', `${STYLE}\n${ROOM}\nLate spring afternoon light.`, { seed: 'study.png' });
for (const [s, sd] of Object.entries(SEASONS)) for (const [t, td] of Object.entries(TIMES))
  add(`study_${s}_${t}`, 'bg', '16:9', `${STYLE}\nRepaint the reference image as the same room with the same layout, furniture and camera angle. Change only the season and the light. Season — ${sd}. Light — ${td}.`, { ref: 'study_base' });

/* ── 인물: 묵당 ── */
const EMO = {
  happy: 'a warm, proud smile with crinkled eyes',
  sad: 'a quiet, wistful sad expression, eyes lowered',
  angry: 'a stern, strict frown, one eyebrow raised, lips pressed',
  think: 'a thoughtful look, one hand stroking the beard or chin, eyes looking aside',
};
add('muk', 'char', '3:4', `${STYLE}\n${SAME_CHAR}\nFull-body standing pose with the whole figure visible from head to feet with a small margin, facing three-quarters to the viewer's right, calm neutral expression, holding a worn leather notebook. ${CUT}`, { seed: 'mukdang.png' });
for (const [e, d] of Object.entries(EMO)) add(`muk_${e}`, 'char', '3:4', `${STYLE}\n${SAME_CHAR}\nSame full-body standing pose and framing as the reference. Change only the facial expression and a small natural gesture: ${d}. ${CUT}`, { ref: 'muk' });

/* ── 인물: 제자 (두 가지 모습 중 고른다) ── */
const ME = {
  a: 'a young Korean man in his twenties, short tousled black hair, curious and slightly nervous eyes',
  b: 'a young Korean woman in her twenties, black hair tied in a low ponytail with a few loose strands, curious and bright eyes',
};
for (const [k, d] of Object.entries(ME)) {
  add(`me_${k}`, 'char', '3:4', `${STYLE}\nCharacter design: ${d}. Wearing a simple sage-green linen jacket over an off-white shirt, dark indigo trousers, a brown canvas satchel across the body, holding a brush pen and a small open notebook. Full-body standing pose with the whole figure visible from head to feet with a small margin, facing three-quarters to the viewer's left, gentle neutral expression. ${CUT}`, k === 'a' ? { seed: 'disciple.png' } : {});
  for (const [e, ed] of Object.entries(EMO)) add(`me_${k}_${e}`, 'char', '3:4', `${STYLE}\n${SAME_CHAR}\nSame full-body standing pose and framing as the reference. Change only the facial expression and a small natural gesture: ${ed.replace('stroking the beard or chin', 'touching the chin')}. ${CUT}`, { ref: `me_${k}` });
}

/* ── 요괴 6 (장마다 하나, 글의 약점이 몸이 된 것) ── */
const BOSS = {
  durumung: 'a round, fluffy spirit made of vague swirling white-green mist with two small glowing amber eyes and blurry edges, mischievous, scattered blank pages around it',
  ppeonhan: 'a plump grey parrot spirit made of crumpled newspaper and stock phrases (no readable text), beak open mid-squawk, wearing a tiny paper crown, comical',
  heurisi: 'a sleepy, translucent jellyfish-like ghost of washed-out ink, drooping half-closed eyes, its body fading into a smudge, slow and drowsy',
  neureoji: 'a long, coiling serpent made of endless unrolled scroll paper and ribbons, lazily looping around itself many times, a smug little face',
  eotbagi: 'a tangled creature made of knotted red and indigo threads like a ball of yarn with spindly legs and confused crossed eyes, threads snarled every direction',
  baekjigwi: 'an imposing but elegant demon made of pure blank white paper sheets folded like layered robes and a mask with no face, cold pale-blue glow, silent and pressing, paper sheets fluttering around it like wings',
};
for (const [k, d] of Object.entries(BOSS)) add(`boss_${k}`, 'obj', '1:1', `${STYLE}\nCreature design for a cozy fantasy game, whimsical rather than scary: ${d}. Full body, centered. ${CUT}`);

/* ── 이야기 장면 (풀스크린 CG) ── */
const CG = {
  prologue: 'A lone traveler with a satchel walking up a steep stone path on a mountain ridge through thick white fog at dusk; at the top, a small hanok study with warm lit paper windows glows through the fog. Wide cinematic shot.',
  ch1: 'A small mountain village market street half swallowed by white fog: stalls and people near the camera are crisp and colorful, but further away everything fades into blank white paper-like mist. Morning.',
  ch2: 'A village square where people stand stiffly, their faces softly blurred and identical, a grey parrot spirit perched on a signpost; a single child in the foreground is vividly painted and laughing. Overcast day.',
  ch3: 'A quiet village riverside where everything is still and washed-out like faded ink, laundry hanging motionless, a boat drifting; a gust of wind just starting to move the reeds. Afternoon.',
  ch4: 'A village lane overgrown with endless unrolled paper ribbons tangled on fences, roofs and trees like vines; a gardener with shears cutting a clear path. Late afternoon.',
  ch5: 'A crossroads at the foot of the mountain where red and indigo threads are snarled between signposts and lanterns, paths knotted together; one clear stone path leading up the mountain. Dusk.',
  ch6: 'The mountain study at night under a vast starry sky, the fog circling below like a sea, a tall figure of white paper sheets standing at the edge of the light from the open door. Dramatic but beautiful.',
  epilogue: 'Panoramic view from the mountain study at sunrise: the fog has completely cleared, revealing a colorful village with rooftops, rice fields, a river and people going about their morning. Two figures, an old master and a young apprentice, seen small from behind on the veranda.',
  win: 'Countless sheets of paper flying up into a clear sky like a flock of white birds over a mountain village, sunlight breaking through clouds. Joyful, cathartic.',
};
for (const [k, d] of Object.entries(CG)) add(`cg_${k}`, 'bg', '16:9', `${STYLE}\n${d}`);

/* ── 산마루 지도 (세로) ── */
add('map', 'bg', '9:16', `${STYLE}\nA vertical illustrated map painting of a mountain seen from the side, like a picture-book map: a winding stone path climbs from a misty village at the bottom, through six distinct zones (a market street, a village square, a riverside with reeds, a lane of gardens, a crossroads with lanterns, and a pine ridge), to a small hanok study at the summit under the sky. Soft fog patches between the zones. No text, no labels.`);

/* ── 서재 소품 (모으는 물건) ── */
const OBJ = {
  cat: 'a small fluffy black-and-white cat with an ink-spot pattern, sitting curled with its tail around its paws, sleepy content face',
  cat_sleep: 'the same small black-and-white ink-spotted cat curled up asleep in a round ball',
  teacup: 'a celadon tea cup with steam rising, on a small wooden saucer',
  plant: 'a small orchid in a blue-and-white porcelain pot',
  scroll: 'a hanging scroll painting of a misty mountain landscape (no writing) on a wooden rod',
  windbell: 'a small bronze wind bell (punggyeong) with a fish-shaped clapper hanging from a string',
  inkstone: 'a fine carved ink stone with an ink stick resting on it, a few drops of black ink',
  lantern: 'a paper lantern glowing warm orange, hanji paper with a wooden frame',
  letters: 'a small bundle of old letters tied with red thread',
  persimmon: 'three ripe orange persimmons on a small dish',
  bookstack: 'a neat stack of five hand-bound books with thread bindings',
  brushes: 'a bamboo brush stand holding four calligraphy brushes of different sizes',
  plum: 'a single branch of white plum blossoms in a slender vase',
  radio: 'a small old wooden radio with a fabric speaker',
};
for (const [k, d] of Object.entries(OBJ)) add(`obj_${k}`, 'obj', '1:1', `${STYLE}\nA single object for a cozy game inventory: ${d}. Centered, three-quarter view. ${CUT}`);

/* ── 서하: 묵당의 옛 제자 (기억 조각 120일째에 찾아온다) ── */
add('seoha', 'char', '3:4', `${STYLE}\nCharacter design: a Korean woman in her early fifties, short graying bob haircut, gentle but guarded eyes, small laugh lines, wearing a long oatmeal knit cardigan over a navy dress, a canvas tote bag full of picture books, holding a straw hat. Full-body standing pose with the whole figure visible from head to feet with a small margin, facing three-quarters to the viewer's left, calm neutral expression. ${CUT}`);
for (const e of ['happy', 'sad']) add(`seoha_${e}`, 'char', '3:4', `${STYLE}\n${SAME_CHAR}\nSame full-body standing pose and framing as the reference. Change only the facial expression and a small natural gesture: ${EMO[e]}. ${CUT}`, { ref: 'seoha' });

/* ── 묵당의 기억 (정이 깊어질 때마다 열리는 장면) ── */
const MEM = {
  city: 'Thirty years ago in a busy 1990s Seoul newspaper office at night: a middle-aged man with black hair and round glasses (a younger version of an old master writer) typing a column on a typewriter amid stacks of paper, cigarette smoke, desk lamps.',
  together: 'Thirty years ago in a hanok mountain study: a middle-aged writer with round glasses and a bright young woman in her twenties with a short bob sit side by side at a low desk writing in the same hand-bound book, laughing, afternoon light, cherry blossoms outside.',
  leave: 'A young woman with a short bob walking away down a steep stone mountain path in heavy rain holding a closed umbrella, a manuscript clutched to her chest, seen from behind; a figure stands in the lit doorway of a hanok study above.',
  letter: 'An unopened old envelope with a faded postage stamp lying on a dark wooden desk next to an oil lamp and an ink stone at night, dust on it, quiet and heavy mood. No readable writing.',
  sea: 'A tiny bookstore in a seaside fishing village at sunset, its wooden door open, picture books displayed in the window, a woman in her fifties with a short graying bob reading to two children on the step.',
  dawn: 'Dawn in the hanok mountain study: an old master writer with a white beard and round glasses and a young apprentice in a sage-green jacket sitting side by side at the low desk, both writing, steam rising from two tea cups, first sunlight through the paper doors.',
  brush: 'Close-up of an old wrinkled hand with ink-stained fingers handing a calligraphy brush to a young hand, over an open hand-bound book whose pages are filled with soft ink marks (no readable writing), warm lamplight.',
};
for (const [k, d] of Object.entries(MEM)) add(`mem_${k}`, 'bg', '16:9', `${STYLE}\nA memory scene with slightly faded, sepia-tinted watercolor edges: ${d}`);

/* ── 앱 아이콘 ── */
add('app_icon', 'bg', '1:1', `${STYLE}
App icon artwork: a single open hand-bound book with blank cream pages seen from slightly above, a calligraphy brush resting across it with a drop of black ink, and a small square vermilion seal stamp in the corner of the page (no readable characters). Centered with generous margin on a warm rice-paper background. Bold simple shapes that read well at small sizes.`);

export const ASSETS = A;
export const WIDTH = { bg: 1600, char: 760, obj: 512 };
