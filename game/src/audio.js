// Synthesised sound only: a WebAudio sunset-funk loop (bass, kick, hats,
// pads, sparse lead) and oscillator/noise effects for shots, crashes,
// pickups, the engine, sirens and skids. No audio files are loaded.

const NOTE = { A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98, A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440 };

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteTime = 0;
    this.musicTimer = null;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.skidNode = null;
    this._engineWanted = false;
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.5; this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    this.noiseBuffer = this.makeNoise();
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicOn) return;
    const spb = 60 / 100 / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.22) {
      this.playStep(this.step, this.nextNoteTime);
      this.nextNoteTime += spb;
      this.step = (this.step + 1) % 64;
    }
  }
  playStep(step, t) {
    const bar = Math.floor(step / 16) % 4;
    const s16 = step % 16;
    const roots = [NOTE.A1, NOTE.F2, NOTE.C2, NOTE.G2];
    const chords = [[NOTE.A2, NOTE.C3, NOTE.E3], [NOTE.F2 * 2, NOTE.A2, NOTE.C3], [NOTE.C3, NOTE.E3, NOTE.G3], [NOTE.G2 * 2, NOTE.D3, NOTE.G3]];
    if (s16 % 4 === 0) this.tone(roots[bar], t, 0.32, 'triangle', 0.30, this.musicGain);
    if (s16 % 8 === 4) this.tone(roots[bar] * 1.5, t, 0.2, 'triangle', 0.16, this.musicGain);
    if (s16 === 0) for (const f of chords[bar]) this.tone(f, t, 1.5, 'sawtooth', 0.045, this.musicGain, 600);
    if (s16 % 4 === 0) this.kick(t);
    if (s16 % 2 === 1) this.hat(t, 0.05);
    if (s16 === 4 || s16 === 12) this.snare(t);
    const lead = [0, -1, 3, -1, 2, -1, 1, -1, 0, -1, -1, 4, -1, 3, 2, -1];
    const scale = [NOTE.A3, NOTE.C4, NOTE.D4, NOTE.E4, NOTE.G4, NOTE.A4];
    const li = lead[s16];
    if (bar >= 2 && li >= 0) this.tone(scale[li % scale.length], t, 0.24, 'square', 0.05, this.musicGain);
  }
  tone(freq, t, dur, type, vol, dest, lowpass) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (lowpass) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; o.connect(f); f.connect(g); }
    else o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(t, dur, vol, freq, type = 'bandpass', dest) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }
  kick(t) { this.tone(120, t, 0.12, 'sine', 0.5, this.musicGain); }
  snare(t) { this.noise(t, 0.11, 0.16, 1800, 'bandpass', this.musicGain); }
  hat(t, v) { this.noise(t, 0.04, v, 7000, 'highpass', this.musicGain); }
  now() { return this.ctx ? this.ctx.currentTime : 0; }

  shoot() { if (!this.ctx) return; const t = this.now(); this.noise(t, 0.09, 0.5, 900); this.tone(160, t, 0.07, 'square', 0.25); }
  shootSmg() { if (!this.ctx) return; const t = this.now(); this.noise(t, 0.06, 0.36, 1200); this.tone(190, t, 0.05, 'square', 0.18); }
  dryFire() { if (!this.ctx) return; this.tone(1200, this.now(), 0.03, 'square', 0.08); }
  reload() { if (!this.ctx) return; const t = this.now(); this.tone(500, t, 0.04, 'square', 0.12); this.tone(700, t + 0.09, 0.04, 'square', 0.12); this.tone(420, t + 0.2, 0.05, 'square', 0.14); }
  punch() { if (!this.ctx) return; this.noise(this.now(), 0.08, 0.4, 300, 'lowpass'); }
  hitFlesh() { if (!this.ctx) return; this.noise(this.now(), 0.07, 0.3, 500, 'lowpass'); }
  hurt() { if (!this.ctx) return; this.tone(140, this.now(), 0.12, 'sawtooth', 0.2); }
  crash(big) { if (!this.ctx) return; const t = this.now(); this.noise(t, big ? 0.4 : 0.18, big ? 0.6 : 0.35, 700, 'lowpass'); this.tone(70, t, 0.25, 'sine', 0.4); }
  explosion() { if (!this.ctx) return; const t = this.now(); this.noise(t, 0.9, 0.85, 220, 'lowpass'); this.tone(45, t, 0.8, 'sine', 0.7); }
  door() { if (!this.ctx) return; const t = this.now(); this.tone(220, t, 0.05, 'square', 0.12); this.tone(160, t + 0.06, 0.06, 'square', 0.12); }
  engineStart() { if (!this.ctx) return; const t = this.now(); this.tone(60, t, 0.16, 'sawtooth', 0.2); this.tone(90, t + 0.14, 0.2, 'sawtooth', 0.2); }
  pickup() { if (!this.ctx) return; const t = this.now(); this.tone(880, t, 0.07, 'square', 0.14); this.tone(1320, t + 0.06, 0.1, 'square', 0.14); }
  cash() { if (!this.ctx) return; const t = this.now(); this.tone(1046, t, 0.06, 'square', 0.12); this.tone(1568, t + 0.05, 0.12, 'square', 0.12); }
  phone() { if (!this.ctx) return; const t = this.now(); this.tone(1175, t, 0.07, 'sine', 0.14); this.tone(1175, t + 0.14, 0.07, 'sine', 0.14); }
  uiClick() { if (!this.ctx) return; this.tone(660, this.now(), 0.05, 'square', 0.1); }
  horn() { if (!this.ctx) return; const t = this.now(); this.tone(370, t, 0.16, 'square', 0.07); this.tone(466, t, 0.16, 'square', 0.07); }
  sting(win) {
    if (!this.ctx) return; const t = this.now();
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(f, t + i * 0.11, 0.22, 'triangle', 0.2));
  }
  wasted() { if (!this.ctx) return; const t = this.now(); [330, 262, 208, 165].forEach((f, i) => this.tone(f, t + i * 0.22, 0.3, 'sawtooth', 0.14)); }

  setEngine(ratio, running) {
    if (!this.ctx) return;
    if (running && !this.engineNodes) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      const o2 = this.ctx.createOscillator(); o2.type = 'square';
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = this.ctx.createGain(); g.gain.value = 0.0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfxGain);
      o.start(); o2.start();
      this.engineNodes = { o, o2, f, g };
    }
    if (this.engineNodes) {
      const n = this.engineNodes, t = this.now();
      if (running) {
        n.o.frequency.setTargetAtTime(55 + ratio * 165, t, 0.08);
        n.o2.frequency.setTargetAtTime(28 + ratio * 82, t, 0.08);
        n.f.frequency.setTargetAtTime(350 + ratio * 900, t, 0.1);
        n.g.gain.setTargetAtTime(0.05 + ratio * 0.075, t, 0.1);
      } else {
        n.g.gain.setTargetAtTime(0, t, 0.05);
        setTimeout(() => { if (this.engineNodes && !this._engineWanted) { try { this.engineNodes.o.stop(); this.engineNodes.o2.stop(); } catch (e) { /* already stopped */ } this.engineNodes = null; } }, 250);
      }
      this._engineWanted = running;
    }
  }
  setSiren(distance) {
    if (!this.ctx) return;
    const active = distance !== null && distance < 900;
    if (active && !this.sirenNodes) {
      const o = this.ctx.createOscillator(); o.type = 'triangle';
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 1.6;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 130;
      const g = this.ctx.createGain(); g.gain.value = 0;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency); o.frequency.value = 830;
      o.connect(g); g.connect(this.sfxGain); o.start(); lfo.start();
      this.sirenNodes = { o, lfo, g };
    }
    if (this.sirenNodes) {
      const vol = active ? Math.max(0, 0.075 * (1 - distance / 900)) : 0;
      this.sirenNodes.g.gain.setTargetAtTime(vol, this.now(), 0.15);
      if (!active && vol === 0) {
        const nodes = this.sirenNodes; this.sirenNodes = null;
        setTimeout(() => { try { nodes.o.stop(); nodes.lfo.stop(); } catch (e) { /* already stopped */ } }, 300);
      }
    }
  }
  setSkid(on) {
    if (!this.ctx) return;
    if (on && !this.skidNode) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 950;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start();
      this.skidNode = { src, g };
    } else if (!on && this.skidNode) {
      const n = this.skidNode; this.skidNode = null;
      n.g.gain.setTargetAtTime(0, this.now(), 0.05);
      setTimeout(() => { try { n.src.stop(); } catch (e) { /* already stopped */ } }, 200);
    }
  }
}
