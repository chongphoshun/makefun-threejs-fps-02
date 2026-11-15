// EMBERLINE boot and the one loop: a fixed 60 Hz simulation feeding a render at the
// display's rate. This file owns the loop, the player's trigger, the grenades, the plant
// and defuse channels, and the round flow; the modules own their own state.
// ?shot=start|play|buy|end with &seed=N sets up a deterministic frame for a capture,
// renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITES } from './world.js';
import { createMover } from './move.js';
import { createInput } from './input.js';
import { createWeapons, WEAPONS, WEAPON_ORDER, GRENADE_ORDER, ARMOR_PRICE, HELMET_PRICE } from './weapons.js';
import { createBots } from './bots.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createGame, WIN_SCORE } from './game.js';
import { createEconomy } from './economy.js';
import { createBomb } from './bomb.js';

const FIXED_STEP = 1 / 60;
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
  onDefused() { endRound('ash', 'You defused the charge'); },
});
const playerMover = createMover(world.colliders, { x: 0, z: 15.5, yaw: 0 });
const raycaster = new THREE.Raycaster();
raycaster.far = 90;

let simTime = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let lastWeaponId = 'pistol';
let buyOpen = false;
let noises = [];
const grenades = [];
const smokes = [];
const stats = { shots: 0, hits: 0, headshots: 0, kills: 0, deaths: 0 };
const roundKills = []; // Kill positions this round, for the round-report replay map.
const direction = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const shakeVec = new THREE.Vector3();

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

function now() { return simTime; }

function spawnPlayer() {
  const spawn = { x: 0, z: 15.5, yaw: 0 };
  playerMover.teleport(spawn.x, spawn.z, spawn.yaw);
  player.alive = true;
  player.health = 100;
  player.crouching = false;
}

const hooks = {
  now,
  onBotShot(from, to, kind, dist) {
    effects.tracer(from, to, WEAPONS[kind].tracer);
    audio.shot(kind, Math.min(1, dist / 45));
    noises.push({ x: from.x, z: from.z, time: simTime });
    if (noises.length > 24) noises.shift();
  },
  damageCombatant(combatant, amount, isHead, attacker) {
    if (combatant.isPlayer) hurtPlayer(amount, attacker, isHead);
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
    checkElimination();
  },
  onDefuseProgress(bot, progress) {
    if (bot.team === 'ash' && game.state.planted) {
      hud.setPlant(progress / 5);
    }
  },
  onDefused(bot) {
    if (game.state.phase !== 'live' || !game.state.planted) return;
    endRound('ash', `${bot.name} defused the charge`);
  },
};

const bots = createBots(scene, world, hooks);
const shootables = world.shootables.concat(bots.hitMeshes);

function hurtPlayer(amount, attacker, isHead) {
  if (!player.alive || game.state.phase !== 'live') return;
  let left = amount;
  if (isHead && weapons.state.helmet) left *= 0.5;
  if (weapons.state.armor > 0) {
    const absorbed = Math.min(weapons.state.armor, left * 0.5);
    weapons.state.armor -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  hud.damageFlash();
  audio.hurt();
  hud.setHealth(Math.max(0, player.health), weapons.state.armor);
  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
    stats.deaths += 1;
    hud.setHealth(0, weapons.state.armor);
    hud.killfeed(attacker.name, 'You', false, attacker.team);
    hud.showOverlay('dead');
    if (document.pointerLockElement) document.exitPointerLock();
    checkElimination();
  }
}

function checkElimination() {
  if (game.state.phase !== 'live') return;
  const emberAlive = (player.alive ? 1 : 0) + bots.aliveCount('ember');
  const ashAlive = bots.aliveCount('ash');
  if (ashAlive === 0) endRound('ember', 'Ash team eliminated');
  else if (emberAlive === 0) endRound('ash', 'Ember team eliminated');
}

function endRound(winner, reason) {
  const result = game.endRound(winner, reason);
  if (!result) return;
  effects.clearBomb();
  buyOpen = false;
  hud.hideBuy();
  hud.setPlant(null);
  hud.setBomb(null);
  hud.setScore(result.score.ember, result.score.ash, game.state.round);
  if (result.matchOver) {
    const won = winner === 'ember';
    hud.setEndOverlay(
      won ? 'MATCH WON' : 'MATCH LOST',
      `Cinder Yard ${result.score.ember} — ${result.score.ash}. ${won ? 'Ember takes the yard.' : 'Ash holds the yard.'}`,
      'Play again',
    );
    if (won) audio.roundWin(); else audio.roundLose();
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    hud.banner(winner === 'ember' ? 'ROUND WON' : 'ROUND LOST', reason, 3400);
    if (winner === 'ember') audio.roundWin(); else audio.roundLose();
  }
}

