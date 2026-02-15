import { CFG, GAME_STATE, PLAYER_SPEED, BULLET_SPEED, ENEMY_BULLET_SPEED, FIRE_COOLDOWN, ENEMY_FIRE_CHANCE, HIT_FLASH, STAR_COUNT } from './cfg.js';
import { bezier3, buildWavePaths, makeDivePath } from './paths.js';
import { makeEnemy, formationSlot } from './entities.js';
import { playShot, playExplosion, playHit, playCapture, playBeamStart, playLevelComplete, playMenuMusic, playGameplayMusic, playEndingMusic, stopAllMusic, unlockAudio } from './sfx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
// approximate bezier segment length (copied from paths.js logic)
function segLength(seg) {
  const steps = 12;
  let len = 0;
  let prev = seg.p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = bezier3(seg.p0, seg.p1, seg.p2, seg.p3, t);
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    len += Math.sqrt(dx*dx + dy*dy);
    prev = p;
  }
  return len;
}

export function createState(VIEW_W, VIEW_H) {
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: rand(0, VIEW_W),
    y: rand(0, VIEW_H),
    v: rand(7, 47),
    r: Math.random() < 0.85 ? 1 : 2
  }));

  const player = {
    x: VIEW_W / 2 - 12,
    y: VIEW_H - 28,
    w: 24, h: 20,
    alive: true,
    lives: CFG.lives || 3,
    score: 0,
    fireCd: 0,
    flash: 0,
    captured: false,
    captureT: 0,
    dual: false, // Dual fighter mode after rescue
    invulnerable: false, // Invulnerability timer after respawn
    invulnerableT: 0,
  };

  const formation = {
    originX: VIEW_W / 2,
    originY: 62,
    cols: 10,
    rows: 4,
    dx: 32,
    dy: 28,
    swayT: 0,
    swayAmp: 20,
    swaySpeed: 0.34,
  };

  return {
    VIEW_W,
    VIEW_H,
    gameState: GAME_STATE.TITLE,
    wave: 0,
    stars,
    player,
    bullets: [],
    ebullets: [],
    enemies: [],
    explosions: [],
    formation,
    diveTimer: CFG.diveEvery,
    captorId: null,
    capturedShip: null, // visual representation of captured player following captor
    rescueShip: null, // falling ship that player can catch for dual mode
    powerups: [], // dropped powerups (treats, fish, hearts)
    beams: [],
    gameOver: false,
    respawnDelay: 0, // Delay before respawning after death
    // powerup timers
    treatActive: false,
    treatT: 0,
    fishActive: false,
    fishT: 0,
  };
}

// Release any captor/beam state and free the player (used on player death or forced release)
export function releaseCaptor(state) {
  const capId = state.captorId;
  if (!capId) return;

  // remove beams owned by this captor
  state.beams = state.beams.filter(b => b.enemyId !== capId);

  // clear any beam reservations for this captor
  if (state.beamReserved) {
    for (const k of Object.keys(state.beamReserved)) {
      if (state.beamReserved[k] === capId) delete state.beamReserved[k];
    }
  }

  // clear captor flags
  const captor = state.enemies.find(en => en.id === capId);
  if (captor) {
    captor.beaming = false;
    delete captor.beamPath;
    delete captor.fixedY;
    delete captor.fixedX;
    // if captor was holding player, schedule return if possible
    if (!captor.mode || captor.mode === 'beam') {
      captor.mode = 'return';
      // build a simple return segment back to formation
      const curCx = captor.x + captor.w/2;
      const curCy = captor.y + captor.h/2;
      const targetCx = captor.slotX;
      const targetCy = captor.slotY;
      const retSeg = {
        p0: { x: curCx, y: curCy },
        p1: { x: curCx + (curCx < targetCx ? 20 : -20), y: curCy - 30 },
        p2: { x: targetCx + (Math.random() - 0.5) * 40, y: targetCy - 30 },
        p3: { x: targetCx, y: targetCy }
      };
      retSeg._len = segLength(retSeg);
      const speed = (CFG.beamDiveSpeed || 90) * 0.8;
      captor.path = [retSeg];
      captor.segIdx = 0; captor.t = 0;
      captor.segDurs = captor.path.map(s => Math.max(0.06, (s._len || 20) / speed));
      captor.segDur = captor.segDurs[0];
    }
  }

  // Clear capturedShip if it exists
  state.capturedShip = null;
  state.captorId = null;
}

function countDivers(state) {
  let n = 0;
  for (const e of state.enemies) if (e.mode === 'dive' || e.mode === 'return') n++;
  return n;
}

function pickDiver(state) {
  const inForm = state.enemies.filter(e => e.mode === 'formation');
  if (!inForm.length) return null;
  // Don't pick enemies that can beam - they should only beam, not dive
  const nonBeamers = inForm.filter(e => !e.canBeam);
  const pool = nonBeamers.length ? nonBeamers : inForm;
  return pool[(Math.random() * pool.length) | 0];
}



export function boom(state, x, y, n = 10) {
  for (let i = 0; i < n; i++) {
    state.explosions.push({
      x, y,
      vx: rand(-70, 70),
      vy: rand(-90, 30),
      life: rand(0.25, 0.5),
    });
  }
}

