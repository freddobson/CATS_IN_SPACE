import { CFG, GAME_STATE } from './cfg.js';
import { isAudioUnlocked } from './input.js';

// Rendering helpers. `render(state, ctx, VIEW_W, VIEW_H)` draws the full frame.
export function beginView(ctx, VIEW_W, VIEW_H) {
  const canvas = ctx.canvas;
  const s = Math.max(1, Math.floor(Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H)));
  const outW = VIEW_W * s;
  const outH = VIEW_H * s;
  const offX = (canvas.width - outW) / 2;
  const offY = (canvas.height - outH) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(s, s);
}

export function endView(ctx) { ctx.restore(); }

function drawShip(ctx, state, x, y) {
  // Try to load Gizmo sprite first, fallback to player.svg, then blocks
  const assets = state.assets || {};
  const img = assets.gizmo || assets.player;
  if (img) {
    ctx.drawImage(img, Math.floor(x), Math.floor(y), state.player.w, state.player.h);
    return;
  }

  ctx.fillRect(x + 5, y + 0, 2, 2);
  ctx.fillRect(x + 4, y + 2, 4, 2);
  ctx.fillRect(x + 2, y + 4, 8, 2);
  ctx.fillRect(x + 0, y + 6, 12, 2);
  ctx.fillRect(x + 3, y + 8, 6, 2);
}

function drawEnemy(ctx, state, e) {
  const x = Math.floor(e.x), y = Math.floor(e.y);
  const assets = state.assets || {};
  
  // Try to load sprite based on enemy kind (mouse, feather, yarn, laser, catnip, etc.)
  const sprite = assets[e.kind];
  if (sprite) {
    ctx.drawImage(sprite, x, y, e.w, e.h);
    return;
  }
  
  // Fallback rendering for missing sprites
  if (e.canBeam) {
    // Boss-type enemies (larger)
    ctx.fillRect(x + 2, y + 1, 10, 2);
    ctx.fillRect(x + 1, y + 3, 12, 3);
    ctx.fillRect(x + 3, y + 6, 8, 3);
    ctx.fillRect(x + 5, y + 9, 4, 2);
  } else {
    // Regular enemies (smaller)
    ctx.fillRect(x + 3, y + 1, 6, 2);
    ctx.fillRect(x + 2, y + 3, 8, 3);
    ctx.fillRect(x + 4, y + 6, 4, 3);
  }
}

function drawPowerup(ctx, state, p) {
  const assets = state.assets || {};
  const x = Math.floor(p.x - 8);
  const y = Math.floor(p.y - 8);
  const w = 16, h = 16;
  
  const sprite = assets[p.type]; // treat, fish, or heart
  if (sprite) {
    ctx.drawImage(sprite, x, y, w, h);
    return;
  }
  
  // Fallback: colored squares if sprite missing
  if (p.type === 'treat') {
    ctx.fillStyle = "#FFB366";
  } else if (p.type === 'fish') {
    ctx.fillStyle = "#FF99FF";
  } else if (p.type === 'heart') {
    ctx.fillStyle = "#FF4466";
  }
  ctx.fillRect(x, y, w, h);
}

export function render(state, ctx, VIEW_W, VIEW_H) {
  beginView(ctx, VIEW_W, VIEW_H);

  // Always render background and stars
  ctx.fillStyle = "#2a2b4a"; // Lighter blue-purple for better sprite visibility
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = "#ffffff";
  for (const s of state.stars) ctx.fillRect(s.x | 0, s.y | 0, s.r, s.r);

  // Show/hide crawl and press-enter prompt based on game state and audio unlock
  const crawlContainer = document.getElementById('crawl-container');
  const pressEnter = document.getElementById('press-enter');
  if (state.gameState === GAME_STATE.TITLE && isAudioUnlocked()) {
    if (crawlContainer) crawlContainer.style.display = 'block';
    if (pressEnter) pressEnter.style.display = 'block';
  } else {
    if (crawlContainer) crawlContainer.style.display = 'none';
    if (pressEnter) pressEnter.style.display = 'none';
  }

  // Render based on game state
  switch (state.gameState) {
    case GAME_STATE.TITLE:
      renderTitle(state, ctx, VIEW_W, VIEW_H);
      break;
    case GAME_STATE.PLAYING:
      renderPlaying(state, ctx, VIEW_W, VIEW_H);
      break;
    case GAME_STATE.PAUSED:
      renderPlaying(state, ctx, VIEW_W, VIEW_H);
      renderPaused(state, ctx, VIEW_W, VIEW_H);
      break;
    case GAME_STATE.GAME_OVER:
      renderPlaying(state, ctx, VIEW_W, VIEW_H);
      renderGameOver(state, ctx, VIEW_W, VIEW_H);
      break;
    case GAME_STATE.VICTORY:
      renderPlaying(state, ctx, VIEW_W, VIEW_H);
      renderVictory(state, ctx, VIEW_W, VIEW_H);
      break;
  }

  endView(ctx);
}