function startRoundSetup() {
  const survived = player.alive;
  if (!survived) weapons.resetLoadout();
  else weapons.refill();
  spawnPlayer();
  bots.reset(game.state.round);
  bomb.reset();
  grenades.length = 0;
  roundKills.length = 0;
  effects.clearBomb();
  hud.setHealth(100, weapons.state.armor);
  hud.setMoney(game.state.money);
  const slot = weapons.ammo[weapons.state.current];
  hud.setAmmo(slot.mag, slot.reserve, WEAPONS[weapons.state.current].name.toUpperCase());
  hud.setScore(game.state.score.ember, game.state.score.ash, game.state.round);
  hud.setAlive(5, 5);
  hud.setBomb(null);
  hud.setPlant(null);
  hud.prompt(null);
}

function muzzleWorld(out) {
  camera.getWorldDirection(direction);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  out.copy(camera.position).addScaledVector(direction, 0.6).addScaledVector(right, 0.22);
  out.y -= 0.16;
  return out;
}

function shoot(spread) {
  const def = weapons.def();
  if (def.kind === 'grenade') {
    throwGrenade();
    return;
  }
  if (!weapons.takeRound()) {
    audio.dry();
    weapons.pullTrigger();
    return;
  }
  stats.shots += 1;
  const pellets = def.pellets || 1;
  let anyHit = false;
  let anyKill = false;
  for (let p = 0; p < pellets; p += 1) {
    camera.getWorldDirection(direction);
    direction.x += (random() * 2 - 1) * spread;
    direction.y += (random() * 2 - 1) * spread;
    direction.z += (random() * 2 - 1) * spread;
    direction.normalize();
    scene.updateMatrixWorld(true);
    raycaster.set(camera.position, direction);
    const hit = raycaster.intersectObjects(shootables, false)[0];
    const from = muzzleWorld(new THREE.Vector3());
    const end = hit ? hit.point : camera.position.clone().addScaledVector(direction, 70);
    effects.tracer(from, end, def.tracer);
    if (hit) {
      if (hit.object.userData.bot) {
        const bot = hit.object.userData.bot;
        const part = hit.object.userData.part;
        const isHead = part === 'head';
        const isLeg = part === 'leg';
        const dist = hit.distance;
        const falloff = dist > 25 ? 0.7 : 1;
        const mult = isHead ? def.headMult : isLeg ? 0.75 : 1;
        const dmg = def.damage * mult * falloff;
        const wasAlive = bot.alive;
        bots.damage(bot, dmg, isHead, player);
        stats.hits += 1;
        if (isHead) stats.headshots += 1;
        anyHit = true;
        if (wasAlive && !bot.alive) anyKill = true;
      } else {
        effects.burst(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), 10);
        effects.decal(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0));
      }
    }
  }
  audio.shot(def.kind, 0);
  noises.push({ x: playerBody.position.x, z: playerBody.position.z, time: simTime });
  if (noises.length > 24) noises.shift();
  if (anyHit) {
    hud.hitMarker(anyKill, 120);
    audio.hit(anyKill);
    if (anyKill) weapons.state.kick = 0.09;
  }
  weapons.pullTrigger();
  playerMover.recoil(0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  // One brass casing out of the gun, to the right.
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  effects.casing(muzzleWorld(new THREE.Vector3()), right);
  const slot = weapons.ammo[weapons.state.current];
  hud.setAmmo(slot.mag, slot.reserve, def.name.toUpperCase());
}

function throwGrenade() {
  const type = weapons.state.current;
  if (!weapons.throwGrenade()) return;
  camera.getWorldDirection(direction);
  const color = type === 'he' ? PALETTE.accent : type === 'smoke' ? 0x9a9a9a : 0xffffff;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5 }),
  );
  mesh.position.copy(camera.position).addScaledVector(direction, 0.4);
  scene.add(mesh);
  grenades.push({
    mesh, fuse: 2.6, type,
    vel: direction.clone().multiplyScalar(15).add(new THREE.Vector3(0, 3.5, 0)).add(playerMover.state.velocity),
  });
  audio.click();
  const slot = weapons.ammo[weapons.state.current];
  hud.setAmmo(slot.mag, slot.reserve, WEAPONS[weapons.state.current].name.toUpperCase());
}

