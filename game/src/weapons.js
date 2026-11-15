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
const STEEL = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.45, metalness: 0.4 });
const EMBER = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.3 });
const GREY = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a8a8a'), roughness: 0.6, metalness: 0.2 });
const WHITE = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8e8e8'), roughness: 0.5, metalness: 0.1 });

function part(w, h, d, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

// One small view model per weapon, built from boxes. Only the held one is visible.
function buildModel(id) {
  const model = new THREE.Group();
  if (id === 'pistol') {
    model.add(part(0.06, 0.09, 0.24, 0, 0, -0.1, STEEL), part(0.05, 0.12, 0.07, 0, -0.08, 0.02, GRIP));
  } else if (id === 'smg') {
    model.add(part(0.08, 0.09, 0.4, 0, 0, -0.08, STEEL), part(0.04, 0.04, 0.3, 0, 0.02, -0.36, GRIP),
      part(0.06, 0.14, 0.06, 0, -0.1, 0.02, GRIP), part(0.05, 0.04, 0.1, 0, 0.05, -0.26, EMBER));
  } else if (id === 'rifle') {
    model.add(part(0.09, 0.1, 0.42, 0, 0, -0.05, STEEL), part(0.045, 0.045, 0.4, 0, 0.025, -0.42, GRIP),
      part(0.075, 0.08, 0.22, 0, -0.02, 0.26, GRIP), part(0.06, 0.12, 0.08, 0, -0.1, 0.05, GRIP),
      part(0.03, 0.05, 0.06, 0, 0.07, -0.2, EMBER));
  } else if (id === 'sniper') {
    model.add(part(0.07, 0.09, 0.62, 0, 0, -0.12, STEEL), part(0.04, 0.04, 0.55, 0, 0.02, -0.55, GRIP),
      part(0.05, 0.06, 0.16, 0, 0.07, -0.2, EMBER), part(0.06, 0.08, 0.2, 0, -0.02, 0.28, GRIP));
  } else if (id === 'shotty') {
    model.add(part(0.1, 0.11, 0.5, 0, 0, -0.08, STEEL), part(0.05, 0.05, 0.42, 0, -0.05, -0.3, GRIP),
      part(0.06, 0.12, 0.08, 0, -0.1, 0.05, GRIP), part(0.08, 0.08, 0.12, 0, 0.02, -0.42, EMBER));
  } else {
    // Grenade canisters: HE orange, smoke grey, flash white.
    const mat = id === 'he' ? EMBER : id === 'smoke' ? GREY : WHITE;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12), mat);
    body.rotation.x = Math.PI / 2;
    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 16), STEEL);
    pin.position.set(0.05, 0.06, 0);
    model.add(body, pin);
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
    new THREE.PlaneGeometry(0.4, 0.4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
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
    model.position.z = -0.48 + state.kick;
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
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    const def = WEAPONS[state.current];
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def.reloadTime - state.reloadLeft) * 2);
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
