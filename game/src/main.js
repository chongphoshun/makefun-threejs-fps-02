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
import { createWeapons, WEAPONS, WEAPON_ORDER, ARMOR_PRICE } from './weapons.js';
import { createBots } from './bots.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createGame, WIN_SCORE } from './game.js';

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
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color('#241812'), 30, 90);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud(world);
const game = createGame();
const input = createInput(renderer.domElement, onLockChange);
const weapons = createWeapons(camera);
const playerMover = createMover(world.colliders, { x: 0, z: 15.5, yaw: 0 });
const raycaster = new THREE.Raycaster();
raycaster.far = 90;

let simTime = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let plantProgress = 0;
let defuseProgress = 0;
let lastWeaponId = 'pistol';
let buyOpen = false;
let noises = [];
const grenades = [];
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
    if (combatant.isPlayer) hurtPlayer(amount, attacker);
    else bots.damage(combatant, amount, isHead, attacker);
  },
  onKill(attacker, victim, isHead) {
    const killerName = attacker.isPlayer ? 'You' : attacker.name;
    hud.killfeed(killerName, victim.name, isHead, attacker.team);
    if (attacker.isPlayer) {
      game.addKillMoney();
      hud.setMoney(game.state.money);
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

function hurtPlayer(amount, attacker) {
  if (!player.alive || game.state.phase !== 'live') return;
  let left = amount;
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
  plantProgress = 0;
  defuseProgress = 0;
  grenades.length = 0;
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
  audio.shot(def.kind, 0);
  noises.push({ x: playerBody.position.x, z: playerBody.position.z, time: simTime });
  if (noises.length > 24) noises.shift();
  if (hit) {
    if (hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const isHead = hit.object.userData.part === 'head';
      const dist = hit.distance;
      const falloff = dist > 25 ? 0.7 : 1;
      const dmg = def.damage * (isHead ? def.headMult : 1) * falloff;
      const wasAlive = bot.alive;
      bots.damage(bot, dmg, isHead, player);
      hud.hitMarker(!bot.alive, 120);
      audio.hit(!bot.alive);
      if (wasAlive && !bot.alive) weapons.state.kick = 0.09;
    } else {
      effects.burst(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), 10);
    }
  }
  weapons.pullTrigger();
  playerMover.recoil(0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  const slot = weapons.ammo[weapons.state.current];
  hud.setAmmo(slot.mag, slot.reserve, def.name.toUpperCase());
}

function throwGrenade() {
  if (!weapons.throwGrenade()) return;
  camera.getWorldDirection(direction);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5 }),
  );
  mesh.position.copy(camera.position).addScaledVector(direction, 0.4);
  scene.add(mesh);
  grenades.push({
    mesh, fuse: 2.6,
    vel: direction.clone().multiplyScalar(15).add(new THREE.Vector3(0, 3.5, 0)).add(playerMover.state.velocity),
  });
  audio.click();
  const slot = weapons.ammo[weapons.state.current];
  hud.setAmmo(slot.mag, slot.reserve, WEAPONS[weapons.state.current].name.toUpperCase());
}

