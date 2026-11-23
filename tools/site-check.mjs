/* Проверка статического сайта: ссылки, id, ресурсы, отсутствие внешних
   зависимостей, размеры файлов и согласованность страниц между собой.
   Запуск: node tools/site-check.mjs */

import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warn = [];

const PAGES = ['index.html', 'play.html', 'love.html', 'covers.html', '404.html'];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const html = {};
for (const page of PAGES) {
  const full = path.join(root, page);
  if (!(await exists(full))) {
    errors.push(`нет страницы ${page}`);
    continue;
  }
  html[page] = await readFile(full, 'utf8');
}

/* ---------- ссылки и ресурсы ---------- */

for (const [page, text] of Object.entries(html)) {
  if (!/^<!doctype html>/i.test(text)) errors.push(`${page}: нет <!doctype html>`);
  if (!/<html lang="ru">/.test(text)) errors.push(`${page}: нет lang="ru"`);
  if (!/<meta name="viewport"/.test(text)) errors.push(`${page}: нет viewport`);
  if (!/<meta name="description"/.test(text)) errors.push(`${page}: нет description`);
  if (!/<title>[^<]{5,}<\/title>/.test(text)) errors.push(`${page}: нет <title>`);

  for (const m of text.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = m[1];
    if (ref.startsWith('#')) {
      if (ref.length > 1 && !new RegExp(`id="${ref.slice(1)}"`).test(text)) {
        errors.push(`${page}: ссылка на отсутствующий якорь ${ref}`);
      }
      continue;
    }
    if (/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(ref)) {
      const allowed = /^https:\/\/(?:miagpt\.github\.io|github\.com\/miagpt)/;
      if (!allowed.test(ref)) errors.push(`${page}: внешняя ссылка ${ref}`);
      continue;
    }
    const clean = ref.split(/[?#]/)[0];
    if (!clean) continue;
    const target = clean.startsWith('/') ? path.join(root, clean) : path.join(root, path.dirname(page), clean);
    if (!(await exists(target)) && !(await exists(path.join(target, 'index.html')))) {
      errors.push(`${page}: файл не найден — ${ref}`);
    }
  }

  // никаких внешних runtime-ресурсов
  for (const m of text.matchAll(/<(?:script|link|img|iframe)[^>]*(?:src|href)="(https?:[^"]+)"/g)) {
    errors.push(`${page}: внешний ресурс ${m[1]}`);
  }
  if (/<script(?![^>]*type="module")[^>]*src=/.test(text)) warn.push(`${page}: скрипт без type="module"`);
}

/* ---------- обязательные элементы ---------- */

const requiredIds = {
  'play.html': [
    'canvas',
    'stage',
    'hudLives',
    'hudFish',
    'btnPlay',
    'btnLevels',
    'btnWardrobe',
    'btnEndless',
    'btnPause',
    'btnMute',
    'btnResume',
    'btnRestart',
    'btnRetry',
    'btnWinNext',
    'btnNote',
    'btnWinRetry',
    'btnNoteNext',
    'btnLetterDone',
    'screenMenu',
    'screenLevels',
    'screenWardrobe',
    'screenPause',
    'screenWin',
    'screenLose',
    'screenNote',
    'screenLetter',
    'levelList',
    'skinList',
    'screenMissions',
    'missionList',
    'btnMissions',
    'menuDaily',
    'noteText',
    'letterBody',
    'powers',
    'toast',
    'bubble',
    'giftCard',
    'giftLines',
    'giftSign',
    'menuGift',
  ],
  'index.html': ['main', 'worlds', 'worldGrid', 'how', 'diary'],
  'love.html': ['main', 'noteWrap', 'letter', 'letterBlock', 'letterBody', 'progressStrip', 'giftCard', 'giftLines'],
  'covers.html': ['main', 'coverGrid', 'msgGrid', 'gallery', 'texts'],
  '404.html': ['main'],
};

for (const [page, ids] of Object.entries(requiredIds)) {
  const text = html[page] || '';
  for (const id of ids) {
    if (!new RegExp(`id="${id}"`).test(text)) errors.push(`${page}: нет #${id}`);
  }
}

/* ---------- скрипты и стили ---------- */

const modules = await readdir(path.join(root, 'assets/js'));
for (const file of modules.filter((f) => f.endsWith('.js'))) {
  const src = await readFile(path.join(root, 'assets/js', file), 'utf8');
  if (/console\.log\(/.test(src)) warn.push(`assets/js/${file}: console.log в продакшене`);
  if (/\bdebugger\b/.test(src)) errors.push(`assets/js/${file}: debugger`);
  if (/https?:\/\/(?!localhost)/.test(src) && !/miagpt\.github\.io/.test(src)) {
    warn.push(`assets/js/${file}: упоминание внешнего URL`);
  }
}

/* ---------- styles ---------- */

for (const css of ['base.css', 'site.css', 'game.css', 'covers.css']) {
  const src = await readFile(path.join(root, 'assets/css', css), 'utf8');
  if ((src.match(/{/g) || []).length !== (src.match(/}/g) || []).length) errors.push(`assets/css/${css}: несбалансированные скобки`);
  for (const m of src.matchAll(/url\('([^']+)'\)/g)) {
    const ref = m[1];
    if (/^https?:/.test(ref)) errors.push(`assets/css/${css}: внешний ресурс ${ref}`);
    else {
      const target = path.join(root, 'assets/css', ref);
      if (!(await exists(target))) errors.push(`assets/css/${css}: нет файла ${ref}`);
    }
  }
}

/* ---------- манифест и сервис-воркер ---------- */

const manifest = JSON.parse(await readFile(path.join(root, 'site.webmanifest'), 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons', 'theme_color', 'background_color', 'lang']) {
  if (!(key in manifest)) errors.push(`site.webmanifest: нет поля ${key}`);
}
if (manifest.icons.length < 2) errors.push('site.webmanifest: нужно минимум две иконки');
for (const icon of manifest.icons) {
  if (!(await exists(path.join(root, icon.src)))) errors.push(`site.webmanifest: нет иконки ${icon.src}`);
}
if (manifest.display !== 'standalone') warn.push('site.webmanifest: display не standalone');

const sw = await readFile(path.join(root, 'sw.js'), 'utf8');
for (const m of sw.matchAll(/'\.\/([^']+)'/g)) {
  const ref = m[1];
  if (!ref) continue;
  if (!(await exists(path.join(root, ref)))) errors.push(`sw.js: кэшируется отсутствующий файл ${ref}`);
}
for (const page of ['index.html', 'play.html', 'love.html']) {
  if (!sw.includes(page)) errors.push(`sw.js: страница ${page} не кэшируется`);
}

/* ---------- совпадение миров на главной и в игре ---------- */

const content = await import('../assets/js/content.js');
const rules = await import('../assets/js/rules.js');
const themes = await import('../assets/js/themes.js');
if (content.LEVELS.length !== rules.ROUNDS) errors.push('ROUNDS не совпадает с числом миров');
if (new Set(content.LEVELS.map((l) => l.world)).size !== content.LEVELS.length) errors.push('миры повторяются');
for (const level of content.LEVELS) {
  if (!themes.THEMES[level.world]) errors.push(`нет темы для мира ${level.world}`);
  if (!html['index.html'].includes('worldGrid')) errors.push('index.html не строит сетку миров');
}

/* ---------- обложки и значки платформ ---------- */

const coverDir = path.join(root, 'assets/covers');
const coverFiles = (await readdir(coverDir)).filter((f) => f.endsWith('.jpg'));
if (coverFiles.length < 10) errors.push(`assets/covers: найдено ${coverFiles.length} обложек, ожидается 10`);

const COVER_VARIANTS = [
  '01-sunset', '02-night', '03-fishrain', '04-cosmo', '05-stainedglass',
  '06-bakery', '07-fireplace', '08-papercut', '09-neon', '10-home',
];
const coversPage = html['covers.html'] || '';
for (const variant of COVER_VARIANTS) {
  for (const dir of ['assets/covers', 'assets/covers/full']) {
    if (!(await exists(path.join(root, dir, `${variant}.jpg`)))) errors.push(`нет обложки ${dir}/${variant}.jpg`);
  }
  if (!coversPage.includes('id="coverGrid"')) errors.push('covers.html: нет контейнера галереи');
}

const coversJs = await readFile(path.join(root, 'assets/js/covers-page.js'), 'utf8');
const listed = [...coversJs.matchAll(/file: '([0-9]{2}-[a-z]+)'/g)].map((m) => m[1]);
if (new Set(listed).size !== COVER_VARIANTS.length) errors.push(`covers-page.js: ${new Set(listed).size} вариантов вместо 10`);
for (const variant of COVER_VARIANTS) {
  if (!listed.includes(variant)) errors.push(`covers-page.js: потерян вариант ${variant}`);
}
if ((coversJs.match(/who: '/g) || []).length < 8) errors.push('covers-page.js: мало текстов для Telegram');

for (const badge of ['appstore', 'googleplay', 'github', 'mangpt']) {
  const file = path.join(root, 'assets/img/brands', `${badge}.svg`);
  if (!(await exists(file))) errors.push(`нет значка assets/img/brands/${badge}.svg`);
  else {
    const svg = await readFile(file, 'utf8');
    if (!/<svg[^>]*viewBox="0 0 24 24"/.test(svg)) errors.push(`assets/img/brands/${badge}.svg: нужен viewBox 24×24`);
    if (/https?:\/\/(?!www\.w3\.org)/.test(svg)) errors.push(`assets/img/brands/${badge}.svg: внешняя ссылка`);
  }
}
if (!coversPage.includes('mangpt.svg')) errors.push('covers.html: нет значка MangPT');

/* версия 2.0 должна быть видна на всех «входных» страницах */
for (const page of ['index.html', 'play.html', 'love.html', 'covers.html']) {
  if (!/2\.0/.test(html[page] || '')) errors.push(`${page}: нет отметки версии 2.0`);
}
if (!/Special gift for Egor and Liza/.test(html['index.html'] || '')) errors.push('index.html: нет надписи подарка');

/* ---------- вес страниц ---------- */

let total = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'family', 'dist', '.harness', '.covers-src', '.covers-fonts'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else total += (await stat(full)).size;
  }
}
await walk(path.join(root, 'assets'));
let coverBytes = 0;
for (const file of coverFiles) coverBytes += (await stat(path.join(coverDir, file))).size;
if (coverBytes > 2_600_000) warn.push(`обложки весят ${(coverBytes / 1e6).toFixed(1)} МБ`);
if (total > 8_000_000) warn.push(`assets весит ${(total / 1e6).toFixed(1)} МБ — многовато для первого кадра`);
for (const big of ['assets/img/og.jpg', 'assets/img/hero.jpg', 'assets/img/og-cover.jpg']) {
  const s = await stat(path.join(root, big));
  if (s.size > 400_000) warn.push(`${big}: ${Math.round(s.size / 1024)} КБ`);
}

/* ---------- итог ---------- */

for (const w of warn) console.log(`warning: ${w}`);
if (errors.length) {
  console.error(`\nНайдено проблем: ${errors.length}`);
  for (const e of errors) console.error(` - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`Site check passed: ${PAGES.length} страниц, ${Object.keys(requiredIds).length} наборов id, манифест, сервис-воркер, ${content.LEVELS.length} миров, ресурсы только локальные (assets: ${Math.round(total / 1024)} КБ).`);
}