export function spawnWave(state) {
  const paths = buildWavePaths();
  const VIEW_W = state.VIEW_W;
  const waveNum = state.wave;

  // Different wave patterns showcasing enemy variety
  const wavePlans = [
    // Wave 1: Toy Mice invasion
    [
      { col: 2, row: 0, kind: 'mouse',  path: 'left'  },
      { col: 4, row: 0, kind: 'mouse',  path: 'left'  },
      { col: 5, row: 0, kind: 'mouse',  path: 'right' },
      { col: 7, row: 0, kind: 'mouse',  path: 'right' },
      { col: 3, row: 1, kind: 'feather', path: 'loopL' },
      { col: 6, row: 1, kind: 'feather', path: 'loopR' },
    ],
    
    // Wave 2: Feather toys
    [
      { col: 1, row: 0, kind: 'feather', path: 'left'  },
      { col: 8, row: 0, kind: 'feather', path: 'right' },
      { col: 3, row: 1, kind: 'feather', path: 'loopL' },
      { col: 6, row: 1, kind: 'feather', path: 'loopR' },
      { col: 4, row: 2, kind: 'mouse',   path: 'loopL' },
      { col: 5, row: 2, kind: 'mouse',   path: 'loopR' },
    ],
    
    // Wave 3: Balls of yarn appear! (first laser bosses!)
    [
      { col: 2, row: 0, kind: 'mouse',  path: 'left'  },
      { col: 7, row: 0, kind: 'mouse',  path: 'right' },
      { col: 3, row: 1, kind: 'yarn',   path: 'loopL' },
      { col: 6, row: 1, kind: 'yarn',   path: 'loopR' },
      { col: 4, row: 2, kind: 'laser',  path: 'loopL' },
      { col: 5, row: 2, kind: 'laser',  path: 'loopR' },
    ],
    
    // Wave 4: Mixed formation with catnip
    [
      { col: 1, row: 0, kind: 'mouse',   path: 'left'  },
      { col: 8, row: 0, kind: 'mouse',   path: 'right' },
      { col: 2, row: 1, kind: 'feather', path: 'loopL' },
      { col: 7, row: 1, kind: 'feather', path: 'loopR' },
      { col: 4, row: 2, kind: 'catnip',  path: 'loopL' },
      { col: 5, row: 2, kind: 'catnip',  path: 'loopR' },
    ],
    
    // Wave 5: Double LASER POINTER bosses!
    [
      { col: 2, row: 0, kind: 'feather', path: 'left'  },
      { col: 7, row: 0, kind: 'feather', path: 'right' },
      { col: 3, row: 1, kind: 'yarn',    path: 'loopL' },
      { col: 6, row: 1, kind: 'yarn',    path: 'loopR' },
      { col: 4, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 5, row: 2, kind: 'laser',   path: 'loopR' },
    ],
    
    // Wave 6: Yarn and catnip assault
    [
      { col: 1, row: 0, kind: 'yarn',    path: 'left'  },
      { col: 8, row: 0, kind: 'yarn',    path: 'right' },
      { col: 2, row: 1, kind: 'catnip',  path: 'loopL' },
      { col: 7, row: 1, kind: 'catnip',  path: 'loopR' },
      { col: 4, row: 2, kind: 'feather', path: 'loopL' },
      { col: 5, row: 2, kind: 'feather', path: 'loopR' },
    ],
    
    // Wave 7: Triple laser pointer danger!
    [
      { col: 2, row: 0, kind: 'mouse',   path: 'left'  },
      { col: 7, row: 0, kind: 'mouse',   path: 'right' },
      { col: 3, row: 1, kind: 'catnip',  path: 'loopL' },
      { col: 6, row: 1, kind: 'catnip',  path: 'loopR' },
      { col: 3, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 4, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 6, row: 2, kind: 'laser',   path: 'loopR' },
    ],
    
    // Wave 8: All enemy types mixed
    [
      { col: 1, row: 0, kind: 'mouse',   path: 'left'  },
      { col: 8, row: 0, kind: 'feather', path: 'right' },
      { col: 2, row: 1, kind: 'yarn',    path: 'loopL' },
      { col: 7, row: 1, kind: 'catnip',  path: 'loopR' },
      { col: 4, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 5, row: 2, kind: 'laser',   path: 'loopR' },
    ],
    
    // Wave 9: Catnip madness
    [
      { col: 2, row: 0, kind: 'catnip',  path: 'left'  },
      { col: 7, row: 0, kind: 'catnip',  path: 'right' },
      { col: 1, row: 1, kind: 'yarn',    path: 'loopL' },
      { col: 8, row: 1, kind: 'yarn',    path: 'loopR' },
      { col: 3, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 4, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 6, row: 2, kind: 'laser',   path: 'loopR' },
    ],
    
    // Wave 10: FINAL ASSAULT - Quad laser pointer boss + support
    [
      { col: 0, row: 0, kind: 'feather', path: 'left'  },
      { col: 9, row: 0, kind: 'feather', path: 'right' },
      { col: 2, row: 1, kind: 'catnip',  path: 'loopL' },
      { col: 7, row: 1, kind: 'catnip',  path: 'loopR' },
      { col: 2, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 3, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 4, row: 2, kind: 'laser',   path: 'loopL' },
      { col: 5, row: 2, kind: 'laser',   path: 'loopR' },
    ],
  ];

  // Select wave pattern, cycling through patterns or using last one
  // Ensure waveNum is at least 1, and index is always valid (0 to wavePlans.length - 1)
  const waveIndex = Math.max(0, Math.min((waveNum || 1) - 1, wavePlans.length - 1));
  const plan = wavePlans[waveIndex];

  let delay = 0;
  for (const item of plan) {
    const slot = formationSlot(state, item.col, item.row);

    let segs;
    if (item.path === 'left')  segs = paths.leftEntry(slot.x, slot.y);
    if (item.path === 'right') segs = paths.rightEntry(slot.x, slot.y);
    if (item.path === 'loopL') segs = paths.loopThenSlot(slot.x, slot.y, true);
    if (item.path === 'loopR') segs = paths.loopThenSlot(slot.x, slot.y, false);

    state.enemies.push(makeEnemy({
      kind: item.kind,
      slotCol: item.col,
      slotRow: item.row,
      slotX: slot.x,
      slotY: slot.y,
      pathSegs: segs,
      spawnDelay: delay,
    }));

    delay += 0.22;
  }
}

