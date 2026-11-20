// Story and side work: six jobs for fixer Nadia Ferro, run by a small step
// engine (travel, steal, deliver, collect, beat the clock, raise heat, lose
// heat, eliminate), plus repeatable taxi fares between story jobs.

import { Vehicle } from './vehicles.js';
import { Ped } from './people.js';

const N = 'Nadia Ferro';
const D = 'Dario Venn';

export const MISSION_DEFS = [
  {
    title: 'First Wheels', reward: 900,
    intro: [
      { who: N, text: 'Dario. You roll into my city with twelve dollars and a bus ticket, so here is the deal: work, then eat.' },
      { who: N, text: 'A canary-yellow Vireo GT is sitting in the North Beach lot. The owner owes me. Bring it to Ferro Customs.' },
      { who: D, text: 'Steal a sports car. First day in Coral Bay. Sure, why not.' },
    ],
    outro: [
      { who: N, text: 'Clean work. She purrs. Nine hundred, as agreed — and Dario? The city is watching you now.' },
    ],
    build(game) {
      const L = game.world.locations;
      const car = new Vehicle(game.world, 'vireo', L.beachLot.x + 30, L.beachLot.y - 40, -Math.PI / 2, { kind: 'mission', color: '#e8b91a', missionTag: 'm1car' });
      game.vehicles.push(car);
      return { spawned: [car], steps: [
        { kind: 'goto', x: L.beachLot.x, y: L.beachLot.y, r: 130, label: 'Reach the North Beach parking lot' },
        { kind: 'steal', vehicle: car, label: 'Steal the yellow Vireo GT' },
        { kind: 'deliver', vehicle: car, x: L.garage.x, y: L.garage.y, r: 95, label: 'Deliver the Vireo to Ferro Customs' },
      ] };
    },
  },
  {
    title: 'Special Delivery', reward: 1200,
    intro: [
      { who: N, text: 'A package waits at the port — unmarked, unregistered, unmissable. The boys at Aero Park want it before their plane leaves.' },
      { who: N, text: 'Clock is ticking once you pick it up. And Dario — I unlocked something at Ironhold Arms for you. Visit the gun shop.' },
    ],
    outro: [
      { who: N, text: 'On time and in one piece. You are wasted on honest work, you know that?' },
    ],
    build(game) {
      const L = game.world.locations;
      return { spawned: [], steps: [
        { kind: 'pickup', x: L.docks.x, y: L.docks.y, r: 85, label: 'Pick up the package at the docks' },
        { kind: 'timed', x: L.aero.x, y: L.aero.y, r: 110, time: 150, label: 'Deliver to Aero Park before the plane leaves' },
      ] };
    },
    onComplete(game) { game.flags.smgUnlocked = true; game.toast('Ironhold Arms now stocks the SMG'); },
  },
  {
    title: 'Heat Check', reward: 1500,
    intro: [
      { who: N, text: 'Before I trust you with real money, I need to know you can handle the Coral Bay PD.' },
      { who: N, text: 'Get their attention — three stars of it — then disappear. Break their line of sight and stay gone. Show me.' },
    ],
    outro: [
      { who: N, text: 'Ha! Dispatch is still looking for a ghost. You pass, Dario. You pass.' },
    ],
    build(game) {
      return { spawned: [], steps: [
        { kind: 'reachWanted', level: 3, label: 'Cause enough trouble to reach 3 wanted stars' },
        { kind: 'escape', label: 'Lose the police completely' },
      ] };
    },
  },
  {
    title: 'The Collector', reward: 2500,
    intro: [
      { who: N, text: 'Anton Krell runs Krell Logistics and half the docks. His enforcer, Bruno Sabel, put two of my drivers in Coral Bay General.' },
      { who: N, text: 'Bruno holds court at The Flats with hired guns. End the conversation, Dario. Permanently.' },
    ],
    outro: [
      { who: N, text: 'Krell just lost his right hand and his nerve in the same afternoon. The docks are opening up.' },
    ],
    build(game) {
      const L = game.world.locations;
      const target = new Ped(game.world, L.flats.x, L.flats.y, { role: 'target', name: 'Bruno Sabel', hp: 170, shirt: '#3a3f4a' });
      const g1 = new Ped(game.world, L.flats.x - 70, L.flats.y + 40, { role: 'gunman', hp: 90, shirt: '#5a4632' });
      const g2 = new Ped(game.world, L.flats.x + 80, L.flats.y - 30, { role: 'gunman', hp: 90, shirt: '#324a5a' });
      game.peds.push(target, g1, g2);
      return { spawned: [target, g1, g2], guards: [g1, g2], target, steps: [
        { kind: 'goto', x: L.flats.x, y: L.flats.y, r: 170, label: 'Find Bruno Sabel at The Flats' },
        { kind: 'kill', ped: target, label: 'Take out Bruno Sabel' },
        { kind: 'goto', x: L.garage.x, y: L.garage.y, r: 100, label: 'Report back to Nadia at Ferro Customs' },
      ] };
    },
  },
  {
    title: 'Harbor Run', reward: 3000,
    intro: [
      { who: N, text: 'Krell is smuggling through my port now. Tonight a crate lands that belongs to me. Take it back.' },
      { who: N, text: 'Fair warning: harbor patrol has been jumpy all week. The moment you lift that crate, expect company.' },
    ],
    outro: [
      { who: N, text: 'My crate, my port, my city. Krell is finished — one job left, and it is the big one.' },
    ],
    build(game) {
      const L = game.world.locations;
      return { spawned: [], steps: [
        { kind: 'pickup', x: L.docks.x, y: L.docks.y, r: 85, label: 'Lift the crate at the docks',
          onComplete(g) { g.wanted.add(3); g.heatFloor = 2.4; g.toast('The PD were watching the port!'); g.audio.sting(false); } },
        { kind: 'deliverAny', x: L.garage.x, y: L.garage.y, r: 100, label: 'Get the crate to Ferro Customs',
          onComplete(g) { g.heatFloor = 0; } },
      ] };
    },
  },
  {
    title: 'The Bancroft Job', reward: 6000,
    intro: [
      { who: N, text: 'First Bancroft moves its cash in an armored van, same route, same depot, every Friday. Today is Friday.' },
      { who: N, text: 'Take the van from the bank depot and bring it to the Harborview hideout. Every cop in Coral Bay will come. Come anyway.' },
      { who: D, text: 'One van, whole police force. This is either my retirement or my funeral.' },
    ],
    outro: [
      { who: N, text: 'Count it: more money than this garage has ever held. You did it, Dario.' },
      { who: D, text: 'Coral Bay is ours, Nadia. Ours.' },
    ],
    build(game) {
      const L = game.world.locations;
      const van = new Vehicle(game.world, 'bancroft', L.bank.x + 60, L.bank.y + 30, Math.PI / 2, { kind: 'mission', color: '#3c4650', missionTag: 'm6van' });
      van.health = 280;
      game.vehicles.push(van);
      return { spawned: [van], steps: [
        { kind: 'goto', x: L.bank.x, y: L.bank.y, r: 140, label: 'Reach the First Bancroft depot' },
        { kind: 'steal', vehicle: van, label: 'Steal the armored Bancroft van',
          onComplete(g) { g.wanted.points = Math.max(g.wanted.points, 4); g.heatFloor = 3.4; g.toast('Every unit in Coral Bay is coming!'); } },
        { kind: 'deliver', vehicle: van, x: L.hideout.x, y: L.hideout.y, r: 110, label: 'Deliver the van to the Harborview hideout',
          onComplete(g) { g.heatFloor = 0; } },
      ] };
    },
  },
];

