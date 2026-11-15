// Cinder Yard: an original dusk freight yard, 44 x 36 m. Two bomb sites (A west, B east),
// three lanes (west, mid, east), a mid choke, container stacks and crate cover. Every box
// is a collider and a surface a bullet stops on; the waypoint graph is what the bots walk.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { TEXTURES, letterDecal } from './textures.js';

// [width, height, depth, x, y, z, material]
const BOXES = [
  // Floor and outer walls (5 m high, open sky so one low sun reaches every corner).
  // Zone palettes: west/south warm orange (Ember side, A site), east/north cool teal (Ash side, B site).
  [45, 0.4, 37, 0, -0.2, 0, 'surface'],
  [0.5, 5, 37, -22.25, 2.5, 0, 'wallA'],
  [0.5, 5, 37, 22.25, 2.5, 0, 'wallB'],
  [45, 5, 0.5, 0, 2.5, -18.25, 'wallB'],
  [45, 5, 0.5, 0, 2.5, 18.25, 'wallA'],
  // Mid corridor: grey concrete, two long walls and a choke with a 1.2 m doorway at the centre.
  [1.2, 3.6, 12, -3.4, 1.8, 0, 'wallMid'],
  [1.2, 3.6, 12, 3.4, 1.8, 0, 'wallMid'],
  [2.2, 3.6, 1, -1.7, 1.8, 0, 'wallMid'],
  [2.2, 3.6, 1, 1.7, 1.8, 0, 'wallMid'],
  // Mid crates (kept off the centre line so the choke stays walkable).
  [1.4, 1.1, 1.4, 1.6, 0.55, 6.5, 'stripe'],
  [1.4, 1.1, 1.4, -1.6, 0.55, -6.5, 'crate'],
  [1.4, 1.1, 1.4, -1.6, 0.55, 9.5, 'stripe'],
  // Lane walls: the west and east lanes are split from the yard by long walls.
  [1, 3.4, 8, -13, 1.7, 4, 'wallA'],
  [1, 3.4, 6, -13, 1.7, -6, 'wallA'],
  [1, 3.4, 8, 13, 1.7, 4, 'wallB'],
  [1, 3.4, 6, 13, 1.7, -6, 'wallB'],
  // Connector walls at z = -8, with gaps at the lanes and at mid.
  [4, 3.4, 1, -6.5, 1.7, -8, 'wallMid'],
  [4, 3.4, 1, 6.5, 1.7, -8, 'wallMid'],
  // Lane crates and pillars.
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
  // Site A (west): rust container stack and a teal box, with a low crate for cover.
  [5, 2.6, 2.4, -17, 1.3, -14.5, 'rust'],
  [2.4, 2.6, 2.4, -14.8, 1.3, -11, 'teal'],
  [1.6, 1.1, 1.6, -18.5, 0.55, -10.5, 'stripe'],
  [2.4, 1.1, 1.2, -19, 0.55, -13, 'crate'],
  // Site B (east): the mirror, colours swapped.
  [5, 2.6, 2.4, 17, 1.3, -14.5, 'teal'],
  [2.4, 2.6, 2.4, 14.8, 1.3, -11, 'rust'],
  [1.6, 1.1, 1.6, 18.5, 0.55, -10.5, 'stripe'],
  [2.4, 1.1, 1.2, 19, 0.55, -13, 'crate'],
  // Spawn cover, south (Ember) and north (Ash).
  [2, 1.1, 1, -4, 0.55, 15.5, 'crate'],
  [2, 1.1, 1, 4, 0.55, 15.5, 'crate'],
  [2, 1.1, 1, -4, 0.55, -15.5, 'crate'],
  [2, 1.1, 1, 4, 0.55, -15.5, 'crate'],
];

// Waypoint graph the bots walk: [x, z] nodes and undirected edges between them.
const NODES = [
  [0, 15], [-5, 14], [5, 14], [0, 10], [-10, 10], [10, 10], [-10, 5], [10, 5],
  [0, 5], [0, 0], [0, -5], [-10, -2], [10, -2], [-10, -9], [10, -9], [0, -11],
  [-6, -12], [6, -12], [-14, -12], [14, -12], [-16.5, -12.5], [16.5, -12.5],
  [0, -15], [-6, -15], [6, -15], [-16, -6], [16, -6],
];
const EDGES = [
  [0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 4], [3, 5], [3, 8], [4, 6], [5, 7],
  [6, 11], [7, 12], [8, 9], [9, 10], [10, 15], [11, 13], [12, 14], [13, 18],
  [14, 19], [25, 18], [26, 19], [18, 20], [19, 21], [15, 16],
  [15, 17], [15, 22], [16, 18], [17, 19], [16, 22], [17, 22], [22, 23], [22, 24],
  [23, 18], [24, 19], [20, 25], [21, 26], [3, 6], [3, 7],
];

