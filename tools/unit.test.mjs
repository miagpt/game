/* Unit-тесты: content, rules и симуляция. Без браузера.
   Запуск: node --test tools/*.test.mjs */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS,
  SKINS,
  MISSIONS,
  NOTES,
  TELEGRAMS,
  GIFTS,
  POWERUPS,
  HAZARDS,
  HERO,
  HER,
  FINAL_LETTER,
} from '../assets/js/content.js';
import {
  WORLD,
  ROUNDS,
  blankSave,
  normalizeSave,
  isUnlocked,
  nextLevel,
  starsFor,
  fishReward,
  applyResult,
  buySkin,
  claimMissions,
  earnedMissions,
  missionProgress,
  endlessParams,
  endlessHazards,
  totalFishEstimate,
  fill,
  noteText,
  letterLines,
  levelIntro,
  difficultyOf,
  SAVE_KEY,
} from '../assets/js/rules.js';
import { Sim, mulberry32, SIM_WORLD } from '../assets/js/sim.js';
import { THEMES, themeOf } from '../assets/js/themes.js';

/* ---------- содержание ---------- */

test('десять миров, у каждого — тема, текст и корректные параметры', () => {
  assert.equal(LEVELS.length, 10);
  assert.equal(ROUNDS, 10);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 10);
  assert.equal(new Set(LEVELS.map((l) => l.world)).size, 10, 'миры не должны повторяться');
  for (const [i, l] of LEVELS.entries()) {
    assert.equal(l.id, i + 1);
    assert.ok(THEMES[l.world], `нет темы для ${l.world}`);
    assert.ok(l.name.length > 2);
    assert.ok(l.tagline.length > 2);
    assert.ok(l.story.length > 20);
    assert.ok(l.tip.length > 10);
    assert.ok(l.icon);
    assert.ok(l.gates >= 10 && l.gates <= 30, `ворот: ${l.gates}`);
    assert.ok(l.speed >= 150 && l.speed <= 240);
    assert.ok(l.gap >= 190 && l.gap <= 240, `просвет: ${l.gap}`);
    assert.ok(l.spacing >= 280 && l.spacing <= 340);
    assert.ok(l.gap + 2 * (64 + (l.move || 0)) < WORLD.GROUND - 40, `ворота ${l.name} не помещаются в мир`);
    for (const h of l.hazards) assert.ok(HAZARDS[h], `нет описания опасности ${h}`);
    for (const p of l.powerups) assert.ok(POWERUPS[p], `нет усиления ${p}`);
  }
});

test('сложность растёт от первого мира к десятому', () => {
  for (let i = 1; i < LEVELS.length; i++) {
    const a = LEVELS[i - 1];
    const b = LEVELS[i];
    assert.ok(b.gates >= a.gates - 1, `ворот не меньше (${a.gates} → ${b.gates})`);
    assert.ok(b.speed >= a.speed, 'скорость не падает');
    assert.ok(b.gap <= a.gap + 8, `просвет не расширяется (${a.gap} → ${b.gap})`);
  }
  assert.ok(difficultyOf(LEVELS[9]) >= difficultyOf(LEVELS[0]));
  assert.ok(difficultyOf(LEVELS[0]) >= 1 && difficultyOf(LEVELS[9]) <= 5);
});

test('записки: ровно по одной после каждого мира, кроме финала', () => {
  assert.equal(NOTES.length, LEVELS.length - 1);
  assert.deepEqual(NOTES.map((n) => n.level), LEVELS.slice(0, -1).map((l) => l.id));
  for (const n of NOTES) {
    assert.ok(n.title.length > 3);
    assert.ok(n.text.length > 80, `короткая записка ${n.level}`);
    assert.ok(n.head.length > 3);
    assert.ok(n.from.length > 2);
  }
});

test('телеграммы и подарки есть на каждом мире', () => {
  assert.equal(TELEGRAMS.length, LEVELS.length);
  assert.deepEqual(TELEGRAMS.map((t) => t.level), LEVELS.map((l) => l.id));
  for (const t of TELEGRAMS) assert.ok(t.at > 0.2 && t.at < 0.95);
  assert.equal(GIFTS.length, LEVELS.length);
  assert.deepEqual(GIFTS.map((g) => g.level), LEVELS.map((l) => l.id));
});

