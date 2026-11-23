/* ═══════════════════════════════════════════════════════════════
   ПОРШИК · КОТ, КОТОРЫЙ ЛЕТАЕТ — игра на странице
   Связывает симуляцию (sim.js), отрисовку (render.js), звук
   (audio.js) и сохранение (rules.js) с интерфейсом play.html.
   ═══════════════════════════════════════════════════════════════ */

import {
  LEVELS,
  NOTES,
  SKINS,
  HERO,
  HER,
  MISSIONS,
  TELEGRAMS,
  FINAL_LETTER,
  SPECIAL_GIFT,
} from './content.js';
import {
  SAVE_KEY,
  ROUNDS,
  WORLD,
  blankSave,
  normalizeSave,
  applyResult,
  buySkin,
  claimMissions,
  missionProgress,
  earnedMissions,
  isUnlocked,
  nextLevel,
  starsFor,
  fill,
  levelIntro,
  noteText,
  letterLines,
  fishReward,
  totalFishEstimate,
} from './rules.js';
import { Sim } from './sim.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { themeOf } from './themes.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- сохранение ---------------- */

let storageOk = true;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return normalizeSave(raw ? JSON.parse(raw) : null);
  } catch {
    storageOk = false;
    return blankSave();
  }
}

let save = loadSave();

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    storageOk = false;
  }
}

/* ---------------- состояние ---------------- */

const canvas = $('canvas');
const renderer = new Renderer(canvas);
const sound = new Sound();
sound.setSound(save.sound);
sound.setMusic(save.music);

let sim = null;
let mode = 'menu'; // menu | levels | wardrobe | playing | paused | win | lose | note | letter
let screen = 'screenMenu';
let pendingLevel = nextLevel(save);
let endlessRecord = { passed: 0, fish: 0 };
let lastResult = null;
let rafId = 0;
let lastFrame = 0;
let telegramShownFor = new Set();
let idleLineAt = 0;
let idleIndex = 0;
let currentNote = null;
let hintTimer = 0;
let hiddenPause = false;

/* ---------------- интерфейс ---------------- */

function showScreen(id) {
  for (const el of document.querySelectorAll('.panel')) el.hidden = el.id !== id;
  screen = id;
  document.body.dataset.screen = id;
}

function hidePanels() {
  for (const el of document.querySelectorAll('.panel')) el.hidden = true;
  screen = '';
  document.body.dataset.screen = '';
}

function toast(text, ms = 2400) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, ms);
}

function setBubble(text, ms = 3200) {
  if (!text) {
    $('bubble').hidden = true;
    return;
  }
  $('bubbleText').textContent = fill(text);
  $('bubble').hidden = false;
  clearTimeout(setBubble._t);
  setBubble._t = setTimeout(() => {
    $('bubble').hidden = true;
  }, ms);
}

function starsMarkup(n) {
  let out = '';
  for (let i = 0; i < 3; i++) out += `<svg class="star ${i < n ? 'on' : ''}"><use href="#i-star"/></svg>`;
  return out;
}

function updateHud() {
  const s = sim;
  const lives = s ? Math.max(0, s.lives) : 3;
  $('hudLivesText').textContent = String(lives);
  $('hudLives').classList.toggle('is-low', lives <= 1);
  $('hudFish').textContent = String(s ? s.fish : save.fish);
  if (s && s.mode === 'endless') {
    $('hudTrack').textContent = `Ворот: ${s.passed}`;
    $('hudStars').textContent = `Рекорд ${save.best}`;
  } else {
    const lvl = s ? s.level : LEVELS[Math.min(ROUNDS, pendingLevel) - 1];
    $('hudTrack').textContent = `Мир ${lvl.id}/${ROUNDS}`;
    const stars = s && s.passed && lvl.id ? Math.max(save.stars[lvl.id - 1] || 0, 0) : save.stars[(lvl?.id || 1) - 1] || 0;
    $('hudStars').innerHTML = starsMarkup(Math.max(stars, 0));
  }
  const powers = [];
  if (s) {
    if (s.shield) powers.push({ icon: '🫧', label: 'Пузырь', cls: 'shield' });
    if (s.magnet > 0) powers.push({ icon: '🧲', label: `${Math.ceil(s.magnet)} c`, cls: 'magnet' });
    if (s.energizer > 0) powers.push({ icon: '⚡', label: `${Math.ceil(s.energizer)} c`, cls: 'energy' });
  }
  $('powers').innerHTML = powers.map((p) => `<span class="power ${p.cls}">${p.icon}<i>${p.label}</i></span>`).join('');
}

