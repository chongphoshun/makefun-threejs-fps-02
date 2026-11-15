// Armoury: 5 guns, 3 grenades, buildRifle.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const W = (name, kind, price, damage, headMult, rate, auto, mag, reserve, spreadStill, spreadMove, reloadTime, tracer, pellets) => ({ name, kind, price, damage, headMult, rate, auto, mag, reserve, spreadStill, spreadMove, reloadTime, tracer, pellets });
export const WEAPONS = {
  pistol: W('P9 Sidearm', 'pistol', 0, 26, 3, 0.16, false, 12, 48, 0.004, 0.02, 1.4, 0xffe1a0, 1),
  smg: W('VK-9 Rasp', 'smg', 1500, 22, 3, 0.083, true, 28, 84, 0.006, 0.03, 1.8, 0xffc46b, 1),
  rifle: W('AR-77 Ember', 'rifle', 2700, 33, 4, 0.1, true, 30, 90, 0.003, 0.024, 2.0, 0xffb36b, 1),
  sniper: W('LR-88 Longbow', 'sniper', 4750, 95, 4, 1.15, false, 5, 15, 0.0008, 0.03, 2.8, 0xfff2cc, 1),
  shotty: W('Moss-12 Breacher', 'shotgun', 1700, 14, 2, 0.9, false, 6, 24, 0.03, 0.05, 2.6, 0xffd9a0, 8),
  he: W('SPARK-4 HE', 'grenade', 300, 120, 1, 0.9, false, 1, 0, 0, 0, 0, 0xff7a1a, 1),
  smoke: W('GHOST-2 Smoke', 'grenade', 400, 0, 1, 0.9, false, 1, 0, 0, 0, 0, 0xcccccc, 1),
  flash: W('DAZZLE-1 Flash', 'grenade', 250, 0, 1, 0.9, false, 1, 0, 0, 0, 0, 0xffffff, 1),
};
export const WEAPON_ORDER = ['pistol', 'smg', 'rifle', 'sniper', 'shotty', 'he', 'smoke', 'flash'];
export const GRENADE_ORDER = ['he', 'smoke', 'flash'];
export const ARMOR_PRICE = 650;
export const HELMET_PRICE = 350;
export const KIT_PRICE = 400;
export const ARMOR_MAX = 100;

const GRIP = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.surface), roughness: 0.7, metalness: 0.2 });
const STEEL = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.gunmetal), roughness: 0.45, metalness: 0.5 });
const EMBER = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.3 });
const GREY = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a8a8a'), roughness: 0.6, metalness: 0.2 });
const WHITE = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8e8e8'), roughness: 0.5, metalness: 0.1 });
const TAN = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a6f4d'), roughness: 0.6, metalness: 0.2 });
const POLY = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e1c1a'), roughness: 0.85, metalness: 0.05 });
const GLOVE = new THREE.MeshStandardMaterial({ color: new THREE.Color('#241a12'), roughness: 0.95, metalness: 0 });

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  g.addColorStop(0, 'rgba(255,244,210,1)');
  g.addColorStop(0.35, 'rgba(255,170,60,0.9)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,225,160,0.95)';
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.translate(64, 64);
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(0, -58); ctx.lineTo(5, 0); ctx.lineTo(0, 10);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function part(w, h, d, x, y, z, mat, rx = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  mesh.rotation.z = rz;
  return mesh;
}

// One rifle builder for every long gun: [rw, rh, rl, barrelL, guardL, magL, magRx, magZ, stockL, optic, guardMat]
// optic: 0 none, 1 red-dot, 2 scope.
export const RIFLE_SPEC = {
  smg: [0.08, 0.09, 0.34, 0.18, 0.2, 0.16, 0, -0.02, 0.16, 1, TAN],
  rifle: [0.09, 0.1, 0.4, 0.24, 0.3, 0.14, 0.15, 0.02, 0.2, 1, TAN],
  sniper: [0.07, 0.09, 0.5, 0.5, 0, 0.1, 0, 0, 0.24, 2, TAN],
  shotty: [0.1, 0.11, 0.42, 0.34, 0, 0.09, 0, -0.32, 0.2, 0, TAN],
};

export function buildRifle(spec) {
  const [rw, rh, rl, bl, gl, ml, mrx, mz, sl, optic, gm] = spec;
  const g = new THREE.Group();
  const add = (w, h, d, x, y, z, m, rx = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    if (rx) mesh.rotation.x = rx;
    g.add(mesh);
    return mesh;
  };
  add(rw, rh, rl, 0, 0, 0, STEEL); // receiver
  if (gl > 0) {
    add(rw - 0.01, rh - 0.02, gl, 0, 0.01, -(rl / 2 + gl / 2 - 0.02), gm); // railed handguard
    add(0.035, 0.012, gl, 0, rh / 2 + 0.008, -(rl / 2 + gl / 2 - 0.02), GREY); // top rail
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, bl, 8), GREY);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -(rl / 2 + gl + bl / 2 - 0.02));
  g.add(barrel);
  add(0.05, 0.05, 0.08, 0, 0.01, -(rl / 2 + gl + bl - 0.02), GREY); // muzzle brake
  const mag = add(0.05, ml, 0.07, 0, -rh / 2 - ml / 2 + 0.02, mz, POLY, mrx); // curved magazine
  add(0.05, 0.12, 0.07, 0, -0.1, 0.06, POLY, 0.25); // grip
  add(0.07, 0.09, sl, 0, -0.01, rl / 2 + sl / 2 - 0.04, POLY); // stock
  if (optic === 1) add(0.05, 0.05, 0.14, 0, rh / 2 + 0.025, -0.12, EMBER); // red-dot optic
  else if (optic === 2) {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), EMBER);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, rh / 2 + 0.04, -0.12);
    g.add(scope);
  }
  mag.userData.baseY = mag.position.y;
  mag.userData.baseRX = mag.rotation.x;
  g.userData.mag = mag;
  return g;
}