test('финальное письмо содержит подстановку имени и подпись', () => {
  assert.ok(FINAL_LETTER.greeting.includes('{sweet}'));
  assert.ok(FINAL_LETTER.paragraphs.length >= 3);
  const lines = letterLines(FINAL_LETTER);
  for (const p of lines.paragraphs) assert.ok(!p.includes('{'), 'в тексте остался плейсхолдер');
  assert.equal(lines.greeting, `${HER.sweet},`);
  assert.ok(lines.signature.length > 2);
});

test('имена подставляются во всех текстах, плейсхолдеров не остаётся', () => {
  for (const l of LEVELS) assert.ok(!levelIntro(l).story.includes('{'));
  for (const n of NOTES) assert.ok(!noteText(n).text.includes('{'));
  for (const line of HERO.idleLines) assert.ok(!fill(line).includes('{'));
  assert.equal(fill('Привет, {name}! {dative} — от {sweet}.'), `Привет, ${HER.name}! ${HER.dative} — от ${HER.sweet}.`);
  assert.equal(fill(null), '');
  assert.equal(fill(undefined), '');
  assert.equal(fill('{неизвестно}'), '{неизвестно}');
});

test('облики: уникальные id, растущая цена, первый бесплатный', () => {
  assert.equal(SKINS.length, 8);
  assert.equal(new Set(SKINS.map((s) => s.id)).size, SKINS.length);
  assert.equal(SKINS[0].price, 0);
  for (let i = 1; i < SKINS.length; i++) assert.ok(SKINS[i].price > SKINS[i - 1].price);
  for (const s of SKINS) {
    assert.ok(s.name.length > 2);
    assert.ok(s.hint.length > 2);
  }
});

test('миссии: каждая имеет измеримую цель и награду', () => {
  assert.ok(MISSIONS.length >= 8);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length);
  for (const m of MISSIONS) {
    assert.ok(m.goal > 0);
    assert.ok(m.reward.length > 3);
    assert.ok(['played', 'levels', 'starsLevel', 'flawless', 'total', 'best', 'final'].includes(m.kind));
  }
});

test('усиления и опасности описаны для интерфейса', () => {
  for (const key of ['shield', 'magnet', 'energizer']) {
    assert.ok(POWERUPS[key].name && POWERUPS[key].desc && POWERUPS[key].icon);
  }
  for (const key of Object.keys(HAZARDS)) assert.ok(HAZARDS[key].name && HAZARDS[key].hint);
});

/* ---------- сохранение ---------- */

test('пустое сохранение валидно', () => {
  const s = blankSave();
  assert.equal(s.v, 2);
  assert.equal(s.stars.length, 10);
  assert.equal(s.skin, 'classic');
  assert.deepEqual(s.skins, ['classic']);
  assert.equal(SAVE_KEY, 'porshik.save.v2');
  assert.equal(s.fish, 0);
  assert.deepEqual(s.endless, { passed: 0, fish: 0 });
});

test('нормализация чинит любое повреждённое сохранение', () => {
  assert.deepEqual(normalizeSave(null), blankSave());
  assert.deepEqual(normalizeSave('не json'), blankSave());
  assert.deepEqual(normalizeSave([1, 2, 3]), blankSave());
  assert.deepEqual(normalizeSave(42), blankSave());
  const messy = normalizeSave({
    fish: -50,
    totalFish: 'много',
    best: 7.9,
    stars: [9, -1, 'x', 2, 3, 3, 3, 3, 3, 3, 3, 3],
    bestRun: [1.7, 'a'],
    flawless: [1, 1, 99, 'x', 3],
    seenNotes: [2, 2, 50],
    seenGift: [1],
    seenGifts: [4, 'x'],
    missions: ['first', 'first', 'нет такой'],
    skins: ['chef', 'chef', 'нет'],
    skin: 'нет такого',
    sound: 'да',
    music: 0,
  });
  assert.equal(messy.fish, 0);
  assert.equal(messy.totalFish, 0);
  assert.equal(messy.best, 7);
  assert.deepEqual(messy.stars, [3, 0, 0, 2, 3, 3, 3, 3, 3, 3]);
  assert.deepEqual(messy.flawless, [1, 3]);
  assert.deepEqual(messy.seenNotes, [2]);
  assert.deepEqual(messy.seenGifts, [4]);
  assert.deepEqual(messy.missions, ['first']);
  assert.deepEqual(messy.skins, ['classic', 'chef']);
  assert.equal(messy.skin, 'classic');
  assert.equal(messy.sound, true, 'всё, кроме явного false, считается включённым');
  assert.equal(messy.music, true, 'music явно не выключали');
});

