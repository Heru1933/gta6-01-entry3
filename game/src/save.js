// localStorage saves: cash, story progress, weapons and ammo, stats,
// position and time of day. Written on autosave and from the pause menu.

const KEY = 'coral-bay-heat-save-v1';

export function hasSave() {
  try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
}
export function writeSave(data) {
  try { window.localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}
export function readSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}

export function snapshotGame(game) {
  const p = game.player;
  return {
    cash: game.cash,
    missionIndex: game.missions.index,
    storyDone: game.missions.finished,
    smgUnlocked: !!game.flags.smgUnlocked,
    weapon: p.weapon,
    weaponsOwned: p.weaponsOwned,
    ammo: p.ammo,
    armor: p.armor,
    timeOfDay: game.timeOfDay,
    stats: game.stats,
    playerX: p.car ? p.car.x : p.x,
    playerY: p.car ? p.car.y : p.y,
  };
}

export function applySave(game, s) {
  game.cash = s.cash || 0;
  game.missions.index = s.missionIndex || 0;
  if (s.storyDone) game.missions.state = 'done';
  game.flags.smgUnlocked = !!s.smgUnlocked;
  const p = game.player;
  p.weaponsOwned = s.weaponsOwned || { fist: true, pistol: true, smg: !!s.smgUnlocked };
  p.ammo = s.ammo || { pistol: 48, smg: 0 };
  p.weapon = p.weaponsOwned[s.weapon] ? s.weapon : 'pistol';
  p.armor = s.armor || 0;
  p.x = s.playerX || game.world.locations.spawn.x;
  p.y = s.playerY || game.world.locations.spawn.y;
  p.vx = 0; p.vy = 0;
  game.timeOfDay = s.timeOfDay || 8.5;
  Object.assign(game.stats, s.stats || {});
}
