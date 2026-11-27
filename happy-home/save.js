const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

export const freshSave = () => ({ completed: [], checkpoint: null, settings: { music: false, sfx: false } });

function normalizeCheckpoint(value) {
  if (!value || !Number.isInteger(value.id) || value.id < 1 || value.id > 50) return null;
  return {
    id: value.id,
    elapsed: clamp(value.elapsed, 0, 3600, 0),
    y: clamp(value.y, 0.04, 0.96, 0.48),
    vy: clamp(value.vy, -0.8, 0.8, 0),
    lives: Math.round(clamp(value.lives, 1, 3, 3)),
    invulnerable: clamp(value.invulnerable, 0, 2.5, 0),
    bossHits: Math.round(clamp(value.bossHits, 0, 3, 0)),
    bossExtensions: Math.round(clamp(value.bossExtensions, 0, 3, 0)),
    lastPaw: Math.round(clamp(value.lastPaw, -1, 100000, -1)),
    collected: Math.round(clamp(value.collected, 0, 100000, 0)),
    runTarget: clamp(value.runTarget, 0, 4000, 0),
    checkpointAt: Math.floor(clamp(value.checkpointAt, 0, 3600, 0) / 30) * 30,
  };
}

export function normalizeSave(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return freshSave();
    const completed = Array.isArray(value.completed)
      ? [...new Set(value.completed.filter((id) => Number.isInteger(id) && id >= 1 && id <= 50))].sort((a, b) => a - b)
      : [];
    return {
      completed,
      checkpoint: normalizeCheckpoint(value.checkpoint),
      settings: { music: !!value.settings?.music, sfx: !!value.settings?.sfx },
    };
  } catch {
    return freshSave();
  }
}
