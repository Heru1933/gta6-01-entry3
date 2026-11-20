// Coral Bay Heat — shared tuning tables for the rebuilt entry.
// All place, person, car and shop names below are invented for this game.

export const TILE = 40;
export const WORLD_COLS = 100;
export const WORLD_ROWS = 80;
export const WORLD_W = WORLD_COLS * TILE;
export const WORLD_H = WORLD_ROWS * TILE;

export const DAY_LENGTH_SECONDS = 300;
export const START_HOUR = 8.5;

export const CITY_NAME = 'Coral Bay';
export const HERO_NAME = 'Dario Venn';
export const FIXER_NAME = 'Nadia Ferro';

// Car catalogue: w/h in pixels, speeds in px per second.
export const VEHICLE_TYPES = {
  dartlet: { name: 'Dartlet', w: 34, h: 62, maxSpeed: 300, accel: 210, grip: 3.4, colors: ['#c94f42', '#4a7fc9', '#d8d3c3', '#5da85f', '#8a8f98'] },
  meridian: { name: 'Meridian', w: 36, h: 68, maxSpeed: 340, accel: 230, grip: 3.2, colors: ['#2e3d4d', '#7a8894', '#b03a30', '#305f8a', '#c2b280'] },
  bandit: { name: 'Bandit V8', w: 38, h: 70, maxSpeed: 395, accel: 285, grip: 2.8, colors: ['#1d1d22', '#7a1f1f', '#c96a1e', '#274d2e'] },
  vireo: { name: 'Vireo GT', w: 37, h: 66, maxSpeed: 450, accel: 330, grip: 3.6, colors: ['#e8b91a', '#d84315', '#12a5a0', '#e8e4da'] },
  cargo: { name: 'Cargo Ox', w: 40, h: 78, maxSpeed: 265, accel: 175, grip: 2.6, colors: ['#cfd4d8', '#8a97a5', '#b5651d', '#5b7553'] },
  dunefox: { name: 'Dunefox', w: 38, h: 72, maxSpeed: 330, accel: 240, grip: 3.0, colors: ['#a0522d', '#4d6b8a', '#707880', '#38543a'] },
  cab: { name: 'CityCab', w: 36, h: 68, maxSpeed: 335, accel: 225, grip: 3.2, colors: ['#f2b01e'] },
  interceptor: { name: 'Interceptor', w: 37, h: 69, maxSpeed: 430, accel: 320, grip: 3.5, colors: ['#18222e'] },
  bancroft: { name: 'Bancroft Armored', w: 42, h: 84, maxSpeed: 285, accel: 165, grip: 2.4, colors: ['#3c4650'] },
};
export const TRAFFIC_TYPES = ['dartlet', 'meridian', 'meridian', 'bandit', 'cargo', 'dunefox', 'cab', 'dartlet'];

export const WEAPONS = {
  fist: { name: 'Fists', damage: 16, cooldown: 0.34, range: 30, speed: 0, spread: 0, mag: Infinity, auto: false },
  pistol: { name: 'Pistol', damage: 26, cooldown: 0.26, range: 560, speed: 950, spread: 0.02, mag: 12, auto: false },
  smg: { name: 'SMG', damage: 17, cooldown: 0.085, range: 500, speed: 980, spread: 0.07, mag: 30, auto: true },
};

export const PED_SHIRTS = ['#e2e8f0', '#e76f51', '#2a9d8f', '#e9c46a', '#457b9d', '#9b5de5', '#f15bb5', '#606c38', '#bc6c25', '#4cc9f0'];
export const PED_PANTS = ['#2b2d42', '#3a506b', '#5c374c', '#22223b', '#4a4e69', '#6b705c'];
export const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a9713f'];

export const CRIME_POINTS = {
  stealCar: 0.7, hitPed: 1.0, killPed: 1.6, hitCar: 0.35, hitCopCar: 1.1,
  shootNearCop: 0.4, explosion: 1.6, punchPed: 0.5, missionHeat: 3.0,
};
export const COPS_BY_STARS = [0, 2, 3, 5, 7, 9];
export const SHOP_PRICES = { armor: 300, pistolAmmo: 40, smgAmmo: 60, smg: 800, snack: 15, heal: 50, spray: 250 };