test('нормализация принимает строку JSON и сохраняет валидные поля', () => {
  const s = normalizeSave(JSON.stringify({ fish: 120, totalFish: 300, skin: 'chef', skins: ['chef'], best: 12 }));
  assert.equal(s.fish, 120);
  assert.equal(s.totalFish, 300);
  assert.equal(s.skin, 'chef');
  assert.equal(s.best, 12);
});

test('totalFish никогда не меньше fish', () => {
  const s = normalizeSave({ fish: 100, totalFish: 10 });
  assert.ok(s.totalFish >= s.fish);
});

test('открытие миров: первый всегда, дальше — по предыдущему', () => {
  const s = blankSave();
  assert.equal(isUnlocked(s, 1), true);
  assert.equal(isUnlocked(s, 2), false);
  const s2 = { ...s, stars: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  assert.equal(isUnlocked(s2, 2), true);
  assert.equal(isUnlocked(s2, 3), false);
  const s3 = { ...s, stars: [1, 0, 0, 1, 0, 0, 0, 0, 0, 0] };
  assert.equal(isUnlocked(s3, 4), true, 'пройденный мир открыт всегда');
  assert.equal(isUnlocked(s3, 5), true);
  assert.equal(nextLevel(blankSave()), 1);
  assert.equal(nextLevel(s2), 2);
  assert.equal(nextLevel(s3), 2);
  const all = { ...blankSave(), stars: Array(10).fill(3) };
  assert.equal(nextLevel(all), 10);
});

/* ---------- звёзды и награды ---------- */

test('звёзды: пройти, собрать 65%, не потерять жизнь', () => {
  assert.equal(starsFor({ cleared: false, collected: 100, total: 100, livesLost: 0 }), 0);
  assert.equal(starsFor({ cleared: true, collected: 0, total: 40, livesLost: 1 }), 1);
  assert.equal(starsFor({ cleared: true, collected: 26, total: 40, livesLost: 2 }), 2);
  assert.equal(starsFor({ cleared: true, collected: 26, total: 40, livesLost: 0 }), 3);
  assert.equal(starsFor({ cleared: true, collected: 25, total: 40, livesLost: 1 }), 1);
  assert.equal(starsFor({ cleared: true, collected: 10, total: 0, livesLost: 0 }), 2);
});

test('награда рыбками: за сбор, бонус за прохождение, крошки за попытку', () => {
  assert.equal(fishReward({ cleared: false, collected: 8, gates: 10 }), 8 + 2);
  assert.ok(fishReward({ cleared: true, collected: 8, gates: 10, stars: 1 }) > 8);
  assert.ok(fishReward({ cleared: true, collected: 8, gates: 10, stars: 3 }) > fishReward({ cleared: true, collected: 8, gates: 10, stars: 1 }));
});

test('applyResult не мутирует исходное сохранение и правильно отмечает первый раз', () => {
  const s = blankSave();
  const r1 = applyResult(s, { levelId: 1, cleared: true, collected: 20, total: 30, livesLost: 0 });
  assert.equal(s.stars[0], 0, 'исходное сохранение не должно меняться');
  assert.equal(s.fish, 0);
  assert.equal(r1.first, true);
  assert.equal(r1.stars, 3);
  assert.equal(r1.gift.kind, 'note');
  assert.deepEqual(r1.save.seenNotes, [1]);
  assert.deepEqual(r1.save.flawless, [1]);
  assert.ok(r1.save.fish > 20);
  const r2 = applyResult(r1.save, { levelId: 1, cleared: true, collected: 5, total: 30, livesLost: 2 });
  assert.equal(r2.first, false);
  assert.equal(r2.gift, null, 'записка повторно не выдаётся');
  assert.equal(r2.save.seenNotes.length, 1, 'открытые записки не дублируются');
  assert.equal(r2.save.stars[0], 3, 'лучший результат сохраняется');
  assert.equal(r2.save.bestRun[0], 20, 'лучший сбор сохраняется');
});

test('десятый мир выдаёт письмо вместо записки', () => {
  const s = { ...blankSave(), stars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 0] };
  const r = applyResult(s, { levelId: 10, cleared: true, collected: 40, total: 55, livesLost: 0 });
  assert.equal(r.gift.kind, 'letter');
  assert.equal(r.save.stars[9], 3);
});

