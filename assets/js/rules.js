/* ═══════════════════════════════════════════════════════════════
   ПОРШИК · КОТ, КОТОРЫЙ ЛЕТАЕТ — правила игры
   Чистые функции без DOM: их гоняют unit-тесты, бот-симуляция
   и проверки сложности. Меняете баланс — меняйте здесь, и
   проверки покажут, не стала ли игра непроходимой.
   ═══════════════════════════════════════════════════════════════ */

import { LEVELS, SKINS, MISSIONS, HER, HERO } from './content.js';

export const SAVE_KEY = 'porshik.save.v2';
export const SAVE_VERSION = 2;
export const ROUNDS = LEVELS.length;

/* Размеры игрового мира. Мир всегда 720 единиц высотой:
   при рендере он масштабируется под экран, поэтому телефон и
   компьютер играются одинаково честно. */
export const WORLD = {
  H: 720,
  GROUND: 664,
  GRAVITY: 1350,
  FLAP: -400,
  MAX_FALL: 620,
  RADIUS: 20,
  GATE_W: 80,
};

/* Подстановка имён в тексты: {name} {sweet} {dative}. */
export function fill(text, vars = HER) {
  return String(text ?? '').replace(/\{(name|sweet|dative)\}/g, (_, key) => String(vars[key] ?? ''));
}

/* Параметры бесконечного режима: плавный рост сложности. */
export function endlessParams(passed = 0) {
  const p = Math.max(0, Number(passed) || 0);
  const k = Math.min(1, p / 45);
  return {
    speed: 172 + 70 * k,
    gap: 208 - 52 * k,
    spacing: 305 - 26 * k,
    move: p > 12 ? Math.min(50, (p - 12) * 2.5) : 0,
    world: ENDLESS_WORLDS[Math.floor(p / 6) % ENDLESS_WORLDS.length],
  };
}

export const ENDLESS_WORLDS = LEVELS.map((l) => l.world);

/* Опасности бесконечного режима: первые шесть ворот — разминка. */
export const ENDLESS_HAZARDS = {
  roof: 'dust',
  kitchen: 'steam',
  attic: 'dust',
  yarn: 'yarn',
  street: 'wind',
  rain: 'drop',
  bakery: 'flour',
  fireplace: 'ember',
  night: 'pigeon',
  home: 'steam',
};

export function endlessHazards(passed = 0) {
  const p = Math.max(0, Number(passed) || 0);
  if (p < 6) return [];
  if (p < 12) return ['dust'];
  const world = endlessParams(p).world;
  const list = [ENDLESS_HAZARDS[world] || 'dust'];
  if (p >= 60 && !list.includes('yarn')) list.push('yarn');
  return list;
}

/* Сколько рыбок было на уровне (для звёзд и прогресса). */
export function totalFishEstimate(level) {
  const l = level;
  if (!l) return 0;
  const calmGate = l.calmFrom != null ? Math.round(l.gates * l.calmFrom) : Infinity;
  let n = l.gates; // по рыбке в каждом просвете
  for (let i = 0; i < l.gates; i++) n += i >= calmGate && i > 0 ? 4 : 2;
  return n + 3; // дорожка к финишу
}

/* Звёзды: 1 — пройдено, 2 — собрано 65% рыбок, 3 — без потерь. */
export function starsFor({ cleared, collected, total, livesLost }) {
  if (!cleared) return 0;
  let stars = 1;
  if (total > 0 && collected >= Math.ceil(total * 0.65)) stars++;
  if ((Number(livesLost) || 0) === 0) stars++;
  return Math.min(3, stars);
}

/* Сколько рыбок начисляется за собранное на уровне. */
export function fishReward({ cleared, collected, gates, stars = 0 }) {
  const base = Math.max(0, Math.floor(collected));
  if (!cleared) return base + Math.floor(base / 4); // не прошёл — но крошки остаются
  const bonus = Math.ceil(gates / 2) + stars * 2;
  return base + bonus;
}

/* Прогресс миссии 0..1 — для полосок в «Дневнике». */
export function missionProgress(mission, save) {
  const s = safeSave(save);
  switch (mission.kind) {
    case 'played':
      return Math.min(1, s.played / mission.goal);
    case 'levels':
      return Math.min(1, s.stars.filter((x) => x > 0).length / mission.goal);
    case 'starsLevel':
      return Math.min(1, (s.stars[mission.level - 1] || 0) / mission.goal);
    case 'flawless':
      return s.flawless.includes(mission.level) ? 1 : 0;
    case 'total':
      return Math.min(1, s.totalFish / mission.goal);
    case 'best':
      return Math.min(1, s.best / mission.goal);
    case 'final':
      return s.stars[ROUNDS - 1] > 0 ? 1 : 0;
    default:
      return 0;
  }
}

