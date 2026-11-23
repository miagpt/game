/* Поршик 2.0 · страница обложек: галерея, тексты для Telegram, копирование. */

const URL = 'https://miagpt.github.io/game/';

/* Варианты обложек: файл, название и настроение — совпадают с tools/covers.mjs. */
const COVERS = [
  { file: '01-sunset', title: 'Закат над крышами', mood: 'тёплый вечер и большой прыжок' },
  { file: '02-night', title: 'Ночной город', mood: 'луна и стая светящихся рыбок' },
  { file: '03-fishrain', title: 'Рыбный дождь', mood: 'небо перевёрнуто, рыбки летят' },
  { file: '04-cosmo', title: 'Космокот', mood: 'шлем, планета и золотые рыбки' },
  { file: '05-stainedglass', title: 'Витраж', mood: 'соборный свет и крылья' },
  { file: '06-bakery', title: 'Пекарня', mood: 'мука, круассаны и утро' },
  { file: '07-fireplace', title: 'Камин', mood: 'искры, жар и тёплый силуэт' },
  { file: '08-papercut', title: 'Бумажный полёт', mood: 'слои, тени и мягкий свет' },
  { file: '09-neon', title: 'Неон', mood: 'аркада, хром и синтвейв' },
  { file: '10-home', title: 'Дом, где ждут', mood: 'окно, свет и письмо' },
];

/* Тексты для Telegram. {url} подставляется ссылкой на игру. */
const MESSAGES = [
  {
    who: 'Егору',
    tone: 'тёплый',
    text:
      'Егор, привет! Я тут сделал игру — «Поршик 2.0». Дымчатый кот, десять миров, рыбки и записки.\n' +
      'Всё в браузере, ставится некуда, рекламы нет. Твоя обложка — с подарком внутри 🎁\n' +
      '{url}',
  },
  {
    who: 'Лизе',
    tone: 'нежный',
    text:
      'Лиза, привет! Это тебе маленькое небо: кот Поршик летает между воротами и собирает рыбок.\n' +
      'Десять миров, три жизни, письмо в конце. Играется в один тап, даже с телефона 💛\n' +
      '{url}',
  },
  {
    who: 'Егору и Лизе',
    tone: 'общий',
    text:
      'Ребята, сюрприз! «Поршик 2.0» — игра про кота, который летает. Десять миров, девять записок и одно письмо.\n' +
      'Special gift for Egor and Liza — то есть для вас двоих 🎁\n' +
      '{url}',
  },
  {
    who: 'Егору',
    tone: 'короткий',
    text: 'Егор, держи: кот Поршик летает за рыбками. 5 минут — и ты втянулся 🐈‍⬛\n{url}',
  },
  {
    who: 'Лизе',
    tone: 'короткий',
    text: 'Лиза, тут котик летает. Он очень старался 🐟\n{url}',
  },
  {
    who: 'Егору и Лизе',
    tone: 'игровой',
    text:
      'Задание для двоих: пройти все десять миров «Поршика» и собрать три звезды.\n' +
      'Рекорд бесконечного режима — отдельно. Кто дальше? 🐈‍⬛\n' +
      '{url}',
  },
  {
    who: 'Егору',
    tone: 'смешной',
    text:
      'Егор, я завёл кота. Кот не дома — кот летает. Теперь это игра, и она у тебя в телефоне.\n' +
      '{url}',
  },
  {
    who: 'Лизе',
    tone: 'тёплый',
    text:
      'Лиза, у Поршика в игре есть записки — по одной после каждого мира. Последняя — письмо. Оно тебе 💛\n' +
      '{url}',
  },
  {
    who: 'Егору и Лизе',
    tone: 'очень короткий',
    text: 'Поршик 2.0. Кот. Небо. Рыбки. {url}',
  },
  {
    who: 'Егору и Лизе',
    tone: 'подарочный',
    text:
      'Это не открытка, это игра. «Поршик 2.0» — специальный подарок для Егора и Лизы.\n' +
      'Открывается в браузере, работает без сети, рекламы нет. Просто нажмите и полетите 🎁\n' +
      '{url}',
  },
];

const grid = document.getElementById('coverGrid');
const msgGrid = document.getElementById('msgGrid');

const card = (cover, index) => {
  const li = document.createElement('li');
  li.className = 'cover-card';
  li.style.setProperty('--i', String(index));
  li.innerHTML = `
    <a class="cover-shot" href="assets/covers/full/${cover.file}.jpg" target="_blank" rel="noopener">
      <img src="assets/covers/${cover.file}.jpg" width="900" height="1125" loading="lazy" decoding="async"
        alt="Обложка «${cover.title}»: кот Поршик, версия 2.0, подарок для Егора и Лизы">
      <span class="cover-num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <span class="cover-open">открыть в полном размере ↗</span>
    </a>
    <div class="cover-meta">
      <b>${cover.title}</b>
      <span>${cover.mood}</span>
    </div>`;
  return li;
};

if (grid) {
  const frag = document.createDocumentFragment();
  COVERS.forEach((cover, i) => frag.append(card(cover, i)));
  grid.append(frag);
}

/* ---------------- тексты и копирование ---------------- */

async function copyText(text, button) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Скопировано ✓';
  } catch {
    // Фолбэк для http и старых браузеров: выделяем текст в поле.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    button.textContent = ok ? 'Скопировано ✓' : 'Скопируй вручную';
  }
  setTimeout(() => {
    button.textContent = label;
  }, 1800);
}

if (msgGrid) {
  MESSAGES.forEach((msg) => {
    const text = msg.text.replace('{url}', URL);
    const block = document.createElement('article');
    block.className = 'msg-card';
    block.innerHTML = `
      <header class="msg-head">
        <b>${msg.who}</b>
        <span class="msg-tone">${msg.tone}</span>
      </header>
      <p class="msg-text"></p>
      <div class="msg-actions">
        <button class="btn btn--small" type="button">Скопировать</button>
        <a class="quiet-link" href="${URL}" target="_blank" rel="noopener">открыть игру ↗</a>
      </div>`;
    block.querySelector('.msg-text').textContent = text;
    const button = block.querySelector('button');
    button.addEventListener('click', () => copyText(text, button));
    msgGrid.append(block);
  });
}
