/* Данные паттернов Happy Home. Каждый ключ задаёт реальный эффект симуляции/рендера. */
export const PATTERN_RULES = Object.freeze({
  'first-flap': { lane: 'center', gap: 1.14, gravity: 1, flap: 1, cue: 'Широкие ворота для обучения' },
  'high-window': { lane: 'high', gap: 1.08, cue: 'Верхний маршрут' },
  'zigzag-boxes': { lane: 'zigzag', cue: 'Чередуй верх и низ' },
  'thread-arc': { lane: 'random', moving: true, hazards: ['swing'], cue: 'Дуга движется по циклу' },
  'shelf-stairs': { lane: 'stairs', cue: 'Высота меняется ступенями' },
  'soft-fog': { lane: 'random', fog: true, cue: 'Мягкая дымка; контуры опасностей остаются яркими' },
  'split-routes': { lane: 'branch', gap: 1.05, cue: 'Маршрут меняется между полосами' },
  'clock-pendulum': { lane: 'random', moving: true, hazards: ['swing'], cue: 'Маятник движется с предсказуемым периодом' },
  'sun-combo': { lane: 'zigzag', moving: true, hazards: ['swing', 'beam'], cue: 'Зигзаг плюс маятник и луч' },
  'boss-yarn': { lane: 'weave', gap: 1.02, moving: true, hazards: ['yarn'], boss: 'yarn', cue: 'Пройди открытые петли клубка' },

  'rain-drops': { lane: 'random', hazards: ['drop'], cue: 'Капли отмечены до пролёта' },
  'mirror-route': { lane: 'mirror', gap: 1.04, hazards: ['beam'], cue: 'Зеркальные полосы чередуются' },
  'shifting-gates': { lane: 'random', moving: true, cue: 'Окно ворот мягко смещается' },
  'crosswind': { lane: 'random', wind: 0.18, cue: 'Флажки показывают боковой ветер' },
  'swinging-playground': { lane: 'random', moving: true, hazards: ['swing'], cue: 'Качели следуют ритму' },
  'pigeon-flock': { lane: 'zigzag', hazards: ['flock'], cue: 'Стая держится своего коридора' },
  'rotating-sprayer': { lane: 'random', moving: true, hazards: ['spray'], cue: 'Веер медленно поворачивается' },
  'drifting-leaves': { lane: 'random', hazards: ['leaf'], cue: 'Листья дрейфуют по видимой траектории' },
  'dusk-combo': { lane: 'branch', moving: true, wind: 0.12, hazards: ['swing', 'spray', 'leaf'], cue: 'Ветер, качели и водяной веер' },
  'boss-wind': { lane: 'shelter', gap: 1.04, wind: 0.24, hazards: ['wind'], boss: 'wind', cue: 'Следи за флажком и используй тихое окно' },

  'long-arches': { lane: 'random', gap: 1.16, cue: 'Широкие арки и длинный интервал' },
  'orbit-lights': { lane: 'orbit', moving: true, hazards: ['orbit'], cue: 'Движущиеся огни обходят просвет' },
  'stream-current': { lane: 'stairs', wind: 0.13, cue: 'Поток мягко меняет высоту' },
  'shadow-reading': { lane: 'random', hazards: ['shadow'], cue: 'Силуэт появляется раньше препятствия' },
  'spring-clouds': { lane: 'stairs', gap: 1.1, hazards: ['spring'], cue: 'Пружинные зоны обозначены заранее' },
  'hedge-branch': { lane: 'branch', gap: 1.05, cue: 'Оба пути остаются проходимыми' },
  'rising-balloons': { lane: 'zigzag', hazards: ['balloon'], cue: 'Шарики поднимаются по своим дорожкам' },
  'twilight-combo': { lane: 'mirror', moving: true, wind: 0.1, hazards: ['shadow', 'orbit', 'leaf'], cue: 'Тени, поток и огни объединены' },
  'rolling-ball': { lane: 'random', moving: true, hazards: ['rolling-ball'], cue: 'Большой шар движется по заметному циклу' },
  'boss-balloon': { lane: 'weave', gap: 1.02, moving: true, hazards: ['balloon'], boss: 'balloon', cue: 'Следуй за безопасным просветом шара' },

  'map-planning': { lane: 'stairs', cue: 'Планируй две высоты вперёд' },
  'planet-orbits': { lane: 'orbit', moving: true, hazards: ['orbit'], cue: 'Окна следуют за орбитальным ритмом' },
  'scan-beam': { lane: 'random', moving: true, hazards: ['beam'], cue: 'Луч сканирует с предупреждением' },
  'star-order': { lane: 'sequence', hazards: ['items'], cue: 'Цели идут по трём высотам' },
  'moon-gravity': { lane: 'random', gap: 1.08, gravity: 0.78, flap: 0.86, cue: 'Пониженная гравитация меняет дугу взмаха' },
  'paired-satellites': { lane: 'zigzag', moving: true, hazards: ['orbit'], cue: 'Спутники открывают проход по очереди' },
  'comet-trail': { lane: 'random', hazards: ['comet'], cue: 'След показывает траекторию кометы' },
  'ring-switches': { lane: 'orbit-switch', moving: true, hazards: ['ring'], cue: 'Кольца меняют направление на каждом пятом пролёте', ring: true },
  'guardian-rehearsal': { lane: 'orbit', moving: true, hazards: ['orbit', 'beam'], cue: 'Повтори порядок трёх маяков' },
  'boss-orbital': { lane: 'sequence', moving: true, hazards: ['orbit'], boss: 'orbital', cue: 'Активируй маяки в заданном порядке' },

  'attic-routes': { lane: 'stairs', gap: 1.05, cue: 'Выбери один из двух коридоров' },
  'memory-colors': { lane: 'sequence', hazards: ['rhythm'], cue: 'Цветные окна идут в повторяемом порядке' },
  'garland-rhythm': { lane: 'sequence', hazards: ['rhythm'], cue: 'Световой ритм дублирует звук' },
  'marked-boxes': { lane: 'branch', hazards: ['boxes'], cue: 'Значок заранее обозначает путь' },
  'kitchen-sequence': { lane: 'sequence', hazards: ['rhythm', 'items'], cue: 'Пройди ворота в визуально заданном порядке' },
  'balcony-gust': { lane: 'random', wind: 0.18, hazards: ['leaf'], cue: 'Порыв обозначается до смены высоты' },
  'family-collection': { lane: 'sequence', hazards: ['items', 'items', 'items', 'yarn', 'items'], cue: 'Собирай предметы в любом порядке и уворачивайся от ленты' },
  'room-shift': { lane: 'room-shift', hazards: ['boxes'], cue: 'Схема меняется только у чекпоинта' },
  'boss-replay': { lane: 'sequence', moving: true, hazards: ['yarn', 'wind', 'balloon', 'orbit'], boss: 'replay', cue: 'Короткие безопасные версии знакомых босс-паттернов' },
  'boss-home': { lane: 'sequence', moving: true, hazards: ['boxes', 'yarn', 'items'], boss: 'home', cue: 'Три коротких пазла с контрольной точкой между ними' },
});

