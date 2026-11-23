/* Обложки игры «Поршик 2.0» — десять вариантов и OG-превью.
   Текстовый слой рисуется SVG-ом поверх готового арта (sharp),
   чтобы шрифты и разметка были детерминированными и без сети.
   Запуск: node tools/covers.mjs (нужен sharp: npm i --no-save sharp).
   Исходники лежат в .covers-src/ (вне репозитория), шрифты — в .covers-fonts/.
   Готовые обложки: assets/covers/ (900×1125) и assets/covers/full/ (1200×1500). */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, '.covers-src');
const OUT_SMALL = path.join(root, 'assets/covers');
const OUT_BIG = path.join(root, 'assets/covers/full');
const FONT_DIR = path.join(root, '.covers-fonts');

export const VERSION = '2.0';
export const GIFT = 'Special gift for Egor and Liza';

/* Тема оформления: палитра текста и вид плашки под каждым вариантом. */
export const COVERS = [
  {
    file: '01-sunset',
    slug: 'zak Kat',
    title: 'ЗАКАТ НАД КРЫШАМИ',
    mood: 'вечер и большой прыжок',
    accent: '#ffb45e',
    ink: '#22141c',
    paper: 'rgba(255, 236, 208, 0.94)',
    paperInk: '#3b2214',
    glow: '#ffd9a0',
    titleSize: 0.077,
    align: 'left',
  },
  {
    file: '02-night',
    slug: 'night-city',
    title: 'НОЧНОЙ ГОРОД',
    mood: 'луна и стая рыбок',
    accent: '#7ef4ff',
    ink: '#eafcff',
    paper: 'rgba(20, 14, 44, 0.72)',
    paperInk: '#d9f6ff',
    glow: '#59e0ff',
    titleSize: 0.086,
    align: 'center',
  },
  {
    file: '03-fishrain',
    slug: 'fish-rain',
    title: 'РЫБНЫЙ ДОЖДЬ',
    mood: 'небо перевёрнуто',
    accent: '#ffe98a',
    ink: '#08303a',
    paper: 'rgba(236, 255, 252, 0.9)',
    paperInk: '#0b3b46',
    glow: '#9ff3e4',
    titleSize: 0.082,
    align: 'left',
  },
  {
    file: '04-cosmo',
    slug: 'cosmo',
    title: 'КОСМОКОТ',
    mood: 'шлем и золотые рыбки',
    accent: '#ffd479',
    ink: '#fdf6ff',
    paper: 'rgba(16, 12, 38, 0.7)',
    paperInk: '#ffe9b8',
    glow: '#a98bff',
    titleSize: 0.09,
    align: 'center',
  },
  {
    file: '05-stainedglass',
    slug: 'glass',
    title: 'ВИТРАЖ',
    mood: 'свет и крылья',
    accent: '#ffd884',
    ink: '#fff4d6',
    paper: 'rgba(28, 12, 24, 0.62)',
    paperInk: '#ffe9be',
    glow: '#ffcf7a',
    titleSize: 0.078,
    align: 'left',
  },
  {
    file: '06-bakery',
    slug: 'bakery',
    title: 'ПЕКАРНЯ',
    mood: 'мука и круассаны',
    accent: '#d9743a',
    ink: '#40230f',
    paper: 'rgba(255, 250, 240, 0.93)',
    paperInk: '#7a3c17',
    glow: '#ffcf8f',
    titleSize: 0.08,
    align: 'left',
  },
  {
    file: '07-fireplace',
    slug: 'ember',
    title: 'КАМИН',
    mood: 'искры и жар',
    accent: '#ff9a4d',
    ink: '#ffe3c4',
    paper: 'rgba(24, 8, 10, 0.66)',
    paperInk: '#ffd3a4',
    glow: '#ff7a3c',
    titleSize: 0.084,
    align: 'center',
  },
  {
    file: '08-papercut',
    slug: 'paper',
    title: 'БУМАЖНЫЙ ПОЛЁТ',
    mood: 'слои и тени',
    accent: '#2f5d7c',
    ink: '#213a4e',
    paper: 'rgba(255, 249, 240, 0.92)',
    paperInk: '#2b4356',
    glow: '#e9c8a4',
    titleSize: 0.075,
    align: 'left',
  },
  {
    file: '09-neon',
    slug: 'neon',
    title: 'НЕОН',
    mood: 'аркада и хром',
    accent: '#ff5ec7',
    ink: '#ffffff',
    paper: 'rgba(18, 6, 34, 0.66)',
    paperInk: '#ffd7f4',
    glow: '#31e6ff',
    titleSize: 0.092,
    align: 'center',
  },
  {
    file: '10-home',
    slug: 'home',
    title: 'ДОМ, ГДЕ ЖДУТ',
    mood: 'окно и свет',
    accent: '#e0765e',
    ink: '#3c2430',
    paper: 'rgba(255, 245, 235, 0.93)',
    paperInk: '#6a3a34',
    glow: '#ffc9a8',
    titleSize: 0.073,
    align: 'left',
  },
];

