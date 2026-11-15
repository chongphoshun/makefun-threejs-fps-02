// Sound: the noise registry and bot hearing. Every gunshot and footstep lands here
export function createHearing() {
  const noises = [];

  function addNoise(x, z, time, radius = 28, kind = 'shot', team = 'none') {
    noises.push({ x, z, time, radius, kind, team });
    if (noises.length > 40) noises.shift();
  }

  function heard(bot, pos, now) {
    for (const noise of noises) {
      if (now - noise.time > 1.2 || now - bot.hearAt < 4) continue;
      if (noise.kind === 'step' && noise.team === bot.team) continue;
      const dx = noise.x - pos.x;
      const dz = noise.z - pos.z;
      if (dx * dx + dz * dz < noise.radius * noise.radius) return noise;
    }
    return null;
  }

  return { noises, addNoise, heard };
}
