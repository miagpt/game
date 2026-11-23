/* ═══════════════════════════════════════════════════════════════
   ПОРШИК · КОТ, КОТОРЫЙ ЛЕТАЕТ — симуляция
   Чистая логика без DOM и canvas: тот же код гоняют unit-тесты,
   бот-симуляция в Node и сама игра в браузере. Рендер и звук
   только читают состояние и слушают события sim.events.
   ═══════════════════════════════════════════════════════════════ */

import { LEVELS, POWERUPS, HAZARDS } from './content.js';
import { WORLD, endlessParams, endlessHazards, totalFishEstimate } from './rules.js';

const { H, GROUND, GRAVITY, FLAP, MAX_FALL, RADIUS, GATE_W } = WORLD;

const FIRST_GATE = 560; // сколько единиц лететь до первых ворот
const FINISH_GAP = 1.25; // финиш стоит за последними воротами
const NEAR_MISS = 10; // «впритирку» — просвет меньше этого
const STREAK_STEP = 10; // каждые 10 рыбок подряд — премия
const STREAK_BONUS = 2;
const INVULN = 1.35; // секунд неуязвимости после удара
const HAZARD_WARN = 0.9; // за столько секунд до появления опасности мигает «!»

/* Детерминированный ГПСЧ: одни и те же seed → одни и те же ворота. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

export class Sim {
  constructor({ mode = 'story', levelId = 1, viewW = 400, seed = 1, lives } = {}) {
    this.mode = mode === 'endless' ? 'endless' : 'story';
    this.level = this.mode === 'story' ? LEVELS.find((l) => l.id === levelId) || LEVELS[0] : null;
    this.levelId = this.mode === 'story' ? this.level.id : 0;
    this.viewW = Math.max(220, Number(viewW) || 400);
    this.rand = mulberry32(seed >>> 0);
    this.seed = seed >>> 0;

    this.t = 0;
    this.dist = 0;
    this.status = 'ready'; // ready → playing → dying → lost | won
    this.birdX = clamp(this.viewW * 0.28, 84, 240);
    this.bird = { y: 320, vy: 0, rot: 0 };
    this.startY = 320;

    this.maxLives = Number.isFinite(lives) && lives > 0 ? Math.min(3, Math.floor(lives)) : 3;
    this.lives = this.maxLives;
    this.lostLives = 0;
    this.inv = 0;
    this.shield = false;
    this.magnet = 0;
    this.energizer = 0;

    this.gates = [];
    this.items = [];
    this.hazards = [];
    this.warnings = [];
    this.wind = { state: 'idle', timer: 3.2, dir: 1, dur: 0 };
    this.yarnTimer = 3.6;
    this.wave = 0;

    this.spawned = 0;
    this.passed = 0;
    this.fish = 0;
    this.pathFish = 0;
    this.fishTotal = this.mode === 'story' ? totalFishEstimate(this.level) : 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.nearMisses = 0;
    this.finishX = null;
    this.deadT = 0;
    this.finished = false;

    const p = this.params();
    this.speed = p.speed;
    this.world = p.world;
    this.nextGateX = this.birdX + FIRST_GATE * 1.15;
    this.prevAnchor = { x: this.birdX + 210, y: 320 };
    this.trackLen =
      this.mode === 'story'
        ? FIRST_GATE * 1.15 + (this.level.gates - 1) * this.level.spacing + this.level.spacing * FINISH_GAP
        : 0;

    this.events = [];
    this.fill();
  }

  params(n = this.spawned) {
    if (this.mode === 'story') return this.level;
    const e = endlessParams(n);
    return { ...e, gateCount: Infinity };
  }

  get totalGates() {
    return this.mode === 'story' ? this.level.gates : Infinity;
  }

  get calmGate() {
    const l = this.level;
    return l && l.calmFrom != null ? Math.round(l.gates * l.calmFrom) : Infinity;
  }

  get progress() {
    return this.trackLen ? clamp(this.dist / this.trackLen, 0, 1) : 0;
  }

  get calm() {
    return this.spawned >= this.calmGate;
  }

  emit(type, data) {
    this.events.push(data ? { type, ...data } : { type });
  }

  /* ---------- управление ---------- */

  flap() {
    if (this.status === 'ready') {
      this.status = 'playing';
      this.emit('start');
    }
    if (this.status !== 'playing') return;
    this.bird.vy = FLAP;
    this.emit('flap');
  }

  /* ---------- генерация мира ---------- */

  fill() {
    while (this.spawned < this.totalGates && this.nextGateX - this.dist < this.viewW + 600) this.spawnGate();
    if (this.mode === 'story' && this.spawned >= this.totalGates && this.finishX == null) {
      const last = this.gates[this.gates.length - 1];
      this.finishX = last.x + this.level.spacing * FINISH_GAP;
      for (let i = 1; i <= 3; i++) this.addItem('fish', lerp(last.x + GATE_W, this.finishX, i / 4), lerp(last.baseY, 320, smooth(i / 4)));
    }
  }

  addItem(type, x, y, extra) {
    const it = { type, x, y, taken: false, born: this.t, ...extra };
    if (type === 'fish') this.fishTotal += 0; // сумма посчитана заранее (оценка сверху)
    this.items.push(it);
    return it;
  }

  spawnGate() {
    const p = this.params();
    const r = this.rand;
    const idx = this.spawned;
    const gap = p.gap;
    const amp = p.move ? p.move * (0.6 + 0.4 * r()) : 0;
    const margin = 46 + amp; // отступ от неба и пола: ворота не выходят за пределы мира
    const lo = gap / 2 + margin;
    const hi = GROUND - gap / 2 - margin;
    let baseY = clamp(this.prevAnchor.y + (r() * 2 - 1) * 185, lo, hi);
    // первый просвет всегда в комфортной середине экрана
    if (idx === 0) baseY = clamp(330, lo, hi);
    const x = this.nextGateX;
    const gate = {
      idx,
      x,
      w: GATE_W,
      gap,
      baseY,
      amp,
      freq: 1.1 + r() * 0.7,
      phase: r() * Math.PI * 2,
      gapY: baseY,
      passed: false,
      world: p.world,
    };
    this.gates.push(gate);

    // рыбка в просвете едет вместе с воротами
    this.addItem('fish', x + GATE_W / 2, baseY, { gate });
    gate.gapY = baseY;

    const ax = this.prevAnchor.x;
    const span = x - ax;
    const prevY = this.prevAnchor.y;
    const pathY = (f) => lerp(prevY, baseY, smooth(f));
    const calm = idx >= this.calmGate;
    const trail = calm && idx > 0 ? [1 / 5, 2 / 5, 3 / 5, 4 / 5] : [1 / 3, 2 / 3];
    for (const f of trail) this.addItem('fish', ax + span * f, pathY(f));

    const midX = ax + span / 2;
    let midBusy = false;

    // усиление раз в несколько ворот
    if (p.powerups && p.powerups.length && idx > 0 && idx % 5 === 2) {
      const kind = p.powerups[Math.floor(r() * p.powerups.length)];
      this.addItem('power', midX, pathY(0.5), { power: kind });
      midBusy = true;
    }

    // крупный бонус: пончик, листик или клубника — раз в 4 ворот
    if (idx > 1 && idx % 4 === 3) {
      const kind = this.treatKind(p.world);
      this.addItem('treat', midX + span * 0.18, pathY(0.62), { treat: kind });
      midBusy = true;
    }

    // опасности мира
    const hz = idx > 0 && !calm ? p.hazards || [] : [];
    // Опасности ставятся ВНЕ коридора полёта: игра добрая, а тесты проверяют,
    // что прямой путь между воротами остаётся проходимым.
    const offPath = (base, dist) => clamp(base + (r() < 0.5 ? -1 : 1) * dist, 96, GROUND - 96);

    // «стоячие» опасности: пар, пыль, клубок. Они качаются на месте.
    if (hz.includes('steam')) {
      this.hazards.push({ type: 'steam', x: midX, y: offPath(pathY(0.5), gap * 0.62 + 96), r: 20, dead: false, phase: r() * 6.28 });
    }
    if (hz.includes('dust') || hz.includes('flour')) {
      const type = hz.includes('flour') ? 'flour' : 'dust';
      this.hazards.push({
        type,
        x: x - GATE_W / 2,
        y: offPath(baseY, gap * 0.62 + 78),
        r: 17,
        dead: false,
        phase: r() * 6.28,
        amp: 26,
      });
    }
    if (hz.includes('yarn')) {
      this.hazards.push({ type: 'yarn', x: midX, y: offPath(pathY(0.4), gap * 0.6 + 92), r: 18, dead: false, phase: r() * 6.28, amp: 26, vy: 0 });
    }
    if (hz.includes('drop') && r() < 0.75) {
      this.warnings.push({ type: 'drop', x: midX, y: 60, r: 26, spawnAt: this.t + HAZARD_WARN * 0.8 });
    }
    if (hz.includes('pigeon')) {
      this.warnings.push({ type: 'pigeon', x: this.viewW + 40, y: pathY(0.5), spawnAt: this.t + HAZARD_WARN });
    }
    if (hz.includes('ember')) {
      this.warnings.push({ type: 'ember', x: midX, y: offPath(pathY(0.4), gap * 0.58 + 70), r: 12, spawnAt: this.t + HAZARD_WARN });
    }

    this.prevAnchor = { x, y: baseY };
    this.spawned += 1;
    this.nextGateX += p.spacing;
    void midBusy;
  }

  /* Лакомство мира: сарделька, креветка, мышка, сливки. Стоит 2–3 рыбки. */
  treatKind(world) {
    return { attic: 'mouse', kitchen: 'sausage', bakery: 'bun', night: 'cream', home: 'heart' }[world] || 'sausage';
  }

  /* ---------- главный шаг ---------- */

  step(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05); // защита от «скачка» после сворачивания вкладки
    this.events.length = 0;
    this.t += dt;

    if (this.status === 'won' || this.status === 'lost') {
      this.scrollBackground(dt);
      this.animateHazards(dt, true);
      this.deadT += dt;
      return;
    }

    if (this.status === 'dying') {
      this.deadT += dt;
      this.bird.vy = Math.min(MAX_FALL, this.bird.vy + GRAVITY * dt);
      this.bird.y += this.bird.vy * dt;
      this.bird.rot = Math.min(1.4, this.bird.rot + 3.4 * dt);
      if (this.bird.y > GROUND - 24 || this.deadT > 1.4) {
        this.bird.y = Math.min(GROUND - 24, this.bird.y);
        this.status = 'lost';
        this.emit('lost', { reason: this.deadReason || 'ground' });
      }
      return;
    }

    const playing = this.status === 'playing';
    this.scrollBackground(dt);

    // парение до старта: Поршик мягко качается на месте
    if (!playing) {
      this.bird.y = this.startY + Math.sin(this.t * 2.2) * 9;
      this.bird.vy = 0;
      this.bird.rot = 0;
      this.animateHazards(dt, true);
      return;
    }

    // физика
    const gMul = this.energizer > 0 ? 0.82 : 1;
    this.bird.vy = Math.min(MAX_FALL, this.bird.vy + GRAVITY * gMul * dt);
    this.bird.y += this.bird.vy * dt;
    this.bird.rot = clamp(this.bird.vy / 620, -0.55, 1.05);
    this.inv = Math.max(0, this.inv - dt);
    this.magnet = Math.max(0, this.magnet - dt);
    this.energizer = Math.max(0, this.energizer - dt);

    if (this.bird.y < RADIUS + 4) {
      this.bird.y = RADIUS + 4;
      if (this.bird.vy < 0) this.bird.vy = 0;
    }
    if (this.bird.y > GROUND - RADIUS - 4) {
      this.bird.y = GROUND - RADIUS - 4;
      if (this.inv <= 0) this.hit('ground');
      this.bird.vy = Math.max(this.bird.vy, 0);
    }

    // мягкий разгон: первые ворота встречают чуть медленнее, к финалу темп выше
    const ramp = this.mode === 'story' ? 0.88 + 0.24 * this.progress : 1;
    this.dist += this.speed * ramp * dt;
    this.fill();

    this.updateGates();
    this.updateItems(dt);
    this.updateHazards(dt);
    this.updateWind(dt);
    this.checkFinish();
  }

  scrollBackground(dt) {
    if (this.status === 'ready' || this.status === 'playing') this.dist += 0;
    void dt;
  }

  /** Текущая высота просвета: считается из времени, поэтому не зависит от кадров. */
  gateY(gate) {
    return gate.baseY + (gate.amp ? Math.sin(this.t * gate.freq + gate.phase) * gate.amp : 0);
  }

  updateGates() {
    const bx = this.birdX;
    for (const gate of this.gates) {
      gate.gapY = this.gateY(gate);
      if (gate.passed) continue;
      const left = gate.x - this.dist;
      const inX = bx + RADIUS > left && bx - RADIUS < left + gate.w;
      if (inX) {
        const top = gate.gapY - gate.gap / 2;
        const bottom = gate.gapY + gate.gap / 2;
        const clearance = Math.min(this.bird.y - RADIUS - top, bottom - (this.bird.y + RADIUS));
        if (clearance < 0) {
          if (this.inv <= 0) this.hit('gate');
        } else if (clearance < NEAR_MISS) {
          gate.nearMissed = gate.nearMissed || this.inv > 0;
        }
      }
      if (left + gate.w < bx - RADIUS) {
        gate.passed = true;
        this.passed += 1;
        if (gate.nearMissed) this.nearMisses += 1;
        this.emit('gate', { passed: this.passed, nearMiss: !!gate.nearMissed });
      }
    }
  }

  updateItems(dt) {
    const bx = this.birdX;
    const by = this.bird.y;
    const magnetOn = this.magnet > 0;
    for (const it of this.items) {
      if (it.taken) continue;
      if (it.gate) it.y = it.gate.gapY;
      else it.y += Math.sin(this.t * 2 + it.x * 0.01) * 0.35;
      const x = it.x - this.dist;
      if (x < -80) continue;
      let dx = x - bx;
      let dy = it.y - by;
      if (magnetOn && it.type !== 'power' && x < bx + 260 && x > bx - 60) {
        const d = Math.hypot(dx, dy) || 1;
        if (d < 240) {
          const pull = 300 * dt;
          it.x -= (dx / d) * pull;
          it.y -= (dy / d) * pull;
          dx = it.x - this.dist - bx;
          dy = it.y - by;
        }
      }
      const grab = it.type === 'power' || it.type === 'treat' ? 30 : 25;
      if (Math.abs(dx) < grab && Math.abs(dy) < grab) {
        it.taken = true;
        this.collect(it);
      }
    }
    // подчищаем далёкое прошлое, чтобы массив не рос бесконечно
    if (this.items.length > 400) this.items = this.items.filter((it) => it.x - this.dist > -160 || !it.taken);
  }

  collect(it) {
    if (it.type === 'fish') {
      this.pathFish += 1;
      this.fish += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.emit('fish', { total: this.pathFish, streak: this.streak });
      if (this.streak > 0 && this.streak % STREAK_STEP === 0) {
        this.fish += STREAK_BONUS;
        this.emit('streak', { streak: this.streak, bonus: STREAK_BONUS });
      }
    } else if (it.type === 'treat') {
      const worth = it.treat === 'mouse' || it.treat === 'heart' ? 3 : 2;
      this.fish += worth;
      this.emit('treat', { treat: it.treat, worth });
    } else if (it.type === 'power') {
      this.applyPower(it.power);
    }
  }

  applyPower(kind) {
    if (!POWERUPS[kind]) return;
    if (kind === 'shield') this.shield = true;
    if (kind === 'magnet') this.magnet = POWERUPS.magnet.time;
    if (kind === 'energizer') this.energizer = POWERUPS.energizer.time;
    this.emit('power', { power: kind });
  }

  updateHazards(dt) {
    this.animateHazards(dt, false);

    // клубок-«пчих»: натянутая нитка срывается и летит по прямой
    if (this.mode === 'story' && this.level && this.level.hazards.includes('yarn') && !this.calm) {
      this.yarnTimer -= dt;
      if (this.yarnTimer <= 0 && this.status === 'playing') {
        this.yarnTimer = 2.4 + this.rand() * 1.3;
        const y = clamp(this.bird.y + (this.rand() * 2 - 1) * 150, 90, GROUND - 80);
        this.warnings.push({ type: 'yarn', x: this.viewW + 30, y, spawnAt: this.t + HAZARD_WARN });
      }
    }
    if (this.mode === 'endless') {
      this.yarnTimer -= dt;
      if (this.yarnTimer <= 0 && endlessHazards(this.spawned).includes('yarn') && this.status === 'playing') {
        this.yarnTimer = 2.6 + this.rand() * 1.4;
        const y = clamp(this.bird.y + (this.rand() * 2 - 1) * 160, 90, GROUND - 80);
        this.warnings.push({ type: 'yarn', x: this.viewW + 30, y, spawnAt: this.t + HAZARD_WARN });
      }
    }

    // превращаем предупреждения в настоящие опасности
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      if (this.t < w.spawnAt) continue;
      this.warnings.splice(i, 1);
      if (w.type === 'drop') {
        for (let k = 0; k < 3; k++) {
          this.hazards.push({ type: 'drop', x: w.x + (k - 1) * 26, y: 40 - k * 34, vy: 430 + k * 40, r: 9, dead: false });
        }
        this.emit('danger');
      } else if (w.type === 'yarn') {
        this.hazards.push({ type: 'yarnshot', x: w.x, y: w.y, vx: -this.speed * 1.25 - 140, r: 14, dead: false });
        this.emit('danger');
      } else if (w.type === 'pigeon') {
        const edge = clamp(w.y + (this.rand() < 0.5 ? -1 : 1) * 78, 90, GROUND - 90);
        this.hazards.push({ type: 'pigeon', x: w.x, y: edge, ny: edge, r: 18, dead: false, wave: 26, phase: this.t });
        this.emit('danger');
      } else if (w.type === 'ember') {
        this.hazards.push({ type: 'ember', x: w.x, y: w.y, vy: 300 + this.rand() * 120, r: 10, dead: false });
        this.emit('danger');
      }
    }

    const bx = this.birdX;
    const by = this.bird.y;
    for (const h of this.hazards) {
      if (h.dead) continue;
      const x = h.x - this.dist;
      const dx = x - bx;
      const dy = h.y - by;
      const rr = (h.r || 14) + RADIUS - 6;
      if (dx * dx + dy * dy < rr * rr && this.inv <= 0) this.hit(h.type);
    }
    if (this.hazards.length > 80) this.hazards = this.hazards.filter((h) => !h.dead);
  }

  animateHazards(dt, frozen) {
    for (const h of this.hazards) {
      if (h.type === 'dust' || h.type === 'flour') h.y += Math.sin(this.t * 1.6 + h.phase) * h.amp * dt;
      if (h.type === 'yarn') h.y += Math.sin(this.t * 1.4 + h.phase) * h.amp * dt;
      if (h.type === 'yarnshot' && !frozen) {
        h.x += h.vx * dt;
        if (h.x - this.dist < -80) h.dead = true;
      }
      if (h.type === 'drop' && !frozen) {
        h.y += (h.vy || 430) * dt;
        if (h.y > GROUND - 10) h.dead = true;
      }
      if (h.type === 'pigeon' && !frozen) {
        h.x -= this.speed * 0.35 * dt;
        h.y = h.ny + Math.sin((this.t - h.phase) * 2.4) * h.wave;
        if (h.x - this.dist < -80) h.dead = true;
      }
      if (h.type === 'ember' && !frozen) {
        h.y += (h.vy || 300) * dt;
        h.x -= this.speed * 0.25 * dt;
        if (h.y > GROUND - 10 || h.x - this.dist < -80) h.dead = true;
      }
      if (h.type === 'steam' && !frozen) {
        h.y += Math.sin(this.t * 0.9 + h.phase) * 12 * dt;
        h.dead = h.x - this.dist < -90;
      }
    }
    if (frozen) return;
    this.hazards = this.hazards.filter((h) => !h.dead);
  }

  updateWind(dt) {
    const windy = (this.mode === 'story' && this.level && this.level.hazards.includes('wind')) || this.mode === 'endless';
    if (!windy) return;
    this.wind.timer -= dt;
    if (this.wind.state === 'idle' && this.wind.timer <= 0) {
      this.wind.state = 'blowing';
      this.wind.dir = this.rand() < 0.5 ? 1 : -1;
      this.wind.dur = 2.2 + this.rand() * 1.2;
      this.wind.timer = this.wind.dur;
      this.emit('wind', { dir: this.wind.dir });
    } else if (this.wind.state === 'blowing' && this.wind.timer <= 0) {
      this.wind.state = 'idle';
      this.wind.timer = 2.6 + this.rand() * 1.6;
    }
    if (this.wind.state === 'blowing' && this.status === 'playing') {
      this.bird.y += this.wind.dir * 92 * dt;
      this.bird.y = clamp(this.bird.y, RADIUS + 4, GROUND - RADIUS - 4);
    }
  }

  hit(reason) {
    if (this.inv > 0) return;
    if (this.shield) {
      this.shield = false;
      this.inv = 1.1;
      this.emit('shieldBreak', { reason });
      return;
    }
    this.lives -= 1;
    this.lostLives += 1;
    this.streak = 0;
    this.deadReason = reason;
    this.emit('hurt', { reason, lives: this.lives });
    if (this.lives <= 0) {
      this.status = 'dying';
      this.deadT = 0;
      this.bird.vy = -160;
      this.emit('dying');
      return;
    }
    // мягкий «бамп» вместо смерти: игра добрая, Поршик просто теряет высоту
    this.inv = INVULN;
    this.bird.vy = -210;
    this.bird.y = clamp(this.bird.y, 110, GROUND - 90);
  }

  checkFinish() {
    if (this.mode !== 'story' || this.finishX == null) return;
    if (this.dist + this.birdX >= this.finishX) {
      this.status = 'won';
      this.deadT = 0;
      this.emit('won', { fish: this.pathFish, lives: this.lives });
    }
  }

  /* Подсказки для HUD: какие опасности близко. */
  threatHints() {
    const hints = [];
    if (this.wind.state === 'blowing') hints.push({ type: 'wind', dir: this.wind.dir });
    for (const w of this.warnings) if (this.t >= w.spawnAt - HAZARD_WARN) hints.push({ type: w.type, warn: true });
    return hints;
  }

  hazardLabel(type) {
    return HAZARDS[type]?.name || 'Опасность';
  }
}

export { WORLD as SIM_WORLD, FIRST_GATE };
