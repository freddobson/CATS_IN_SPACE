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
  // Enemy explosion - deep boom with multiple frequencies
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  
  // Deep bass boom
  const o1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(200, now);
  o1.frequency.exponentialRampToValueAtTime(80, now + 0.25);
  g1.gain.setValueAtTime(0.25, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  o1.connect(g1);
  g1.connect(ctx.destination);
  o1.start(now);
  o1.stop(now + 0.27);
  
  // Mid-range crackle
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = 'sawtooth';
  o2.frequency.setValueAtTime(450, now);
  o2.frequency.exponentialRampToValueAtTime(150, now + 0.15);
  g2.gain.setValueAtTime(0.15, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  o2.connect(g2);
  g2.connect(ctx.destination);
  o2.start(now);
  o2.stop(now + 0.17);
}

export function playHit() {
  // Player taking damage - angry growl
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  
  // Growling sawtooth
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, now);
  o.frequency.exponentialRampToValueAtTime(100, now + 0.3);
  g.gain.setValueAtTime(0.22, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(now);
  o.stop(now + 0.32);
}

export function playCapture() {
  // Capture/pickup sound - ascending beeps (cat meow/chomp)
  playTone(300, 'triangle', 0.1, 0.15);
  setTimeout(() => playTone(450, 'triangle', 0.1, 0.15), 100);
  setTimeout(() => playTone(600, 'triangle', 0.15, 0.15), 200);
}

export function playLevelComplete() {
  // Victory fanfare - ascending major chord
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  
  // C4 (262 Hz)
  playTone(262, 'sine', 0.3, 0.2);
  // E4 (330 Hz)
  setTimeout(() => playTone(330, 'sine', 0.3, 0.2), 100);
  // G4 (392 Hz)
  setTimeout(() => playTone(392, 'sine', 0.5, 0.25), 200);
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
// Music system
let musicOscillators = [];

export function stopAllMusic() {
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  for (const o of musicOscillators) {
    o.stop(now + 0.1);
  }
  musicOscillators = [];
}

function playMusicNote(freq, duration) {
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.08, now);
  g.gain.linearRampToValueAtTime(0.08, now + duration * 0.85);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(now);
  o.stop(now + duration + 0.05);
  musicOscillators.push(o);
}

export function playMenuMusic() {
  // Simple ascending arpeggio that loops
  stopAllMusic();
  
  const playArpeggio = () => {
    // C  E  G  E  C  G
    const notes = [
      { freq: 262, dur: 0.4 },   // C4
      { freq: 330, dur: 0.4 },   // E4
      { freq: 392, dur: 0.5 },   // G4
      { freq: 330, dur: 0.4 },   // E4
      { freq: 262, dur: 0.5 },   // C4
      { freq: 196, dur: 0.6 },   // G3
    ];
    
    let time = 0;
    for (const note of notes) {
      setTimeout(() => playMusicNote(note.freq, note.dur), time * 1000);
      time += note.dur;
    }
    
    return time; // Return total time for this loop
  };
  
  const loopTime = playArpeggio() * 1000;
  window.menuMusicInterval = setInterval(playArpeggio, loopTime);
}

export function playGameplayMusic() {
  // Driving bass line with melody
  stopAllMusic();
  
  const playBar = () => {
    // Simple repeating pattern
    const pattern = [
      { freq: 110, dur: 0.3 },   // A2 (bass)
      { freq: 110, dur: 0.3 },
      { freq: 147, dur: 0.6 },   // D3
      { freq: 220, dur: 0.3 },   // A3
      { freq: 220, dur: 0.3 },
      { freq: 196, dur: 0.6 },   // G3
    ];
    
    let time = 0;
    for (const note of pattern) {
      setTimeout(() => playMusicNote(note.freq, note.dur), time * 1000);
      time += note.dur;
    }
    
    return time;
  };
  
  const barTime = playBar() * 1000;
  window.gameMusicInterval = setInterval(playBar, barTime);
}

export function playEndingMusic() {
  // Triumphant final chord
  stopAllMusic();
  
  // Play major chord: C E G (C4 E4 G4)
  const notes = [262, 330, 392];
  for (const freq of notes) {
    playMusicNote(freq, 1.5);
  }
  
  // Follow with longer resolution
  setTimeout(() => {
    playMusicNote(262, 1.0); // C4 final
  }, 1600);
}