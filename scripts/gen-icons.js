// 별헤는 밤 PWA 아이콘 생성기 — @resvg/resvg-js 사용
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

function makeSVG(size) {
  const s = size;
  const half = s / 2;
  // 별 위치 (결정론적)
  const stars = [
    [s*0.08, s*0.10, 2.2], [s*0.20, s*0.06, 1.5], [s*0.35, s*0.13, 1.8],
    [s*0.55, s*0.07, 2.5], [s*0.72, s*0.11, 1.6], [s*0.88, s*0.05, 2.0],
    [s*0.93, s*0.18, 1.4], [s*0.80, s*0.22, 1.7], [s*0.12, s*0.28, 1.5],
    [s*0.90, s*0.38, 1.9], [s*0.05, s*0.55, 2.1], [s*0.95, s*0.62, 1.6],
    [s*0.07, s*0.80, 1.8], [s*0.18, s*0.92, 2.0], [s*0.40, s*0.95, 1.5],
    [s*0.60, s*0.93, 1.7], [s*0.78, s*0.88, 2.2], [s*0.92, s*0.82, 1.4],
    [s*0.30, s*0.85, 1.6], [s*0.65, s*0.78, 1.9],
  ];

  const starEls = stars.map(([x, y, r]) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#f5f0e8" opacity="${(0.6 + Math.random() * 0.4).toFixed(2)}"/>`
  ).join('\n    ');

  const sym = s * 0.42; // ✦ font size

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#141432"/>
      <stop offset="100%" stop-color="#07071a"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffd97d" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#ffd97d" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${s}" height="${s}" fill="url(#bg)" rx="${s * 0.12}"/>

  <!-- Subtle glow behind symbol -->
  <circle cx="${half}" cy="${half}" r="${s * 0.38}" fill="url(#glow)"/>

  <!-- Stars -->
  ${starEls}

  <!-- ✦ symbol -->
  <text
    x="${half}" y="${half + sym * 0.38}"
    text-anchor="middle"
    font-size="${sym}"
    font-family="serif"
    fill="#ffd97d"
  >✦</text>

  <!-- WC wordmark -->
  <text
    x="${half}" y="${s * 0.88}"
    text-anchor="middle"
    font-size="${s * 0.075}"
    font-family="monospace"
    fill="#a78bfa"
    letter-spacing="${s * 0.01}"
  >WRITECOACH</text>
</svg>`;
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

for (const size of [192, 512]) {
  const svg = makeSVG(size);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const png = resvg.render().asPng();
  const out = path.join(publicDir, `icon-${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`✓ icon-${size}.png (${(png.length / 1024).toFixed(0)}KB)`);
}
