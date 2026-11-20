// Fighting: tracer bullets tested against buildings, cars and people,
// area explosions, and the player's melee swing. Crime reporting stays in
// the game object so every hit is witnessed the same way.

export function spawnBullet(game, x, y, angle, from, damage) {
  game.bullets.push({
    x, y, px: x, py: y,
    vx: Math.cos(angle) * 980, vy: Math.sin(angle) * 980,
    life: 0.62, from, damage, dead: false,
  });
  game.effects.muzzle(x, y, angle);
}

export function updateBullets(dt, game) {
  const world = game.world;
  for (const b of game.bullets) {
    b.px = b.x; b.py = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (world.pointInBuilding(b.x, b.y)) {
      game.effects.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx));
      b.dead = true; continue;
    }
    let consumed = false;
    for (const car of game.vehicles) {
      if (Math.hypot(car.x - b.x, car.y - b.y) < car.radius) {
        if (b.from === 'player' && car === game.player.car) continue;
        car.damage(b.damage * 0.6, game);
        game.effects.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx));
        if (b.from === 'player') {
          if (car.kind === 'police') game.reportCrime('hitCopCar', b.x, b.y, 0.5);
          else game.reportCrime('hitCar', b.x, b.y, 0.4);
        }
        if (game.player.car === car && b.from === 'npc' && Math.random() < 0.4) game.damagePlayer(b.damage * 0.5, 'shot');
        consumed = true; break;
      }
    }
    if (consumed) { b.dead = true; continue; }
    for (const ped of game.peds) {
      if (ped.dead || ped.state === 'ride') continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
        ped.damage(b.damage, game, b.from === 'player');
        if (b.from === 'player' && !ped.dead) game.reportCrime('hitPed', b.x, b.y, 0.45);
        b.dead = true; consumed = true; break;
      }
    }
    if (consumed) continue;
    if (b.from === 'npc' && !game.player.car && Math.hypot(game.player.x - b.x, game.player.y - b.y) < 13) {
      game.damagePlayer(b.damage, 'shot');
      b.dead = true;
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
}

export function explode(game, x, y, radius, damage, byPlayer) {
  game.effects.explosionFx(x, y);
  game.audio.explosion();
  game.setDanger(x, y);
  for (const car of game.vehicles) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < radius + car.radius) car.damage(damage * (1 - d / (radius + car.radius) * 0.6), game);
  }
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) ped.damage(damage * (1 - d / radius * 0.5), game, byPlayer);
  }
  if (!game.player.car) {
    const d = Math.hypot(game.player.x - x, game.player.y - y);
    if (d < radius) game.damagePlayer(damage * 0.7 * (1 - d / radius * 0.5), 'explosion');
  } else {
    const d = Math.hypot(game.player.car.x - x, game.player.car.y - y);
    if (d < radius) game.damagePlayer(damage * 0.3, 'explosion');
  }
  if (byPlayer) game.reportCrime('explosion', x, y, 1);
}

export function meleeSwing(game) {
  const p = game.player;
  const reach = 36;
  const tx = p.x + Math.cos(p.angle) * reach, ty = p.y + Math.sin(p.angle) * reach;
  game.audio.punch();
  for (const ped of game.peds) {
    if (ped.dead || ped.state === 'ride') continue;
    if (Math.hypot(ped.x - tx, ped.y - ty) < 24) {
      ped.x += Math.cos(p.angle) * 14; ped.y += Math.sin(p.angle) * 14;
      ped.damage(16, game, true);
      game.audio.hitFlesh();
      if (!ped.dead && ped.role !== 'officer') game.reportCrime('punchPed', ped.x, ped.y, 1);
      return true;
    }
  }
  return false;
}
