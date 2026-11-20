// Coral Bay Heat — game core for the rebuilt entry. Owns the state machine
// (title, playing, dialogue, pause, shop, wasted), the player on foot and
// in a car, crime/damage bookkeeping, shop and mission interactions, the
// traffic/pedestrian population, and the render loop tying it together.

import { WORLD_W, WORLD_H, START_HOUR, WEAPONS, CRIME_POINTS, SHOP_PRICES } from './config.js';
import { Rng, clamp } from './random.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { createWorld } from './world.js';
import { Vehicle, spawnTrafficCar, spawnParkedCars, updateTrafficCar } from './vehicles.js';
import { Ped, spawnPeds } from './people.js';
import { Wanted, PoliceManager } from './police.js';
import { updateBullets, spawnBullet, explode, meleeSwing } from './combat.js';
import { MissionRunner, TaxiFares } from './missions.js';
import { Effects } from './effects.js';
import { drawScene } from './render.js';
import { Hud } from './hud.js';
import { hasSave, writeSave, readSave, clearSave, snapshotGame, applySave } from './save.js';
import { setupShotScene, runAutotest } from './shots.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new SoundEngine();
    this.hud = new Hud();
    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('seed') || 20261120);
    this.world = createWorld(seed);
    this.rng = new Rng(seed + 77);
    this.effects = new Effects();
    this.bullets = [];
    this.vehicles = [];
    this.peds = [];
    this.time = 0;
    this.timeOfDay = 17.6;
    this.state = 'menu';
    this.cash = 0;
    this.heatFloor = 0;
    this.lastDanger = { x: 0, y: 0, t: -99 };
    this.dialogueQueue = [];
    this.dialogueActive = false;
    this.dialogueDone = null;
    this.shopOpen = false;
    this.storyCompleteShown = false;
    this.menuCamX = 2000; this.menuCamY = 1500;
    this.camera = { x: 1360, y: 1140 };
    this.popT = 0;
    this.stats = this.freshStats();
    this.flags = { smgUnlocked: false };
    this.wanted = new Wanted();
    this.police = new PoliceManager();
    this.missions = new MissionRunner();
    this.fares = new TaxiFares();
    const sp = this.world.locations.spawn;
    this.player = {
      x: sp.x, y: sp.y, vx: 0, vy: 0, angle: -Math.PI / 2, hp: 100, armor: 0,
      weapon: 'pistol', weaponsOwned: { fist: true, pistol: true, smg: false },
      ammo: { pistol: 48, smg: 0 }, magIn: 12, mags: { pistol: 12, smg: 0 },
      reloadT: 0, reloading: false, shootCd: 0,
      car: null, walkPhase: 0, hidden: true, lastHurtBy: '', hitCdT: -99,
    };
    this.setupAmbient();
    this.wireMenu();
    this.shotName = params.get('shot');
    this.testMode = params.get('test') === '1';
    if (this.shotName) setupShotScene(this, this.shotName);
    if (this.testMode) runAutotest(this);
    this.lastTs = performance.now();
    requestAnimationFrame((ts) => this.frame(ts));
  }

  freshStats() { return { missionsDone: 0, faresDone: 0, carsStolen: 0, takedowns: 0, shotsFired: 0, deaths: 0 }; }

  setupAmbient() {
    this.vehicles = spawnParkedCars(this.world, this.rng);
    for (let i = 0; i < 12; i++) {
      const car = spawnTrafficCar(this.world, this.rng, 2000, 1500);
      if (car) this.vehicles.push(car);
    }
    this.peds = spawnPeds(this.world, this.rng, 2000, 1500, 34);
  }

  wireMenu() {
    const soundBtn = $('btn-sound');
    $('btn-new').addEventListener('click', () => { this.audio.start(); this.audio.uiClick(); this.startNewGame(); });
    const cont = $('btn-continue');
    cont.disabled = !hasSave();
    cont.addEventListener('click', () => { this.audio.start(); this.audio.uiClick(); this.continueGame(); });
    $('btn-how').addEventListener('click', () => { this.audio.uiClick(); $('howto').classList.toggle('hidden'); });
    soundBtn.addEventListener('click', () => {
      this.audio.start();
      this.audio.setMuted(!this.audio.muted);
      soundBtn.textContent = this.audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
    $('btn-resume').addEventListener('click', () => this.setPaused(false));
    $('btn-save').addEventListener('click', () => { this.autosave(); this.toast('Game saved'); this.audio.cash(); });
    $('btn-restart').addEventListener('click', () => { clearSave(); this.setPaused(false); this.startNewGame(); });
    $('btn-quit').addEventListener('click', () => { this.setPaused(false); this.quitToTitle(); });
    $('btn-respawn').addEventListener('click', () => this.respawn());
    $('btn-freeroam').addEventListener('click', () => { this.hud.el.complete.classList.add('hidden'); });
    $('btn-shop-close').addEventListener('click', () => this.closeShop());
    this.hud.onBuy = (key) => this.buyItem(key);
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') { this.audio.setMuted(!this.audio.muted); soundBtn.textContent = this.audio.muted ? 'SOUND: OFF' : 'SOUND: ON'; } });
  }

  startNewGame() {
    this.cash = 12;
    this.stats = this.freshStats();
    this.flags = { smgUnlocked: false };
    this.missions = new MissionRunner();
    this.fares = new TaxiFares();
    this.wanted = new Wanted();
    this.police = new PoliceManager();
    this.heatFloor = 0;
    this.bullets = [];
    this.effects = new Effects();
    this.storyCompleteShown = false;
    const sp = this.world.locations.spawn;
    Object.assign(this.player, {
      x: sp.x, y: sp.y, vx: 0, vy: 0, angle: 0.4, hp: 100, armor: 0, weapon: 'pistol',
      weaponsOwned: { fist: true, pistol: true, smg: false },
      ammo: { pistol: 48, smg: 0 }, magIn: 12, mags: { pistol: 12, smg: 0 }, reloadT: 0, reloading: false, shootCd: 0, car: null, hidden: false,
    });
    this.vehicles = spawnParkedCars(this.world, this.rng);
    const b1 = new Vehicle(this.world, 'dartlet', 742, 1152, 0, { kind: 'parked', rng: this.rng });
    const b2 = new Vehicle(this.world, 'meridian', 905, 1248, Math.PI, { kind: 'parked', rng: this.rng });
    this.vehicles.push(b1, b2);
    for (let i = 0; i < 10; i++) { const c = spawnTrafficCar(this.world, this.rng, sp.x, sp.y); if (c) this.vehicles.push(c); }
    this.peds = spawnPeds(this.world, this.rng, sp.x, sp.y, 30);
    this.timeOfDay = START_HOUR;
    this.state = 'playing';
    this.hud.el.menu.classList.add('hidden');
    this.hud.showGameUI(true);
    this.snapCamera();
    this.showDialogue([
      { who: 'Nadia Ferro (phone)', text: 'Dario? You actually came. Twelve dollars and a bus ticket — Coral Bay is going to eat you alive.' },
      { who: 'Nadia Ferro (phone)', text: 'Get yourself to Ferro Customs, the gold marker on your map. I have work, and work is food.' },
    ], null);
  }

  continueGame() {
    const s = readSave();
    if (!s) { this.startNewGame(); return; }
    this.startNewGame();
    applySave(this, s);
    this.dialogueQueue = []; this.dialogueActive = false; this.hud.setDialogue(null);
    this.toast('Welcome back to Coral Bay');
  }

  quitToTitle() {
    this.state = 'menu';
    this.player.hidden = true;
    this.player.car = null;
    this.hud.showGameUI(false);
    this.hud.el.menu.classList.remove('hidden');
    $('btn-continue').disabled = !hasSave();
    this.setupAmbient();
    this.timeOfDay = 17.6;
  }

  setPaused(on) {
    if (on && this.state !== 'playing') return;
    if (!on && this.state !== 'paused') return;
    this.state = on ? 'paused' : 'playing';
    this.hud.el.pause.classList.toggle('hidden', !on);
    if (on) this.hud.fillPauseStats(this);
  }

  autosave() { if (this.state === 'playing' || this.state === 'paused') writeSave(snapshotGame(this)); }

  onStoryComplete() {
    if (this.storyCompleteShown) return;
    this.storyCompleteShown = true;
    this.hud.el.complete.classList.remove('hidden');
    this.audio.sting(true);
  }

  showDialogue(lines, onDone) {
    if (!lines || !lines.length) { if (onDone) onDone(); return; }
    this.dialogueQueue = [...lines];
    this.dialogueDone = onDone || null;
    this.dialogueActive = true;
    this.hud.setDialogue(this.dialogueQueue[0]);
  }
  advanceDialogue() {
    if (!this.dialogueActive) return;
    this.audio.uiClick();
    this.dialogueQueue.shift();
    if (this.dialogueQueue.length) this.hud.setDialogue(this.dialogueQueue[0]);
    else {
      this.dialogueActive = false;
      this.hud.setDialogue(null);
      const cb = this.dialogueDone; this.dialogueDone = null;
      if (cb) cb();
    }
  }

  toast(msg) { this.hud.toast(msg); }
  banner(title, sub) { this.hud.banner(title, sub); }
  addCash(n) { this.cash += n; }
  setDanger(x, y) { this.lastDanger = { x, y, t: this.time }; }
  snapCamera() {
    const p = this.player;
    this.camera.x = clamp((p.car ? p.car.x : p.x) - 640, 0, WORLD_W - 1280);
    this.camera.y = clamp((p.car ? p.car.y : p.y) - 360, 0, WORLD_H - 720);
  }

  reportCrime(kind, x, y, scale = 1) {
    const pts = CRIME_POINTS[kind];
    if (!pts) return;
    const px = this.player.car ? this.player.car.x : this.player.x;
    const py = this.player.car ? this.player.car.y : this.player.y;
    let witnessed = false;
    for (const car of this.vehicles) {
      if (car.kind !== 'police' || car.dead) continue;
      if (Math.hypot(car.x - x, car.y - y) < 580 && !this.world.losBlocked(car.x, car.y, x, y)) { witnessed = true; break; }
    }
    if (!witnessed) for (const ped of this.peds) {
      if (ped.role !== 'officer' || ped.dead) continue;
      if (Math.hypot(ped.x - x, ped.y - y) < 440 && !this.world.losBlocked(ped.x, ped.y, x, y)) { witnessed = true; break; }
    }
    if (!witnessed && ['hitPed', 'killPed', 'punchPed', 'stealCar', 'explosion'].includes(kind)) {
      for (const ped of this.peds) {
        if (ped.dead || ped.role !== 'walker') continue;
        if (Math.hypot(ped.x - x, ped.y - y) < 150) { witnessed = true; break; }
      }
    }
    if (witnessed) {
      this.wanted.add(pts * scale);
      this.wanted.lastSeenX = px; this.wanted.lastSeenY = py;
    }
  }

  damagePlayer(amount, source) {
    const p = this.player;
    if (this.state !== 'playing' || amount <= 0) return;
    const absorbed = Math.min(p.armor, amount * 0.6);
    p.armor -= absorbed;
    p.hp -= (amount - absorbed);
    p.lastHurtBy = source || '';
    if (amount > 4) { this.audio.hurt(); this.effects.addShake(Math.min(5, amount * 0.12)); }
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  die() {
    this.state = 'wasted';
    this.stats.deaths++;
    const busted = this.player.lastHurtBy === 'shot' && this.wanted.level >= 2 && !this.player.car;
    $('wasted-title').textContent = busted ? 'BUSTED' : 'WASTED';
    $('wasted-sub').textContent = busted
      ? 'The Coral Bay PD finally got their hands on Dario Venn.'
      : 'Dario Venn wakes up in Coral Bay General — the city keeps the change.';
    this.hud.el.wasted.classList.remove('hidden');
    this.audio.wasted();
    this.audio.setEngine(0, false);
    this.audio.setSiren(null);
    this.audio.setSkid(false);
    if (this.fares.active) this.fares.cancel(this, 'Fare lost');
  }

  respawn() {
    const L = this.world.locations;
    const fee = Math.min(this.cash, 150);
    this.cash -= fee;
    const p = this.player;
    p.hp = 100; p.armor = 0; p.car = null; p.vx = 0; p.vy = 0;
    p.x = L.hospital.x; p.y = L.hospital.y + 26;
    this.wanted.clear();
    this.heatFloor = 0;
    this.hud.el.wasted.classList.add('hidden');
    this.state = 'playing';
    this.snapCamera();
    this.toast(fee ? 'Hospital bill: $' + fee : 'Discharged — no charge this time');
  }

  onPedKilled(ped, byPlayer) {
    if (ped.role === 'officer') {
      if (ped.ownerCar) ped.ownerCar.officersOut = Math.max(0, (ped.ownerCar.officersOut || 0) - 1);
      if (byPlayer) { this.wanted.add(0.8); this.reportCrime('killPed', ped.x, ped.y, 1); }
    } else if (byPlayer) {
      this.stats.takedowns++;
      this.reportCrime('killPed', ped.x, ped.y, 1);
    }
    if (ped.role === 'fare' && this.fares.active && this.fares.active.ped === ped) this.fares.cancel(this, 'Your fare did not make it');
    this.setDanger(ped.x, ped.y);
  }

  onVehicleCrash(vehicle, impact) {
    vehicle.damage((impact - 120) * 0.055, this);
    const near = Math.hypot(vehicle.x - this.player.x, vehicle.y - this.player.y) < 720;
    if (near) { this.audio.crash(impact > 250); this.effects.sparks(vehicle.x, vehicle.y, vehicle.angle + Math.PI); }
    if (vehicle === this.player.car) {
      this.effects.addShake(Math.min(9, impact * 0.03));
      if (impact > 320) this.damagePlayer((impact - 320) * 0.03, 'crash');
    }
  }

  onVehicleDestroyed(vehicle) {
    const byPlayer = !!vehicle.lastHitByPlayer;
    explode(this, vehicle.x, vehicle.y, 115, 60, byPlayer);
    if (this.player.car === vehicle) {
      const p = this.player;
      p.car = null;
      p.x = vehicle.x + 40; p.y = vehicle.y + 20;
      const res = this.world.collideCircle(p.x, p.y, 11, true);
      p.x = res.x; p.y = res.y;
    }
    vehicle.kind = 'parked';
    if (this.missions.built) {
      for (const s of this.missions.built.steps) if (s.vehicle === vehicle && s.kind === 'deliver') this.missions.fail(this, 'The vehicle was destroyed');
    }
  }

  magSize(weapon) { return WEAPONS[weapon].mag; }
  switchWeapon(w) {
    const p = this.player;
    p.mags = p.mags || { pistol: 12, smg: 0 };
    if (!p.weaponsOwned[w] || p.weapon === w) return;
    p.mags[p.weapon] = p.magIn;
    p.weapon = w;
    p.magIn = p.mags[w] !== undefined ? p.mags[w] : Math.min(this.magSize(w), p.ammo[w] || 0);
    p.reloadT = 0; p.reloading = false;
    this.audio.uiClick();
  }
  startReload() {
    const p = this.player;
    if (p.weapon === 'fist' || p.reloadT > 0) return;
    if (p.magIn >= this.magSize(p.weapon) || (p.ammo[p.weapon] || 0) <= 0) return;
    p.reloadT = 1.05; p.reloading = true;
    this.audio.reload();
  }
  fireWeapon(angle) {
    const p = this.player;
    const w = WEAPONS[p.weapon];
    if (p.weapon === 'fist' || p.reloadT > 0 || p.shootCd > 0) return;
    if (p.magIn <= 0) { this.audio.dryFire(); p.shootCd = 0.25; this.startReload(); return; }
    p.magIn--;
    p.shootCd = w.cooldown;
    this.stats.shotsFired++;
    const a = angle + (Math.random() - 0.5) * 2 * w.spread;
    spawnBullet(this, p.x + Math.cos(a) * 17, p.y + Math.sin(a) * 17, a, 'player', w.damage);
    if (p.weapon === 'smg') this.audio.shootSmg(); else this.audio.shoot();
    this.setDanger(p.x, p.y);
    this.reportCrime('shootNearCop', p.x, p.y, 1);
    if (p.magIn === 0) this.startReload();
  }

  tryEnterCar() {
    const p = this.player;
    if (p.car) return false;
    let best = null, bd = 70;
    for (const v of this.vehicles) {
      if (v.dead) continue;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < bd) { bd = d; best = v; }
    }
    if (!best) return false;
    const wasKind = best.kind;
    if (wasKind === 'traffic') {
      const driver = new Ped(this.world, best.x + 24, best.y + 8, {});
      driver.state = 'flee'; driver.fleeT = 3;
      driver.fleeX = driver.x + 200; driver.fleeY = driver.y;
      this.peds.push(driver);
      this.toast('Carjacked! The driver is calling it in…');
    }
    best.kind = 'player';
    p.car = best;
    p.x = best.x; p.y = best.y;
    this.audio.door();
    this.audio.engineStart();
    if ((wasKind === 'parked' || wasKind === 'traffic' || wasKind === 'mission') && !best.stolenCounted) {
      best.stolenCounted = true;
      this.stats.carsStolen++;
      this.reportCrime('stealCar', best.x, best.y, 1);
    }
    if (wasKind === 'police') { this.wanted.add(1.2); this.toast('You just stole a police Interceptor!'); }
    return true;
  }
  exitCar() {
    const p = this.player;
    const car = p.car;
    if (!car) return;
    const rx = -Math.sin(car.angle), ry = Math.cos(car.angle);
    p.x = car.x - rx * (car.wid / 2 + 17);
    p.y = car.y - ry * (car.wid / 2 + 17);
    const res = this.world.collideCircle(p.x, p.y, 11, true);
    p.x = res.x; p.y = res.y;
    p.car = null;
    car.kind = 'parked';
    this.audio.door();
    this.audio.setEngine(0, false);
    this.audio.setSkid(false);
  }

  openShop() { this.shopOpen = true; this.hud.openShop(this); this.audio.uiClick(); }
  closeShop() { this.shopOpen = false; this.hud.closeShop(); }
  buyItem(key) {
    const p = this.player;
    p.mags = p.mags || { pistol: 12, smg: 0 };
    const price = SHOP_PRICES[key];
    if (price === undefined || this.cash < price) return;
    if (key === 'armor') { if (p.armor >= 100) return; p.armor = 100; }
    else if (key === 'pistolAmmo') p.ammo.pistol += 24;
    else if (key === 'smgAmmo') p.ammo.smg += 30;
    else if (key === 'smg') { p.weaponsOwned.smg = true; p.ammo.smg += 60; p.mags.smg = 30; this.switchWeapon('smg'); }
    else return;
    this.cash -= price;
    this.audio.cash();
    this.toast('Purchased — Ironhold Arms thanks you');
  }

  currentMarker() {
    if (this.state !== 'playing') return null;
    const M = this.missions;
    const g = this.world.locations.garage;
    if (M.state === 'idle' && !M.finished) return { x: g.x, y: g.y, color: 'rgba(255,217,77,A)', label: 'WORK', mapColor: '#ffd94d' };
    if (M.state === 'active') {
      const m = M.marker();
      if (m) return { x: m.x, y: m.y, color: 'rgba(255,217,77,A)', label: '', mapColor: '#ffd94d' };
    }
    if (this.fares.active) return { x: this.fares.active.x, y: this.fares.active.y, color: 'rgba(141,255,110,A)', label: 'FARE', mapColor: '#8dff6e' };
    return null;
  }
  objectiveText() {
    if (this.state !== 'playing' || this.dialogueActive) return '';
    if (this.missions.state === 'active') return this.missions.objectiveText();
    if (this.fares.active) return 'Fare: drop your passenger at the green marker';
    return this.missions.objectiveText();
  }

  updatePlayerFoot(dt) {
    const p = this.player, inp = this.input;
    let mx = 0, my = 0;
    if (inp.down('KeyW', 'ArrowUp')) my -= 1;
    if (inp.down('KeyS', 'ArrowDown')) my += 1;
    if (inp.down('KeyA', 'ArrowLeft')) mx -= 1;
    if (inp.down('KeyD', 'ArrowRight')) mx += 1;
    const mouseWX = this.camera.x + inp.mouseX, mouseWY = this.camera.y + inp.mouseY;
    const aim = Math.atan2(mouseWY - p.y, mouseWX - p.x);
    if (p.weapon !== 'fist' || inp.mouseDown) p.angle = aim;
    else if (mx || my) p.angle = Math.atan2(my, mx);
    if (mx || my) {
      const len = Math.hypot(mx, my);
      const speed = inp.down('ShiftLeft', 'ShiftRight') ? 264 : 172;
      p.vx = (mx / len) * speed; p.vy = (my / len) * speed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.walkPhase += dt * speed / 15;
      const res = this.world.collideCircle(p.x, p.y, 11, true);
      p.x = res.x; p.y = res.y;
    } else { p.vx = 0; p.vy = 0; }
    p.shootCd -= dt;
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        p.reloading = false;
        const need = this.magSize(p.weapon) - p.magIn;
        const take = Math.min(need, p.ammo[p.weapon] || 0);
        p.magIn += take; p.ammo[p.weapon] -= take;
      }
    }
    if (inp.wasPressed('Digit1')) this.switchWeapon('fist');
    if (inp.wasPressed('Digit2')) this.switchWeapon('pistol');
    if (inp.wasPressed('Digit3')) this.switchWeapon('smg');
    if (inp.wasPressed('KeyQ')) {
      const order = ['fist', 'pistol', 'smg'].filter((w) => p.weaponsOwned[w]);
      this.switchWeapon(order[(order.indexOf(p.weapon) + 1) % order.length]);
    }
    if (inp.wasPressed('KeyR')) this.startReload();
    if (p.weapon === 'fist') {
      if (inp.mouseClicked && p.shootCd <= 0) { meleeSwing(this); p.shootCd = WEAPONS.fist.cooldown; }
    } else if (WEAPONS[p.weapon].auto ? inp.mouseDown : inp.mouseClicked) {
      this.fireWeapon(aim);
    }
  }

  updatePlayerCar(dt) {
    const p = this.player, car = p.car, inp = this.input;
    let throttle = 0, steer = 0;
    if (inp.down('KeyW', 'ArrowUp')) throttle = 1;
    if (inp.down('KeyS', 'ArrowDown')) throttle = -1;
    if (inp.down('KeyA', 'ArrowLeft')) steer = -1;
    if (inp.down('KeyD', 'ArrowRight')) steer = 1;
    const handbrake = inp.down('Space');
    car.driveStep(dt, this, throttle, steer, handbrake);
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.vx = car.vx; p.vy = car.vy;
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const rx = -fy, ry = fx;
    const bx = car.x - fx * car.len * 0.3, by = car.y - fy * car.len * 0.3;
    const lx = bx - rx * (car.wid / 2 - 2), ly = by - ry * (car.wid / 2 - 2);
    const rrx = bx + rx * (car.wid / 2 - 2), rry = by + ry * (car.wid / 2 - 2);
    if ((car.sliding || (handbrake && car.speed() > 70)) && car.speed() > 40) {
      if (car._skidL) this.effects.addSkid(car._skidL.x, car._skidL.y, lx, ly);
      if (car._skidR) this.effects.addSkid(car._skidR.x, car._skidR.y, rrx, rry);
      this.audio.setSkid(true);
    } else this.audio.setSkid(false);
    car._skidL = { x: lx, y: ly }; car._skidR = { x: rrx, y: rry };
    this.audio.setEngine(clamp(Math.abs(car.forwardSpeed()) / car.type.maxSpeed, 0, 1), true);
    if ((inp.wasPressed('KeyE') || inp.wasPressed('KeyF')) && car.speed() < 70) this.exitCar();
  }

  updateCollisions(dt) {
    const cars = this.vehicles;
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      if (Math.hypot(a.x - this.player.x, a.y - this.player.y) > 1500) continue;
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = (a.radius + b.radius) * 0.86;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr * rr || d2 < 0.01) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const overlap = (rr - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rvn < 0) {
          const impact = -rvn;
          const imp = rvn * 0.72;
          a.vx += nx * imp; a.vy += ny * imp;
          b.vx -= nx * imp; b.vy -= ny * imp;
          if (impact > 95) {
            a.damage(impact * 0.16, this); b.damage(impact * 0.16, this);
            this.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, Math.atan2(ny, nx));
            const playerInvolved = a === this.player.car || b === this.player.car;
            if (playerInvolved) {
              this.audio.crash(impact > 220);
              this.effects.addShake(Math.min(8, impact * 0.03));
              const other = a === this.player.car ? b : a;
              if (other.kind === 'police') this.reportCrime('hitCopCar', other.x, other.y, 0.8);
              else if (other.kind === 'traffic' || other.kind === 'parked') this.reportCrime('hitCar', other.x, other.y, 0.7);
              other.lastHitByPlayer = true;
            }
          }
        }
      }
      if (a.speed() > 52) {
        for (const ped of this.peds) {
          if (ped.dead || ped.state === 'ride') continue;
          if (Math.hypot(ped.x - a.x, ped.y - a.y) < a.radius * 0.82 + 9) {
            if (ped.hitCdT && this.time - ped.hitCdT < 0.6) continue;
            ped.hitCdT = this.time;
            const byPlayer = a === this.player.car;
            ped.damage((a.speed() - 38) * 0.5, this, byPlayer);
            ped.x += a.vx * 0.05; ped.y += a.vy * 0.05;
            if (byPlayer && !ped.dead) this.reportCrime('hitPed', ped.x, ped.y, 0.85);
            if (a === this.player.car) { this.audio.crash(false); this.effects.addShake(2.5); }
          }
        }
      }
      const p = this.player;
      if (!p.car && a !== p.car && a.speed() > 55 && Math.hypot(p.x - a.x, p.y - a.y) < a.radius * 0.82 + 10) {
        if (!p.hitCdT || this.time - p.hitCdT > 0.8) {
          p.hitCdT = this.time;
          this.damagePlayer((a.speed() - 45) * 0.15, 'car');
          p.x += a.vx * 0.06; p.y += a.vy * 0.06;
          const res = this.world.collideCircle(p.x, p.y, 11, true);
          p.x = res.x; p.y = res.y;
        }
      }
    }
  }

  updateInteractions(dt) {
    const p = this.player, inp = this.input, L = this.world.locations;
    this.sprayCd = Math.max(0, (this.sprayCd || 0) - dt);
    this.sprayMsgCd = Math.max(0, (this.sprayMsgCd || 0) - dt);
    let prompt = null;
    if (p.car) {
      const dSpray = Math.hypot(p.car.x - L.spray.x, p.car.y - L.spray.y);
      if (dSpray < 85) {
        prompt = 'Shine Auto — $250 repaint: repairs the car, clears your heat';
        if (p.car.speed() < 42 && this.sprayCd <= 0) {
          if (this.cash >= SHOP_PRICES.spray && (this.wanted.level > 0 || p.car.health < 100)) {
            this.cash -= SHOP_PRICES.spray;
            p.car.health = 100;
            this.wanted.clear();
            this.heatFloor = 0;
            this.sprayCd = 9;
            this.audio.cash();
            this.effects.cashSparkle(p.car.x, p.car.y);
            this.toast('Shine Auto: fresh paint, fresh start');
          } else if (this.cash < SHOP_PRICES.spray && this.sprayMsgCd <= 0) {
            this.toast('Shine Auto needs $250');
            this.sprayMsgCd = 6;
          }
        }
      }
      this.hud.setPrompt(prompt);
      return;
    }
    let action = null;
    if (this.missions.state === 'idle' && !this.missions.finished && Math.hypot(p.x - L.garage.x, p.y - L.garage.y) < 88) {
      prompt = '<b>E</b> — Talk to Nadia Ferro (new job)';
      action = () => this.missions.start(this);
    } else if (Math.hypot(p.x - L.gunShop.x, p.y - L.gunShop.y) < 62) {
      prompt = '<b>E</b> — Ironhold Arms';
      action = () => this.openShop();
    } else if (Math.hypot(p.x - L.hospital.x, p.y - L.hospital.y) < 62) {
      prompt = '<b>E</b> — Treatment $50 (full heal)';
      action = () => {
        if (this.player.hp >= 100) { this.toast('You feel fine'); return; }
        if (this.cash < SHOP_PRICES.heal) { this.toast('Treatment costs $50'); return; }
        this.cash -= SHOP_PRICES.heal; this.player.hp = 100; this.audio.pickup(); this.toast('Patched up');
      };
    } else {
      for (const stand of L.foodStands) {
        if (Math.hypot(p.x - stand.x, p.y - stand.y) < 54) {
          prompt = '<b>E</b> — ' + stand.name + ' snack $15 (+40 HP)';
          action = () => {
            if (this.player.hp >= 100) { this.toast('You are full'); return; }
            if (this.cash < SHOP_PRICES.snack) { this.toast('A snack costs $15'); return; }
            this.cash -= SHOP_PRICES.snack;
            this.player.hp = Math.min(100, this.player.hp + 40);
            this.audio.pickup();
            this.effects.text(p.x, p.y - 22, '+40 HP', '#8dff6e');
          };
          break;
        }
      }
    }
    if (!action) {
      let bd = 70;
      for (const v of this.vehicles) {
        if (v.dead) continue;
        const d = Math.hypot(v.x - p.x, v.y - p.y);
        if (d < bd) bd = d;
      }
      if (bd < 70) { prompt = '<b>E</b> — Enter vehicle'; action = () => this.tryEnterCar(); }
    }
    this.hud.setPrompt(prompt);
    if (action && inp.wasPressed('KeyE')) action();
  }

  managePopulation(dt) {
    this.popT -= dt;
    const px = this.player.car ? this.player.car.x : this.player.x;
    const py = this.player.car ? this.player.car.y : this.player.y;
    this.vehicles = this.vehicles.filter((v) => {
      if (v === this.player.car || v.kind === 'police' || v.kind === 'mission') return true;
      if (v.kind === 'traffic' && Math.hypot(v.x - px, v.y - py) > 1550) return false;
      return true;
    });
    this.peds = this.peds.filter((ped) => {
      if (ped.role === 'target' || ped.role === 'gunman' || ped.role === 'officer') return true;
      if (ped.dead) return ped.deadT < 25;
      if (ped.role === 'fare') return true;
      return Math.hypot(ped.x - px, ped.y - py) < 1500;
    });
    if (this.popT > 0) return;
    this.popT = 0.8;
    const trafficNear = this.vehicles.filter((v) => v.kind === 'traffic' && Math.hypot(v.x - px, v.y - py) < 1400).length;
    if (trafficNear < 15) {
      const car = spawnTrafficCar(this.world, this.rng, px, py);
      if (car && Math.hypot(car.x - px, car.y - py) > 730) this.vehicles.push(car);
    }
    const pedsNear = this.peds.filter((p) => !p.dead && Math.hypot(p.x - px, p.y - py) < 1100).length;
    if (pedsNear < 30) {
      for (const ped of spawnPeds(this.world, this.rng, px, py, 4)) {
        if (Math.abs(ped.x - px) > 700 || Math.abs(ped.y - py) > 420) this.peds.push(ped);
      }
    }
    for (const v of this.vehicles) {
      if (v.dead) { if (Math.random() < dt * 6) this.effects.fire(v.x, v.y); }
      else if (v.health < 38 && Math.random() < dt * 5) this.effects.smoke(v.x + Math.cos(v.angle) * v.len * 0.3, v.y + Math.sin(v.angle) * v.len * 0.3, true);
    }
  }

  updateAmbient(dt) {
    for (const car of this.vehicles) if (car.kind === 'traffic') updateTrafficCar(car, dt, this);
    for (const ped of this.peds) ped.update(dt, this);
    this.effects.update(dt);
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'menu') {
      this.timeOfDay = (this.timeOfDay + dt * 24 / 300) % 24;
      this.updateAmbient(dt);
      this.camera.x = clamp(this.menuCamX + Math.sin(this.time * 0.06) * 330 - 640, 0, WORLD_W - 1280);
      this.camera.y = clamp(this.menuCamY + Math.cos(this.time * 0.045) * 200 - 360, 0, WORLD_H - 720);
      return;
    }
    if (this.state !== 'playing') return;
    this.timeOfDay = (this.timeOfDay + dt * 24 / 300) % 24;
    if (this.dialogueActive) {
      this.updateAmbient(dt);
      if (this.input.mouseClicked || this.input.wasPressed('KeyE') || this.input.wasPressed('Space')) this.advanceDialogue();
      this.hud.update(dt, this);
      return;
    }
    if (this.shopOpen) {
      if (this.input.wasPressed('KeyE') || this.input.wasPressed('Escape')) this.closeShop();
      this.hud.update(dt, this);
      return;
    }
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) { this.setPaused(true); return; }
    if (this.player.car) this.updatePlayerCar(dt); else this.updatePlayerFoot(dt);
    this.missions.update(dt, this);
    this.fares.update(dt, this);
    this.wanted.update(dt, this);
    this.police.update(dt, this);
    for (const car of this.vehicles) if (car.kind === 'traffic') updateTrafficCar(car, dt, this);
    updateBullets(dt, this);
    this.updateCollisions(dt);
    this.managePopulation(dt);
    this.updateInteractions(dt);
    let nearestCop = null;
    for (const car of this.vehicles) {
      if (car.kind !== 'police' || car.dead) continue;
      const d = Math.hypot(car.x - this.player.x, car.y - this.player.y);
      if (nearestCop === null || d < nearestCop) nearestCop = d;
    }
    this.audio.setSiren(this.wanted.level > 0 ? nearestCop : null);
    if (!this.player.car) this.audio.setEngine(0, false);
    for (const ped of this.peds) ped.update(dt, this);
    this.effects.update(dt);
    const focus = this.player.car || this.player;
    const lead = this.player.car ? 0.32 : 0;
    const tx = clamp(focus.x + (focus.vx || 0) * lead - 640, 0, WORLD_W - 1280);
    const ty = clamp(focus.y + (focus.vy || 0) * lead - 360, 0, WORLD_H - 720);
    const k = 1 - Math.exp(-5.2 * dt);
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
    this.hud.update(dt, this);
  }

  frame(ts) {
    const dt = clamp((ts - this.lastTs) / 1000, 0, 0.05);
    this.lastTs = ts;
    if (dt > 0) this.update(dt);
    const ctx = this.ctx;
    const view = { x: this.camera.x, y: this.camera.y, w: 1280, h: 720 };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#20303c';
    ctx.fillRect(0, 0, 1280, 720);
    const shX = this.effects.shake ? (Math.random() - 0.5) * this.effects.shake : 0;
    const shY = this.effects.shake ? (Math.random() - 0.5) * this.effects.shake : 0;
    ctx.save();
    ctx.translate(-view.x + shX, -view.y + shY);
    drawScene(ctx, this, view);
    ctx.restore();
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game(document.getElementById('game'));
  window.game = game;
});
