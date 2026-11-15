// Cinder Yard: industrial brickworks at sunset, 44 x 36 m.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { TEXTURES, letterDecal, skyTexture, signTexture, pavingTexture, flagTexture, glowTexture } from './textures.js';
import { NODES, EDGES, createNav } from './nav.js';

const BOXES = [
  [45, 0.4, 37, 0, -0.2, 0, 'surface'],
  [0.5, 5, 37, -22.25, 2.5, 0, 'wallA'],
  [0.5, 5, 37, 22.25, 2.5, 0, 'wallB'],
  [45, 5, 0.5, 0, 2.5, -18.25, 'wallB'],
  [45, 5, 0.5, 0, 2.5, 18.25, 'wallA'],
  [1.2, 3.6, 12, -3.4, 1.8, 0, 'wallMid'],
  [1.2, 3.6, 12, 3.4, 1.8, 0, 'wallMid'],
  [2.2, 3.6, 1, -1.7, 1.8, 0, 'wallMid'],
  [2.2, 3.6, 1, 1.7, 1.8, 0, 'wallMid'],
  [1.4, 1.1, 1.4, 1.6, 0.55, 6.5, 'stripe'],
  [1.4, 1.1, 1.4, -1.6, 0.55, -6.5, 'crate'],
  [1.4, 1.1, 1.4, -1.6, 0.55, 9.5, 'stripe'],
  [1, 3.4, 8, -13, 1.7, 4, 'wallA'],
  [1, 3.4, 6, -13, 1.7, -6, 'wallA'],
  [1, 3.4, 8, 13, 1.7, 4, 'wallB'],
  [1, 3.4, 6, 13, 1.7, -6, 'wallB'],
  [4, 3.4, 1, -6.5, 1.7, -8, 'wallMid'],
  [4, 3.4, 1, 6.5, 1.7, -8, 'wallMid'],
  [1.6, 1.1, 1.6, -10, 0.55, 0, 'stripe'],
  [1.6, 1.1, 1.6, 10, 0.55, 0, 'stripe'],
  [1.2, 4.5, 1.2, -8, 2.25, -2, 'wallMid'],
  [1.2, 4.5, 1.2, 8, 2.25, -2, 'wallMid'],
  [1.2, 4.5, 1.2, -8, 2.25, 8, 'wallMid'],
  [1.2, 4.5, 1.2, 8, 2.25, 8, 'wallMid'],
  [2.2, 1.1, 1.2, -10, 0.55, 12.5, 'crate'],
  [2.2, 1.1, 1.2, 10, 0.55, 12.5, 'crate'],
  [3, 0.9, 0.8, 0, 0.45, 11.5, 'sandbag'],
  [3, 0.9, 0.8, -6, 0.45, -13.5, 'sandbag'],
  [3, 0.9, 0.8, 6, 0.45, -13.5, 'sandbag'],
  [5, 2.6, 2.4, -17, 1.3, -14.5, 'rust'],
  [2.4, 2.6, 2.4, -14.8, 1.3, -11, 'teal'],
  [1.6, 1.1, 1.6, -18.5, 0.55, -10.5, 'stripe'],
  [2.4, 1.1, 1.2, -19, 0.55, -13, 'crate'],
  [5, 2.6, 2.4, 17, 1.3, -14.5, 'teal'],
  [2.4, 2.6, 2.4, 14.8, 1.3, -11, 'rust'],
  [1.6, 1.1, 1.6, 18.5, 0.55, -10.5, 'stripe'],
  [2.4, 1.1, 1.2, 19, 0.55, -13, 'crate'],
  [2, 1.1, 1, -4, 0.55, 15.5, 'crate'],
  [2, 1.1, 1, 4, 0.55, 15.5, 'crate'],
  [2, 1.1, 1, -4, 0.55, -15.5, 'crate'],
  [2, 1.1, 1, 4, 0.55, -15.5, 'crate'],
];


export const SITES = {
  A: { name: 'Kiln Hall', center: { x: -16.5, z: -12.5 }, rect: { x0: -19.5, x1: -13.5, z0: -15.5, z1: -9.5 } },
  B: { name: 'Clay Pits', center: { x: 16.5, z: -12.5 }, rect: { x0: 13.5, x1: 19.5, z0: -15.5, z1: -9.5 } },
};

