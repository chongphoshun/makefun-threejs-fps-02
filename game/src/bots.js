// The bots: four Ember teammates and five Ash defenders. Bodies on the shared
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createMover } from './move.js';
import { SPAWNS } from './world.js';

const EMBER_NAMES = ['Vex', 'Rook', 'Iris', 'Moss'];
const ASH_NAMES = ['Kestrel', 'Onyx', 'Sable', 'Wren', 'Flint'];
const BOT_DAMAGE = { rifle: 26, smg: 20 };
const BOT_RATE = { rifle: 0.12, smg: 0.09 };
const REACT = { ember: 0.22, ash: 0.3 };

function raySphere(origin, dir, center, radius) {
  const ox = center.x - origin.x;
  const oy = center.y - origin.y;
  const oz = center.z - origin.z;
  const t = ox * dir.x + oy * dir.y + oz * dir.z;
  if (t < 0) return -1;
  const dx = ox - dir.x * t;
  const dy = oy - dir.y * t;
  const dz = oz - dir.z * t;
  const d2 = dx * dx + dy * dy + dz * dz;
  return d2 <= radius * radius ? t : -1;
}

export function createBots(scene, world, hooks) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;
  const tmpDir = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();
  const tmpEye = new THREE.Vector3();
  const tmpChest = new THREE.Vector3();
  const tmpHead = new THREE.Vector3();
  const tmpMuzzle = new THREE.Vector3();

  const teamMat = {
    ember: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.6, metalness: 0.05 }),
    ash: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ash), roughness: 0.6, metalness: 0.05 }),
  };
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.surface), roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.6 });

  const bots = [];
  const hitMeshes = [];
  const spotted = new Map();
  let activeSmokes = [];

  function areaName(x, z) {
    if (x < -9) return 'Kiln Hall';
    if (x > 9) return 'Clay Pits';
    if (z > 8) return 'Courtyard';
    return 'Mid';
  }

  function nameplate(name, color) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 32;
    const x = c.getContext('2d');
    x.font = 'bold 20px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#000'; x.shadowBlur = 4;
    x.fillStyle = color;
    x.fillText(name.toUpperCase(), 64, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(0.9, 0.225, 1);
    return sp;
  }

  function buildModel(bot) {
    const group = new THREE.Group();
    const mat = teamMat[bot.team];
    const torsoMat = mat.clone();
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.16), darkMat);
    legL.position.set(-0.11, 0.26, 0);
    legL.userData = { bot, part: 'leg' };
    const legR = legL.clone();
    legR.position.x = 0.11;
    legR.userData = { bot, part: 'leg' };
    for (const leg of [legL, legR]) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.28), darkMat);
      boot.position.set(0, -0.22, 0.04);
      leg.add(boot);
    }
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), torsoMat);
    torso.position.y = 1.06;
    torso.userData = { bot, part: 'torso' };
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.34), mat);
    vest.position.y = 1.1;
    const rig = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.06), darkMat);
    rig.position.set(0, 1.08, -0.19);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.18), darkMat);
    pack.position.set(0, 1.1, 0.26);
    const roll = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.2), mat);
    roll.position.set(0, 1.4, 0.26);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), skinMat);
    head.position.y = 1.56;
    head.userData = { bot, part: 'head' };
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), mat);
    helmet.scale.set(1, 0.65, 1.1);
    helmet.position.y = 1.66;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.04), darkMat);
    visor.position.set(0, 1.6, -0.15);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), darkMat);
    armL.position.set(-0.33, 1.12, -0.08);
    armL.rotation.x = -0.5;
    const armR = armL.clone();
    armR.position.x = 0.33;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.55), darkMat);
    gun.position.set(0.14, 1.28, -0.3);
    const plate = nameplate(bot.name, bot.team === 'ember' ? PALETTE.accent : PALETTE.ash);
    plate.position.y = 1.98;
    group.add(legL, legR, torso, vest, rig, pack, roll, head, helmet, visor, armL, armR, gun, plate);
    group.traverse((mesh) => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
    hitMeshes.push(torso, head, legL, legR);
    return { group, legL, legR, torso, torsoMat, armL, armR, head, gun };
  }

  function makeBot(team, name, index) {
    const bot = {
      id: `${team}-${index}`, name, team, index,
      weapon: team === 'ash' ? 'rifle' : index % 2 === 0 ? 'rifle' : 'smg',
      mover: null, parts: null,
      health: 100, armor: 0, alive: true,
      role: 'hold', state: 'hold', path: [], pathIdx: 0, holdNode: 0,
      target: null, targetIsPlayer: false,
      lastSeen: new THREE.Vector3(), lastSeenTime: -99,
      reactAt: 0, burstLeft: 0, nextShotAt: 0, pauseUntil: 0, blindUntil: 0,
      strafeDir: 1, strafeUntil: 0, scanPhase: Math.random() * 6,
      defuseT: 0, fallT: 0, flashT: 0, walkPhase: Math.random() * 6, speed: 4.2,
      fallDir: 1, fallAxis: 'x', aimBlend: 0,
      hearAt: 0, stepAt: 0, hearPos: new THREE.Vector3(), thinkAt: Math.random() * 0.15,
    };
    const spawn = SPAWNS[team][index % SPAWNS[team].length];
    bot.mover = createMover(world.colliders, { x: spawn.x, z: spawn.z, yaw: spawn.yaw, walkSpeed: bot.speed });
    bot.parts = buildModel(bot);
    scene.add(bot.parts.group);
    bots.push(bot);
    return bot;
  }
  EMBER_NAMES.forEach((name, i) => makeBot('ember', name, i));
  ASH_NAMES.forEach((name, i) => makeBot('ash', name, i));

  function bodyOf(combatant) {
    return combatant.isPlayer ? combatant.pos : combatant.mover.state.position;
  }

  function canSee(bot, combatant) {
    const from = tmpEye.set(bodyOf(bot).x, bodyOf(bot).y + 1.5, bodyOf(bot).z);
    const to = tmpChest.set(bodyOf(combatant).x, bodyOf(combatant).y + 1.05, bodyOf(combatant).z);
    const dist = from.distanceTo(to);
    tmpDir.copy(to).sub(from).normalize();
    raycaster.set(from, tmpDir);
    raycaster.far = dist;
    const blocked = raycaster.intersectObjects(world.shootables, false)[0];
    if (blocked) return false;
    for (const s of activeSmokes) {
      const cx = s.x - from.x;
      const cy = s.y - from.y;
      const cz = s.z - from.z;
      const t = Math.max(0, Math.min(dist, cx * tmpDir.x + cy * tmpDir.y + cz * tmpDir.z));
      const dx = from.x + tmpDir.x * t - s.x;
      const dy = from.y + tmpDir.y * t - s.y;
      const dz = from.z + tmpDir.z * t - s.z;
      if (dx * dx + dy * dy + dz * dz < s.r * s.r) return false;
    }
    return true;
  }

  function aimError(bot, combatant, dist) {
    const speed = combatant.isPlayer ? combatant.speed : combatant.mover.groundSpeed();
    let err = 0.016 + dist * 0.0011 + speed * 0.0035;
    if (combatant.isPlayer && combatant.crouching) err += 0.005;
    if (bot.mover.groundSpeed() > 1) err += 0.012;
    return err;
  }

  function botShoot(bot, combatant, now) {
    const muzzle = tmpMuzzle.set(bodyOf(bot).x, bodyOf(bot).y + 1.35, bodyOf(bot).z);
    const chest = tmpChest.set(bodyOf(combatant).x, bodyOf(combatant).y + 1.05, bodyOf(combatant).z);
    const head = tmpHead.set(bodyOf(combatant).x, bodyOf(combatant).y + 1.52, bodyOf(combatant).z);
    const dist = muzzle.distanceTo(chest);
    tmpDir.copy(chest).sub(muzzle).normalize();
    const err = aimError(bot, combatant, dist);
    tmpDir.x += (Math.random() * 2 - 1) * err;
    tmpDir.y += (Math.random() * 2 - 1) * err;
    tmpDir.z += (Math.random() * 2 - 1) * err;
    tmpDir.normalize();
    raycaster.set(muzzle, tmpDir);
    raycaster.far = dist + 4;
    const wall = raycaster.intersectObjects(world.shootables, false)[0];
    const end = wall ? wall.point : tmpTarget.copy(muzzle).addScaledVector(tmpDir, dist + 2);
    let hit = false;
    let isHead = false;
    if (!wall || wall.distance > dist) {
      const tHead = raySphere(muzzle, tmpDir, head, 0.2);
      const tBody = raySphere(muzzle, tmpDir, chest, 0.42);
      if (tHead >= 0 && (tBody < 0 || tHead <= tBody)) { hit = true; isHead = true; }
      else if (tBody >= 0) hit = true;
    }
    hooks.onBotShot(muzzle.clone(), end.clone ? end.clone() : end, bot.weapon, dist);
    if (!hit) return;
    const falloff = dist > 25 ? 0.7 : 1;
    const dmg = BOT_DAMAGE[bot.weapon] * falloff * (isHead ? 3 : 1);
    hooks.damageCombatant(combatant, dmg, isHead, bot);
  }

  function setPath(bot, path, state) {
    bot.path = path;
    bot.pathIdx = 0;
    bot.state = state;
  }

  function damage(bot, amount, isHead, attacker) {
    if (!bot.alive) return;
    let left = amount;
    if (isHead && bot.helmet) left *= 0.5;
    if (bot.armor > 0) {
      const absorbed = Math.min(bot.armor, left * 0.5);
      bot.armor -= absorbed;
      left -= absorbed;
    }
    bot.health -= left;
    bot.defuseT = 0;
    bot.flashT = 1; // hit flash: the torso glows red briefly, decaying in stepBot.
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.state = 'dead';
      bot.fallT = 0;
      bot.fallDir = Math.random() < 0.5 ? 1 : -1;
      bot.fallAxis = Math.random() < 0.6 ? 'x' : 'z';
      bot.target = null;
      hooks.onKill(attacker, bot, isHead);
      const mate = bots.find((b) => b.team === bot.team && b.alive && b !== bot);
      if (mate && hooks.radio) hooks.radio(mate.name, `Man down — ${areaName(bot.mover.state.position.x, bot.mover.state.position.z)}`, bot.team);
    } else if (attacker) {
      bot.lastSeen.set(bodyOf(attacker).x, bodyOf(attacker).y, bodyOf(attacker).z);
      bot.lastSeenTime = hooks.now();
      if (bot.state !== 'engage') bot.state = 'investigate';
      bot.hearPos.copy(bot.lastSeen);
    }
  }

  function reset(round) {
    bots.forEach((bot, index) => {
      const spawn = SPAWNS[bot.team][index % SPAWNS[bot.team].length];
      bot.mover.teleport(spawn.x, spawn.z, spawn.yaw);
      bot.health = 100;
      bot.armor = bot.team === 'ash' && round >= 2 ? 50 : 0;
      bot.helmet = round >= 3;
      bot.alive = true;
      bot.state = 'hold';
      bot.target = null;
      bot.blindUntil = 0;
      bot.defuseT = 0;
      bot.fallT = 0;
      bot.flashT = 0;
      bot.parts.torsoMat.emissive.setHex(0x000000);
      bot.parts.torsoMat.emissiveIntensity = 0;
      bot.burstLeft = 0;
      bot.fallDir = 1;
      bot.fallAxis = 'x';
      bot.aimBlend = 0;
      bot.parts.group.rotation.set(0, 0, 0);
      bot.parts.armL.rotation.z = 0;
      bot.parts.armR.rotation.z = 0;
      bot.parts.group.position.y = 0;
      bot.parts.group.visible = true;
      const startNode = world.nearestNode(spawn.x, spawn.z);
      if (bot.team === 'ember') {
        const routes = [[20], [21], [9, 20], [10, 21]];
        const route = routes[index % routes.length];
        setPath(bot, world.nav.routeThrough(startNode, route), 'advance');
        bot.role = route[route.length - 1] === 20 ? 'rushA' : 'rushB';
      } else {
        const holds = [25, 18, 26, 19, 15];
        bot.holdNode = holds[index % holds.length];
        setPath(bot, world.nav.routeThrough(startNode, [bot.holdNode]), 'advance');
        bot.role = bot.holdNode === 15 ? 'roam' : bot.holdNode <= 18 ? 'holdA' : 'holdB';
      }
    });
    spotted.clear();
  }

  function think(bot, ctx) {
    const now = ctx.now;
    const pos = bot.mover.state.position;
    const enemies = bot.team === 'ember'
      ? bots.filter((b) => b.team === 'ash' && b.alive)
      : bots.filter((b) => b.team === 'ember' && b.alive);
    const player = ctx.player;
    let best = null;
    let bestDist = Infinity;
    if (player.alive && player.team !== bot.team) {
      const d = pos.distanceTo(player.pos);
      if (d < bestDist) { best = player; bestDist = d; }
    }
    for (const enemy of enemies) {
      const d = pos.distanceTo(enemy.mover.state.position);
      if (d < bestDist) { best = enemy; bestDist = d; }
    }
    let visible = null;
    if (best && bestDist < 55) {
      const dx = bodyOf(best).x - pos.x;
      const dz = bodyOf(best).z - pos.z;
      const angle = Math.atan2(-dx, -dz) - bot.mover.state.yaw;
      const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (Math.abs(wrapped) < 1.9 || bestDist < 6) {
        if (canSee(bot, best)) visible = best;
      }
    }
    if (visible) {
      bot.lastSeen.set(bodyOf(visible).x, bodyOf(visible).y, bodyOf(visible).z);
      bot.lastSeenTime = now;
      if (bot.target !== visible) {
        bot.target = visible;
        bot.targetIsPlayer = !!visible.isPlayer;
        bot.reactAt = now + REACT[bot.team] + Math.random() * 0.3;
        bot.burstLeft = 0;
        if (visible.isPlayer && hooks.radio) {
          hooks.radio(bot.name, `Contact — ${areaName(pos.x, pos.z)}`, bot.team);
        }
      }
      bot.state = 'engage';
      if (visible.team === 'ash') spotted.set(visible.id, now);
      if (bot.team === 'ember' && visible.team === 'ash') spotted.set(visible.id, now);
    } else if (bot.state === 'engage') {
      bot.target = null;
      if (now - bot.lastSeenTime > 2.5) {
        bot.state = 'investigate';
        bot.hearPos.copy(bot.lastSeen);
        setPath(bot, world.nav.routeThrough(world.nearestNode(pos.x, pos.z), [world.nearestNode(bot.lastSeen.x, bot.lastSeen.z)]), 'advance');
      }
    }
    if (bot.state !== 'engage' && ctx.hearing) {
      const noise = ctx.hearing.heard(bot, pos, now);
      if (noise) {
        bot.hearAt = now;
        bot.hearPos.set(noise.x, 0, noise.z);
        bot.state = 'investigate';
        if (hooks.radio) hooks.radio(bot.name, noise.kind === 'step' ? 'Heard steps — checking' : 'Heard shots — rotating', bot.team);
        setPath(bot, world.nav.routeThrough(world.nearestNode(pos.x, pos.z), [world.nearestNode(noise.x, noise.z)]), 'advance');
      }
    }
    if (ctx.plantedSite && bot.state !== 'engage' && bot.state !== 'dead') {
      const siteNode = ctx.plantedSite === 'A' ? 20 : 21;
      if (bot.team === 'ash') {
        if (world.inSite(pos.x, pos.z, ctx.plantedSite)) {
          bot.state = 'defuse';
        } else if (bot.state !== 'advance' || bot.path[bot.path.length - 1] !== siteNode) {
          setPath(bot, world.nav.routeThrough(world.nearestNode(pos.x, pos.z), [siteNode]), 'advance');
        }
      } else if (bot.state !== 'advance' || bot.path[bot.path.length - 1] !== siteNode) {
        setPath(bot, world.nav.routeThrough(world.nearestNode(pos.x, pos.z), [siteNode]), 'advance');
      }
    }
  }

  function stepBot(bot, dt, ctx) {
    const now = ctx.now;
    const mover = bot.mover;
    const body = mover.state;
    const pos = body.position;
    if (!bot.alive) {
      if (bot.fallT < 1) {
        bot.fallT = Math.min(1, bot.fallT + dt / 0.4);
        const a = -bot.fallT * 1.45 * bot.fallDir;
        if (bot.fallAxis === 'x') { bot.parts.group.rotation.x = a; bot.parts.group.rotation.z = 0; }
        else { bot.parts.group.rotation.z = a; bot.parts.group.rotation.x = 0; }
        bot.parts.group.position.y = -bot.fallT * 0.1;
        bot.parts.armL.rotation.z = bot.fallT * 1.2;
        bot.parts.armR.rotation.z = -bot.fallT * 1.2;
      }
      return;
    }
    if (now - bot.thinkAt > 0.15) {
      bot.thinkAt = now;
      think(bot, ctx);
    }
    if (now < bot.blindUntil) {
      bot.target = null;
      bot.state = 'hold';
      bot.parts.group.position.set(pos.x, pos.y, pos.z);
      bot.parts.group.rotation.y = body.yaw;
      return;
    }
    let wishX = 0;
    let wishZ = 0;
    let speed = 0;
    let wantYaw = body.yaw;

    if (ctx.phase === 'live' && bot.state === 'defuse') {
      bot.defuseT += dt;
      hooks.onDefuseProgress(bot, bot.defuseT);
      if (bot.defuseT >= 5) hooks.onDefused(bot);
      wantYaw = body.yaw + Math.sin(now * 1.4) * 0.002;
    } else if (ctx.phase === 'live' && bot.state === 'engage' && bot.target && (bot.targetIsPlayer ? ctx.player.alive : bot.target.alive)) {
      const targetPos = bodyOf(bot.target);
      const dx = targetPos.x - pos.x;
      const dz = targetPos.z - pos.z;
      wantYaw = Math.atan2(-dx, -dz);
      if (now > bot.strafeUntil) {
        bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
        bot.strafeUntil = now + 0.7 + Math.random() * 0.7;
      }
      const sideX = Math.cos(wantYaw) * bot.strafeDir;
      const sideZ = -Math.sin(wantYaw) * bot.strafeDir;
      const dist = Math.hypot(dx, dz);
      const close = dist < 5 ? -0.6 : dist > 14 ? 0.5 : 0;
      wishX = sideX + -Math.sin(wantYaw) * close;
      wishZ = sideZ + -Math.cos(wantYaw) * close;
      const len = Math.hypot(wishX, wishZ) || 1;
      wishX /= len;
      wishZ /= len;
      speed = 2.6;
      if (now >= bot.reactAt && now >= bot.pauseUntil) {
        if (bot.burstLeft <= 0) {
          bot.burstLeft = 3 + Math.floor(Math.random() * 3);
          bot.nextShotAt = now;
        }
        if (now >= bot.nextShotAt) {
          botShoot(bot, bot.target, now);
          bot.burstLeft -= 1;
          bot.nextShotAt = now + BOT_RATE[bot.weapon];
          if (bot.burstLeft <= 0) bot.pauseUntil = now + 0.5 + Math.random() * 0.5;
        }
      }
    } else if (ctx.phase === 'live' && bot.state === 'advance' && bot.path.length > 0) {
      const node = world.nodes[bot.path[Math.min(bot.pathIdx, bot.path.length - 1)]];
      const dx = node[0] - pos.x;
      const dz = node[1] - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.7) {
        bot.pathIdx += 1;
        if (bot.pathIdx >= bot.path.length) {
          bot.state = 'hold';
          bot.holdNode = bot.path[bot.path.length - 1];
        }
      } else {
        wishX = dx / dist;
        wishZ = dz / dist;
        speed = bot.speed;
        wantYaw = Math.atan2(-dx, -dz);
      }
    } else {
      bot.scanPhase += dt * 0.5;
      wantYaw = body.yaw + Math.sin(bot.scanPhase) * 0.004;
      if (bot.role === 'roam' && ctx.phase === 'live' && Math.random() < dt * 0.08) {
        const dest = bot.holdNode === 15 ? 10 : 15;
        bot.holdNode = dest;
        setPath(bot, world.nav.routeThrough(world.nearestNode(pos.x, pos.z), [dest]), 'advance');
      }
    }

    let dyaw = wantYaw - body.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    body.yaw += Math.max(-3.2 * dt, Math.min(3.2 * dt, dyaw));
    const crouch = false;
    mover.step(dt, wishX, wishZ, speed, false, crouch);
    if (ctx.hearing && mover.groundSpeed() > 3 && now - bot.stepAt > 0.6) {
      ctx.hearing.addNoise(pos.x, pos.z, now, 7, 'step', bot.team);
      bot.stepAt = now;
    }
    bot.walkPhase += mover.groundSpeed() * dt * 2.4;
    const swing = Math.min(1, mover.groundSpeed() / 4) * 0.5;
    bot.parts.legL.rotation.x = Math.sin(bot.walkPhase) * swing;
    bot.parts.legR.rotation.x = -Math.sin(bot.walkPhase) * swing;
    const aiming = bot.state === 'engage' && bot.target ? 1 : 0;
    bot.aimBlend += (aiming - bot.aimBlend) * Math.min(1, dt * 8);
    const armBase = -0.5 - bot.aimBlend * 0.65;
    bot.parts.armL.rotation.x = armBase - Math.sin(bot.walkPhase) * swing * 0.7 * (1 - bot.aimBlend);
    bot.parts.armR.rotation.x = armBase + Math.sin(bot.walkPhase) * swing * 0.7 * (1 - bot.aimBlend);
    bot.parts.group.rotation.x = swing * 0.18;
    if (mover.groundSpeed() < 0.5) bot.parts.torso.scale.y = 1 + Math.sin(now * 2 + bot.walkPhase) * 0.012;
    else bot.parts.torso.scale.y = 1;
    if (bot.flashT > 0) {
      bot.flashT = Math.max(0, bot.flashT - dt * 3.5);
      bot.parts.torsoMat.emissive.setHex(0xff2a1a);
      bot.parts.torsoMat.emissiveIntensity = bot.flashT * 0.9;
    } else if (bot.parts.torsoMat.emissiveIntensity !== 0) {
      bot.parts.torsoMat.emissiveIntensity = 0;
    }
    bot.parts.group.position.set(pos.x, pos.y, pos.z);
    bot.parts.group.rotation.y = body.yaw;
  }

  function step(dt, ctx) {
    activeSmokes = ctx.smokes || [];
    for (const bot of bots) stepBot(bot, dt, ctx);
  }

  return {
    list: bots,
    hitMeshes,
    step,
    reset,
    damage,
    blind(bot, until) { bot.blindUntil = until; bot.target = null; },
    spottedAt(id) { return spotted.get(id) ?? -99; },
    aliveCount(team) { return bots.filter((b) => b.team === team && b.alive).length; },
    forEach(fn) { bots.forEach(fn); },
  };
}
