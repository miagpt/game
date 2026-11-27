import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import esbuild from 'esbuild';
import { getRound } from '../happy-home/content.js';

const bundle = await esbuild.build({
  absWorkingDir: process.cwd(),
  entryPoints: ['happy-home/app.js'],
  bundle: true,
  format: 'iife',
  write: false,
  target: 'chrome110',
});
const html = await readFile('index.html', 'utf8');

for (const id of Array.from({ length: 50 }, (_, index) => index + 1)) {
  const stage = getRound(id);
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (!/Not implemented/.test(error.message)) errors.push(error.message);
  });
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));

  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const calls = [];
  window.HTMLCanvasElement.prototype.getContext = () => new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push(key);
        if (args.some((arg) => typeof arg === 'number' && !Number.isFinite(arg))) {
          throw new Error(`non-finite canvas argument at boss round ${id}`);
        }
      };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
    width: 320, height: 390, top: 0, left: 0, right: 320, bottom: 390,
  });
  window.devicePixelRatio = 3;
  let frames = [];
  window.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
  window.cancelAnimationFrame = () => { frames = []; };

  class FakeParam {
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
  }
  let audioContextCreations = 0;
  class FakeAudioNode {
    constructor() { this.frequency = new FakeParam(); this.gain = new FakeParam(); this.type = 'sine'; }
    connect(node) { return node; }
    start() {}
    stop() {}
  }
  window.AudioContext = class {
    constructor() { audioContextCreations++; this.currentTime = 0; this.state = 'running'; this.destination = new FakeAudioNode(); }
    createOscillator() { return new FakeAudioNode(); }
    createGain() { return new FakeAudioNode(); }
    resume() { return Promise.resolve(); }
  };
  window.webkitAudioContext = window.AudioContext;
  window.localStorage.setItem('happyhome.save.v1', JSON.stringify({
    completed: Array.from({ length: id - 1 }, (_, index) => index + 1),
    checkpoint: {
      id, elapsed: Math.floor(stage.targetSeconds * .8), y: .66, vy: .1, lives: 2,
      invulnerable: .4, bossHits: stage.boss ? 1 : 0, bossExtensions: stage.boss ? 1 : 0, lastPaw: stage.boss ? 1002 : -1,
      collected: 4, runTarget: stage.targetSeconds + (stage.boss ? 12 : 0),
      checkpointAt: Math.floor(Math.floor(stage.targetSeconds * .8) / 30) * 30,
    },
    settings: { music: true, sfx: false },
  }));
  window.eval(bundle.outputFiles[0].text);
  if (audioContextCreations !== 0) throw new Error(`boss ${id} initialized audio before a user gesture`);

  const doc = window.document;
  doc.getElementById('continueBtn').click();
  if (audioContextCreations !== 0) throw new Error(`boss ${id} autoplayed persisted music on load`);
  const resumed = JSON.parse(window.localStorage.getItem('happyhome.save.v1')).checkpoint;
  const expectedBossHits = stage.boss ? 1 : 0;
  const expectedRunTarget = stage.targetSeconds + (stage.boss ? 12 : 0);
  if (!Number.isFinite(resumed.y) || Math.abs(resumed.y - .66) > 1e-9 || resumed.bossHits !== expectedBossHits || resumed.lives !== 2 || resumed.collected !== 4 || resumed.runTarget !== expectedRunTarget) {
    throw new Error(`boss ${id} resume lost part of checkpoint state: ${JSON.stringify(resumed)}`);
  }
  if (doc.getElementById('gameRoundTitle').textContent !== stage.title) {
    throw new Error(`boss ${id} did not resume: ${doc.getElementById('gameRoundTitle').textContent}`);
  }
  if (!doc.getElementById('gameCaption').textContent.includes(stage.brief)) {
    throw new Error(`boss ${id} briefing is missing`);
  }
  if (!calls.length) throw new Error(`boss ${id} did not render at 320px viewport`);

  doc.getElementById('gameCanvas').dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  if (audioContextCreations === 0) throw new Error(`boss ${id} did not unlock saved music on the first explicit gesture`);
  let timestamp = 0;
  for (let i = 0; i < 15; i++) {
    const pending = frames.splice(0);
    timestamp += 32;
    for (const callback of pending) callback(timestamp);
  }
  if (errors.length) throw new Error(`boss ${id} browser errors: ${errors.join('; ')}`);
  dom.window.close();
}

console.log('Happy Home mobile E2E passed: all 50 round patterns and five boss scenes resume, render and unlock audio on gesture in a mocked 320×390 CSS-pixel viewport.');