/* ---------------- меню и экраны ---------------- */

function openMenu() {
  mode = 'menu';
  stopLoop();
  const id = clamp(pendingLevel, 1, ROUNDS);
  const level = LEVELS[id - 1];
  const intro = levelIntro(level);
  $('introEyebrow').textContent = `МИР ${id} ИЗ ${ROUNDS} · ${fill(level.tagline).toUpperCase()}`;
  $('introName').textContent = level.name;
  $('introStory').textContent = intro.story;
  $('introTip').textContent = level.tip;
  $('walletFish').textContent = String(save.fish);
  $('menuBest').textContent = String(save.best);
  $('btnEndless').textContent = `Бесконечный полёт · рекорд ${save.best}`;
  updateMissionBadge();
  updateDailyHint();
  showScreen('screenMenu');
  sound.setStyle('menu');
  sim = createIdleSim(id);
  renderStill();
}

function createIdleSim(levelId, endless = false) {
  const s = new Sim({
    mode: endless ? 'endless' : 'story',
    levelId,
    viewW: renderer.worldW,
    seed: (Date.now() ^ (levelId * 7919)) >>> 0,
    lives: 3,
  });
  s.status = 'ready';
  s.cat.y = 320;
  s.startY = 320;
  renderer.setSkin(save.skin);
  renderer.dim = 0;
  return s;
}

function updateMissionBadge() {
  const earned = earnedMissions(save).length;
  const done = save.missions.length;
  const badge = $('missionBadge');
  if (!badge) return;
  badge.hidden = earned <= done;
  badge.textContent = String(Math.max(0, earned - done));
}

function updateDailyHint() {
  const el = $('menuDaily');
  if (!el) return;
  const key = new Date().toISOString().slice(0, 10);
  if (save.giftClaimed === key) {
    el.hidden = false;
    $('menuDailyText').textContent = 'Подарок дня уже в кошельке. Приходи завтра!';
    return;
  }
  el.hidden = true;
}

function renderMissions() {
  const done = save.missions.length;
  $('missionCount').textContent = `${done} / ${MISSIONS.length}`;
  $('missionList').innerHTML = MISSIONS.map((m) => {
    const done = save.missions.includes(m.id);
    const progress = Math.min(1, missionProgress(m, save));
    const pct = Math.round(progress * 100);
    return `<article class="mission ${done ? 'is-done' : ''}">
      <header>
        <h3>${m.title}</h3>
        <span class="mission-reward">${done ? '✔ получено' : m.reward}</span>
      </header>
      <p>${m.desc}</p>
      <div class="mission-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Прогресс миссии «${m.title}»"><i style="width:${pct}%"></i></div>
    </article>`;
  }).join('');
  showScreen('screenMissions');
}

function renderLevels() {
  $('starTotal').textContent = `★ ${save.stars.reduce((a, b) => a + b, 0)} / ${ROUNDS * 3}`;
  $('levelList').innerHTML = LEVELS.map((l, i) => {
    const open = isUnlocked(save, l.id);
    const stars = save.stars[i] || 0;
    const best = save.bestRun[i] || 0;
    return `<button class="level-row ${open ? '' : 'is-locked'}" type="button" data-level="${l.id}" ${open ? '' : 'disabled'}>
      <span class="level-ico" style="--tint:${themeOf(l.world).accent}">${l.icon}</span>
      <span class="level-main">
        <b>${l.id}. ${l.name}</b>
        <i>${open ? fill(l.tagline) : 'Пройди предыдущий мир'}</i>
      </span>
      <span class="level-stars">${starsMarkup(stars)}</span>
      <span class="level-best">${best ? `${best} 🐟` : ''}</span>
    </button>`;
  }).join('');
  for (const row of document.querySelectorAll('#levelList [data-level]')) {
    row.addEventListener('click', () => {
      const id = Number(row.dataset.level);
      if (!isUnlocked(save, id)) return;
      pendingLevel = id;
      sound.click();
      openMenu();
    });
  }
  showScreen('screenLevels');
}