const BOSS_LANES = Object.freeze({
  yarn: [0.24, 0.76, 0.48],
  wind: [0.5, 0.28, 0.72],
  balloon: [0.28, 0.72, 0.38],
  orbital: [0.2, 0.5, 0.8],
  replay: [0.24, 0.76, 0.5],
  home: [0.72, 0.28, 0.5],
});

const BOSS_PHASES = Object.freeze({
  yarn: ['Пройди нижнюю петлю', 'Теперь верхняя петля', 'Найди свободный центр'],
  wind: ['Смотри на флажок', 'Лети в тихое окно', 'Порыв стихает — вперёд'],
  balloon: ['Ищи просвет слева', 'Следуй за шаром вправо', 'Направь звёздный жетон в цель'],
  orbital: ['Активируй первый маяк', 'Перейди ко второму маяку', 'Замкни орбиту третьим маяком'],
  replay: ['Повтори петлю клубка', 'Пережди ветер и пройди окно', 'Обойди шар и кольцо'],
  home: ['Верни вещи в корзину', 'Распутай цветные ленты', 'Открой маршрут в гостиную'],
});

export const getPatternRule = (pattern) => PATTERN_RULES[pattern] ?? null;
export const getBossTargetFraction = (boss, phase, fallback = 0.5) => BOSS_LANES[boss]?.[Math.max(0, Math.min(2, phase))] ?? fallback;
export const getBossPhaseCue = (boss, phase) => BOSS_PHASES[boss]?.[Math.max(0, Math.min(2, phase))] ?? 'Продолжай маршрут';
export const getCollectibleTargetFraction = (pattern, collected, random = 0.5) => {
  if (pattern === 'star-order') return [0.22, 0.5, 0.78][collected % 3];
  return 0.25 + Math.max(0, Math.min(1, random)) * 0.52;
};
export const laneFraction = (lane, index, progress, elapsed = 0) => {
  switch (lane) {
    case 'center': return 0.5;
    case 'high': return 0.29;
    case 'zigzag': return index % 2 ? 0.78 : 0.22;
    case 'stairs': return 0.18 + 0.64 * progress;
    case 'branch': return index % 3 === 1 ? 0.74 : 0.31;
    case 'orbit': return 0.5 + Math.sin(index * 0.72) * 0.27;
    case 'orbit-switch': { const direction = Math.floor(index / 5) % 2 ? -1 : 1; return 0.5 + Math.sin(index * 0.72) * 0.27 * direction; }
    case 'room-shift': return Math.floor(elapsed / 30) % 2 ? 0.72 : 0.28;
    case 'sequence': return [0.22, 0.5, 0.78][index % 3];
    case 'mirror': return index % 2 ? 0.22 : 0.78;
    case 'weave': return [0.22, 0.68, 0.38, 0.78, 0.5][index % 5];
    case 'shelter': return index % 4 === 1 ? 0.26 : index % 4 === 3 ? 0.74 : 0.5;
    default: return null;
  }
};
