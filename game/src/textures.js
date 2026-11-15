// Canvas textures: drawn once at load from the palette.
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

function wallTex(base, speckColors) {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 1500, speckColors, 0.4);
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
  });
}

function brickTex(base, mortar) {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, s, s);
    for (let r = 0; r < 16; r += 1) {
      const off = (r % 2) * 21;
      for (let c = -1; c < 7; c += 1) {
        ctx.fillStyle = base;
        ctx.globalAlpha = 0.8 + Math.random() * 0.2;
        ctx.fillRect(c * 42 + off + 1, r * 16 + 1, 40, 14);
      }
    }
    ctx.globalAlpha = 1;
    speckle(ctx, s, 700, ['#2e1a0c', '#9a6a3a'], 0.3);
  });
}

export function letterDecal(letter, color) {
  return canvas(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, 106, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 150px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, s / 2, s / 2 + 6);
    ctx.globalAlpha = 1;
  });
}

export function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#0a1c38');
  g.addColorStop(0.3, '#1b3358');
  g.addColorStop(0.48, '#5e3a5c');
  g.addColorStop(0.62, '#c65a1e');
  g.addColorStop(0.78, '#ff8a2a');
  g.addColorStop(1, '#ffc46b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 40; i += 1) {
    ctx.globalAlpha = 0.3 + Math.random() * 0.6;
    ctx.fillStyle = '#f2e8d5';
    ctx.fillRect(Math.random() * 512, Math.random() * 70, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  const sg = ctx.createRadialGradient(448, 95, 4, 448, 95, 55);
  sg.addColorStop(0, 'rgba(255,244,210,1)');
  sg.addColorStop(0.25, 'rgba(255,190,90,0.85)');
  sg.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(448, 95, 55, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function glowTexture() {
  return canvas(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,240,210,1)');
    g.addColorStop(0.4, 'rgba(255,180,80,0.45)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export function signTexture(text, sub, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1c130a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = color;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, sub ? 52 : 66);
  if (sub) {
    ctx.fillStyle = '#f2e8d5';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(sub, 256, 100);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowTexture() {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = '#171009';
    ctx.fillRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#ffd98a');
    g.addColorStop(1, '#ff9a3c');
    ctx.fillStyle = g;
    ctx.fillRect(14, 14, s - 28, s - 28);
    ctx.fillStyle = 'rgba(23,16,9,0.85)';
    ctx.fillRect(14, s / 2 - 6, s - 28, 12);
    ctx.fillRect(s / 2 - 6, 14, 12, s - 28);
    ctx.fillStyle = 'rgba(23,16,9,0.5)';
    ctx.fillRect(60, 60, 60, 30);
    ctx.fillRect(150, 150, 50, 40);
  });
}

export function pavingTexture() {
  return canvas(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(242,232,213,0.5)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, 118, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s / 2, s / 2, 78, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(s / 2 + Math.cos(a) * 78, s / 2 + Math.sin(a) * 78);
      ctx.lineTo(s / 2 + Math.cos(a) * 118, s / 2 + Math.sin(a) * 118);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,122,26,0.85)';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CINDER YARD', s / 2, s / 2 + 12);
  });
}

export function flagTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#1c130a';
  ctx.beginPath();
  ctx.moveTo(128, 22); ctx.lineTo(158, 78); ctx.lineTo(128, 64); ctx.lineTo(98, 78);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2e8d5';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EMBERLINE', 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function corrugated(base, hi, lo, streakColor, speckColors) {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = hi;
      ctx.fillRect(x, 0, 4, s);
      ctx.fillStyle = lo;
      ctx.fillRect(x + 8, 0, 4, s);
    }
    streaks(ctx, s, 22, streakColor, true);
    speckle(ctx, s, 650, speckColors, 0.35);
    ctx.fillStyle = 'rgba(23,16,9,0.35)';
    ctx.fillRect(0, 0, s, 8);
    ctx.fillRect(0, s - 8, s, 8);
  });
}

export const TEXTURES = {
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
  wall: wallTex('#4d3b26', ['#5d4a2e', '#3a2c1c', '#6b5638']),
  wallWarm: brickTex('#6e3a1e', '#3a2010'),
  wallCool: brickTex('#2e4a4a', '#16241f'),
  wallGrey: wallTex('#5a5a58', ['#6e6e6a', '#464644', '#82827e']),
  brick: brickTex('#7a3b1e', '#2e1a0c'),
  stripe: canvas(256, (ctx, s) => {
    ctx.fillStyle = '#6b5638';
    ctx.fillRect(0, 0, s, s);
    streaks(ctx, s, 30, '#4a3a22', false);
    speckle(ctx, s, 500, ['#7d6a44', '#54401f'], 0.4);
    for (const y0 of [0, s - 28]) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y0, s, 28); ctx.clip();
      for (let x = -28; x < s + 28; x += 28) {
        ctx.fillStyle = '#e8b820';
        ctx.beginPath();
        ctx.moveTo(x, y0 + 28); ctx.lineTo(x + 14, y0); ctx.lineTo(x + 28, y0); ctx.lineTo(x + 14, y0 + 28);
        ctx.fill();
      }
      ctx.restore();
    }
  }),
  sandbag: canvas(256, (ctx, s) => {
    ctx.fillStyle = '#7a6f4d';
    ctx.fillRect(0, 0, s, s);
    for (let row = 0; row < 4; row += 1) {
      const y = row * 64;
      const off = (row % 2) * 32;
      for (let col = -1; col < 5; col += 1) {
        const x = col * 64 + off;
        ctx.fillStyle = row % 2 ? '#857a56' : '#6e6445';
        ctx.beginPath();
        ctx.ellipse(x + 32, y + 32, 30, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,32,18,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    speckle(ctx, s, 700, ['#8f8358', '#5d5336'], 0.35);
  }),
  rust: corrugated('#b3541e', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.22)', '#6e2f0e', ['#8a3f14', '#d2691e']),
  teal: corrugated('#2e6f6a', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.25)', '#17403c', ['#3a7d76', '#245954']),
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
  glass: windowTexture(),
  steel: canvas(256, (ctx, s) => {
    ctx.fillStyle = '#33302c';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 500, ['#45413b', '#24211d'], 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, s, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let x = 16; x < s; x += 32) {
      ctx.beginPath(); ctx.arc(x, 20, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, s - 20, 3, 0, Math.PI * 2); ctx.fill();
    }
  }),
};
