export function createSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.22;
  musicGain.connect(master);

  let noiseBuf = null;
  function getNoiseBuffer() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 0.4;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function resume() {
    if (ctx.state === 'suspended') ctx.resume();
  }

  function envGain(t, attack, decay, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  function playFire(volume = 1) {
    const t = ctx.currentTime;

    // Sharp crack — high-freq noise transient
    const crack = ctx.createBufferSource();
    crack.buffer = getNoiseBuffer();
    const crackHp = ctx.createBiquadFilter();
    crackHp.type = 'highpass';
    crackHp.frequency.value = 3800;
    const crackG = ctx.createGain();
    crackG.gain.setValueAtTime(0, t);
    crackG.gain.linearRampToValueAtTime(2.2 * volume, t + 0.0008);
    crackG.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);
    crack.connect(crackHp).connect(crackG).connect(master);
    crack.start(t);
    crack.stop(t + 0.05);

    // Mid-body noise burst
    const body = ctx.createBufferSource();
    body.buffer = getNoiseBuffer();
    const bodyBp = ctx.createBiquadFilter();
    bodyBp.type = 'bandpass';
    bodyBp.frequency.value = 950;
    bodyBp.Q.value = 0.7;
    const bodyG = ctx.createGain();
    bodyG.gain.setValueAtTime(0, t);
    bodyG.gain.linearRampToValueAtTime(1.4 * volume, t + 0.002);
    bodyG.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    body.connect(bodyBp).connect(bodyG).connect(master);
    body.start(t);
    body.stop(t + 0.13);

    // Sub thump — sine sweep down
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(130, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 0.16);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0, t);
    subG.gain.linearRampToValueAtTime(1.0 * volume, t + 0.003);
    subG.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    sub.connect(subG).connect(master);
    sub.start(t);
    sub.stop(t + 0.21);
  }

  function playRocketFire(volume = 1) {
    const t = ctx.currentTime;

    // Deep launch thump
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t);
    sub.frequency.exponentialRampToValueAtTime(22, t + 0.32);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0, t);
    subG.gain.linearRampToValueAtTime(1.1 * volume, t + 0.006);
    subG.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    sub.connect(subG).connect(master);
    sub.start(t);
    sub.stop(t + 0.4);

    // Whoosh — low-pass noise sweep
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = getNoiseBuffer();
    const whooshLp = ctx.createBiquadFilter();
    whooshLp.type = 'lowpass';
    whooshLp.frequency.setValueAtTime(1200, t);
    whooshLp.frequency.exponentialRampToValueAtTime(180, t + 0.38);
    const whooshG = ctx.createGain();
    whooshG.gain.setValueAtTime(0, t);
    whooshG.gain.linearRampToValueAtTime(0.7 * volume, t + 0.01);
    whooshG.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    whoosh.connect(whooshLp).connect(whooshG).connect(master);
    whoosh.start(t);
    whoosh.stop(t + 0.42);

    // Mechanical clunk
    const clunk = ctx.createOscillator();
    clunk.type = 'square';
    clunk.frequency.setValueAtTime(200, t);
    clunk.frequency.exponentialRampToValueAtTime(55, t + 0.07);
    const clunkG = ctx.createGain();
    clunkG.gain.setValueAtTime(0, t);
    clunkG.gain.linearRampToValueAtTime(0.5 * volume, t + 0.002);
    clunkG.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    clunk.connect(clunkG).connect(master);
    clunk.start(t);
    clunk.stop(t + 0.1);
  }

  function playRemoteFire(distance = 10) {
    const atten = Math.max(0.15, Math.min(1, 8 / (distance + 4)));
    playFire(atten * 0.85);
  }

  function playReload() {
    const t = ctx.currentTime;
    const clicks = [0, 0.12, 0.32, 0.55];
    for (const offset of clicks) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, t + offset);
      osc.frequency.exponentialRampToValueAtTime(400, t + offset + 0.04);
      const g = envGain(t + offset, 0.001, 0.05, 0.22);
      osc.connect(g).connect(master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.08);
    }
  }

  function playHit() {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    const g = envGain(t, 0.001, 0.08, 0.4);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  function playKill() {
    const t = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = envGain(t + i * 0.05, 0.005, 0.25, 0.35);
      osc.connect(g).connect(master);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.3);
    });
  }

  function playDamaged() {
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = envGain(t, 0.004, 0.22, 0.55);
    noise.connect(lp).connect(g).connect(master);
    noise.start(t);
    noise.stop(t + 0.3);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    const g2 = envGain(t, 0.002, 0.25, 0.4);
    osc.connect(g2).connect(master);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  function playExplosion(volume = 1) {
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const g1 = envGain(t, 0.003, 0.55, 0.9 * volume);
    noise.connect(lp).connect(g1).connect(master);
    noise.start(t);
    noise.stop(t + 0.6);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.45);
    const g2 = envGain(t, 0.002, 0.5, 0.8 * volume);
    sub.connect(g2).connect(master);
    sub.start(t);
    sub.stop(t + 0.55);

    const crack = ctx.createBufferSource();
    crack.buffer = getNoiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800;
    bp.Q.value = 1.4;
    const g3 = envGain(t, 0.001, 0.08, 0.5 * volume);
    crack.connect(bp).connect(g3).connect(master);
    crack.start(t);
    crack.stop(t + 0.12);
  }

  function playRemoteExplosion(distance = 10) {
    const atten = Math.max(0.2, Math.min(1, 10 / (distance + 4)));
    playExplosion(atten);
  }

  function playRespawn() {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.25);
    const g = envGain(t, 0.01, 0.3, 0.3);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  const music = createMusic(ctx, musicGain);

  return {
    resume,
    playFire,
    playRocketFire,
    playRemoteFire,
    playReload,
    playHit,
    playKill,
    playDamaged,
    playRespawn,
    playExplosion,
    playRemoteExplosion,
    startMusic: music.start,
    stopMusic: music.stop,
    setMusicVolume: (v) => { musicGain.gain.value = v; },
    get master() { return master; },
  };
}