function renderWardrobe() {
  $('wardrobeFish').textContent = `${save.fish} 🐟`;
  $('skinList').innerHTML = SKINS.map((s) => {
    const owned = save.skins.includes(s.id);
    const active = save.skin === s.id;
    return `<button class="skin-card ${active ? 'is-active' : ''} ${owned ? '' : 'is-shop'}" type="button" data-skin="${s.id}">
      <span class="skin-preview" data-skin-preview="${s.id}"><canvas width="120" height="120" aria-hidden="true"></canvas></span>
      <b>${s.name}</b>
      <i>${s.hint}</i>
      <span class="skin-price">${active ? 'Надет' : owned ? 'Надеть' : `${s.price} 🐟`}</span>
    </button>`;
  }).join('');
  // мини-превью: рисуем Поршика в каждом облике
  for (const holder of document.querySelectorAll('[data-skin-preview]')) {
    const c = holder.querySelector('canvas');
    drawSkinPreview(c, holder.dataset.skinPreview);
  }
  for (const card of document.querySelectorAll('#skinList [data-skin]')) {
    card.addEventListener('click', () => {
      const id = card.dataset.skin;
      if (save.skins.includes(id)) {
        save = { ...save, skin: id };
        persist();
        renderer.setSkin(id);
        sound.click();
        renderWardrobe();
        return;
      }
      const res = buySkin(save, id);
      if (!res.ok) {
        toast(res.reason === 'poor' ? 'Ещё не хватает рыбок. Полетаем?' : 'Такой облик уже есть');
        sound.hurt();
        return;
      }
      save = { ...res.save, skin: id };
      persist();
      renderer.setSkin(id);
      sound.power();
      toast(`Облик «${SKINS.find((s) => s.id === id).name}» куплен!`);
      renderWardrobe();
      updateWalletEverywhere();
    });
  }
  showScreen('screenWardrobe');
}

function drawSkinPreview(c, skinId) {
  const r = new Renderer(c);
  r.reduceMotion = true;
  r.setSkin(skinId);
  const fake = {
    world: 'loft',
    dist: 0,
    status: 'ready',
    inv: 0,
    shield: false,
    magnet: 0,
    energizer: 0,
    catX: 60,
    cat: { y: 62, vy: 0, rot: 0 },
    gates: [],
    items: [],
    hazards: [],
    warnings: [],
    wind: { state: 'idle' },
    t: 0,
  };
  const ctx = c.getContext('2d');
  const tone = r.ctx;
  if (tone) tone.clearRect(0, 0, 120, 120);
  r.time = 0.6;
  r.pawT = 0.6;
  r.worldW = 120;
  r.k = 1;
  r.ctx = ctx || tone;
  if (r.ctx) {
    r.ctx.save();
    r.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (r.ctx.clearRect) r.ctx.clearRect(0, 0, 120, 120);
    r.drawCat(r.ctx, fake);
    r.ctx.restore();
  }
  void sim;
}

function updateWalletEverywhere() {
  $('walletFish').textContent = String(save.fish);
  const w = $('wardrobeFish');
  if (w) w.textContent = `${save.fish} 🐟`;
}

function renderStill() {
  renderer.resize();
  renderer.draw(sim, { paused: false });
}

/* ---------------- запуск полёта ---------------- */

function startRun(levelId = pendingLevel, endless = false) {
  sound.unlock();
  const id = clamp(levelId, 1, ROUNDS);
  sim = new Sim({
    mode: endless ? 'endless' : 'story',
    levelId: id,
    viewW: renderer.worldW,
    seed: Date.now() >>> 0,
    lives: 3,
  });
  // Награда миссии «Первый полёт»: пузырь уже на старте.
  if (save.starterShield && !endless) {
    sim.applyPower('shield');
    sim.events.length = 0; // награда не должна проигрываться как подобранный бонус
  }
  renderer.setSkin(save.skin);
  renderer.particles.length = 0;
  renderer.floats.length = 0;
  telegramShownFor = new Set();
  idleLineAt = 0;
  idleIndex = 0;
  endlessRecord = { passed: 0, fish: 0 };
  lastResult = null;
  mode = 'playing';
  hidePanels();
  $('hintText').textContent = endless ? 'Бесконечный полёт · Esc — пауза' : 'Тап, клик или пробел — взмах';
  sound.setStyle(themeOf(sim.world).label ? sim.world : 'roof');
  updateHud();
  startLoop();
}