/* ---------- шрифты в data-url, чтобы SVG-рендер не зависел от системы ---------- */

async function fontFaces() {
  const [nunito, caveat] = await Promise.all([
    readFile(path.join(FONT_DIR, 'nunito.ttf')),
    readFile(path.join(FONT_DIR, 'caveat.ttf')),
  ]);
  return `
  @font-face { font-family: 'CoverSans'; src: url(data:font/ttf;base64,${nunito.toString('base64')}) format('truetype'); font-weight: 200 900; }
  @font-face { font-family: 'CoverHand'; src: url(data:font/ttf;base64,${caveat.toString('base64')}) format('truetype'); font-weight: 400 700; }
  text { font-family: 'CoverSans', sans-serif; }
  .hand { font-family: 'CoverHand', cursive; }`;
}

/* ---------- значки платформ ---------- */

const GLYPHS = {
  apple: 'M16.365 1.43c0 1.14-.46 2.22-1.2 3.02-.8.86-2.1 1.53-3.16 1.44-.14-1.1.44-2.27 1.16-3.03.8-.85 2.2-1.48 3.2-1.43zM20.9 17.1c-.6 1.38-.9 2-1.68 3.22-1.08 1.7-2.6 3.82-4.5 3.83-1.68.02-2.1-1.1-4.37-1.08-2.27.01-2.74 1.1-4.42 1.09-1.9-.02-3.34-1.94-4.42-3.64C-2.7 14.6-1.36 8.5 1.6 6.3c1.26-.93 2.36-1.5 3.7-1.5 1.4 0 2.27.92 4.28.92 1.95 0 3.13-.92 4.75-.92 1.2 0 2.4.5 3.66 1.5-3.23 1.77-2.7 6.4.9 10.8z',
  play: 'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z',
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
};

/* Значок MangPT: марсианский робот-агент с антенной и «лапами»,
   силуэт повторяет круглый контур GitHub, но цветной — марсианский оранжевый. */
function mangptGlyph() {
  return `
    <circle cx="12" cy="12" r="11.4" fill="#F26B3A"/>
    <path d="M12 3.2c-4.1 0-7.4 3.3-7.4 7.4v4.2c0 1.5 1.2 2.7 2.7 2.7h1.1v-2.6c0-.8.5-1.4 1.3-1.6v-2.1c0-1.3 1-2.3 2.3-2.3s2.3 1 2.3 2.3v2.1c.8.2 1.3.8 1.3 1.6v2.6h1.1c1.5 0 2.7-1.2 2.7-2.7V10.6c0-4.1-3.3-7.4-7.4-7.4z" fill="#FFF3E4"/>
    <circle cx="9.4" cy="9.6" r="1.5" fill="#2A1230"/>
    <circle cx="14.6" cy="9.6" r="1.5" fill="#2A1230"/>
    <path d="M10.4 13.1h3.2c.3 0 .5.2.5.5s-.2.5-.5.5h-3.2c-.3 0-.5-.2-.5-.5s.2-.5.5-.5z" fill="#F26B3A"/>
    <path d="M12 3.2V1.3" stroke="#FFF3E4" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="12" cy="1.2" r="1.4" fill="#59E0FF"/>
  `;
}

