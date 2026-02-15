// Entry point: wire modules together and start the loop
import { CFG } from './src/cfg.js';
import { keys } from './src/input.js';
import { render } from './src/render.js';
import { createState, update as updateState, resetGame } from './src/update.js';
import { loadAssets } from './src/assets.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const VIEW_W = CFG.viewW || 224;
const VIEW_H = CFG.viewH || 288;

// Set canvas to game's internal resolution, let CSS scale it
canvas.width = VIEW_W;
canvas.height = VIEW_H;
ctx.imageSmoothingEnabled = false;

async function start() {
  const state = createState(VIEW_W, VIEW_H);
  // load assets and attach to state
  try {
    state.assets = await loadAssets();
  } catch (e) {
    // if assets fail to load, continue without them
    console.warn('asset load failed', e);
  }

  // Don't call resetGame here - let the game start on TITLE screen
  // resetGame will be called when user presses ENTER in updateTitle

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    updateState(dt, state, keys);
    render(state, ctx, VIEW_W, VIEW_H);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

start();
