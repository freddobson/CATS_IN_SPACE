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

// Mobile button controls
function setupMobileControls() {
  const leftBtn = document.getElementById('left-btn');
  const rightBtn = document.getElementById('right-btn');
  const fireBtn = document.getElementById('fire-btn');
  const pauseBtn = document.getElementById('pause-btn');
  
  if (!leftBtn) return; // No mobile controls on this page
  
  // Left button
  leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys.add('arrowleft');
    unlockAudio();
  });
  leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.delete('arrowleft');
  });
  leftBtn.addEventListener('mousedown', () => {
    keys.add('arrowleft');
    unlockAudio();
  });
  leftBtn.addEventListener('mouseup', () => keys.delete('arrowleft'));
  
  // Right button
  rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys.add('arrowright');
    unlockAudio();
  });
  rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.delete('arrowright');
  });
  rightBtn.addEventListener('mousedown', () => {
    keys.add('arrowright');
    unlockAudio();
  });
  rightBtn.addEventListener('mouseup', () => keys.delete('arrowright'));
  
  // Fire button (also acts as ENTER for start/restart)
  fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys.add(' '); // spacebar for firing
    keys.add('enter'); // also add enter for start/restart
    unlockAudio();
  });
  fireBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.delete(' ');
    keys.delete('enter');
  });
  fireBtn.addEventListener('mousedown', () => {
    keys.add(' ');
    keys.add('enter');
    unlockAudio();
  });
  fireBtn.addEventListener('mouseup', () => {
    keys.delete(' ');
    keys.delete('enter');
  });
  
  // Pause button (ESC key)
  pauseBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys.add('escape');
    unlockAudio();
  });
  pauseBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.delete('escape');
  });
  pauseBtn.addEventListener('mousedown', () => {
    keys.add('escape');
    unlockAudio();
  });
  pauseBtn.addEventListener('mouseup', () => keys.delete('escape'));
}

// Initialize mobile controls when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMobileControls);
} else {
  setupMobileControls();
}

