// Vehicles: an arcade driving model that splits velocity into forward and
// sideways parts (grip eats the sideways part, the handbrake preserves it),
// graph-following traffic that brakes and honks, and parked cars to steal.

import { VEHICLE_TYPES, TRAFFIC_TYPES } from './config.js';
import { clamp, angleDiff } from './random.js';

let NEXT_ID = 1;

export class Vehicle {
  constructor(world, typeKey, x, y, angle, opts = {}) {
    this.id = NEXT_ID++;
    this.world = world;
    this.typeKey = typeKey;
    this.type = VEHICLE_TYPES[typeKey];
    this.name = this.type.name;
    this.x = x; this.y = y; this.angle = angle;
    this.vx = 0; this.vy = 0;
    this.len = this.type.h; this.wid = this.type.w;
    this.radius = this.len * 0.44;
    this.color = opts.color || (opts.rng ? opts.rng.pick(this.type.colors) : this.type.colors[0]);
    this.kind = opts.kind || 'parked';
    this.health = 100;
    this.dead = false;
    this.fromKey = null; this.toKey = null;
    this.blockedTime = 0;
    this.honkCd = 0;
    this.missionTag = opts.missionTag || null;
    this.occupant = null;
    this.wheelSpin = 0;
    this.sliding = false;
  }
  speed() { return Math.hypot(this.vx, this.vy); }
  forwardSpeed() { return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle); }

  driveStep(dt, game, throttle, steer, handbrake) {
    const t = this.type;
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const rx = -fy, ry = fx;
    let vf = this.vx * fx + this.vy * fy;
    let vr = this.vx * rx + this.vy * ry;
    if (throttle > 0) vf += t.accel * throttle * dt * (vf < t.maxSpeed ? 1 : 0);
    else if (throttle < 0) vf += (vf > 12 ? -t.accel * 1.5 : t.accel * 0.55) * throttle * dt;
    const tile = this.world.tileAtPx(this.x, this.y);
    const surfaceDrag = tile === 0 || tile === 6 ? 0.55 : tile === 4 ? 0.8 : 0.22;
    vf -= vf * surfaceDrag * dt;
    if (!throttle) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 26 * dt);
    vf = clamp(vf, -t.maxSpeed * 0.38, t.maxSpeed);
    const steerAuthority = clamp(Math.abs(vf) / 60, 0, 1) * (handbrake ? 1.5 : 1);
    this.angle += steer * t.grip * 0.62 * steerAuthority * dt * (vf >= 0 ? 1 : -1);
    const gripRate = handbrake ? 1.6 : 7.5;
    vr *= Math.exp(-gripRate * dt);
    if (handbrake) vf -= vf * 1.15 * dt;
    const nfx = Math.cos(this.angle), nfy = Math.sin(this.angle);
    const nrx = -nfy, nry = nfx;
    this.vx = nfx * vf + nrx * vr;
    this.vy = nfy * vf + nry * vr;
    const px = this.x, py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const res = this.world.collideCircle(this.x, this.y, this.radius * 0.82, true);
    let impact = 0;
    if (res.hit) {
      const intoX = this.x - res.x, intoY = this.y - res.y;
      this.x = res.x; this.y = res.y;
      impact = Math.abs(this.vx * intoX + this.vy * intoY) / Math.max(1, Math.hypot(intoX, intoY));
      const nx = intoX, ny = intoY; const nl = Math.hypot(nx, ny) || 1;
      const dot = (this.vx * nx + this.vy * ny) / nl;
      if (dot > 0) { this.vx -= (nx / nl) * dot; this.vy -= (ny / nl) * dot; }
      if (impact > 130) game.onVehicleCrash(this, impact, px, py);
    }
    this.sliding = Math.abs(vr) > 55 || (handbrake && Math.abs(vf) > 60);
    this.wheelSpin += vf * dt;
    return impact;
  }

  damage(amount, game) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0; this.dead = true;
      game.onVehicleDestroyed(this);
    }
  }
}