function renderTitle(state, ctx, VIEW_W, VIEW_H) {
  // Clean minimal title screen - no border
  
  // Show GOD MODE ACTIVATED message if cheat code entered
  if (state.godModeCheat) {
    // Blinking effect (every 0.3 seconds)
    const showMessage = Math.floor(state.godModeBlinkT / 0.3) % 2 === 0;
    
    if (showMessage) {
      // Dark background overlay
      ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      
      // Main message
      ctx.fillStyle = "#ff0000";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GOD MODE", VIEW_W / 2, VIEW_H / 2 - 10);
      ctx.fillText("ACTIVATED!", VIEW_W / 2, VIEW_H / 2 + 10);
      
      ctx.fillStyle = "#ffff00";
      ctx.font = "9px monospace";
      ctx.fillText("Unlimited power!", VIEW_W / 2, VIEW_H / 2 + 30);
    }
  }
  
  ctx.textAlign = "left";
}

function renderPlaying(state, ctx, VIEW_W, VIEW_H) {
  // player laser beams
  ctx.fillStyle = "#FF3333";
  for (const b of state.bullets) {
    // Draw laser beam with glow effect
    ctx.globalAlpha = 0.6;
    ctx.fillRect((b.x - 1) | 0, b.y | 0, b.w + 2, b.h);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "#FF6666";
    ctx.fillRect(b.x | 0, b.y | 0, b.w, b.h);
    ctx.fillStyle = "#FF3333";
  }

  ctx.fillStyle = "#ff5a7a";
  for (const b of state.ebullets) ctx.fillRect(b.x | 0, b.y | 0, b.w, b.h);

  // enemies
  for (const e of state.enemies) {
    ctx.fillStyle = e.flash > 0 ? "#ffffff" : (e.kind === "boss" ? "#ffd14a" : "#6db6ff");
    drawEnemy(ctx, state, e);
  }

  // beams (draw after enemies so they appear over ships)
  for (const b of state.beams) {
    const captor = state.enemies.find(en => en.id === b.enemyId);
    if (!captor) continue;
    const sx = captor.x + captor.w / 2;
    const sy = captor.y + captor.h;

    const len = b.len || 0;
    const baseHalf = (CFG.beamWidth || 10) / 2;
    const coneExtra = CFG.beamConeSpread || 60;
    const halfAtLen = baseHalf + (len / Math.max(1, b.maxLen || 1)) * coneExtra;
    const baseY = sy + len;

    ctx.save();
    ctx.globalAlpha = b.phase === 'latched' ? 0.6 : 0.35;
    ctx.fillStyle = '#ff4444'; // Red laser beam
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - halfAtLen, baseY);
    ctx.lineTo(sx + halfAtLen, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // player
  if (state.player.alive) {
    ctx.fillStyle = state.player.flash > 0 ? "#ffffff" : "#7CFF6B";
    
    // Add flicker effect during invulnerability (50ms on/off cycle)
    if (state.player.invulnerable) {
      const flickerPhase = Math.floor((state.player.invulnerableT * 10) % 2); // 50ms per phase
      if (flickerPhase === 0) {
        ctx.globalAlpha = 0.3; // Semi-transparent during flicker
      }
    }
    
    if (state.player.dual) {
      // Draw two ships side by side for dual mode
      const cx = state.player.x + state.player.w / 2;
      drawShip(ctx, state, (cx - CFG.dualShotSpacing - state.player.w / 2) | 0, state.player.y | 0);
      drawShip(ctx, state, (cx + CFG.dualShotSpacing - state.player.w / 2) | 0, state.player.y | 0);
    } else {
      drawShip(ctx, state, state.player.x | 0, state.player.y | 0);
    }
    
    ctx.globalAlpha = 1.0;
  }

  // rescue ship (falling captured ship)
  if (state.rescueShip) {
    ctx.fillStyle = "#7CFF6B";
    ctx.globalAlpha = 0.8;
    drawShip(ctx, state, state.rescueShip.x - state.rescueShip.w / 2 | 0, state.rescueShip.y | 0);
    ctx.globalAlpha = 1.0;
  }

  // powerups (treats, fish, hearts)
  for (const p of state.powerups) {
    drawPowerup(ctx, state, p);
  }

  // capturedShip (if exists, draw it following the captor)
  if (state.capturedShip) {
    ctx.fillStyle = "#7CFF6B";
    ctx.globalAlpha = 0.9; // slightly transparent to show it's captured
    drawShip(ctx, state, state.capturedShip.x | 0, state.capturedShip.y | 0);
    ctx.globalAlpha = 1.0; // reset
  }

  // explosions
  ctx.fillStyle = "#ffffff";
  for (const p of state.explosions) ctx.fillRect(p.x | 0, p.y | 0, 2, 2);

  // HUD
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(4, 4, 70, 16);
  ctx.fillRect(VIEW_W - 64, 4, 60, 16);
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "9px monospace";
  ctx.fillText(`SCORE ${state.player.score}`, 8, 15);
  
  // Powerup status (left side, below score)
  if (state.treatActive || state.fishActive) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    const powerupLines = (state.treatActive ? 1 : 0) + (state.fishActive ? 1 : 0);
    ctx.fillRect(4, 20, 70, 8 + powerupLines * 9);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "8px monospace";
  let statusY = 30;
  if (state.treatActive) {
    ctx.fillText(`TREAT: ${state.treatT.toFixed(1)}s`, 8, statusY);
    statusY += 9;
  }
  if (state.fishActive) {
    ctx.fillText(`FISH: ${state.fishT.toFixed(1)}s`, 8, statusY);
  }
  
  // Lives display (right side)
  ctx.fillText(`x${state.player.lives}`, VIEW_W - 20, 15);
  // Draw mini ship icons for lives
  for (let i = 0; i < Math.min(state.player.lives, 5); i++) {
    const iconX = VIEW_W - 56 + i * 8;
    ctx.fillStyle = "#7CFF6B";
    ctx.fillRect(iconX + 2, 7, 1, 1);
    ctx.fillRect(iconX + 1, 8, 3, 1);
    ctx.fillRect(iconX, 9, 5, 1);
    ctx.fillRect(iconX + 1, 10, 3, 1);
  }

  // Wave display (center top) - cap display at 10
  ctx.fillStyle = "#6db6ff";
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`WAVE ${Math.min(state.wave, 10)}`, VIEW_W / 2, 12);
  ctx.textAlign = "left";
  
  // Wave start announcement overlay
  if (state.waveStartDelay > 0) {
    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    
    // Blinking wave announcement - cap display at 10
    const showMessage = Math.floor(state.waveStartDelay / 0.3) % 2 === 0;
    if (showMessage) {
      ctx.fillStyle = "#ffd14a";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`WAVE ${Math.min(state.wave, 10)}`, VIEW_W / 2, VIEW_H / 2);
    }
    ctx.textAlign = "left";
  }
}