function explodeGrenade(g) {
  const p = g.mesh.position;
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

function tryBuy(id) {
  if (game.state.phase !== 'freeze') return;
  const price = id === 'armor' ? ARMOR_PRICE : WEAPONS[id].price;
  if (!game.spend(price)) { audio.dry(); return; }
  if (id === 'armor') weapons.buyArmor();
  else weapons.buy(id);
  audio.click();
  hud.setMoney(game.state.money);
  hud.setAmmo(weapons.ammo[weapons.state.current].mag, weapons.ammo[weapons.state.current].reserve, WEAPONS[weapons.state.current].name.toUpperCase());
  for (const item of [...WEAPON_ORDER, 'armor']) hud.buyAfford(item, game.state.money);
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
  bots.step(dt, {
    now: simTime, phase, player, noises,
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

  // Plant / defuse channels: hold E inside the right zone.
  const inA = world.inSite(playerBody.position.x, playerBody.position.z, 'A');
  const inB = world.inSite(playerBody.position.x, playerBody.position.z, 'B');
  const siteHere = inA ? 'A' : inB ? 'B' : null;
  const planted = game.state.planted;
  if (player.alive && phase === 'live') {
    if (!planted && siteHere && keys.has('KeyE')) {
      plantProgress += dt;
      hud.setPlant(plantProgress / 3);
      if (plantProgress >= 3) {
        game.plant(siteHere);
        plantProgress = 0;
        hud.setPlant(null);
        hud.banner('CHARGE PLANTED', `Defend ${SITES[siteHere].name} — 40 seconds`, 3000);
        audio.plant();
      }
    } else if (planted && world.inSite(playerBody.position.x, playerBody.position.z, planted.site) && keys.has('KeyE')) {
      defuseProgress += dt;
      hud.setPlant(defuseProgress / 5);
      if (defuseProgress >= 5) {
        defuseProgress = 0;
        hud.setPlant(null);
        endRound('ash', 'You defused the charge');
      }
    } else {
      plantProgress = 0;
      defuseProgress = 0;
      hud.setPlant(null);
    }
    if (!planted && siteHere) hud.prompt('Hold <b>E</b> to plant the charge');
    else if (planted && world.inSite(playerBody.position.x, playerBody.position.z, planted.site)) hud.prompt('Hold <b>E</b> to defuse');
    else hud.prompt(null);
  } else {
    hud.setPlant(null);
    hud.prompt(null);
  }

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
        for (const item of [...WEAPON_ORDER, 'armor']) hud.buyAfford(item, game.state.money);
        audio.click();
      } else hud.hideBuy();
    }
    if (input.takePressed('KeyG')) {
      if (weapons.state.grenades > 0) {
        lastWeaponId = weapons.state.current;
        weapons.switchTo('grenade');
      }
    }
    if (input.takePressed('KeyQ')) weapons.switchTo(lastWeaponId);
    WEAPON_ORDER.forEach((id, i) => {
      if (input.takePressed(`Digit${i + 1}`)) {
        if (game.state.phase === 'freeze' && buyOpen) tryBuy(id);
        else if (id !== weapons.state.current) {
          lastWeaponId = weapons.state.current;
          weapons.switchTo(id);
        }
      }
    });
    if (input.takePressed('Digit6') && game.state.phase === 'freeze' && buyOpen) tryBuy('armor');
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

hud.buildBuyMenu((id) => tryBuy(id));
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
  game.startMatch();
  startRoundSetup();
  if (name === 'start') {
    playerBody.position.set(0, 0, 16.5);
    playerBody.yaw = 0.05;
    settle(20);
    aimAt(new THREE.Vector3(0, 2.2, -8));
    hud.showOverlay('start');
  } else if (name === 'play') {
    game.endFreeze();
    game.state.timer = 62;
    game.state.score = { ember: 2, ash: 1 };
    game.state.round = 4;
    game.state.money = 3200;
    weapons.buy('rifle');
    game.state.money = 3200;
    weapons.switchTo('rifle');
    playerBody.position.set(-1, 0, 8);
    settle(30);
    // One Ash defender holding mid, in the open, for the firefight frame.
    const enemy = bots.list.find((b) => b.team === 'ash');
    enemy.mover.teleport(0.4, -1.5, Math.PI);
    enemy.state = 'hold';
    enemy.path = [];
    settle(10);
    aimAt(new THREE.Vector3(0.4, 1.35, -1.5));
    shoot(0);
    settle(2);
    hud.setScore(2, 1, 4);
    hud.setMoney(3200);
  } else if (name === 'buy') {
    game.state.money = 4250;
    hud.setMoney(4250);
    playerBody.position.set(0, 0, 16.5);
    settle(20);
    aimAt(new THREE.Vector3(0, 2.2, -8));
    hud.showBuy(4250);
    for (const item of [...WEAPON_ORDER, 'armor']) hud.buyAfford(item, 4250);
  } else if (name === 'end') {
    game.state.score = { ember: 3, ash: 1 };
    game.state.round = 5;
    game.state.money = 4150;
    game.state.timer = 3;
    const enemy = bots.list.find((b) => b.team === 'ash');
    enemy.mover.teleport(1.5, 0.5, Math.PI);
    enemy.alive = false;
    enemy.state = 'dead';
    enemy.fallT = 1;
    enemy.parts.group.rotation.x = -1.45;
    enemy.parts.group.position.set(1.5, -0.1, 0.5);
    enemy.parts.group.rotation.y = Math.PI;
    playerBody.position.set(0, 0, 6);
    settle(10);
    aimAt(new THREE.Vector3(1.5, 0.9, 0.5));
    hud.setScore(3, 1, 5);
    hud.setMoney(4150);
    hud.banner('ROUND WON', 'Ash team eliminated', 60000);
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