function startLoop() {
  stopLoop();
  lastFrame = performance.now();
  rafId = requestAnimationFrame(frame);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;
  if (!sim) return;
  if (mode === 'playing') {
    sim.step(dt);
    handleEvents();
    updateHud();
    showTelegrams();
    idleComment(dt);
  }
  renderer.stepEffects(mode === 'playing' || mode === 'menu' ? dt : dt * 0.25);
  renderer.draw(sim, { paused: mode === 'paused' });
}

function idleComment(dt) {
  if (!sim || sim.status !== 'playing') return;
  idleLineAt += dt;
  if (idleLineAt > 26 && !$('bubble').hidden === false) {
    idleLineAt = 0;
    const line = HERO.idleLines[idleIndex++ % HERO.idleLines.length];
    setBubble(line, 2600);
  }
}

function showTelegrams() {
  if (!sim || sim.mode !== 'story') return;
  const t = TELEGRAMS.find((x) => x.level === sim.levelId);
  if (!t || telegramShownFor.has(t.level)) return;
  if (sim.progress >= t.at) {
    telegramShownFor.add(t.level);
    setBubble(t.text, 3600);
    sound.telegram();
    sound.meow();
  }
}

/* ---------------- события симуляции ---------------- */

function handleEvents() {
  for (const ev of sim.events) {
    if (ev.type === 'fish') {
      renderer.float('+1', sim.catX + 18, sim.cat.y - 26, '#e6f4fb', 20);
      renderer.burst(sim.catX + 16, sim.cat.y - 10, 4, '#a9d4e8', 90);
      sound.fish();
    } else if (ev.type === 'streak') {
      renderer.float(`+${ev.bonus} подряд!`, sim.catX + 10, sim.cat.y - 46, '#fff3c4', 22);
      renderer.burst(sim.catX, sim.cat.y - 20, 10, '#ffd166', 150, { shape: 'star' });
    } else if (ev.type === 'treat') {
      const names = { sausage: 'Сосиска', bun: 'Булочка', mouse: 'Мышка', cream: 'Сливки', heart: 'Сердечко' };
      renderer.float(`+${ev.worth} ${names[ev.treat] || 'Бонус'}`, sim.catX + 10, sim.cat.y - 40, '#ffd8e2', 22);
      renderer.burst(sim.catX, sim.cat.y - 10, 12, ev.treat === 'cream' ? '#f7f1e3' : '#f7a1c4', 170, { shape: 'heart' });
      sound.treat();
    } else if (ev.type === 'power') {
      const labels = { shield: 'Пузырь!', magnet: 'Магнит!', energizer: 'Энергия!' };
      renderer.float(`${labels[ev.power]}`, sim.catX, sim.cat.y - 44, '#d6f2ff', 24);
      sound.power();
      updateHud();
    } else if (ev.type === 'hurt') {
      sound.hurt();
      renderer.shake = 1;
      renderer.flash = 0.6;
      renderer.flashColor = '#ff6b81';
      renderer.burst(sim.catX, sim.cat.y, 14, '#ffcf9e', 210, { shape: 'dot' });
      const line = HERO.ouchLines[Math.floor(Math.random() * HERO.ouchLines.length)];
      setBubble(line, 1600);
      sound.meow();
      updateHud();
    } else if (ev.type === 'shieldBreak') {
      sound.shield();
      renderer.burst(sim.catX, sim.cat.y, 16, '#8fd3f4', 220);
      renderer.float('Пузырь спас!', sim.catX, sim.cat.y - 40, '#cdefff', 20);
      updateHud();
    } else if (ev.type === 'gate') {
      if (ev.nearMiss) renderer.float('впритирку!', sim.catX, sim.cat.y - 30, '#ffffff', 18);
    } else if (ev.type === 'danger') {
      // лёгкая тряска, чтобы игрок заметил опасность
      renderer.shake = Math.max(renderer.shake, 0.25);
    } else if (ev.type === 'won') {
      finishRun(true);
    } else if (ev.type === 'lost') {
      finishRun(false);
    }
  }
  sim.events.length = 0;
}