/* Плашка платформ: четыре значка + подписи. */
function platformRow(c, W) {
  const size = W * 0.062;
  const gap = W * 0.055;
  const total = 4 * size + 3 * gap;
  const startX = (W - total) / 2 + size / 2;
  const cy = W * 0.752;
  const labelSize = W * 0.0245;
  const color = c.paperInk;
  const items = [
    { glyph: GLYPHS.apple, label: 'App Store' },
    { glyph: GLYPHS.play, label: 'Google Play' },
    { glyph: GLYPHS.github, label: 'GitHub' },
    { glyph: null, label: 'MangPT' },
  ];
  return items
    .map((item, i) => {
      const cx = startX + i * (size + gap);
      const body = item.glyph
        ? `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})"><path d="${item.glyph}" fill="${color}"/></g>`
        : `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})">${mangptGlyph()}</g>`;
      return `${body}
      <text x="${cx}" y="${cy + size * 0.72 + labelSize}" font-size="${labelSize}" font-weight="700"
        letter-spacing="${labelSize * 0.02}" text-anchor="middle" fill="${color}" opacity="0.92">${item.label}</text>`;
    })
    .join('\n');
}

/* ---------- контраст: подбираем цвет текста по яркости арта ---------- */

async function inkFor(buffer) {
  const meta = await sharp(buffer).metadata();
  const region = {
    left: 0,
    top: Math.round(meta.height * 0.05),
    width: meta.width,
    height: Math.round(meta.height * 0.30),
  };
  const stats = await sharp(buffer).extract(region).greyscale().stats();
  const luma = stats.channels[0].mean / 255;
  // Сверху всегда лежит тёмная вуаль, поэтому текст — светлый.
  // Совсем светлый арт (мука, снег) требует чуть плотнее обводку.
  return {
    ink: '#FFF7EC',
    outline: luma > 0.62 ? 'rgba(26,12,18,0.86)' : 'rgba(26,12,18,0.66)',
    plateInk: '#FFF8EE',
    luma,
  };
}

/* ---------- измерение текста настоящим шрифтом ---------- */

const ADVANCE_CACHE = new Map();

async function advances(text, { hand = false } = {}) {
  const key = `${hand ? 'hand' : 'sans'}|${text}`;
  if (ADVANCE_CACHE.has(key)) return ADVANCE_CACHE.get(key);
  // Рендерим текст на прозрачном фоне и ищем границы заливки — так ширина
  // считается теми же метриками, какими потом рисует sharp.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2600" height="400">
    <text class="${hand ? 'hand' : 'sans'}" x="40" y="280" font-size="200" font-weight="900"
      fill="#ffffff">${text}</text></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const { info } = await sharp(buf).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const width = info.width;
  const res = width / 200; // ширина в долях кегля
  ADVANCE_CACHE.set(key, res);
  return res;
}

/* Подбираем кегль так, чтобы заголовок гарантированно влез в поля. */
async function fitSize(text, maxWidth, startEm, minEm, opts = {}) {
  const perEm = await advances(text, opts);
  let size = startEm;
  while (size > minEm && perEm * size > maxWidth) size -= maxWidth / 90;
  return { size: Math.max(minEm, size), width: perEm * Math.max(minEm, size) };
}

/* Верхняя часть обложки: серия, версия, заголовок и девиз. */
async function titleGroup(c, W, H, tone) {
  const pad = W * 0.078;
  const maxW = W - pad * 2;

  const title = await fitSize(c.title, maxW, W * Math.min(c.titleSize, 0.083), W * 0.040);
  const mood = await fitSize(c.mood, maxW * 0.90, W * 0.058, W * 0.034, { hand: true });

  const eyebrowSize = W * 0.038;
  const metaSize = W * 0.0255;
  const titleY = H * 0.268;
  const moodSize = Math.min(mood.size, W * 0.062);
  const moodY = titleY + moodSize + W * 0.052;

  return `
  <g>
    <text x="${pad}" y="${H * 0.098}" font-size="${eyebrowSize}" font-weight="900" letter-spacing="${eyebrowSize * 0.15}"
      fill="${tone.ink}" stroke="${tone.outline}" stroke-width="${eyebrowSize * 0.11}" stroke-linejoin="round" paint-order="stroke">ПОРШИК</text>
    <text x="${pad}" y="${H * 0.098 + metaSize * 1.6}" font-size="${metaSize}" font-weight="700" letter-spacing="${metaSize * 0.07}"
      fill="${tone.ink}" opacity="0.88" stroke="${tone.outline}" stroke-width="${metaSize * 0.12}" stroke-linejoin="round" paint-order="stroke">КОТ, КОТОРЫЙ ЛЕТАЕТ</text>

    <g>
      <rect x="${pad - W * 0.021}" y="${H * 0.049}" width="${W * 0.0105}" height="${H * 0.062}" rx="${W * 0.005}" fill="${c.accent}"/>
      <rect x="${pad - W * 0.021}" y="${H * 0.049}" width="${W * 0.071}" height="${W * 0.071}" fill="none"/>
    </g>

    <text x="${pad}" y="${titleY}" font-size="${title.size}" font-weight="900" letter-spacing="${-title.size * 0.026}"
      fill="${tone.ink}" stroke="${tone.outline}" stroke-width="${Math.max(1.8, title.size * 0.040)}" stroke-linejoin="round"
      paint-order="stroke" style="filter: drop-shadow(0 ${title.size * 0.045}px ${title.size * 0.1}px rgba(0,0,0,0.45))">${c.title}</text>
    <text class="hand" x="${pad}" y="${moodY}" font-size="${moodSize}" font-weight="700" fill="${c.accent}"
      stroke="${tone.outline}" stroke-width="${Math.max(1.4, moodSize * 0.055)}" stroke-linejoin="round" paint-order="stroke">${c.mood}</text>
  </g>`;
}

