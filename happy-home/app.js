import { levels, getRound, durationLabel } from './content.js';
import { getPatternRule, laneFraction, getBossTargetFraction, getBossPhaseCue } from './mechanics.js';
import { freshSave, normalizeSave } from './save.js';

const $ = (id) => document.getElementById(id);
const appScript = document.querySelector('script[type="module"][src]');
const appBase = new URL('.', appScript?.src || window.location.href);
const portraitUrl = (hero) => new URL(hero.portrait, appBase).href;
const STORE = 'happyhome.save.v1';
function bounded(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function loadSave() {
  try { return normalizeSave(localStorage.getItem(STORE)); }
  catch { return freshSave(); }
}
let save = loadSave();
function persist() { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch {} }
function persistCheckpoint() {
  if (!stage) return;
  save.checkpoint = {
    id: stage.id, elapsed: bounded(elapsed, 0, 3600, 0),
    y: bounded(y / height, 0.04, 0.96, 0.48), vy: bounded(vy / height, -0.8, 0.8, 0),
    lives, invulnerable, bossHits, bossExtensions, lastPaw, collected, runTarget, checkpointAt,
  };
  persist();
}
const completedCount = () => save.completed.length;
const nextId = () => { for (let n = 1; n <= 50; n++) if (!save.completed.includes(n)) return n; return 50; };
const unlockedThrough = () => Math.min(50, Math.max(1, Math.max(0, ...save.completed) + 1));
let stage = null, gameState = 'menu', raf = 0, lastFrame = 0, elapsed = 0, runTarget = 0, checkpointAt = 0, y = 0, vy = 0, lives = 3, invulnerable = 0, bossHits = 0, bossExtensions = 0, lastPaw = -1, collected = 0;
let width = 420, height = 760, dpr = 1, audioContext = null, musicTimer = 0, musicStep = 0;
const canvas = $('gameCanvas'), ctx = canvas.getContext('2d', { alpha: false });
const portraits = new Map(levels.map((hero) => { const image = new Image(); image.src = portraitUrl(hero); return [hero.id, image]; }));

function toggleState(button, key) {
  button.setAttribute('aria-pressed', String(save.settings[key]));
  const text = button.querySelector('.toggle-label');
  if (text) text.textContent = key === 'music' ? 'Музыка' : 'Звуки';
  button.setAttribute('aria-label', `${save.settings[key] ? 'Выключить' : 'Включить'} ${key === 'music' ? 'музыку' : 'звуки'}`);
}
function audio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}
function tone(freq, time = .11, type = 'sine', volume = .045, when = 0) {
  if (!save.settings.sfx) return;
  try {
    const a = audio(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(volume, a.currentTime + when); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + when + time);
    o.connect(g); g.connect(a.destination); o.start(a.currentTime + when); o.stop(a.currentTime + when + time);
  } catch {}
}
function playMusic() {
  stopMusic();
  if (!save.settings.music) return;
  try {
    const a = audio();
    const notes = [220, 261.63, 329.63, 293.66, 196, 246.94, 293.66, 261.63];
    musicTimer = window.setInterval(() => {
      if (!save.settings.music || document.hidden || gameState === 'paused') return;
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle'; o.frequency.value = notes[musicStep++ % notes.length]; g.gain.setValueAtTime(.0001, a.currentTime); g.gain.linearRampToValueAtTime(.016, a.currentTime + .08); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .72); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .75);
    }, 800);
  } catch {}
}
function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = 0; }
function setAudio(key, button) {
  save.settings[key] = !save.settings[key]; persist();
  const ids = key === 'music' ? ['musicBtn', 'gameMusicBtn'] : ['sfxBtn', 'gameSfxBtn'];
  for (const id of ids) { const control = $(id); control.setAttribute('aria-pressed', String(save.settings[key])); control.setAttribute('aria-label', `${save.settings[key] ? 'Выключить' : 'Включить'} ${key === 'music' ? 'музыку' : 'звуки'}`); }
  if (key === 'music') save.settings.music ? playMusic() : stopMusic(); else if (save.settings.sfx) tone(660, .08);
}

