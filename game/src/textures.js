// Canvas-generated textures: the yard is no longer flat colour. Every texture is drawn
// once at load from the palette — concrete, corrugated steel, wood — and repeated across
// the boxes that use it. Visual only; nothing here touches the simulation.
import * as THREE from 'three';

function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx, size, n, colors, alpha) {
  for (let i = 0; i < n; i += 1) {
    ctx.globalAlpha = alpha * (0.4 + Math.random() * 0.6);
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  ctx.globalAlpha = 1;
}

function streaks(ctx, size, n, color, vertical) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 20 + Math.random() * 90;
    ctx.globalAlpha = 0.08 + Math.random() * 0.14;
    if (vertical) ctx.fillRect(x, y, 2 + Math.random() * 3, len);
    else ctx.fillRect(x, y, len, 2 + Math.random() * 3);
  }
  ctx.globalAlpha = 1;
}

export const TEXTURES = {
  // Asphalt floor: near-black brown, speckle noise, a few darker patches.
  floor: canvas(256, (ctx, s) => {
    ctx.fillStyle = '#241a10';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 2600, ['#2e2113', '#1a120a', '#3a2c1c'], 0.5);
    streaks(ctx, s, 14, '#171009', false);
    ctx.strokeStyle = 'rgba(242,232,213,0.05)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, Math.random() * s);
      ctx.lineTo(Math.random() * s, Math.random() * s);
      ctx.stroke();
    }
  }),
  // Concrete wall: warm panels with seams and grime at the base.
  wall: canvas(256, (ctx, s) => {
    ctx.fillStyle = '#4d3b26';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 1500, ['#5d4a2e', '#3a2c1c', '#6b5638'], 0.4);
    ctx.strokeStyle = 'rgba(23,16,9,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(s, i * 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, s); ctx.stroke();
    }
    const grad = ctx.createLinearGradient(0, s * 0.7, 0, s);
    grad.addColorStop(0, 'rgba(23,16,9,0)');
    grad.addColorStop(1, 'rgba(23,16,9,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  }),
  // Rust container: corrugated vertical ribs with rust drips.
  rust: canvas(256, (ctx, s) => {
    ctx.fillStyle = '#b3541e';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, 0, 4, s);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 8, 0, 4, s);
    }
    streaks(ctx, s, 26, '#6e2f0e', true);
    speckle(ctx, s, 700, ['#8a3f14', '#d2691e'], 0.35);
    ctx.fillStyle = 'rgba(23,16,9,0.35)';
    ctx.fillRect(0, 0, s, 8);
    ctx.fillRect(0, s - 8, s, 8);
  }),
  // Teal container: same corrugation, cold steel blue-green.
  teal: canvas(256, (ctx, s) => {
    ctx.fillStyle = '#2e6f6a';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, 0, 4, s);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 8, 0, 4, s);
    }
    streaks(ctx, s, 18, '#17403c', true);
    speckle(ctx, s, 600, ['#3a7d76', '#245954'], 0.35);
    ctx.fillStyle = 'rgba(23,16,9,0.35)';
    ctx.fillRect(0, 0, s, 8);
    ctx.fillRect(0, s - 8, s, 8);
  }),
  // Wooden crate: planks with grain and nail dots.
  crate: canvas(256, (ctx, s) => {
    ctx.fillStyle = '#5d4a2e';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y, s, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, y + 2, s, 2);
    }
    streaks(ctx, s, 40, '#3a2c1c', false);
    speckle(ctx, s, 500, ['#6b5638', '#4a3a22'], 0.4);
    ctx.fillStyle = 'rgba(23,16,9,0.6)';
    for (const [x, y] of [[8, 8], [248, 8], [8, 248], [248, 248]]) {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }),
};