function hands(model, gx, gy, gz, sx, sy, sz) {
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.09), GLOVE);
  grip.position.set(gx, gy, gz);
  grip.rotation.x = 0.25;
  const support = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.12), GLOVE);
  support.position.set(sx, sy, sz);
  support.rotation.x = -0.15;
  model.add(grip, support);
}

function buildModel(id) {
  const model = new THREE.Group();
  let mag = null;
  if (id === 'pistol') {
    model.add(
      part(0.06, 0.05, 0.26, 0, 0.02, -0.1, STEEL), part(0.055, 0.05, 0.24, 0, -0.03, -0.08, POLY),
      part(0.03, 0.03, 0.05, 0, 0.02, -0.25, GREY), part(0.05, 0.13, 0.07, 0, -0.09, 0.03, POLY, 0.25),
      part(0.04, 0.02, 0.08, 0, -0.06, -0.06, POLY), part(0.012, 0.025, 0.012, 0, 0.06, -0.22, EMBER),
      part(0.04, 0.02, 0.015, 0, 0.055, 0.02, GREY), part(0.062, 0.02, 0.04, 0, 0.02, 0, GREY),
      part(0.062, 0.008, 0.2, 0, 0.045, -0.1, EMBER),
    );
    mag = part(0.05, 0.02, 0.07, 0, -0.16, 0.04, EMBER);
    model.add(mag);
    hands(model, 0, -0.09, 0.03, 0, -0.055, -0.14);
  } else if (id === 'smg' || id === 'rifle' || id === 'sniper' || id === 'shotty') {
    const r = buildRifle(RIFLE_SPEC[id]);
    model.add(r);
    mag = r.userData.mag;
    hands(model, 0, -0.09, 0.06, 0, -0.06, -(0.15 + RIFLE_SPEC[id][4] * 0.6));
  } else {
    const mat = id === 'he' ? EMBER : id === 'smoke' ? GREY : WHITE;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12), mat);
    body.rotation.x = Math.PI / 2;
    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 16), STEEL);
    pin.position.set(0.05, 0.06, 0);
    const lever = part(0.015, 0.1, 0.02, -0.045, 0.03, 0, STEEL);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 12), POLY);
    band.rotation.x = Math.PI / 2;
    band.position.z = -0.04;
    model.add(body, pin, lever, band);
    hands(model, 0, -0.06, 0.02, 0, -0.05, -0.06);
  }
  if (mag) {
    mag.userData.baseY = mag.position.y;
    mag.userData.baseRX = mag.rotation.x;
    model.userData.mag = mag;
  }
  model.position.set(0.22, -0.21, -0.48);
  model.scale.setScalar(0.8);
  return model;
}