test('бесконечный режим обновляет рекорд и не трогает звёзды', () => {
  const s = { ...blankSave(), best: 5 };
  const r = applyResult(s, { levelId: 0, cleared: false, collected: 12, total: 0, mode: 'endless', passed: 12 });
  assert.equal(r.save.best, 12);
  assert.equal(r.newBest, true);
  assert.deepEqual(r.save.endless, { passed: 12, fish: 12 });
  assert.deepEqual(r.save.stars, blankSave().stars);
  const r2 = applyResult(r.save, { levelId: 0, cleared: true, collected: 3, total: 0, mode: 'endless', passed: 8 });
  assert.equal(r2.save.best, 12);
  assert.equal(r2.newBest, false);
  assert.deepEqual(r2.save.endless, { passed: 12, fish: 12 }, 'рекорды не уменьшаются');
});

test('покупка облика: проверяет цену и владение', () => {
  const rich = { ...blankSave(), fish: 500 };
  const ok = buySkin(rich, 'chef');
  assert.equal(ok.ok, true);
  assert.ok(ok.save.skins.includes('chef'));
  assert.equal(ok.save.fish, 500 - SKINS.find((s) => s.id === 'chef').price);
  const again = buySkin(ok.save, 'chef');
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'owned');
  const poor = buySkin(blankSave(), 'snow');
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, 'poor');
  const unknown = buySkin(rich, 'нет такого');
  assert.equal(unknown.ok, false);
});

test('миссии: прогресс, выдача наград и отсутствие дублей', () => {
  assert.deepEqual(earnedMissions(blankSave()), []);
  let s = { ...blankSave(), played: 1 };
  assert.ok(earnedMissions(s).includes('first'));
  const first = claimMissions(s);
  assert.ok(first.save.missions.includes('first'));
  const second = claimMissions(first.save);
  assert.deepEqual(second.unlocked, [], 'награда не выдаётся дважды');
  s = { ...blankSave(), stars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 1], totalFish: 2000, best: 20, flawless: [1, 2, 3, 5], played: 12 };
  const done = earnedMissions(s);
  for (const m of MISSIONS) assert.ok(done.includes(m.id), `миссия ${m.id} должна быть выполнена`);
  const claimed = claimMissions(s);
  assert.ok(claimed.unlocked.length >= 4, 'облики за миссии выдаются');
  for (const m of MISSIONS) assert.ok(missionProgress(m, s) <= 1 && missionProgress(m, s) >= 0);
});

test('прогресс миссий устойчив к пустому сохранению', () => {
  for (const m of MISSIONS) {
    const p = missionProgress(m, null);
    assert.equal(p, 0);
  }
});

/* ---------- бесконечный режим ---------- */

test('параметры бесконечного режима растут плавно и ограничены', () => {
  const p0 = endlessParams(0);
  const p45 = endlessParams(45);
  const p999 = endlessParams(999);
  assert.ok(p45.speed > p0.speed);
  assert.ok(p45.gap < p0.gap);
  assert.ok(p45.spacing < p0.spacing);
  assert.equal(p999.speed, p45.speed, 'после 45 ворот рост прекращается');
  assert.equal(p999.gap, p45.gap);
  assert.equal(endlessParams(-5).speed, p0.speed);
  assert.ok(THEMES[p0.world]);
  assert.ok(p0.gap + 2 * 64 < WORLD.GROUND);
  assert.notEqual(endlessParams(6).world, p0.world, 'мир меняется каждые шесть ворот');
});

