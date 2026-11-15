// The loop: one fixed 60 Hz simulation step and the frame that drives it. One job:
import * as THREE from 'three';
import { SITES } from './world.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';

export const FIXED_STEP = 1 / 60;

export function createLoop({ scene, camera, renderer, world, effects, audio, hud, game, input, weapons, player, playerMover, playerBody, bots, hearing, grenades, bomb, shooter, economy, rounds, getScoreboard }) {
  let simTime = 0;
  let frozen = false;
  let accumulator = 0;
  let lastTime = performance.now();
  let buyOpen = false;
  let scoreVisible = false;
  let lastWeaponId = 'pistol';
  let lastPlayerStep = 0;
  let mapTimer = 0;
  const shakeVec = new THREE.Vector3();

  function now() { return simTime; }

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
    playerMover.state.yaw = Math.atan2(-dx, -dz);
    playerMover.state.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  function step(dt) {
    simTime += dt;
    const phase = game.state.phase;
    const keys = input.state.keys;

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

    if (player.alive && playerMover.groundSpeed() > 3 && simTime - lastPlayerStep > 0.6) {
      hearing.addNoise(playerBody.position.x, playerBody.position.z, simTime, 7, 'step', 'ember');
      lastPlayerStep = simTime;
    }

    weapons.state.aiming = input.state.aiming && player.alive;
    const targetFov = weapons.state.aiming ? (weapons.state.current === 'sniper' ? 42 : 58) : 74;
    if (Math.abs(camera.fov - targetFov) > 0.2) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
      camera.updateProjectionMatrix();
    }

    weapons.step(dt);
    effects.step(dt);
    grenades.step(dt);

    bots.step(dt, {
      now: simTime, phase, player, hearing, smokes: grenades.smokes,
      plantedSite: game.state.planted ? game.state.planted.site : null,
    });

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
        rounds.endRound('ember', `Charge detonated at ${SITES[site].name}`);
      } else if (event.event === 'timeout') {
        rounds.endRound('ash', 'Time expired — charge never planted');
      } else if (event.event === 'round') {
        rounds.startRoundSetup();
        hud.banner(`ROUND ${game.state.round}`, 'Buy up — B opens the shop', 2400);
      }
    }

    bomb.step(dt, keys, phase);
    weapons.showCharge(bomb.planting());

    const inA = world.inSite(playerBody.position.x, playerBody.position.z, 'A');
    const inB = world.inSite(playerBody.position.x, playerBody.position.z, 'B');
    const zone = inA ? 'A' : inB ? 'B' : playerBody.position.z > 12 ? 'spawn' : 'mid';
    hud.setGrade(zone);

    hud.setHealth(Math.max(0, player.health), weapons.state.armor);
    const slot = weapons.ammo[weapons.state.current];
    hud.setAmmo(slot.mag, slot.reserve, WEAPONS[weapons.state.current].name.toUpperCase());
    hud.setTimer(game.timeLeft());
    hud.setAlive((player.alive ? 1 : 0) + bots.aliveCount('ember'), bots.aliveCount('ash'));
    const planted = game.state.planted;
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
          if (input.state.firing && weapons.ready()) shooter.shoot(weapons.spread(playerMover.groundSpeed()));
        } else if (input.takePressed('MouseLeft') && weapons.ready()) {
          shooter.shoot(weapons.spread(playerMover.groundSpeed()));
        }
      }
      if (input.takePressed('KeyR')) {
        if (weapons.reload()) audio.reload();
      }
      if (input.takePressed('KeyB') && game.state.phase === 'freeze') {
        buyOpen = !buyOpen;
        if (buyOpen) {
          hud.showBuy(game.state.money);
          economy.refreshBuyMenu();
          audio.click();
        } else hud.hideBuy();
      }
      if (input.takePressed('Tab') && getScoreboard) {
        scoreVisible = !scoreVisible;
        if (scoreVisible) hud.showScoreboard(getScoreboard());
        else hud.hideScoreboard();
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

  function frameWithMap(now) {
    frame(now);
    mapTimer += 1;
    if (mapTimer % 6 === 0 && !frozen) {
      hud.drawMinimap(player, bots, game.state.planted ? game.state.planted.site : null, simTime);
    }
  }

  return {
    step, frame, frameWithMap, syncCamera, aimAt, now,
    setFrozen(v) { frozen = v; },
    closeBuy() { buyOpen = false; },
  };
}
