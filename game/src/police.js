// Coral Bay PD response: a wanted-points meter that rises for witnessed
// crime and decays while nobody can see the player, plus the units that
// answer it — pursuit Interceptors, foot officers and high-heat roadblocks.

import { COPS_BY_STARS } from './config.js';
import { Vehicle, placeOnRoad, driveInputsToward } from './vehicles.js';
import { Ped } from './people.js';

export class Wanted {
  constructor() {
    this.points = 0;
    this.unseenT = 0;
    this.lastSeenX = 0; this.lastSeenY = 0;
  }
  get level() { return Math.max(0, Math.min(5, Math.round(this.points))); }
  add(n) { this.points = Math.min(5.6, this.points + n); }
  clear() { this.points = 0; }
  update(dt, game) {
    let seen = false;
    const px = game.player.car ? game.player.car.x : game.player.x;
    const py = game.player.car ? game.player.car.y : game.player.y;
    for (const car of game.vehicles) {
      if (car.kind !== 'police' || car.dead) continue;
      const d = Math.hypot(car.x - px, car.y - py);
      if (d < 580 && !game.world.losBlocked(car.x, car.y, px, py)) { seen = true; break; }
    }
    if (!seen) for (const ped of game.peds) {
      if (ped.role !== 'officer' || ped.dead) continue;
      if (Math.hypot(ped.x - px, ped.y - py) < 430 && !game.world.losBlocked(ped.x, ped.y, px, py)) { seen = true; break; }
    }
    if (seen) {
      this.unseenT = 0;
      this.lastSeenX = px; this.lastSeenY = py;
    } else {
      this.unseenT += dt;
      if (this.unseenT > 5 && this.points > 0) this.points = Math.max(0, this.points - dt * 0.11);
    }
    if (game.heatFloor > 0) this.points = Math.max(this.points, game.heatFloor);
    return seen;
  }
}

export class PoliceManager {
  constructor() {
    this.spawnCd = 0;
    this.roadblockCd = 14;
    this.roadblockCars = [];
  }
  cars(game) { return game.vehicles.filter((v) => v.kind === 'police' && !v.roadblock); }

  update(dt, game) {
    const wanted = game.wanted;
    const level = wanted.level;
    const px = game.player.car ? game.player.car.x : game.player.x;
    const py = game.player.car ? game.player.car.y : game.player.y;
    this.spawnCd -= dt;
    const mine = this.cars(game);
    if (level > 0 && mine.length < COPS_BY_STARS[level] && this.spawnCd <= 0) {
      this.spawnCd = 1.1;
      const node = game.world.randomRoadPoint(game.rng, px, py, 640, 980);
      if (node && Math.hypot(node.x - px, node.y - py) > 520) {
        const car = new Vehicle(game.world, 'interceptor', node.x, node.y, 0, { kind: 'police', color: '#18222e' });
        placeOnRoad(game.world, game.rng, car, node);
        car.cruiseSpeed = 300;
        game.vehicles.push(car);
      }
    }
    for (const car of [...game.vehicles]) {
      if (car.kind !== 'police') continue;
      const d = Math.hypot(car.x - px, car.y - py);
      if (d > 1600 || (level === 0 && d > 700)) this.removeCar(game, car);
    }
    for (const car of this.cars(game)) this.updateCopCar(car, dt, game, px, py);
    this.updateRoadblocks(dt, game, px, py);
    for (const ped of [...game.peds]) {
      if (ped.role !== 'officer' || ped.dead) continue;
      const d = Math.hypot(ped.x - px, ped.y - py);
      if (level === 0 || d > 1250 || (game.player.car && d > 520)) {
        game.peds.splice(game.peds.indexOf(ped), 1);
        if (ped.ownerCar) ped.ownerCar.officersOut = Math.max(0, (ped.ownerCar.officersOut || 0) - 1);
      }
    }
  }