/* Плашка версии — правый верхний угол, вне заголовка. */
function versionBadge(c, W, H, tone) {
  const pad = W * 0.078;
  const badgeW = W * 0.212;
  const badgeH = H * 0.043;
  const x = W - pad - badgeW;
  const y = H * 0.053;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${badgeW}" height="${badgeH}" rx="${badgeH / 2}" fill="${c.accent}"/>
    <text x="${x + badgeW / 2}" y="${y + badgeH * 0.70}" font-size="${W * 0.0295}" font-weight="900"
      letter-spacing="${W * 0.0008}" text-anchor="middle" fill="#22101f">ВЕРСИЯ ${VERSION}</text>
  </g>`;
}

/* Нижняя треть: платформы, лента подарка, адрес. */
function giftGroup(c, W, H, tone) {
  const bandW = W * 0.76;
  const bandH = H * 0.075;
  const bandX = (W - bandW) / 2;
  const bandY = H * 0.818;

  const labelSize = W * 0.0215;
  const giftSize = W * 0.0455;

  const iconSize = W * 0.038;
  const gap = W * 0.115;
  const total = 4 * iconSize + 3 * gap;
  const startX = (W - total) / 2 + iconSize / 2;
  const iconY = H * 0.752;

  const items = [
    { glyph: GLYPHS.apple, label: 'App Store' },
    { glyph: GLYPHS.play, label: 'Google Play' },
    { glyph: GLYPHS.github, label: 'GitHub' },
    { glyph: null, label: 'MangPT' },
  ];

  const platforms = items
    .map((item, i) => {
      const cx = startX + i * (iconSize + gap);
      const body = item.glyph
        ? `<g transform="translate(${cx - iconSize / 2} ${iconY - iconSize / 2}) scale(${iconSize / 24})"><path d="${item.glyph}" fill="${tone.plateInk}"/></g>`
        : `<g transform="translate(${cx - iconSize / 2} ${iconY - iconSize / 2}) scale(${iconSize / 24})">${mangptGlyph()}</g>`;
      return `${body}<text x="${cx}" y="${iconY + iconSize * 0.55 + labelSize * 1.15}" font-size="${labelSize}" font-weight="800"
        letter-spacing="${labelSize * 0.05}" text-anchor="middle" fill="${tone.plateInk}">${item.label}</text>`;
    })
    .join('\n');

  return `
  <g>
    ${platforms}
    <g>
      <rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}" rx="${bandH / 2}" fill="${c.paper}"
        style="filter: drop-shadow(0 ${W * 0.005}px ${W * 0.02}px rgba(0,0,0,0.45))"/>
      <rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}" rx="${bandH / 2}" fill="none" stroke="${c.accent}" stroke-width="${W * 0.0032}"/>
      <text x="${W / 2}" y="${bandY + bandH * 0.335}" font-size="${labelSize * 0.95}" font-weight="800" letter-spacing="${labelSize * 0.2}"
        text-anchor="middle" fill="${c.paperInk}" opacity="0.8">SPECIAL GIFT</text>
      <text class="hand" x="${W / 2}" y="${bandY + bandH * 0.845}" font-size="${giftSize}" font-weight="700"
        text-anchor="middle" fill="${c.paperInk}">for Egor and Liza</text>
    </g>
    <text x="${W / 2}" y="${H * 0.952}" font-size="${W * 0.0225}" font-weight="700" letter-spacing="${W * 0.0022}"
      text-anchor="middle" fill="${tone.plateInk}" opacity="0.85">miagpt.github.io/game</text>
  </g>`;
}

async function coverSvg(c, W, H, tone) {
  const faces = await fontFaces();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <style type="text/css"><![CDATA[${faces}]]></style>
    <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.80"/>
      <stop offset="0.13" stop-color="#000" stop-opacity="0.72"/>
      <stop offset="0.40" stop-color="#000" stop-opacity="0.20"/>
      <stop offset="0.70" stop-color="#000" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="botScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.30" stop-color="#000" stop-opacity="0.34"/>
      <stop offset="0.62" stop-color="#000" stop-opacity="0.62"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.86"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H * 0.60}" fill="url(#topScrim)"/>
  <rect y="${H * 0.60}" width="${W}" height="${H * 0.40}" fill="url(#botScrim)"/>

  ${await titleGroup(c, W, H, tone)}
  ${versionBadge(c, W, H, tone)}
  ${giftGroup(c, W, H, tone)}
</svg>`;
}


