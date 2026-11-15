// Staging: deterministic captures and the headless self-test. One job: put the game
// into a known state and either freeze a screenshot of it or drive a scripted player
// through real rounds. It never runs in normal play — the boot in main.js calls it
// only for ?shot=<name> or ?selftest=1. Every capture is the same simulation the
// live game runs, staged: the firefight, the shop, the plant, the round report.
import * as THREE from 'three';
import { SITES } from './world.js';
import { WEAPON_ORDER } from './weapons.js';
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

  function runShot(name) {
    hud.hideOverlay();
    hud.hideBuy();
    hud.hideScoreboard();
    game.startMatch();
    rounds.startRoundSetup();
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
      shooter.shoot(0);
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
    hud.drawMinimap(player, bots, game.state.planted ? game.state.planted.site : null, getSimTime());
    paintTwiceThenReady();
  }

  // Headless self-test: drives a scripted player through real rounds (walk north,
  // shoot the nearest Ash bot when the gun is ready) and reports the result in
  // document.title. It exercises the same step() the live game runs: bot AI, rounds,
  // the bomb clock, the economy. It never runs in normal play.
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
