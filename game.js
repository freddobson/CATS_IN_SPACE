// Entry point: wire modules together and start the loop
import { CFG } from './src/cfg.js';
import { keys } from './src/input.js';
import { render } from './src/render.js';
import { createState, update as updateState, resetGame } from './src/update.js';
import { loadAssets } from './src/assets.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

const VIEW_W = CFG.viewW || 224;
const VIEW_H = CFG.viewH || 288;

async function start() {
  const state = createState(VIEW_W, VIEW_H);
  // load assets and attach to state
  try {
    state.assets = await loadAssets();
    console.log('Assets loaded:', Object.keys(state.assets));
  } catch (e) {
    // if assets fail to load, continue without them
    console.warn('asset load failed', e);
  }

  resetGame(state);

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