export function driveInputsToward(car, tx, ty, dt, opts = {}) {
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(desired, car.angle);
  const steer = clamp(diff * 2.4, -1, 1);
  const distT = Math.hypot(tx - car.x, ty - car.y);
  let target = (opts.cruise || 200);
  if (Math.abs(diff) > 0.6) target *= 0.45;
  if (opts.targetSpeed !== undefined) target = opts.targetSpeed;
  const vf = car.forwardSpeed();
  let throttle = 0;
  if (vf < target) throttle = 1;
  else if (vf > target + 30) throttle = -0.5;
  if (distT < 30 && opts.stopAtTarget) throttle = vf > 10 ? -0.8 : 0;
  return { throttle, steer };
}

export function trafficGuidePoint(world, car) {
  const from = world.nodes.get(car.fromKey), to = world.nodes.get(car.toKey);
  if (!from || !to) return { x: car.x, y: car.y };
  const ex = to.x - from.x, ey = to.y - from.y;
  const el = Math.hypot(ex, ey) || 1;
  const ux = ex / el, uy = ey / el;
  const rx = -uy, ry = ux;
  const along = clamp((car.x - from.x) * ux + (car.y - from.y) * uy, 0, el);
  const look = Math.min(el, along + 95);
  return { x: from.x + ux * look + rx * 40, y: from.y + uy * look + ry * 40, atNode: along > el - 52 };
}

export function pickNextEdge(world, rng, car) {
  const node = world.nodes.get(car.toKey);
  if (!node) return;
  const options = node.next.filter((k) => k !== car.fromKey);
  const nextKey = options.length ? rng.pick(options) : car.fromKey;
  car.fromKey = car.toKey;
  car.toKey = nextKey;
}

export function placeOnRoad(world, rng, car, node) {
  const nextKey = rng.pick(node.next);
  const target = world.nodes.get(nextKey);
  car.x = node.x; car.y = node.y;
  car.fromKey = node.x + ',' + node.y;
  car.toKey = nextKey;
  car.angle = Math.atan2(target.y - node.y, target.x - node.x);
  const g = trafficGuidePoint(world, car);
  car.x = g.x; car.y = g.y;
  car.vx = 0; car.vy = 0;
}

export function updateTrafficCar(car, dt, game) {
  if (car.dead) { car.vx *= 0.9; car.vy *= 0.9; return; }
  const world = game.world;
  const guide = trafficGuidePoint(world, car);
  if (guide.atNode) pickNextEdge(world, game.rng, car);
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const ahead = 52 + car.speed() * 0.34;
  const ax = car.x + fx * ahead, ay = car.y + fy * ahead;
  let blocked = false;
  for (const other of game.vehicles) {
    if (other === car) continue;
    if (Math.hypot(other.x - ax, other.y - ay) < other.radius + 16) { blocked = true; break; }
  }
  if (!blocked && Math.hypot(game.player.x - ax, game.player.y - ay) < 30 && !game.player.car) blocked = true;
  if (!blocked) for (const ped of game.peds) {
    if (Math.hypot(ped.x - ax, ped.y - ay) < 22) { blocked = true; break; }
  }
  let { throttle, steer } = driveInputsToward(car, guide.x, guide.y, dt, { cruise: car.cruiseSpeed || 195 });
  if (blocked) {
    throttle = car.forwardSpeed() > 30 ? -0.85 : 0;
    car.blockedTime += dt;
    car.honkCd -= dt;
    if (car.blockedTime > 1.4 && car.honkCd <= 0) { game.audio.horn(); car.honkCd = 2.6; }
  } else car.blockedTime = 0;
  car.driveStep(dt, game, throttle, steer, false);
}

export function spawnTrafficCar(world, rng, cx, cy) {
  const node = world.randomRoadPoint(rng, cx, cy, 500, 1050);
  if (!node) return null;
  const typeKey = rng.pick(TRAFFIC_TYPES);
  const car = new Vehicle(world, typeKey, node.x, node.y, 0, { kind: 'traffic', rng });
  car.cruiseSpeed = rng.range(165, 225);
  placeOnRoad(world, rng, car, node);
  return car;
}

export function spawnParkedCars(world, rng) {
  const cars = [];
  for (const spot of world.parkedSpots) {
    if (rng.chance(0.22)) continue;
    const typeKey = rng.pick(TRAFFIC_TYPES);
    const car = new Vehicle(world, typeKey, spot.x + rng.range(-4, 4), spot.y + rng.range(-4, 4), spot.angle + rng.range(-0.05, 0.05), { kind: 'parked', rng });
    cars.push(car);
  }
  return cars;
}