function buildHeroes() {
  $('heroStack').innerHTML = levels.map((h, i) => `<div class="hero-token" style="--hero-color:${h.color};--tilt:${[-7,2,-2,4,-4][i]}deg;--delay:${i * -.6}s" title="${h.name}, ${h.age} лет"><img src="${portraitUrl(h)}" alt="${h.name}, ${h.kind}" width="512" height="512" loading="eager"></div>`).join('');
}
function renderMap() {
  const unlocked = unlockedThrough();
  $('chapterGrid').innerHTML = levels.map((level, i) => {
    const done = level.rounds.filter((r) => save.completed.includes(r.id)).length;
    const isOpen = i * 10 + 1 <= unlocked;
    const activeId = Math.max(i * 10 + 1, Math.min(unlocked, (i + 1) * 10));
    const activeStage = getRound(activeId);
    return `<article class="chapter-card ${isOpen ? '' : 'locked'}" style="--card-accent:${level.color}" ${isOpen ? `role="button" tabindex="0" data-chapter="${i + 1}"` : 'aria-disabled="true"'}><span class="chapter-mark" aria-hidden="true">${level.icon}</span><span class="chapter-num">ГЛАВА 0${i + 1} · ${String(level.age).padStart(2, '0')} ЛЕТ</span><span class="chapter-avatar"><img src="${portraitUrl(level)}" alt="" width="512" height="512" loading="lazy"></span><h3>${level.name}</h3><p class="chapter-theme">${level.theme}</p><div class="chapter-bottom"><span>${isOpen ? `${done}/10 раундов` : '🔒 закрыта'}</span><strong>${done === 10 ? '✓' : isOpen ? `Раунд ${activeStage.round}` : '· · ·'}</strong></div></article>`;
  }).join('');
  document.querySelectorAll('[data-chapter]').forEach((card) => {
    const go = () => { const chapter = Number(card.dataset.chapter); const start = Math.max((chapter - 1) * 10 + 1, Math.min(unlocked, chapter * 10)); startRound(start); };
    card.addEventListener('click', go); card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  const count = completedCount(); $('overallProgress').style.width = `${count * 2}%`; $('progressText').textContent = `${count} / 50`;
  $('continueLabel').textContent = save.checkpoint && !save.completed.includes(save.checkpoint.id) ? `Продолжить · раунд ${save.checkpoint.id}` : count ? 'Продолжить приключение' : 'Начать приключение';
}
function chooseRound() { return save.checkpoint && !save.completed.includes(save.checkpoint.id) ? save.checkpoint.id : nextId(); }
function scrollMap() { $('mapSection').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect(), previousHeight = height;
  dpr = Math.min(2, window.devicePixelRatio || 1); width = Math.max(300, rect.width); height = Math.max(380, rect.height);
  if (previousHeight > 0 && y > 0) { y = y / previousHeight * height; vy = vy / previousHeight * height; }
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!['playing'].includes(gameState)) drawScene(0);
}
function motionReduced() { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
function seeded(n, salt = 1) { let x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); }
function gatesFor(s) { return 16 + (s.level - 1) * 2 + Math.floor((s.round - 1) * .9); }
function gateAt(index) {
  const count = gatesFor(stage), interval = stage.targetSeconds / count;
  const born = index * interval + 1.2, speed = width / Math.min(5.2, Math.max(3.2, interval * .8));
  const x0 = width + 60, px = x0 - Math.max(0, elapsed - born) * speed;
  const rule = getPatternRule(stage.pattern);
  const gap = Math.max(height * .29, height * (.40 - stage.level * .007 - stage.round * .0008) * (rule?.gap ?? 1));
  const margin = height * .15, seed = seeded(index + stage.id * 17, stage.level);
  const low = margin + gap / 2, high = height - margin - gap / 2;
  const progress = index / Math.max(1, count - 1);
  let center = low + seed * (high - low);
  const lane = laneFraction(rule?.lane, index, progress, elapsed);
  if (lane !== null) center = low + (high - low) * lane;
  const moving = !!rule?.moving;
  const wobble = moving ? Math.sin(elapsed * (stage.level > 2 ? 1.12 : .72) + index*.63) * Math.min(height*.07, 12 + stage.level*3 + stage.round) : 0;
  if (rule?.ring) center = Math.max(low, Math.min(high, center + Math.sin(elapsed * (Math.floor(index / 5) % 2 ? -1 : 1) + index * .7) * height * .035));
  center = Math.max(low, Math.min(high, center));
  return { x: px, w: Math.max(34, width * .105), gap, top: center - gap / 2 + wobble, bottom: center + gap / 2 + wobble, born, index };
}
function playerX() { return width * .27; }
function currentPaw() {
  if (!stage) return null;
  const bossStart = stage.targetSeconds * .77;
  const inBoss = !!stage.boss && elapsed >= bossStart;
  const period = inBoss ? 7.8 : Math.max(4.2, stage.targetSeconds / (9 + stage.level));
  const ageInSection = inBoss ? elapsed - bossStart : elapsed;
  const local = ageInSection % period;
  const index = Math.floor(ageInSection / period) + (inBoss ? 1000 : 0);
  if (local > 3.4) return null;
  if (inBoss && getPatternRule(stage.pattern)?.boss === 'wind' && Math.abs(Math.sin(elapsed * 1.25 + stage.id)) > .72) return null;
  const targetFraction = inBoss
    ? getBossTargetFraction(getPatternRule(stage.pattern)?.boss, bossHits, .5)
    : .25 + seeded(index + stage.id, 9) * .52;
  return { x: width + 24 - (local / 3.4) * (width * .8), y: height * targetFraction, index, inBoss };
}
function activeWindStrength() {
  if (!stage) return 0;
  const rule = getPatternRule(stage.pattern), hazards = rule?.hazards ?? [];
  if (rule?.wind) return rule.wind;
  if (!hazards.length) return 0;
  const interval = Math.max(6.5, stage.targetSeconds / gatesFor(stage));
  return hazards[Math.floor(elapsed / interval) % hazards.length] === 'wind' ? 0.18 : 0;
}
function currentHazard() {
  if (!stage) return null;
  const hazards = getPatternRule(stage.pattern)?.hazards ?? [];
  if (!hazards.length) return null;
  const interval = Math.max(6.5, stage.targetSeconds / gatesFor(stage));
  const index = Math.floor(elapsed / interval), age = elapsed - (index * interval + interval * .28);
  if (age < -.8 || age > 2.9) return null;
  const kind = hazards[index % hazards.length];
  if (['wind', 'ring'].includes(kind)) return null;
  const activeKind = kind === 'rolling-ball' ? 'ball' : kind;
  if (['ball', 'yarn'].includes(activeKind)) return { kind: activeKind, index, age, x: width - 20 + Math.cos(elapsed * .9) * width * .08, y: height * (.48 + Math.sin(elapsed * 1.7) * .17), r: Math.max(13, width * (activeKind === 'ball' ? .085 : .055)) };
  const x = age < 0 ? width - 20 : width + 24 - Math.min(1,age/2.9)*(width*.82);
  const wave = Math.sin(elapsed*1.8+index*1.4);
  const y0 = height*(.26 + seeded(index+stage.id,31)*.48);
  return { kind, index, age, x, y: kind==='swing'||kind==='orbit'||kind==='balloon' ? y0+wave*height*.08 : y0, r: Math.max(10,width*.035) };
}
function flap() {
  if (gameState === 'ready') { gameState = 'playing'; lastFrame = performance.now(); $('canvasHint').style.opacity = '0'; if (save.settings.music) playMusic(); tone(440, .08); }
  if (gameState !== 'playing') return;
  vy = -height * .66 * (getPatternRule(stage.pattern)?.flap ?? 1); tone(520, .065, 'sine', .035);
}
function startRound(id, resume = false) {
  stage = getRound(id); if (!stage) return;
  $('homeScreen').hidden = true; $('mapSection').hidden = true; $('gameScreen').hidden = false;
  $('gameLevelLabel').textContent = `ГЛАВА ${stage.level} · РАУНД ${stage.round} / 10`;
  $('gameRoundTitle').textContent = stage.title;
  const rule = getPatternRule(stage.pattern);
  $('gameCaption').textContent = `${stage.brief} ${rule?.cue ?? ''} Управление: касайся поля, чтобы взлететь. Пауза доступна в любой момент.`;
  const cp = resume && save.checkpoint?.id === id ? save.checkpoint : null;
  elapsed = cp ? Math.min(stage.targetSeconds - 8, cp.elapsed || 0) : 0;
  runTarget = cp?.runTarget >= stage.targetSeconds ? Math.min(stage.targetSeconds + 36, cp.runTarget) : stage.targetSeconds;
  checkpointAt = cp ? Math.min(Math.floor(elapsed / 30) * 30, cp.checkpointAt || Math.floor(elapsed / 30) * 30) : 0;
  y = cp ? cp.y * height : height * .48; vy = cp ? cp.vy * height : 0;
  lives = cp?.lives ?? 3; invulnerable = cp?.invulnerable ?? 0; bossHits = cp?.bossHits ?? 0; bossExtensions = cp?.bossExtensions ?? 0; lastPaw = cp?.lastPaw ?? -1; collected = cp?.collected ?? 0; gameState = 'ready';
  if(rule?.boss) $('gameCaption').textContent = `${stage.brief} ${rule.cue}. ${getBossPhaseCue(rule.boss, bossHits)}. Касайся поля, чтобы лететь; пауза доступна всегда.`;
  $('pauseOverlay').hidden = true; $('resultOverlay').hidden = true; $('canvasHint').style.opacity = '1'; $('canvasHint').textContent = stage.boss ? 'КАСАЙСЯ, ЧТОБЫ ЛЕТЕТЬ · ИЩИ ЗВЁЗДЫ БОССА' : 'КАСАЙСЯ, ЧТОБЫ ЛЕТЕТЬ';
  $('lives').textContent = `${'♥ '.repeat(lives)}${'♡ '.repeat(3-lives)}`.trim(); $('roundProgress').style.width = `${elapsed / runTarget * 100}%`; $('timeLeft').textContent = durationLabel(Math.max(0, runTarget - elapsed));
  resizeCanvas(); canvas.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); persistCheckpoint();
}
function update(dt) {
  if (gameState !== 'playing' || !stage) return;
  elapsed += dt; invulnerable = Math.max(0, invulnerable - dt);
  const rule = getPatternRule(stage.pattern);
  const gravity = height * 1.35 * (rule?.gravity ?? 1); vy = Math.min(height * .75, vy + gravity * dt);
  const windStrength = activeWindStrength();
  if (windStrength) { const gust = Math.sin(elapsed * 1.25 + stage.id); if (Math.abs(gust) > .72) vy += Math.sign(gust) * height * windStrength * dt; }
  y += vy * dt;
  if (y < 34) { y = 34; vy = Math.max(0, vy); }
  if (y > height - 44) { y = height - 44; vy = -height * .15; loseLife(); }
  const px = playerX(), pr = Math.min(18, width * .047), gates = gatesFor(stage);
  for (let i = Math.max(0, Math.floor(elapsed / (stage.targetSeconds / gates)) - 2); i < gates; i++) {
    const g = gateAt(i); if (Math.abs(g.x - px) < g.w * .5 + pr && invulnerable <= 0 && (y - pr < g.top || y + pr > g.bottom)) loseLife();
  }
  const hazard = currentHazard();
  if (hazard && hazard.age >= 0 && invulnerable <= 0 && Math.hypot(hazard.x-px, hazard.y-y) < hazard.r+pr) {
    if (hazard.kind === 'spring') {
      y = Math.max(40, hazard.y - hazard.r - pr); vy = -height * .58; invulnerable = .75; tone(520, .1, 'triangle', .035); persistCheckpoint();
    } else if (hazard.kind === 'balloon') {
      elapsed = checkpointAt; checkpointAt = Math.floor(checkpointAt / 30) * 30; y = height * .48; vy = 0; invulnerable = 1.4;
      $('gameCaption').textContent = 'Мягкий шарик вернул тебя к последней отметке. Попробуй другой маршрут.';
      $('canvasHint').textContent = 'ВОЗВРАТ К ЧЕКПОИНТУ'; $('canvasHint').style.opacity = '1'; persistCheckpoint();
    } else loseLife();
  }
  const paw = currentPaw();
  if (paw && paw.index !== lastPaw && Math.abs(paw.x - px) < pr + 12 && Math.abs(y - paw.y) < pr + 16) {
    lastPaw = paw.index; collected++;
    if (paw.inBoss) {
      bossHits = Math.min(3, bossHits + 1);
      const cue = bossHits < 3 ? getBossPhaseCue(getPatternRule(stage.pattern)?.boss, bossHits) : 'Фаза завершена — путь открыт';
      $('gameCaption').textContent = `Босс: ${cue}. Касайся поля, чтобы лететь; пауза доступна всегда.`;
      $('canvasHint').textContent = `БОСС · ${cue.toUpperCase()}`; $('canvasHint').style.opacity = '1';
      window.setTimeout(() => { if (gameState === 'playing') $('canvasHint').style.opacity = '0'; }, 1500);
    }
    tone(740, .13, 'triangle', .04); persistCheckpoint();
  }
  if (elapsed >= checkpointAt + 30) {
    checkpointAt = Math.floor(elapsed / 30) * 30; persistCheckpoint();
    if (stage.pattern === 'room-shift') { $('gameCaption').textContent = 'Новая схема комнаты открыта. Выбери один из двух коридоров; касайся поля, чтобы лететь.'; $('canvasHint').textContent = 'КОМНАТА ИЗМЕНИЛАСЬ'; $('canvasHint').style.opacity = '1'; window.setTimeout(() => { if (gameState === 'playing') $('canvasHint').style.opacity = '0'; }, 1600); }
  }
  $('roundProgress').style.width = `${Math.min(100, elapsed / runTarget * 100)}%`;
  $('timeLeft').textContent = durationLabel(Math.max(0, runTarget - elapsed));
  $('lives').textContent = `${lives > 0 ? '♥ '.repeat(lives).trim() : ''}${'♡ '.repeat(3 - lives).trim()}`;
  if (elapsed >= runTarget) {
    if (stage.boss && bossHits < 3 && bossExtensions < 3) {
      runTarget += 12; bossExtensions++;
      $('canvasHint').textContent = `БОСС · ЕЩЁ ${3 - bossHits} ЗВЁЗДНЫХ ЗНАКА`;
      $('canvasHint').style.opacity = '1';
      window.setTimeout(() => { if (gameState === 'playing') $('canvasHint').style.opacity = '0'; }, 1800);
    } else {
      if (stage.boss && bossHits < 3) { bossHits = 3; $('canvasHint').textContent = 'КОМАНДА ПОМОГЛА ОТКРЫТЬ ПУТЬ!'; }
      finishRound();
    }
  }
}
function loseLife() {
  if (invulnerable > 0 || lives <= 0) return;
  lives--; invulnerable = 1.25; tone(180, .2, 'triangle', .05); $('lives').textContent = `${'♥ '.repeat(lives).trim()} ${'♡ '.repeat(3 - lives).trim()}`;
  if (lives <= 0) {
    // Поддерживающее восстановление на месте: не заставляем игрока повторять длинный отрезок.
    lives = 3; y = height * .48; vy = 0; invulnerable = 2.2;
    $('canvasHint').textContent = 'КОМАНДА ПОДДЕРЖИВАЕТ · ПРОДОЛЖАЙ'; $('canvasHint').style.opacity = '1'; setTimeout(() => { if (gameState === 'playing') $('canvasHint').style.opacity = '0'; }, 1800);
    persistCheckpoint();
  }
}
function finishRound() {
  if (gameState !== 'playing') return;
  gameState = 'result'; cancelAnimationFrame(raf); raf = 0;
  save.completed = [...new Set([...save.completed, stage.id])].sort((a,b)=>a-b); save.checkpoint = null; persist(); renderMap();
  const chapterComplete = stage.round === 10;
  $('resultEyebrow').textContent = chapterComplete ? `ГЛАВА ${stage.level} · ПРОЙДЕНА` : 'РАУНД ПРОЙДЕН';
  $('resultTitle').textContent = stage.level === 5 && stage.round === 10 ? 'Вы дома. Вместе.' : chapterComplete ? `${stage.name} справился!` : 'Классный полёт!';
  $('resultText').textContent = stage.level === 5 && stage.round === 10 ? 'Пять героев встретились дома. Это только начало вашей общей истории.' : chapterComplete ? `${stage.boss} больше не преграда. Вся команда открывает следующую главу.` : `${stage.title}: испытание позади. Следующий маршрут уже на карте.`;
  $('resultScore').textContent = `✦ ${collected} лапок   ·   ${bossHits}/3 отметки босса`;
  $('nextBtn').innerHTML = stage.id === 50 ? 'На карту <span>⌂</span>' : 'Дальше <span>→</span>';
  $('resultOverlay').hidden = false; $('nextBtn').focus({ preventScroll: true }); drawScene(0); tone(660, .2, 'triangle', .05); tone(880, .28, 'triangle', .04, .16);
}
function pauseGame() {
  if (gameState === 'playing' || gameState === 'ready') { gameState = 'paused'; cancelAnimationFrame(raf); raf = 0; persistCheckpoint(); $('pauseOverlay').hidden = false; $('resumeBtn').focus({ preventScroll: true }); stopMusic(); }
}
function resumeGame() { $('pauseOverlay').hidden = true; gameState = 'playing'; canvas.focus({ preventScroll: true }); lastFrame = performance.now(); if (save.settings.music) playMusic(); loop(lastFrame); }
function returnMap() { cancelAnimationFrame(raf); raf = 0; gameState = 'menu'; $('gameScreen').hidden = true; $('homeScreen').hidden = false; $('mapSection').hidden = false; renderMap(); scrollMap(); document.querySelector('[data-chapter]')?.focus({ preventScroll: true }); if (save.settings.music) playMusic(); }

