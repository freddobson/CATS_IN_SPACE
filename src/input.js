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
  const dpadSlider = document.getElementById('dpad-slider');
  const sliderIndicator = document.getElementById('slider-indicator');
  const fireBtn = document.getElementById('fire-btn');
  const canvas = document.getElementById('game');
  
  if (!dpadSlider) return; // No mobile controls on this page
  
  // Track active touch for slider
  let sliderTouchId = null;
  
  // Update slider position and movement keys
  function updateSlider(clientX) {
    const rect = dpadSlider.getBoundingClientRect();
    const x = clientX - rect.left;
    const centerX = rect.width / 2;
    const deadzone = rect.width * 0.2; // 20% deadzone in center
    
    // Update indicator position (centered on touch, clamped to slider bounds)
    const indicatorRadius = 30; // Half of 60px indicator width
    const indicatorX = Math.max(indicatorRadius, Math.min(rect.width - indicatorRadius, x));
    sliderIndicator.style.left = `${indicatorX}px`;
    sliderIndicator.style.transform = 'translateX(-50%)';
    
    // Clear both keys first
    keys.delete('arrowleft');
    keys.delete('arrowright');
    
    // Determine direction based on position relative to center
    if (x < centerX - deadzone) {
      keys.add('arrowleft');
    } else if (x > centerX + deadzone) {
      keys.add('arrowright');
    }
  }
  
  // Reset slider to center
  function resetSlider() {
    sliderIndicator.style.left = '50%';
    sliderIndicator.style.transform = 'translateX(-50%)';
    keys.delete('arrowleft');
    keys.delete('arrowright');
    dpadSlider.classList.remove('active');
  }
  
  // Slider touch handlers
  dpadSlider.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (sliderTouchId === null && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      sliderTouchId = touch.identifier;
      dpadSlider.classList.add('active');
      updateSlider(touch.clientX);
      unlockAudio();
    }
  });
  
  dpadSlider.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (sliderTouchId !== null) {
      for (let touch of e.changedTouches) {
        if (touch.identifier === sliderTouchId) {
          updateSlider(touch.clientX);
          break;
        }
      }
    }
  });
  
  const handleSliderTouchEnd = (e) => {
    e.preventDefault();
    for (let touch of e.changedTouches) {
      if (touch.identifier === sliderTouchId) {
        sliderTouchId = null;
        resetSlider();
        break;
      }
    }
  };
  
  dpadSlider.addEventListener('touchend', handleSliderTouchEnd);
  dpadSlider.addEventListener('touchcancel', handleSliderTouchEnd);
  
  // Mouse support for slider (desktop testing)
  let mouseDown = false;
  
  dpadSlider.addEventListener('mousedown', (e) => {
    mouseDown = true;
    dpadSlider.classList.add('active');
    updateSlider(e.clientX);
    unlockAudio();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (mouseDown) {
      updateSlider(e.clientX);
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (mouseDown) {
      mouseDown = false;
      resetSlider();
    }
  });
  
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
  
  // Canvas tap in top 3/4 to pause
  let pauseCooldown = false;
  
  canvas.addEventListener('touchstart', (e) => {
    if (pauseCooldown) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const y = touch.clientY - rect.top;
    
    // Check if touch is in top 75% of canvas
    if (y < rect.height * 0.75) {
      keys.add('escape');
      unlockAudio();
      pauseCooldown = true;
      // Remove escape key after a brief moment (simulate key press)
      setTimeout(() => {
        keys.delete('escape');
        // Reset cooldown after a longer delay to prevent rapid toggling
        setTimeout(() => {
          pauseCooldown = false;
        }, 300);
      }, 50);
    }
  });
  
  // Desktop click support for pause
  canvas.addEventListener('click', (e) => {
    if (pauseCooldown) return;
    
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    // Check if click is in top 75% of canvas
    if (y < rect.height * 0.75) {
      keys.add('escape');
      pauseCooldown = true;
      setTimeout(() => {
        keys.delete('escape');
        setTimeout(() => {
          pauseCooldown = false;
        }, 300);
      }, 50);
    }
  });
}

// Initialize mobile controls when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMobileControls);
} else {
  setupMobileControls();
}