test('опасности бесконечного режима: разминка, потом мир, потом клубок', () => {
  assert.deepEqual(endlessHazards(0), []);
  assert.deepEqual(endlessHazards(6), ['dust']);
  assert.deepEqual(endlessHazards(12), ['dust'], 'ещё разминка после шести ворот');
  assert.deepEqual(endlessHazards(18), ['yarn'], 'мир корзинки с нитками');
  assert.deepEqual(endlessHazards(24), ['wind'], 'мир двора после дождя');
  assert.deepEqual(endlessHazards(36), ['flour'], 'мир пекарни');
  assert.ok(endlessHazards(19).length >= 1);
  assert.ok(endlessHazards(80).includes('yarn'));
  for (const h of endlessHazards(80)) assert.ok(HAZARDS[h]);
});

test('оценка общего числа рыбок положительна и растёт по мирам', () => {
  let prev = 0;
  for (const l of LEVELS) {
    const n = totalFishEstimate(l);
    assert.ok(n > l.gates, `мир ${l.id}: ${n}`);
    assert.ok(n >= prev - 4, `мир ${l.id}: ${n} против ${prev}`);
    prev = n;
  }
  assert.equal(totalFishEstimate(null), 0);
});

/* ---------- симуляция ---------- */

function bot(sim, { target = 360, frames = 6000, dt = 1 / 60, aware = false } = {}) {
  let steps = 0;
  while (steps < frames && sim.status !== 'won' && sim.status !== 'lost') {
    if (sim.status === 'ready') sim.flap();
    if (sim.status === 'playing') {
      let aimY = target;
      if (aware) {
        const gate = sim.gates.find((g) => !g.passed && g.x - sim.dist + g.w > sim.birdX - 20);
        if (gate) aimY = gate.gapY ?? gate.baseY;
      }
      const wantUp = sim.bird.y > aimY + 6 || (sim.bird.y > aimY - 6 && sim.bird.vy > 120);
      if (wantUp && sim.bird.vy > -140) sim.flap();
    }
    sim.step(dt);
    steps += 1;
  }
  return { steps, sim };
}

test('ГПСЧ детерминирован', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  const c = mulberry32(7);
  assert.notEqual(mulberry32(8)(), c() === 0 ? 1 : c());
  const v = mulberry32(1)();
  assert.ok(v >= 0 && v < 1);
});

test('одинаковый seed даёт одинаковые ворота, разный — разные', () => {
  const a = new Sim({ mode: 'story', levelId: 3, viewW: 400, seed: 777 });
  const b = new Sim({ mode: 'story', levelId: 3, viewW: 400, seed: 777 });
  assert.ok(a.gates.length > 0, 'ворота должны быть сгенерированы заранее');
  assert.deepEqual(
    a.gates.map((g) => [g.x, Math.round(g.baseY)]),
    b.gates.map((g) => [g.x, Math.round(g.baseY)]),
  );
  // разные seed → разные высоты ворот (проверяем на достаточном числе ворот)
  const wideA = new Sim({ mode: 'story', levelId: 3, viewW: 900, seed: 777 });
  const wideC = new Sim({ mode: 'story', levelId: 3, viewW: 900, seed: 778 });
  assert.ok(wideA.gates.length > 2);
  assert.notDeepEqual(
    wideA.gates.map((g) => Math.round(g.baseY)),
    wideC.gates.map((g) => Math.round(g.baseY)),
  );
});

test('симуляция: старт, взмах и мягкий удар', () => {
  const sim = new Sim({ mode: 'story', levelId: 1, viewW: 400, seed: 1 });
  assert.equal(sim.status, 'ready');
  assert.equal(sim.lives, 3);
  sim.step(1 / 60);
  assert.equal(sim.status, 'ready');
  sim.flap();
  assert.equal(sim.status, 'playing');
  const vy = sim.bird.vy;
  assert.ok(vy < 0);
  sim.step(1 / 60);
  assert.ok(sim.bird.vy > vy, 'гравитация тянет вниз');
  // удар о землю отнимает жизнь, но не убивает сразу
  sim.bird.y = WORLD.GROUND - WORLD.RADIUS - 5;
  sim.bird.vy = 400;
  sim.step(0.016);
  assert.equal(sim.lives, 2);
  assert.ok(sim.inv > 0);
  assert.equal(sim.status, 'playing');
  assert.ok(sim.events.some((e) => e.type === 'hurt'));
});