function explodeGrenade(g) {
  const p = g.mesh.position;
  if (g.type === 'smoke') {
    effects.smokeCloud(p);
    smokes.push({ x: p.x, y: p.y + 1, z: p.z, r: 4.5, until: simTime + 14 });
    audio.boom(Math.min(1, camera.position.distanceTo(p) / 40));
    scene.remove(g.mesh);
    return;
  }
  if (g.type === 'flash') {
    effects.flashBurst(p);
    audio.boom(Math.min(1, camera.position.distanceTo(p) / 40));
    blindFromFlash(p);
    scene.remove(g.mesh);
    return;
  }
  effects.explosion(p, 6);
  audio.boom(Math.min(1, camera.position.distanceTo(p) / 40));
  effects.addShake(0.4);
  const victims = [player, ...bots.list.filter((b) => b.alive)];
  for (const v of victims) {
    const body = v.isPlayer ? v.pos : v.mover.state.position;
    const dx = body.x - p.x;
    const dy = body.y + 1 - p.y;
    const dz = body.z - p.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 6.5) continue;
    // A wall between the blast and the body saves it.
    raycaster.set(p, new THREE.Vector3(dx / dist, dy / dist, dz / dist));
    raycaster.far = dist;
    if (raycaster.intersectObjects(world.shootables, false)[0]) continue;
    const dmg = 120 * (1 - dist / 7);
    if (v.isPlayer) hurtPlayer(dmg, { name: 'SPARK-4', team: 'ash' });
    else bots.damage(v, dmg, false, player);
  }
  scene.remove(g.mesh);
}

// A flashbang blinds anyone who can see the burst: the player gets a white wash,
// bots stand blind for a couple of seconds. A wall between eye and burst saves you.
function blindFromFlash(p) {
  const eye = camera.position;
  const distP = eye.distanceTo(p);
  if (distP < 25) {
    camera.getWorldDirection(direction);
    const toFlash = new THREE.Vector3().subVectors(p, eye).normalize();
    const facing = direction.dot(toFlash);
    if (facing > 0.2) {
      raycaster.set(eye, toFlash);
      raycaster.far = distP;
      if (!raycaster.intersectObjects(world.shootables, false)[0]) {
        hud.flashBlind((1 - distP / 25) * (0.4 + facing * 0.6));
      }
    }
  }
  for (const bot of bots.list) {
    if (!bot.alive) continue;
    const body = bot.mover.state.position;
    const dx = p.x - body.x;
    const dy = (p.y - 1.5) - body.y;
    const dz = p.z - body.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 20 || dist < 0.01) continue;
    raycaster.set(p, new THREE.Vector3(-dx / dist, -dy / dist, -dz / dist));
    raycaster.far = dist;
    if (raycaster.intersectObjects(world.shootables, false)[0]) continue;
    bots.blind(bot, simTime + 2.2);
  }
}

function stepGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i -= 1) {
    const g = grenades[i];
    g.fuse -= dt;
    g.vel.y -= 14 * dt;
    g.mesh.position.addScaledVector(g.vel, dt);
    const p = g.mesh.position;
    const r = 0.09;
    // Cheap AABB bounce: test the point against every collider, reflect the axis it hit.
    for (const c of world.colliders) {
      if (p.x > c.min.x - r && p.x < c.max.x + r && p.y > c.min.y - r && p.y < c.max.y + r && p.z > c.min.z - r && p.z < c.max.z + r) {
        const dxMin = p.x - (c.min.x - r);
        const dxMax = (c.max.x + r) - p.x;
        const dyMin = p.y - (c.min.y - r);
        const dyMax = (c.max.y + r) - p.y;
        const dzMin = p.z - (c.min.z - r);
        const dzMax = (c.max.z + r) - p.z;
        const m = Math.min(dxMin, dxMax, dyMin, dyMax, dzMin, dzMax);
        if (m === dxMin || m === dxMax) g.vel.x *= -0.45;
        else if (m === dyMin || m === dyMax) { g.vel.y *= -0.45; if (m === dyMin) p.y = c.min.y - r; else p.y = c.max.y + r; }
        else g.vel.z *= -0.45;
        audio.bounce();
      }
    }
    if (p.y < r) { p.y = r; g.vel.y = Math.abs(g.vel.y) * 0.45; }
    if (g.fuse <= 0) {
      explodeGrenade(g);
      grenades.splice(i, 1);
    }
  }
}

