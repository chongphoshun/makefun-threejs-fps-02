// The armoury: five guns, three grenades, vest and helmet. Numbers are the balance: a
// rifle wins a duel, a sniper wins a lane, a shotgun wins a doorway, a pistol is what
// you have when you are broke. damage is per body hit; headMult multiplies it on a
// head shot; pellets fires that many rays per trigger pull.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: { name: 'P9 Sidearm', kind: 'pistol', price: 0, damage: 26, headMult: 3, rate: 0.16, auto: false, mag: 12, reserve: 48, spreadStill: 0.004, spreadMove: 0.02, reloadTime: 1.4, tracer: 0xffe1a0, pellets: 1 },
  smg: { name: 'VK-9 Rasp', kind: 'smg', price: 1500, damage: 22, headMult: 3, rate: 0.083, auto: true, mag: 28, reserve: 84, spreadStill: 0.006, spreadMove: 0.03, reloadTime: 1.8, tracer: 0xffc46b, pellets: 1 },
  rifle: { name: 'AR-77 Ember', kind: 'rifle', price: 2700, damage: 33, headMult: 4, rate: 0.1, auto: true, mag: 30, reserve: 90, spreadStill: 0.003, spreadMove: 0.024, reloadTime: 2.0, tracer: 0xffb36b, pellets: 1 },
  sniper: { name: 'LR-88 Longbow', kind: 'sniper', price: 4750, damage: 95, headMult: 4, rate: 1.15, auto: false, mag: 5, reserve: 15, spreadStill: 0.0008, spreadMove: 0.03, reloadTime: 2.8, tracer: 0xfff2cc, pellets: 1 },
  shotty: { name: 'Moss-12 Breacher', kind: 'shotgun', price: 1700, damage: 14, headMult: 2, rate: 0.9, auto: false, mag: 6, reserve: 24, spreadStill: 0.03, spreadMove: 0.05, reloadTime: 2.6, tracer: 0xffd9a0, pellets: 8 },
  he: { name: 'SPARK-4 HE', kind: 'grenade', price: 300, damage: 120, headMult: 1, rate: 0.9, auto: false, mag: 1, reserve: 0, spreadStill: 0, spreadMove: 0, reloadTime: 0, tracer: 0xff7a1a, pellets: 1 },
  smoke: { name: 'GHOST-2 Smoke', kind: 'grenade', price: 400, damage: 0, headMult: 1, rate: 0.9, auto: false, mag: 1, reserve: 0, spreadStill: 0, spreadMove: 0, reloadTime: 0, tracer: 0xcccccc, pellets: 1 },
  flash: { name: 'DAZZLE-1 Flash', kind: 'grenade', price: 250, damage: 0, headMult: 1, rate: 0.9, auto: false, mag: 1, reserve: 0, spreadStill: 0, spreadMove: 0, reloadTime: 0, tracer: 0xffffff, pellets: 1 },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'rifle', 'sniper', 'shotty', 'he', 'smoke', 'flash'];
export const GRENADE_ORDER = ['he', 'smoke', 'flash'];
export const ARMOR_PRICE = 650;
export const HELMET_PRICE = 350;
export const ARMOR_MAX = 100;

const GRIP = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.surface), roughness: 0.7, metalness: 0.2 });
const STEEL = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.gunmetal), roughness: 0.45, metalness: 0.5 });
const EMBER = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.3 });
const GREY = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a8a8a'), roughness: 0.6, metalness: 0.2 });
const WHITE = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8e8e8'), roughness: 0.5, metalness: 0.1 });
const TAN = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a6f4d'), roughness: 0.6, metalness: 0.2 });
const POLY = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e1c1a'), roughness: 0.85, metalness: 0.05 });
const GLOVE = new THREE.MeshStandardMaterial({ color: new THREE.Color('#241a12'), roughness: 0.95, metalness: 0 });

// Muzzle-flash sprite: a radial glow with four spikes, drawn once on a canvas.
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

// Gloved hands holding the gun: one on the grip, one on the handguard or pump.
// They are children of the model, so reload and ADS motion carries them along.
function hands(model, gx, gy, gz, sx, sy, sz) {
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.09), GLOVE);
  grip.position.set(gx, gy, gz);
  grip.rotation.x = 0.25;
  const support = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.12), GLOVE);
  support.position.set(sx, sy, sz);
  support.rotation.x = -0.15;
  model.add(grip, support);
}