export function resetGame(state) {
  state.bullets.length = 0;
  state.ebullets.length = 0;
  state.enemies.length = 0;
  state.explosions.length = 0;
  state.powerups.length = 0;

  state.player.x = state.VIEW_W / 2 - 12;
  state.player.y = state.VIEW_H - 28;
  state.player.alive = true;
  state.player.lives = CFG.lives || 3;
  state.player.score = 0;
  state.player.fireCd = 0;
  state.player.flash = 0;
  state.player.captured = false;
  state.player.captureT = 0;
  state.player.dual = CFG.godMode ? true : false;
  state.player.invulnerable = CFG.godMode ? true : false;
  state.player.invulnerableT = CFG.godMode ? Infinity : 0;
  state.captorId = null;
  state.capturedShip = null;
  state.rescueShip = null;
  state.treatActive = CFG.godMode ? true : false;
  state.treatT = CFG.godMode ? Infinity : 0;
  state.fishActive = CFG.godMode ? true : false;
  state.fishT = CFG.godMode ? Infinity : 0;
  state.beams.length = 0;
  state.beamReserved = {};

  state.gameOver = false;
  state.gameState = GAME_STATE.PLAYING;
  state.wave = 1;
  state.respawnDelay = 0;

  spawnWave(state);
}

function releaseAllBeams(state) {
  if (!state) return;
  // clear beam objects and reset any captor flags so they can resume normal behavior
  for (const b of (state.beams || [])) {
    const captor = state.enemies.find(en => en.id === b.enemyId);
    if (captor) {
      captor.beaming = false;
      // clear beamPath so return logic isn't confused
      delete captor.beamPath;
      delete captor.fixedY;
      delete captor.fixedX;
    }
  }
  state.beams.length = 0;
  state.beamReserved = {};
  state.captorId = null;
}

export function update(dt, state, keys) {
  // Always update stars (for background ambience in all states)
  for (const s of state.stars) {
    s.y += s.v * dt;
    if (s.y > state.VIEW_H) { s.y = 0; s.x = rand(0, state.VIEW_W); }
  }

  // Route to appropriate update based on game state
  switch (state.gameState) {
    case GAME_STATE.TITLE:
      updateTitle(dt, state, keys);
      break;
    case GAME_STATE.PLAYING:
      updatePlaying(dt, state, keys);
      break;
    case GAME_STATE.PAUSED:
      updatePaused(dt, state, keys);
      break;
    case GAME_STATE.GAME_OVER:
      updateGameOver(dt, state, keys);
      break;
    case GAME_STATE.VICTORY:
      updateVictory(dt, state, keys);
      break;
  }
}

function updateTitle(dt, state, keys) {
  // Start menu music on first frame in title
  if (!window.titleMusicStarted) {
    playMenuMusic();
    window.titleMusicStarted = true;
  }
  
  // Press ENTER to start
  if (keys.has('enter')) {
    keys.delete('enter');
    stopAllMusic();
    window.titleMusicStarted = false;
    window.gameplayMusicStarted = false;
    window.victoryMusicStarted = false;
    resetGame(state);
  }
}

function updatePaused(dt, state, keys) {
  // Press ESC or P to resume
  if (keys.has('escape') || keys.has('p')) {
    keys.delete('escape');
    keys.delete('p');
    // Resume to the appropriate music state
    if (window.gameplayMusicStarted) {
      playGameplayMusic();
    }
    state.gameState = GAME_STATE.PLAYING;
  }
}

function updateGameOver(dt, state, keys) {
  // Press ENTER to restart
  if (keys.has('enter')) {
    stopAllMusic();
    window.titleMusicStarted = false;
    window.gameplayMusicStarted = false;
    window.victoryMusicStarted = false;
    resetGame(state);
  }
}

function updateVictory(dt, state, keys) {
  // Play ending music on first frame in victory
  if (!window.victoryMusicStarted) {
    playEndingMusic();
    window.victoryMusicStarted = true;
  }
  
  // Press ENTER to restart
  if (keys.has('enter')) {
    stopAllMusic();
    window.victoryMusicStarted = false;
    window.titleMusicStarted = false;
    window.gameplayMusicStarted = false;
    resetGame(state);
  }
}

