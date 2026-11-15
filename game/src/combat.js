// Combat: the player's trigger. One job: turn a trigger pull into pellets downrange
// and read the answer. A grenade in hand throws instead of firing; an empty mag
// clicks dry. Each pellet is a raycast against the bots' hitboxes and the world's
// shootables — headshots multiply, legs soften, distance falls off past 25 m —
// and every shot is a noise bots can hear, a tracer, a casing, and recoil.
import * as THREE from 'three';

export function createShooter({ scene, camera, weapons, grenades, effects, audio, hud, hearing, hooks }) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;
  const direction = new THREE.Vector3();

  // The muzzle in world space, so tracers and casings start at the gun, not the eye.
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
      grenades.throwGrenade();
      return;
    }
    if (!weapons.takeRound()) {
      audio.dry();
      weapons.pullTrigger();
      return;
    }
    const stats = hooks.getStats();
    const player = hooks.getPlayer();
    const bots = hooks.getBots();
    const playerMover = hooks.getPlayerMover();
    const playerBody = playerMover.state;
    stats.shots += 1;
    const pellets = def.pellets || 1;
    let anyHit = false;
    let anyKill = false;
    for (let p = 0; p < pellets; p += 1) {
      camera.getWorldDirection(direction);
      direction.x += (hooks.random() * 2 - 1) * spread;
      direction.y += (hooks.random() * 2 - 1) * spread;
      direction.z += (hooks.random() * 2 - 1) * spread;
      direction.normalize();
      scene.updateMatrixWorld(true);
      raycaster.set(camera.position, direction);
      const hit = raycaster.intersectObjects(hooks.getShootables(), false)[0];
      const from = muzzleWorld(new THREE.Vector3());
      const end = hit ? hit.point : camera.position.clone().addScaledVector(direction, 70);
      effects.tracer(from, end, def.tracer);
      if (hit) {
        if (hit.object.userData.bot) {
          const bot = hit.object.userData.bot;
          const part = hit.object.userData.part;
          const isHead = part === 'head';
          const isLeg = part === 'leg';
          const dist = hit.distance;
          const falloff = dist > 25 ? 0.7 : 1;
          const mult = isHead ? def.headMult : isLeg ? 0.75 : 1;
          const dmg = def.damage * mult * falloff;
          const wasAlive = bot.alive;
          bots.damage(bot, dmg, isHead, player);
          stats.hits += 1;
          if (isHead) stats.headshots += 1;
          anyHit = true;
          if (wasAlive && !bot.alive) anyKill = true;
        } else {
          effects.burst(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), 10);
          effects.decal(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0));
        }
      }
    }
    audio.shot(def.kind, 0);
    hearing.addNoise(playerBody.position.x, playerBody.position.z, hooks.now());
    if (anyHit) {
      hud.hitMarker(anyKill, 120);
      audio.hit(anyKill);
      if (anyKill) weapons.state.kick = 0.09;
    }
    weapons.pullTrigger();
    playerMover.recoil(0.009 + hooks.random() * 0.004, (hooks.random() * 2 - 1) * 0.004);
    // One brass casing out of the gun, to the right.
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    effects.casing(muzzleWorld(new THREE.Vector3()), right);
    const slot = weapons.ammo[weapons.state.current];
    hud.setAmmo(slot.mag, slot.reserve, def.name.toUpperCase());
  }

  return { shoot, muzzleWorld };
}