export const SPAWNS = {
  ember: [
    { x: 0, z: 15.5, yaw: 0 }, { x: -3, z: 15, yaw: 0 }, { x: 3, z: 15, yaw: 0 },
    { x: -6, z: 14, yaw: 0 }, { x: 6, z: 14, yaw: 0 },
  ],
  ash: [
    { x: 0, z: -15.5, yaw: Math.PI }, { x: -3, z: -15, yaw: Math.PI }, { x: 3, z: -15, yaw: Math.PI },
    { x: -6, z: -14, yaw: Math.PI }, { x: 6, z: -14, yaw: Math.PI },
  ],
};

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const materials = {};
  const TEXTURED = { surface: 'floor', wall: 'wall', crate: 'crate', rust: 'rust', teal: 'teal' };
  for (const name of Object.keys(PALETTE)) {
    const texName = TEXTURED[name];
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(texName ? '#ffffff' : PALETTE[name]),
      map: texName ? TEXTURES[texName] : null,
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: name === 'rust' || name === 'teal' ? 0.25 : 0.03,
    });
  }
  for (const [name, tex] of Object.entries({
    wallA: TEXTURES.wallWarm, wallB: TEXTURES.wallCool, wallMid: TEXTURES.wallGrey,
    stripe: TEXTURES.stripe, sandbag: TEXTURES.sandbag,
  })) {
    materials[name] = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.92, metalness: 0.03 });
  }
  const colliders = [];
  const shootables = [];
  const footprints = [];

  function box(w, h, d, x, y, z, material) {
    const mat = materials[material].clone();
    if (mat.map) {
      mat.map = mat.map.clone();
      mat.map.repeat.set(Math.max(w, d) / 4, Math.max(h, 1.2) / 4);
      mat.map.needsUpdate = true;
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    if (w < 40 && d < 40) footprints.push({ x, z, w, d });
    return mesh;
  }
  for (const entry of BOXES) box(...entry);

  for (const key of ['A', 'B']) {
    const site = SITES[key];
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(site.rect.x1 - site.rect.x0, site.rect.z1 - site.rect.z0),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(key === 'A' ? PALETTE.accent : PALETTE.zoneB),
        transparent: true, opacity: 0.18, side: THREE.DoubleSide,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(site.center.x, 0.03, site.center.z);
    group.add(marker);
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({
        map: letterDecal(key, key === 'A' ? PALETTE.accent : PALETTE.zoneB),
        transparent: true, opacity: 0.9, depthWrite: false,
      }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(site.center.x + (key === 'A' ? 2 : -2), 0.04, site.center.z);
    group.add(decal);
  }

  const ZONE_TINTS = [
    { x0: -7, x1: 7, z0: -18.5, z1: 18.5, color: PALETTE.concrete, opacity: 0.08 },
    { x0: -8, x1: 8, z0: 12, z1: 18.5, color: PALETTE.accent, opacity: 0.07 },
    { x0: -8, x1: 8, z0: -18.5, z1: -12, color: PALETTE.ash, opacity: 0.07 },
    { x0: -22.5, x1: -12.5, z0: -18.5, z1: -8.5, color: PALETTE.accent, opacity: 0.10 },
    { x0: 12.5, x1: 22.5, z0: -18.5, z1: -8.5, color: PALETTE.zoneB, opacity: 0.10 },
  ];
  for (const t of ZONE_TINTS) {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(t.x1 - t.x0, t.z1 - t.z0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(t.color), transparent: true, opacity: t.opacity, depthWrite: false }),
    );
    tint.rotation.x = -Math.PI / 2;
    tint.position.set((t.x0 + t.x1) / 2, 0.02, (t.z0 + t.z1) / 2);
    group.add(tint);
  }

  const barrelCols = [PALETTE.rust, PALETTE.teal, '#3a3a3a'];
  for (let i = 0; i < 4; i += 1) {
    const [bx, bz] = [[-10, 0], [10, 0], [-18.5, -10.5], [18.5, -10.5]][i];
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.85, 14),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(barrelCols[i % 3]), roughness: 0.6, metalness: 0.35 }),
    );
    barrel.position.set(bx, 1.53, bz);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    group.add(barrel);
  }

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const glowTex = glowTexture();
  function glowSprite(x, y, z, color, scale, opacity) {
    const mat = new THREE.SpriteMaterial({
      map: glowTex, color: new THREE.Color(color), transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(scale);
    group.add(sprite);
    return sprite;
  }
  glowSprite(-34, 10, -15, '#ffc46b', 26, 0.9);
  glowSprite(-16.5, 4.4, -12.5, PALETTE.accent, 7, 0.4);
  glowSprite(16.5, 4.4, -12.5, PALETTE.zoneB, 7, 0.35);
  glowSprite(0, 4.5, 0, '#ff9a3c', 6, 0.35);

  const paving = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: pavingTexture(), transparent: true, opacity: 0.85, depthWrite: false }),
  );
  paving.rotation.x = -Math.PI / 2;
  paving.position.set(0, 0.015, 10);
  group.add(paving);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 5, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#33302c'), roughness: 0.5, metalness: 0.6 }),
  );
  pole.position.set(-6, 2.5, 10);
  pole.castShadow = true;
  group.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.06),
    new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.8 }),
  );
  flag.position.set(-5.15, 4.4, 10);
  flag.rotation.y = Math.PI / 2;
  group.add(flag);
  for (const bx of [-12.2, 12.2]) {
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.45, 1.8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.crate), roughness: 0.85 }),
    );
    bench.position.set(bx, 0.22, 8);
    bench.castShadow = true;
    bench.receiveShadow = true;
    group.add(bench);
  }

  const glassMat = new THREE.MeshStandardMaterial({
    map: TEXTURES.glass, emissive: new THREE.Color('#ffb36b'),
    emissiveMap: TEXTURES.glass, emissiveIntensity: 0.9, roughness: 0.4,
  });
  function window(x, y, z, rotY) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), glassMat);
    w.position.set(x, y, z);
    w.rotation.y = rotY;
    group.add(w);
  }
  for (const z of [-8, 0, 8]) { window(-21.94, 3.2, z, Math.PI / 2); window(21.94, 3.2, z, -Math.PI / 2); }
  for (const x of [-8, 0, 8]) { window(x, 3.2, -17.94, 0); window(x, 3.2, 17.94, Math.PI); }

  const steelMat = new THREE.MeshStandardMaterial({ map: TEXTURES.steel, roughness: 0.5, metalness: 0.55 });
  for (const px of [-0.72, 0.72]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 0.3), steelMat);
    post.position.set(px, 1.9, 0);
    post.castShadow = true;
    group.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.3), steelMat);
  lintel.position.set(0, 3.75, 0);
  group.add(lintel);
  for (const bz of [-8, 0, 8]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(44, 0.35, 0.5), steelMat);
    beam.position.set(0, 4.4, bz);
    group.add(beam);
  }
  for (const bx of [-10, 10]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 36), steelMat);
    beam.position.set(bx, 4.4, 0);
    group.add(beam);
  }
  function pipe(x, z, len, horizontal) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 10), steelMat);
    if (horizontal) p.rotation.x = Math.PI / 2;
    p.position.set(x, 3.0, z);
    group.add(p);
  }
  pipe(-21.9, 0, 36, true);
  pipe(21.9, 0, 36, true);

  function sign(text, sub, color, w, x, y, z, rotY) {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: signTexture(text, sub, color) }),
    );
    s.position.set(x, y, z);
    s.rotation.y = rotY;
    group.add(s);
  }
  sign('KILN HALL', 'SITE A', PALETTE.accent, 4, -21.94, 4.2, -12.5, Math.PI / 2);
  sign('CLAY PITS', 'SITE B', PALETTE.zoneB, 4, 21.94, 4.2, -12.5, -Math.PI / 2);
  sign('KILN HALL', 'A →', PALETTE.accent, 3.2, -12.94, 3.9, 4, Math.PI / 2);
  sign('CLAY PITS', '← B', PALETTE.zoneB, 3.2, 12.94, 3.9, 4, -Math.PI / 2);
  sign('CINDER YARD', '', '#f2e8d5', 4.5, 0, 4.2, 17.94, Math.PI);

  const brickMat = new THREE.MeshStandardMaterial({ map: TEXTURES.brick, roughness: 0.9, metalness: 0.05 });
  for (const [sx, sz] of [[-24, -10], [24, 10]]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 14, 14), brickMat);
    stack.position.set(sx, 7, sz);
    group.add(stack);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.5, 14), steelMat);
    rim.position.set(sx, 13.8, sz);
    group.add(rim);
    glowSprite(sx, 14.6, sz, '#ff9a3c', 3, 0.5);
  }
  for (const [key, lx, lz] of [['A', -17, -13.28], ['B', 17, -13.28]]) {
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: letterDecal(key, key === 'A' ? PALETTE.accent : PALETTE.zoneB), transparent: true, opacity: 0.9, depthWrite: false }));
    wl.position.set(lx, 1.4, lz);
    group.add(wl);
  }

  const skyLight = new THREE.HemisphereLight(new THREE.Color('#ffe2b8'), new THREE.Color('#2c1e11'), 1.62);
  scene.add(skyLight);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffb36b'), 4.5);
  sun.position.set(14, 18, 12);
  sun.target.position.set(0, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#5a6f8a'), 1.02);
  fill.position.set(-10, 12, 14);
  scene.add(fill);
  for (const key of ['A', 'B']) {
    const site = SITES[key];
    const lamp = new THREE.PointLight(new THREE.Color(key === 'A' ? PALETTE.accent : PALETTE.zoneB), key === 'A' ? 20 : 12, 18);
    lamp.position.set(site.center.x, 4.4, site.center.z);
    scene.add(lamp);
  }
  const midLamp = new THREE.PointLight(new THREE.Color('#ff9a3c'), 12, 18);
  midLamp.position.set(0, 4.5, 0);
  scene.add(midLamp);
  const spawnLamp = new THREE.PointLight(new THREE.Color(PALETTE.accent), 8, 14);
  spawnLamp.position.set(0, 4, 15.5);
  scene.add(spawnLamp);

  const nav = createNav(NODES, EDGES);
  const { adjacency, nearestNode, findPath } = nav;
  function inSite(x, z, key) {
    const r = SITES[key].rect;
    return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  }

  return {
    colliders, shootables, footprints, group, sites: SITES,
    nav, nodes: NODES, adjacency, nearestNode, findPath, inSite,
  };
}
