// Bomb: plant/defuse channels (E in a site).
import { PLANT_TIME, DEFUSE_TIME } from './game.js';
import { SITES } from './world.js';

export function createBomb({ game, world, hud, audio, effects, getPlayer, hasKit, onPlanted, onDefused }) {
  let plantProgress = 0;
  let defuseProgress = 0;
  let defuseBanner = false;

  function reset() {
    plantProgress = 0;
    defuseProgress = 0;
    defuseBanner = false;
  }

  function step(dt, keys, phase) {
    const player = getPlayer();
    const pos = player.pos;
    const inA = world.inSite(pos.x, pos.z, 'A');
    const inB = world.inSite(pos.x, pos.z, 'B');
    const siteHere = inA ? 'A' : inB ? 'B' : null;
    const planted = game.state.planted;
    const kit = hasKit ? hasKit() : false;
    const defuseTime = kit ? DEFUSE_TIME / 2 : DEFUSE_TIME;
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
        hud.setPlant(defuseProgress / defuseTime);
        if (!defuseBanner && defuseProgress / defuseTime >= 0.5) {
          defuseBanner = true;
          hud.banner(kit ? 'DEFUSING (KIT)' : 'DEFUSING', `${Math.round((defuseProgress / defuseTime) * 100)}% — hold E`, 1500);
        }
        if (defuseProgress >= defuseTime) {
          defuseProgress = 0;
          defuseBanner = false;
          hud.setPlant(null);
          if (onDefused) onDefused();
        }
      } else {
        plantProgress = 0;
        defuseProgress = 0;
        defuseBanner = false;
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

  return { step, reset, planting() { return plantProgress > 0; } };
}
