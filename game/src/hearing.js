// Sound: the noise registry and bot hearing. Every gunshot and footstep lands here
// with a position, a time, a hearing radius and the team that made it. A bot only
// turns on a noise that is still fresh, inside its radius, and not heard again within
// 4 s. Gunshots pull any nearby bot to the fight; footsteps only betray the enemy
// team, so teammates never chase each other around the map.
export function createHearing() {
  const noises = [];

  function addNoise(x, z, time, radius = 28, kind = 'shot', team = 'none') {
    noises.push({ x, z, time, radius, kind, team });
    if (noises.length > 40) noises.shift();
  }

  // The noise this bot hears right now, or null.
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