  removeCar(game, car) {
    const i = game.vehicles.indexOf(car);
    if (i >= 0) game.vehicles.splice(i, 1);
    for (const ped of [...game.peds]) if (ped.ownerCar === car && !ped.dead) game.peds.splice(game.peds.indexOf(ped), 1);
  }

  updateCopCar(car, dt, game, px, py) {
    if (car.dead) return;
    const world = game.world;
    const distP = Math.hypot(px - car.x, py - car.y);
    const los = distP < 430 && !world.losBlocked(car.x, car.y, px, py);
    const seen = game.wanted.unseenT < 2;
    let gx, gy, targetSpeed = 300, stopAt = false;
    if (los || (seen && distP < 340)) {
      const lead = game.player.car ? 0.35 : 0;
      gx = px + (game.player.car ? game.player.car.vx * lead : 0);
      gy = py + (game.player.car ? game.player.car.vy * lead : 0);
      targetSpeed = 415;
      if (!game.player.car && distP < 95) { stopAt = true; targetSpeed = 0; }
    } else {
      const tx = seen ? px : game.wanted.lastSeenX || px;
      const ty = seen ? py : game.wanted.lastSeenY || py;
      const rp = world.nearestRoadPoint(tx, ty);
      const myNode = world.nearestNode(car.x, car.y);
      let best = null, bd = Infinity;
      for (const k of myNode.next) {
        const n = world.nodes.get(k);
        const d = Math.hypot(n.x - rp.x, n.y - rp.y);
        if (d < bd) { bd = d; best = n; }
      }
      const nearTarget = Math.hypot(rp.x - car.x, rp.y - car.y) < 130;
      gx = nearTarget ? rp.x : (best ? best.x : rp.x);
      gy = nearTarget ? rp.y : (best ? best.y : rp.y);
      targetSpeed = seen ? 330 : 215;
    }
    const { throttle, steer } = driveInputsToward(car, gx, gy, dt, { targetSpeed, stopAtTarget: stopAt });
    car.driveStep(dt, game, throttle, steer, false);
    car.officersOut = car.officersOut || 0;
    if (!game.player.car && game.wanted.level >= 2 && distP < 120 && distP > 26 && car.officersOut < 2 && car.speed() < 60) {
      for (let i = 0; i < 2; i++) {
        const off = new Ped(world, car.x + Math.cos(car.angle + i * 2.4) * 26, car.y + Math.sin(car.angle + i * 2.4) * 26,
          { role: 'officer', hostile: true, ownerCar: car, shirt: '#22406b' });
        game.peds.push(off);
        car.officersOut++;
      }
    }
  }

  updateRoadblocks(dt, game, px, py) {
    this.roadblockCd -= dt;
    for (const car of [...this.roadblockCars]) {
      if (Math.hypot(car.x - px, car.y - py) > 900 || game.wanted.level < 3) {
        this.removeCar(game, car);
        this.roadblockCars.splice(this.roadblockCars.indexOf(car), 1);
      }
    }
    if (game.wanted.level >= 4 && game.player.car && this.roadblockCd <= 0 && this.roadblockCars.length === 0) {
      this.roadblockCd = 26;
      const ahead = game.world.nearestRoadPoint(px + game.player.car.vx * 1.6, py + game.player.car.vy * 1.6);
      for (let i = 0; i < 2; i++) {
        const car = new Vehicle(game.world, 'interceptor', ahead.x + i * 44 - 22, ahead.y + (i % 2) * 30 - 15, Math.PI / 2 + i * 0.35, { kind: 'police', color: '#18222e' });
        car.roadblock = true;
        game.vehicles.push(car);
        this.roadblockCars.push(car);
        const off = new Ped(game.world, car.x + 30, car.y + 10, { role: 'officer', hostile: true, ownerCar: car, shirt: '#22406b' });
        game.peds.push(off);
      }
      game.toast('Roadblock ahead!');
    }
  }
}
