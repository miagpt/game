/* Браузерная проверка без браузера: собираем игру esbuild'ом,
   поднимаем настоящий DOM через jsdom, гоняем кадры и клики.
   Проверяем: запуск, меню, полёт, сбор рыбок, паузу, победу,
   записку, письмо, гардероб, бесконечный режим, перерисовку на
   маленьком экране и отсутствие ошибок в консоли.

   Запуск: node tools/e2e.mjs
   Зависимости: jsdom и esbuild (npm i --no-save jsdom esbuild). */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let JSDOM;
let VirtualConsole;
let esbuild;
try {
  ({ JSDOM, VirtualConsole } = require('jsdom'));
  esbuild = require('esbuild');
  if (!esbuild.build) esbuild = esbuild.default;
} catch (e) {
  console.log('e2e: пропущено — нужны jsdom и esbuild (npm i --no-save jsdom esbuild):', e.message);
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const framesDir = path.join(root, '.harness-frames');
const errors = [];
const problems = [];

const built = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['assets/js/game.js'],
  bundle: true,
  format: 'iife',
  write: false,
  target: 'chrome110',
});

const html = (await readFile(path.join(root, 'play.html'), 'utf8')).replace(
  '<script type="module" src="assets/js/game.js"></script>',
  '',
);

const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const msg = e.detail?.message || e.message;
  if (!/Not implemented/.test(msg)) errors.push(msg);
});
vc.on('error', (...a) => errors.push(a.join(' ')));

const dom = new JSDOM(html, {
  url: 'http://127.0.0.1:8000/play.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;

/* ---------- заглушки браузерных API ---------- */

const ctxCalls = { total: 0 };
function makeCtx(canvas) {
  const base = {
    canvas,
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (t) => ({ width: String(t).length * 8 }),
  };
  return new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p];
      return (...args) => {
        ctxCalls.total += 1;
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`не-finite аргумент ctx.${String(p)}(${args.join(',')})`);
        }
        if (p === 'arc' && args[2] < 0) throw new Error('отрицательный радиус дуги');
        return undefined;
      };
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  });
}
window.HTMLCanvasElement.prototype.getContext = function () {
  return (this.__ctx ||= makeCtx(this));
};
/* Размеры «экрана» меняются в середине прогона (проверка resize). */
const screen = { w: 390, h: 700 };
Object.defineProperty(window.HTMLCanvasElement.prototype, 'clientWidth', { get: () => screen.w, configurable: true });
Object.defineProperty(window.HTMLCanvasElement.prototype, 'clientHeight', { get: () => screen.h, configurable: true });
window.devicePixelRatio = 2;

const raf = [];
window.requestAnimationFrame = (cb) => raf.push(cb) && raf.length;
window.cancelAnimationFrame = () => {
  raf.length = 0;
};

