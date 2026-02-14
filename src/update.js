import { CFG, PLAYER_SPEED, BULLET_SPEED, ENEMY_BULLET_SPEED, FIRE_COOLDOWN, ENEMY_FIRE_CHANCE, HIT_FLASH, STAR_COUNT } from './cfg.js';
import { bezier3, buildWavePaths, makeDivePath } from './paths.js';
import { makeEnemy, formationSlot } from './entities.js';

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
  state.player.captured = false;
  state.player.captureT = 0;
  state.captorId = null;
  state.beams.length = 0;
  state.beamReserved = {};

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
  // always tick the fire cooldown so the player can fire immediately after release
  state.player.fireCd = Math.max(0, state.player.fireCd - dt);

  if (!state.gameOver && state.player.alive && !state.player.captured) {
    const left  = keys.has('arrowleft') || keys.has('a');
    const right = keys.has('arrowright') || keys.has('d');
    const fire  = keys.has(' ');

    if (left)  state.player.x -= PLAYER_SPEED * dt;
    if (right) state.player.x += PLAYER_SPEED * dt;
    state.player.x = clamp(state.player.x, 6, state.VIEW_W - state.player.w - 6);

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
      } else {
        // respawn position and clear capture/beam state so player can move
        state.player.x = state.VIEW_W / 2 - 6;
        state.player.y = state.VIEW_H - 28;
        state.player.captured = false;
        state.player.captureT = 0;
        state.captorId = null;
        state.beams.length = 0;
        state.beamReserved = {};
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
        // if this return was from a beam, clear captor reservation now
        if (e.returningFromBeam) {
          e.returningFromBeam = false;
          // release captor reservation
          if (state.captorId === e.id) state.captorId = null;
        }
        delete e.beamPath;
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

      if (!state.gameOver && state.player.alive) {
        const chance = ENEMY_FIRE_CHANCE * dt * 60;
        if (Math.random() < chance) {
          const dx = (state.player.x + state.player.w/2) - (e.x + e.w/2);
          if (Math.abs(dx) < 40) {
            state.ebullets.push({ x: e.x + e.w/2 - 1, y: e.y + e.h, w: 2, h: 6, vy: ENEMY_BULLET_SPEED });
          }
        }

        // Boss beam attack (capture) - only if no current captor
        if (e.kind === 'boss' && !state.captorId && Math.random() < (CFG.beamChance || 0) * dt * 60) {
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
        } else {
          // respawn position and clear capture/beam state so player can move
          state.player.x = state.VIEW_W / 2 - 6;
          state.player.y = state.VIEW_H - 28;
          state.player.captured = false;
          state.player.captureT = 0;
          state.captorId = null;
          state.beams.length = 0;
          state.beamReserved = {};
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

    // beam behavior: extend toward player; captor dives down; if cone touches player -> capture
    if (captor && b.phase === 'extend') {
      // extend beam length
      b.len = Math.min(b.maxLen, b.len + (CFG.beamPullSpeed || 90) * dt);
      // lock captor to fixedY if available to avoid jitter
      if (captor.beaming && typeof captor.fixedY === 'number') {
        captor.y = captor.fixedY;
      }

      // if beam reached full length, mark it full and begin life countdown
      if (!b.full && b.len >= b.maxLen) {
        b.full = true;
        b.life = CFG.beamDuration || 3.0; // start timeout from full size
      }

      // cone half-width grows with length
      const dy = (state.player.y + state.player.h/2) - (captor.y + captor.h);
      if (dy > 0 && dy <= b.len && !state.player.captured && state.player.alive) {
        const dx = (state.player.x + state.player.w/2) - (captor.x + captor.w/2);
        const baseHalf = (CFG.beamWidth || 10) / 2;
        const coneExtra = CFG.beamConeSpread || 60;
        const halfAtDy = baseHalf + (dy / b.maxLen) * coneExtra;
        if (Math.abs(dx) <= halfAtDy) {
          // player touched by cone -> capture; snap player immediately behind captor
          state.player.captured = true;
          state.player.captureT = 0;
          state.captorId = captor.id;
          state.player.x = Math.round(captor.x + captor.w / 2 - state.player.w / 2);
          state.player.y = Math.round(captor.y - state.player.h - 2);
          b.phase = 'latched';
          b.active = false;
        }
      }
    }

    // while captured, lock player to captor position
    if (state.player.captured && state.captorId) {
      const cap = state.enemies.find(en => en.id === state.captorId);
      if (!cap) {
        state.player.captured = false;
        state.captorId = null;
      } else {
        state.player.x = Math.round(cap.x + cap.w / 2 - state.player.w / 2);
        state.player.y = Math.round(cap.y - state.player.h - 2);
        state.player.captureT += dt;
      }
    }

    if (b.full && b.life <= 0) {
      // when beam full-time ends, set up captor to return along mirrored path
      if (captor) {
        captor.beaming = false;
        // build a return path by reversing the beamPath segments (if available)
        if (captor.beamPath && captor.beamPath.length) {
          const ret = captor.beamPath.slice().reverse().map(s => ({
            p0: s.p3,
            p1: s.p2,
            p2: s.p1,
            p3: s.p0
          }));
          // compute lengths and durations
          for (const s of ret) s._len = segLength(s);
          const speed = CFG.beamDiveSpeed || 90;
          captor.path = ret;
          captor.mode = 'return';
          captor.segIdx = 0;
          captor.t = 0;
          captor.segDurs = captor.path.map(s => Math.max(0.06, (s._len || 20) / speed));
          captor.segDur = captor.segDurs[0];
          captor.returningFromBeam = true;
        } else {
          // fallback: snap back
          if (typeof captor.beamOrigY === 'number') {
            captor.y = captor.beamOrigY;
            delete captor.beamOrigY;
            delete captor.beamTargetY;
          }
          if (state.player.captured && state.captorId === captor.id) {
            state.player.captured = false;
            state.captorId = null;
          }
        }
      }

      // clear any reservation for this beam id
      if (state.beamReserved && state.beamReserved[b.id]) {
        delete state.beamReserved[b.id];
      }
      // do not clear state.captorId here; it will be cleared when return completes
      state.beams.splice(i, 1);
    } else if (!b.full && b.phase === 'extend' && b.len >= b.maxLen) {
      // ensure full flag if we reached full length but life wasn't set (safety)
      b.full = true;
      b.life = CFG.beamDuration || 3.0;
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
  if (!state.gameOver && state.enemies.length === 0) spawnWave(state);
}

function aabb(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}