export class MissionRunner {
  constructor() {
    this.index = 0;
    this.state = 'idle';
    this.built = null;
    this.stepIndex = 0;
    this.stepT = 0;
    this.hadHeat = false;
  }
  get def() { return MISSION_DEFS[this.index] || null; }
  get step() { return this.built ? this.built.steps[this.stepIndex] : null; }
  get finished() { return this.index >= MISSION_DEFS.length; }

  start(game) {
    const def = this.def;
    if (!def) return;
    this.built = def.build(game);
    this.stepIndex = 0;
    this.stepT = 0;
    this.hadHeat = false;
    this.state = 'active';
    game.showDialogue(def.intro, () => { game.banner(def.title, 'Mission started'); game.audio.phone(); });
    const s = this.step;
    if (s && s.onStart) s.onStart(game);
  }

  cleanup(game) {
    if (!this.built) return;
    for (const e of this.built.spawned) {
      const vi = game.vehicles.indexOf(e); if (vi >= 0) game.vehicles.splice(vi, 1);
      const pi = game.peds.indexOf(e); if (pi >= 0) game.peds.splice(pi, 1);
    }
    this.built = null;
    game.heatFloor = 0;
  }

  fail(game, why) {
    game.audio.sting(false);
    game.banner('MISSION FAILED', why || 'Try again from Ferro Customs');
    this.cleanup(game);
    this.state = 'idle';
  }

  complete(game) {
    const def = this.def;
    game.addCash(def.reward);
    game.stats.missionsDone++;
    game.effects.text(game.player.x, game.player.y - 30, '+$' + def.reward, '#ffd94d');
    game.audio.sting(true);
    const outro = def.outro;
    this.cleanup(game);
    this.index++;
    this.state = this.finished ? 'done' : 'idle';
    if (def.onComplete) def.onComplete(game);
    game.showDialogue(outro, () => {
      game.banner(def.title + ' — COMPLETE', '+$' + def.reward);
      if (this.finished) game.onStoryComplete();
      else game.toast('New job waiting at Ferro Customs');
      game.autosave();
    });
  }

