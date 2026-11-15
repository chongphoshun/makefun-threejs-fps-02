// The match: rounds, the bomb, and the money. One object holds every number the match
export const WIN_SCORE = 13;
export const TOTAL_ROUNDS = 24;
export const ROUND_TIME = 100;
export const FREEZE_TIME = 10;
export const BOMB_TIME = 40;
export const PLANT_TIME = 3;
export const DEFUSE_TIME = 5;
export const WIN_MONEY = 3250;
export const LOSS_MONEY = 1900;
export const LOSS_STREAK_BONUS = 500;
export const KILL_MONEY = 300;
export const PLANT_MONEY = 300;

export function createGame() {
  const state = {
    phase: 'menu', // menu | freeze | live | roundEnd | matchEnd
    round: 1,
    score: { ember: 0, ash: 0 },
    money: 800,
    lossStreak: 0,
    timer: 0,
    planted: null, // { site: 'A' | 'B', timeLeft }
    winner: null,
    reason: '',
  };

  function startMatch() {
    state.phase = 'freeze';
    state.round = 1;
    state.score = { ember: 0, ash: 0 };
    state.money = 800;
    state.lossStreak = 0;
    state.timer = FREEZE_TIME;
    state.planted = null;
    state.winner = null;
    state.reason = '';
  }

  function startRound() {
    state.phase = 'freeze';
    state.timer = FREEZE_TIME;
    state.planted = null;
  }

  function endFreeze() {
    state.phase = 'live';
    state.timer = ROUND_TIME;
  }

  function plant(site) {
    if (state.phase !== 'live' || state.planted) return false;
    state.planted = { site, timeLeft: BOMB_TIME };
    state.money += PLANT_MONEY;
    return true;
  }

  function endRound(winner, reason) {
    if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return null;
    state.winner = winner;
    state.reason = reason;
    state.score[winner] += 1;
    if (winner === 'ember') {
      state.money += WIN_MONEY;
      state.lossStreak = 0;
    } else {
      state.money += LOSS_MONEY + Math.min(2, state.lossStreak) * LOSS_STREAK_BONUS;
      state.lossStreak += 1;
    }
    state.planted = null;
    const matchOver = state.score[winner] >= WIN_SCORE
      || (state.round >= TOTAL_ROUNDS && state.score.ember !== state.score.ash);
    state.phase = matchOver ? 'matchEnd' : 'roundEnd';
    state.timer = matchOver ? 0 : 4;
    return { winner, reason, matchOver, score: { ...state.score } };
  }

  function nextRound() {
    state.round += 1;
    startRound();
  }

  function tick(dt) {
    if (state.phase === 'freeze') {
      state.timer -= dt;
      if (state.timer <= 0) {
        endFreeze();
        return { event: 'live' };
      }
      return null;
    }
    if (state.phase === 'live') {
      if (state.planted) {
        state.planted.timeLeft -= dt;
        if (state.planted.timeLeft <= 0) return { event: 'detonation' };
      } else {
        state.timer -= dt;
        if (state.timer <= 0) return { event: 'timeout' };
      }
      return null;
    }
    if (state.phase === 'roundEnd') {
      state.timer -= dt;
      if (state.timer <= 0) {
        nextRound();
        return { event: 'round' };
      }
    }
    return null;
  }

  return {
    state,
    startMatch,
    startRound,
    endFreeze,
    plant,
    endRound,
    tick,
    addKillMoney() { state.money += KILL_MONEY; },
    spend(amount) {
      if (state.money < amount) return false;
      state.money -= amount;
      return true;
    },
    timeLeft() {
      return state.planted ? state.planted.timeLeft : state.timer;
    },
  };
}
