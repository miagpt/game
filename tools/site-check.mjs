/* Проверка статического сайта: ссылки, id, ресурсы, отсутствие внешних
   зависимостей, размеры файлов и согласованность страниц между собой.
   Запуск: node tools/site-check.mjs */

import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warn = [];

const PAGES = ['index.html', 'play.html', 'love.html', '404.html'];

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
      if (!/^https:\/\/(?:miagpt\.github\.io)/.test(ref)) errors.push(`${page}: внешняя ссылка ${ref}`);
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
  ],
  'index.html': ['main', 'worlds', 'worldGrid', 'how', 'diary'],
  'love.html': ['main', 'noteWrap', 'letter', 'letterBlock', 'letterBody', 'progressStrip'],
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

for (const css of ['base.css', 'site.css', 'game.css']) {
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

/* ---------- вес страниц ---------- */

let total = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'family', 'dist', '.harness'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else total += (await stat(full)).size;
  }
}
await walk(path.join(root, 'assets'));
if (total > 4_000_000) warn.push(`assets весит ${(total / 1e6).toFixed(1)} МБ — многовато для первого кадра`);
for (const big of ['assets/img/og.jpg', 'assets/img/hero.jpg']) {
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