function updatePlaying(dt, state, keys) {
  // Start gameplay music on first frame
  if (!window.gameplayMusicStarted) {
    stopAllMusic();
    playGameplayMusic();
    window.gameplayMusicStarted = true;
  }
  
  // Reset hit flag at start of frame to allow collision detection
  state.player.hitThisFrame = false;
  
  // Check for pause
  if (keys.has('escape') || keys.has('p')) {
    keys.delete('escape');
    keys.delete('p');
    stopAllMusic();
    state.gameState = GAME_STATE.PAUSED;
    return;
  }

  // Check for game over
  if (state.gameOver) {
    state.gameState = GAME_STATE.GAME_OVER;
    return;
  }

  // formation sway
  state.formation.swayT += dt * state.formation.swaySpeed;
  const sway = Math.sin(state.formation.swayT * Math.PI * 2) * state.formation.swayAmp;

  // dive manager (launch divers)
  if (!state.gameOver && state.player.alive) {
    state.diveTimer -= dt;
    if (state.diveTimer <= 0) {
      state.diveTimer = CFG.diveEvery;
      if (Math.random() < CFG.diveChance) {
        const maxActive = CFG.diveMaxActive || 2;
        if (countDivers(state) < maxActive) {
          const e = pickDiver(state);
          if (e) {
            const paths = makeDivePath(e, { x: state.player.x, y: state.player.y, w: state.player.w });
            e.mode = 'dive';
            e.path = paths.dive;
            e._returnPath = paths.ret;
            e.segIdx = 0;
            e.t = 0;
            // compute per-segment durations from approximate lengths
            const speed = CFG.diveSpeed || CFG.diveSegDuration;
            e.segDurs = e.path.map(s => Math.max(0.06, (s._len || 20) / speed));
            e.segDur = e.segDurs[0];
          }
        }
      }
    }
  }

  // player
  // always tick the fire cooldown so the player can fire immediately after release
  state.player.fireCd = Math.max(0, state.player.fireCd - dt);

  // Apply powerup effects to movement and fire rate
  let currentPlayerSpeed = PLAYER_SPEED;
  let currentFireCooldown = FIRE_COOLDOWN;
  
  if (state.treatActive) {
    currentPlayerSpeed *= CFG.treatSpeedBoost;
    currentFireCooldown /= CFG.treatFireBoost;
  }

  if (!state.gameOver && state.player.alive && !state.player.captured) {
    const left  = keys.has('arrowleft') || keys.has('a');
    const right = keys.has('arrowright') || keys.has('d');
    const fire  = keys.has(' ');

    if (left)  state.player.x -= currentPlayerSpeed * dt;
    if (right) state.player.x += currentPlayerSpeed * dt;
    state.player.x = clamp(state.player.x, 6, state.VIEW_W - state.player.w - 6);

    if (fire && state.player.fireCd <= 0) {
      if (state.player.dual) {
        // Dual mode: fire from both ships
        const cx = state.player.x + state.player.w / 2;
        state.bullets.push({ 
          x: cx - CFG.dualShotSpacing - 1.5, 
          y: state.player.y - 6, 
          w: 3, h: 18, 
          vy: -BULLET_SPEED 
        });
        state.bullets.push({ 
          x: cx + CFG.dualShotSpacing - 1.5, 
          y: state.player.y - 6, 
          w: 3, h: 18, 
          vy: -BULLET_SPEED 
        });
      } else {
        // Single mode
        state.bullets.push({ 
          x: state.player.x + state.player.w/2 - 1.5, 
          y: state.player.y - 6, 
          w: 3, h: 18, 
          vy: -BULLET_SPEED 
        });
      }
      state.player.fireCd = currentFireCooldown;
      playShot();
    }
  }

  // Update invulnerability timer
  if (state.player.invulnerable) {
    state.player.invulnerableT -= dt;
    if (state.player.invulnerableT <= 0) {
      state.player.invulnerable = false;
    }
  }

  state.player.flash = Math.max(0, state.player.flash - dt);

  // player bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.y += b.vy * dt;
    if (b.y < -20) state.bullets.splice(i, 1);
  }

  // enemy bullets
  for (let i = state.ebullets.length - 1; i >= 0; i--) {
    const b = state.ebullets[i];
    b.y += b.vy * dt;
    if (b.y > state.VIEW_H + 20) state.ebullets.splice(i, 1);
  }

  // rescue ship (falling captured ship)
  if (state.rescueShip) {
    state.rescueShip.y += state.rescueShip.vy * dt;
    
    // Check if player catches it
    if (!state.gameOver && state.player.alive) {
      const dx = (state.player.x + state.player.w / 2) - (state.rescueShip.x);
      const dy = (state.player.y + state.player.h / 2) - (state.rescueShip.y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= CFG.rescueCatchRadius) {
        state.rescueShip = null;
        state.player.dual = true;
        state.player.score += 200; // Bonus for rescue
        playCapture(); // Reuse capture sound for now
      }
    }
    
    // Remove if off screen
    if (state.rescueShip && state.rescueShip.y > state.VIEW_H + 20) {
      state.rescueShip = null;
    }
  }

  // powerups (treat, fish, heart)
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const p = state.powerups[i];
    p.y += p.vy * dt;
    
    // Slight angle drift (TOWARDS gizmo, 50% reduced magnitude)
    const dx = (p.x - (state.player.x + state.player.w / 2));
    const magnitude = Math.max(1, Math.abs(dx));
    p.x -= (dx / magnitude) * CFG.powerupDriftTowardsMagnitude * dt; // Drift towards gizmo
    
    // Check if player collects it
    if (!state.gameOver && state.player.alive) {
      const pdx = (state.player.x + state.player.w / 2) - p.x;
      const pdy = (state.player.y + state.player.h / 2) - p.y;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      
      if (pdist <= CFG.powerupCatchRadius) {
        // Apply powerup effect
        if (p.type === 'treat') {
          state.treatActive = true;
          state.treatT = CFG.treatDuration;
          playCapture(); // Chomping sound
        } else if (p.type === 'fish') {
          state.fishActive = true;
          state.fishT = CFG.fishDuration;
          state.player.invulnerable = true;
          state.player.invulnerableT = CFG.fishDuration;
          playCapture();
        } else if (p.type === 'heart') {
          state.player.lives++;
          // Respawn invulnerability for extra life pickup
          state.player.invulnerable = true;
          state.player.invulnerableT = CFG.respawnInvulnerabilityDuration;
          playCapture();
        }
        
        state.powerups.splice(i, 1);
      }
    }
    
    // Remove if off screen
    if (p.y > state.VIEW_H + 20) state.powerups.splice(i, 1);
  }

  // Update powerup timers
  if (state.treatActive) {
    state.treatT -= dt;
    if (state.treatT <= 0) state.treatActive = false;
  }
  if (state.fishActive) {
    state.fishT -= dt;
    if (state.fishT <= 0) state.fishActive = false;
  }

  // enemies
  for (const e of state.enemies) {
    e.flash = Math.max(0, e.flash - dt);

    if (e.mode === 'spawning') {
      e.spawnDelay -= dt;
      if (e.spawnDelay <= 0) e.mode = 'path';
      continue;
    }

    if (e.mode === 'path') {
      e.segDur = e.segDurs ? e.segDurs[e.segIdx] : e.segDur;
      e.t += dt / e.segDur;

      if (e.t >= 1) {
        e.t = 0;
        e.segIdx++;
        if (e.segIdx >= e.path.length) {
          e.mode = 'formation';
          e.segIdx = e.path.length - 1;
          e.x = e.slotX - e.w/2 + sway;
          e.y = e.slotY - e.h/2;
        }
      }

      const segNow = e.path[Math.min(e.segIdx, e.path.length - 1)];
      const p = bezier3(segNow.p0, segNow.p1, segNow.p2, segNow.p3, clamp(e.t, 0, 1));
      e.x = p.x - e.w/2;
      e.y = p.y - e.h/2;
    }

    // beam-dive handling (boss flies down a bezier toward player before firing)
    if (e.mode === 'beamdive') {
      e.segDur = e.segDurs ? e.segDurs[e.segIdx] : e.segDur;
      e.t += dt / e.segDur;
      const segNow = e.beamPath[Math.min(e.segIdx, e.beamPath.length - 1)];
      if (e.t >= 1) {
        e.t = 0;
        e.segIdx++;
        if (e.segIdx >= e.beamPath.length) {
          // reached dive end -> snap boss to final bezier point and create beam object
          const bId = e.beamId || Math.random().toString(36).slice(2);
          const endP = segNow.p3;
          e.x = endP.x - e.w/2; e.y = endP.y - e.h/2;
          // fix the captor Y so it doesn't jitter during beam extension
          e.fixedY = endP.y - Math.floor(e.h/2);
          e.fixedX = endP.x - Math.floor(e.w/2);
          // ensure the captor's visible y is set immediately
          e.y = e.fixedY;
          const finalCenterY = endP.y;
          const estimatedDy = Math.max(0, state.player.y - finalCenterY);
          const maxLen = Math.max(120, estimatedDy + 80);
          // create beam but don't start life countdown until it reaches full size
          state.beams.push({ id: bId, enemyId: e.id, life: 0, active: true, phase: 'extend', len: 0, maxLen, full: false });
          // leave e.beaming true until beam ends; switch to 'beam' mode
          e.mode = 'beam';
        } else {
          e.segDur = e.segDurs[e.segIdx];
        }
      }
      const p = bezier3(segNow.p0, segNow.p1, segNow.p2, segNow.p3, clamp(e.t, 0, 1));
      e.x = p.x - e.w/2; e.y = p.y - e.h/2;
      continue; // skip other logic while diving
    }

    // beam mode: hold position while beam is active (waiting for timeout to trigger return)
    if (e.mode === 'beam') {
      // Lock position using fixed coordinates if available
      if (typeof e.fixedX === 'number') e.x = e.fixedX;
      if (typeof e.fixedY === 'number') e.y = e.fixedY;
      // The beam timeout logic will switch this to 'return' mode when beam expires
      continue;
    }

    // Dive handling (sits before formation so it isn't overwritten)
    if (e.mode === 'dive') {
      e.segDur = e.segDurs ? e.segDurs[e.segIdx] : e.segDur;
      const segNow = e.path[Math.min(e.segIdx, e.path.length - 1)];
      e.t += dt / e.segDur;
      if (e.t >= 1) {
        e.t = 0;
        e.segIdx++;
        if (e.segIdx >= e.path.length) {
          // finished dive, switch to return path
          e.mode = 'return';
          e.path = e._returnPath;
          e.segIdx = 0;
          e.t = 0;
          // compute return durations if available
          if (e.path && e.path.map) {
            e.segDurs = e.path.map(s => Math.max(0.06, (s._len || 20) / (CFG.diveSpeed || CFG.diveSegDuration)));
            e.segDur = e.segDurs[0];
          } else {
            e.segDur = CFG.diveSegDuration;
          }
        }
      }
      const cur = e.path[Math.min(e.segIdx, e.path.length - 1)];
      const p = bezier3(cur.p0, cur.p1, cur.p2, cur.p3, clamp(e.t, 0, 1));
      e.x = p.x - e.w/2; e.y = p.y - e.h/2;
      continue; // skip formation and other logic while diving
    }

    if (e.mode === 'return') {
      const cur = e.path[Math.min(e.segIdx, e.path.length - 1)];
      e.t += dt / e.segDur;
      if (e.t >= 1) {
        e.mode = 'formation';
        e.segIdx = e.path.length - 1;
        e.t = 0;
        // if this return was from a beam, just clear the flag
        // DO NOT release the player - they stay captured until boss is killed
        if (e.returningFromBeam) {
          e.returningFromBeam = false;
          // cleanup any fixed positions
          delete e.beamPath;
          delete e.fixedY;
          delete e.fixedX;
        }
      } else {
        const p = bezier3(cur.p0, cur.p1, cur.p2, cur.p3, clamp(e.t, 0, 1));
        e.x = p.x - e.w/2; e.y = p.y - e.h/2;
      }
      continue;
    }

    if (e.mode === 'formation') {
      const base = formationSlot(state, e.slotCol, e.slotRow);
      e.slotX = base.x;
      e.slotY = base.y;
      e.x = e.slotX - e.w/2 + sway;
      e.y = e.slotY - e.h/2;

      // Enemy bullet firing (can be disabled for testing)
      if (!state.gameOver && state.player.alive && !CFG.enemiesDontFire) {
        const chance = ENEMY_FIRE_CHANCE * dt * 60;
        if (Math.random() < chance) {
          const dx = (state.player.x + state.player.w/2) - (e.x + e.w/2);
          if (Math.abs(dx) < 40) {
            state.ebullets.push({ x: e.x + e.w/2 - 1, y: e.y + e.h, w: 2, h: 6, vy: ENEMY_BULLET_SPEED });
          }
        }
      }

      // Boss beam attack (capture) - only if no current captor and player doesn't have dual mode (always active, even if enemiesDontFire)
      if (!state.gameOver && state.player.alive && e.canBeam && !state.captorId && !state.player.dual && Math.random() < (CFG.beamChance || 0) * dt * 60) {
          // reserve this captor immediately to avoid race with other bosses
          const beamId = Math.random().toString(36).slice(2);
          state.captorId = e.id;
          state.beamReserved = state.beamReserved || {};
          state.beamReserved[beamId] = e.id;

          // build a short bezier path from the boss down toward the player (halfway)
          const sx = e.x + e.w / 2;
          const sy = e.y + e.h / 2;
          const px = state.player.x + state.player.w / 2;
          const py = state.player.y + state.player.h / 2;
          const tx = (sx + px) / 2 + rand(-20, 20);
          const ty = sy + (py - sy) * 0.5 + 10;

          const seg = {
            p0: { x: sx, y: sy },
            p1: { x: sx, y: sy + 20 },
            p2: { x: tx, y: ty - 20 },
            p3: { x: tx, y: ty }
          };

          seg._len = segLength(seg);
          const beamPath = [seg];

          // set up the boss to follow this beamdive path
          e.beaming = true;
          e.beamOrigY = e.y;
          e.beamTargetY = e.y + (CFG.beamDiveDown || 40);
          e.beamPath = beamPath;
          e.beamId = beamId;
          e.mode = 'beamdive';
          e.segIdx = 0;
          e.t = 0;
          const speed = CFG.beamDiveSpeed || 90;
          e.segDurs = e.beamPath.map(s => Math.max(0.06, (s._len || 20) / speed));
          e.segDur = e.segDurs[0];
          playBeamStart();
      }
    }
  }

  // collision: enemy -> player (dive-bomb or ram)
  // Check AFTER all mode handlers have updated enemy positions
  for (const e of state.enemies) {
    if (e.mode === 'spawning') continue;
    
    if (!state.gameOver && state.player.alive && !state.player.hitThisFrame && aabb(e, state.player)) {
      // Skip collision if invulnerable
      if (state.player.invulnerable) {
        continue;
      }
      
      // damage player, spawn explosion, and remove the enemy
      state.player.hitThisFrame = true;
      state.player.flash = 0.25;

      // remove the enemy that collided
      const idx = state.enemies.indexOf(e);
      if (idx !== -1) {
        // bigger explosion at enemy position
        boom(state, e.x + e.w/2, e.y + e.h/2, e.w);
        state.enemies.splice(idx, 1);
      }
      
      // In dual mode, lose dual instead of life
      if (state.player.dual) {
        state.player.dual = false;
        playHit();
        boom(state, state.player.x + state.player.w/2, state.player.y + state.player.h/2, 18);
      } else {
        state.player.lives--;
        playHit();
        boom(state, state.player.x + state.player.w/2, state.player.y + state.player.h/2, 18);

        if (state.player.lives <= 0) {
          // Game over - keep capturedShip if it exists (don't release captor)
          state.player.alive = false;
          state.gameOver = true;
          // Clear beams but preserve capturedShip
          state.beams.length = 0;
        } else {
          // Player still has lives - respawn but DON'T release captor/capturedShip
          // The captured ship should persist until the captor is destroyed
          state.player.x = state.VIEW_W / 2 - 12;
          state.player.y = state.VIEW_H - 28;
          state.player.captureT = 0;
        }
      }

      break;
    }
  }

  // collisions: player bullets -> enemies
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    let hit = false;

    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const e = state.enemies[ei];
      if (e.mode === 'spawning') continue;

      if (aabb(b, e)) {
        hit = true;
        e.hp--;
        e.flash = HIT_FLASH;
        if (e.hp <= 0) {
          state.player.score += e.score;
          playExplosion();
          boom(state, e.x + e.w/2, e.y + e.h/2, e.w);
          
          // Drop powerups (mutually exclusive: heart > fish > treat)
          const rand = Math.random();
          if (rand < CFG.heartDropChance) {
            state.powerups.push({ type: 'heart', x: e.x + e.w / 2, y: e.y + e.h, vy: CFG.powerupDriftSpeed });
          } else if (rand < CFG.heartDropChance + CFG.fishDropChance) {
            state.powerups.push({ type: 'fish', x: e.x + e.w / 2, y: e.y + e.h, vy: CFG.powerupDriftSpeed });
          } else if (rand < CFG.heartDropChance + CFG.fishDropChance + CFG.treatDropChance) {
            state.powerups.push({ type: 'treat', x: e.x + e.w / 2, y: e.y + e.h, vy: CFG.powerupDriftSpeed });
          }
          
          // If this enemy was the captor, drop rescue ship
          if (state.captorId === e.id && state.capturedShip) {
            state.rescueShip = {
              x: e.x + e.w / 2,
              y: e.y + e.h,
              w: state.capturedShip.w,
              h: state.capturedShip.h,
              vy: CFG.rescueDropSpeed,
            };
            releaseCaptor(state);
          }
          
          state.enemies.splice(ei, 1);
        }
        break;
      }
    }

    if (hit) state.bullets.splice(bi, 1);
  }

  // collisions: enemy bullets -> player (fish/invulnerability provides protection)
  if (!state.gameOver && state.player.alive && !state.player.hitThisFrame && !state.fishActive && !state.player.invulnerable) {
    for (let i = state.ebullets.length - 1; i >= 0; i--) {
      const b = state.ebullets[i];
      if (aabb(b, state.player)) {
        // Remove bullet and damage player
        state.ebullets.splice(i, 1);

        state.player.hitThisFrame = true;
        state.player.flash = 0.25;
        
        // In dual mode, lose dual instead of life
        if (state.player.dual) {
          state.player.dual = false;
          playHit();
          boom(state, state.player.x + state.player.w/2, state.player.y + state.player.h/2, 18);
        } else {
          state.player.lives--;
          playHit();
          boom(state, state.player.x + state.player.w/2, state.player.y + state.player.h/2, 18);

          if (state.player.lives <= 0) {
            // Game over - keep capturedShip if it exists
            state.player.alive = false;
            state.gameOver = true;
            state.beams.length = 0;
          } else {
            // Player still has lives - respawn with delay and invulnerability
            // Reset all enemies to formation
            const sway = Math.sin(state.formation.swayT * Math.PI * 2) * state.formation.swayAmp;
            for (const e of state.enemies) {
              e.mode = 'formation';
              e.segIdx = e.path.length - 1;
              e.x = e.slotX - e.w/2 + sway;
              e.y = e.slotY;
              e.beaming = false;
            }
            // Set respawn delay and invulnerability
            state.respawnDelay = CFG.respawnDelay;
            state.player.x = state.VIEW_W / 2 - 12;
            state.player.y = state.VIEW_H - 28;
            state.player.captureT = 0;
            state.player.invulnerable = true;
            state.player.invulnerableT = CFG.respawnInvulnerabilityDuration;
          }
        }
        break;
      }
    }
  }

  // beams aging & simple capture handling
  for (let i = state.beams.length - 1; i >= 0; i--) {
    const b = state.beams[i];
    
    // Only decrement life if beam is full
    if (b.full) {
      b.life -= dt;
    }

    // find the enemy that fired this beam
    const captor = state.enemies.find(en => en.id === b.enemyId);
    
    // If captor is dead, clean up beam and release player
    if (!captor) {
      if (state.captorId === b.enemyId) {
        state.player.captured = false;
        state.player.invulnerable = false;
        state.captorId = null;
      }
      state.beams.splice(i, 1);
      continue;
    }

    // Check for beam timeout FIRST (before processing phases)
    if (b.full && b.life <= 0) {
      // when beam full-time ends, set up captor to return along mirrored path
      captor.beaming = false;
      
      // build a return path from current center to formation slot center
      const curCx = captor.x + captor.w/2;
      const curCy = captor.y + captor.h/2;
      const targetCx = captor.slotX;
      const targetCy = captor.slotY;
      const retSeg = {
        p0: { x: curCx, y: curCy },
        p1: { x: curCx + (curCx < targetCx ? 20 : -20), y: curCy - 30 },
        p2: { x: targetCx + (Math.random() - 0.5) * 40, y: targetCy - 30 },
        p3: { x: targetCx, y: targetCy }
      };
      retSeg._len = segLength(retSeg);
      const ret = [retSeg];
      const speed = (CFG.beamDiveSpeed || 90) * 0.8;
      captor.path = ret;
      captor.mode = 'return';
      captor.segIdx = 0;
      captor.t = 0;
      captor.segDurs = captor.path.map(s => Math.max(0.06, (s._len || 20) / speed));
      captor.segDur = captor.segDurs[0];
      captor.returningFromBeam = true;
      
      // cleanup captor state
      delete captor.beamPath;
      delete captor.fixedY;
      delete captor.fixedX;
      
      // clear reservation
      if (state.beamReserved && state.beamReserved[b.id]) {
        delete state.beamReserved[b.id];
      }
      
      // remove beam
      state.beams.splice(i, 1);
      continue;
    }

    // beam behavior: extend toward player; captor dives down; if cone touches player -> capture
    if (b.phase === 'extend') {
      // extend beam length
      b.len = Math.min(b.maxLen, b.len + (CFG.beamPullSpeed || 90) * dt);
      // lock captor to fixedY if available to avoid jitter
      if (captor.beaming && typeof captor.fixedY === 'number') {
        captor.y = captor.fixedY;
      }
      if (captor.beaming && typeof captor.fixedX === 'number') {
        captor.x = captor.fixedX;
      }

      // if beam reached full length, mark it full and begin life countdown
      if (!b.full && b.len >= b.maxLen) {
        b.full = true;
        b.life = CFG.beamDuration || 3.0; // start timeout from full size
      }

      // cone half-width grows with length
      const dy = (state.player.y + state.player.h/2) - (captor.y + captor.h);
      if (dy > 0 && dy <= b.len && !state.capturedShip && state.player.alive && !state.player.hitThisFrame && !state.player.invulnerable) {
        const dx = (state.player.x + state.player.w/2) - (captor.x + captor.w/2);
        const baseHalf = (CFG.beamWidth || 10) / 2;
        const coneExtra = CFG.beamConeSpread || 60;
        const halfAtDy = baseHalf + (dy / b.maxLen) * coneExtra;
        if (Math.abs(dx) <= halfAtDy) {
          // player touched by cone -> capture!
          // Lose a life and respawn new player, captured ship follows captor
          state.player.hitThisFrame = true;
          state.player.lives--;
          state.player.flash = 0.25;
          playCapture();
          
          // Create capturedShip visual that will follow the captor (even on game over)
          state.capturedShip = {
            x: state.player.x,
            y: state.player.y,
            w: state.player.w,
            h: state.player.h,
          };
          state.captorId = captor.id;
          
          if (state.player.lives <= 0) {
            // Game over - capturedShip persists
            state.player.alive = false;
            state.gameOver = true;
          } else {
            // Respawn active player at bottom
            state.player.x = state.VIEW_W / 2 - 12;
            state.player.y = state.VIEW_H - 28;
            state.player.captured = false;
            state.player.invulnerable = false;
            state.player.captureT = 0;
            state.player.fireCd = FIRE_COOLDOWN; // brief cooldown on respawn
          }
          
          b.phase = 'latched';
          b.active = false;
          // start beam timeout from capture if not already started
          if (!b.full) {
            b.full = true;
            b.life = CFG.beamDuration || 3.0;
          }
        }
      }
    }

    // Safety check: if beam is full but phase is still extend (never captured), mark it ready for timeout
    if (!b.full && b.phase === 'extend' && b.len >= b.maxLen) {
      b.full = true;
      b.life = CFG.beamDuration || 3.0;
    }
  }

  // Position capturedShip to follow captor (moved outside beam loop)
  // This ensures capturedShip follows captor even after beam expires
  if (state.capturedShip && state.captorId) {
    const cap = state.enemies.find(en => en.id === state.captorId);
    if (!cap) {
      // Captor is gone, remove capturedShip
      state.capturedShip = null;
      state.captorId = null;
    } else {
      // Lock capturedShip position behind/above captor
      state.capturedShip.x = Math.round(cap.x + cap.w / 2 - state.capturedShip.w / 2);
      state.capturedShip.y = Math.round(cap.y - state.capturedShip.h - 2);
    }
  }

  // explosions
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    const p = state.explosions[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 120 * dt;
    if (p.life <= 0) state.explosions.splice(i, 1);
  }

  // wave refill if empty
  if (!state.gameOver && state.enemies.length === 0) {
    state.wave++;
    // Check for victory condition
    if (state.wave > CFG.wavesForVictory) {
      state.gameState = GAME_STATE.VICTORY;
      playLevelComplete();
    } else {
      spawnWave(state);
    }
  }
}

function aabb(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}
