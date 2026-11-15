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

  let shake = 0;
  const tmp = new THREE.Vector3();

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

  function step(dt) {
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
    tracer, burst, explosion, step,
    addShake(amount) { shake = Math.min(0.7, shake + amount); },
    shakeOffset(out) {
      if (shake <= 0) return out.set(0, 0, 0);
      const s = shake * shake * 0.06;
      return out.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
    },
  };
}
