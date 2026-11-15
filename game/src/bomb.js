// The bomb: the player's plant and defuse channels. Hold E inside a site to plant
// (3 s), hold E on a planted site to defuse (5 s); the match state (game.plant,
// the 40 s bomb timer) still lives in game.js, the blinking charge in effects.js.
// This module is only the channel — the progress bar, the prompt, and the moment
// the channel completes. Bot defusing runs through the hooks in main.js, not here.
import { PLANT_TIME, DEFUSE_TIME } from './game.js';
import { SITES } from './world.js';

export function createBomb({ game, world, hud, audio, effects, getPlayer, onPlanted, onDefused }) {
  let plantProgress = 0;
  let defuseProgress = 0;

  function reset() {
    plantProgress = 0;
    defuseProgress = 0;
  }

  function step(dt, keys, phase) {
    const player = getPlayer();
    const pos = player.pos;
    const inA = world.inSite(pos.x, pos.z, 'A');
    const inB = world.inSite(pos.x, pos.z, 'B');
    const siteHere = inA ? 'A' : inB ? 'B' : null;
    const planted = game.state.planted;
    if (player.alive && phase === 'live') {
      if (!planted && siteHere && keys.has('KeyE')) {
        plantProgress += dt;
        hud.setPlant(plantProgress / PLANT_TIME);
        if (plantProgress >= PLANT_TIME) {
          game.plant(siteHere);
          plantProgress = 0;
          effects.plantBomb(SITES[siteHere].center.x, SITES[siteHere].center.z);
          hud.setPlant(null);
          if (onPlanted) onPlanted(siteHere);
        }
      } else if (planted && world.inSite(pos.x, pos.z, planted.site) && keys.has('KeyE')) {
        defuseProgress += dt;
        hud.setPlant(defuseProgress / DEFUSE_TIME);
        if (defuseProgress >= DEFUSE_TIME) {
          defuseProgress = 0;
          hud.setPlant(null);
          if (onDefused) onDefused();
        }
      } else {
        plantProgress = 0;
        defuseProgress = 0;
        hud.setPlant(null);
      }
      if (!planted && siteHere) hud.prompt('Hold <b>E</b> to plant the charge');
      else if (planted && world.inSite(pos.x, pos.z, planted.site)) hud.prompt('Hold <b>E</b> to defuse');
      else hud.prompt(null);
    } else {
      hud.setPlant(null);
      hud.prompt(null);
    }
  }

  return { step, reset };
}
