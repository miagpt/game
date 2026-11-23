/* ═══════════════════════════════════════════════════════════════
   ПОРШИК · КОТ, КОТОРЫЙ ЛЕТАЕТ — отрисовка
   Всё рисуется кодом: ни одной картинки в игре нет. Мир высотой
   720 единиц масштабируется под экран, поэтому телефон и
   компьютер видят одну и ту же сцену.
   ═══════════════════════════════════════════════════════════════ */

import { THEMES, themeOf } from './themes.js';
import { WORLD } from './rules.js';
import { SKINS } from './content.js';

const G = WORLD.GROUND;
const TAU = Math.PI * 2;
const FONT = '"Nunito", system-ui, sans-serif';

/* Детерминированный «шум» по индексу — для одинаковых звёзд/кустиков. */
export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arc(x + w - rad, y + rad, rad, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arc(x + w - rad, y + h - rad, rad, 0, Math.PI / 2);
  ctx.lineTo(x + rad, y + h);
  ctx.arc(x + rad, y + h - rad, rad, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + rad);
  ctx.arc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.32);
  ctx.bezierCurveTo(x - s * 0.1, y + s * 0.12, x - s * 0.62, y + s * 0.02, x - s * 0.62, y - s * 0.3);
  ctx.bezierCurveTo(x - s * 0.62, y - s * 0.66, x - s * 0.2, y - s * 0.72, x, y - s * 0.34);
  ctx.bezierCurveTo(x + s * 0.2, y - s * 0.72, x + s * 0.62, y - s * 0.66, x + s * 0.62, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.62, y + s * 0.02, x + s * 0.1, y + s * 0.12, x, y + s * 0.32);
  ctx.closePath();
}