/* ---------------- финал полёта ---------------- */

function finishRun(cleared) {
  if (mode !== 'playing') return;
  const endless = sim.mode === 'endless';
  const collected = sim.pathFish;
  const total = Math.max(sim.fishTotal, totalFishEstimate(sim.level), 1);
  const res = applyResult(save, {
    levelId: endless ? 0 : sim.levelId,
    cleared,
    collected,
    total,
    livesLost: sim.lostLives,
    mode: sim.mode,
    passed: sim.passed,
  });
  save = res.save;
  const claimed = claimMissions(save);
  if (claimed.unlocked.length) {
    save = claimed.save;
    setTimeout(() => toast(`Миссия выполнена! Новый облик: ${claimed.unlocked.map((s) => s.name).join(', ')}`, 3600), 600);
  } else {
    save = claimed.save;
  }
  persist();
  updateWalletEverywhere();

  if (cleared) sound.win();
  else sound.lose();

  if (endless) {
    lastResult = { endless: true, passed: sim.passed, fish: collected, reward: res.reward, newBest: res.newBest, cleared };
    pendingLevel = clamp(pendingLevel, 1, ROUNDS);
    showLoseScreen(true);
    mode = 'lose';
    return;
  }

  if (cleared) {
    lastResult = { ...res, collected, total };
    pendingLevel = clamp(sim.levelId + 1, 1, ROUNDS);
    showWinScreen();
    mode = 'win';
  } else {
    lastResult = { ...res, collected, total };
    showLoseScreen(false);
    mode = 'lose';
  }
}

function showWinScreen() {
  const r = lastResult;
  const level = LEVELS[sim.levelId - 1];
  const isFinal = sim.levelId === ROUNDS;
  $('winEyebrow').textContent = isFinal ? 'ПОСЛЕДНИЙ МИР ПРОЙДЕН' : `МИР ${sim.levelId} ПРОЙДЕН`;
  $('winTitle').textContent = isFinal ? 'Дома!' : ['Мяу!', 'Вот это полёт!', 'Рыбки доставлены!'][Math.floor(Math.random() * 3)];
  $('winStars').innerHTML = starsMarkup(r.stars);
  const percents = r.total ? Math.round((r.collected / r.total) * 100) : 100;
  $('winText').textContent = isFinal
    ? 'Последний перелёт закончен. Впереди — записка, письмо и очень тёплый плед.'
    : `${level.name}: собрано ${r.collected} рыбок (${percents}% пути), потеряно жизней: ${sim.lostLives}.`;
  $('winReward').textContent = `+${r.reward} рыбок в кошелёк · всего ${save.fish}`;
  $('btnWinNext').hidden = isFinal;
  $('btnWinNext').textContent = 'Дальше';
  $('btnNote').textContent = isFinal ? 'Открыть письмо' : 'Открыть записку';
  $('btnNote').hidden = !r.gift;
  $('btnWinRetry').hidden = false;
  showScreen('screenWin');
  if (r.stars >= 3) renderer.burst(renderer.worldW / 2, 240, 22, '#ffd166', 260, { shape: 'star', gravity: 120 });
}

function showLoseScreen(endless) {
  const r = lastResult;
  $('loseTitle').textContent = endless ? 'Полёт окончен' : ['Ой. Усы!', 'Поршик присел отдохнуть', 'Лапа устала'][Math.floor(Math.random() * 3)];
  $('loseText').textContent = endless
    ? `Пройдено ворот: ${r.passed}. Собрано рыбок: ${r.fish}. ${r.newBest ? 'Это новый рекорд! 🎉' : `Рекорд: ${save.best}.`}`
    : 'Ничего страшного: рыбки уже в кошельке, а следующая попытка всегда теплее.';
  const pct = endless ? 100 : Math.round(sim.progress * 100);
  $('loseProgressText').textContent = endless ? `Ворот пройдено: ${r.passed}` : `Пройдено ${pct}%`;
  $('loseGain').textContent = `+${r.reward} в кошелёк`;
  $('btnRetry').textContent = endless ? 'Ещё полёт' : 'Ещё раз';
  showScreen('screenLose');
}

/* ---------------- записки и письмо ---------------- */

