// Rounds: the round lifecycle. One job: everything that happens between "the round
import { WEAPONS } from './weapons.js';

export function createRounds({ game, weapons, hud, audio, effects, bomb, grenades, getPlayer, getPlayerMover, getBots, stats, closeBuy, onPlayerDeath }) {
  function spawnPlayer() {
    const player = getPlayer();
    const playerMover = getPlayerMover();
    const spawn = { x: 0, z: 15.5, yaw: 0 };
    playerMover.teleport(spawn.x, spawn.z, spawn.yaw);
    player.alive = true;
    player.health = 100;
    player.crouching = false;
  }

  function hurtPlayer(amount, attacker, isHead) {
    const player = getPlayer();
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
      hud.killfeed(attacker.name, 'You', isHead, attacker.team, WEAPONS[attacker.weapon].name);
      hud.showOverlay('dead');
      if (document.pointerLockElement) document.exitPointerLock();
      if (onPlayerDeath) onPlayerDeath(attacker);
      checkElimination();
    }
  }

  function checkElimination() {
    if (game.state.phase !== 'live') return;
    const player = getPlayer();
    const bots = getBots();
    const emberAlive = (player.alive ? 1 : 0) + bots.aliveCount('ember');
    const ashAlive = bots.aliveCount('ash');
    if (ashAlive === 0) endRound('ember', 'Ash team eliminated');
    else if (emberAlive === 0) endRound('ash', 'Ember team eliminated');
  }

  function endRound(winner, reason) {
    const result = game.endRound(winner, reason);
    if (!result) return;
    effects.clearBomb();
    closeBuy();
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
    const player = getPlayer();
    const bots = getBots();
    const survived = player.alive;
    if (!survived) weapons.resetLoadout();
    else weapons.refill();
    spawnPlayer();
    bots.reset(game.state.round);
    bomb.reset();
    grenades.reset();
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

  return { spawnPlayer, hurtPlayer, checkElimination, endRound, startRoundSetup };
}
