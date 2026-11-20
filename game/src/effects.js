// Cosmetic layer: particle bursts, fading skid marks, floating reward
// text and screen shake. Nothing in the game logic reads this state back.

import { clamp } from './random.js';

export class Effects {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
  }
  addShake(amount) { this.shake = Math.min(22, this.shake + amount); }
  burst(x, y, opts) {
    const { count = 8, color = '#ffd94d', speed = 120, life = 0.4, size = 3, gravity = 0, spread = Math.PI * 2, angle = 0 } = opts || {};
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.85);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.5 + Math.random() * 0.8), maxLife: life, color,
        size: size * (0.6 + Math.random() * 0.8), gravity,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }
  sparks(x, y, angle) { this.burst(x, y, { count: 10, color: '#ffcf5e', speed: 240, life: 0.3, size: 2.4, angle, spread: 1.6 }); }
  smoke(x, y, dark) { this.burst(x, y, { count: 2, color: dark ? 'rgba(40,40,44,0.5)' : 'rgba(200,200,200,0.45)', speed: 26, life: 1.1, size: 7, gravity: -22 }); }
  fire(x, y) { this.burst(x, y, { count: 3, color: '#ff7a2e', speed: 40, life: 0.5, size: 6, gravity: -30 }); this.burst(x, y, { count: 1, color: '#ffd23e', speed: 20, life: 0.3, size: 4 }); }
  muzzle(x, y, angle) { this.burst(x, y, { count: 3, color: '#ffe9a3', speed: 160, life: 0.07, size: 3, angle, spread: 0.5 }); }
  bloodPuff(x, y) { this.burst(x, y, { count: 6, color: 'rgba(178,44,38,0.75)', speed: 90, life: 0.35, size: 3 }); }
  cashSparkle(x, y) { this.burst(x, y, { count: 10, color: '#8dff6e', speed: 80, life: 0.5, size: 2.6, gravity: 60 }); }
  splash(x, y) { this.burst(x, y, { count: 8, color: '#9adbe8', speed: 110, life: 0.4, size: 2.6, gravity: 200 }); }
  explosionFx(x, y) {
    this.burst(x, y, { count: 42, color: '#ff8c2e', speed: 340, life: 0.7, size: 6 });
    this.burst(x, y, { count: 26, color: '#ffd23e', speed: 200, life: 0.5, size: 5 });
    this.burst(x, y, { count: 20, color: 'rgba(50,50,55,0.6)', speed: 90, life: 1.6, size: 10, gravity: -26 });
    this.flash = 0.55; this.addShake(16);
  }
  addSkid(x1, y1, x2, y2) {
    this.skids.push({ x1, y1, x2, y2, alpha: 0.5 });
    if (this.skids.length > 700) this.skids.shift();
  }
  text(x, y, str, color) {
    this.texts.push({ x, y, str, color: color || '#ffffff', life: 1.4 });
    if (this.texts.length > 24) this.texts.shift();
  }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.gravity || 0) * dt;
      p.vx *= (1 - dt * 1.4); p.vy *= (1 - dt * 0.6);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.skids) s.alpha -= dt * 0.008;
    this.skids = this.skids.filter((s) => s.alpha > 0.03);
    for (const t of this.texts) { t.life -= dt; t.y -= dt * 34; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }
  drawSkids(ctx) {
    ctx.save();
    ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    for (const s of this.skids) {
      ctx.strokeStyle = 'rgba(18,18,20,' + (s.alpha * 0.8).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.restore();
  }
  drawWorld(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.fillStyle = t.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
      ctx.strokeText(t.str, t.x, t.y); ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }
}