function openNote() {
  if (!lastResult || !lastResult.gift) return;
  const gift = lastResult.gift;
  if (gift.kind === 'letter') {
    openLetter();
    return;
  }
  const note = NOTES.find((n) => n.level === gift.level);
  if (!note) return;
  const n = noteText(note);
  currentNote = note;
  $('noteHead').textContent = n.head;
  $('noteTitle').textContent = n.title;
  $('noteText').textContent = n.text;
  $('noteSign').textContent = `— ${n.from}`;
  showScreen('screenNote');
  mode = 'note';
}

/* Подарок версии 2.0: блок внутри финального письма. */
function renderGiftCard() {
  const card = $('giftCard');
  if (!card) return;
  $('giftBadge').textContent = SPECIAL_GIFT.badge;
  $('giftTitle').textContent = SPECIAL_GIFT.title;
  $('giftSub').textContent = SPECIAL_GIFT.subtitle;
  $('giftLines').innerHTML = SPECIAL_GIFT.lines.map((line) => `<p>${line}</p>`).join('');
  $('giftSign').textContent = `${SPECIAL_GIFT.from} — ${fill(SPECIAL_GIFT.signature)}`;
}

function openLetter() {
  const l = letterLines(FINAL_LETTER);
  $('letterTitle').textContent = l.title;
  $('letterHi').textContent = l.greeting;
  $('letterBody').innerHTML = l.paragraphs.map((p) => `<p>${p}</p>`).join('');
  $('letterSign').textContent = `${l.signoff} — ${l.signature}`;
  renderGiftCard();
  showScreen('screenLetter');
  mode = 'letter';
  renderer.burst(renderer.worldW / 2, WORLD.H - 60, 26, '#ffb3c6', 220, { shape: 'heart', gravity: -90 });
}

/* ---------------- пауза ---------------- */

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  $('tglSound').setAttribute('aria-pressed', String(save.sound));
  $('tglMusic').setAttribute('aria-pressed', String(save.music));
  showScreen('screenPause');
}

function resume() {
  if (mode !== 'paused') return;
  mode = 'playing';
  hidePanels();
  lastFrame = performance.now();
}

/* ---------------- действия ---------------- */

function onPrimary() {
  if (mode === 'playing') {
    if (sim) sim.flap();
    return;
  }
  if (mode === 'menu') {
    sound.unlock();
    startRun(pendingLevel, false);
  }
}

function bind() {
  $('btnPlay').addEventListener('click', () => {
    sound.click();
    startRun(pendingLevel, false);
  });
  $('btnLevels').addEventListener('click', () => {
    sound.click();
    renderLevels();
    mode = 'levels';
  });
  $('btnWardrobe').addEventListener('click', () => {
    sound.click();
    renderWardrobe();
    mode = 'wardrobe';
  });
  $('btnMissions').addEventListener('click', () => {
    sound.click();
    renderMissions();
    mode = 'missions';
  });
  $('btnEndless').addEventListener('click', () => {
    sound.unlock();
    sound.click();
    startRun(1, true);
  });
  $('btnPause').addEventListener('click', () => (mode === 'playing' ? pause() : resume()));
  $('btnResume').addEventListener('click', resume);
  $('btnRestart').addEventListener('click', () => {
    sound.click();
    startRun(sim && sim.mode === 'endless' ? 1 : pendingLevel, sim && sim.mode === 'endless');
  });
  $('btnRetry').addEventListener('click', () => {
    sound.click();
    if (lastResult && lastResult.endless) startRun(1, true);
    else startRun(clamp(sim ? sim.levelId : pendingLevel, 1, ROUNDS), false);
  });
  $('btnWinNext').addEventListener('click', () => {
    sound.click();
    startRun(clamp(pendingLevel, 1, ROUNDS), false);
  });
  $('btnWinRetry').addEventListener('click', () => {
    sound.click();
    startRun(sim.levelId, false);
  });
  $('btnNote').addEventListener('click', () => {
    sound.click();
    openNote();
  });
  $('btnNoteNext').addEventListener('click', () => {
    sound.click();
    if (sim && sim.mode === 'endless') {
      openMenu();
      return;
    }
    if (lastResult && lastResult.gift && lastResult.gift.kind === 'letter') {
      openLetter();
      return;
    }
    if (sim && sim.levelId >= ROUNDS) openLetter();
    else if (pendingLevel >= 1 && sim && sim.levelId < ROUNDS) startRun(clamp(pendingLevel, 1, ROUNDS), false);
    else openMenu();
  });
  $('btnLetterDone').addEventListener('click', () => {
    sound.click();
    openMenu();
    toast('Мяу! Поршик дома.', 2600);
  });
  for (const back of document.querySelectorAll('[data-go="menu"]')) {
    back.addEventListener('click', () => {
      sound.click();
      if (mode === 'paused' && sim && sim.status === 'playing') {
        // из паузы «в меню» — это осознанный выход, прогресс забега не сохраняется
        openMenu();
      } else openMenu();
    });
  }
  $('btnMute').addEventListener('click', () => toggleSound());
  $('tglSound').addEventListener('click', () => toggleSound(true));
  $('tglMusic').addEventListener('click', () => {
    save = { ...save, music: !save.music };
    persist();
    sound.setMusic(save.music);
    $('tglMusic').setAttribute('aria-pressed', String(save.music));
    syncSoundButtons();
  });

  // управление полётом
  const stage = $('stage');
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, .panel')) return;
    onPrimary();
  });
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onPrimary();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      onPrimary();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      if (mode === 'playing') pause();
      else if (mode === 'paused') resume();
    } else if (e.code === 'KeyP') {
      if (mode === 'playing') pause();
      else if (mode === 'paused') resume();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') {
      hiddenPause = true;
      pause();
    }
  });
  window.addEventListener('resize', () => {
    const w = renderer.resize();
    if (sim) sim.viewW = w;
    renderStill();
  });
  window.addEventListener('blur', () => {
    if (mode === 'playing') pause();
  });
  // возврат после покупки в другой вкладке
  window.addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY) {
      save = loadSave();
      renderer.setSkin(save.skin);
      updateWalletEverywhere();
    }
  });
}

