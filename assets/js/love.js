/* Страница «Записки»: читает то же сохранение, что и игра,
   и показывает записки открытыми или закрытыми. */

import { LEVELS, NOTES, FINAL_LETTER, HERO, SPECIAL_GIFT } from './content.js';
import { SAVE_KEY, ROUNDS, normalizeSave, blankSave, noteText, letterLines, isUnlocked, fill } from './rules.js';

function load() {
  try {
    return normalizeSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'));
  } catch {
    return blankSave();
  }
}

const save = load();
const wrap = document.getElementById('noteWrap');

const stars = save.stars.reduce((a, b) => a + b, 0);
const done = save.stars.filter((x) => x > 0).length;

document.getElementById('progressStrip').innerHTML = [
  `<span>Миров пройдено: <b>${done} / ${ROUNDS}</b></span>`,
  `<span>Звёзд: <b>${stars} / ${ROUNDS * 3}</b></span>`,
  `<span>Рыбок в кошельке: <b>${save.fish}</b></span>`,
  `<span>Рекорд бесконечного: <b>${save.best}</b></span>`,
].join('');

wrap.innerHTML = NOTES.map((raw) => {
  const level = LEVELS.find((l) => l.id === raw.level) || LEVELS[0];
  const open = save.stars[level.id - 1] > 0 || save.seenNotes.includes(level.id);
  const note = noteText(raw);
  if (!open) {
    return `<article class="note-item is-locked" data-note="${level.id}">
      <header>
        <h2>Записка № ${level.id}</h2>
        <span class="note-from">${level.name}</span>
      </header>
      <div class="lock-row"><span aria-hidden="true">🔒</span>
        <span>Откроется после мира «${level.name}».${
          isUnlocked(save, level.id) ? ` <a href="play.html">Пройти сейчас →</a>` : ''
        }</span>
      </div>
    </article>`;
  }
  return `<article class="note-item" data-note="${level.id}">
    <header>
      <h2>${note.title}</h2>
      <span class="note-from">${level.name} · ${note.from}</span>
    </header>
    <p>${escapeHtml(note.text)}</p>
  </article>`;
}).join('');

if (!NOTES.length) wrap.innerHTML = '<p class="note-item">Записок пока нет.</p>';

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/* Письмо показываем всегда: текст — часть подарка, а не достижение.
   Но если игра ещё не пройдена, честно предупреждаем. */
const letter = letterLines(FINAL_LETTER);
document.getElementById('letterTitle').textContent = letter.title;
document.getElementById('letterGreeting').textContent = letter.greeting;
document.getElementById('letterBody').innerHTML = letter.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
document.getElementById('letterSignoff').textContent = `${letter.signoff} — ${letter.signature}`;

/* Подарок версии 2.0 */
const gift = document.getElementById('giftCard');
if (gift) {
  document.getElementById('giftBadge').textContent = SPECIAL_GIFT.badge;
  document.getElementById('giftTitle').textContent = SPECIAL_GIFT.title;
  document.getElementById('giftSub').textContent = SPECIAL_GIFT.subtitle;
  document.getElementById('giftLines').innerHTML = SPECIAL_GIFT.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
  document.getElementById('giftSign').textContent = `${SPECIAL_GIFT.from} — ${fill(SPECIAL_GIFT.signature)}`;
}

const finalDone = save.stars[ROUNDS - 1] > 0;
const block = document.getElementById('letterBlock');
if (!finalDone) {
  const hint = document.createElement('p');
  hint.className = 'lock-row';
  hint.style.cssText = 'font-family:var(--font);font-size:.86rem;color:var(--ink-mute);font-weight:700;margin-bottom:10px';
  hint.innerHTML = `Письмо станет особенным, когда ты долетишь до десятого мира своей рукой. <a href="play.html">Полетели →</a>`;
  block.insertBefore(hint, block.querySelector('#letterGreeting'));
}
if (save.stars.some((s) => s > 0)) {
  block.classList.add('is-open');
}

/* «Поршик на связи»: небольшая подпись под дневником */
const foot = document.createElement('p');
foot.className = 'note-item';
foot.style.cssText = 'border-left-color:var(--berry);font-family:var(--font);font-size:.9rem;color:var(--ink-soft)';
foot.textContent = `${HERO.name} ${HERO.kind} передаёт: «${HERO.motto}»`;
wrap.appendChild(foot);

void HERO;