function renderPaused(state, ctx, VIEW_W, VIEW_H) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  
  ctx.fillStyle = "#ffd14a";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", VIEW_W / 2, VIEW_H / 2 - 10);
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "10px monospace";
  ctx.fillText("PRESS ESC TO RESUME", VIEW_W / 2, VIEW_H / 2 + 10);
  ctx.textAlign = "left";
}

function renderGameOver(state, ctx, VIEW_W, VIEW_H) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  
  ctx.fillStyle = "#ff5a7a";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", VIEW_W / 2, VIEW_H / 2 - 20);
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "10px monospace";
  ctx.fillText(`FINAL SCORE: ${state.player.score}`, VIEW_W / 2, VIEW_H / 2);
  ctx.fillText(`WAVE: ${Math.min(state.wave, 10)}`, VIEW_W / 2, VIEW_H / 2 + 15);
  
  // Show countdown or prompt based on timer
  if (state.gameOverTimer > 0) {
    ctx.fillText(`Please wait ${Math.ceil(state.gameOverTimer)}...`, VIEW_W / 2, VIEW_H / 2 + 40);
  } else {
    ctx.fillText("PRESS ENTER TO RETRY", VIEW_W / 2, VIEW_H / 2 + 40);
  }
  ctx.textAlign = "left";
}

function renderVictory(state, ctx, VIEW_W, VIEW_H) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  
  ctx.fillStyle = "#ffd14a";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.fillText("MISSION COMPLETE!", VIEW_W / 2, VIEW_H / 2 - 40);
  
  ctx.fillStyle = "#7CFF6B";
  ctx.font = "10px monospace";
  ctx.fillText("The Death Star is destroyed!", VIEW_W / 2, VIEW_H / 2 - 15);
  ctx.fillText("Earth and the cats are safe.", VIEW_W / 2, VIEW_H / 2);
  
  ctx.fillStyle = "#ff89b5";
  ctx.font = "9px monospace";
  ctx.fillText("Debbie, you are my hero.", VIEW_W / 2, VIEW_H / 2 + 25);
  ctx.fillText("Happy Valentine's Day!", VIEW_W / 2, VIEW_H / 2 + 38);
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "10px monospace";
  ctx.fillText(`FINAL SCORE: ${state.player.score}`, VIEW_W / 2, VIEW_H / 2 + 60);
  
  // Only show prompt when ready
  if (state.victoryTimer <= 0) {
    ctx.fillText("PRESS ENTER TO PLAY AGAIN", VIEW_W / 2, VIEW_H / 2 + 80);
  }
  ctx.textAlign = "left";
}
