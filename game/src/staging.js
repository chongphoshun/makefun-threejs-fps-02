// Staging: deterministic captures + self-test.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { FIXED_STEP } from './loop.js';

export function createStaging({ scene, camera, renderer, hud, game, rounds, weapons, bots, effects, shooter, input, player, playerBody, step, syncCamera, aimAt, setFrozen, getSimTime }) {
  let aerial = false;
  function settle(steps) {
    for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
  }

  function paintTwiceThenReady() {
    let painted = 0;
    function paint() {
      requestAnimationFrame(paint);
      syncCamera();
      if (aerial) {
        camera.position.set(0, 38, 18);
        camera.lookAt(0, 0, -3);
      }
      renderer.render(scene, camera);
      painted += 1;
      if (painted === 2) {
        window.__shotReady = true;
        setFrozen(true);
      }
    }
    requestAnimationFrame(paint);
  }

  function score(e, a, r, m) { // set match state and HUD to match
    game.state.score = { ember: e, ash: a };
    game.state.round = r;
    game.state.money = m;
    hud.setScore(e, a, r);
    hud.setMoney(m);
  }

  function rifle(m) {
    weapons.buy('rifle');
    game.state.money = m;
    weapons.switchTo('rifle');
  }

  function place(enemy, x, z, yaw) {
    enemy.mover.teleport(x, z, yaw);
    enemy.state = 'hold';
    enemy.path = [];
  }

  function runShot(name) {
    hud.hideOverlay();
    hud.hideBuy();
    hud.hideScoreboard();
    game.startMatch();
    rounds.startRoundSetup();
    if (name === 'firefight') {
      game.endFreeze();
      game.state.timer = 52;
      score(4, 3, 8, 5200);
      rifle(5200);
      player.health = 1000;
      playerBody.position.set(8, 0, -10);
      settle(30);
      const enemies = bots.list.filter((b) => b.team === 'ash');
      const spots = [[12, -12], [11, -14], [9.5, -12.5]];
      for (let i = 0; i < 3; i += 1) place(enemies[i], spots[i][0], spots[i][1], Math.PI);
      settle(2);
      aimAt(new THREE.Vector3(13, 1.4, -13));
      shooter.shoot(0);
      step(FIXED_STEP);
      effects.smokeCloud(new THREE.Vector3(19, 1, -9));
      effects.burst(new THREE.Vector3(11.5, 1.5, -13), new THREE.Vector3(-1, 0, 0), 12);
      effects.decal(new THREE.Vector3(11.5, 1.5, -12.5), new THREE.Vector3(-1, 0, 0));
      effects.tracer(new THREE.Vector3(11.5, 1.35, -13), new THREE.Vector3(8, 1.2, -9), 0x7fb8ff);
      player.health = 74;
      player.alive = true;
      hud.hideOverlay();
      hud.hitMarker(false, 60000);
      hud.killfeed('Vex', 'Onyx', true, 'ember', 'Rifle', true);
      hud.killfeed('You', 'Wren', false, 'ember', 'Rifle', true);
      hud.radio('Rook', 'Contact — Clay Pits, three of them', 'ember', true);
      hud.radio('Vex', 'Holding mid, need backup', 'ember', true);
    } else if (name === 'aerial') {
      // Wide aerial of Cinder Yard at sunset: smokestacks, Kiln Hall, Clay Pits, both site letters, soldiers in the yard. No HUD.
      game.startMatch();
      rounds.startRoundSetup();
      score(4, 4, 9, 2400);
      playerBody.position.set(0, 0, 15.5);
      settle(20);
      const spots = [[-4, 6, 0.5], [3, 2, -0.5], [7, 8, 2.5], [-8, -2, 1.2], [8, -4, -2.2]];
      for (let i = 0; i < 5; i += 1) place(bots.list[i], spots[i][0], spots[i][1], spots[i][2]);
      settle(2);
      aerial = true;
      document.getElementById('hud').hidden = true;
      for (const c of camera.children) c.visible = false;
      scene.fog = null;
      renderer.shadowMap.enabled = false; // lift the yard out of the walls' shadow
      renderer.toneMappingExposure = 1.25;
    } else if (name === 'plant') {
      game.endFreeze();
      game.plant('A');
      effects.plantBomb(-16.5, -12.5);
      score(6, 4, 11, 3800);
      rifle(3800);
      weapons.buyKit();
      const defuser = bots.list.find((b) => b.team === 'ash');
      place(defuser, -17.8, -12.8, -1.8);
      defuser.state = 'defuse';
      defuser.defuseT = 2.9;
      playerBody.position.set(-16.5, 0, -8.2);
      settle(6);
      aimAt(new THREE.Vector3(-18, 1.2, -12.5));
      effects.smokeCloud(new THREE.Vector3(-10, 1, -15));
      for (const c of camera.children) c.visible = false; // no viewmodel: the floor charge must read
      defuser.parts.group.rotation.x = 0.35; // kneel-lean over the charge
      defuser.parts.armL.rotation.x = -1.3;
      defuser.parts.armR.rotation.x = -1.3;
      hud.setBomb('DEFUSING (KIT) 58%', 0.58);
      hud.setPlant(0.58);
      hud.radio('Onyx', 'Defusing at Kiln Hall — cover me', 'ash', true);
      hud.radio('Iris', 'They are on the charge — retake A', 'ember', true);
    } else if (name === 'scoreboard') {
      renderer.toneMappingExposure = 0.8;
      score(7, 5, 12, 6800);
      rifle(6800); // hold the rifle, not the sidearm
      const enemy = bots.list.find((b) => b.team === 'ash');
      enemy.mover.teleport(-17.8, -7.4, Math.PI * 0.75);
      enemy.alive = false;
      enemy.state = 'dead';
      enemy.fallT = 1;
      enemy.parts.group.rotation.x = -1.45;
      enemy.parts.group.position.set(-17.8, -0.1, -7.4);
      enemy.parts.group.rotation.y = Math.PI * 0.75;
      playerBody.position.set(0, 0, 14);
      settle(10);
      aimAt(new THREE.Vector3(0, 5, -18)); // open yard + sky above the far wall, no wall filling the frame
      game.state.timer = 0;
      hud.killfeed('You', 'Kestrel', true, 'ember', 'Rifle', true);
      hud.showScoreboard({
        title: 'ROUND 12 — EMBER WINS',
        sub: 'Charge detonated at Kiln Hall · Cinder Yard 7 — 5 · Round 12 of 24',
        rows: [
          { name: 'You', team: 'Ember', k: 4, a: 1, d: 1, hs: 2, dmg: 412, cash: 6800 },
          { name: 'Vex', team: 'Ember', k: 3, a: 2, d: 2, hs: 1, dmg: 288, cash: 2400 },
          { name: 'Rook', team: 'Ember', k: 2, a: 0, d: 1, hs: 0, dmg: 164, cash: 1950 },
          { name: 'Kestrel', team: 'Ash', k: 3, a: 1, d: 2, hs: 1, dmg: 305, cash: 3100 },
          { name: 'Onyx', team: 'Ash', k: 1, a: 1, d: 3, hs: 0, dmg: 92, cash: 1200 },
        ],
        log: [
          '<b>+$3,250</b> round win &nbsp;·&nbsp; <b>+$300</b> × 4 kills &nbsp;·&nbsp; <b>+$300</b> plant bonus',
          'Loss streak bonus: $0 · Balance: <b>$6,800</b> · Next round: buy up with B',
        ],
      });
    }
    hud.setAlive((player.alive ? 1 : 0) + bots.aliveCount('ember'), bots.aliveCount('ash'));
    hud.setHealth(Math.max(0, player.health), weapons.state.armor);
    const slot = weapons.ammo[weapons.state.current];
    hud.setAmmo(slot.mag, slot.reserve, WEAPONS[weapons.state.current].name.toUpperCase());
    hud.setTimer(game.timeLeft());
    hud.drawMinimap(player, bots, game.state.planted ? game.state.planted.site : null, getSimTime());
    paintTwiceThenReady();
  }

  function runSelfTest() {
    const t0 = performance.now();
    const errors = [];
    game.startMatch();
    rounds.startRoundSetup();
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
            shooter.shoot(weapons.spread(0));
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

  return { runShot, runSelfTest };
}
