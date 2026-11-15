// The DOM HUD: crosshair, hit marker, health, ammo, money, timer, score, alive pips,
// kill feed, a live minimap, the buy menu and the overlays. It never touches the
// simulation; main.js pushes numbers in and reads the play/buy callbacks out.
import { WEAPONS, WEAPON_ORDER, ARMOR_PRICE } from './weapons.js';
import { PALETTE } from './palette.js';

const COPY = {
  start: {
    title: 'EMBERLINE',
    copy: 'Cinder Yard — plant the charge at Warehouse or Depot, or drop every Ash defender. Click to play.',
    action: 'Click to play',
  },
  paused: { title: 'EMBERLINE', copy: 'Paused. Click to resume.', action: 'Click to resume' },
  dead: { title: 'You are down', copy: 'Your team fights on. Watch the round play out.', action: '' },
};

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const overlayTitle = $('overlay-title');
  const overlayCopy = $('overlay-copy');
  const playBtn = $('play');
  const crosshair = $('crosshair');
  const hitmarker = $('hitmarker');
  const healthFill = $('health-fill');
  const healthNum = $('health-num');
  const armorFill = $('armor-fill');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const moneyValue = $('money-value');
  const timerValue = $('timer-value');
  const scoreEmber = $('score-ember');
  const scoreAsh = $('score-ash');
  const roundLabel = $('round-label');
  const pipsEmber = $('pips-ember');
  const pipsAsh = $('pips-ash');
  const feed = $('killfeed');
  const banner = $('banner');
  const bannerTitle = $('banner-title');
  const bannerSub = $('banner-sub');
  const vignette = $('vignette');
  const bombBox = $('bomb-box');
  const bombText = $('bomb-text');
  const bombBar = $('bomb-bar');
  const plantBox = $('plant-box');
  const plantBar = $('plant-bar');
  const promptEl = $('prompt');
  const buyMenu = $('buy-menu');
  const buyMoney = $('buy-money');
  const minimap = $('minimap');
  const mapCtx = minimap.getContext('2d');

  let hitTimer = 0;
  let bannerTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastWeapon = '';
  let lastHealth = -1;
  let lastArmor = -1;
  let lastMoney = -1;
  let lastTimer = -1;
  let lastScore = '';
  let lastPips = '';

  function buildBuyMenu(onBuy) {
    const grid = $('buy-grid');
    for (const id of WEAPON_ORDER) {
      const def = WEAPONS[id];
      const btn = document.createElement('button');
      btn.className = 'buy-item';
      btn.dataset.item = id;
      btn.innerHTML = `<span class="buy-key">${WEAPON_ORDER.indexOf(id) + 1}</span><span class="buy-name">${def.name}</span><span class="buy-price">$${def.price}</span><span class="buy-desc">${def.kind === 'grenade' ? 'HE blast, 6 m radius' : `${def.damage} dmg · ${def.mag} rounds`}</span>`;
      btn.addEventListener('click', () => onBuy(id));
      grid.appendChild(btn);
    }
    const armor = document.createElement('button');
    armor.className = 'buy-item';
    armor.dataset.item = 'armor';
    armor.innerHTML = `<span class="buy-key">6</span><span class="buy-name">Vest Armour</span><span class="buy-price">$${ARMOR_PRICE}</span><span class="buy-desc">Absorbs half of all damage</span>`;
    armor.addEventListener('click', () => onBuy('armor'));
    grid.appendChild(armor);
  }

  function setPips(el, alive, total, team) {
    let html = '';
    for (let i = 0; i < total; i += 1) {
      html += `<i class="${i < alive ? `on ${team}` : 'off'}"></i>`;
    }
    el.innerHTML = html;
  }

  return {
    buildBuyMenu,
    setHealth(hp, armor) {
      if (hp === lastHealth && armor === lastArmor) return;
      lastHealth = hp;
      lastArmor = armor;
      healthFill.style.width = `${Math.max(0, hp)}%`;
      healthNum.textContent = String(Math.max(0, Math.ceil(hp)));
      armorFill.style.width = `${Math.max(0, armor)}%`;
      healthFill.classList.toggle('low', hp <= 30);
    },
    setAmmo(mag, reserve, name) {
      if (mag === lastMag && reserve === lastReserve && name === lastWeapon) return;
      lastMag = mag;
      lastReserve = reserve;
      lastWeapon = name;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      weaponName.textContent = name;
      $('ammo').classList.toggle('empty', mag === 0);
    },
    setMoney(value) {
      if (value === lastMoney) return;
      lastMoney = value;
      moneyValue.textContent = `$${value}`;
      buyMoney.textContent = `$${value}`;
    },
    setTimer(seconds) {
      const shown = Math.max(0, Math.ceil(seconds));
      if (shown === lastTimer) return;
      lastTimer = shown;
      const m = Math.floor(shown / 60);
      const s = shown % 60;
      timerValue.textContent = `${m}:${String(s).padStart(2, '0')}`;
      timerValue.classList.toggle('urgent', shown <= 10);
    },
    setScore(ember, ash, round) {
      const key = `${ember}-${ash}-${round}`;
      if (key === lastScore) return;
      lastScore = key;
      scoreEmber.textContent = String(ember);
      scoreAsh.textContent = String(ash);
      roundLabel.textContent = `ROUND ${round} · FIRST TO 6`;
    },
    setAlive(emberAlive, ashAlive) {
      const key = `${emberAlive}-${ashAlive}`;
      if (key === lastPips) return;
      lastPips = key;
      setPips(pipsEmber, emberAlive, 5, 'ember');
      setPips(pipsAsh, ashAlive, 5, 'ash');
    },
    killfeed(killer, victim, headshot, killerTeam) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      row.innerHTML = `<span class="${killerTeam}">${killer}</span><span class="feed-mid">${headshot ? '◉' : '✕'}</span><span>${victim}</span>`;
      feed.prepend(row);
      while (feed.children.length > 5) feed.removeChild(feed.lastChild);
      setTimeout(() => row.classList.add('fade'), 4200);
      setTimeout(() => row.remove(), 5000);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    setSpread(px) {
      crosshair.style.setProperty('--gap', `${Math.round(px)}px`);
    },
    damageFlash() {
      vignette.classList.remove('flash');
      void vignette.offsetWidth;
      vignette.classList.add('flash');
    },
    banner(title, sub, ms = 2600) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub;
      banner.classList.add('show');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('show'), ms);
    },
    setBomb(text, frac) {
      if (!text) { bombBox.hidden = true; return; }
      bombBox.hidden = false;
      bombText.textContent = text;
      bombBar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
      bombBar.classList.toggle('urgent', frac < 0.25);
    },
    setPlant(frac) {
      if (frac === null) { plantBox.hidden = true; return; }
      plantBox.hidden = false;
      plantBar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    },
    prompt(text) {
      if (!text) { promptEl.hidden = true; return; }
      promptEl.hidden = false;
      promptEl.textContent = text;
    },
    showBuy(money) {
      this.setMoney(money);
      buyMenu.hidden = false;
    },
    hideBuy() {
      buyMenu.hidden = true;
    },
    buyAfford(item, money) {
      const price = item === 'armor' ? ARMOR_PRICE : WEAPONS[item].price;
      const btn = buyMenu.querySelector(`[data-item="${item}"]`);
      if (btn) btn.classList.toggle('cant', money < price);
    },
    showOverlay(mode, score) {
      const text = COPY[mode];
      overlayTitle.textContent = text.title;
      overlayCopy.textContent = mode === 'dead' ? text.copy : text.copy;
      playBtn.textContent = text.action;
      playBtn.style.display = text.action ? '' : 'none';
      overlay.hidden = false;
    },
    setEndOverlay(title, copy, action) {
      overlayTitle.textContent = title;
      overlayCopy.textContent = copy;
      playBtn.textContent = action;
      playBtn.style.display = '';
      overlay.hidden = false;
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      playBtn.addEventListener('click', handler);
    },
    drawMinimap(player, bots, plantedSite, now) {
      const ctx = mapCtx;
      const W = minimap.width;
      const H = minimap.height;
      const sx = W / 46;
      const sz = H / 38;
      const px = (x) => (x + 23) * sx;
      const pz = (z) => (z + 19) * sz;
      ctx.fillStyle = '#141009';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#3a2c1c';
      for (const f of world.footprints) {
        if (f.w * f.d < 0.5) continue;
        ctx.fillRect(px(f.x - f.w / 2), pz(f.z - f.d / 2), f.w * sx, f.d * sz);
      }
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Site letters from the world's site table (passed through the world object).
      const sites = world.sites;
      for (const key of Object.keys(sites)) {
        const site = sites[key];
        ctx.fillStyle = key === 'A' ? PALETTE.accent : PALETTE.ash;
        ctx.globalAlpha = plantedSite === key ? 1 : 0.75;
        ctx.fillText(key, px(site.center.x), pz(site.center.z));
        ctx.globalAlpha = 1;
      }
      const dot = (x, z, color, r = 3) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px(x), pz(z), r, 0, Math.PI * 2);
        ctx.fill();
      };
      for (const bot of bots.list) {
        if (!bot.alive) continue;
        if (bot.team === 'ember') dot(bot.mover.state.position.x, bot.mover.state.position.z, PALETTE.accent, 2.5);
        else if (now - bots.spottedAt(bot.id) < 3) dot(bot.mover.state.position.x, bot.mover.state.position.z, '#ff4d3d', 3);
      }
      if (plantedSite) {
        const site = sites[plantedSite];
        ctx.fillStyle = '#ff4d3d';
        ctx.beginPath();
        ctx.arc(px(site.center.x), pz(site.center.z), 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Player arrow.
      const p = player.pos;
      ctx.save();
      ctx.translate(px(p.x), pz(p.z));
      ctx.rotate(-player.yaw);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };
}
