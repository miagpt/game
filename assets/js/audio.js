/* ═══════════════════════════════════════════════════════════════
   ПОРШИК · КОТ, КОТОРЫЙ ЛЕТАЕТ — звук
   Всё синтезируется через Web Audio: ни одного аудиофайла.
   Звук — украшение: любая ошибка гасится, игра остаётся играбельной.
   ═══════════════════════════════════════════════════════════════ */

const PROG = {
  major: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]],
  minor: [[-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2]],
};

const STYLE = {
  roof: { bpm: 100, root: 0 },
  kitchen: { bpm: 108, root: 2 },
  attic: { bpm: 104, root: 5 },
  yarn: { bpm: 112, root: -3, minor: true },
  street: { bpm: 96, root: 7 },
  rain: { bpm: 88, root: -5, minor: true, wave: 'triangle' },
  bakery: { bpm: 106, root: 4 },
  fireplace: { bpm: 84, root: 9, arp: [0, 2, 1, 2, 0, 2, 1, 2] },
  night: { bpm: 92, root: -1, minor: true },
  home: { bpm: 90, root: 0 },
  menu: { bpm: 96, root: 0 },
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.broken = false;
    this.sound = true;
    this.music = true;
    this.style = 'menu';
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.on = false;
  }

  /** Вызывается из обработчика жеста: браузеры разрешают звук только после него. */
  unlock() {
    if (this.broken) return;
    try {
      this.open();
      if (this.music && !this.on) this.startMusic();
    } catch {
      this.broken = true;
      this.ctx = null;
    }
  }

  open() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no webaudio');
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* не страшно */
    }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -12;
    this.limiter.ratio.value = 5;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.2;
    this.master.connect(this.limiter).connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.5;
    this.sfx.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.16;
    this.musicBus.connect(this.master);
  }

  setSound(on) {
    this.sound = !!on;
    if (this.master) this.master.gain.value = this.sound ? 0.85 : 0;
  }

  setMusic(on) {
    this.music = !!on;
    if (!on) this.stopMusic();
    else if (this.ctx) this.startMusic();
    if (this.musicBus) this.musicBus.gain.value = on ? 0.16 : 0;
  }

  setStyle(style) {
    this.style = STYLE[style] ? style : 'roof';
  }

  /* ---------------- эффекты ---------------- */

  tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.25, at = 0.005, slide = 0, delay = 0 }) {
    if (!this.sound) return;
    try {
      this.open();
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + at);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      osc.connect(g).connect(this.sfx);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      /* без звука играть можно */
    }
  }

  flap() {
    this.tone({ freq: 420, dur: 0.1, type: 'triangle', gain: 0.16, slide: 120 });
    this.tone({ freq: 1200, dur: 0.03, type: 'sine', gain: 0.04, slide: 300 });
  }
  fish() {
    this.tone({ freq: 880, dur: 0.08, type: 'sine', gain: 0.13 });
    this.tone({ freq: 1320, dur: 0.07, type: 'sine', gain: 0.08, delay: 0.04 });
  }
  /* Мяу: мягкий скользящий тон — «голос» Поршика. */
  meow() {
    this.tone({ freq: 520, dur: 0.26, type: 'square', gain: 0.1, slide: -180 });
    this.tone({ freq: 780, dur: 0.2, type: 'sine', gain: 0.07, slide: -220, delay: 0.02 });
  }
  treat() {
    [784, 988, 1175].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'triangle', gain: 0.12, delay: i * 0.06 }));
  }
  power() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.13, delay: i * 0.05 }));
  }
  hurt() {
    this.tone({ freq: 300, dur: 0.24, type: 'sawtooth', gain: 0.15, slide: -90 });
    this.tone({ freq: 900, dur: 0.12, type: 'sine', gain: 0.07, slide: 420, delay: 0.03 });
  }
  shield() {
    this.tone({ freq: 700, dur: 0.2, type: 'sine', gain: 0.14, slide: 300 });
  }
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.14, delay: i * 0.1 }));
  }
  lose() {
    [392, 330, 262].forEach((f, i) => this.tone({ freq: f, dur: 0.26, type: 'triangle', gain: 0.13, delay: i * 0.14 }));
  }
  click() {
    this.tone({ freq: 620, dur: 0.05, type: 'square', gain: 0.06 });
  }
  telegram() {
    this.tone({ freq: 988, dur: 0.1, type: 'sine', gain: 0.1 });
    this.tone({ freq: 1318, dur: 0.12, type: 'sine', gain: 0.08, delay: 0.08 });
  }

  /* ---------------- музыка ---------------- */

  startMusic() {
    if (!this.music || this.on || !this.ctx) return;
    this.on = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    const tick = () => {
      if (!this.on) return;
      try {
        const st = STYLE[this.style] || STYLE.menu;
        const beat = 60 / st.bpm / 2; // восьмые
        while (this.nextTime < this.ctx.currentTime + 0.6) {
          this.scheduleStep(this.step, this.nextTime, st, beat);
          this.step += 1;
          this.nextTime += beat;
        }
      } catch {
        this.stopMusic();
      }
      this.timer = setTimeout(tick, 220);
      // в Node (jsdom-тесты) таймер не должен держать процесс живым
      if (this.timer && typeof this.timer.unref === 'function') this.timer.unref();
    };
    tick();
  }

  stopMusic() {
    this.on = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  scheduleStep(step, at, st, beat) {
    if (!this.sound && !this.music) return;
    const chord = (PROG[st.minor ? 'minor' : 'major'][Math.floor(step / 8) % 4] || PROG.major[0]).map((n) => n + 48 + st.root);
    const arp = st.arp || [0, 1, 2, 1, 0, 2, 1, 2];
    const notes = arp.map((i) => chord[i % chord.length] + (i >= chord.length ? 12 : 0));
    const n = notes[step % notes.length];
    this.note(midi(n + 12), at, beat * 1.6, st.wave || 'triangle', 0.09);
    if (step % 4 === 0) this.note(midi(chord[0] - 24), at, beat * 3.6, 'sine', 0.13);
    if (step % 8 === 4) this.note(midi(chord[2] - 12), at, beat * 2, 'sine', 0.05);
  }

  note(freq, at, dur, type, gain) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}

export const SOUND_STYLES = Object.keys(STYLE);