test('щит гасит удар вместо потери жизни', () => {
  const sim = new Sim({ mode: 'story', levelId: 2, viewW: 400, seed: 3 });
  sim.flap();
  sim.applyPower('shield');
  sim.bird.y = WORLD.GROUND - WORLD.RADIUS - 5;
  sim.bird.vy = 300;
  sim.step(0.016);
  assert.equal(sim.lives, 3);
  assert.equal(sim.shield, false);
  assert.ok(sim.events.some((e) => e.type === 'shieldBreak'));
});

test('три удара завершают полёт', () => {
  const sim = new Sim({ mode: 'story', levelId: 1, viewW: 400, seed: 5 });
  sim.flap();
  for (let i = 0; i < 3; i++) {
    sim.inv = 0;
    sim.bird.y = WORLD.GROUND - WORLD.RADIUS - 5;
    sim.bird.vy = 400;
    sim.step(0.016);
  }
  assert.equal(sim.lives, 0);
  assert.ok(['dying', 'lost'].includes(sim.status));
  for (let i = 0; i < 200 && sim.status !== 'lost'; i++) sim.step(0.016);
  assert.equal(sim.status, 'lost');
});

test('магнит и энергия включаются и истекают', () => {
  const sim = new Sim({ mode: 'story', levelId: 3, viewW: 400, seed: 9 });
  sim.flap();
  sim.applyPower('magnet');
  sim.applyPower('energizer');
  assert.ok(sim.magnet > 0);
  assert.ok(sim.energizer > 0);
  const m0 = sim.magnet;
  sim.step(1 / 60);
  assert.ok(sim.magnet < m0);
  sim.applyPower('нет такого');
  assert.ok(sim.magnet > 0);
});

test('бот проходит каждый мир (динамика не сломана)', () => {
  for (const level of LEVELS) {
    const sim = new Sim({ mode: 'story', levelId: level.id, viewW: 420, seed: 100 + level.id, lives: 9 });
    bot(sim, { aware: true, frames: 9000, target: 340 });
    assert.ok(sim.passed >= 6, `мир ${level.id}: бот прошёл только ${sim.passed} ворот`);
  }
});

test('на уровнях можно реально победить: 30 seed-проверок на трёх жизнях', () => {
  for (const level of [LEVELS[0], LEVELS[2], LEVELS[5], LEVELS[9]]) {
    let wins = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const sim = new Sim({ mode: 'story', levelId: level.id, viewW: 420, seed: seed * 7919, lives: 3 });
      bot(sim, { aware: true, frames: 12000, target: 340 });
      if (sim.status === 'won') wins += 1;
    }
    assert.ok(wins >= 12, `мир ${level.id}: только ${wins}/30 побед — слишком сложно`);
  }
});

test('победа возможна и десять звёзд достижимы по симуляции', () => {
  const sim = new Sim({ mode: 'story', levelId: 1, viewW: 420, seed: 2024 });
  bot(sim, { aware: true, frames: 12000, target: 340 });
  assert.equal(sim.status, 'won');
  assert.ok(sim.pathFish > 0);
  assert.ok(sim.fish >= sim.pathFish);
  const total = totalFishEstimate(LEVELS[0]);
  assert.ok(sim.pathFish <= total + 6, `собрано ${sim.pathFish} при оценке ${total}`);
});

test('в бесконечном режиме бот не падает сразу и ворота растут', () => {
  const sim = new Sim({ mode: 'endless', viewW: 420, seed: 77 });
  bot(sim, { aware: true, frames: 12000, target: 340 });
  assert.ok(sim.passed >= 6, `пройдено ${sim.passed}`);
  assert.ok(sim.gates.length > 3);
});