export const SITES = {
  A: { name: 'Warehouse', center: { x: -16.5, z: -12.5 }, rect: { x0: -19.5, x1: -13.5, z0: -15.5, z1: -9.5 } },
  B: { name: 'Depot', center: { x: 16.5, z: -12.5 }, rect: { x0: 13.5, x1: 19.5, z0: -15.5, z1: -9.5 } },
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
  // Zone materials: one texture per zone palette, same roughness as the walls.
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
    // Clone the textured material per box so the repeat follows the box's size
    // instead of stretching one tile across a 45 m wall.
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
    if (w < 40 && d < 40) footprints.push({ x, z, w, d }); // the floor stays off the minimap
    return mesh;
  }
  for (const entry of BOXES) box(...entry);

  // Site floor markers: visual only, no collider, so nobody trips on paint.
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
    // Big painted letter on the floor: the site reads at a glance.
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({
        map: letterDecal(key, key === 'A' ? PALETTE.accent : PALETTE.zoneB),
        transparent: true, opacity: 0.9, depthWrite: false,
      }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(site.center.x, 0.04, site.center.z);
    group.add(decal);
  }

  // Zone floor tints: each area of the yard reads in its own colour at a glance.
  // Drawn in order so site tints win over spawn tints where they overlap.
  const ZONE_TINTS = [
    { x0: -7, x1: 7, z0: -18.5, z1: 18.5, color: PALETTE.concrete, opacity: 0.08 }, // mid grey
    { x0: -8, x1: 8, z0: 12, z1: 18.5, color: PALETTE.accent, opacity: 0.07 }, // Ember spawn warm
    { x0: -8, x1: 8, z0: -18.5, z1: -12, color: PALETTE.ash, opacity: 0.07 }, // Ash spawn cool
    { x0: -22.5, x1: -12.5, z0: -18.5, z1: -8.5, color: PALETTE.accent, opacity: 0.10 }, // A warm
    { x0: 12.5, x1: 22.5, z0: -18.5, z1: -8.5, color: PALETTE.zoneB, opacity: 0.10 }, // B cool
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

  // Barrels: visual-only drums sitting on top of existing crate cover, so no
  // collider or sightline changes — the crates underneath already block both.
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

  // Light: a low amber sun, a cool sky fill, and a floodlight over each site.
  const sky = new THREE.HemisphereLight(new THREE.Color('#ffe2b8'), new THREE.Color('#2c1e11'), 1.35);
  scene.add(sky);
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
  const fill = new THREE.DirectionalLight(new THREE.Color('#5a6f8a'), 0.85);
  fill.position.set(-10, 12, 14);
  scene.add(fill);
  for (const key of ['A', 'B']) {
    const site = SITES[key];
    const lamp = new THREE.PointLight(new THREE.Color(key === 'A' ? PALETTE.accent : PALETTE.zoneB), 20, 18);
    lamp.position.set(site.center.x, 4.4, site.center.z);
    scene.add(lamp);
  }
  // Extra coloured accents: warm amber over the mid choke, ember orange over the south spawn.
  const midLamp = new THREE.PointLight(new THREE.Color('#ff9a3c'), 12, 18);
  midLamp.position.set(0, 4.5, 0);
  scene.add(midLamp);
  const spawnLamp = new THREE.PointLight(new THREE.Color(PALETTE.accent), 8, 14);
  spawnLamp.position.set(0, 4, 15.5);
  scene.add(spawnLamp);

  // Waypoint graph: adjacency lists, BFS pathfinding, nearest-node lookup.
  const adjacency = NODES.map(() => []);
  for (const [a, b] of EDGES) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  function nearestNode(x, z) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < NODES.length; i += 1) {
      const dx = NODES[i][0] - x;
      const dz = NODES[i][1] - z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }
  function findPath(from, to) {
    if (from === to) return [from];
    const prev = new Array(NODES.length).fill(-1);
    const queue = [from];
    prev[from] = from;
    while (queue.length) {
      const node = queue.shift();
      for (const next of adjacency[node]) {
        if (prev[next] !== -1) continue;
        prev[next] = node;
        if (next === to) {
          const path = [to];
          let cur = to;
          while (cur !== from) { cur = prev[cur]; path.unshift(cur); }
          return path;
        }
        queue.push(next);
      }
    }
    return [from];
  }
  function inSite(x, z, key) {
    const r = SITES[key].rect;
    return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  }

  return {
    colliders, shootables, footprints, group, sites: SITES,
    nodes: NODES, adjacency, nearestNode, findPath, inSite,
  };
}