/* Палитры обликов: дымчатый кот, у каждого — свой характер. */
const SKIN_PALETTES = {
  classic: { fur: '#9aa4ab', furDark: '#7d878e', belly: '#cfd7dc', ear: '#f0b6bd', eye: '#8fd18a', nose: '#e88f9b', extra: null },
  scarf: { fur: '#a3adb4', furDark: '#828c93', belly: '#d7dee3', ear: '#f0b6bd', eye: '#8fd18a', nose: '#e88f9b', extra: 'scarf', accent: '#5fb8a8' },
  chef: { fur: '#b8c0c6', furDark: '#99a2a9', belly: '#e6ebef', ear: '#f2bcc2', eye: '#8fd18a', nose: '#e88f9b', extra: 'chef', accent: '#ffffff' },
  cosmo: { fur: '#c2ccd8', furDark: '#9eabb9', belly: '#eef3f8', ear: '#e8b0b8', eye: '#9fd6e8', nose: '#e88f9b', extra: 'space', accent: '#9fc3e0' },
  pirate: { fur: '#9199a0', furDark: '#747c83', belly: '#c8d0d5', ear: '#eaa9b1', eye: '#8fd18a', nose: '#e88f9b', extra: 'pirate', accent: '#c0453c' },
  party: { fur: '#a9b2b8', furDark: '#868f96', belly: '#dee4e8', ear: '#f4b8c4', eye: '#8fd18a', nose: '#e88f9b', extra: 'party', accent: '#b56fd1' },
  night: { fur: '#5c6679', furDark: '#454e5e', belly: '#aab5c8', ear: '#e0a3ad', eye: '#ffd166', nose: '#e08f9b', extra: 'stars', accent: '#f2c14e' },
  snow: { fur: '#f2f7fa', furDark: '#d5e2ea', belly: '#ffffff', ear: '#f6c3c9', eye: '#8ecbe0', nose: '#e88f9b', extra: 'collar', accent: '#8fd6c2' },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.floats = [];
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.pawT = 0;
    this.worldW = 400;
    this.viewH = 720;
    this.k = 1;
    this.reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.skin = 'classic';
    this.skinPalette = SKIN_PALETTES.classic;
    this.fest = 0;
    this.dim = 0;
  }

  setSkin(id) {
    this.skin = SKIN_PALETTES[id] ? id : 'classic';
    this.skinPalette = SKIN_PALETTES[this.skin];
  }

  /* Подгоняет холст под контейнер. Возвращает ширину мира. */
  resize() {
    const cssW = this.canvas.clientWidth || 400;
    const cssH = this.canvas.clientHeight || 720;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.cssW = cssW;
    this.cssH = cssH;
    this.k = (this.canvas.height || 720) / WORLD.H;
    // ширина мира в единицах: телефон видит уже, монитор — шире
    this.worldW = Math.max(320, (this.canvas.width || 400) / (this.k || 1));
    return this.worldW;
  }

  burst(x, y, n = 8, color = '#ffd166', spread = 160, options = {}) {
    const count = this.reduceMotion ? Math.ceil(n / 2) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = spread * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.5 + Math.random() * 0.5,
        t: 0,
        size: 2 + Math.random() * (options.size || 4),
        color,
        shape: options.shape || 'dot',
        gravity: options.gravity ?? 420,
      });
    }
  }

  float(text, x, y, color = '#fff', size = 22) {
    this.floats.push({ text, x, y, t: 0, life: 1.1, color, size });
  }

  stepEffects(dt) {
    this.time += dt;
    this.pawT += dt;
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      if (p.t > p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      if (f.t > f.life) this.floats.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------
     ГЛАВНЫЙ КАДР
     ------------------------------------------------------------ */
  draw(sim, { paused = false } = {}) {
    const ctx = this.ctx;
    const theme = themeOf(sim.world);
    const W = this.worldW;
    const k = this.k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, WORLD.H);

    const sh = this.shake * this.shake * 12;
    const sx = this.reduceMotion ? 0 : (Math.random() - 0.5) * sh;
    const sy = this.reduceMotion ? 0 : (Math.random() - 0.5) * sh;

    ctx.save();
    ctx.translate(sx, sy);

    this.drawSky(ctx, theme, sim, W);
    this.drawClouds(ctx, theme, sim, W);
    this.drawNear(ctx, theme, sim, W);
    this.drawGround(ctx, theme, sim, W);
    this.drawFinish(ctx, sim, theme);
    for (const gate of sim.gates) this.drawGate(ctx, gate, sim, theme);
    for (const it of sim.items) if (!it.taken) this.drawItem(ctx, it, sim, theme);
    for (const h of sim.hazards) if (!h.dead) this.drawHazard(ctx, h, sim, theme);
    this.drawCat(ctx, sim);
    this.drawParticles(ctx);
    this.drawFloats(ctx);
    this.drawThreats(ctx, sim, W);
    ctx.restore();

    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.55, this.flash * 0.5);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, WORLD.H);
      ctx.globalAlpha = 1;
    }
    if (sim.inv > 0 && sim.status === 'playing') this.drawHurtVignette(ctx, sim, W);
    if (sim.status === 'ready' && !paused) this.drawTapHint(ctx, W);
    if (paused) {
      ctx.fillStyle = 'rgba(34,24,46,0.35)';
      ctx.fillRect(0, 0, W, WORLD.H);
    }
  }

  /* ---------------- небо, даль, ближний план ---------------- */

  drawSky(ctx, theme, sim, W) {
    const g = ctx.createLinearGradient(0, 0, 0, G);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, W + 60, G + 60);

    // солнце/луна
    const cx = W * 0.76;
    const cy = 128;
    const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 150);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = theme.night ? 0.35 : 0.7;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 150, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.sun;
    ctx.beginPath();
    ctx.arc(cx, cy, theme.night ? 34 : 44, 0, TAU);
    ctx.fill();
    if (theme.night) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.arc(cx - 12, cy - 10, 8, 0, TAU);
      ctx.arc(cx + 10, cy + 6, 6, 0, TAU);
      ctx.arc(cx - 2, cy + 16, 5, 0, TAU);
      ctx.fill();
    }

    // звёзды
    if (theme.night) {
      for (let i = 0; i < 44; i++) {
        const x = (hash(i) * W * 1.2 - sim.dist * 0.02) % W;
        const y = hash(i + 91) * 330;
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(this.time * 1.5 + i));
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = '#fff8e2';
        ctx.beginPath();
        ctx.arc(x < 0 ? x + W : x, y, 1.1 + hash(i + 7) * 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // дальний план, прокручивается медленно
    const off = (sim.dist * 0.12) % (W + 200);
    ctx.save();
    ctx.globalAlpha = theme.night ? 0.5 : 0.42;
    ctx.fillStyle = theme.accent;
    if (theme.far === 'rooftops' || theme.far === 'houses' || theme.far === 'home' || theme.far === 'hearth') {
      for (let i = 0; i < 8; i++) {
        const x = ((i * 190 - off) % (W + 260)) - 140;
        const h = theme.far === 'hearth' ? 150 + hash(i) * 90 : 190 + hash(i) * 110;
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x, G - h, 150, h);
        ctx.beginPath();
        ctx.moveTo(x - 18, G - h);
        ctx.lineTo(x + 75, G - h - 64);
        ctx.lineTo(x + 168, G - h);
        ctx.closePath();
        ctx.fill();
        if (theme.far !== 'rooftops') {
          ctx.globalAlpha = theme.night ? 0.26 : 0.16;
          ctx.fillStyle = '#fff3cf';
          for (let w = 0; w < 3; w++) ctx.fillRect(x + 24 + w * 44, G - h + 40, 22, 28);
          ctx.globalAlpha = theme.night ? 0.5 : 0.42;
          ctx.fillStyle = theme.accent;
        }
      }
    } else if (theme.far === 'city') {
      for (let i = 0; i < 14; i++) {
        const x = ((i * 90 - off * 1.2) % (W + 200)) - 100;
        const h = 120 + hash(i) * 190;
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x, G - h - 60, 64, h + 60);
        ctx.globalAlpha = theme.night ? 0.22 : 0.12;
        ctx.fillStyle = '#fff2c4';
        for (let w = 0; w < 4; w++) {
          if (hash(i * 9 + w) > 0.45) ctx.fillRect(x + 10 + (w % 2) * 28, G - h - 40 + Math.floor(w / 2) * 40, 14, 18);
        }
        ctx.fillStyle = theme.accent;
        ctx.globalAlpha = theme.night ? 0.5 : 0.42;
      }
    } else if (theme.far === 'beams') {
      // балки чердака
      ctx.fillStyle = theme.accent;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 210 - off) % (W + 260)) - 130;
        ctx.save();
        ctx.translate(x, G);
        ctx.rotate(-0.42);
        ctx.fillRect(0, -G, 26, G * 1.6);
        ctx.restore();
      }
      ctx.fillRect(-30, 190, W + 60, 22);
      ctx.fillRect(-30, 470, W + 60, 18);
    } else if (theme.far === 'tiles') {
      // кафель кухни и пекарни
      for (let row = 0; row < 6; row++) {
        const y = 150 + row * 78;
        for (let i = 0; i < 10; i++) {
          const x = ((i * 96 - off * 0.6) % (W + 160)) - 80;
          ctx.globalAlpha = 0.14 + (row % 2) * 0.04;
          rr(ctx, x, y, 84, 64, 8);
          ctx.fill();
        }
      }
      ctx.globalAlpha = theme.night ? 0.5 : 0.42;
    } else if (theme.far === 'baskets') {
      ctx.fillStyle = theme.accent;
      for (let i = 0; i < 9; i++) {
        const x = ((i * 168 - off) % (W + 240)) - 120;
        rr(ctx, x, G - 170 - hash(i) * 60, 140, 76, 26);
        ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x + 30 + k * 40, G - 132 - hash(i) * 60, 20, 0, TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = theme.night ? 0.5 : 0.42;
      }
    }
    ctx.restore();
  }

  drawClouds(ctx, theme, sim, W) {
    const n = theme.night ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const speed = 0.06 + (i % 3) * 0.03;
      const x = ((i * 260 + hash(i + 3) * 120 - sim.dist * speed) % (W + 320)) - 160;
      const y = 90 + hash(i + 11) * 220;
      const s = 0.7 + hash(i + 5) * 0.7;
      ctx.globalAlpha = theme.night ? 0.12 : 0.3;
      ctx.fillStyle = theme.night ? '#d9c7ff' : '#ffffff';
      const puff = (dx, dy, r) => {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, TAU);
        ctx.fill();
      };
      puff(0, 0, 40 * s);
      puff(38 * s, 6 * s, 30 * s);
      puff(-36 * s, 8 * s, 26 * s);
      puff(12 * s, -18 * s, 28 * s);
      rr(ctx, x - 60 * s, y, 130 * s, 32 * s, 16 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawNear(ctx, theme, sim, W) {
    const off = (sim.dist * 0.45) % 190;
    ctx.save();
    ctx.globalAlpha = 0.85;
    if (theme.near === 'chimneys') {
      ctx.fillStyle = theme.accent;
      for (let i = 0; i < 9; i++) {
        const x = (i * 190 - off) % (W + 200);
        const h = 60 + hash(i + 4) * 70;
        rr(ctx, x, G - h, 52, h + 8, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        rr(ctx, x - 4, G - h - 12, 60, 16, 5);
        ctx.fill();
        ctx.fillStyle = theme.accent;
        // дымок
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#ffffff';
        for (let s = 0; s < 3; s++) {
          ctx.beginPath();
          ctx.arc(x + 26 + Math.sin(this.time * 0.8 + i + s) * 10, G - h - 26 - s * 20, 10 + s * 4, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = theme.accent;
      }
    } else if (theme.near === 'steam') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 12; i++) {
        const x = (i * 146 - off) % (W + 160);
        const y = G - 120 - ((this.time * 22 + i * 90) % 380);
        ctx.beginPath();
        ctx.arc(x, y, 14 + hash(i) * 10, 0, TAU);
        ctx.fill();
      }
    } else if (theme.near === 'cobweb' || theme.near === 'threads') {
      const strand = theme.near === 'threads' ? '#c98aa8' : 'rgba(255,255,255,0.5)';
      ctx.strokeStyle = strand;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 14; i++) {
        const x = (i * 121 - off * 1.2) % (W + 140);
        const y = 90 + hash(i + 21) * 400;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.quadraticCurveTo(x + 30, y * 0.5, x + 8, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 8, y, 4, 0, TAU);
        ctx.fillStyle = strand;
        ctx.fill();
      }
    } else if (theme.near === 'puddles') {
      for (let i = 0; i < 9; i++) {
        const x = (i * 152 - off) % (W + 160);
        ctx.fillStyle = 'rgba(220,238,248,0.42)';
        ctx.beginPath();
        ctx.ellipse(x, G - 8, 54, 9, 0, 0, TAU);
        ctx.fill();
      }
    } else if (theme.near === 'sparks' || theme.near === 'embers') {
      for (let i = 0; i < 16; i++) {
        const x = (i * 113 - off * 0.7) % (W + 140);
        const y = G - ((this.time * 40 + i * 70) % 460);
        ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(this.time + i));
        ctx.fillStyle = i % 2 ? '#ffb26b' : '#ffd98a';
        ctx.beginPath();
        ctx.arc(x, y, 2.4 + hash(i) * 2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 0.85;
    } else if (theme.near === 'windows') {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffe9a8';
      for (let i = 0; i < 10; i++) {
        const x = (i * 158 - off * 0.5) % (W + 180);
        const y = 170 + hash(i + 6) * 350;
        rr(ctx, x, y, 34, 46, 5);
        ctx.fill();
      }
      ctx.globalAlpha = 0.85;
    } else if (theme.near === 'crumb') {
      for (let i = 0; i < 16; i++) {
        const x = (i * 111 - off * 1.3) % (W + 120);
        ctx.fillStyle = 'rgba(255,241,214,0.85)';
        ctx.beginPath();
        ctx.arc(x, 130 + hash(i + 41) * 420, 2.5 + hash(i + 3) * 2, 0, TAU);
        ctx.fill();
      }
    } else if (theme.near === 'flowers') {
      for (let i = 0; i < 12; i++) {
        const x = (i * 120 - off) % (W + 160);
        const y = G - 130 - hash(i + 13) * 140;
        ctx.fillStyle = '#e07f6a';
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU + this.time * 0.2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 6, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawGround(ctx, theme, sim, W) {
    const g = ctx.createLinearGradient(0, G, 0, WORLD.H);
    g.addColorStop(0, theme.ground[0]);
    g.addColorStop(1, theme.ground[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-30, G, W + 60, WORLD.H - G + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-30, G, W + 60, 4);
    // фактура пола: тонкие штрихи, которые едут вместе с миром
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = ((i * 74 - sim.dist) % (W + 120)) - 60;
      ctx.beginPath();
      ctx.moveTo(x, G + 12);
      ctx.lineTo(x + 30, G + 12);
      ctx.stroke();
    }
  }

  /* ---------------- ворота ---------------- */

  drawGate(ctx, gate, sim, theme) {
    const x = gate.x - sim.dist;
    if (x > this.worldW + 140 || x < -140) return;
    const top = gate.gapY - gate.gap / 2;
    const bottom = gate.gapY + gate.gap / 2;
    const w = gate.w;
    const style = theme.gate;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.16)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    const post = (px, py, ph) => {
      ctx.save();
      if (style === 'brick') {
        ctx.fillStyle = '#c9805c';
        rr(ctx, px, py, w, ph, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        for (let yy = py + 14; yy < py + ph - 8; yy += 26) {
          for (let xx = px + 8 + ((yy / 26) % 2 ? 12 : 0); xx < px + w - 10; xx += 30) {
            ctx.fillRect(xx, yy, 22, 14);
          }
        }
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(px, py, 6, ph);
      } else if (style === 'tile') {
        ctx.fillStyle = '#f6f0e4';
        rr(ctx, px, py, w, ph, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(127,174,146,0.55)';
        ctx.lineWidth = 3;
        for (let yy = py + 24; yy < py + ph; yy += 34) {
          ctx.beginPath();
          ctx.moveTo(px + 4, yy);
          ctx.lineTo(px + w - 4, yy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(127,174,146,0.22)';
        rr(ctx, px + 10, py + 10, w - 20, 14, 6);
        ctx.fill();
      } else if (style === 'shelf') {
        ctx.fillStyle = '#8d6b4c';
        rr(ctx, px, py, w, ph, 8);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const yy = py + 40 + i * 62;
          ctx.fillStyle = '#b48a63';
          ctx.fillRect(px - 10, yy, w + 20, 12);
          ctx.fillStyle = ['#c98a5c', '#9fb0a8', '#c0a0b8'][i % 3];
          ctx.fillRect(px + 12, yy - 28, 14, 28);
          ctx.fillRect(px + 40, yy - 22, 12, 22);
        }
      } else if (style === 'thread') {
        ctx.strokeStyle = '#c98aa8';
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(px + 16 + i * 22, py);
          ctx.quadraticCurveTo(px + 40 + Math.sin(py * 0.01 + i) * 14, py + ph / 2, px + 16 + i * 22, py + ph);
          ctx.stroke();
        }
        for (let i = 0; i < 5; i++) {
          const yy = py + 30 + i * (ph / 5);
          ctx.fillStyle = ['#e88fab', '#8fb8d8', '#f2c14e'][i % 3];
          ctx.beginPath();
          ctx.arc(px + w / 2, yy, 14, 0, TAU);
          ctx.fill();
        }
      } else if (style === 'fence') {
        ctx.fillStyle = '#8fa2ab';
        rr(ctx, px, py, w, ph, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        for (let yy = py + 18; yy < py + ph - 12; yy += 34) {
          rr(ctx, px + 12, yy, w - 24, 16, 6);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(px, py, 5, ph);
      } else if (style === 'stone') {
        ctx.fillStyle = theme.accent;
        rr(ctx, px, py, w, ph, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        for (let yy = py + 16; yy < py + ph - 10; yy += 26) {
          for (let xx = px + 8; xx < px + w - 8; xx += 30) {
            ctx.fillRect(xx, yy, 22, 16);
          }
        }
      } else if (style === 'awning') {
        // полосатый навес-колонна
        ctx.fillStyle = '#fff6e7';
        rr(ctx, px, py, w, ph, 10);
        ctx.fill();
        const stripes = 5;
        const sh = ph / stripes;
        for (let i = 0; i < stripes; i++) {
          ctx.fillStyle = i % 2 ? theme.accent : '#fff6e7';
          ctx.fillRect(px, py + i * sh, w, sh);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(px, py, 6, ph);
      } else if (style === 'ember') {
        const grd = ctx.createLinearGradient(px, py, px + w, py + ph);
        grd.addColorStop(0, '#6b4030');
        grd.addColorStop(0.5, '#a9603a');
        grd.addColorStop(1, '#4a2c22');
        ctx.fillStyle = grd;
        rr(ctx, px, py, w, ph, 10);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const yy = py + 30 + i * (ph / 5);
          const gg = ctx.createRadialGradient(px + w / 2, yy, 1, px + w / 2, yy, 26);
          gg.addColorStop(0, 'rgba(255,196,110,0.85)');
          gg.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.arc(px + w / 2, yy, 26, 0, TAU);
          ctx.fill();
        }
      } else if (style === 'antenna') {
        ctx.fillStyle = '#3c3452';
        rr(ctx, px + w / 2 - 6, py, 12, ph, 6);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const yy = py + 26 + i * (ph / 5.2);
          ctx.strokeStyle = 'rgba(255,207,122,0.85)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px + w / 2 - 18, yy);
          ctx.lineTo(px + w / 2 + 18, yy);
          ctx.stroke();
          const gg = ctx.createRadialGradient(px + w / 2, yy, 1, px + w / 2, yy, 20);
          gg.addColorStop(0, 'rgba(255,214,120,0.7)');
          gg.addColorStop(1, 'rgba(255,214,120,0)');
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.arc(px + w / 2, yy, 20, 0, TAU);
          ctx.fill();
          ctx.fillStyle = theme.accent;
          ctx.beginPath();
          ctx.arc(px + w / 2, yy, 5, 0, TAU);
          ctx.fill();
        }
      } else if (style === 'bloom') {
        ctx.fillStyle = '#e8b7a3';
        rr(ctx, px, py, w, ph, 14);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const yy = py + 30 + i * (ph / 4);
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU;
            ctx.fillStyle = '#ffe0d2';
            ctx.beginPath();
            ctx.ellipse(px + w / 2 + Math.cos(a) * 11, yy + Math.sin(a) * 11, 8, 5, a, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#f2c14e';
          ctx.beginPath();
          ctx.arc(px + w / 2, yy, 5, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    post(x, -20, top + 20);
    post(x, bottom, WORLD.H - bottom + 20);

    // подсветка просвета
    const grad = ctx.createLinearGradient(x, top, x, bottom);
    grad.addColorStop(0, 'rgba(255,255,255,0.24)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(255,255,255,0.24)');
    ctx.fillStyle = grad;
    ctx.fillRect(x + 4, top, w - 8, Math.max(0, bottom - top));

    // «тёплая» перекладина сбоку: показывает, что ворота добрые
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    rr(ctx, x + w / 2 - 3, top - 8, 6, 8, 3);
    ctx.fill();
    ctx.restore();
  }

  drawFinish(ctx, sim, theme) {
    if (sim.finishX == null) return;
    const x = sim.finishX - sim.dist;
    if (x > this.worldW + 400) return;
    ctx.save();
    const beam = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
    beam.addColorStop(0, 'rgba(255,220,150,0)');
    beam.addColorStop(0.5, 'rgba(255,236,190,0.7)');
    beam.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(x - 90, 0, 180, G);
    const pulse = 1 + Math.sin(this.time * 3) * 0.06;
    ctx.translate(x, 320);
    ctx.scale(pulse, pulse);
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 130);
    glow.addColorStop(0, 'rgba(255,120,150,0.55)');
    glow.addColorStop(1, 'rgba(255,120,150,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 130, 0, TAU);
    ctx.fill();
    heartPath(ctx, 0, 10, 130);
    ctx.fillStyle = '#ff6f91';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ДОМ', 0, 14);
    ctx.restore();
    void theme;
  }

  /* ---------------- предметы ---------------- */

  drawItem(ctx, it, sim, theme) {
    const x = it.x - sim.dist;
    if (x < -60 || x > this.worldW + 80) return;
    const y = it.y;
    ctx.save();
    const bob = this.reduceMotion ? 0 : Math.sin(this.time * 3 + x * 0.02) * 3;
    ctx.translate(x, y + bob);

    if (it.type === 'fish') {
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
      glow.addColorStop(0, 'rgba(180,226,240,0.55)');
      glow.addColorStop(1, 'rgba(180,226,240,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, TAU);
      ctx.fill();
      // серебристая рыбка
      ctx.fillStyle = '#9fc9dc';
      ctx.beginPath();
      ctx.ellipse(-1, 1, 14, 9, -0.12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d5edf6';
      ctx.beginPath();
      ctx.ellipse(-2, 0, 10.5, 6, -0.12, 0, TAU);
      ctx.fill();
      // хвост
      ctx.fillStyle = '#7fb2c8';
      ctx.beginPath();
      ctx.moveTo(11, 1);
      ctx.lineTo(20, -7);
      ctx.lineTo(20, 9);
      ctx.closePath();
      ctx.fill();
      // глазик и жабра
      ctx.fillStyle = '#3a4a52';
      ctx.beginPath();
      ctx.arc(-8, -2, 1.9, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,130,150,0.65)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(-3, 0, 6, -1.1, 1.1);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(-6, -4, 3.4, 1.8, -0.3, 0, TAU);
      ctx.fill();
    } else if (it.type === 'treat') {
      const colors = { sausage: '#e0745f', bun: '#e0a95c', mouse: '#c9b48c', cream: '#f7f1e3', heart: '#f27d92' };
      const c = colors[it.treat] || '#e0745f';
      ctx.fillStyle = c;
      if (it.treat === 'sausage') {
        rr(ctx, -15, -7, 30, 14, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        rr(ctx, -10, -4, 12, 4, 2);
        ctx.fill();
      } else if (it.treat === 'bun') {
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 11, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,90,40,0.5)';
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 6, -7);
          ctx.lineTo(i * 6 + 2, 5);
          ctx.stroke();
        }
      } else if (it.treat === 'mouse') {
        // золотая мышка-игрушка
        ctx.beginPath();
        ctx.ellipse(0, 2, 14, 8, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-11, -4, 5, 0, TAU);
        ctx.arc(-4, -6, 4.4, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#a89060';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 3);
        ctx.quadraticCurveTo(24, 8, 20, 16);
        ctx.stroke();
        ctx.fillStyle = '#3a4a52';
        ctx.beginPath();
        ctx.arc(-12, -5, 1.6, 0, TAU);
        ctx.fill();
      } else if (it.treat === 'cream') {
        ctx.beginPath();
        ctx.moveTo(-14, 6);
        ctx.lineTo(14, 6);
        ctx.quadraticCurveTo(10, -13, 0, -13);
        ctx.quadraticCurveTo(-10, -13, -14, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(180,150,120,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 6, 14, 3, 0, 0, TAU);
        ctx.fill();
      } else {
        heartPath(ctx, 0, 2, 26);
        ctx.fill();
      }
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + Math.sin(this.time * 4) * 3, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (it.type === 'power') {
      const colors = { shield: '#8FD3F4', magnet: '#7FB7E6', energizer: '#FFD06B' };
      const icons = { shield: '🫧', magnet: '🧲', energizer: '⚡' };
      const c = colors[it.power] || '#8FD3F4';
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
      glow.addColorStop(0, c);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = '20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icons[it.power] || '?', 0, 1);
    }
    ctx.restore();
    void theme;
  }

  /* ---------------- опасности ---------------- */

  drawHazard(ctx, h, sim, theme) {
    const x = h.x - sim.dist;
    if (x < -80 || x > this.worldW + 90) return;
    ctx.save();
    ctx.translate(x, h.y);
    if (h.type === 'steam') {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + this.time * 0.6;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 16, Math.sin(a) * 16, 8 + Math.sin(this.time * 2 + i) * 2, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(230,246,255,0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.fill();
    } else if (h.type === 'dust' || h.type === 'flour') {
      ctx.fillStyle = h.type === 'flour' ? 'rgba(255,255,255,0.95)' : 'rgba(214,192,160,0.95)';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + this.time * 0.5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 11, Math.sin(a) * 11, 9 + Math.sin(this.time * 2 + i) * 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = h.type === 'flour' ? '#ffffff' : '#c9b28c';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fill();
      if (h.type === 'dust') {
        ctx.fillStyle = 'rgba(120,95,65,0.5)';
        ctx.beginPath();
        ctx.arc(-3, -2, 2, 0, TAU);
        ctx.arc(4, 3, 1.6, 0, TAU);
        ctx.fill();
      }
    } else if (h.type === 'yarn' || h.type === 'yarnshot') {
      const shooting = h.type === 'yarnshot';
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.6;
      if (!shooting) {
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(6, -30, 0, -42);
        ctx.stroke();
      }
      ctx.fillStyle = '#d98aa8';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-2, -1, 10, 0.4, 2.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(2, 2, 7, 2.8, 5.2);
      ctx.stroke();
      if (shooting) {
        ctx.strokeStyle = 'rgba(217,138,168,0.55)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(40, -6);
        ctx.stroke();
      }
    } else if (h.type === 'drop') {
      ctx.fillStyle = 'rgba(180,220,245,0.9)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 12, 0.1, 0, TAU);
      ctx.fill();
    } else if (h.type === 'pigeon') {
      const fl = Math.sin(this.time * 9) * 8;
      ctx.fillStyle = '#93a3b5';
      ctx.beginPath();
      ctx.ellipse(0, 2, 15, 10, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b8c5d2';
      ctx.beginPath();
      ctx.arc(-11, -6, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#8fa0b0';
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(22, -6 + fl);
      ctx.lineTo(14, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath();
      ctx.moveTo(-17, -6);
      ctx.lineTo(-23, -3);
      ctx.lineTo(-17, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4a5a68';
      ctx.beginPath();
      ctx.arc(-13, -8, 1.7, 0, TAU);
      ctx.fill();
    } else if (h.type === 'ember') {
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 20);
      glow.addColorStop(0, 'rgba(255,214,140,0.95)');
      glow.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffcf8a';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + this.time * 2;
        const r = i % 2 ? 4 : 11;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    void theme;
  }

  /* ---------------- Поршик ---------------- */

  drawCat(ctx, sim) {
    const p = this.skinPalette;
    const breathing = sim.status === 'ready' ? Math.sin(this.time * 2) * 0.03 : 0;
    const flapSpeed = sim.status === 'playing' ? 12 : 5;
    const paddle = Math.sin(this.pawT * flapSpeed);
    const squash = sim.status === 'dying' ? 0.9 : 1;

    ctx.save();
    ctx.translate(sim.birdX, sim.bird.y);
    ctx.rotate(sim.status === 'dying' ? sim.bird.rot * 0.8 : sim.bird.rot * 0.34);
    ctx.scale(1 + breathing, squash - breathing);
    if (sim.inv > 0 && Math.sin(this.time * 26) > 0) ctx.globalAlpha = 0.55;

    // тень-ореол
    const halo = ctx.createRadialGradient(0, 0, 8, 0, 0, 52);
    halo.addColorStop(0, 'rgba(255,246,210,0.4)');
    halo.addColorStop(1, 'rgba(255,246,210,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, TAU);
    ctx.fill();

    // хвост: длинный, живой, с тёмным кончиком
    ctx.save();
    ctx.translate(-20, 4);
    ctx.rotate(-0.25 + paddle * 0.16);
    ctx.strokeStyle = p.fur;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-24, 2, -32, -18);
    ctx.stroke();
    ctx.strokeStyle = p.furDark;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(-27, -10);
    ctx.quadraticCurveTo(-30, -16, -32, -18);
    ctx.stroke();
    ctx.restore();

    // задняя лапа (гребёт)
    ctx.save();
    ctx.translate(-8, 16);
    ctx.rotate(0.4 + paddle * 0.5);
    ctx.fillStyle = p.furDark;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6.5, 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();

    // тельце
    ctx.fillStyle = p.fur;
    ctx.beginPath();
    ctx.ellipse(0, 6, 30, 23, -0.14, 0, TAU);
    ctx.fill();
    // полоски на спине
    ctx.strokeStyle = p.furDark;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-11 + i * 9, -12);
      ctx.quadraticCurveTo(-6 + i * 9, -4, -10 + i * 9, 2);
      ctx.stroke();
    }
    // животик
    ctx.fillStyle = p.belly;
    ctx.beginPath();
    ctx.ellipse(2, 13, 19, 13, -0.1, 0, TAU);
    ctx.fill();

    // передние лапки — «гребут» в воздухе
    for (const [dx, phase] of [
      [8, 0],
      [-4, 1.9],
    ]) {
      ctx.save();
      ctx.translate(dx, 16);
      ctx.rotate(0.55 + Math.sin(paddle * 1 + phase) * 0.42);
      ctx.fillStyle = p.fur;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6.5, 0.15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = p.belly;
      ctx.beginPath();
      ctx.arc(9, 1, 4.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = p.furDark;
      ctx.lineWidth = 1.4;
      for (let c = -1; c <= 1; c++) {
        ctx.beginPath();
        ctx.moveTo(11, 1 + c * 2.4);
        ctx.lineTo(14, 1 + c * 2.6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // голова
    ctx.save();
    ctx.translate(16, -14);
    ctx.rotate(paddle * -0.05);
    // уши
    ctx.fillStyle = p.fur;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 6 - 2, -12);
      ctx.lineTo(s * 15, -27);
      ctx.lineTo(s * 17 - 1, -9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.ear;
      ctx.beginPath();
      ctx.moveTo(s * 7 - 1, -13);
      ctx.lineTo(s * 13.5, -23);
      ctx.lineTo(s * 14.5 - 1, -11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.fur;
    }
    // круглая голова
    ctx.fillStyle = p.fur;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, TAU);
    ctx.fill();
    // мордочка посветлее
    ctx.fillStyle = p.belly;
    ctx.beginPath();
    ctx.ellipse(5, 6, 13, 10, -0.1, 0, TAU);
    ctx.fill();
    // полоски-«М» на лбу
    ctx.strokeStyle = p.furDark;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-7, -13);
    ctx.lineTo(-4, -6);
    ctx.moveTo(0, -14);
    ctx.lineTo(1, -6);
    ctx.moveTo(7, -13);
    ctx.lineTo(5, -6);
    ctx.stroke();

    // глаза
    const blink = Math.sin(this.time * 1.6) > 0.985;
    const eyes = [
      [2, -2.5],
      [13, -1.5],
    ];
    for (const [ex, ey] of eyes) {
      if (blink) {
        ctx.strokeStyle = '#3a3a44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - 4, ey);
        ctx.quadraticCurveTo(ex, ey + 3, ex + 4, ey);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.eye;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 4.2, 5, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2b2b34';
        ctx.beginPath();
        ctx.ellipse(ex + 0.6, ey, 1.6, 4.2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex - 1.4, ey - 2.2, 1.4, 0, TAU);
        ctx.fill();
      }
    }
    // нос и рот
    ctx.fillStyle = p.nose;
    ctx.beginPath();
    ctx.moveTo(9, 5);
    ctx.lineTo(13, 5);
    ctx.lineTo(11, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,60,0.55)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(11, 8);
    ctx.lineTo(11, 10);
    ctx.moveTo(11, 10);
    ctx.quadraticCurveTo(8, 12, 6.5, 9.5);
    ctx.moveTo(11, 10);
    ctx.quadraticCurveTo(14, 12, 15.5, 9.5);
    ctx.stroke();
    // усы
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(6, 7 + i * 2);
      ctx.quadraticCurveTo(-6, 4 + i * 5, -14, 2 + i * 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, 7 + i * 2);
      ctx.quadraticCurveTo(26, 4 + i * 5, 32, 3 + i * 7);
      ctx.stroke();
    }
    // аксессуар облика
    this.drawSkinExtras(ctx, p);
    ctx.restore();

    // пузырь-защита
    if (sim.shield) {
      ctx.strokeStyle = 'rgba(143,211,244,0.95)';
      ctx.fillStyle = 'rgba(143,211,244,0.22)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 2, 46 + Math.sin(this.time * 4) * 2, 42, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(-18, -16, 7, 4, -0.6, 0, TAU);
      ctx.fill();
    }
    if (sim.magnet > 0) {
      ctx.strokeStyle = 'rgba(127,183,230,0.65)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 54 + i * 12 + Math.sin(this.time * 3 + i) * 4, 0, TAU);
        ctx.stroke();
      }
    }
    if (sim.energizer > 0) {
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      for (let i = 0; i < 3; i++) {
        const a = this.time * 6 + i * 2.1;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 40, Math.sin(a) * 32, 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* Аксессуары рисуются в системе координат головы (центр головы — 0,0). */
  drawSkinExtras(ctx, p) {
    const extra = p.extra;
    if (extra === 'scarf') {
      ctx.fillStyle = p.accent;
      rr(ctx, -14, 14, 30, 9, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, 20);
      ctx.lineTo(2, 36 + Math.sin(this.time * 6) * 3);
      ctx.lineTo(-6, 33 + Math.sin(this.time * 6) * 3);
      ctx.lineTo(0, 19);
      ctx.closePath();
      ctx.fill();
    } else if (extra === 'chef') {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-8 + i * 9, -22, 9, 0, TAU);
        ctx.fill();
      }
      rr(ctx, -14, -20, 30, 10, 4);
      ctx.fill();
    } else if (extra === 'space') {
      ctx.fillStyle = 'rgba(220,240,255,0.3)';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(2, 0, 28, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-12, -14, 9, 4, -0.5, 0, TAU);
      ctx.fill();
    } else if (extra === 'pirate') {
      ctx.fillStyle = p.accent;
      rr(ctx, -20, -17, 42, 9, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-18, -10);
      ctx.lineTo(-26, 0);
      ctx.lineTo(-14, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b2b34';
      ctx.beginPath();
      ctx.ellipse(13, -2, 5.6, 6.4, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#2b2b34';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(6, -8);
      ctx.lineTo(22, 4);
      ctx.stroke();
    } else if (extra === 'party') {
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.moveTo(-12, -16);
      ctx.lineTo(2, -44);
      ctx.lineTo(14, -14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      for (let i = 0; i < 4; i++) ctx.fillRect(-7 + i * 5, -26 - i * 3, 3, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 5; i++) {
        const a = this.time * 1.4 + i * 1.3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 26, Math.sin(a) * 20 - 8, 1.8, 0, TAU);
        ctx.fill();
      }
    } else if (extra === 'stars') {
      ctx.fillStyle = p.accent;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 14 - 2, Math.sin(a) * 12 + 2, 2, 0, TAU);
        ctx.fill();
      }
    } else if (extra === 'collar') {
      ctx.fillStyle = p.accent;
      rr(ctx, -14, 13, 30, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(2, 21, 4.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = Math.max(0, 1 - p.t / p.life);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'heart') {
        heartPath(ctx, p.x, p.y, p.size * 2.2);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.t * 4);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * TAU;
          const r = i % 2 ? p.size * 0.6 : p.size * 1.6;
          ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawFloats(ctx) {
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      const a = Math.max(0, 1 - f.t / f.life);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.14)';
      ctx.lineWidth = 3;
      ctx.font = `800 ${f.size}px ${FONT}`;
      const y = f.y - f.t * 44;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  drawHurtVignette(ctx, sim, W) {
    const alpha = Math.min(0.4, sim.inv * 0.28);
    const g = ctx.createRadialGradient(W / 2, WORLD.H / 2, WORLD.H * 0.25, W / 2, WORLD.H / 2, WORLD.H * 0.78);
    g.addColorStop(0, 'rgba(255,90,110,0)');
    g.addColorStop(1, `rgba(255,90,110,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, WORLD.H);
  }

  /* Подсказка на старте: «Тапни, чтобы взлететь». */
  drawTapHint(ctx, W) {
    const a = 0.55 + Math.abs(Math.sin(this.time * 2)) * 0.35;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(51,37,60,0.82)';
    ctx.font = `900 26px ${FONT}`;
    ctx.fillText('Тапни, чтобы взлететь', W / 2, 470);
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = 'rgba(51,37,60,0.6)';
    ctx.fillText('пробел · ↑ · клик', W / 2, 500);
    ctx.restore();
  }

  /* Стрелки ветра и «!» по краям: подсказки, которые видно всегда. */
  drawThreats(ctx, sim, W) {
    if (sim.wind && sim.wind.state === 'blowing') {
      const dir = sim.wind.dir;
      ctx.save();
      ctx.globalAlpha = 0.32 + Math.abs(Math.sin(this.time * 3)) * 0.3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const x = W - 26;
        const y = 170 + i * 58 + ((this.time * (dir > 0 ? 60 : -60)) % 58);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 26 * dir);
        ctx.moveTo(x - 6, y + 12 * dir);
        ctx.lineTo(x, y + 26 * dir);
        ctx.lineTo(x + 6, y + 12 * dir);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const w of sim.warnings) {
      if (w.type !== 'pigeon' && w.type !== 'yarn') continue;
      if (sim.t < w.spawnAt - 1.2) continue;
      const side = W - 34;
      const blink = Math.sin(this.time * 16) > 0 ? 1 : 0.4;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#ff5c7a';
      ctx.beginPath();
      ctx.arc(side, w.y, 18, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `800 22px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', side, w.y + 1);
      ctx.restore();
    }
  }
}

export { G, THEMES, SKINS };
