// Staging: deterministic captures + headless self-test.
import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { FIXED_STEP } from './loop.js';

export function createStaging({ scene, camera, renderer, hud, game, rounds, weapons, bots, effects, shooter, input, player, playerBody, step, syncCamera, aimAt, setFrozen, getSimTime }) {
  function settle(steps) {
    for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
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
      player.health = 1000; // staging only: bots must not down the player mid-capture
      playerBody.position.set(8, 0, -10);
      settle(30);
      const enemies = bots.list.filter((b) => b.team === 'ash');
      const spots = [[13, -13], [12, -15], [10, -13]];
      for (let i = 0; i < 3; i += 1) place(enemies[i], spots[i][0], spots[i][1], Math.PI);
      settle(2);
      aimAt(new THREE.Vector3(17, 1.5, -13));
      shooter.shoot(0);
      step(FIXED_STEP);
      effects.smokeCloud(new THREE.Vector3(19, 1, -9)); // right edge, clear of the enemies
      effects.burst(new THREE.Vector3(13, 1.5, -13), new THREE.Vector3(-1, 0, 0), 12);
      effects.decal(new THREE.Vector3(13, 1.5, -12.5), new THREE.Vector3(-1, 0, 0));
      effects.tracer(new THREE.Vector3(13, 1.35, -13), new THREE.Vector3(8, 1.2, -9), 0x7fb8ff);
      player.health = 74;
      player.alive = true;
      hud.hideOverlay();
      hud.hitMarker(false, 60000);
      hud.killfeed('Vex', 'Onyx', true, 'ember', 'Rifle', true);
      hud.killfeed('You', 'Wren', false, 'ember', 'Rifle', true);
      hud.radio('Rook', 'Contact — Clay Pits, three of them', 'ember', true);
      hud.radio('Vex', 'Holding mid, need backup', 'ember', true);
    } else if (name === 'buy') {
      game.state.money = 6400;
      weapons.buy('rifle');
      weapons.buyArmor();
      score(4, 4, 9, 2400);
      playerBody.position.set(0, 0, 16.5);
      settle(20);
      aimAt(new THREE.Vector3(5, 3.5, -18));
      hud.showBuy(2400);
      for (const item of [...WEAPON_ORDER, 'armor', 'helmet', 'kit']) {
        const owned = item === 'armor' ? weapons.state.armor > 0 : item === 'helmet' ? weapons.state.helmet : item === 'kit' ? weapons.state.kit : weapons.state.owned.has(item);
        hud.buyAfford(item, 2400, owned);
      }
    } else if (name === 'plant') {
      game.endFreeze();
      game.state.timer = 41;
      score(6, 4, 11, 3800);
      rifle(3800);
      const enemy = bots.list.find((b) => b.team === 'ash');
      place(enemy, -15.5, -12.5, Math.PI * 0.5);
      playerBody.position.set(-6, 0, -12);
      settle(10);
      aimAt(new THREE.Vector3(-15.5, 1.3, -12.5));
      effects.smokeCloud(new THREE.Vector3(-15, 1, -5.5)); // left edge, clear of the charge
      weapons.showCharge(true);
      hud.setPlant(2 / 3);
      hud.prompt('Hold <b>E</b> to plant the charge');
      hud.radio('Iris', 'Planting at Kiln Hall — cover me', 'ember', true);
    } else if (name === 'scoreboard') {
      score(7, 5, 12, 6800);
      const enemy = bots.list.find((b) => b.team === 'ash');
      enemy.mover.teleport(16.5, -11.5, Math.PI);
      enemy.alive = false;
      enemy.state = 'dead';
      enemy.fallT = 1;
      enemy.parts.group.rotation.x = -1.45;
      enemy.parts.group.position.set(16.5, -0.1, -11.5);
      enemy.parts.group.rotation.y = Math.PI;
      playerBody.position.set(12, 0, -7.5);
      settle(10);
      aimAt(new THREE.Vector3(16.5, 0.9, -11.5));
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
