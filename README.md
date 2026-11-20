# Coral Bay Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Heru1933/gta6-01-entry3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Heru1933/gta6-01-entry3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original top-down 2D open-world crime game that runs entirely offline in a desktop browser — no build step, no assets, no network. You are Dario Venn, a driver fresh off the boat in Coral Bay, running jobs for fixer Nadia Ferro while the Coral Bay PD watches every corner.

**The city** — a seeded coastal city of 100×80 tiles: a beach and boardwalk on the north shore, a working dock in the south-east, a park, named streets, painted lots and around 43 buildings, all tied together by a real road graph.

**Systems**

- Traffic AI that follows the lane graph, keeps its lane, brakes for obstacles and honks; parked cars line the lots and streets
- Pedestrians who stroll, flee gunfire, and report crimes they witness
- Stealable cars — parked, moving traffic, even police interceptors — each model with its own handling, top speed and toughness
- A wanted system built on witnesses and line of sight: heat decays while you stay unseen, and the response escalates from patrol cars to foot officers and roadblocks at four stars
- Combat with fists, a pistol and an SMG — magazines, reloads, armor, hit reactions
- A six-mission story arc (steal, deliver, escort, tail, lift, finale) plus repeatable taxi fares
- Shops: Shine Auto resprays (and clears your heat), Ironhold Arms sells weapons and armor, the garage repairs, the hospital heals, food stands patch you up
- HUD with health/armor bars, cash, wanted stars, clock, speedometer and a live minimap
- Start screen with a demo camera drifting over the city, pause menu, save / load / autosave in localStorage
- A full day cycle: dusk settles, street lamps and headlights glow at night
- Particles, skid marks, screen shake, and a synthesized WebAudio soundtrack and effects — no audio files

**Controls** — WASD / arrows to move and drive, Shift to sprint, mouse to aim, left click to shoot or punch, E to enter cars and interact, Space handbrake, R reload, 1/2/3 weapons, P / Esc pause, M mute.

## Run it

```
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies the game and screenshots to `out/` and writes the `dossier.json` hand-in. To just play it, open `game/index.html` in a desktop browser — or serve it with `node serve.ts` and open the printed local address.

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