/* ---------- OG-превью 1200×630: своя раскладка, а не кроп постера ---------- */

function ogSvg(W, H, tone) {
  const pad = W * 0.058;
  const icon = W * 0.030;
  const gap = W * 0.088;
  const items = [
    { glyph: GLYPHS.apple, label: 'App Store' },
    { glyph: GLYPHS.play, label: 'Google Play' },
    { glyph: GLYPHS.github, label: 'GitHub' },
    { glyph: null, label: 'MangPT' },
  ];
  const rowY = H * 0.845;
  const startX = pad + icon / 2;

  const platforms = items
    .map((item, i) => {
      const cx = startX + i * (icon + gap);
      const body = item.glyph
        ? `<g transform="translate(${cx - icon / 2} ${rowY - icon / 2}) scale(${icon / 24})"><path d="${item.glyph}" fill="${tone.ink}" opacity="0.92"/></g>`
        : `<g transform="translate(${cx - icon / 2} ${rowY - icon / 2}) scale(${icon / 24})">${mangptGlyph()}</g>`;
      return `${body}<text x="${cx}" y="${rowY + icon * 0.5 + W * 0.019}" font-size="${W * 0.0145}" font-weight="800"
        letter-spacing="${W * 0.0008}" text-anchor="middle" fill="${tone.ink}" opacity="0.78">${item.label}</text>`;
    })
    .join('');

  return `
    <rect width="${W * 0.62}" height="${H}" fill="url(#ogScrim)"/>
    <text x="${pad}" y="${H * 0.155}" font-size="${W * 0.026}" font-weight="900" letter-spacing="${W * 0.006}"
      fill="${tone.ink}" stroke="rgba(20,8,14,0.55)" stroke-width="${W * 0.0022}" stroke-linejoin="round" paint-order="stroke">ПОРШИК</text>
    <text x="${pad}" y="${H * 0.21}" font-size="${W * 0.0145}" font-weight="700" letter-spacing="${W * 0.0016}"
      fill="${tone.ink}" opacity="0.86" stroke="rgba(20,8,14,0.5)" stroke-width="${W * 0.0014}" stroke-linejoin="round" paint-order="stroke">КОТ, КОТОРЫЙ ЛЕТАЕТ</text>

    <rect x="${pad}" y="${H * 0.268}" width="${W * 0.118}" height="${H * 0.058}" rx="${H * 0.029}" fill="#FFC44D"/>
    <text x="${pad + W * 0.059}" y="${H * 0.268 + H * 0.039}" font-size="${W * 0.0158}" font-weight="900"
      letter-spacing="${W * 0.0004}" text-anchor="middle" fill="#3B2214">ВЕРСИЯ ${VERSION}</text>

    <text x="${pad}" y="${H * 0.445}" font-size="${W * 0.052}" font-weight="900" letter-spacing="${-W * 0.0013}"
      fill="${tone.ink}" stroke="rgba(20,8,14,0.55)" stroke-width="${W * 0.0034}" stroke-linejoin="round" paint-order="stroke">ЗАКАТ</text>
    <text x="${pad}" y="${H * 0.445 + W * 0.055}" font-size="${W * 0.052}" font-weight="900" letter-spacing="${-W * 0.0013}"
      fill="${tone.ink}" stroke="rgba(20,8,14,0.55)" stroke-width="${W * 0.0034}" stroke-linejoin="round" paint-order="stroke">НАД КРЫШАМИ</text>
    <text class="hand" x="${pad}" y="${H * 0.445 + W * 0.098}" font-size="${W * 0.029}" font-weight="700" fill="#FFE0B0"
      stroke="rgba(20,8,14,0.5)" stroke-width="${W * 0.0018}" stroke-linejoin="round" paint-order="stroke">десять миров, рыбки и письмо</text>

    <g>
      <rect x="${pad}" y="${H * 0.666}" width="${W * 0.40}" height="${H * 0.112}" rx="${H * 0.056}" fill="rgba(255,246,235,0.96)"/>
      <rect x="${pad}" y="${H * 0.666}" width="${W * 0.40}" height="${H * 0.112}" rx="${H * 0.056}" fill="none" stroke="#FFB45E" stroke-width="${W * 0.0022}"/>
      <text x="${pad + W * 0.20}" y="${H * 0.664 + H * 0.040}" font-size="${W * 0.0122}" font-weight="800" letter-spacing="${W * 0.003}"
        text-anchor="middle" fill="#7A3C17" opacity="0.85">SPECIAL GIFT</text>
      <text class="hand" x="${pad + W * 0.20}" y="${H * 0.666 + H * 0.090}" font-size="${W * 0.0262}" font-weight="700"
        text-anchor="middle" fill="#5C2A24">for Egor and Liza</text>
    </g>

    ${platforms}
    <text x="${W - pad}" y="${H - H * 0.035}" font-size="${W * 0.0145}" font-weight="700" letter-spacing="${W * 0.0009}"
      text-anchor="end" fill="${tone.ink}" opacity="0.8" stroke="rgba(20,8,14,0.45)" stroke-width="${W * 0.0016}" paint-order="stroke">miagpt.github.io/game</text>`;
}

