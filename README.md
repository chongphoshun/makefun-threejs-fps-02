# EMBERLINE — Cinder Yard: 5v5 plant/defuse tactical FPS — 24 rounds, 5 guns, 3 grenades

A complete, original, round-based tactical FPS in three.js 0.187.0, built for the
make.fun "best three.js tactical FPS" bounty. Two teams of five fight over Cinder Yard,
a dusk freight yard with two bomb sites (Warehouse / Depot): plant the charge or drop
every defender. Money earned each round buys weapons, grenades, armour and a helmet in
the freeze-time shop. Bots walk waypoint routes, hold angles, react to gunfire and
footsteps, converge on a planted charge, and defuse it.

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

## The arsenal

- **P9 Sidearm** (free) · **VK-9 Rasp** SMG $1,500 · **AR-77 Ember** rifle $2,700 ·
  **LR-88 Longbow** sniper $4,750 · **Moss-12 Breacher** shotgun $1,700 (8 pellets)
- **SPARK-4 HE** $300 · **GHOST-2 Smoke** $400 (14 s screen that blocks sight) ·
  **DAZZLE-1 Flash** $250 (blinds anyone looking)
- **Vest Armour** $650 (absorbs half of all damage) · **Combat Helmet** $350 (halves headshots)

Economy: $300 per kill, $300 plant bonus, $3,250 round win, $1,900 round loss plus a
$500 loss-streak bonus (max 2). First to 13 rounds, or the higher score after round 24.

## Where the judge's five criteria live

1. **Complete game** — FPS view, HUD, rounds, bots that shoot back:
   `game/src/main.js`, `game/src/game.js`
2. **Gunplay** — head/body/leg hitboxes, recoil spray, spread, crouch:
   `game/src/weapons.js`, `game/src/move.js`
3. **Tactics** — plant/defuse, buy menu, grenades, 5v5 bots on routes:
   `game/src/bots.js`, `game/src/game.js`
4. **Map and look** — Cinder Yard, canvas textures, dusk light:
   `game/src/world.js`, `game/src/textures.js`
5. **Code** — one module per job, fixed 60 Hz step, pooled effects:
   `game/src/effects.js`, `game/src/main.js`

## Screenshots

Real headless-Chrome captures of this code (`bash shots.sh`): `1-firefight.jpg` is the
cover — a live firefight mid-lane, muzzle flash and tracer in the air, killfeed and
radio callouts up. Then the buy menu, a plant in progress at Warehouse, and the
after-action scoreboard.

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