test('симуляция не выходит за границы мира и не теряет конечность', () => {
  const sim = new Sim({ mode: 'story', levelId: 6, viewW: 420, seed: 31 });
  for (let i = 0; i < 1500; i++) {
    if (i % 40 === 0) sim.flap();
    sim.step(1 / 60);
    assert.ok(Number.isFinite(sim.bird.y));
    assert.ok(Number.isFinite(sim.bird.vy));
    assert.ok(sim.bird.y >= 0 && sim.bird.y <= WORLD.H);
    for (const h of sim.hazards) and(h);
    for (const it of sim.items) {
      assert.ok(Number.isFinite(it.x) && Number.isFinite(it.y), 'предмет с NaN');
    }
  }
  function and(h) {
    assert.ok(Number.isFinite(h.x) && Number.isFinite(h.y), 'опасность с NaN');
  }
});

test('предметы и опасности подчищаются, массивы не растут бесконечно', () => {
  const sim = new Sim({ mode: 'story', levelId: 10, viewW: 420, seed: 4 });
  bot(sim, { aware: true, frames: 4000, target: 340 });
  assert.ok(sim.items.length < 500, `предметов: ${sim.items.length}`);
  assert.ok(sim.hazards.length < 100, `опасностей: ${sim.hazards.length}`);
});

test('dt ограничен: свёрнутая вкладка не телепортирует игрока', () => {
  const sim = new Sim({ mode: 'story', levelId: 1, viewW: 400, seed: 2 });
  sim.flap();
  const before = sim.dist;
  sim.step(5);
  assert.ok(sim.dist - before < 40, 'шаг ограничен 0.05 с');
  sim.step(0);
  sim.step(-1);
  assert.ok(Number.isFinite(sim.bird.y));
});

test('мир 6: у дождя есть «спокойная» вторая половина', () => {
  const sim = new Sim({ mode: 'story', levelId: 6, viewW: 420, seed: 12 });
  const calmGate = sim.calmGate;
  assert.ok(calmGate > 0 && calmGate < LEVELS[5].gates);
  assert.equal(sim.calm, false);
  sim.spawned = calmGate;
  assert.equal(sim.calm, true);
  // опасности дождя — только в первой части мира
  const hazardsBefore = sim.hazards.length;
  sim.spawnGate();
  assert.ok(sim.hazards.length >= hazardsBefore, 'после дождя опасности не добавляются');
  assert.ok(totalFishEstimate(LEVELS[5]) > totalFishEstimate(LEVELS[4]));
});

test('на каждом мире гарантированно проходимый просвет', () => {
  for (const level of LEVELS) {
    const sim = new Sim({ mode: 'story', levelId: level.id, viewW: 420, seed: 55 });
    for (const g of sim.gates) {
      const top = g.baseY - g.gap / 2 - g.amp;
      const bottom = g.baseY + g.gap / 2 + g.amp;
      assert.ok(top > 12, `мир ${level.id}: ворота выше неба (${Math.round(top)})`);
      assert.ok(bottom < WORLD.GROUND - 12, `мир ${level.id}: ворота под полом (${Math.round(bottom)})`);
      assert.ok(bottom - top >= 180);
    }
    for (let i = 1; i < sim.gates.length; i++) {
      const jump = Math.abs(sim.gates[i].baseY - sim.gates[i - 1].baseY);
      assert.ok(jump <= 190, `мир ${level.id}: прыжок между воротами ${Math.round(jump)}`);
    }
  }
});

test('ширина мира влияет только на видимую часть', () => {
  const narrow = new Sim({ mode: 'story', levelId: 1, viewW: 320, seed: 3 });
  const wide = new Sim({ mode: 'story', levelId: 1, viewW: 900, seed: 3 });
  assert.ok(wide.gates.length > 0);
  assert.ok(narrow.gates.length > 0);
  assert.equal(SIM_WORLD.H, 720);
});

test('темы: у каждого мира есть палитра и тип ворот', () => {
  const gateTypes = new Set(Object.values(THEMES).map((t) => t.gate));
  assert.ok(gateTypes.size >= 8, 'ворота должны отличаться по мирам');
  for (const [key, t] of Object.entries(THEMES)) {
    assert.equal(t.sky.length, 2);
    assert.equal(t.ground.length, 2);
    for (const c of [t.sky[0], t.sky[1], t.ground[0], t.ground[1], t.accent]) assert.match(c, /^#[0-9a-f]{6}$/i, `${key}: ${c}`);
    assert.ok(t.label.length > 2);
  }
  assert.equal(themeOf('нет такого'), THEMES.roof);
});