async function buildOg() {
  const W = 1200;
  const H = 630;
  const base = await sharp(path.join(SRC, '01-sunset.png'))
    .resize(W, H, { fit: 'cover', position: 'right' })
    .modulate({ saturation: 1.02 })
    .toBuffer();
  const tone = await inkFor(base);
  const faces = await fontFaces();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <style type="text/css"><![CDATA[${faces}]]></style>
    <linearGradient id="ogScrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1b0d14" stop-opacity="0.94"/>
      <stop offset="0.62" stop-color="#1b0d14" stop-opacity="0.78"/>
      <stop offset="1" stop-color="#1b0d14" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${ogSvg(W, H, tone)}
  </svg>`;
  return sharp(base)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(root, 'assets/img/og-cover.jpg'));
}

/* ---------- сборка ---------- */

const W = 900;
const H = 1125;
const FONT_PATH = path.join(FONT_DIR, 'nunito.ttf');

export async function buildCover(cover, { out = OUT_SMALL, width = W } = {}) {
  const height = Math.round((width * H) / W);
  const base = await sharp(path.join(SRC, `${cover.file}.png`))
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .modulate({ saturation: 1.04 })
    .toBuffer();
  const tone = await inkFor(base);
  const overlay = Buffer.from(await coverSvg(cover, width, height, tone));
  return sharp(base)
    .composite([
      { input: overlay, blend: 'over' },
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${width * 0.028}" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="${width * 0.003}"/></svg>`,
        ),
      },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(out, `${cover.file}.jpg`));
}

async function main() {
  await mkdir(OUT_SMALL, { recursive: true });
  await mkdir(OUT_BIG, { recursive: true });

  const done = [];
  for (const cover of COVERS) {
    const small = await buildCover(cover, { out: OUT_SMALL });
    const big = await buildCover(cover, { out: OUT_BIG, width: 1200 });
    done.push({ file: cover.file, slug: cover.slug, title: cover.title, small: small.width, big: big.width, bytes: small.size });
  }

  const og = await buildOg();

  for (const d of done) console.log(`${d.file}.jpg  ${d.title}  ${Math.round(d.bytes / 1024)} КБ`);
  console.log(`og-cover.jpg ${og.width}x${og.height} ${Math.round(og.size / 1024)} КБ`);
  console.log(`Готово вариантов: ${done.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
