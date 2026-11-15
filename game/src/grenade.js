// Grenades: throw, bounce, detonate. One job: a grenade leaves the hand, bounces off
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { PALETTE } from './palette.js';

export function createGrenades({ scene, world, effects, audio, hud, weapons, hooks }) {
  const grenades = [];
  const smokes = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;
  const direction = new THREE.Vector3();

  function throwGrenade() {
    const type = weapons.state.current;
    if (!weapons.throwGrenade()) return;
    const camera = hooks.getCamera();
    camera.getWorldDirection(direction);
    const color = type === 'he' ? PALETTE.accent : type === 'smoke' ? 0x9a9a9a : 0xffffff;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5 }),
    );
    mesh.position.copy(camera.position).addScaledVector(direction, 0.4);
    scene.add(mesh);
    grenades.push({
      mesh, fuse: 2.6, type,
      vel: direction.clone().multiplyScalar(15).add(new THREE.Vector3(0, 3.5, 0)).add(hooks.getPlayerMover().state.velocity),
    });
    audio.click();
    const slot = weapons.ammo[weapons.state.current];
    hud.setAmmo(slot.mag, slot.reserve, WEAPONS[weapons.state.current].name.toUpperCase());
  }

  function explodeGrenade(g) {
    const p = g.mesh.position;
    const camera = hooks.getCamera();
    if (g.type === 'smoke') {
      effects.smokeCloud(p);
      smokes.push({ x: p.x, y: p.y + 1, z: p.z, r: 4.5, until: hooks.now() + 14 });
      audio.boom(Math.min(1, camera.position.distanceTo(p) / 40));
      scene.remove(g.mesh);
      return;
    }
    if (g.type === 'flash') {
      effects.flashBurst(p);
      audio.boom(Math.min(1, camera.position.distanceTo(p) / 40));
      blindFromFlash(p);
      scene.remove(g.mesh);
      return;
    }
    effects.explosion(p, 6);
    audio.boom(Math.min(1, camera.position.distanceTo(p) / 40));
    effects.addShake(0.4);
    const bots = hooks.getBots();
    const victims = [hooks.getPlayer(), ...bots.list.filter((b) => b.alive)];
    for (const v of victims) {
      const body = v.isPlayer ? v.pos : v.mover.state.position;
      const dx = body.x - p.x;
      const dy = body.y + 1 - p.y;
      const dz = body.z - p.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 6.5) continue;
      raycaster.set(p, new THREE.Vector3(dx / dist, dy / dist, dz / dist));
      raycaster.far = dist;
      if (raycaster.intersectObjects(world.shootables, false)[0]) continue;
      const dmg = 120 * (1 - dist / 7);
      if (v.isPlayer) hooks.hurtPlayer(dmg, { name: 'SPARK-4', team: 'ash' });
      else bots.damage(v, dmg, false, hooks.getPlayer());
    }
    scene.remove(g.mesh);
  }

  function blindFromFlash(p) {
    const camera = hooks.getCamera();
    const eye = camera.position;
    const distP = eye.distanceTo(p);
    if (distP < 25) {
      camera.getWorldDirection(direction);
      const toFlash = new THREE.Vector3().subVectors(p, eye).normalize();
      const facing = direction.dot(toFlash);
      if (facing > 0.2) {
        raycaster.set(eye, toFlash);
        raycaster.far = distP;
        if (!raycaster.intersectObjects(world.shootables, false)[0]) {
          hud.flashBlind((1 - distP / 25) * (0.4 + facing * 0.6));
        }
      }
    }
    const bots = hooks.getBots();
    for (const bot of bots.list) {
      if (!bot.alive) continue;
      const body = bot.mover.state.position;
      const dx = p.x - body.x;
      const dy = (p.y - 1.5) - body.y;
      const dz = p.z - body.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 20 || dist < 0.01) continue;
      raycaster.set(p, new THREE.Vector3(-dx / dist, -dy / dist, -dz / dist));
      raycaster.far = dist;
      if (raycaster.intersectObjects(world.shootables, false)[0]) continue;
      bots.blind(bot, hooks.now() + 2.2);
    }
  }

  function step(dt) {
    for (let i = smokes.length - 1; i >= 0; i -= 1) {
      if (smokes[i].until <= hooks.now()) smokes.splice(i, 1);
    }
    for (let i = grenades.length - 1; i >= 0; i -= 1) {
      const g = grenades[i];
      g.fuse -= dt;
      g.vel.y -= 14 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      const p = g.mesh.position;
      const r = 0.09;
      for (const c of world.colliders) {
        if (p.x > c.min.x - r && p.x < c.max.x + r && p.y > c.min.y - r && p.y < c.max.y + r && p.z > c.min.z - r && p.z < c.max.z + r) {
          const dxMin = p.x - (c.min.x - r);
          const dxMax = (c.max.x + r) - p.x;
          const dyMin = p.y - (c.min.y - r);
          const dyMax = (c.max.y + r) - p.y;
          const dzMin = p.z - (c.min.z - r);
          const dzMax = (c.max.z + r) - p.z;
          const m = Math.min(dxMin, dxMax, dyMin, dyMax, dzMin, dzMax);
          if (m === dxMin || m === dxMax) g.vel.x *= -0.45;
          else if (m === dyMin || m === dyMax) { g.vel.y *= -0.45; if (m === dyMin) p.y = c.min.y - r; else p.y = c.max.y + r; }
          else g.vel.z *= -0.45;
          audio.bounce();
        }
      }
      if (p.y < r) { p.y = r; g.vel.y = Math.abs(g.vel.y) * 0.45; }
      if (g.fuse <= 0) {
        explodeGrenade(g);
        grenades.splice(i, 1);
      }
    }
  }

  function reset() {
    for (const g of grenades) scene.remove(g.mesh);
    grenades.length = 0;
    smokes.length = 0;
  }

  return { grenades, smokes, throwGrenade, step, reset };
}
