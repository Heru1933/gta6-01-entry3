// Heads-up display: health/armour bars, cash, wanted stars, clock, weapon
// readout, objective line, prompts, toasts, banners, dialogue, the gun-shop
// panel, pause stats — and a live minimap painted from the tile world.

import { WORLD_W, WORLD_H, SHOP_PRICES } from './config.js';
import { T } from './world.js';

const $ = (id) => document.getElementById(id);

const MAP_COLORS = {
  [T.GRASS]: '#476b38', [T.ROAD]: '#565d64', [T.WALK]: '#8f8674', [T.BLOCK]: '#6f6656',
  [T.SAND]: '#d9c384', [T.WATER]: '#1d5f86', [T.PARK]: '#3c6331', [T.PLAZA]: '#7d7462',
  [T.RUNWAY]: '#3a3f45', [T.DOCK]: '#6e573d',
};

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), health: $('healthfill'), armor: $('armorfill'), cash: $('cash'),
      stars: $('stars'), clock: $('clock'), weapon: $('weapon'), speedo: $('speedo'),
      objective: $('objective'), objectiveText: $('objective-text'), prompt: $('prompt'),
      toast: $('toast'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
      dialogue: $('dialogue'), dlgWho: $('dlg-who'), dlgText: $('dlg-text'),
      minimap: $('minimap'), menu: $('menu'), pause: $('pause'), shop: $('shop'),
      wasted: $('wasted'), complete: $('complete'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastT = 0;
    this.bannerT = 0;
    this.onBuy = null;
    this.lastObjective = '';
  }

  showGameUI(on) {
    this.el.hud.classList.toggle('hidden', !on);
    if (!on) { this.el.objective.classList.add('hidden'); this.el.prompt.classList.add('hidden'); }
  }
  toast(msg, seconds = 3.2) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.remove('hidden');
    this.toastT = seconds;
  }
  banner(title, sub = '', seconds = 3.4) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub;
    this.el.banner.classList.remove('hidden');
    this.bannerT = seconds;
  }
  setDialogue(line) {
    if (!line) { this.el.dialogue.classList.add('hidden'); return; }
    this.el.dlgWho.textContent = line.who;
    this.el.dlgText.textContent = line.text;
    this.el.dialogue.classList.remove('hidden');
  }
  setPrompt(html) {
    if (!html) { this.el.prompt.classList.add('hidden'); return; }
    this.el.prompt.innerHTML = html;
    this.el.prompt.classList.remove('hidden');
  }

  update(dt, game) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.classList.add('hidden'); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.el.banner.classList.add('hidden'); }
    const p = game.player;
    this.el.health.style.width = Math.max(0, p.hp) + '%';
    this.el.armor.style.width = Math.max(0, p.armor) + '%';
    this.el.cash.textContent = '$' + game.cash.toLocaleString('en-US');
    const lvl = game.wanted.level;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < lvl ? '★' : '<span class="off">★</span>';
    this.el.stars.innerHTML = stars;
    const hh = Math.floor(game.timeOfDay), mm = Math.floor((game.timeOfDay - hh) * 60);
    this.el.clock.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    const wname = { fist: 'FISTS', pistol: 'PISTOL', smg: 'SMG' }[p.weapon];
    let ammo = '';
    if (p.weapon !== 'fist') ammo = '  ' + p.magIn + ' / ' + p.ammo[p.weapon];
    this.el.weapon.textContent = wname + ammo + (p.reloading ? '  RELOADING…' : '');
    if (p.car) {
      this.el.speedo.classList.remove('hidden');
      this.el.speedo.textContent = Math.round(Math.abs(p.car.forwardSpeed()) * 0.36) + ' km/h';
    } else this.el.speedo.classList.add('hidden');
    const obj = game.objectiveText();
    if (obj !== this.lastObjective) {
      this.lastObjective = obj;
      this.el.objectiveText.textContent = obj;
      this.el.objective.classList.toggle('hidden', !obj);
    }
    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const W = 232, H = 174;
    const sx = W / WORLD_W, sy = H / WORLD_H;
    for (let ty = 0; ty < 80; ty += 2) for (let tx = 0; tx < 100; tx += 2) {
      ctx.fillStyle = MAP_COLORS[game.world.tileAt(tx, ty)] || '#555';
      ctx.fillRect(tx * 40 * sx, ty * 40 * sy, 40 * 2 * sx + 1, 40 * 2 * sy + 1);
    }
    ctx.fillStyle = 'rgba(240,235,220,0.5)';
    for (const b of game.world.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(1.6, b.w * sx), Math.max(1.6, b.h * sy));
    const blip = (x, y, color, size) => { ctx.fillStyle = color; ctx.fillRect(x * sx - size / 2, y * sy - size / 2, size, size); };
    const phase = Math.floor(game.time * 3) % 2 === 0;
    for (const car of game.vehicles) if (car.kind === 'police' && !car.dead) blip(car.x, car.y, phase ? '#3f8cff' : '#ff5040', 4.4);
    for (const ped of game.peds) if (ped.role === 'fare' && ped.state !== 'ride' && !ped.dead) blip(ped.x, ped.y, '#8dff6e', 4);
    const m = game.currentMarker();
    if (m) {
      const s = 7 + Math.sin(game.time * 5) * 1.6;
      ctx.save();
      ctx.translate(m.x * sx, m.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = m.mapColor || '#ffd94d';
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
    const p = game.player;
    const px = (p.car ? p.car.x : p.x) * sx, py = (p.car ? p.car.y : p.y) * sy;
    const ang = p.car ? p.car.angle : p.angle;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4.4, -4); ctx.lineTo(-4.4, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  openShop(game) {
    const p = game.player;
    $('shop-cash').textContent = 'Your cash: $' + game.cash.toLocaleString('en-US');
    const items = [];
    items.push({ key: 'armor', label: 'Body armour (full)', price: SHOP_PRICES.armor, can: p.armor < 100 && game.cash >= SHOP_PRICES.armor });
    items.push({ key: 'pistolAmmo', label: 'Pistol ammo ×24', price: SHOP_PRICES.pistolAmmo, can: game.cash >= SHOP_PRICES.pistolAmmo });
    if (game.flags.smgUnlocked && !p.weaponsOwned.smg) items.push({ key: 'smg', label: 'SMG — new stock', price: SHOP_PRICES.smg, can: game.cash >= SHOP_PRICES.smg });
    if (p.weaponsOwned.smg) items.push({ key: 'smgAmmo', label: 'SMG ammo ×30', price: SHOP_PRICES.smgAmmo, can: game.cash >= SHOP_PRICES.smgAmmo });
    const box = $('shop-items');
    box.innerHTML = '';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      const label = document.createElement('span');
      label.textContent = item.label + ' — $' + item.price;
      const btn = document.createElement('button');
      btn.textContent = 'BUY';
      btn.disabled = !item.can;
      btn.addEventListener('click', () => { if (this.onBuy) this.onBuy(item.key); this.openShop(game); });
      row.appendChild(label); row.appendChild(btn);
      box.appendChild(row);
    }
    this.el.shop.classList.remove('hidden');
  }
  closeShop() { this.el.shop.classList.add('hidden'); }
  get shopOpen() { return !this.el.shop.classList.contains('hidden'); }

  fillPauseStats(game) {
    const s = game.stats;
    $('pause-stats').innerHTML =
      'Cash: <b>$' + game.cash.toLocaleString('en-US') + '</b><br>' +
      'Missions done: ' + s.missionsDone + ' / 6 &nbsp;·&nbsp; Taxi fares: ' + s.faresDone + '<br>' +
      'Cars stolen: ' + s.carsStolen + ' &nbsp;·&nbsp; Takedowns: ' + s.takedowns + ' &nbsp;·&nbsp; Shots fired: ' + s.shotsFired;
  }
}