export function earnedMissions(save) {
  const s = safeSave(save);
  return MISSIONS.filter((m) => missionProgress(m, s) >= 1).map((m) => m.id);
}

/* ---------- Сохранение ---------- */

export function blankSave() {
  return {
    v: SAVE_VERSION,
    fish: 0,
    totalFish: 0,
    best: 0,
    plays: 0,
    played: 0,
    stars: Array(ROUNDS).fill(0),
    bestRun: Array(ROUNDS).fill(0), // лучший сбор рыбок на уровне
    flawless: [],
    seenNotes: [],
    seenGifts: [],
    missions: [],
    skins: ['classic'],
    skin: 'classic',
    sound: true,
    music: true,
    giftClaimed: '',
    endless: { passed: 0, fish: 0 },
  };
}

export function isUnlocked(save, levelId) {
  const s = safeSave(save);
  if (levelId <= 1) return true;
  if (s.stars[levelId - 1] > 0) return true;
  return s.stars[levelId - 2] > 0;
}

export function nextLevel(save) {
  const s = safeSave(save);
  for (let i = 0; i < ROUNDS; i++) if (!s.stars[i]) return i + 1;
  return ROUNDS;
}

/* Нормализация сохранения: всё, что пришло из localStorage,
   localStorage из другой версии или из консоли, приводится к
   безопасному виду. Функция никогда не бросает исключений.
   Данные старой версии (pies / hearts) читаются как рыбки. */
export function normalizeSave(value) {
  const base = blankSave();
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const int = (v, max = 1e9) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
  };
  const out = { ...base };
  const fishRaw = raw.fish != null ? raw.fish : raw.pies;
  const totalRaw = raw.totalFish != null ? raw.totalFish : raw.totalPies;
  out.fish = int(fishRaw);
  out.totalFish = Math.max(out.fish, int(totalRaw));
  out.best = int(raw.best);
  out.plays = int(raw.plays);
  out.played = int(raw.played);
  out.stars = Array.from({ length: ROUNDS }, (_, i) => {
    const n = Math.floor(Number(Array.isArray(raw.stars) ? raw.stars[i] : 0));
    return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
  });
  const bestRuns = Array.isArray(raw.bestRun) ? raw.bestRun : raw.hearts;
  out.bestRun = Array.from({ length: ROUNDS }, (_, i) => int(Array.isArray(bestRuns) ? bestRuns[i] : 0));
  const idList = (list, max) =>
    Array.isArray(list) ? [...new Set(list.filter((n) => Number.isInteger(n) && n >= 1 && n <= max))] : [];
  out.flawless = idList(raw.flawless, ROUNDS);
  out.seenNotes = idList(raw.seenNotes, ROUNDS);
  out.seenGifts = idList(raw.seenGifts, ROUNDS);
  const missionIds = new Set(MISSIONS.map((m) => m.id));
  out.missions = Array.isArray(raw.missions) ? [...new Set(raw.missions.filter((id) => missionIds.has(id)))] : [];
  const skinIds = new Set(SKINS.map((s) => s.id));
  out.skins = [...new Set(['classic', ...(Array.isArray(raw.skins) ? raw.skins.filter((id) => skinIds.has(id)) : [])])];
  out.skin = skinIds.has(raw.skin) ? raw.skin : 'classic';
  if (!out.skins.includes(out.skin)) out.skin = 'classic';
  out.sound = typeof raw.sound === 'boolean' ? raw.sound : true;
  out.music = raw.music !== false;
  out.giftClaimed = typeof raw.giftClaimed === 'string' ? raw.giftClaimed.slice(0, 10) : '';
  const endless = raw.endless && typeof raw.endless === 'object' ? raw.endless : {};
  out.endless = { passed: int(endless.passed), fish: int(endless.fish) };
  return out;
}

function safeSave(save) {
  return save && Array.isArray(save.stars) && save.stars.length === ROUNDS ? save : normalizeSave(save);
}

/* Записать результат уровня. Возвращает { save, first, stars, reward, gift }.
   Чистая функция: исходное сохранение не мутируется. */
