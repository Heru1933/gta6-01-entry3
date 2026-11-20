// Rendering: the tile city, signed flat-shaded buildings, palms and lamps,
// cars with strobing police light bars, people, tracers, objective pillars,
// and the full day cycle — dawn, noon, coral dusk and a night pass with
// lamp, headlight and police glow.

import { TILE, WORLD_W, WORLD_H } from './config.js';
import { T } from './world.js';
import { clamp, lerp } from './random.js';

export function daylight(hour) {
  const seg = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  let light, warm = 0;
  if (hour < 5) light = 0.08;
  else if (hour < 8) { light = lerp(0.08, 1, seg(5, 8, hour)); warm = 1 - seg(6.5, 8.5, hour); }
  else if (hour < 17.5) light = 1;
  else if (hour < 20.5) { light = lerp(1, 0.1, seg(17.5, 20.5, hour)); warm = seg(17.5, 19, hour) * (1 - seg(19.5, 21, hour)); }
  else light = 0.08;
  return { light, warm };
}

function tileHash(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }

const TILE_FILL = {
  [T.GRASS]: '#5d8a48', [T.ROAD]: '#3c4147', [T.WALK]: '#b9b0a0', [T.BLOCK]: '#a49a88',
  [T.SAND]: '#ecd9a0', [T.PARK]: '#4c7a3e', [T.PLAZA]: '#b5aa97', [T.RUNWAY]: '#33373c', [T.DOCK]: '#8a6f4d',
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawGround(ctx, game, view) {
  const world = game.world;
  const x0 = Math.max(0, Math.floor(view.x / TILE)), x1 = Math.min(99, Math.ceil((view.x + view.w) / TILE));
  const y0 = Math.max(0, Math.floor(view.y / TILE)), y1 = Math.min(79, Math.ceil((view.y + view.h) / TILE));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = world.tileAt(tx, ty);
    const px = tx * TILE, py = ty * TILE;
    if (t === T.WATER) {
      const w = 0.5 + 0.5 * Math.sin(game.time * 1.4 + (tx * 0.7 + ty * 1.1));
      ctx.fillStyle = 'rgb(' + Math.round(28 + w * 14) + ',' + Math.round(96 + w * 22) + ',' + Math.round(138 + w * 26) + ')';
      ctx.fillRect(px, py, TILE + 1, TILE + 1);
      continue;
    }
    ctx.fillStyle = TILE_FILL[t] || '#888';
    if (t === T.GRASS || t === T.PARK) { const v = tileHash(tx, ty) * 14 - 7; ctx.fillStyle = shade(TILE_FILL[t], v); }
    ctx.fillRect(px, py, TILE + 1, TILE + 1);
    if (t === T.ROAD) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      if (ty % 2 === 0) ctx.fillRect(px, py, TILE, 2);
    }
    if (t === T.RUNWAY && tx % 4 === 0) { ctx.fillStyle = '#e8e4da'; ctx.fillRect(px + 6, py + TILE / 2 - 2, 22, 4); }
    if (t === T.DOCK) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px, py, TILE, 3); }
  }
  ctx.fillStyle = '#d8c95e';
  for (const ax of [400, 1200, 2000, 2800, 3600]) {
    if (ax < view.x - 10 || ax > view.x + view.w + 10) continue;
    for (let y = Math.floor(view.y / 56) * 56; y < view.y + view.h; y += 56) ctx.fillRect(ax - 2, y, 4, 30);
  }
  for (const sy of [400, 1200, 2000, 2800]) {
    if (sy < view.y - 10 || sy > view.y + view.h + 10) continue;
    for (let x = Math.floor(view.x / 56) * 56; x < view.x + view.w; x += 56) ctx.fillRect(x, sy - 2, 30, 4);
  }
}

