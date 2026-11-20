// Pedestrians and fighters: sidewalk walkers who flee danger, hired gunmen
// and a mission target who hold ground until provoked, police officers who
// leave their cars to fight on foot, and taxi fares waiting by the road.

import { PED_SHIRTS, PED_PANTS, SKIN_TONES } from './config.js';
import { clamp, angleDiff } from './random.js';
import { spawnBullet } from './combat.js';

let NEXT_ID = 1;

export class Ped {
  constructor(world, x, y, opts = {}) {
    this.id = NEXT_ID++;
    this.world = world;
    this.x = x; this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.vx = 0; this.vy = 0;
    this.hp = opts.hp || 100;
    this.role = opts.role || 'walker';
    this.state = 'walk';
    this.hostile = !!opts.hostile;
    this.name = opts.name || null;
    this.shirt = opts.shirt || PED_SHIRTS[this.id % PED_SHIRTS.length];
    this.pants = PED_PANTS[this.id % PED_PANTS.length];
    this.skin = SKIN_TONES[this.id % SKIN_TONES.length];
    this.destX = x; this.destY = y;
    this.thinkT = Math.random() * 2;
    this.shootCd = Math.random() * 0.5;
    this.burst = 0;
    this.burstT = 0;
    this.deadT = 0;
    this.fleeT = 0;
    this.fleeX = x; this.fleeY = y;
    this.walkPhase = Math.random() * 6;
    this.ownerCar = opts.ownerCar || null;
    this.riding = null;
    this.alerted = false;
    this.hitCdT = -99;
  }
  get dead() { return this.state === 'dead'; }

  damage(amount, game, byPlayer) {
    if (this.dead) return;
    this.hp -= amount;
    game.effects.bloodPuff(this.x, this.y);
    if (this.role === 'gunman' || this.role === 'target') { this.hostile = true; this.state = 'fight'; }
    if (this.role === 'walker' || this.role === 'fare') { this.state = 'flee'; this.fleeT = 2.2; }
    if (this.hp <= 0) {
      this.state = 'dead'; this.deadT = 0;
      game.onPedKilled(this, byPlayer);
    }
  }

  moveToward(dt, tx, ty, speed) {
    const desired = Math.atan2(ty - this.y, tx - this.x);
    this.angle += clamp(angleDiff(desired, this.angle), -7 * dt, 7 * dt);
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d > 4) {
      this.x += Math.cos(this.angle) * speed * dt;
      this.y += Math.sin(this.angle) * speed * dt;
    }
    const res = this.world.collideCircle(this.x, this.y, 10, true);
    this.x = res.x; this.y = res.y;
    this.walkPhase += dt * (speed / 16);
    return d;
  }

  update(dt, game) {
    if (this.dead) { this.deadT += dt; return; }
    if (this.state === 'ride') { if (this.riding) { this.x = this.riding.x; this.y = this.riding.y; } return; }
    const player = game.player;
    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    const distPlayer = Math.hypot(px - this.x, py - this.y);
    this.thinkT -= dt;

    if (this.role === 'officer' || ((this.role === 'gunman' || this.role === 'target') && this.hostile)) {
      this.updateFighter(dt, game, px, py, distPlayer);
      return;
    }
    const danger = game.lastDanger;
    if (this.state !== 'flee' && danger && game.time - danger.t < 2.5 && Math.hypot(danger.x - this.x, danger.y - this.y) < 250) {
      this.state = 'flee'; this.fleeT = 1.6 + Math.random();
      this.fleeX = this.x + (this.x - danger.x); this.fleeY = this.y + (this.y - danger.y);
    }
    if (this.state === 'flee') {
      this.fleeT -= dt;
      this.moveToward(dt, this.fleeX, this.fleeY, 215);
      if (this.fleeT <= 0) this.state = 'walk';
      return;
    }
    if (this.role === 'fare') { this.walkPhase += dt * 2; return; }
    if (this.role === 'gunman' || this.role === 'target') { this.walkPhase += dt * 1.4; return; }
    if (this.thinkT <= 0 || Math.hypot(this.destX - this.x, this.destY - this.y) < 14) {
      this.thinkT = 2 + Math.random() * 3;
      for (let tries = 0; tries < 8; tries++) {
        const nx = this.x + (Math.random() - 0.5) * 560, ny = this.y + (Math.random() - 0.5) * 560;
        const t = this.world.tileAtPx(nx, ny);
        if (t === 2 || t === 6 || t === 7 || t === 3) { this.destX = nx; this.destY = ny; break; }
      }
    }
    this.moveToward(dt, this.destX, this.destY, 68);
  }

  updateFighter(dt, game, px, py, distPlayer) {
    const world = this.world;
    const los = distPlayer < 430 && !world.losBlocked(this.x, this.y, px, py);
    let tx = px, ty = py;
    if (distPlayer > 265) { tx = px; ty = py; }
    else if (distPlayer < 120) { tx = this.x + (this.x - px); ty = this.y + (this.y - py); }
    else { tx = this.x + Math.cos(this.angle + Math.PI / 2) * 26; ty = this.y + Math.sin(this.angle + Math.PI / 2) * 26; }
    if (!los || distPlayer > 150) this.moveToward(dt, tx, ty, this.role === 'officer' ? 168 : 138);
    else this.angle += clamp(angleDiff(Math.atan2(py - this.y, px - this.x), this.angle), -9 * dt, 9 * dt);
    this.shootCd -= dt;
    if (los && this.shootCd <= 0) {
      const isOfficer = this.role === 'officer';
      this.burst = isOfficer ? 3 : 2;
      this.shootCd = isOfficer ? 1.15 + Math.random() * 0.5 : 1.5 + Math.random() * 0.7;
    }
    if (this.burst > 0 && los) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstT = 0.13;
        this.burst--;
        const spread = 0.09 + (distPlayer / 430) * 0.08;
        const a = Math.atan2(py - this.y, px - this.x) + (Math.random() - 0.5) * 2 * spread;
        spawnBullet(game, this.x + Math.cos(a) * 14, this.y + Math.sin(a) * 14, a, 'npc', this.role === 'officer' ? 7 : 9);
        game.audio.shootSmg();
      }
    }
  }
}

export function spawnPeds(world, rng, cx, cy, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 10; tries++) {
      const x = cx + rng.range(-950, 950), y = cy + rng.range(-700, 700);
      const t = world.tileAtPx(x, y);
      if (t === 2 || t === 6 || t === 7 || t === 3) { peds.push(new Ped(world, x, y)); break; }
    }
  }
  return peds;
}
