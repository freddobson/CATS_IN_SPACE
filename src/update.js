import { CFG, PLAYER_SPEED, BULLET_SPEED, ENEMY_BULLET_SPEED, FIRE_COOLDOWN, ENEMY_FIRE_CHANCE, HIT_FLASH, STAR_COUNT } from './cfg.js';
import { bezier3, buildWavePaths, makeDivePath } from './paths.js';
import { makeEnemy, formationSlot } from './entities.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

export function createState(VIEW_W, VIEW_H) {
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: rand(0, VIEW_W),
    y: rand(0, VIEW_H),
    v: rand(10, 70),
    r: Math.random() < 0.85 ? 1 : 2
  }));

  const player = {
    x: VIEW_W / 2 - 6,
    y: VIEW_H - 28,
    w: 12, h: 10,
    alive: true,
    lives: CFG.lives || 3,
    score: 0,
    fireCd: 0,
    flash: 0,
    captured: false,
    captureT: 0,
  };

  const formation = {
    originX: VIEW_W / 2,
    originY: 62,
    cols: 10,
    rows: 4,
    dx: 16,
    dy: 14,
    swayT: 0,
    swayAmp: 10,
    swaySpeed: 0.6,
  };

  return {
    VIEW_W,
    VIEW_H,
    stars,
    player,
    bullets: [],
    ebullets: [],
    enemies: [],
    explosions: [],
    formation,
    diveTimer: CFG.diveEvery,
    captorId: null,
    beams: [],
    gameOver: false,
  };
}

function countDivers(state) {
  let n = 0;
  for (const e of state.enemies) if (e.mode === 'dive' || e.mode === 'return') n++;
  return n;
}

function pickDiver(state) {
  const inForm = state.enemies.filter(e => e.mode === 'formation');
  if (!inForm.length) return null;
  const bees = inForm.filter(e => e.kind !== 'boss');
  const pool = bees.length ? bees : inForm;
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

  const plan = [
    { col: 3, row: 0, kind: 'bee',  path: 'left'  },
    { col: 6, row: 0, kind: 'bee',  path: 'right' },
    { col: 2, row: 1, kind: 'bee',  path: 'loopL' },
    { col: 7, row: 1, kind: 'bee',  path: 'loopR' },
    { col: 4, row: 2, kind: 'boss', path: 'loopL' },
    { col: 5, row: 2, kind: 'boss', path: 'loopR' },
  ];

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

  state.player.x = state.VIEW_W / 2 - 6;
  state.player.y = state.VIEW_H - 28;
  state.player.alive = true;
  state.player.lives = CFG.lives || 3;
  state.player.score = 0;
  state.player.fireCd = 0;
  state.player.flash = 0;

  state.gameOver = false;

  spawnWave(state);
}