function createMusic(ctx, out) {
  const BPM = 104;
  const BEAT = 60 / BPM;
  const BAR = BEAT * 4;
  const LOOKAHEAD = 0.12;

  // A minor: i - VI - III - VII (Am - F - C - G), 8 bars total, 2 bars per chord
  const CHORDS = [
    { root: 220.00, notes: [220.00, 261.63, 329.63] },   // Am
    { root: 174.61, notes: [174.61, 220.00, 261.63] },   // F
    { root: 130.81, notes: [130.81, 164.81, 196.00] },   // C
    { root: 196.00, notes: [196.00, 246.94, 293.66] },   // G
  ];

  const BASS_PATTERN = [0, 0, 0.5, 0]; // beats within a bar where bass hits
  const ARP_PATTERN = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]; // 8th notes

  let running = false;
  let startTime = 0;
  let nextBarIdx = 0;
  let schedulerId = null;

  function playPadChord(chord, when, dur) {
    const pad = ctx.createGain();
    pad.gain.setValueAtTime(0, when);
    pad.gain.linearRampToValueAtTime(0.35, when + 0.6);
    pad.gain.linearRampToValueAtTime(0.25, when + dur - 0.4);
    pad.gain.linearRampToValueAtTime(0.0001, when + dur);
    pad.connect(out);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(500, when);
    filter.frequency.linearRampToValueAtTime(1400, when + dur * 0.6);
    filter.frequency.linearRampToValueAtTime(700, when + dur);
    filter.connect(pad);

    for (const f of chord.notes) {
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = f;
      o1.detune.value = -6;
      o1.connect(filter);
      o1.start(when);
      o1.stop(when + dur + 0.05);

      const o2 = ctx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.value = f;
      o2.detune.value = 6;
      o2.connect(filter);
      o2.start(when);
      o2.stop(when + dur + 0.05);
    }
  }

  function playBassNote(freq, when, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.5, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(out);

    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(freq / 2, when);
    o.connect(g);
    o.start(when);
    o.stop(when + dur + 0.02);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq / 4;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, when);
    sg.gain.linearRampToValueAtTime(0.4, when + 0.01);
    sg.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    sg.connect(out);
    sub.connect(sg);
    sub.start(when);
    sub.stop(when + dur + 0.02);
  }

  function playArpNote(freq, when) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.12, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    g.connect(out);

    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq * 2;
    o.connect(g);
    o.start(when);
    o.stop(when + 0.24);
  }

  function playKick(when) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.55, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    g.connect(out);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, when);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.2);
    o.connect(g);
    o.start(when);
    o.stop(when + 0.25);
  }

  function playHat(when) {
    const src = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.08, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);

    src.connect(hp).connect(g).connect(out);
    src.start(when);
    src.stop(when + 0.06);
  }

  function scheduleBar(barIdx, barStart) {
    const chord = CHORDS[Math.floor(barIdx / 2) % CHORDS.length];

    playPadChord(chord, barStart, BAR);

    for (const beat of BASS_PATTERN) {
      playBassNote(chord.root, barStart + beat * BEAT, BEAT * 0.9);
    }

    for (let i = 0; i < ARP_PATTERN.length; i++) {
      const beat = ARP_PATTERN[i];
      const note = chord.notes[i % chord.notes.length];
      playArpNote(note, barStart + beat * BEAT);
    }

    for (let b = 0; b < 4; b++) {
      if (b === 0 || b === 2) playKick(barStart + b * BEAT);
    }
    for (let i = 0; i < 8; i++) {
      playHat(barStart + i * 0.5 * BEAT);
    }
  }

  function tick() {
    if (!running) return;
    const now = ctx.currentTime;
    while (startTime + nextBarIdx * BAR < now + LOOKAHEAD) {
      scheduleBar(nextBarIdx, startTime + nextBarIdx * BAR);
      nextBarIdx += 1;
    }
  }

  function start() {
    if (running) return;
    running = true;
    startTime = ctx.currentTime + 0.1;
    nextBarIdx = 0;
    schedulerId = setInterval(tick, 60);
    tick();
  }

  function stop() {
    running = false;
    if (schedulerId != null) {
      clearInterval(schedulerId);
      schedulerId = null;
    }
  }

  return { start, stop };
}
