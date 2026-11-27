import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import esbuild from 'esbuild';

const errors = [];
const built = await esbuild.build({ absWorkingDir: process.cwd(), entryPoints: ['happy-home/app.js'], bundle: true, format: 'iife', write: false, target: 'chrome110' });
const html = await readFile('index.html', 'utf8');
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });
vc.on('error', (...args) => errors.push(args.join(' ')));
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const canvasCalls = [];
function context() {
  const base = { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) };
  return new Proxy(base, { get(target, key) { if (key in target) return target[key]; return (...args) => { canvasCalls.push(key); for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`non-finite canvas arg ${String(key)}`); }; }, set(target, key, value) { target[key] = value; return true; } });
}
window.HTMLCanvasElement.prototype.getContext = context;
window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ width: 390, height: 580, top: 0, left: 0, right: 390, bottom: 580 });
let frames = [];
window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
window.cancelAnimationFrame = () => { frames = []; };
window.devicePixelRatio = 2;
class FakeParam { constructor() { this.value = 0; } setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; } exponentialRampToValueAtTime(v) { this.value = v; } }
class FakeAudioNode { constructor() { this.frequency = new FakeParam(); this.gain = new FakeParam(); this.type = 'sine'; } connect(node) { return node; } start() {} stop() {} }
window.AudioContext = class { constructor() { this.currentTime = 0; this.state = 'running'; this.destination = new FakeAudioNode(); } createOscillator() { return new FakeAudioNode(); } createGain() { return new FakeAudioNode(); } resume() { return Promise.resolve(); } };
window.webkitAudioContext = window.AudioContext;
window.eval(built.outputFiles[0].text);
const doc = window.document;
function check(condition, message) { if (!condition) throw new Error(message); }
check(doc.querySelectorAll('.chapter-card').length === 5, 'chapter map should render five chapters');
check(doc.querySelectorAll('.hero-token img').length === 5, 'hero art should include all five portraits');
check(doc.querySelector('.hero-token img')?.getAttribute('src').includes('/happy-home/portraits/'), 'root route should resolve portraits from the Happy Home asset folder');
check(doc.getElementById('gameScreen').hidden, 'game starts from the home screen');

doc.getElementById('continueBtn').click();
check(!doc.getElementById('gameScreen').hidden, 'start should open game screen');
check(doc.getElementById('gameRoundTitle').textContent === 'Солнечный коридор', 'new save should open round one');
check(doc.getElementById('gameCaption').textContent.includes('Научиться держать высоту'), 'round briefing should explain its unique challenge');
check(doc.getElementById('gameCaption').getAttribute('aria-live') === 'polite', 'round briefing should be announced accessibly');
check(canvasCalls.length > 0, 'canvas should render the game screen');
const down = new window.Event('pointerdown', { bubbles: true, cancelable: true });
doc.getElementById('gameCanvas').dispatchEvent(down);
check(frames.length > 0, 'touch should start the animation loop');
let now = 0;
for (let i = 0; i < 100; i++) { if (i % 10 === 0) doc.getElementById('gameCanvas').dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true })); const current = frames.splice(0); now += 40; for (const cb of current) cb(now); }
check(parseFloat(doc.getElementById('roundProgress').style.width) > 0, 'game loop should advance progress');
doc.getElementById('pauseBtn').click();
check(!doc.getElementById('pauseOverlay').hidden, 'pause overlay should open');
const checkpoint = JSON.parse(window.localStorage.getItem('happyhome.save.v1')).checkpoint;
check(Number.isFinite(checkpoint.y) && Number.isFinite(checkpoint.vy), 'checkpoint should persist player position and velocity');
check(Number.isInteger(checkpoint.lives) && Number.isFinite(checkpoint.collected), 'checkpoint should persist run progress');
doc.getElementById('resumeBtn').click();
check(doc.getElementById('pauseOverlay').hidden, 'resume should close pause overlay');
Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true });
doc.dispatchEvent(new window.Event('visibilitychange'));
check(!doc.getElementById('pauseOverlay').hidden, 'hiding the tab should pause and persist the run');
Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false });
doc.dispatchEvent(new window.Event('visibilitychange'));
check(!doc.getElementById('pauseOverlay').hidden, 'returning to the tab must not auto-resume gameplay');
doc.getElementById('resumeBtn').click();
doc.getElementById('sfxBtn').click();
check(doc.getElementById('gameSfxBtn').getAttribute('aria-pressed') === 'true', 'sound toggle state should sync in-game');
doc.getElementById('musicBtn').click();
check(doc.getElementById('gameMusicBtn').getAttribute('aria-pressed') === 'true', 'music toggle state should sync in-game');
check(doc.getElementById('gameMusicBtn').getAttribute('aria-label') === 'Выключить музыку', 'in-game music toggle should expose its current action to assistive technology');
doc.getElementById('musicBtn').click();
const beforeMap = JSON.parse(window.localStorage.getItem('happyhome.save.v1')).checkpoint.elapsed;
doc.getElementById('backMapBtn').click();
const afterMap = JSON.parse(window.localStorage.getItem('happyhome.save.v1')).checkpoint;
check(afterMap.id === 1 && afterMap.elapsed >= beforeMap, 'returning to the map should save the current checkpoint');
doc.getElementById('continueBtn').click();
check(JSON.parse(window.localStorage.getItem('happyhome.save.v1')).checkpoint.elapsed >= beforeMap, 'continuing after returning to the map should restore progress');
let extraFrames = 0;
for (let i = 0; i < 3100 && doc.getElementById('resultOverlay').hidden; i++) { if (i % 10 === 0) doc.getElementById('gameCanvas').dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true })); const current = frames.splice(0); now += 40; for (const cb of current) { cb(now); extraFrames++; } }
check(!doc.getElementById('resultOverlay').hidden, 'round one should reach its result screen');
check(JSON.parse(window.localStorage.getItem('happyhome.save.v1')).completed.includes(1), 'completed round should persist locally');
check(errors.length === 0, `browser errors: ${errors.join('; ')}`);
console.log('Happy Home E2E passed: five chapters/portraits, start, touch, animation, pause/resume, audio state, round completion and local save.');
dom.window.close();