export function applyResult(save, { levelId, cleared, collected = 0, total = 0, livesLost = 0, mode = 'story', passed = 0 }) {
  const prev = safeSave(save);
  const next = {
    ...prev,
    stars: [...prev.stars],
    bestRun: [...prev.bestRun],
    flawless: [...prev.flawless],
    seenNotes: [...prev.seenNotes],
    endless: { ...prev.endless },
  };
  const gain = fishReward({ cleared, collected, gates: levelId ? LEVELS[levelId - 1].gates : 0, stars: 0 });
  next.fish += gain;
  next.totalFish += gain;
  next.played += 1;
  if (mode === 'endless') {
    const gates = Math.max(0, Math.floor(Number(passed) || 0));
    next.best = Math.max(next.best, gates);
    next.endless = {
      passed: Math.max(prev.endless.passed, Math.min(gates, 1e6)),
      fish: Math.max(prev.endless.fish, Math.floor(collected)),
    };
    return { save: next, first: false, stars: 0, reward: gain, gift: null, newBest: next.best > prev.best };
  }
  const stars = starsFor({ cleared, collected, total, livesLost });
  let first = false;
  let gift = null;
  if (cleared) {
    const i = levelId - 1;
    first = next.stars[i] === 0;
    next.stars[i] = Math.max(next.stars[i], stars);
    next.bestRun[i] = Math.max(next.bestRun[i], Math.floor(collected));
    if (livesLost === 0 && !next.flawless.includes(levelId)) next.flawless.push(levelId);
    if (levelId < ROUNDS) {
      const noteWasSeen = next.seenNotes.includes(levelId);
      if (!noteWasSeen) next.seenNotes.push(levelId);
      // записку показываем один раз, но кнопка «ещё раз» её не дублирует
      gift = noteWasSeen ? null : { kind: 'note', level: levelId };
    } else if (levelId === ROUNDS) {
      gift = { kind: 'letter', level: levelId };
    }
  }
  return { save: next, first, stars, reward: gain, gift, newBest: false };
}

/* Покупка облика. Возвращает { save, ok, reason }. */
export function buySkin(save, skinId) {
  const s = safeSave(save);
  const skin = SKINS.find((x) => x.id === skinId);
  if (!skin) return { save: s, ok: false, reason: 'unknown' };
  if (s.skins.includes(skinId)) return { save: s, ok: false, reason: 'owned' };
  if (s.fish < skin.price) return { save: s, ok: false, reason: 'poor' };
  return { save: { ...s, fish: s.fish - skin.price, skins: [...s.skins, skinId] }, ok: true, reason: 'bought' };
}

/* Выдача наград за выполненные миссии. Возвращает { save, unlocked }.
   Наградой считаются новые облики и стартовый пузырь. */
export function claimMissions(save) {
  let s = safeSave(save);
  const unlocked = [];
  for (const id of earnedMissions(s)) {
    if (s.missions.includes(id)) continue;
    const m = MISSIONS.find((x) => x.id === id);
    if (!m) continue;
    s = { ...s, missions: [...s.missions, id] };
    const skin = SKINS.find((x) => `Наряд «${x.name}»` === m.reward);
    if (skin && !s.skins.includes(skin.id)) {
      s = { ...s, skins: [...s.skins, skin.id] };
      unlocked.push(skin);
    } else if (m.reward === 'Пузырь на старт') {
      s = { ...s, starterShield: true };
    }
  }
  return { save: s, unlocked };
}

/* Текст письма и записок — с подставленными именами. */
export function noteText(note, vars = HER) {
  return { ...note, text: fill(note.text, vars) };
}

export function levelIntro(level, vars = HER) {
  return { ...level, story: fill(level.story, vars) };
}

export function letterLines(letter, vars = HER) {
  return {
    greeting: fill(letter.greeting, vars),
    paragraphs: letter.paragraphs.map((p) => fill(p, vars)),
    signoff: fill(letter.signoff, vars),
    signature: letter.signature,
    title: letter.title,
  };
}

/* Оценка сложности мира для интерфейса (не для геймплея). */
export function difficultyOf(level) {
  const g = LEVELS.filter((l) => l.id <= level.id);
  const avg = (key) => g.reduce((s, l) => s + l[key], 0) / g.length;
  const speed = avg('speed');
  const gap = avg('gap');
  const hazards = g.reduce((s, l) => s + l.hazards.length, 0);
  const raw = (speed - 150) / 70 + (230 - gap) / 40 + hazards / 6;
  return Math.max(1, Math.min(5, Math.round(raw)));
}

export const HERO_NAME = HERO.name;
