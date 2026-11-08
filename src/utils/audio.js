let context = null;
let musicTimer = null;
let musicWanted = false;
let unlocked = false;
let step = 0;

const MELODY = [392, 494, 587, 494, 523, 587, 659, 587, 440, 523, 659, 523];

function audioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  return context;
}

function tone(freq, duration, type, gainValue, delay = 0, slideTo = 0) {
  const ctx = audioContext();
  if (!ctx || !freq) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, start);
  if (slideTo > 0) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playMelodyNote() {
  const freq = MELODY[step % MELODY.length];
  tone(freq, 0.34, 'sine', 0.018);
  if (step % 4 === 0) tone(freq / 2, 0.42, 'triangle', 0.012);
  step += 1;
}

export function ensureAudio() {
  const ctx = audioContext();
  if (!ctx) return;
  unlocked = true;
  if (ctx.state === 'suspended') ctx.resume();
  if (musicWanted && !musicTimer) {
    playMelodyNote();
    musicTimer = window.setInterval(playMelodyNote, 560);
  }
}

export function setMusicEnabled(enabled) {
  musicWanted = Boolean(enabled);
  if (!musicWanted && musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicWanted && unlocked) ensureAudio();
}

export function playSound(name, enabled = true) {
  if (!enabled) return;
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    if (!unlocked) return;
    ctx.resume();
  }
  if (name === 'coin') {
    tone(880, 0.08, 'triangle', 0.05);
    tone(1320, 0.12, 'sine', 0.04, 0.07);
  } else if (name === 'upgrade') {
    tone(440, 0.08, 'square', 0.03);
    tone(660, 0.1, 'square', 0.03, 0.07);
    tone(880, 0.14, 'triangle', 0.04, 0.14);
  } else if (name === 'order') {
    tone(523, 0.09, 'triangle', 0.045);
    tone(659, 0.09, 'triangle', 0.04, 0.08);
    tone(784, 0.16, 'sine', 0.05, 0.16);
  } else if (name === 'level') {
    tone(392, 0.1, 'triangle', 0.05);
    tone(523, 0.12, 'triangle', 0.05, 0.1);
    tone(659, 0.12, 'triangle', 0.05, 0.2);
    tone(784, 0.22, 'sine', 0.06, 0.32);
  } else if (name === 'unlock') {
    tone(660, 0.08, 'sine', 0.04);
    tone(990, 0.14, 'sine', 0.045, 0.08, 1400);
  } else if (name === 'tap') {
    tone(520, 0.04, 'square', 0.02);
  } else if (name === 'deny') {
    tone(180, 0.12, 'sawtooth', 0.02, 0, 90);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => ensureAudio(), { passive: true });
}
