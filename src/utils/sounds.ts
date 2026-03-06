let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function playMoveSound() {
  if (localStorage.getItem('sound_moves') === 'false') return;

  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

export function playTurnSound() {
  if (localStorage.getItem('sound_turn') === 'false') return;

  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

export function playWinSound() {
  if (localStorage.getItem('sound_moves') === 'false') return;

  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Triumphant ascending arpeggio: C5 → E5 → G5 → C6
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t + i * 0.12);
    osc.stop(t + i * 0.12 + 0.3);
  });
}

export function playExplosionSound() {
  if (localStorage.getItem('sound_moves') === 'false') return;

  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // White noise burst for explosion
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.3);
}

export function playPlaceBombSound() {
  if (localStorage.getItem('sound_moves') === 'false') return;

  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

export function playLoseSound() {
  if (localStorage.getItem('sound_moves') === 'false') return;

  const ctx = getAudioContext();
  const t = ctx.currentTime;

  // Descending minor: E4 → C4 → A3
  const notes = [330, 262, 220];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.18);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.35);
  });
}