function toggleSound(fromPause = false) {
  save = { ...save, sound: !save.sound };
  persist();
  sound.setSound(save.sound);
  if (fromPause) $('tglSound').setAttribute('aria-pressed', String(save.sound));
  syncSoundButtons();
}

function syncSoundButtons() {
  const on = save.sound;
  $('btnMute').setAttribute('aria-pressed', String(!on));
  $('btnMute').setAttribute('aria-label', on ? 'Выключить звук' : 'Включить звук');
  $('btnMute').querySelector('use').setAttribute('href', on ? '#i-sound' : '#i-mute');
}

/* ---------------- старт ---------------- */

/* Подарок дня: одна рыбка раз в календарный день за визит.
   Награда крошечная, зато повод зайти снова. */
function claimDailyGift() {
  const key = new Date().toISOString().slice(0, 10);
  if (save.giftClaimed === key) return;
  save = { ...save, fish: save.fish + 3, totalFish: save.totalFish + 3, giftClaimed: key };
  persist();
  setTimeout(() => toast('Подарок дня: +3 рыбки. Мурр!', 3200), 900);
}

function init() {
  renderer.resize();
  renderer.setSkin(save.skin);
  pendingLevel = nextLevel(save);
  bind();
  syncSoundButtons();
  if (!storageOk) {
    setTimeout(() => toast('Сохранение недоступно в этом браузере — играем без записи прогресса.', 4200), 800);
  }
  claimDailyGift();
  // первый показ Поршика в меню
  sim = createIdleSim(pendingLevel);
  openMenu();
  startLoop();
  document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
  document.addEventListener('keydown', () => sound.unlock(), { once: true });
}

init();

/* Для отладки и E2E: даём доступ к состоянию без глобальных хаков в коде игры. */
window.__porshik = {
  get save() {
    return save;
  },
  get mode() {
    return mode;
  },
  get sim() {
    return sim;
  },
  get screen() {
    return screen;
  },
  startRun,
  openMenu,
  pause,
  resume,
  applyResult: (opts) => {
    save = applyResult(save, opts).save;
    persist();
    syncSoundButtons();
  },
  clearSave: () => {
    save = blankSave();
    persist();
    pendingLevel = 1;
  },
  /* Для E2E: остановить музыку и таймеры, чтобы прогон завершался. */
  stopAudio: () => {
    try {
      sound.stopMusic();
      sound.setSound(false);
    } catch {
      /* уже остановлено */
    }
  },
};