function syncCamera() {
  camera.position.set(playerBody.position.x, playerBody.position.y + playerBody.eye, playerBody.position.z);
  camera.rotation.set(playerBody.pitch, playerBody.yaw, 0, 'YXZ');
  effects.shakeOffset(shakeVec);
  camera.position.x += shakeVec.x;
  camera.position.y += shakeVec.y;
}

function aimAt(point) {
  const dx = point.x - playerBody.position.x;
  const dy = point.y - (playerBody.position.y + playerBody.eye);
  const dz = point.z - playerBody.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  playerBody.yaw = Math.atan2(-dx, -dz);
  playerBody.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncCamera();
}

function step(dt) {
  simTime += dt;
  const phase = game.state.phase;
  const keys = input.state.keys;

  // Movement wish from the keys, relative to the yaw.
  const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const sin = Math.sin(playerBody.yaw);
  const cos = Math.cos(playerBody.yaw);
  let wishX = 0;
  let wishZ = 0;
  if (forward || strafe) {
    wishX = -sin * forward + cos * strafe;
    wishZ = -cos * forward - sin * strafe;
    const len = Math.hypot(wishX, wishZ) || 1;
    wishX /= len;
    wishZ /= len;
  }
  const walking = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = walking ? 2.6 : 5.2;
  const crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
  const jump = keys.has('Space');
  if (player.alive && (phase === 'live' || phase === 'freeze')) {
    playerMover.step(dt, wishX, wishZ, speed, jump, crouch);
  }
  player.crouching = playerBody.crouching;
  player.speed = playerMover.groundSpeed();

  // ADS: right mouse narrows the field of view and tightens the spread.
  weapons.state.aiming = input.state.aiming && player.alive;
  const targetFov = weapons.state.aiming ? (weapons.state.current === 'sniper' ? 42 : 58) : 74;
  if (Math.abs(camera.fov - targetFov) > 0.2) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
  }

  weapons.step(dt);
  effects.step(dt);
  stepGrenades(dt);

  // Bots run their own simulation every step.
  for (let i = smokes.length - 1; i >= 0; i -= 1) {
    if (smokes[i].until <= simTime) smokes.splice(i, 1);
  }
  bots.step(dt, {
    now: simTime, phase, player, noises, smokes,
    plantedSite: game.state.planted ? game.state.planted.site : null,
  });

  // The match clock and its events.
  const event = game.tick(dt);
  if (event) {
    if (event.event === 'live') {
      buyOpen = false;
      hud.hideBuy();
      hud.banner(`ROUND ${game.state.round}`, game.state.round === 1 ? 'Plant the charge at A or B' : 'Plant the charge at A or B', 2400);
    } else if (event.event === 'detonation') {
      const site = game.state.planted.site;
      effects.explosion(new THREE.Vector3(SITES[site].center.x, 1, SITES[site].center.z), 6);
      audio.boom(0);
      effects.addShake(0.7);
      endRound('ember', `Charge detonated at ${SITES[site].name}`);
    } else if (event.event === 'timeout') {
      endRound('ash', 'Time expired — charge never planted');
    } else if (event.event === 'round') {
      startRoundSetup();
      hud.banner(`ROUND ${game.state.round}`, 'Buy up — B opens the shop', 2400);
    }
  }

  // Plant / defuse channels: hold E inside the right zone (bomb.js).
  bomb.step(dt, keys, phase);

  // Per-site colour grade: warm on A, cool on B, warm spawn, neutral in mid.
  const zone = inA ? 'A' : inB ? 'B' : playerBody.position.z > 12 ? 'spawn' : 'mid';
  hud.setGrade(zone);

  // HUD numbers, every step (the setters skip unchanged values).
  hud.setHealth(Math.max(0, player.health), weapons.state.armor);
  const slot = weapons.ammo[weapons.state.current];
  hud.setAmmo(slot.mag, slot.reserve, WEAPONS[weapons.state.current].name.toUpperCase());
  hud.setTimer(game.timeLeft());
  hud.setAlive((player.alive ? 1 : 0) + bots.aliveCount('ember'), bots.aliveCount('ash'));
  if (planted) {
    hud.setBomb(`CHARGE AT ${SITES[planted.site].name} — ${Math.ceil(planted.timeLeft)}s`, planted.timeLeft / 40);
  } else hud.setBomb(null);
  const spread = weapons.spread(playerMover.groundSpeed());
  hud.setSpread(4 + spread * 900);
}