  marker() {
    if (this.state === 'idle' && !this.finished) return { x: -1, y: -1, contact: true };
    const s = this.step;
    if (!s) return null;
    if (s.kind === 'steal' || s.kind === 'deliver') return { x: s.vehicle.x, y: s.vehicle.y };
    if (s.kind === 'kill') return { x: s.ped.x, y: s.ped.y };
    if (s.x !== undefined) return { x: s.x, y: s.y };
    return null;
  }

  objectiveText() {
    if (this.state === 'idle') return this.finished ? 'Free roam — fares and chaos pay the bills' : 'Go to Ferro Customs (gold marker) for work';
    const s = this.step;
    if (!s) return '';
    let label = s.label;
    if (s.kind === 'timed') label += ' — ' + Math.max(0, Math.ceil(s.time - this.stepT)) + 's';
    if (s.kind === 'escape' && this.hadHeat) label += ' — stay out of sight';
    return label;
  }

  update(dt, game) {
    if (this.state !== 'active') return;
    const s = this.step;
    if (!s) { this.complete(game); return; }
    this.stepT += dt;
    const p = game.player;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    if (this.built && this.built.guards && this.built.target) {
      const t = this.built.target;
      if (!t.dead && (t.hostile || Math.hypot(px - t.x, py - t.y) < 120)) {
        for (const g of this.built.guards) if (!g.dead) { g.hostile = true; g.state = 'fight'; }
      }
    }
    let done = false;
    switch (s.kind) {
      case 'goto': case 'pickup': case 'deliverAny':
        done = Math.hypot(px - s.x, py - s.y) < s.r;
        if (s.kind === 'pickup' && done) { game.audio.pickup(); game.effects.cashSparkle(px, py); }
        break;
      case 'timed':
        if (Math.hypot(px - s.x, py - s.y) < s.r) done = true;
        else if (this.stepT > s.time) { this.fail(game, 'Out of time'); return; }
        break;
      case 'steal':
        done = p.car === s.vehicle;
        break;
      case 'deliver':
        done = p.car === s.vehicle && Math.hypot(px - s.x, py - s.y) < s.r;
        if (s.vehicle.dead) { this.fail(game, 'The vehicle was destroyed'); return; }
        break;
      case 'reachWanted':
        done = game.wanted.level >= s.level;
        break;
      case 'escape':
        if (game.wanted.level > 0) this.hadHeat = true;
        done = this.hadHeat && game.wanted.level === 0;
        break;
      case 'kill':
        done = s.ped.dead;
        break;
    }
    if (done) {
      if (s.onComplete) s.onComplete(game);
      this.stepIndex++;
      this.stepT = 0;
      this.hadHeat = false;
      const ns = this.step;
      if (ns && ns.onStart) ns.onStart(game);
      if (!ns) this.complete(game);
      else game.audio.pickup();
    }
  }
}

export class TaxiFares {
  constructor() { this.spawnT = 6; this.active = null; }
  update(dt, game) {
    this.spawnT -= dt;
    const waiting = game.peds.filter((p) => p.role === 'fare' && p.state !== 'ride' && !p.dead);
    if (this.spawnT <= 0 && waiting.length < 2 && !this.active) {
      this.spawnT = 13;
      const spot = game.world.randomRoadPoint(game.rng, game.player.x, game.player.y, 380, 850);
      if (spot) {
        const ped = new Ped(game.world, spot.x + 26, spot.y + 10, { role: 'fare' });
        game.peds.push(ped);
      }
    }
    const car = game.player.car;
    if (!this.active && car && car.speed() < 42) {
      for (const ped of waiting) {
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 52) {
          ped.state = 'ride'; ped.riding = car; car.occupant = ped;
          const dest = game.world.randomRoadPoint(game.rng, car.x, car.y, 650, 1750);
          this.active = { ped, x: dest.x, y: dest.y, dist: Math.hypot(dest.x - car.x, dest.y - car.y) };
          game.toast('Fare picked up — follow the green marker');
          game.audio.door();
          break;
        }
      }
    }
    if (this.active) {
      const a = this.active;
      if (!car || car.dead) { this.cancel(game, 'Fare lost'); }
      else if (Math.hypot(a.x - car.x, a.y - car.y) < 85 && car.speed() < 60) {
        const pay = Math.round(35 + a.dist / 11);
        game.addCash(pay);
        game.stats.faresDone++;
        game.effects.text(car.x, car.y - 34, 'FARE +$' + pay, '#8dff6e');
        game.audio.cash();
        this.dropOff(game, a);
        this.active = null;
      }
    }
  }
  dropOff(game, a) {
    const car = game.player.car;
    a.ped.state = 'walk';
    a.ped.role = 'walker';
    a.ped.riding = null;
    if (car) { a.ped.x = car.x + 34; a.ped.y = car.y + 10; car.occupant = null; }
    a.ped.destX = a.ped.x + 60; a.ped.destY = a.ped.y;
  }
  cancel(game, why) {
    if (!this.active) return;
    game.toast(why);
    this.dropOff(game, this.active);
    this.active = null;
  }
  marker() { return this.active ? { x: this.active.x, y: this.active.y } : null; }
}