function drawBuildings(ctx, game, view) {
  ctx.save();
  for (const b of game.world.buildings) {
    if (b.x + b.w < view.x || b.x > view.x + view.w || b.y + b.h < view.y || b.y > view.y + view.h) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 9, b.y + 11, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const inset = 7 + (b.floors % 3) * 2;
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(b.x + inset + 6, b.y + inset + 6, Math.max(8, b.w * 0.2), Math.max(6, b.h * 0.14));
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const ac = 12 + (b.floors % 4) * 5;
    ctx.fillRect(b.x + b.w - inset - ac - 6, b.y + b.h - inset - ac - 6, ac, ac);
    if (b.name) {
      ctx.font = '800 12.5px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10,14,18,0.85)';
      const tw = ctx.measureText(b.name).width + 14;
      ctx.fillRect(b.x + b.w / 2 - tw / 2, b.y + 3, tw, 17);
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + 16);
    }
  }
  ctx.restore();
}

function drawNature(ctx, game, view) {
  for (const c of game.world.crates) {
    if (c.x < view.x - 40 || c.x > view.x + view.w + 40 || c.y < view.y - 40 || c.y > view.y + view.h + 40) continue;
    ctx.fillStyle = '#9a743f'; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h); ctx.moveTo(c.x + c.w, c.y); ctx.lineTo(c.x, c.y + c.h); ctx.stroke();
  }
  for (const t of game.world.trees) {
    if (t.x < view.x - 50 || t.x > view.x + view.w + 50 || t.y < view.y - 50 || t.y > view.y + view.h + 50) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(t.x + 5, t.y + 7, 13 * t.s, 6 * t.s, 0, 0, Math.PI * 2); ctx.fill();
    if (t.kind === 'palm') {
      ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(t.x, t.y + 6); ctx.quadraticCurveTo(t.x + 3, t.y - 4, t.x + 5, t.y - 12 * t.s); ctx.stroke();
      ctx.strokeStyle = '#3f7d33'; ctx.lineWidth = 2.6;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        ctx.beginPath(); ctx.moveTo(t.x + 5, t.y - 12 * t.s);
        ctx.quadraticCurveTo(t.x + 5 + Math.cos(a) * 11 * t.s, t.y - 12 * t.s + Math.sin(a) * 6 - 3, t.x + 5 + Math.cos(a) * 17 * t.s, t.y - 12 * t.s + Math.sin(a) * 10 + 4);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#8a6a42'; ctx.fillRect(t.x - 2, t.y - 2, 4, 9);
      ctx.fillStyle = '#3e7a34';
      for (const [ox, oy, r] of [[0, -8, 11], [-8, -3, 8], [8, -3, 8]]) { ctx.beginPath(); ctx.arc(t.x + ox * t.s, t.y + oy * t.s, r * t.s, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.arc(t.x - 3 * t.s, t.y - 11 * t.s, 5 * t.s, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#5a5148';
  for (const l of game.world.lamps) {
    if (l.x < view.x - 20 || l.x > view.x + view.w + 20 || l.y < view.y - 20 || l.y > view.y + view.h + 20) continue;
    ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawVehicle(ctx, game, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(4, 6, car.len * 0.52, car.wid * 0.58, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(car.angle);
  const L = car.len, W = car.wid;
  ctx.fillStyle = '#14161a';
  const ww = 9, wh = 5;
  for (const [wx, wy] of [[L * 0.3, -W / 2 - 1], [L * 0.3, W / 2 - wh + 1], [-L * 0.3, -W / 2 - 1], [-L * 0.3, W / 2 - wh + 1]])
    ctx.fillRect(wx - ww / 2, wy, ww, wh);
  ctx.fillStyle = car.dead ? '#2c2c30' : car.color;
  roundRectPath(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRectPath(ctx, -L / 2 + 3, -W / 2 + 3, L - 6, W / 2 - 3, 5); ctx.fill();
  ctx.fillStyle = '#1d2733';
  roundRectPath(ctx, -L * 0.16, -W / 2 + 4.5, L * 0.4, W - 9, 4); ctx.fill();
  ctx.fillStyle = '#7fb6cf';
  roundRectPath(ctx, L * 0.13, -W / 2 + 5.5, L * 0.09, W - 11, 3); ctx.fill();
  ctx.fillStyle = 'rgba(20,26,34,0.9)';
  roundRectPath(ctx, -L * 0.2, -W / 2 + 5.5, L * 0.07, W - 11, 3); ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#eef1f4';
    ctx.fillRect(-L * 0.13, -W / 2 + 2, L * 0.34, 5);
    ctx.fillRect(-L * 0.13, W / 2 - 7, L * 0.34, 5);
    const phase = Math.floor(game.time * 5 + car.id) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#5e1f1a';
    ctx.fillRect(-7, -W / 2 + 6, 7, W / 2 - 6);
    ctx.fillStyle = phase ? '#274b8f' : '#3f8cff';
    ctx.fillRect(0, 0, 7, W / 2 - 6);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-7.5, -2, 15, 4);
  }
  if (car.typeKey === 'cab') {
    ctx.fillStyle = '#12222e';
    roundRectPath(ctx, -8, -7, 16, 14, 3); ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = '800 8px Arial'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.typeKey === 'bancroft') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '800 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText('BANCROFT', 0, -W / 4);
    ctx.fillText('BANCROFT', 0, W / 4 + 7);
  }
  if (car.health < 45 && !car.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(L * 0.32, 0, 6 + (100 - car.health) * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawPed(ctx, game, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(1.5, 3, 8, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  if (ped.dead) {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 6, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.skin; ctx.beginPath(); ctx.arc(0, -12, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const swing = Math.sin(ped.walkPhase * 6) * 4;
  ctx.strokeStyle = ped.pants; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  const fx = Math.cos(ped.angle), fy = Math.sin(ped.angle);
  const rx = -fy, ry = fx;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(rx * 3 + fx * swing, ry * 3 + fy * swing);
  ctx.moveTo(0, 0); ctx.lineTo(-rx * 3 - fx * swing, -ry * 3 - fy * swing);
  ctx.stroke();
  ctx.fillStyle = ped.role === 'officer' ? '#22406b' : ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(fx * 2.4, fy * 2.4, 4.6, 0, Math.PI * 2); ctx.fill();
  if (ped.role === 'officer') {
    ctx.fillStyle = '#16283f';
    ctx.beginPath(); ctx.arc(fx * 2.4, fy * 2.4, 4.8, Math.atan2(fy, fx) - 1.9, Math.atan2(fy, fx) + 1.9); ctx.fill();
  }
  if ((ped.role === 'gunman' || ped.role === 'target' || ped.role === 'officer') && (ped.hostile || ped.role === 'officer')) {
    ctx.strokeStyle = '#191c20'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx * 6, fy * 6); ctx.lineTo(fx * 17, fy * 17); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  if (ped.role === 'fare' && ped.state !== 'ride') {
    const bob = Math.sin(game.time * 4 + ped.id) * 3;
    ctx.font = '900 17px "Segoe UI", Arial'; ctx.fillStyle = '#8dff6e';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 3.5;
    ctx.strokeText('$', ped.x, ped.y - 20 + bob); ctx.fillText('$', ped.x, ped.y - 20 + bob);
  }
  if (ped.role === 'target' && !ped.dead) {
    ctx.font = '700 11px "Segoe UI", Arial'; ctx.fillStyle = '#ff8a75';
    ctx.fillText(ped.name || 'TARGET', ped.x, ped.y - 16);
  }
  ctx.restore();
}

export function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.car || p.hidden) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(1.5, 3, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  const swing = Math.sin(p.walkPhase * 6) * 4.4;
  const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
  const rx = -fy, ry = fx;
  ctx.strokeStyle = '#263238'; ctx.lineWidth = 3.8; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(rx * 3.4 + fx * swing, ry * 3.4 + fy * swing);
  ctx.moveTo(0, 0); ctx.lineTo(-rx * 3.4 - fx * swing, -ry * 3.4 - fy * swing);
  ctx.stroke();
  ctx.fillStyle = '#0e7c86';
  ctx.beginPath(); ctx.arc(0, 0, 8.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(fx * 2.6, fy * 2.6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242a';
  ctx.beginPath(); ctx.arc(fx * 1.2, fy * 1.2, 5.1, Math.atan2(fy, fx) + 0.7, Math.atan2(fy, fx) + Math.PI * 2 - 0.7); ctx.fill();
  if (p.weapon !== 'fist') {
    ctx.strokeStyle = '#14161a'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(fx * 6, fy * 6); ctx.lineTo(fx * (p.weapon === 'smg' ? 21 : 17), fy * (p.weapon === 'smg' ? 21 : 17)); ctx.stroke();
  }
  ctx.restore();
}

function drawMarker(ctx, game, x, y, color, label) {
  const pulse = 0.75 + 0.25 * Math.sin(game.time * 5);
  const grad = ctx.createLinearGradient(0, y - 190, 0, y);
  grad.addColorStop(0, 'rgba(255,217,77,0)');
  grad.addColorStop(1, color.replace('A', String(0.34 * pulse)));
  ctx.fillStyle = grad;
  ctx.fillRect(x - 13, y - 190, 26, 190);
  ctx.strokeStyle = color.replace('A', '0.9');
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(x, y, 26 * pulse + 8, 11 * pulse + 4, 0, 0, Math.PI * 2); ctx.stroke();
  if (label) {
    ctx.font = '800 12px "Segoe UI", Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
    ctx.strokeText(label, x, y - 200); ctx.fillText(label, x, y - 200);
  }
}

export function drawScene(ctx, game, view) {
  ctx.fillStyle = '#20303c';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  drawGround(ctx, game, view);
  game.effects.drawSkids(ctx);
  drawNature(ctx, game, view);
  drawBuildings(ctx, game, view);
  const m = game.currentMarker();
  if (m) drawMarker(ctx, game, m.x, m.y, m.color, m.label);
  for (const car of game.vehicles) {
    if (car.x < view.x - 90 || car.x > view.x + view.w + 90 || car.y < view.y - 90 || car.y > view.y + view.h + 90) continue;
    drawVehicle(ctx, game, car);
  }
  for (const ped of game.peds) {
    if (ped.state === 'ride') continue;
    if (ped.x < view.x - 40 || ped.x > view.x + view.w + 40 || ped.y < view.y - 40 || ped.y > view.y + view.h + 40) continue;
    drawPed(ctx, game, ped);
  }
  drawPlayer(ctx, game);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,232,160,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (const b of game.bullets) { ctx.moveTo(b.px, b.py); ctx.lineTo(b.x, b.y); }
  ctx.stroke();
  ctx.restore();
  game.effects.drawWorld(ctx);
  drawLighting(ctx, game, view);
}

function drawLighting(ctx, game, view) {
  const { light, warm } = daylight(game.timeOfDay);
  if (warm > 0.02 && light > 0.2) {
    ctx.fillStyle = 'rgba(255,120,50,' + (warm * 0.10).toFixed(3) + ')';
    ctx.fillRect(view.x, view.y, view.w, view.h);
  }
  const dark = (1 - light) * 0.62;
  if (dark <= 0.02) { drawFlash(ctx, game, view); return; }
  ctx.fillStyle = 'rgba(10,14,44,' + dark.toFixed(3) + ')';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, color.replace('A', String(a)));
    g.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const l of game.world.lamps) {
    if (l.x < view.x - 90 || l.x > view.x + view.w + 90 || l.y < view.y - 90 || l.y > view.y + view.h + 90) continue;
    glow(l.x, l.y, 74, 'rgba(255,196,92,A)', 0.30 * (1 - light) + 0.06);
  }
  for (const car of game.vehicles) {
    if (car.dead) continue;
    if (car.x < view.x - 160 || car.x > view.x + view.w + 160 || car.y < view.y - 160 || car.y > view.y + view.h + 160) continue;
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    glow(car.x + fx * car.len * 0.62, car.y + fy * car.len * 0.62, 88, 'rgba(255,240,190,A)', 0.20);
    if (car.kind === 'police') {
      const phase = Math.floor(game.time * 5 + car.id) % 2 === 0;
      glow(car.x, car.y, 95, phase ? 'rgba(255,60,44,A)' : 'rgba(64,140,255,A)', 0.30);
    }
  }
  const p = game.player;
  glow(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y, 120, 'rgba(255,220,150,A)', 0.10);
  ctx.restore();
  drawFlash(ctx, game, view);
}

function drawFlash(ctx, game, view) {
  if (game.effects.flash > 0.01) {
    ctx.fillStyle = 'rgba(255,240,210,' + (game.effects.flash * 0.5).toFixed(3) + ')';
    ctx.fillRect(view.x, view.y, view.w, view.h);
  }
}

export { WORLD_W, WORLD_H };