function frame(now) {
  requestAnimationFrame(frameWithMap);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (player.alive && input.state.locked) playerMover.look(look.x * (weapons.state.aiming ? 0.6 : 1), look.y * (weapons.state.aiming ? 0.6 : 1));
    const phase = game.state.phase;
    if (player.alive && (phase === 'live' || phase === 'freeze')) {
      const def = weapons.def();
      if (def.auto) {
        if (input.state.firing && weapons.ready()) shoot(weapons.spread(playerMover.groundSpeed()));
      } else if (input.takePressed('MouseLeft') && weapons.ready()) {
        shoot(weapons.spread(playerMover.groundSpeed()));
      }
    }
    if (input.takePressed('KeyR')) {
      if (weapons.reload()) audio.reload();
    }
    if (input.takePressed('KeyB') && game.state.phase === 'freeze') {
      buyOpen = !buyOpen;
      if (buyOpen) {
        hud.showBuy(game.state.money);
        for (const item of [...WEAPON_ORDER, 'armor', 'helmet']) hud.buyAfford(item, game.state.money);
        audio.click();
      } else hud.hideBuy();
    }
    if (input.takePressed('KeyG')) {
      weapons.nextGrenade();
    }
    if (input.takePressed('KeyQ')) weapons.switchTo(lastWeaponId);
    WEAPON_ORDER.forEach((id, i) => {
      if (input.takePressed(`Digit${i + 1}`)) {
        if (game.state.phase === 'freeze' && buyOpen) economy.tryBuy(id);
        else if (id !== weapons.state.current) {
          lastWeaponId = weapons.state.current;
          weapons.switchTo(id);
        }
      }
    });
    if (input.takePressed('Digit9') && game.state.phase === 'freeze' && buyOpen) economy.tryBuy('armor');
    if (input.takePressed('Digit0') && game.state.phase === 'freeze' && buyOpen) economy.tryBuy('helmet');
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

let mapTimer = 0;
function frameWithMap(now) {
  frame(now);
  mapTimer += 1;
  if (mapTimer % 6 === 0 && !frozen) {
    hud.drawMinimap(player, bots, game.state.planted ? game.state.planted.site : null, simTime);
  }
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
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
    startRoundSetup();
    hud.banner('ROUND 1', 'Plant the charge at A or B', 2600);
    input.requestLock();
  } else if (game.state.phase === 'matchEnd') {
    game.startMatch();
    startRoundSetup();
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

// ---- Deterministic captures for screenshots/ ----
function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBuy();
  hud.hideScoreboard();
  game.startMatch();
  startRoundSetup();
  if (name === 'firefight') {
    // The cover: a wide firefight in the open courtyard, not a corridor. Three Ash
    // defenders in view, a fresh shot in the air (muzzle flash + tracer still live
    // at capture), smoke drifting, sparks and a scorch decal on the mid wall,
    // full HUD, killfeed and radio rows pinned so the virtual-time capture keeps them.
    game.endFreeze();
    game.state.timer = 52;
    game.state.score = { ember: 4, ash: 3 };
    game.state.round = 8;
    game.state.money = 5200;
    weapons.buy('rifle');
    game.state.money = 5200;
    weapons.switchTo('rifle');
    // Staged in the courtyard plaza looking north: paving ring and flag to the
    // left, mid walls and the sunset sky ahead, three defenders in the open.
    player.health = 74;
    playerBody.position.set(2, 0, 13);
    settle(30);
    const enemies = bots.list.filter((b) => b.team === 'ash');
    const spots = [[-5, 5], [1, 3], [5, 6]];
    for (let i = 0; i < 3; i += 1) {
      enemies[i].mover.teleport(spots[i][0], spots[i][1], Math.PI);
      enemies[i].state = 'hold';
      enemies[i].path = [];
    }
    settle(10);
    aimAt(new THREE.Vector3(1, 1.35, 3));
    shoot(0);
    // One sim step so the muzzle flash sprite and the hit flash on the struck
    // bot actually become visible before the capture freezes the frame.
    step(FIXED_STEP);
    // Effects in frame: drifting smoke, sparks and a scorch decal on the mid wall.
    effects.smokeCloud(new THREE.Vector3(-6, 1, 2));
    effects.burst(new THREE.Vector3(2.8, 1.5, 0), new THREE.Vector3(-1, 0, 0), 12);
    effects.decal(new THREE.Vector3(2.79, 1.5, 0.5), new THREE.Vector3(-1, 0, 0));
    // Return fire: a blue tracer from the middle defender back past the camera.
    effects.tracer(new THREE.Vector3(1, 1.35, 3), new THREE.Vector3(2.5, 1.2, 11), 0x7fb8ff);
    hud.hitMarker(false, 60000);
    hud.setScore(4, 3, 8);
    hud.setMoney(5200);
    hud.killfeed('Vex', 'Onyx', true, 'ember', true);
    hud.killfeed('You', 'Wren', false, 'ember', true);
    hud.radio('Rook', 'Contact — courtyard, three of them', 'ember', true);
    hud.radio('Vex', 'Holding mid, need backup', 'ember', true);
  } else if (name === 'buy') {
    game.state.money = 6400;
    hud.setMoney(6400);
    game.state.score = { ember: 4, ash: 4 };
    game.state.round = 9;
    playerBody.position.set(0, 0, 16.5);
    settle(20);
    // Look up the yard: courtyard paving, beams, signage and the sunset sky
    // behind the buy menu, not a flat wall.
    aimAt(new THREE.Vector3(0, 3.5, -18));
    hud.setScore(4, 4, 9);
    hud.showBuy(6400);
    for (const item of [...WEAPON_ORDER, 'armor', 'helmet']) hud.buyAfford(item, 6400);
  } else if (name === 'plant') {
    // Plant in progress at A: progress bar two-thirds full, prompt up, one Ash
    // defender visible guarding the site, bomb timer still on the round clock.
    game.endFreeze();
    game.state.timer = 41;
    game.state.score = { ember: 6, ash: 4 };
    game.state.round = 11;
    game.state.money = 3800;
    weapons.buy('rifle');
    game.state.money = 3800;
    weapons.switchTo('rifle');
    const enemy = bots.list.find((b) => b.team === 'ash');
    enemy.mover.teleport(-15.5, -12.5, Math.PI * 0.5);
    enemy.state = 'hold';
    enemy.path = [];
    // Stand off at the site's east edge so the defender is in the open, not
    // behind the site containers. One step back from the original take; a second
    // step back put a spawn bot in frame, so this is the best framing.
    playerBody.position.set(-6, 0, -12);
    settle(10);
    aimAt(new THREE.Vector3(-15.5, 1.3, -12.5));
    // Smoke drifting over the site and the charge on the ground, lamp blinking.
    effects.smokeCloud(new THREE.Vector3(-13, 1, -10));
    effects.plantBomb(SITES.A.center.x, SITES.A.center.z);
    plantProgress = 2;
    hud.setPlant(2 / 3);
    hud.prompt('Hold <b>E</b> to plant the charge');
    hud.radio('Iris', 'Planting A — cover me', 'ember', true);
    hud.setScore(6, 4, 11);
    hud.setMoney(3800);
  } else if (name === 'scoreboard') {
    // After-action report of a finished round: the scoreboard panel over a live
    // scene, with the round's kills, headshots, accuracy and economy on it.
    game.state.score = { ember: 7, ash: 5 };
    game.state.round = 12;
    game.state.money = 6800;
    const enemy = bots.list.find((b) => b.team === 'ash');
    enemy.mover.teleport(16.5, -11.5, Math.PI);
    enemy.alive = false;
    enemy.state = 'dead';
    enemy.fallT = 1;
    enemy.parts.group.rotation.x = -1.45;
    enemy.parts.group.position.set(16.5, -0.1, -11.5);
    enemy.parts.group.rotation.y = Math.PI;
    // Standing at B site: teal walls and the big "B" floor decal fill the
    // background around the panel.
    playerBody.position.set(12, 0, -7.5);
    settle(10);
    aimAt(new THREE.Vector3(16.5, 0.9, -11.5));
    game.state.timer = 0;
    hud.setScore(7, 5, 12);
    hud.setMoney(6800);
    hud.killfeed('You', 'Kestrel', true, 'ember', true);
    hud.showScoreboard({
      title: 'ROUND 12 — EMBER WINS',
      sub: 'Charge detonated at Warehouse · Cinder Yard 7 — 5 · Round 12 of 24',
      rows: [
        { name: 'You', team: 'Ember', k: 4, d: 1, hs: 2, acc: '57%' },
        { name: 'Vex', team: 'Ember', k: 3, d: 2, hs: 1, acc: '48%' },
        { name: 'Rook', team: 'Ember', k: 2, d: 1, hs: 0, acc: '44%' },
        { name: 'Kestrel', team: 'Ash', k: 3, d: 2, hs: 1, acc: '52%' },
        { name: 'Onyx', team: 'Ash', k: 1, d: 3, hs: 0, acc: '38%' },
      ],
      log: [
        '<b>+$3,250</b> round win &nbsp;·&nbsp; <b>+$300</b> × 4 kills &nbsp;·&nbsp; <b>+$300</b> plant bonus',
        'Loss streak bonus: $0 · Balance: <b>$6,800</b> · Next round: buy up with B',
      ],
      // The replay map: the push up the west lane to A, kill dots along the way,
      // the charge diamond on the site.
      kills: [
        { x: -16, z: -12, team: 'ember', killer: 'You' },
        { x: -14, z: -11, team: 'ember', killer: 'You' },
        { x: -10, z: -8, team: 'ember', killer: 'Vex' },
        { x: -6, z: -5, team: 'ash', killer: 'Kestrel' },
        { x: 0, z: 0, team: 'ember', killer: 'You' },
        { x: -17, z: -13, team: 'ash', killer: 'Rook' },
      ],
      plantSite: 'A',
    });
  }
  hud.setAlive((player.alive ? 1 : 0) + bots.aliveCount('ember'), bots.aliveCount('ash'));
  hud.setHealth(Math.max(0, player.health), weapons.state.armor);
  const slot = weapons.ammo[weapons.state.current];
  hud.setAmmo(slot.mag, slot.reserve, WEAPONS[weapons.state.current].name.toUpperCase());
  hud.setTimer(game.timeLeft());
  hud.drawMinimap(player, bots, game.state.planted ? game.state.planted.site : null, simTime);
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

// ---- Headless self-test: ?selftest=1 drives a scripted player through real rounds ----
// (walk north, shoot the nearest Ash bot when the gun is ready) and reports the result
// in document.title. It exercises the same step() the live game runs: bot AI, rounds,
// the bomb clock, the economy. It never runs in normal play.
function runSelfTest() {
  const t0 = performance.now();
  const errors = [];
  game.startMatch();
  startRoundSetup();
  input.state.keys.add('KeyW');
  let steps = 0;
  const maxSteps = 60 * 240; // 4 sim-minutes, or until the match ends
  try {
    while (steps < maxSteps) {
      step(FIXED_STEP);
      steps += 1;
      if (game.state.phase === 'live' && weapons.ready()) {
        const target = bots.list.find((b) => b.team === 'ash' && b.alive);
        if (target) {
          const p = target.mover.state.position;
          aimAt(new THREE.Vector3(p.x, 1.2, p.z));
          shoot(weapons.spread(0));
        }
      }
      if (game.state.phase === 'matchEnd') break;
    }
  } catch (e) {
    errors.push(String((e && e.stack) || e));
  }
  document.title = `SELFTEST ${JSON.stringify({
    steps, simSeconds: Math.round(steps / 60), round: game.state.round,
    score: game.state.score, money: game.state.money, playerAlive: player.alive,
    ashAlive: bots.aliveCount('ash'), emberAlive: bots.aliveCount('ember'),
    phase: game.state.phase, ms: Math.round(performance.now() - t0), errors,
  })}`;
  window.__selftest = true;
  paintTwiceThenReady();
}

syncCamera();
if (params.get('selftest')) runSelfTest();
else if (shot) runShot(shot);
else requestAnimationFrame(frameWithMap);