export function createWeapons(camera) {
  const models = {};
  for (const id of WEAPON_ORDER) {
    models[id] = buildModel(id);
    models[id].visible = false;
    camera.add(models[id]);
  }
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.55),
    new THREE.MeshBasicMaterial({ map: flashTexture(), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  flash.position.set(0.24, -0.13, -1.15);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);
  const charge = new THREE.Group();
  const chargeBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), POLY);
  const chargeLamp = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  chargeLamp.position.set(0.05, 0.05, 0);
  const chargeWire = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 12), EMBER);
  chargeWire.position.set(-0.05, 0.04, 0);
  charge.add(chargeBody, chargeLamp, chargeWire);
  charge.position.set(0.1, -0.21, -0.55);
  charge.visible = false;
  camera.add(charge);

  const ammo = {};
  for (const id of WEAPON_ORDER) ammo[id] = { mag: 0, reserve: 0 };
  ammo.pistol = { mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve };
  const state = {
    current: 'pistol', cooldown: 0, reloadLeft: 0, flash: 0, kick: 0,
    grenades: { he: 0, smoke: 0, flash: 0 }, armor: 0, helmet: false, kit: false,
    aiming: false, owned: new Set(['pistol']),
  };
  models.pistol.visible = true;

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[state.current];
    model.position.z = -0.48 + state.kick - (state.aiming && WEAPONS[state.current].kind !== 'grenade' ? 0.06 : 0);
    model.rotation.x = state.kick * 2.2;
    if (state.aiming && WEAPONS[state.current].kind !== 'grenade') {
      model.position.x += (0.0 - model.position.x) * Math.min(1, dt * 12);
      model.position.y += (-0.13 - model.position.y) * Math.min(1, dt * 12);
    } else {
      model.position.x += (0.22 - model.position.x) * Math.min(1, dt * 12);
      model.position.y += (-0.21 - model.position.y) * Math.min(1, dt * 12);
    }
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 26 : 0;
    if (charge.visible) {
      chargeLamp.material.color.setHex(Math.sin(performance.now() / 90) > 0 ? 0xff2a1a : 0x661008);
    }
    const def = WEAPONS[state.current];
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      const p = 1 - state.reloadLeft / def.reloadTime;
      const s = Math.sin(p * Math.PI);
      model.rotation.x = -0.55 * s;
      model.position.y -= 0.04 * s;
      const mag = model.userData.mag;
      if (mag) {
        mag.position.y = mag.userData.baseY - 0.13 * s;
        mag.rotation.x = mag.userData.baseRX + 0.35 * s;
      }
      if (state.reloadLeft === 0) {
        const slot = ammo[state.current];
        const need = def.mag - slot.mag;
        const take = Math.min(need, slot.reserve);
        slot.mag += take;
        slot.reserve -= take;
      }
    }
  }

  return {
    state, ammo,
    def() { return WEAPONS[state.current]; },
    step,
    showCharge(v) { charge.visible = v; },
    ready() {
      const slot = ammo[state.current];
      return slot.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = WEAPONS[state.current].rate;
      state.flash = 0.06;
      state.kick = 0.055;
    },
    takeRound() {
      const slot = ammo[state.current];
      if (slot.mag <= 0) return false;
      slot.mag -= 1;
      return true;
    },
    reload() {
      const def = WEAPONS[state.current];
      const slot = ammo[state.current];
      if (state.reloadLeft > 0 || slot.mag === def.mag || slot.reserve === 0 || def.reloadTime === 0) return false;
      state.reloadLeft = def.reloadTime;
      return true;
    },
    spread(speed) {
      const def = WEAPONS[state.current];
      const move = def.spreadStill + Math.min(1, speed / 5.2) * def.spreadMove;
      return state.aiming ? move * 0.55 : move;
    },
    switchTo(id) {
      if (!WEAPONS[id] || id === state.current) return false;
      if (WEAPONS[id].kind === 'grenade') {
        if (state.grenades[id] <= 0) return false;
      } else if (!state.owned.has(id)) return false;
      models[state.current].visible = false;
      state.current = id;
      state.reloadLeft = 0;
      state.cooldown = Math.max(state.cooldown, 0.25);
      models[id].visible = true;
      return true;
    },
    nextGrenade() {
      const owned = GRENADE_ORDER.filter((id) => state.grenades[id] > 0);
      if (owned.length === 0) return false;
      const cur = owned.indexOf(state.current);
      const next = owned[(cur + 1) % owned.length];
      return this.switchTo(next);
    },
    refill() {
      for (const id of WEAPON_ORDER) {
        ammo[id] = state.owned.has(id)
          ? { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }
          : { mag: 0, reserve: 0 };
      }
      for (const id of GRENADE_ORDER) ammo[id] = { mag: state.grenades[id], reserve: 0 };
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
    },
    resetLoadout() {
      state.owned = new Set(['pistol']);
      state.grenades = { he: 0, smoke: 0, flash: 0 };
      state.armor = 0;
      state.helmet = false;
      state.kit = false;
      this.refill();
      if (state.current !== 'pistol') {
        models[state.current].visible = false;
        state.current = 'pistol';
        models.pistol.visible = true;
      }
    },
    buy(id) {
      const def = WEAPONS[id];
      if (!def) return false;
      if (def.kind === 'grenade') {
        if (state.grenades[id] >= 2) return false;
        state.grenades[id] += 1;
        ammo[id].mag = state.grenades[id];
        ammo[id].reserve = 0;
        return true;
      }
      state.owned.add(id);
      ammo[id] = { mag: def.mag, reserve: def.reserve };
      return true;
    },
    buyArmor() {
      state.armor = ARMOR_MAX;
      return true;
    },
    buyHelmet() {
      state.helmet = true;
      return true;
    },
    buyKit() {
      state.kit = true;
      return true;
    },
    throwGrenade() {
      const id = state.current;
      if (WEAPONS[id].kind !== 'grenade' || state.grenades[id] <= 0) return false;
      state.grenades[id] -= 1;
      ammo[id].mag = state.grenades[id];
      state.cooldown = WEAPONS[id].rate;
      if (state.grenades[id] === 0) {
        const fallback = state.owned.has('rifle') ? 'rifle' : state.owned.has('smg') ? 'smg' : 'pistol';
        this.switchTo(fallback);
      }
      return true;
    },
  };
}
