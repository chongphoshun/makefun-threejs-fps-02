// Transient combat feedback: tracers, impact sparks, explosions and camera shake.
// Everything is pooled and reused: the hot loop creates no objects.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const TRACER_COUNT = 24;
const SPARK_COUNT = 320;

export function createEffects(scene) {
  // Tracers: one THREE.Line each, shown for a few frames then hidden.
  const tracers = [];
  for (let i = 0; i < TRACER_COUNT; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0 });
    const line = new THREE.Line(geometry, material);
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerNext = 0;

  // Sparks: one THREE.Points cloud, particles recycled in place.
  const sparkPos = new Float32Array(SPARK_COUNT * 3);
  const sparkVel = new Float32Array(SPARK_COUNT * 3);
  const sparkLife = new Float32Array(SPARK_COUNT);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: new THREE.Color(PALETTE.accent), size: 0.07, transparent: true, opacity: 0.95,
    depthWrite: false,
  }));
  sparks.visible = false;
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sparkNext = 0;

  // Explosion: an expanding additive sphere plus a point light.
  const boomMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0, depthWrite: false }),
  );
  boomMesh.visible = false;
  scene.add(boomMesh);
  const boomLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 22);
  scene.add(boomLight);
  let boomLife = 0;

  // Smoke: three pooled clouds, each seven soft grey spheres that swell and drift.
  const SMOKE_CLOUDS = 3;
  const SMOKE_PUFFS = 7;
  const smokeGroups = [];
  const smokeLife = new Float32Array(SMOKE_CLOUDS);
  const smokeSeed = new Float32Array(SMOKE_CLOUDS * SMOKE_PUFFS * 3);
  for (let c = 0; c < SMOKE_CLOUDS; c += 1) {
    const group = new THREE.Group();
    group.visible = false;
    for (let i = 0; i < SMOKE_PUFFS; i += 1) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.32, depthWrite: false }),
      );
      group.add(puff);
    }
    scene.add(group);
    smokeGroups.push(group);
  }
  let smokeNext = 0;

  // Flashbang burst: a white sphere and a hard light, gone in a blink.
  const flashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  flashMesh.visible = false;
  scene.add(flashMesh);
  const flashLight = new THREE.PointLight(0xffffff, 0, 26);
  scene.add(flashLight);
  let flashLife = 0;

  function tracer(from, to, color) {
    const t = tracers[tracerNext];
    tracerNext = (tracerNext + 1) % TRACER_COUNT;
    const pos = t.line.geometry.attributes.position.array;
    pos[0] = from.x; pos[1] = from.y; pos[2] = from.z;
    pos[3] = to.x; pos[4] = to.y; pos[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.line.material.opacity = 0.9;
    t.line.visible = true;
    t.life = 0.07;
  }

  function burst(point, normal, count = 14, color = 0xffc46b) {
    sparks.material.color.setHex(color);
    sparks.visible = true;
    for (let i = 0; i < count; i += 1) {
      const s = sparkNext;
      sparkNext = (sparkNext + 1) % SPARK_COUNT;
      sparkPos[s * 3] = point.x;
      sparkPos[s * 3 + 1] = point.y;
      sparkPos[s * 3 + 2] = point.z;
      const spread = 2.4;
      sparkVel[s * 3] = normal.x * 2 + (Math.random() - 0.5) * spread;
      sparkVel[s * 3 + 1] = Math.abs(normal.y) * 2 + Math.random() * 2.5;
      sparkVel[s * 3 + 2] = normal.z * 2 + (Math.random() - 0.5) * spread;
      sparkLife[s] = 0.3 + Math.random() * 0.35;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  }

  function explosion(point, radius) {
    boomMesh.position.copy(point);
    boomMesh.scale.setScalar(0.3);
    boomMesh.material.opacity = 0.85;
    boomMesh.visible = true;
    boomLight.position.copy(point);
    boomLight.intensity = 90;
    boomLife = 0.45;
    burst(point, tmp.set(0, 1, 0), 60, 0xff7a1a);
    burst(point, tmp.set(0, 1, 0), 30, 0xffe1a0);
    shake = Math.max(shake, 0.5);
  }

  function smokeCloud(point) {
    const c = smokeNext;
    smokeNext = (smokeNext + 1) % SMOKE_CLOUDS;
    const group = smokeGroups[c];
    group.position.copy(point);
    group.visible = true;
    for (let i = 0; i < SMOKE_PUFFS; i += 1) {
      const o = (c * SMOKE_PUFFS + i) * 3;
      smokeSeed[o] = (Math.random() * 2 - 1) * 2.4;
      smokeSeed[o + 1] = Math.random() * 1.6 + 0.4;
      smokeSeed[o + 2] = (Math.random() * 2 - 1) * 2.4;
      const puff = group.children[i];
      puff.position.set(smokeSeed[o], smokeSeed[o + 1], smokeSeed[o + 2]);
      puff.scale.setScalar(0.6);
    }
    smokeLife[c] = 14;
  }

  function flashBurst(point) {
    flashMesh.position.copy(point);
    flashMesh.scale.setScalar(0.4);
    flashMesh.material.opacity = 0.95;
    flashMesh.visible = true;
    flashLight.position.copy(point);
    flashLight.intensity = 120;
    flashLife = 0.25;
  }

  let shake = 0;
  const tmp = new THREE.Vector3();

  function step(dt) {
    for (let c = 0; c < SMOKE_CLOUDS; c += 1) {
      if (smokeLife[c] <= 0) continue;
      smokeLife[c] -= dt;
      const group = smokeGroups[c];
      const age = 14 - Math.max(0, smokeLife[c]);
      const grow = Math.min(1, age / 2) * 0.9 + 0.6;
      const fade = smokeLife[c] < 3 ? smokeLife[c] / 3 : 1;
      for (let i = 0; i < SMOKE_PUFFS; i += 1) {
        const puff = group.children[i];
        puff.scale.setScalar(grow);
        puff.material.opacity = 0.32 * fade;
        puff.position.y += dt * 0.15;
      }
      if (smokeLife[c] <= 0) group.visible = false;
    }
    if (flashLife > 0) {
      flashLife -= dt;
      const k = Math.max(0, flashLife) / 0.25;
      flashMesh.scale.setScalar(0.4 + (1 - k) * 5);
      flashMesh.material.opacity = 0.95 * k;
      flashLight.intensity = 120 * k;
      if (flashLife <= 0) { flashMesh.visible = false; flashLight.intensity = 0; }
    }
    for (const t of tracers) {
      if (!t.line.visible) continue;
      t.life -= dt;
      if (t.life <= 0) t.line.visible = false;
      else t.line.material.opacity = t.life / 0.07 * 0.9;
    }
    let anySpark = false;
    for (let i = 0; i < SPARK_COUNT; i += 1) {
      if (sparkLife[i] <= 0) continue;
      anySpark = true;
      sparkLife[i] -= dt;
      sparkVel[i * 3 + 1] -= 9 * dt;
      sparkPos[i * 3] += sparkVel[i * 3] * dt;
      sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      if (sparkPos[i * 3 + 1] < 0.02) { sparkPos[i * 3 + 1] = 0.02; sparkVel[i * 3 + 1] *= -0.4; }
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparks.visible = anySpark;
    if (boomLife > 0) {
      boomLife -= dt;
      const k = 1 - Math.max(0, boomLife) / 0.45;
      boomMesh.scale.setScalar(0.3 + k * 6);
      boomMesh.material.opacity = Math.max(0, 0.85 * (1 - k));
      boomLight.intensity = Math.max(0, 90 * (1 - k));
      if (boomLife <= 0) { boomMesh.visible = false; boomLight.intensity = 0; }
    }
    shake = Math.max(0, shake - dt * 1.8);
  }

  return {
    tracer, burst, explosion, smokeCloud, flashBurst, step,
    addShake(amount) { shake = Math.min(0.7, shake + amount); },
    shakeOffset(out) {
      if (shake <= 0) return out.set(0, 0, 0);
      const s = shake * shake * 0.06;
      return out.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
    },
  };
}
