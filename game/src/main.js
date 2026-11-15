// EMBERLINE boot: build the world, wire the modules, hand the frame to the loop.
// This file owns construction and wiring only — the simulation lives in loop.js,
// the tactics in bomb.js / grenade.js / nav.js / hearing.js / economy.js, the
// trigger in combat.js, the round flow in rounds.js, captures in staging.js.
// ?shot=<name> with &seed=N stages a deterministic frame for a capture, renders it
// twice, then freezes it and sets window.__shotReady. ?selftest=1 runs the headless
// self-test instead.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITES } from './world.js';
import { createMover } from './move.js';
import { createInput } from './input.js';
import { createWeapons, WEAPONS } from './weapons.js';
import { createBots } from './bots.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createGame } from './game.js';
import { createEconomy } from './economy.js';
import { createBomb } from './bomb.js';
import { createGrenades } from './grenade.js';
import { createHearing } from './hearing.js';
import { createShooter } from './combat.js';
import { createRounds } from './rounds.js';
import { createLoop } from './loop.js';
import { createStaging } from './staging.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color('#1a120b'), 20, 62);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);
// Small warm fill light parented to the camera so the dark-metal viewmodel reads
// with highlights instead of a black silhouette. Visual only.
const vmLight = new THREE.PointLight(new THREE.Color('#ffe0b8'), 4, 3);
vmLight.position.set(0.2, 0.1, -0.4);
camera.add(vmLight);
// Cool rim light from the other side so the weapon's shape reads, not just its
// lit face. Visual only.
const vmRim = new THREE.PointLight(new THREE.Color('#8fb4ff'), 2, 2);
vmRim.position.set(-0.3, 0.2, -0.3);
camera.add(vmRim);

const world = createWorld(scene);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud(world);
const game = createGame();
const input = createInput(renderer.domElement, onLockChange);
const weapons = createWeapons(camera);
const economy = createEconomy({ game, weapons, hud, audio });
const bomb = createBomb({
  game, world, hud, audio, effects,
  getPlayer: () => player,
  onPlanted(site) {
    hud.banner('CHARGE PLANTED', `Defend ${SITES[site].name} — 40 seconds`, 3000);
    hud.radio('You', `Charge planted at ${site} — hold the site`, 'ember');
    audio.plant();
  },
  onDefused() { rounds.endRound('ash', 'You defused the charge'); },
});
const hearing = createHearing();
const grenades = createGrenades({
  scene, world, effects, audio, hud, weapons,
  hooks: {
    getCamera: () => camera,
    getPlayerMover: () => playerMover,
    getPlayer: () => player,
    getBots: () => bots,
    hurtPlayer: (...args) => rounds.hurtPlayer(...args),
    now: () => loop.now(),
  },
});
const shooter = createShooter({
  scene, camera, weapons, grenades, effects, audio, hud, hearing,
  hooks: {
    getStats: () => stats,
    getPlayer: () => player,
    getBots: () => bots,
    getPlayerMover: () => playerMover,
    getShootables: () => shootables,
    now: () => loop.now(),
    random,
  },
});
const playerMover = createMover(world.colliders, { x: 0, z: 15.5, yaw: 0 });

let loop; // Built after the rounds module; modules above call it through closures.
const stats = { shots: 0, hits: 0, headshots: 0, kills: 0, deaths: 0 };
const roundKills = []; // Kill positions this round, for the round-report replay map.

// The player as a combatant, so bots can see and shoot them with the same code they
// use on each other. pos is the mover's own vector: always current, never copied.
const player = {
  isPlayer: true, name: 'You', team: 'ember',
  pos: playerMover.state.position, alive: true, health: 100,
  crouching: false, speed: 0,
  get eye() { return playerMover.state.eye; },
  get yaw() { return playerMover.state.yaw; },
};
const playerBody = playerMover.state;

const hooks = {
  now: () => loop.now(),
  onBotShot(from, to, kind, dist) {
    effects.tracer(from, to, WEAPONS[kind].tracer);
    audio.shot(kind, Math.min(1, dist / 45));
    hearing.addNoise(from.x, from.z, loop.now());
  },
  damageCombatant(combatant, amount, isHead, attacker) {
    if (combatant.isPlayer) rounds.hurtPlayer(amount, attacker, isHead);
    else {
      bots.damage(combatant, amount, isHead, attacker);
      // Blood puff at the chest of the bot that was hit.
      const p = combatant.mover.state.position;
      effects.burst(new THREE.Vector3(p.x, p.y + 1.1, p.z), new THREE.Vector3(0, 1, 0), 7, 0xd92010);
    }
  },
  radio(name, text, team) {
    hud.radio(name, text, team);
  },
  onKill(attacker, victim, isHead) {
    const killerName = attacker.isPlayer ? 'You' : attacker.name;
    hud.killfeed(killerName, victim.name, isHead, attacker.team);
    const victimPos = victim.isPlayer ? victim.pos : victim.mover.state.position;
    roundKills.push({ x: victimPos.x, z: victimPos.z, team: attacker.team, killer: killerName });
    if (roundKills.length > 24) roundKills.shift();
    if (attacker.isPlayer) {
      economy.killReward();
      stats.kills += 1;
    }
    rounds.checkElimination();
  },
  onDefuseProgress(bot, progress) {
    if (bot.team === 'ash' && game.state.planted) {
      hud.setPlant(progress / 5);
    }
  },
  onDefused(bot) {
    if (game.state.phase !== 'live' || !game.state.planted) return;
    rounds.endRound('ash', `${bot.name} defused the charge`);
  },
};

const bots = createBots(scene, world, hooks);
const shootables = world.shootables.concat(bots.hitMeshes);
const rounds = createRounds({
  game, weapons, hud, audio, effects, bomb, grenades,
  getPlayer: () => player,
  getPlayerMover: () => playerMover,
  getBots: () => bots,
  stats, roundKills,
  closeBuy: () => loop.closeBuy(),
});
loop = createLoop({
  scene, camera, renderer, world, effects, audio, hud, game, input, weapons,
  player, playerMover, playerBody, bots, hearing, grenades, bomb, shooter, economy, rounds,
});
const staging = createStaging({
  scene, camera, renderer, hud, game, rounds, weapons, bots, effects, shooter, input,
  player, playerBody,
  step: loop.step, syncCamera: loop.syncCamera, aimAt: loop.aimAt,
  setFrozen: (v) => loop.setFrozen(v), getSimTime: () => loop.now(),
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    hud.hideOverlay();
    audio.unlock();
  } else if (game.state.phase === 'matchEnd') {
    // The end overlay stays up; the play button restarts the match.
  } else if (!player.alive) {
    hud.showOverlay('dead');
  } else if (game.state.phase !== 'menu') {
    hud.showOverlay('paused');
  }
}

hud.buildBuyMenu((id) => economy.tryBuy(id));
hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (game.state.phase === 'menu') {
    game.startMatch();
    rounds.startRoundSetup();
    hud.banner('ROUND 1', 'Plant the charge at A or B', 2600);
    input.requestLock();
  } else if (game.state.phase === 'matchEnd') {
    game.startMatch();
    rounds.startRoundSetup();
    hud.banner('ROUND 1', 'Plant the charge at A or B', 2600);
    input.requestLock();
  } else if (!player.alive) {
    // Dead: nothing to resume until the round ends.
  } else {
    input.requestLock();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

loop.syncCamera();
if (params.get('selftest')) staging.runSelfTest();
else if (shot) staging.runShot(shot);
else requestAnimationFrame(loop.frameWithMap);