// One view model per weapon, built from 10+ primitives: receiver, barrel, shroud,
// handguard, magazine, stock, optic, grip, muzzle, rail. Two-tone gunmetal + tan /
// polymer + an ember accent, so the gun reads as a built object, not a grey box.
// The magazine mesh is kept on userData.mag: the reload animation drops it out.
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
  } else if (id === 'smg') {
    model.add(
      part(0.08, 0.09, 0.34, 0, 0, -0.06, STEEL), part(0.035, 0.035, 0.18, 0, 0.01, -0.32, GREY),
      part(0.07, 0.07, 0.2, 0, 0.01, -0.28, POLY), part(0.06, 0.05, 0.14, 0, -0.01, -0.2, TAN),
      part(0.06, 0.07, 0.16, 0, -0.01, 0.2, POLY), part(0.05, 0.12, 0.07, 0, -0.09, 0.06, POLY, 0.25),
      part(0.04, 0.04, 0.1, 0, 0.07, -0.1, EMBER), part(0.05, 0.1, 0.05, 0, -0.08, -0.2, POLY),
      part(0.045, 0.045, 0.06, 0, 0.01, -0.42, GREY), part(0.07, 0.015, 0.3, 0, 0.055, -0.08, GREY),
    );
    mag = part(0.05, 0.16, 0.06, 0, -0.12, 0, POLY);
    model.add(mag);
    hands(model, 0, -0.09, 0.06, 0, -0.07, -0.2);
  } else if (id === 'rifle') {
    model.add(
      part(0.09, 0.1, 0.4, 0, 0, -0.04, STEEL), part(0.04, 0.04, 0.24, 0, 0.02, -0.36, GREY),
      part(0.08, 0.08, 0.3, 0, 0.01, -0.3, TAN), part(0.07, 0.09, 0.2, 0, -0.01, 0.24, POLY),
      part(0.05, 0.12, 0.07, 0, -0.1, 0.06, POLY, 0.25), part(0.05, 0.05, 0.14, 0, 0.075, -0.12, EMBER),
      part(0.012, 0.04, 0.012, 0, 0.06, -0.44, EMBER), part(0.05, 0.05, 0.08, 0, 0.02, -0.5, GREY),
      part(0.08, 0.015, 0.34, 0, 0.06, -0.06, GREY), part(0.05, 0.09, 0.05, 0, -0.07, -0.28, POLY),
      part(0.1, 0.02, 0.03, 0, 0.03, 0.14, GREY),
    );
    mag = part(0.06, 0.14, 0.08, 0, -0.11, 0.02, POLY, 0.15);
    model.add(mag);
    hands(model, 0, -0.1, 0.06, 0, -0.06, -0.28);
  } else if (id === 'sniper') {
    model.add(
      part(0.07, 0.09, 0.5, 0, 0, -0.1, STEEL), part(0.035, 0.035, 0.5, 0, 0.015, -0.55, GREY),
      part(0.05, 0.05, 0.2, 0, 0.09, -0.12, EMBER), part(0.04, 0.03, 0.12, 0, 0.055, -0.12, GREY),
      part(0.055, 0.055, 0.02, 0, 0.09, -0.23, POLY), part(0.02, 0.02, 0.1, 0.06, 0.02, -0.02, GREY),
      part(0.06, 0.08, 0.24, 0, -0.01, 0.26, TAN), part(0.06, 0.03, 0.16, 0, 0.06, 0.2, POLY),
      part(0.05, 0.11, 0.07, 0, -0.09, 0.06, POLY, 0.25), part(0.04, 0.04, 0.07, 0, 0.015, -0.82, GREY),
      part(0.065, 0.1, 0.03, 0, -0.01, 0.39, GLOVE),
    );
    mag = part(0.05, 0.1, 0.07, 0, -0.1, 0, POLY);
    model.add(mag);
    hands(model, 0, -0.09, 0.06, 0, -0.05, -0.35);
  } else if (id === 'shotty') {
    model.add(
      part(0.1, 0.11, 0.42, 0, 0, -0.06, STEEL), part(0.045, 0.045, 0.34, 0, 0.02, -0.4, GREY),
      part(0.04, 0.04, 0.3, 0, -0.05, -0.38, GREY), part(0.05, 0.05, 0.03, 0, -0.05, -0.54, EMBER),
      part(0.08, 0.1, 0.2, 0, -0.01, 0.24, POLY), part(0.05, 0.12, 0.07, 0, -0.1, 0.06, POLY, 0.25),
      part(0.012, 0.03, 0.012, 0, 0.06, -0.52, EMBER), part(0.09, 0.03, 0.2, 0, 0.055, -0.36, GREY),
      part(0.1, 0.02, 0.1, 0, 0.06, -0.05, TAN),
    );
    // Pump-action: the pump is the moving part of the reload, not a magazine.
    mag = part(0.08, 0.09, 0.16, 0, -0.02, -0.32, TAN);
    model.add(mag);
    hands(model, 0, -0.1, 0.06, 0, -0.06, -0.32);
  } else {
    // Grenade canisters: HE orange, smoke grey, flash white, plus lever and band.
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

  const ammo = {};
  for (const id of WEAPON_ORDER) ammo[id] = { mag: 0, reserve: 0 };
  ammo.pistol = { mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve };
  const state = {
    current: 'pistol', cooldown: 0, reloadLeft: 0, flash: 0, kick: 0,
    grenades: { he: 0, smoke: 0, flash: 0 }, armor: 0, helmet: false,
    aiming: false, owned: new Set(['pistol']),
  };
  models.pistol.visible = true;

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[state.current];
    // ADS pulls the gun a touch closer to the eye as well as to the centre.
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
    const def = WEAPONS[state.current];
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      // Reload animation: the gun tilts out and dips, the magazine drops out and
      // slides back in (the shotgun's pump racks instead). Sine curve, out and back.
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
    // Cycle to the next owned grenade type (G key).
    nextGrenade() {
      const owned = GRENADE_ORDER.filter((id) => state.grenades[id] > 0);
      if (owned.length === 0) return false;
      const cur = owned.indexOf(state.current);
      const next = owned[(cur + 1) % owned.length];
      return this.switchTo(next);
    },
    refill() {
      // A new round refills every magazine you own. Grenades, armour and helmet carry
      // over; only death takes them away (see resetLoadout).
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
    // Death loses everything but the sidearm.
    resetLoadout() {
      state.owned = new Set(['pistol']);
      state.grenades = { he: 0, smoke: 0, flash: 0 };
      state.armor = 0;
      state.helmet = false;
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
