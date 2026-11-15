// The DOM HUD: crosshair, hit marker, health, ammo, money, timer, score, alive pips,
import { WEAPONS, ARMOR_PRICE, HELMET_PRICE, KIT_PRICE } from './weapons.js';
import { PALETTE } from './palette.js';

const COPY = {
  start: {
    title: 'EMBERLINE',
    copy: 'Cinder Yard — plant the charge at Kiln Hall or Clay Pits, or drop every Ash defender. Click to play.',
    action: 'Click to play',
  },
  paused: { title: 'EMBERLINE', copy: 'Paused. Click to resume.', action: 'Click to resume' },
  dead: { title: 'You are down', copy: 'Your team fights on. Watch the round play out.', action: '' },
};

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const [overlay, overlayTitle, overlayCopy, playBtn, crosshair, hitmarker, healthFill, healthNum, armorFill, ammoMag, ammoReserve, weaponName, moneyValue, timerValue, scoreEmber, scoreAsh, roundLabel, pipsEmber, pipsAsh, feed, banner, bannerTitle, bannerSub, vignette, bombBox, bombText, bombBar, plantBox, plantBar, promptEl, buyMenu, buyMoney, radioEl, flashOverlay, scoreboard, scoreTitle, scoreSub, scoreTable, scoreLog, minimap, gradeEl, mvpEl] = ['overlay', 'overlay-title', 'overlay-copy', 'play', 'crosshair', 'hitmarker', 'health-fill', 'health-num', 'armor-fill', 'ammo-mag', 'ammo-reserve', 'weapon-name', 'money-value', 'timer-value', 'score-ember', 'score-ash', 'round-label', 'pips-ember', 'pips-ash', 'killfeed', 'banner', 'banner-title', 'banner-sub', 'vignette', 'bomb-box', 'bomb-text', 'bomb-bar', 'plant-box', 'plant-bar', 'prompt', 'buy-menu', 'buy-money', 'radio', 'flash-overlay', 'scoreboard', 'score-title', 'score-sub', 'score-table', 'score-log', 'minimap', 'grade', 'score-mvp'].map($);
  const mapCtx = minimap.getContext('2d');

  let hitTimer = 0;
  let bannerTimer = 0;
  let lastGrade = '';
  let lastMag = -1;
  let lastReserve = -1;
  let lastWeapon = '';
  let lastHealth = -1;
  let lastArmor = -1;
  let lastMoney = -1;
  let lastTimer = -1;
  let lastScore = '';
  let lastPips = '';

  function buyDesc(id) {
    const def = WEAPONS[id];
    if (!def) return '';
    if (id === 'he') return 'HE blast, 6 m radius';
    if (id === 'smoke') return 'Smoke screen, 14 s — blocks sight';
    if (id === 'flash') return 'Blinds anyone looking, 2 s';
    if (def.kind === 'shotgun') return `${def.damage} dmg × ${def.pellets} pellets · ${def.mag} rounds`;
    return `${def.damage} dmg · ${def.mag} rounds`;
  }

  const SHOP_CATS = [
    ['PISTOLS', ['pistol']],
    ['RIFLES', ['smg', 'rifle', 'sniper', 'shotty']],
    ['GEAR', ['armor', 'helmet', 'kit']],
    ['UTILITY', ['he', 'smoke', 'flash']],
  ];
  const SHOP_KEYS = { pistol: '1', smg: '2', rifle: '3', sniper: '4', shotty: '5', he: '6', smoke: '7', flash: '8', armor: '9', helmet: '0', kit: '' };

  function buildBuyMenu(onBuy) {
    const grid = $('buy-grid');
    for (const [cat, ids] of SHOP_CATS) {
      const head = document.createElement('div');
      head.className = 'buy-cat';
      head.textContent = `ARMOURY · ${cat}`;
      grid.appendChild(head);
      for (const id of ids) {
        const isArmor = id === 'armor';
        const isHelmet = id === 'helmet';
        const isKit = id === 'kit';
        const name = isArmor ? 'Vest Armour' : isHelmet ? 'Combat Helmet' : isKit ? 'Defuse Kit' : WEAPONS[id].name;
        const price = isArmor ? ARMOR_PRICE : isHelmet ? HELMET_PRICE : isKit ? KIT_PRICE : WEAPONS[id].price;
        const desc = isArmor ? 'Absorbs half of all damage' : isHelmet ? 'Halves headshot damage' : isKit ? 'Defuse twice as fast' : buyDesc(id);
        const btn = document.createElement('button');
        btn.className = 'buy-item';
        btn.dataset.item = id;
        btn.innerHTML = `<span class="buy-key">${SHOP_KEYS[id]}</span><span class="buy-name">${name}</span><span class="buy-price">$${price}</span><span class="buy-desc">${desc}</span>`;
        btn.addEventListener('click', () => onBuy(id));
        grid.appendChild(btn);
      }
    }
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
      roundLabel.textContent = round > 24 ? `ROUND ${round} · OVERTIME` : `ROUND ${round} OF 24`;
    },
    setAlive(emberAlive, ashAlive) {
      const key = `${emberAlive}-${ashAlive}`;
      if (key === lastPips) return;
      lastPips = key;
      setPips(pipsEmber, emberAlive, 5, 'ember');
      setPips(pipsAsh, ashAlive, 5, 'ash');
    },
    killfeed(killer, victim, headshot, killerTeam, weapon = '', sticky = false) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      row.innerHTML = `<span class="${killerTeam}">${killer}</span>${weapon ? `<span class="feed-weapon">${weapon}</span>` : ''}<span class="feed-mid">${headshot ? '◉' : '✕'}</span><span>${victim}</span>`;
      feed.prepend(row);
      while (feed.children.length > 5) feed.removeChild(feed.lastChild);
      if (sticky) return;
      setTimeout(() => row.classList.add('fade'), 4200);
      setTimeout(() => row.remove(), 5000);
    },
    radio(name, text, team = 'ember', sticky = false) {
      const row = document.createElement('div');
      row.className = 'radio-row';
      row.innerHTML = `<b class="${team === 'ash' ? 'ash' : ''}">${name}</b> — ${text}`;
      radioEl.prepend(row);
      while (radioEl.children.length > 4) radioEl.removeChild(radioEl.lastChild);
      if (sticky) return;
      setTimeout(() => row.classList.add('fade'), 5200);
      setTimeout(() => row.remove(), 6000);
    },
    flashBlind(strength) {
      flashOverlay.style.transition = 'none';
      flashOverlay.style.opacity = String(Math.max(0, Math.min(1, strength)));
      void flashOverlay.offsetWidth;
      flashOverlay.style.transition = 'opacity 1.1s ease-out';
      flashOverlay.style.opacity = '0';
    },
    showScoreboard(data) {
      scoreTitle.textContent = data.title;
      scoreSub.textContent = data.sub;
      let mvp = null;
      for (const row of data.rows) {
        if (!mvp || row.k > mvp.k || (row.k === mvp.k && (row.hs > mvp.hs || (row.hs === mvp.hs && row.dmg > mvp.dmg)))) mvp = row;
      }
      let html = '<tr><th>PLAYER</th><th>TEAM</th><th class="num">K</th><th class="num">A</th><th class="num">D</th><th class="num">HS%</th><th class="num">DMG</th><th class="num">CASH</th></tr>';
      for (const row of data.rows) {
        const star = row === mvp ? '★ ' : '';
        const cls = row === mvp ? ' class="mvp-row"' : '';
        const hsPct = row.k > 0 ? `${Math.round((row.hs / row.k) * 100)}%` : '—';
        html += `<tr${cls}><td>${star}${row.name}</td><td>${row.team}</td><td class="num">${row.k}</td><td class="num">${row.a}</td><td class="num">${row.d}</td><td class="num">${hsPct}</td><td class="num">${row.dmg}</td><td class="num">$${row.cash}</td></tr>`;
      }
      scoreTable.innerHTML = html;
      scoreLog.innerHTML = data.log.map((line) => `<div>${line}</div>`).join('');
      mvpEl.textContent = mvp ? `★ MVP — ${mvp.name} · ${mvp.k} kills · ${mvp.hs} headshots` : '';
      scoreboard.hidden = false;
    },
    setGrade(zone) {
      if (zone === lastGrade) return;
      lastGrade = zone;
      gradeEl.style.background = zone === 'A' ? 'rgba(255,122,26,0.10)'
        : zone === 'B' ? 'rgba(46,143,134,0.12)'
        : zone === 'spawn' ? 'rgba(255,122,26,0.06)' : 'rgba(120,120,120,0.05)';
    },
    hideScoreboard() {
      scoreboard.hidden = true;
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
      promptEl.innerHTML = text;
    },
    showBuy(money) {
      this.setMoney(money);
      buyMenu.hidden = false;
    },
    hideBuy() {
      buyMenu.hidden = true;
    },
    buyAfford(item, money, owned = false) {
      const price = item === 'armor' ? ARMOR_PRICE : item === 'helmet' ? HELMET_PRICE : item === 'kit' ? KIT_PRICE : WEAPONS[item].price;
      const btn = buyMenu.querySelector(`[data-item="${item}"]`);
      if (!btn) return;
      btn.classList.toggle('cant', money < price && !owned);
      btn.classList.toggle('owned', owned);
      const priceEl = btn.querySelector('.buy-price');
      if (priceEl) priceEl.textContent = owned ? 'OWNED' : `$${price}`;
    },
    showOverlay(mode) {
      const text = COPY[mode];
      overlayTitle.textContent = text.title;
      overlayCopy.textContent = text.copy;
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
