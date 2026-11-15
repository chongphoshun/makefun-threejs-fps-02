// EMBERLINE — the look plan, in one place. Dusk in a freight yard: warm amber sun against
export const PALETTE = {
  canvas: '#171009', // sky / fog
  surface: '#2e2113', // ground, dark panels
  wall: '#4d3b26', // concrete walls
  crate: '#5d4a2e', // wooden crates
  rust: '#b3541e', // rust-red containers
  teal: '#2e6f6a', // teal steel containers
  ink: '#f2e8d5', // warm off-white
  muted: '#a89a80', // dim warm grey
  accent: '#ff7a1a', // ember orange (attackers, crosshair, highlights)
  ash: '#5aa9e6', // cold blue (defenders)
  good: '#7dd069', // healthy / win
  danger: '#ff4d3d', // damage / lose
  concrete: '#777770', // mid grey concrete (mid lane)
  sand: '#8a7a4a', // sandbags
  hazard: '#e8b820', // hazard stripes
  zoneB: '#2e8f86', // B site bright teal
  gunmetal: '#4b5158', // lighter weapon metal (was #23262b, read near-black)
};

export function shade(name) {
  return PALETTE[name];
}
