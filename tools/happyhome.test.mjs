import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { levels, getRound, durationLabel } from '../happy-home/content.js';
import { PATTERN_RULES, getPatternRule, laneFraction, getBossTargetFraction, getBossPhaseCue, getCollectibleTargetFraction } from '../happy-home/mechanics.js';
import { freshSave, normalizeSave } from '../happy-home/save.js';

test('Happy Home has 5 age-ordered chapters and exactly 50 distinct rounds', () => {
  assert.equal(levels.length, 5);
  assert.deepEqual(levels.map((x) => x.age), [5, 6, 8, 10, 16]);
  assert.equal(levels.flatMap((x) => x.rounds).length, 50);
  const allRounds = levels.flatMap((x) => x.rounds);
  assert.equal(new Set(allRounds.map((x) => x.title)).size, 50);
  assert.equal(new Set(allRounds.map((x) => x.pattern)).size, 50);
  assert.ok(allRounds.every((x) => x.pattern && x.mechanic && x.brief));
});

test('all 50 named patterns map to executable gameplay rules', () => {
  const rounds = levels.flatMap((level) => level.rounds);
  assert.equal(Object.keys(PATTERN_RULES).length, 50);
  for (const round of rounds) {
    const rule = getPatternRule(round.pattern);
    assert.ok(rule, `missing gameplay rule for ${round.id}: ${round.pattern}`);
    assert.ok(rule.cue && (rule.lane || rule.hazards?.length || rule.wind || rule.fog), `pattern ${round.pattern} has no player-facing effect`);
  }
  assert.equal(laneFraction('mirror', 0, 0), .78);
  assert.equal(laneFraction('mirror', 1, 0), .22);
  assert.equal(laneFraction('sequence', 2, 0), .78);
  assert.notEqual(laneFraction('orbit-switch', 1, 0), laneFraction('orbit-switch', 6, 0));
  assert.equal(laneFraction('room-shift', 0, 0, 0), .28);
  assert.equal(laneFraction('room-shift', 0, 0, 30), .72);
  assert.ok(PATTERN_RULES['ring-switches'].ring);
  assert.ok(PATTERN_RULES['rolling-ball'].hazards.includes('rolling-ball'));
  assert.deepEqual([0, 1, 2, 3].map((collected) => getCollectibleTargetFraction('star-order', collected)), [.22, .5, .78, .22]);
  assert.ok(getCollectibleTargetFraction('family-collection', 0, 0) < .4);
  assert.ok(getCollectibleTargetFraction('family-collection', 1, 1) > .75);
  assert.deepEqual([0,1,2].map((phase) => getBossTargetFraction('orbital', phase)), [.2,.5,.8]);
  for (const boss of ['yarn','wind','balloon','orbital','replay','home']) {
    assert.equal(new Set([0,1,2].map((phase) => getBossPhaseCue(boss, phase))).size, 3, `${boss} needs three distinct phase cues`);
  }
});

test('portrait mapping follows the confirmed Archie/Grace photo correction', () => {
  assert.equal(levels[1].portrait, 'portraits/grace.webp');
  assert.equal(levels[1].kind, 'чёрно-рыжий пёс с острыми ушами');
  assert.equal(levels[2].portrait, 'portraits/archie.webp');
  assert.equal(levels[2].kind, 'серый пёс с белой грудью');
});

test('each chapter closes with its own boss round', () => {
  for (const level of levels) {
    assert.equal(level.rounds.length, 10);
    assert.ok(level.rounds.slice(0, 9).every((round) => !round.boss));
    assert.ok(level.rounds[9].boss);
    assert.equal(level.rounds[9].id, level.id * 10);
  }
});

test('duration targets grow with rounds and chapters at about ten percent', () => {
  for (const level of levels) {
    for (let i = 1; i < 10; i++) {
      const ratio = level.rounds[i].duration / level.rounds[i - 1].duration;
      assert.ok(ratio > 1.09 && ratio < 1.11, `unexpected duration ratio ${ratio}`);
    }
  }
  for (let i = 0; i < 10; i++) assert.ok(levels[1].rounds[i].duration > levels[0].rounds[i].duration);
  assert.equal(levels[0].rounds[0].duration, 120);
  assert.equal(levels[0].rounds[9].duration, 283);
  assert.equal(durationLabel(120), '2:00');
});

test('Happy Home save normalization handles corrupt, legacy and out-of-range checkpoint data', () => {
  assert.deepEqual(normalizeSave('{broken'), freshSave());
  assert.deepEqual(normalizeSave('null'), freshSave());
  const normalized = normalizeSave(JSON.stringify({
    completed: [1, 1, 0, 51, '2', 50],
    checkpoint: { id: 7, elapsed: 99999, y: 8, vy: -9, lives: 99, bossHits: 8, collected: -1 },
    settings: { music: 1, sfx: 0 },
  }));
  assert.deepEqual(normalized.completed, [1, 50]);
  assert.equal(normalized.checkpoint.elapsed, 3600);
  assert.equal(normalized.checkpoint.y, .96);
  assert.equal(normalized.checkpoint.vy, -.8);
  assert.equal(normalized.checkpoint.lives, 3);
  assert.equal(normalized.checkpoint.bossHits, 3);
  assert.equal(normalized.checkpoint.collected, 0);
  assert.equal(normalized.checkpoint.lastPaw, -1);
  assert.equal(normalized.settings.music, true);
  assert.equal(normalized.settings.sfx, false);
  assert.ok(normalized.checkpoint.checkpointAt >= 0);
  const oldSave = normalizeSave({ completed: [2], checkpoint: { id: 2, elapsed: 30 } });
  assert.equal(oldSave.checkpoint.y, .48);
  assert.equal(oldSave.checkpoint.lives, 3);
  assert.equal(normalizeSave({ checkpoint: { id: 51 } }).checkpoint, null);
});

test('round lookup is one-indexed and bounded', () => {
  assert.equal(getRound(1).title, levels[0].rounds[0].title);
  assert.equal(getRound(50).boss, levels[4].rounds[9].boss);
  assert.equal(getRound(0), undefined);
  assert.equal(getRound(51), undefined);
});

test('the game page only references local files and all character portraits exist', async () => {
  const html = await readFile(new URL('../happy-home/index.html', import.meta.url), 'utf8');
  const rootHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../happy-home/style.css', import.meta.url), 'utf8');
  const app = await readFile(new URL('../happy-home/app.js', import.meta.url), 'utf8');
  const content = await readFile(new URL('../happy-home/content.js', import.meta.url), 'utf8');
  assert.doesNotMatch(`${html}\n${css}\n${app}\n${content}`, /https?:\/\//i);
  assert.doesNotMatch(`${html}\n${css}\n${app}\n${content}`, /reference\//i);
  for (const [page, label] of [[html, 'nested'], [rootHtml, 'root']]) {
    assert.match(page, /<canvas[^>]*tabindex="0"[^>]*aria-describedby="gameCaption"/, `${label} canvas should be keyboard focusable and described`);
    assert.match(page, /role="img" aria-label="Иллюстрация семейной команды"/);
    assert.doesNotMatch(page, /apple-touch-icon[^>]*\.svg/);
  }
  assert.match(css, /safe-area-inset-/);
  assert.match(css, /prefers-reduced-motion/);
  for (const id of [...app.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1])) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`), `missing HTML id #${id}`);
  }
  for (const hero of levels) await access(new URL(`../happy-home/${hero.portrait}`, import.meta.url));
});
