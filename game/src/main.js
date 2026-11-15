// EMBERLINE boot: build the world, wire the modules, hand the frame to the loop.
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
const vmLight = new THREE.PointLight(new THREE.Color('#ffe0b8'), 4, 3);
vmLight.position.set(0.2, 0.1, -0.4);
camera.add(vmLight);
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
  hasKit: () => weapons.state.kit,
  onPlanted(site) {
    hud.banner(`CHARGE PLANTED AT ${site}`, `${SITES[site].name} — 40 seconds to detonation`, 3000);
    hud.radio('You', `Charge planted at ${SITES[site].name} — hold the site`, 'ember');
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
const combatStats = new Map();
function cstat(c) {
  let s = combatStats.get(c);
  if (!s) { s = { k: 0, d: 0, a: 0, hs: 0, dmg: 0, cash: 0 }; combatStats.set(c, s); }
  return s;
}

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
    const st = cstat(attacker);
    st.dmg += Math.round(amount);
    combatant.lastHit = { by: attacker, at: loop.now() };
    if (combatant.isPlayer) rounds.hurtPlayer(amount, attacker, isHead);
    else {
      bots.damage(combatant, amount, isHead, attacker);
      const p = combatant.mover.state.position;
      effects.burst(new THREE.Vector3(p.x, p.y + 1.1, p.z), new THREE.Vector3(0, 1, 0), 7, 0xd92010);
    }
  },
  radio(name, text, team) {
    hud.radio(name, text, team);
  },
  onKill(attacker, victim, isHead) {
    const killerName = attacker.isPlayer ? 'You' : attacker.name;
    const weapon = attacker.isPlayer ? WEAPONS[weapons.state.current].name : WEAPONS[attacker.weapon].name;
    hud.killfeed(killerName, victim.name, isHead, attacker.team, weapon);
    const ks = cstat(attacker);
    ks.k += 1;
    if (isHead) ks.hs += 1;
    ks.cash += 300;
    const lh = victim.lastHit;
    if (lh && lh.by && lh.by !== attacker && loop.now() - lh.at < 5) cstat(lh.by).a += 1;
    cstat(victim).d += 1;
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
  stats,
  closeBuy: () => loop.closeBuy(),
  onPlayerDeath(attacker) {
    const ks = cstat(attacker);
    ks.k += 1;
    ks.cash += 300;
    const lh = player.lastHit;
    if (lh && lh.by && lh.by !== attacker && loop.now() - lh.at < 5) cstat(lh.by).a += 1;
    cstat(player).d += 1;
  },
});

function scoreboardData() {
  const rows = [player, ...bots.list].map((c) => {
    const s = cstat(c);
    return {
      name: c.isPlayer ? 'You' : c.name,
      team: c.team === 'ember' ? 'Ember' : 'Ash',
      k: s.k, a: s.a, d: s.d, hs: s.hs, dmg: s.dmg,
      cash: c.isPlayer ? game.state.money : s.cash,
    };
  });
  rows.sort((a, b) => b.k - a.k || b.hs - a.hs || b.dmg - a.dmg);
  return {
    title: 'SCOREBOARD',
    sub: `Cinder Yard ${game.state.score.ember} — ${game.state.score.ash} · Round ${game.state.round} of 24`,
    rows,
    log: [`Balance: <b>$${game.state.money}</b> · Round ${game.state.round} of 24`, 'Press Tab to close'],
  };
}

loop = createLoop({
  scene, camera, renderer, world, effects, audio, hud, game, input, weapons,
  player, playerMover, playerBody, bots, hearing, grenades, bomb, shooter, economy, rounds,
  getScoreboard: scoreboardData,
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
else requestAnimationFrame(loop.frame);