class FakeParam {
  constructor() {
    this.value = 0;
  }
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  constructor() {
    for (const p of ['gain', 'frequency', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[p] = new FakeParam();
  }
  connect(n) {
    return n;
  }
  start() {}
  stop() {}
}
window.AudioContext = class {
  constructor() {
    this.currentTime = 0;
    this.destination = new FakeNode();
  }
  createGain() {
    return new FakeNode();
  }
  createOscillator() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

/* localStorage jsdom даёт, но проверим и «сломанное» хранилище ниже. */

let t = 0;
function frames(n) {
  for (let i = 0; i < n; i++) {
    const q = raf.splice(0, raf.length);
    t += 16.7;
    for (const cb of q) {
      try {
        cb(t);
      } catch (e) {
        errors.push(`кадр: ${e.message}`);
      }
    }
  }
}

function check(cond, message) {
  if (!cond) problems.push(message);
}

async function shoot(name) {
  const canvas = window.document.getElementById('canvas');
  // программного рендера нет: сохраняем «отпечаток» кадра — сколько и чего рисовали
  await mkdir(framesDir, { recursive: true });
  await writeFile(path.join(framesDir, `${name}.json`), JSON.stringify({ calls: ctxCalls.total, at: Math.round(t) }));
}

/* ---------- сценарий ---------- */

window.eval(built.outputFiles[0].text);
const api = window.__porshik;
check(!!api, 'игра не выставила window.__porshik');
check(ctxCalls.total > 0, 'renderer не рисовал при старте');

const doc = window.document;
check(doc.getElementById('screenMenu') && !doc.getElementById('screenMenu').hidden, 'меню не открылось на старте');

// Меню → полетели
doc.getElementById('btnPlay').click();
frames(3);
check(api.mode === 'playing', `после «Полетели!» mode=${api.mode}`);
check(api.sim && api.sim.levelId === 1, 'старт не с первого мира');

// Полёт: машем и летим вперёд
for (let i = 0; i < 260; i++) {
  if (i % 12 === 0) api.sim.flap();
  frames(1);
}
check(api.sim.cat.y >= 0 && api.sim.cat.y <= 720, 'кот улетел за пределы мира');
check(api.sim.dist > 0, 'мир не прокручивается');

// Пауза и продолжение
doc.getElementById('btnPause').click();
check(api.mode === 'paused', 'пауза не сработала');
frames(2);
doc.getElementById('btnResume').click();
check(api.mode === 'playing', 'продолжение не сработало');

// Гардероб: открывается и перерисовывает превью
doc.getElementById('btnPause').click();
doc.querySelector('#screenPause [data-go="menu"]').click();
frames(2);
doc.getElementById('btnWardrobe').click();
frames(2);
check(!doc.getElementById('screenWardrobe').hidden, 'гардероб не открылся');
const skinCards = doc.querySelectorAll('#skinList [data-skin]');
check(skinCards.length >= 8, `в гардеробе ${skinCards.length} карточек`);
// Купить второй облик (у нас нет рыбок — должно вежливо отказать)
skinCards[1].click();
check(api.save.skin === 'classic', 'облик наделся без рыбок');
frames(2);
doc.querySelector('#screenWardrobe [data-go="menu"]').click();

// Миссии: вкладка открывается и показывает прогресс
doc.getElementById('btnMissions').click();
frames(1);
check(api.mode === 'missions', `вкладка миссий: mode=${api.mode}`);
const missionCards = doc.querySelectorAll('#missionList .mission');
check(missionCards.length >= 9, `в миссиях ${missionCards.length} карточек`);
check((doc.getElementById('missionCount').textContent || '').includes('/'), 'нет счётчика миссий');
doc.querySelector('#screenMissions [data-go="menu"]').click();
frames(1);

// Гардероб закрыт — снова меню, оттуда сразу в полёт
check(api.mode === 'menu', 'после гардероба не вернулись в меню');
doc.getElementById('btnPlay').click();
frames(3);
check(api.mode === 'playing', 'повторный запуск полёта не сработал');

// Победа на первом мире: подкручиваем прогресс
const s1 = api.sim;
check(api.mode === 'playing', 'нет активного полёта перед проверкой победы');
s1.status = 'playing';
s1.cat.y = 320;
// финиш появляется только после всех ворот: догоняем генерацию мира
for (let i = 0; i < 60 && s1.finishX == null; i++) {
  s1.spawned = s1.totalGates;
  s1.fill();
  frames(1);
}
check(s1.finishX != null, 'финиш так и не появился');
s1.dist = Math.max(0, s1.finishX - s1.catX - 6);
s1.cat.y = 320;
frames(3);
check(api.mode === 'win', `после финиша mode=${api.mode}`);
check(!doc.getElementById('screenWin').hidden, 'экран победы не показан');
check(api.save.fish > 0, 'за победу не начислили рыбок');
check(api.save.stars[0] > 0, 'звезда за первый мир не выставлена');
check(api.save.seenNotes.includes(1), 'записка не отмечена как открытая');

// Записка
doc.getElementById('btnNote').click();
check(api.mode === 'note', 'записка не открылась');
check((doc.getElementById('noteText').textContent || '').length > 40, 'текст записки пустой');
doc.getElementById('btnNoteNext').click();
frames(2);
check(api.mode === 'playing' && api.sim.levelId === 2, 'после записки не начался второй мир');

// Десятый мир → письмо
api.openMenu();
api.startRun(10, false);
frames(3);
const s10 = api.sim;
check(s10.levelId === 10, 'десятый мир не запустился');
s10.status = 'playing';
s10.cat.y = 320;
for (let i = 0; i < 60 && s10.finishX == null; i++) {
  s10.spawned = s10.totalGates;
  s10.fill();
  frames(1);
}
s10.dist = Math.max(0, s10.finishX - s10.catX - 6);
s10.cat.y = 320;
frames(3);
check(api.mode === 'win', `после финиша десятого мира mode=${api.mode}`);
check(api.save.stars[9] > 0, 'звезда за десятый мир не выставлена');
doc.getElementById('btnNote').click();
frames(1);
check(api.mode === 'letter', 'письмо не открылось');
check((doc.getElementById('letterBody').textContent || '').length > 100, 'письмо пустое');
check(/Поршик/.test(doc.getElementById('letterSign').textContent || ''), 'в письме нет подписи Поршика');
check(/Егору и Лизе/.test(doc.getElementById('giftTitle').textContent || ''), 'в письме нет подарка Егору и Лизе');
check(/Special gift/.test(doc.getElementById('giftBadge').textContent || ''), 'у подарка нет бейджа Special gift');
check(doc.querySelectorAll('#giftLines p').length >= 2, 'текст подарка не заполнен');
check(/для двоих/.test(doc.getElementById('giftSub').textContent || ''), 'нет подписи «для двоих»');
check(/2\.0/.test(doc.querySelector('.brand-ver').textContent || ''), 'в шапке нет версии 2.0');
check(/Egor and Liza/.test(doc.getElementById('menuGift').textContent || ''), 'в меню нет строки подарка');
// Письмо → меню
doc.getElementById('btnLetterDone').click();
frames(2);
check(api.mode === 'menu', 'после письма не вернулись в меню');

// Бесконечный режим
doc.getElementById('btnPause').click();
doc.querySelector('#screenPause [data-go="menu"]').click();
frames(1);
doc.getElementById('btnEndless').click();
frames(2);
check(api.sim.mode === 'endless', 'бесконечный режим не запустился');
const sim = api.sim;
sim.status = 'playing';
for (let i = 0; i < 400; i++) {
  if (i % 10 === 0) sim.flap();
  frames(1);
}
check(sim.gates.length > 2, 'в бесконечном режиме не появляются ворота');
// Завершаем бесконечный забег
for (let i = 0; i < 4; i++) {
  sim.inv = 0;
  sim.cat.y = 640;
  sim.cat.vy = 400;
  frames(2);
}
frames(90);
check(api.mode === 'lose', `после проигрыша mode=${api.mode}`);

// В меню и «сброс»
doc.querySelector('#screenLose [data-go="menu"]').click();
frames(2);
api.clearSave();
check(api.save.fish === 0 && api.save.stars.every((x) => x === 0), 'clearSave не сбросил прогресс');

// Маленький экран: меняем размеры и перерисовываем
screen.w = 320;
screen.h = 480;
window.dispatchEvent(new window.Event('resize'));
frames(4);
check(ctxCalls.total > 0, 'после resize ничего не рисуется');

// Сломанное хранилище: localStorage бросает при записи — игра не должна падать
const original = window.localStorage.setItem;
Object.defineProperty(window.localStorage, 'setItem', {
  configurable: true,
  value() {
    throw new Error('quota');
  },
});
api.openMenu();
frames(2);
check(api.mode === 'menu', 'при сломанном хранилище меню не работает');
check(api.save && Array.isArray(api.save.stars), 'сохранение потерялось при сломанном хранилище');
Object.defineProperty(window.localStorage, 'setItem', { configurable: true, value: original });

api.stopAudio();
await shoot('final');

/* ---------- страница записок и галерея обложек ---------- */
for (const [page, entry, probe] of [
  [
    'love.html',
    'assets/js/love.js',
    (d) => {
      check(d.querySelectorAll('.note-item').length >= 9, 'дневник не вывел записки');
      check(/Егору и Лизе/.test(d.getElementById('giftTitle').textContent || ''), 'в дневнике нет подарка');
      check(d.querySelectorAll('#giftLines p').length >= 3, 'в дневнике пустой текст подарка');
      check(/Поршик/.test(d.getElementById('giftSign').textContent || ''), 'у подарка в дневнике нет подписи');
    },
  ],
  [
    'covers.html',
    'assets/js/covers-page.js',
    (d) => {
      check(d.querySelectorAll('.cover-card').length === 10, 'в галерее не десять обложек');
      check(d.querySelectorAll('.msg-card').length >= 8, 'мало текстов для Telegram');
      const first = d.querySelector('.msg-text').textContent || '';
      check(first.includes('https://miagpt.github.io/game/'), 'в тексте нет ссылки на игру');
      check(!/\{url\}/.test(d.body.innerHTML), 'остался плейсхолдер {url}');
      check(d.querySelectorAll('.cover-shot img').length === 10, 'у обложек нет картинок');
      check(!!d.querySelector('.msg-card button'), 'нет кнопки копирования');
    },
  ],
]) {
  const html = await readFile(path.join(root, page), 'utf8');
  const bundle = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    logLevel: 'silent',
  });
  const pageDom = new JSDOM(html, { url: `https://miagpt.github.io/game/${page}`, runScripts: 'outside-only', pretendToBeVisual: true });
  pageDom.window.addEventListener('error', (e) => errors.push(`${page}: ${e.message}`));
  pageDom.window.eval(bundle.outputFiles[0].text);
  try {
    probe(pageDom.window.document);
  } catch (e) {
    problems.push(`${page}: ${e.message}`);
  }
  pageDom.window.close();
}

/* ---------- отчёт ---------- */
dom.window.close();

const uniq = [...new Set(errors)];
if (uniq.length) {
  console.error('Ошибки во время прогона:');
  for (const e of uniq.slice(0, 20)) console.error(' -', e);
}
if (problems.length) {
  console.error('Проблемы E2E:');
  for (const p of problems) console.error(' -', p);
}
if (!uniq.length && !problems.length) {
  console.log(`E2E пройден: ${Math.round(t / 1000)} с симуляции, ${ctxCalls.total} вызовов canvas, ошибок нет.`);
} else {
  process.exitCode = 1;
}
