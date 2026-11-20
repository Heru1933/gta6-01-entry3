// Screenshot scenes (?shot=<name>) and the headless self-test (?test=1).
// Both drive the real game through its public methods: scenes pose the
// city at set hours, and the test walks, steals, drives, fights, answers
// police heat, finishes mission one, paints the minimap and saves.

import { Vehicle } from './vehicles.js';

function clearDialogue(game) {
  game.dialogueQueue = [];
  game.dialogueActive = false;
  game.hud.setDialogue(null);
}

function dressStreet(game, cx, cy) {
  const spots = [[-190, -128, 0.2], [150, 128, Math.PI], [-60, -128, 0], [240, -124, 0.1]];
  for (const [dx, dy, a] of spots) {
    const car = new Vehicle(game.world, game.rng.pick(['meridian', 'dartlet', 'bandit', 'dunefox']), cx + dx, cy + dy, a, { kind: 'parked', rng: game.rng });
    game.vehicles.push(car);
  }
}

export function setupShotScene(game, name) {
  const L = game.world.locations;
  game.audio.start();
  if (name === 'cover') {
    game.timeOfDay = 17.9;
    game.menuCamX = 2000; game.menuCamY = 1500;
    window.__shotReady = true;
    return;
  }
  game.startNewGame();
  clearDialogue(game);
  if (name === 'play') {
    game.timeOfDay = 10.4;
    game.player.x = 1960; game.player.y = 1235; game.player.angle = 0.6;
    game.missions.start(game);
    clearDialogue(game);
    dressStreet(game, 2000, 1200);
    game.snapCamera();
  } else if (name === 'chase') {
    game.timeOfDay = 18.7;
    game.missions.index = 2;
    game.missions.start(game);
    clearDialogue(game);
    game.missions.stepIndex = 1;
    game.missions.hadHeat = true;
    const car = new Vehicle(game.world, 'bandit', 1500, 1960, 0, { kind: 'player', color: '#7a1f1f' });
    car.vx = 300;
    game.vehicles.push(car);
    game.player.car = car; game.player.x = car.x; game.player.y = car.y;
    game.wanted.points = 4.3;
    const copSpots = [[1180, 1925, 0.15], [1150, 2010, -0.1], [1830, 2050, Math.PI + 0.4]];
    for (const [x, y, a] of copSpots) {
      const cop = new Vehicle(game.world, 'interceptor', x, y, a, { kind: 'police', color: '#18222e' });
      cop.vx = Math.cos(a) * 280; cop.vy = Math.sin(a) * 280;
      game.vehicles.push(cop);
    }
    game.snapCamera();
  } else if (name === 'night') {
    game.timeOfDay = 22.2;
    game.missions.index = 4;
    game.missions.start(game);
    clearDialogue(game);
    game.hud.setDialogue({ who: 'Nadia Ferro', text: 'The crate is on the dock, Dario. Lift it, and whatever happens — keep driving.' });
    const car = new Vehicle(game.world, 'meridian', 3560, 2470, 0.5, { kind: 'player', color: '#305f8a' });
    game.vehicles.push(car);
    game.player.car = car; game.player.x = car.x; game.player.y = car.y;
    game.snapCamera();
  }
  window.__shotReady = true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runAutotest(game) {
  const results = [];
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  const check = (name, ok, detail) => results.push({ name, pass: !!ok, detail: detail || '' });
  try {
    check('world built', game.world.buildings.length > 40, game.world.buildings.length + ' buildings');
    check('road graph', game.world.nodes.size > 30, game.world.nodes.size + ' nodes');
    game.startNewGame();
    clearDialogue(game);
    check('new game starts playing', game.state === 'playing');
    check('player at spawn', Math.hypot(game.player.x - game.world.locations.spawn.x, game.player.y - game.world.locations.spawn.y) < 4);

    const px0 = game.player.x;
    game.input.keys.add('KeyD');
    await sleep(500);
    game.input.keys.delete('KeyD');
    check('player walks', game.player.x > px0 + 20, 'moved to ' + Math.round(game.player.x));
    check('camera tracks the player', Number.isFinite(game.camera.x) && Number.isFinite(game.camera.y)
      && Math.abs(game.camera.x + 640 - game.player.x) < 700 && Math.abs(game.camera.y + 360 - game.player.y) < 500,
      'cam ' + Math.round(game.camera.x) + ',' + Math.round(game.camera.y));
    const sp = game.world.locations.spawn;
    const car = game.vehicles.filter((v) => v.kind === 'parked')
      .sort((a, b) => Math.hypot(a.x - sp.x, a.y - sp.y) - Math.hypot(b.x - sp.x, b.y - sp.y))[0];
    check('parked car exists', !!car);
    game.player.x = car.x + 30; game.player.y = car.y;
    game.tryEnterCar();
    check('car stolen / entered', game.player.car === car);
    const cx0 = car.x, cy0 = car.y;
    game.input.keys.add('KeyW');
    await sleep(2600);
    game.input.keys.delete('KeyW');
    check('car drives', Math.hypot(car.x - cx0, car.y - cy0) > 60, 'car at ' + Math.round(car.x) + ',' + Math.round(car.y));
    game.exitCar();
    check('exit car', game.player.car === null);

    const rp = game.world.nearestRoadPoint(game.player.x, game.player.y);
    game.player.x = rp.x; game.player.y = rp.y;
    const copPos = game.world.nearestRoadPoint(rp.x + 170, rp.y);
    const cop = new Vehicle(game.world, 'interceptor', copPos.x, copPos.y, Math.PI, { kind: 'police', color: '#18222e' });
    game.vehicles.push(cop);
    game.reportCrime('killPed', game.player.x, game.player.y, 1);
    check('witnessed crime raises wanted', game.wanted.level >= 1, 'points ' + game.wanted.points.toFixed(2));
    game.police.spawnCd = 0;
    await sleep(2600);
    const copCount = game.vehicles.filter((v) => v.kind === 'police').length;
    check('police respond', copCount >= 2, copCount + ' police vehicles');

    const bulletsBefore = game.bullets.length;
    game.player.weapon = 'pistol';
    game.fireWeapon(0.3);
    check('pistol fires a bullet', game.bullets.length > bulletsBefore || game.player.magIn < 12);

    game.wanted.clear();
    game.player.hp = 100; game.player.armor = 100;
    game.vehicles = game.vehicles.filter((v) => v.kind !== 'police');
    game.peds = game.peds.filter((p) => p.role !== 'officer');
    game.missions.start(game);
    clearDialogue(game);
    const m1car = game.vehicles.find((v) => v.missionTag === 'm1car');
    check('mission 1 spawns the Vireo', !!m1car);
    game.player.x = game.world.locations.beachLot.x; game.player.y = game.world.locations.beachLot.y;
    await sleep(220);
    game.player.x = m1car.x + 20; game.player.y = m1car.y;
    game.tryEnterCar();
    await sleep(220);
    check('mission advances to delivery', game.missions.stepIndex === 2, 'step ' + game.missions.stepIndex);
    m1car.x = game.world.locations.garage.x; m1car.y = game.world.locations.garage.y;
    game.player.x = m1car.x; game.player.y = m1car.y;
    await sleep(400);
    clearDialogue(game);
    check('mission 1 completes', game.missions.index === 1 && game.cash >= 900, 'cash $' + game.cash);

    const mc = game.hud.mapCtx;
    const img = mc.getImageData(20, 20, 60, 40).data;
    let varied = false;
    for (let i = 4; i < img.length; i += 4) if (img[i] !== img[0] || img[i + 1] !== img[1]) { varied = true; break; }
    check('minimap renders', varied);

    const { writeSave, readSave, snapshotGame } = await import('./save.js');
    writeSave(snapshotGame(game));
    const back = readSave();
    check('save round-trips', !!back && back.cash === game.cash && back.missionIndex === 1);
    check('no page errors', errors.length === 0, errors.join(' | '));
  } catch (err) {
    check('autotest completed without exception', false, String(err && err.stack || err));
  }
  const passed = results.filter((r) => r.pass).length;
  const report = { passed, total: results.length, results };
  window.__testReport = report;
  window.__testDone = true;
  document.title = 'TEST ' + passed + '/' + results.length;
  const el = document.getElementById('test-report');
  el.classList.remove('hidden');
  el.textContent = 'AUTOTEST ' + passed + '/' + results.length + '\n' + results.map((r) => (r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.detail ? ' — ' + r.detail : '')).join('\n');
}
