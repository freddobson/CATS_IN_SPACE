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
  // Laser "pyoom" - quick descending pitch
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(1200, now);
  o.frequency.exponentialRampToValueAtTime(400, now + 0.12);
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(now);
  o.stop(now + 0.13);
}

export function playExplosion() {
  // quick descending blips
  playTone(440, 'sawtooth', 0.18, 0.16);
  setTimeout(() => playTone(220, 'sawtooth', 0.18, 0.12), 60);
}

export function playHit() {
  // Player taking damage
  playTone(180, 'sawtooth', 0.25, 0.2);
}

export function playCapture() {
  // Ascending alarm when captured
  playTone(300, 'triangle', 0.1, 0.15);
  setTimeout(() => playTone(450, 'triangle', 0.1, 0.15), 100);
  setTimeout(() => playTone(600, 'triangle', 0.15, 0.15), 200);
}

export function playBeamStart() {
  // Beam firing sound - descending whine
  playTone(800, 'sine', 0.3, 0.1);
  setTimeout(() => playTone(600, 'sine', 0.2, 0.08), 150);
}

export function unlockAudio() {
  // Call on first user interaction to resume audio context if suspended
  try {
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* ignore */ }
}
