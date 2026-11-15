// Transient combat feedback: tracers, impact sparks, explosions and camera shake.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { glowTexture } from './textures.js';

const TRACER_COUNT = 24;
const SPARK_COUNT = 320;

export function createEffects(scene) {
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

  const boomMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0, depthWrite: false }),
  );
  boomMesh.visible = false;
  scene.add(boomMesh);
  const boomLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 22);
  scene.add(boomLight);
  let boomLife = 0;

  // Smoke: soft radial-gradient sprites, varied size/rotation/opacity — layered vapour, never flat discs.
  const smokeTex = glowTexture();
  const SMOKE_CLOUDS = 3;
  const SMOKE_PUFFS = 10;
  const smokeGroups = [];
  const smokeLife = new Float32Array(SMOKE_CLOUDS);
  const smokeSeed = new Float32Array(SMOKE_CLOUDS * SMOKE_PUFFS * 3);
  const smokeBase = new Float32Array(SMOKE_CLOUDS * SMOKE_PUFFS * 2); // width, opacity
  for (let c = 0; c < SMOKE_CLOUDS; c += 1) {
    const group = new THREE.Group();
    group.visible = false;
    for (let i = 0; i < SMOKE_PUFFS; i += 1) {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({
        map: smokeTex, color: 0xd5cfc4, transparent: true, opacity: 0.35, depthWrite: false,
      }));
      group.add(puff);
    }
    scene.add(group);
    smokeGroups.push(group);
  }
  let smokeNext = 0;

  const flashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  flashMesh.visible = false;
  scene.add(flashMesh);
  const flashLight = new THREE.PointLight(0xffffff, 0, 26);
  scene.add(flashLight);
  let flashLife = 0;

  const blotchCanvas = document.createElement('canvas');
  blotchCanvas.width = 64;
  blotchCanvas.height = 64;
  const bctx = blotchCanvas.getContext('2d');
  const bg = bctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  bg.addColorStop(0, 'rgba(18,10,5,0.95)');
  bg.addColorStop(0.6, 'rgba(30,18,8,0.6)');
  bg.addColorStop(1, 'rgba(30,18,8,0)');
  bctx.fillStyle = bg;
  bctx.fillRect(0, 0, 64, 64);
  const blotchTex = new THREE.CanvasTexture(blotchCanvas);
  const DECAL_COUNT = 12;
  const decals = [];
  for (let i = 0; i < DECAL_COUNT; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({ map: blotchTex, transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.visible = false;
    scene.add(mesh);
    decals.push({ mesh, life: 0 });
  }
  let decalNext = 0;

  const CASING_COUNT = 16;
  const casings = [];
  const casingVel = new Float32Array(CASING_COUNT * 3);
  const casingLife = new Float32Array(CASING_COUNT);
  const casingSpin = new Float32Array(CASING_COUNT);
  const casingMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b08d3e'), roughness: 0.35, metalness: 0.8 });
  for (let i = 0; i < CASING_COUNT; i += 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.05), casingMat);
    mesh.visible = false;
    mesh.castShadow = true;
    scene.add(mesh);
    casings.push(mesh);
  }
  let casingNext = 0;

  const bombGroup = new THREE.Group();
  const bombBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.12, 0.2),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e1c1a'), roughness: 0.6, metalness: 0.4 }),
  );
  bombBody.position.y = 0.06;
  const bombLampMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const bombLamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), bombLampMat);
  bombLamp.position.set(0.08, 0.16, 0);
  const bombWire = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.008, 6, 14),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.3 }),
  );
  bombWire.position.set(-0.06, 0.1, 0);
  bombWire.rotation.x = Math.PI / 2.4;
  const bombLight = new THREE.PointLight(0xff2a1a, 0, 8);
  bombLight.position.set(0, 0.3, 0);
  bombGroup.add(bombBody, bombLamp, bombLight, bombWire);
  bombGroup.visible = false;
  scene.add(bombGroup);
  let bombTime = 0;

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
      smokeSeed[o] = (Math.random() * 2 - 1) * 1.8;
      smokeSeed[o + 1] = Math.random() * 1.2 + 0.1;
      smokeSeed[o + 2] = (Math.random() * 2 - 1) * 1.8;
      const puff = group.children[i];
      puff.position.set(smokeSeed[o], smokeSeed[o + 1], smokeSeed[o + 2]);
      const b = (c * SMOKE_PUFFS + i) * 2;
      smokeBase[b] = 2.4 + Math.random() * 1.4;
      smokeBase[b + 1] = 0.38 + Math.random() * 0.14;
      puff.scale.setScalar(smokeBase[b]);
      puff.material.opacity = smokeBase[b + 1];
      puff.material.rotation = Math.random() * Math.PI * 2;
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

  function decal(point, normal) {
    const d = decals[decalNext];
    decalNext = (decalNext + 1) % DECAL_COUNT;
    d.mesh.position.copy(point).addScaledVector(normal, 0.02);
    d.mesh.lookAt(tmp.copy(point).add(normal));
    d.mesh.material.opacity = 0.85;
    d.mesh.visible = true;
    d.life = 8;
  }

  function casing(pos, right) {
    const i = casingNext;
    casingNext = (casingNext + 1) % CASING_COUNT;
    const mesh = casings[i];
    mesh.position.copy(pos);
    mesh.visible = true;
    casingVel[i * 3] = right.x * 1.4 + (Math.random() - 0.5) * 0.4;
    casingVel[i * 3 + 1] = 1.6 + Math.random() * 0.8;
    casingVel[i * 3 + 2] = right.z * 1.4 - 0.6 + (Math.random() - 0.5) * 0.4;
    casingSpin[i] = (Math.random() - 0.5) * 20;
    casingLife[i] = 2.5;
  }

  function plantBomb(x, z) {
    bombGroup.position.set(x, 0, z);
    bombGroup.visible = true;
    bombTime = 0;
  }

  function clearBomb() {
    bombGroup.visible = false;
    bombLight.intensity = 0;
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
      group.rotation.y += dt * 0.05;
      for (let i = 0; i < SMOKE_PUFFS; i += 1) {
        const puff = group.children[i];
        const b = (c * SMOKE_PUFFS + i) * 2;
        puff.scale.setScalar(smokeBase[b] * grow);
        puff.material.opacity = smokeBase[b + 1] * fade;
        puff.material.rotation += dt * 0.04;
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
    for (const d of decals) {
      if (!d.mesh.visible) continue;
      d.life -= dt;
      if (d.life <= 0) { d.mesh.visible = false; continue; }
      d.mesh.material.opacity = d.life < 2 ? 0.85 * (d.life / 2) : 0.85;
    }
    for (let i = 0; i < CASING_COUNT; i += 1) {
      if (casingLife[i] <= 0) continue;
      casingLife[i] -= dt;
      const mesh = casings[i];
      if (casingLife[i] <= 0) { mesh.visible = false; continue; }
      casingVel[i * 3 + 1] -= 9 * dt;
      mesh.position.x += casingVel[i * 3] * dt;
      mesh.position.y += casingVel[i * 3 + 1] * dt;
      mesh.position.z += casingVel[i * 3 + 2] * dt;
      mesh.rotation.x += casingSpin[i] * dt;
      mesh.rotation.z += casingSpin[i] * 0.7 * dt;
      if (mesh.position.y < 0.03) {
        mesh.position.y = 0.03;
        casingVel[i * 3 + 1] = Math.abs(casingVel[i * 3 + 1]) * 0.35;
        casingVel[i * 3] *= 0.6;
        casingVel[i * 3 + 2] *= 0.6;
        casingSpin[i] *= 0.5;
      }
    }
    if (bombGroup.visible) {
      bombTime += dt;
      const on = Math.sin(bombTime * 12) > 0;
      bombLight.intensity = on ? 7 : 0.6;
      bombLampMat.color.setHex(on ? 0xff2a1a : 0x661008);
    }
  }

  return {
    tracer, burst, explosion, smokeCloud, flashBurst, decal, casing, plantBomb, clearBomb, step,
    addShake(amount) { shake = Math.min(0.7, shake + amount); },
    shakeOffset(out) {
      if (shake <= 0) return out.set(0, 0, 0);
      const s = shake * shake * 0.06;
      return out.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
    },
  };
}
