// Keyboard input handling (exports `keys` set)
import { unlockAudio } from './sfx.js';

export const keys = new Set();

// Track if audio has been unlocked
let audioUnlocked = false;

addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  
  // Unlock audio on first keypress
  if (!audioUnlocked) {
    unlockAudio();
    audioUnlocked = true;
  }
});

addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

export function isPressed(key) {
  return keys.has(key.toLowerCase());
}
