// Simple WebAudio-based SFX helper (no external assets required)
let audioCtx = null;
function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.12, gain = 0.15) {
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(now);
  o.stop(now + duration + 0.02);
}

export function playShot() {
  playTone(880, 'square', 0.08, 0.12);
}

export function playExplosion() {
  // quick descending blips
  playTone(440, 'sawtooth', 0.18, 0.16);
  setTimeout(() => playTone(220, 'sawtooth', 0.18, 0.12), 60);
}

export function unlockAudio() {
  // Call on first user interaction to resume audio context if suspended
  try {
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* ignore */ }
}