export function update(dt, state, keys) {
  // restart
  if (state.gameOver && keys.has('enter')) resetGame(state);

  // stars
  for (const s of state.stars) {
    s.y += s.v * dt;
    if (s.y > state.VIEW_H) { s.y = 0; s.x = rand(0, state.VIEW_W); }
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
  if (!state.gameOver && state.player.alive) {
    const left  = keys.has('arrowleft') || keys.has('a');
    const right = keys.has('arrowright') || keys.has('d');
    const fire  = keys.has(' ');

    if (left)  state.player.x -= PLAYER_SPEED * dt;
    if (right) state.player.x += PLAYER_SPEED * dt;
    state.player.x = clamp(state.player.x, 6, state.VIEW_W - state.player.w - 6);

    state.player.fireCd = Math.max(0, state.player.fireCd - dt);
    if (fire && state.player.fireCd <= 0) {
      state.bullets.push({ x: state.player.x + state.player.w/2 - 1, y: state.player.y - 6, w: 2, h: 6, vy: -BULLET_SPEED });
      state.player.fireCd = FIRE_COOLDOWN;
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
          e.x = e.slotX + sway;
          e.y = e.slotY;
        }
      }

      const segNow = e.path[Math.min(e.segIdx, e.path.length - 1)];
      const p = bezier3(segNow.p0, segNow.p1, segNow.p2, segNow.p3, clamp(e.t, 0, 1));
      e.x = p.x;
      e.y = p.y;
    }

    // collision: enemy -> player (dive-bomb or ram)
    if (!state.gameOver && state.player.alive && aabb(e, state.player)) {
      // damage player, spawn explosion, and remove the enemy
      state.player.flash = 0.25;
      state.player.lives--;
      boom(state, state.player.x + state.player.w/2, state.player.y + state.player.h/2, 18);

      // remove the enemy that collided
      const idx = state.enemies.indexOf(e);
      if (idx !== -1) {
        // bigger explosion at enemy position
        boom(state, e.x + e.w/2, e.y + e.h/2, e.kind === 'boss' ? 14 : 10);
        state.enemies.splice(idx, 1);
      }

      if (state.player.lives <= 0) {
        state.player.alive = false;
        state.gameOver = true;
      }

      break;
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
        delete e._returnPath;
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
      e.x = e.slotX + sway;
      e.y = e.slotY;

      if (!state.gameOver && state.player.alive) {
        const chance = ENEMY_FIRE_CHANCE * dt * 60;
        if (Math.random() < chance) {
          const dx = (state.player.x + state.player.w/2) - (e.x + e.w/2);
          if (Math.abs(dx) < 40) {
            state.ebullets.push({ x: e.x + e.w/2 - 1, y: e.y + e.h, w: 2, h: 6, vy: ENEMY_BULLET_SPEED });
          }
        }

        // Boss beam attack (capture)
        if (e.kind === 'boss' && Math.random() < (CFG.beamChance || 0) * dt * 60) {
          state.beams.push({
            id: Math.random().toString(36).slice(2),
            enemyId: e.id,
            x: e.x + e.w / 2,
            y: e.y + e.h,
            life: CFG.beamDuration,
            active: true,
          });
        }
      }
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
          boom(state, e.x + e.w/2, e.y + e.h/2, e.kind === 'boss' ? 14 : 10);
          state.enemies.splice(ei, 1);
        }
        break;
      }
    }

    if (hit) state.bullets.splice(bi, 1);
  }

  // collisions: enemy bullets -> player
  if (!state.gameOver && state.player.alive) {
    for (let i = state.ebullets.length - 1; i >= 0; i--) {
      const b = state.ebullets[i];
      if (aabb(b, state.player)) {
        state.ebullets.splice(i, 1);
        state.player.flash = 0.25;
        state.player.lives--;
        boom(state, state.player.x + state.player.w/2, state.player.y + state.player.h/2, 18);
        if (state.player.lives <= 0) {
          state.player.alive = false;
          state.gameOver = true;
        }
        break;
      }
    }
  }

  // beams aging & simple capture handling
  for (let i = state.beams.length - 1; i >= 0; i--) {
    const b = state.beams[i];
    b.life -= dt;

    // find the enemy that fired this beam
    const captor = state.enemies.find(en => en.id === b.enemyId);

    // beam intersects player -> capture
    if (!state.player.captured && state.player.alive && captor && b.active) {
      // simple horizontal overlap check using beam width
      const bx = captor.x + captor.w / 2 - (CFG.beamWidth/2);
      const bw = CFG.beamWidth;
      const py = state.player.y;
      if (state.player.x + state.player.w > bx && state.player.x < bx + bw && state.player.y > captor.y) {
        state.player.captured = true;
        state.player.captureT = 0;
        state.captorId = captor.id;
        b.active = false; // beam has latched
      }
    }

    // while captured, pull player toward lock Y
    if (state.player.captured && state.captorId) {
      // if captor no longer exists, release
      const cap = state.enemies.find(en => en.id === state.captorId);
      if (!cap) {
        state.player.captured = false;
        state.captorId = null;
      } else {
        // pull player up toward capture lock Y
        const lockY = CFG.capturedLockY || CFG.capturedLockY;
        const targetY = lockY;
        if (state.player.y > targetY) {
          state.player.y = Math.max(targetY, state.player.y - CFG.beamPullSpeed * dt);
        }
        state.player.captureT += dt;
      }
    }

    if (b.life <= 0) state.beams.splice(i, 1);
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
  if (!state.gameOver && state.enemies.length === 0) spawnWave(state);
}

function aabb(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}
