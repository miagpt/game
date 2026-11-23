/* Главная страница: рисует карточки миров из общего content.js,
   чтобы список миров никогда не расходился с игрой. */

import { LEVELS } from './content.js';
import { themeOf } from './themes.js';
import { difficultyOf } from './rules.js';

const grid = document.getElementById('worldGrid');

if (grid) {
  grid.innerHTML = LEVELS.map(
    (l) => `<li class="world-card" style="--tint:${themeOf(l.world).accent};--sky-a:${themeOf(l.world).sky[0]};--sky-b:${themeOf(l.world).sky[1]}">
      <div class="world-top">
        <span class="world-ico" aria-hidden="true">${l.icon}</span>
        <span class="world-num">${String(l.id).padStart(2, '0')}</span>
      </div>
      <h3>${l.name}</h3>
      <p class="world-tag">${l.tagline}</p>
      <p class="world-desc">${l.story.replace(/\{name\}/g, 'Хозяйка').replace(/\{sweet\}/g, 'Хозяюшка')}</p>
      <div class="world-foot">
        <span>${l.gates} ворот</span>
        <span class="dots" aria-label="Сложность ${difficultyOf(l)} из 5">${'●'.repeat(difficultyOf(l))}${'○'.repeat(5 - difficultyOf(l))}</span>
      </div>
    </li>`,
  ).join('');
}

/* Сервис-воркер: после первого визита игра работает без сети.
   Регистрируем только по https или на localhost (иначе браузер ругается). */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
