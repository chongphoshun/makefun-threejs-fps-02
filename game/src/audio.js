// Every sound is synthesised with WebAudio: no audio files, no network, nothing to load.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.42;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      return false;
    }
    return true;
  }

  function noise(dur, filterFreq, gain, type = 'lowpass') {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function tone(freq, dur, gain, slideTo, type = 'sine') {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function shot(kind, distance = 0) {
    const vol = Math.max(0.05, 1 - distance * 0.85);
    if (kind === 'sniper') {
      noise(0.28, 900, 0.55 * vol);
      tone(140, 0.22, 0.4 * vol, 55, 'triangle');
    } else if (kind === 'smg') {
      noise(0.09, 2400, 0.3 * vol, 'bandpass');
      tone(220, 0.07, 0.16 * vol, 90, 'square');
    } else if (kind === 'pistol') {
      noise(0.12, 1800, 0.4 * vol, 'bandpass');
      tone(190, 0.09, 0.2 * vol, 80, 'square');
    } else {
      noise(0.14, 1500, 0.45 * vol, 'bandpass');
      tone(170, 0.11, 0.24 * vol, 70, 'square');
    }
  }

  return {
    unlock: ensure,
    shot,
    dry() { tone(1400, 0.05, 0.12, 900, 'square'); },
    reload() {
      tone(900, 0.05, 0.1, 600, 'square');
      setTimeout(() => tone(650, 0.05, 0.1, 420, 'square'), 320);
    },
    boom(distance = 0) {
      const vol = Math.max(0.1, 1 - distance * 0.7);
      noise(0.9, 320, 0.9 * vol);
      tone(90, 0.8, 0.7 * vol, 28);
    },
    beep(final) {
      tone(final ? 1560 : 1180, final ? 0.3 : 0.09, 0.16, undefined, 'square');
    },
    hit(kill) {
      tone(kill ? 880 : 660, kill ? 0.14 : 0.08, 0.2, undefined, 'square');
    },
    hurt() {
      tone(110, 0.16, 0.3, 60, 'sawtooth');
      noise(0.12, 500, 0.2);
    },
    plant() { tone(520, 0.1, 0.16, 780, 'square'); },
    click() { tone(1000, 0.04, 0.1, 700, 'square'); },
    roundWin() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.18), i * 130));
    },
    roundLose() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.26, 0.16), i * 150));
    },
    bounce() { tone(300, 0.06, 0.08, 180, 'triangle'); },
  };
}