function drawBoss(bx, by) {
  const r = Math.max(38, height * .105), t = motionReduced() ? 0 : performance.now() / 1000;
  ctx.save(); ctx.translate(bx, by);
  ctx.fillStyle = 'rgba(255,225,167,.13)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2); ctx.fill();
  if (stage.level === 1) {
    const g = ctx.createRadialGradient(-r*.3,-r*.35,2,0,0,r); g.addColorStop(0,'#f8d68c'); g.addColorStop(1,'#b77561'); ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    for(let i=0;i<4;i++){ctx.strokeStyle=['#79c4b7','#f2a66f','#d28ca0','#eed591'][i];ctx.lineWidth=r*.13;ctx.beginPath();ctx.arc(0,0,r*(.38+i*.12),t*(i%2?-.8:.8)+i,t*(i%2?-.8:.8)+i+Math.PI*1.45);ctx.stroke()}
  } else if (stage.level === 2) {
    ctx.rotate(t*1.8); for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.fillStyle=i%2?'#81cbc5':'#f2d38b';ctx.beginPath();ctx.ellipse(0,-r*.56,r*.2,r*.56,0,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#e7a979';ctx.beginPath();ctx.arc(0,0,r*.27,0,Math.PI*2);ctx.fill();
  } else if (stage.level === 3) {
    const g=ctx.createRadialGradient(-r*.35,-r*.4,2,0,0,r);g.addColorStop(0,'#ffe39b');g.addColorStop(1,'#dc7e84');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(0,0,r*.98,0,Math.PI*2);ctx.clip();ctx.strokeStyle='rgba(255,247,224,.72)';ctx.lineWidth=r*.19;for(let k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(-r,k*r*.45);ctx.lineTo(r,k*r*.45);ctx.stroke()}ctx.restore();
  } else if (stage.level === 4) {
    for(let i=0;i<3;i++){ctx.save();ctx.rotate(t*(i%2?-.7:.7)+i*1.2);ctx.strokeStyle=['#7dd0d2','#f3c778','#d69ab1'][i];ctx.lineWidth=r*.08;ctx.beginPath();ctx.ellipse(0,0,r*(.65+i*.18),r*(.24+i*.12),0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=['#7dd0d2','#f3c778','#d69ab1'][i];ctx.beginPath();ctx.arc(r*(.65+i*.18),0,r*.12,0,Math.PI*2);ctx.fill();ctx.restore()}
    ctx.fillStyle='#e2b16d';ctx.beginPath();ctx.arc(0,0,r*.36,0,Math.PI*2);ctx.fill();
  } else {
    const boxes=[[-r*.62,-r*.35,r*.64,r*.62,'#cf9b67'],[r*.02,-r*.52,r*.63,r*.69,'#80aaa1'],[-r*.12,r*.14,r*.66,r*.54,'#d78984']];
    for(const [x,y,w,h,c] of boxes){ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t+x)*.08);ctx.fillStyle=c;rounded(ctx,-w/2,-h/2,w,h,Math.min(12,r*.16));ctx.fill();ctx.strokeStyle='rgba(255,245,220,.55)';ctx.lineWidth=2;ctx.strokeRect(-w*.32,-h*.32,w*.64,h*.64);ctx.restore()}
  }
  // Дружелюбные глазки — босс это смешная помеха, не чудовище.
  ctx.fillStyle='#26343b';ctx.beginPath();ctx.arc(-r*.19,-r*.08,r*.055,0,Math.PI*2);ctx.arc(r*.19,-r*.08,r*.055,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#684c45';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,r*.02,r*.16,.25,Math.PI-.25);ctx.stroke();
  ctx.restore();
}

function drawHero(x, py, s) {
  if (invulnerable > 0 && Math.floor(performance.now() / 90) % 2) return;
  const hero = levels[stage.level - 1];
  ctx.save(); ctx.translate(x, py); ctx.rotate(Math.max(-.28, Math.min(.28, vy / height * .5)));
  ctx.shadowColor = 'rgba(0,0,0,.24)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  const grad = ctx.createLinearGradient(-s,-s,s,s); grad.addColorStop(0, hero.color); grad.addColorStop(1, '#fff0d2');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(0,0,s*1.05,s*.82,0,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.fillStyle='#f5d7b6';ctx.beginPath();ctx.arc(s*.27,-s*.12,s*.55,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#23313a';ctx.beginPath();ctx.arc(s*.43,-s*.22,s*.07,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#936d63';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(s*.53,s*.05,s*.11,.2,1.6);ctx.stroke();
  const portrait = portraits.get(hero.id);
  if (portrait?.complete && portrait.naturalWidth) {
    ctx.save(); ctx.beginPath(); ctx.arc(s*.25,-s*.12,s*.67,0,Math.PI*2); ctx.clip();
    ctx.drawImage(portrait,-s*.39,-s*.79,s*1.34,s*1.34); ctx.restore();
    ctx.strokeStyle='rgba(255,246,224,.88)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(s*.25,-s*.12,s*.68,0,Math.PI*2);ctx.stroke();
  }
  const pawWag=motionReduced()?0:Math.sin(performance.now()/130)*.23;
  ctx.fillStyle=hero.color;ctx.beginPath();ctx.ellipse(-s*.12,s*.61,s*.36,s*.15,pawWag,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function drawScene(t) {
  if (!stage || !ctx) return;
  const w=width,h=height, rule=getPatternRule(stage.pattern), reduced=motionReduced(), ambient=reduced?0:elapsed;
  const palettes=[['#344751','#6e8580','#d9aa78'],['#263e50','#537c89','#9fb9bd'],['#243f3d','#6f896b','#d1a878'],['#122747','#41677f','#c7a77d'],['#352b42','#705261','#e0a379']];
  const palette=palettes[stage.level-1];
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,palette[0]);sky.addColorStop(.58,palette[1]);sky.addColorStop(1,palette[2]);ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  // Мягкое свечение и дальний горизонт.
  const glow=ctx.createRadialGradient(w*.72,h*.23,3,w*.72,h*.23,w*.62);glow.addColorStop(0,'rgba(255,218,155,.32)');glow.addColorStop(1,'rgba(255,218,155,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  for(let i=0;i<33;i++){let sx=seeded(i,stage.id)*w,sy=seeded(i+44,stage.id)*h*.6;ctx.fillStyle=`rgba(255,245,213,${.18+seeded(i,2)*.45})`;ctx.beginPath();ctx.arc(sx,sy,seeded(i,7)*1.6+.3,0,Math.PI*2);ctx.fill()}
  // Дальний силуэт.
  ctx.fillStyle='rgba(21,42,48,.33)';ctx.beginPath();ctx.moveTo(0,h*.7);for(let x=0;x<=w+40;x+=40){const yy=h*(.59+seeded(Math.floor(x/40),stage.id)*.13);ctx.lineTo(x,yy);ctx.lineTo(x+20,yy)}ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();
  if(stage.level===1){ctx.fillStyle='rgba(255,224,163,.11)';for(let i=0;i<3;i++){const x=w*(.12+i*.38),yy=h*.19;ctx.fillRect(x,yy,w*.18,h*.2);ctx.strokeStyle='rgba(255,235,195,.18)';ctx.strokeRect(x,yy,w*.18,h*.2);ctx.beginPath();ctx.moveTo(x+w*.09,yy);ctx.lineTo(x+w*.09,yy+h*.2);ctx.moveTo(x,yy+h*.1);ctx.lineTo(x+w*.18,yy+h*.1);ctx.stroke()}}
  if(stage.level===2){ctx.strokeStyle='rgba(213,235,234,.22)';ctx.lineWidth=1;for(let i=0;i<28;i++){const x=(seeded(i,4)*w+ambient*38)%(w+30),yy=seeded(i,5)*h*.65;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x-8,yy+24);ctx.stroke()}}
  if(stage.level===3){for(let i=0;i<7;i++){const x=seeded(i,14)*w,yy=h*(.58+seeded(i,15)*.12);ctx.fillStyle='rgba(28,55,50,.24)';ctx.beginPath();ctx.arc(x,yy-h*.06,h*(.035+seeded(i,16)*.025),0,Math.PI*2);ctx.fill();ctx.fillRect(x-3,yy-h*.02,6,h*.14)}}
  if(stage.level===4){ctx.strokeStyle='rgba(177,215,230,.12)';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(w*(.45+i*.2),h*.3,h*(.08+i*.04),h*(.025+i*.012),ambient*.08+i,0,Math.PI*2);ctx.stroke()}}
  if(stage.level===5){for(let i=0;i<12;i++){const x=(seeded(i,23)*w+ambient*16)%(w+10),yy=seeded(i,24)*h*.64;ctx.fillStyle=['rgba(240,189,112,.55)','rgba(133,196,181,.55)','rgba(239,155,170,.55)'][i%3];ctx.save();ctx.translate(x,yy);ctx.rotate(ambient*.3+i);ctx.fillRect(-2,-3,4,6);ctx.restore()}}
  // Плавающие декоративные точки.
  for(let i=0;i<9;i++){const px=(seeded(i,stage.id+2)*w-(ambient*16+i*80)%(w+100)+w+100)%(w+100);const py=h*(.16+seeded(i,11)*.7);ctx.fillStyle='rgba(255,238,200,.17)';ctx.beginPath();ctx.arc(px,py,3+seeded(i,5)*3,0,Math.PI*2);ctx.fill()}
  if(rule?.fog){const haze=reduced ? .08 : .08+Math.sin(elapsed*.5)*.025;ctx.fillStyle=`rgba(232,241,228,${haze})`;ctx.fillRect(0,0,w,h)}
  // Ворота и мягкие угрозы.
  if(gameState==='playing'||gameState==='ready'||gameState==='paused'||gameState==='result'){
    const count=gatesFor(stage),interval=stage.targetSeconds/count;
    for(let i=0;i<count;i++){const born=i*interval+1.2;if(elapsed<born-5||elapsed>born+6)continue;const g=gateAt(i);if(g.x<-80||g.x>w+80)continue;const x=g.x-g.w/2;
      ctx.fillStyle='rgba(25,39,46,.76)';ctx.strokeStyle='rgba(247,225,185,.52)';ctx.lineWidth=2;
      rounded(ctx,x,0,g.w,g.top,12);ctx.fill();ctx.stroke();rounded(ctx,x,g.bottom,g.w,h-g.bottom,12);ctx.fill();ctx.stroke();
      const routeColors=['#f0bd70','#85c4b5','#ef9baa'];
      ctx.fillStyle=['memory-colors','garland-rhythm','kitchen-sequence','star-order'].includes(stage.pattern)?routeColors[i%3]:'rgba(240,189,112,.72)';
      ctx.beginPath();ctx.arc(g.x,g.top,3,0,Math.PI*2);ctx.arc(g.x,g.bottom,3,0,Math.PI*2);ctx.fill();
      if(stage.pattern==='marked-boxes'){ctx.fillStyle=routeColors[i%3];ctx.fillRect(g.x-6,Math.max(6,g.top-18),12,12);ctx.fillStyle='#223541';ctx.font='700 8px system-ui';ctx.textAlign='center';ctx.fillText(['○','◇','△'][i%3],g.x,Math.max(15,g.top-9));ctx.textAlign='left'}
    }
  }
  const paw = currentPaw();
  if (paw) {
    const pulse = motionReduced() ? 1 : 1 + Math.sin(performance.now() / 140) * .1;
    ctx.save(); ctx.translate(paw.x, paw.y); ctx.scale(pulse, pulse); ctx.fillStyle = paw.inBoss ? '#ffe7a1' : 'rgba(255,235,191,.95)'; ctx.shadowColor = paw.inBoss ? '#f0bd70' : 'transparent'; ctx.shadowBlur = paw.inBoss ? 18 : 0;
    ctx.beginPath(); ctx.arc(0, 4, 7, 0, Math.PI * 2); ctx.arc(-7, -5, 3.6, 0, Math.PI * 2); ctx.arc(0, -8, 3.6, 0, Math.PI * 2); ctx.arc(7, -5, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const hazard = currentHazard();
  if (hazard) {
    if (hazard.age < 0) { ctx.fillStyle='#ffe2a1';ctx.font='700 18px system-ui';ctx.textAlign='right';ctx.fillText('!',w-20,hazard.y);ctx.textAlign='left'; }
    else if (hazard.kind === 'beam' || hazard.kind === 'comet') {
      ctx.strokeStyle=hazard.kind==='beam'?'rgba(255,216,145,.62)':'rgba(144,218,229,.62)';ctx.lineWidth=hazard.kind==='beam'?7:4;ctx.beginPath();ctx.moveTo(hazard.x-18,hazard.y);ctx.lineTo(hazard.x+18,hazard.y);ctx.stroke();
    } else if (hazard.kind === 'swing') {
      ctx.strokeStyle='rgba(255,236,199,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hazard.x,h*.08);ctx.lineTo(hazard.x,hazard.y);ctx.stroke();ctx.fillStyle='#eea58a';ctx.beginPath();ctx.arc(hazard.x,hazard.y,hazard.r,0,Math.PI*2);ctx.fill();
    } else if (hazard.kind === 'flock') {
      ctx.fillStyle='#f5e4c2';for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(hazard.x+i*hazard.r*.68,hazard.y+Math.abs(i)*5,hazard.r*.42,0,Math.PI*2);ctx.fill()}
    } else if (hazard.kind === 'spray') {
      ctx.strokeStyle='rgba(139,216,225,.85)';ctx.lineWidth=3;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(hazard.x,hazard.y);ctx.lineTo(hazard.x+hazard.r*1.8,hazard.y+i*hazard.r*.6);ctx.stroke()}
    } else if (hazard.kind === 'ball') {
      ctx.fillStyle='#e9a1a7';ctx.beginPath();ctx.arc(hazard.x,hazard.y,hazard.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.45)';ctx.beginPath();ctx.arc(hazard.x-hazard.r*.3,hazard.y-hazard.r*.3,hazard.r*.22,0,Math.PI*2);ctx.fill();
    } else if (hazard.kind === 'yarn') {
      ctx.strokeStyle='#d786a4';ctx.lineWidth=hazard.r*.65;ctx.beginPath();for(let a=0;a<Math.PI*3;a+=.2){const r=hazard.r*(.3+a/(Math.PI*3)*.7);ctx.lineTo(hazard.x+Math.cos(a)*r,hazard.y+Math.sin(a)*r)}ctx.stroke();
    } else if (hazard.kind === 'spring') {
      ctx.strokeStyle='#e7ce92';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(hazard.x-hazard.r,hazard.y+hazard.r*.35);for(let i=0;i<5;i++)ctx.lineTo(hazard.x-hazard.r+i*hazard.r*.5,hazard.y+(i%2?hazard.r*.35:-hazard.r*.35));ctx.stroke()
    } else if (hazard.kind === 'shadow') {
      ctx.fillStyle='rgba(17,31,39,.65)';ctx.beginPath();ctx.ellipse(hazard.x,hazard.y,hazard.r*1.3,hazard.r*.7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,239,196,.7)';ctx.stroke()
    } else if (hazard.kind === 'rhythm') {
      ctx.strokeStyle='#f4d48d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(hazard.x,hazard.y,hazard.r*(.7+.2*Math.sin(elapsed*4)),0,Math.PI*2);ctx.stroke()
    } else if (hazard.kind === 'boxes' || hazard.kind === 'items') {
      ctx.fillStyle='#d8a976';rounded(ctx,hazard.x-hazard.r,hazard.y-hazard.r,hazard.r*2,hazard.r*2,7);ctx.fill();ctx.strokeStyle='rgba(255,239,207,.75)';ctx.strokeRect(hazard.x-hazard.r*.45,hazard.y-hazard.r*.45,hazard.r*.9,hazard.r*.9);
    } else {
      ctx.fillStyle=hazard.kind==='drop'?'#8ad3dc':hazard.kind==='balloon'?'#eb9cab':hazard.kind==='leaf'?'#d6bd75':hazard.kind==='yarn'?'#d28ca0':'#f0c780';ctx.beginPath();
      if(hazard.kind==='leaf'){ctx.ellipse(hazard.x,hazard.y,hazard.r*1.25,hazard.r*.55,Math.sin(elapsed*2),0,Math.PI*2)}else ctx.arc(hazard.x,hazard.y,hazard.r,0,Math.PI*2);ctx.fill();
      if(['balloon','yarn'].includes(hazard.kind)){ctx.strokeStyle='rgba(255,247,220,.7)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(hazard.x,hazard.y+hazard.r);ctx.lineTo(hazard.x+3,hazard.y+hazard.r*1.8);ctx.stroke()}
    }
  }
  if(activeWindStrength()){const dir=Math.sin(elapsed*1.25+stage.id)>0?1:-1;ctx.fillStyle='rgba(255,240,208,.92)';ctx.font='700 16px system-ui';ctx.textAlign='right';ctx.fillText(dir>0?'↘ ПОТОК':'↗ ПОТОК',w-15,52);ctx.textAlign='left'}
  if(stage.boss&&elapsed>stage.targetSeconds*.77){
    const phase=Math.min(3,bossHits);const bx=w*.79,by=h*.47+Math.sin(elapsed*2)*h*.06;
    drawBoss(bx,by);
    for(let p=0;p<3;p++){ctx.fillStyle=p<phase?'#f0bd70':'rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(w*.69+p*20,h*.13,5,0,Math.PI*2);ctx.fill()}
    ctx.font='10px monospace';ctx.fillStyle='rgba(255,255,255,.78)';ctx.textAlign='right';ctx.fillText(stage.boss.toUpperCase(),w-16,h*.085);ctx.textAlign='left';
  }
  // Заголовок цели и стадия.
  ctx.fillStyle='rgba(255,255,255,.86)';ctx.font='500 10px monospace';ctx.fillText(stage.mechanic.toUpperCase(),18,28);
  const px=playerX(); drawHero(px,y||h*.48,Math.max(17,Math.min(23,w*.052)));
  if(gameState==='ready'){
    ctx.fillStyle='rgba(10,22,30,.35)';ctx.fillRect(0,0,w,h);ctx.fillStyle='#fff7e8';ctx.textAlign='center';ctx.font='700 21px system-ui';ctx.fillText('Твой маршрут начинается',w/2,h*.42);ctx.font='13px system-ui';ctx.fillStyle='rgba(255,247,232,.8)';ctx.fillText('Коснись экрана, чтобы взлететь',w/2,h*.47);ctx.textAlign='left';
  }
}
function rounded(c,x,y,w,h,r){if(h<=0)return;r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function loop(now) {
  if(gameState!=='playing')return;
  const dt=Math.min(.04,Math.max(0,(now-lastFrame)/1000));lastFrame=now;update(dt);drawScene(now);if(gameState==='playing')raf=requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown',(e)=>{if(gameState==='playing'||gameState==='ready'){e.preventDefault();flap();if(!raf){lastFrame=performance.now();raf=requestAnimationFrame(loop)}}});
window.addEventListener('keydown',(e)=>{if(['Space','ArrowUp','KeyW'].includes(e.code)&&!$('gameScreen').hidden){e.preventDefault();flap();if(!raf){lastFrame=performance.now();raf=requestAnimationFrame(loop)}}if(e.code==='Escape'&&!$('gameScreen').hidden){gameState==='paused'?resumeGame():pauseGame()}});
window.addEventListener('resize',resizeCanvas);
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(gameState==='playing'||gameState==='ready')pauseGame();stopMusic()}else if(audioContext&&save.settings.music&&gameState!=='paused')playMusic()});
$('continueBtn').addEventListener('click',()=>{const id=chooseRound();startRound(id,!!save.checkpoint)});
$('mapBtn').addEventListener('click',scrollMap);
$('musicBtn').addEventListener('click',()=>setAudio('music',$('musicBtn')));$('sfxBtn').addEventListener('click',()=>setAudio('sfx',$('sfxBtn')));
$('gameMusicBtn').addEventListener('click',()=>setAudio('music',$('gameMusicBtn')));$('gameSfxBtn').addEventListener('click',()=>setAudio('sfx',$('gameSfxBtn')));
$('pauseBtn').addEventListener('click',pauseGame);$('resumeBtn').addEventListener('click',resumeGame);$('restartBtn').addEventListener('click',()=>startRound(stage.id));$('backMapBtn').addEventListener('click',returnMap);
$('retryBtn').addEventListener('click',()=>startRound(stage.id));$('nextBtn').addEventListener('click',()=>{const next=stage.id<50?stage.id+1:1;if(stage.id===50){returnMap();return}startRound(next)});

buildHeroes();renderMap();
for(const [key,id] of [['music','musicBtn'],['sfx','sfxBtn']])toggleState($(id),key);
for(const [key,id] of [['music','gameMusicBtn'],['sfx','gameSfxBtn']])$(id).setAttribute('aria-pressed',String(save.settings[key]));
// Persisted audio preferences are restored visually, but audio is unlocked only by a user gesture.
resizeCanvas();
