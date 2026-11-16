# EMBERLINE — Cinder Yard: 5v5 plant/defuse tactical FPS — 24 rounds, 5 guns, 3 grenades

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/chongphoshun/makefun-threejs-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/chongphoshun/makefun-threejs-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A complete, original, round-based tactical FPS in three.js 0.187.0, built for the
make.fun "best three.js tactical FPS" bounty ([make.fun/bounty/threejs-fps-02](https://make.fun/bounty/threejs-fps-02)). Two teams of five fight over Cinder Yard,
an industrial brickworks at sunset with two bomb sites (Kiln Hall / Clay Pits): plant
the charge or drop every defender. Money earned each round buys weapons, grenades,
armour, a helmet and a defuse kit in the freeze-time ARMOURY. Bots walk waypoint
routes, hold angles, react to gunfire and footsteps, converge on a planted charge,
and defuse it. Judged source is 158,646 bytes — under the 160 KiB cap, nothing cut.

Play it: serve `game/` with any static server (`node serve.ts`, then
http://localhost:8080) and open it in desktop Chrome. No build step, no network.

## Controls

| Key | Action |
| --- | --- |
| W A S D / Mouse | Move / look (pointer lock) |
| Click / Right-click | Fire / aim down sights |
| R | Reload |
| Ctrl / Shift / Space | Crouch / walk / jump |
| B | Buy menu (freeze time) |
| E | Plant / defuse (hold) |
| G | Cycle grenade (HE → smoke → flash) |
| 1–8 | Weapons · 9 vest · 0 helmet |
| Q | Last weapon |
| Tab | Scoreboard (K/A/D, HS%, DMG, cash, MVP) |

## The arsenal

- **P9 Sidearm** (free) · **VK-9 Rasp** SMG $1,500 · **AR-77 Ember** rifle $2,700 ·
  **LR-88 Longbow** sniper $4,750 · **Moss-12 Breacher** shotgun $1,700 (8 pellets)
- **SPARK-4 HE** $300 · **GHOST-2 Smoke** $400 (14 s screen that blocks sight) ·
  **DAZZLE-1 Flash** $250 (blinds anyone looking)
- **Vest Armour** $650 (absorbs half of all damage) · **Combat Helmet** $350 (halves headshots) ·
  **Defuse Kit** $400 (defuse twice as fast)

Economy: $300 per kill, $300 plant bonus, $3,250 round win, $1,900 round loss plus a
$500 loss-streak bonus (max 2). First to 13 rounds, or the higher score after round 24.

## Where the judge's five criteria live

1. **Complete game** — FPS view, HUD, rounds, bots that shoot back:
   `game/src/loop.js` (60 Hz step + frame), `game/src/rounds.js` (round flow),
   `game/src/game.js` (match state)
2. **Gunplay** — head/body/leg hitboxes, recoil spray, spread, crouch:
   `game/src/combat.js` (trigger + hit resolution), `game/src/weapons.js` (arsenal),
   `game/src/move.js` (mover)
3. **Tactics** — plant/defuse, buy menu, grenades, 5v5 bots on routes:
   `game/src/bomb.js` (plant/defuse, defuse kit), `game/src/grenade.js` (grenades),
   `game/src/economy.js` (ARMOURY shop), `game/src/nav.js` (bot pathing),
   `game/src/hearing.js` (gunshot + footstep awareness), `game/src/bots.js` (5v5 AI,
   nameplates, kill feed with weapon + headshot icon)
4. **Map and look** — Cinder Yard brickworks at sunset, Kiln Hall / Clay Pits,
   skybox with sun, smokestacks, pipes, wall signs, painted site letters, canvas
   textures, dusk light: `game/src/world.js`, `game/src/textures.js`
5. **Code** — one module per job, fixed 60 Hz step, pooled effects:
   `game/src/main.js` is boot + wiring only (263 lines), `game/src/loop.js` (fixed step),
   `game/src/effects.js` (pooled tracers/sparks/casings)

## Screenshots

Real headless-Chrome captures of this code (`bash shots.sh`): `1-firefight.jpg` is the
cover — a live firefight at Clay Pits at sunset, three Ash defenders in frame, muzzle
flash and tracer in the air, kill feed with weapons and radio callouts up. Then the
ARMOURY shop over a scenic view, a plant in progress at Kiln Hall with the wired
charge in hand, and the round scoreboard with K/A/D, HS%, DMG, cash and MVP.

## Development

- `node serve.ts --port 8080` — serve `game/` locally.
- `?selftest=1` — headless self-test: a scripted player walks and shoots through real
  rounds; the result lands in `document.title`.
- `?shot=firefight|buy|plant|scoreboard&seed=1` — deterministic staged frames for
  screenshots; `bash shots.sh` captures all four as JPEG.
- `main.ts` hands the game in: it copies `game/` and `screenshots/` to `/output` and
  writes `/output/dossier.json` with the kit's `vendor/makefun-threejs.ts`.

## License

MIT — see `LICENSE`.
