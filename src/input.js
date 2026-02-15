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
  
  // Track active touch for d-pad sliding
  let dpadTouchId = null;
  
  // Helper to get which button a touch is over
  function getButtonAtPoint(x, y) {
    const leftRect = leftBtn.getBoundingClientRect();
    const rightRect = rightBtn.getBoundingClientRect();
    
    if (x >= leftRect.left && x <= leftRect.right && y >= leftRect.top && y <= leftRect.bottom) {
      return 'left';
    }
    if (x >= rightRect.left && x <= rightRect.right && y >= rightRect.top && y <= rightRect.bottom) {
      return 'right';
    }
    return null;
  }
  
  // Update keys based on button
  function updateDpadKeys(button) {
    keys.delete('arrowleft');
    keys.delete('arrowright');
    
    if (button === 'left') {
      keys.add('arrowleft');
    } else if (button === 'right') {
      keys.add('arrowright');
    }
  }
  
  // D-pad touch handlers (support sliding)
  const handleDpadTouchStart = (e) => {
    e.preventDefault();
    if (dpadTouchId === null && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      dpadTouchId = touch.identifier;
      const button = getButtonAtPoint(touch.clientX, touch.clientY);
      updateDpadKeys(button);
      unlockAudio();
    }
  };
  
  const handleDpadTouchMove = (e) => {
    e.preventDefault();
    if (dpadTouchId !== null) {
      for (let touch of e.changedTouches) {
        if (touch.identifier === dpadTouchId) {
          const button = getButtonAtPoint(touch.clientX, touch.clientY);
          updateDpadKeys(button);
          break;
        }
      }
    }
  };
  
  const handleDpadTouchEnd = (e) => {
    e.preventDefault();
    for (let touch of e.changedTouches) {
      if (touch.identifier === dpadTouchId) {
        dpadTouchId = null;
        keys.delete('arrowleft');
        keys.delete('arrowright');
        break;
      }
    }
  };
  
  leftBtn.addEventListener('touchstart', handleDpadTouchStart);
  leftBtn.addEventListener('touchmove', handleDpadTouchMove);
  leftBtn.addEventListener('touchend', handleDpadTouchEnd);
  leftBtn.addEventListener('touchcancel', handleDpadTouchEnd);
  
  rightBtn.addEventListener('touchstart', handleDpadTouchStart);
  rightBtn.addEventListener('touchmove', handleDpadTouchMove);
  rightBtn.addEventListener('touchend', handleDpadTouchEnd);
  rightBtn.addEventListener('touchcancel', handleDpadTouchEnd);
  
  // Mouse support for d-pad (desktop testing)
  leftBtn.addEventListener('mousedown', () => {
    keys.add('arrowleft');
    unlockAudio();
  });
  leftBtn.addEventListener('mouseup', () => keys.delete('arrowleft'));
  
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

