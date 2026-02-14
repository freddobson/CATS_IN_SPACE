// Galaga-ish shooter core (client-only) with Bezier path enemies.
// Controls: Arrow keys / A,D to move. Space to fire. Enter to restart on game over.

import { CFG, PLAYER_SPEED, BULLET_SPEED, ENEMY_BULLET_SPEED, FIRE_COOLDOWN, ENEMY_FIRE_CHANCE, HIT_FLASH, STAR_COUNT } from './src/cfg.js';

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false; // crisp pixels
}
window.addEventListener("resize", resize);
resize();

// -------------------- CONFIG --------------------
const VIEW_W = CFG.viewW || 224;     // arcade-ish
const VIEW_H = CFG.viewH || 288;
const TILE = CFG.tile || 1;         // keep 1; we scale output to screen


// -------------------- INPUT --------------------
const keys = new Set();
addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// -------------------- UTIL --------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function aabb(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

// Cubic Bezier (0..1)
function bezier3(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t, uu = u * u;
  const uuu = uu * u, ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

// -------------------- RENDER SCALE (letterbox) --------------------
function beginView() {
  const s = Math.max(1, Math.floor(Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H)));
  const outW = VIEW_W * s;
  const outH = VIEW_H * s;
  const offX = (canvas.width - outW) / 2;
  const offY = (canvas.height - outH) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(s, s);

  return { s, offX, offY };
}
function endView() { ctx.restore(); }

// -------------------- GAME STATE --------------------
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
  lives: 3,
  score: 0,
  fireCd: 0,
  flash: 0,
};

let gameOver = false;

const bullets = [];       // player bullets
const ebullets = [];      // enemy bullets
const enemies = [];       // all enemies, including those “in formation” and “in flight”
const explosions = [];    // simple particles

// formation slots (like Galaga grid)
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

// -------------------- ENEMY PATHS --------------------
// Hook: put your existing Bezier/param flight patterns here.
// Each "path" is an array of cubic segments: [{p0,p1,p2,p3}, ...]
// Coordinates are in VIEW space.
function buildWavePaths() {
  const leftEntry = (slotX, slotY) => ([
    {
      p0: { x: -20, y: -10 },
      p1: { x: 20,  y: 20 },
      p2: { x: 50,  y: 90 },
      p3: { x: slotX, y: slotY }
    }
  ]);

  const rightEntry = (slotX, slotY) => ([
    {
      p0: { x: VIEW_W + 20, y: -10 },
      p1: { x: VIEW_W - 20, y: 20 },
      p2: { x: VIEW_W - 60, y: 90 },
      p3: { x: slotX, y: slotY }
    }
  ]);

  const loopThenSlot = (slotX, slotY, fromLeft = true) => {
    const startX = fromLeft ? -20 : VIEW_W + 20;
    const midX = fromLeft ? 40 : VIEW_W - 40;
    const loopX = fromLeft ? 70 : VIEW_W - 70;
    return [
      {
        p0: { x: startX, y: 10 },
        p1: { x: midX,   y: 30 },
        p2: { x: loopX,  y: 70 },
        p3: { x: loopX,  y: 105 }
      },
      {
        p0: { x: loopX,  y: 105 },
        p1: { x: loopX + (fromLeft ? 60 : -60), y: 120 },
        p2: { x: loopX + (fromLeft ? 60 : -60), y: 70  },
        p3: { x: loopX,  y: 85 }
      },
      {
        p0: { x: loopX,  y: 85 },
        p1: { x: loopX,  y: 130 },
        p2: { x: slotX,  y: 130 },
        p3: { x: slotX,  y: slotY }
      }
    ];
  };

  return { leftEntry, rightEntry, loopThenSlot };
}

// -------------------- SPAWNING --------------------
function formationSlot(col, row) {
  const x = formation.originX + (col - (formation.cols - 1) / 2) * formation.dx;
  const y = formation.originY + row * formation.dy;
  return { x, y };
}

function spawnWave() {
  const paths = buildWavePaths();

  // Example wave: a few rows, mix of entries and loops
  const plan = [
    // row 0
    { col: 3, row: 0, kind: "bee",  path: "left"  },
    { col: 6, row: 0, kind: "bee",  path: "right" },
    // row 1
    { col: 2, row: 1, kind: "bee",  path: "loopL" },
    { col: 7, row: 1, kind: "bee",  path: "loopR" },
    // row 2
    { col: 4, row: 2, kind: "boss", path: "loopL" },
    { col: 5, row: 2, kind: "boss", path: "loopR" },
  ];

  let delay = 0;
  for (const item of plan) {
    const slot = formationSlot(item.col, item.row);

    let segs;
    if (item.path === "left")  segs = paths.leftEntry(slot.x, slot.y);
    if (item.path === "right") segs = paths.rightEntry(slot.x, slot.y);
    if (item.path === "loopL") segs = paths.loopThenSlot(slot.x, slot.y, true);
    if (item.path === "loopR") segs = paths.loopThenSlot(slot.x, slot.y, false);

    enemies.push(makeEnemy({
      kind: item.kind,
      slotCol: item.col,
      slotRow: item.row,
      slotX: slot.x,
      slotY: slot.y,
      pathSegs: segs,
      spawnDelay: delay,
    }));

    delay += 0.22; // stagger entrants
  }
}

function makeEnemy({ kind, slotCol, slotRow, slotX, slotY, pathSegs, spawnDelay }) {
  const isBoss = kind === "boss";
  return {
    kind,
    x: slotX, y: slotY,
    w: isBoss ? 14 : 12,
    h: isBoss ? 12 : 10,
    hp: isBoss ? 2 : 1,
    score: isBoss ? 150 : 50,

    // flight path state
    mode: "spawning", // spawning -> path -> formation
    spawnDelay,
    path: pathSegs,
    segIdx: 0,
    t: 0,                // segment t
    segDur: 1.0,         // seconds per segment (t advances by dt/segDur)
    arrived: false,

    // formation position
    slotCol, slotRow,
    slotX, slotY,
    flash: 0,
  };
}

// -------------------- FX --------------------
function boom(x, y, n = 10) {
  for (let i = 0; i < n; i++) {
    explosions.push({
      x, y,
      vx: rand(-70, 70),
      vy: rand(-90, 30),
      life: rand(0.25, 0.5),
    });
  }
}

// -------------------- RESET --------------------
function resetGame() {
  bullets.length = 0;
  ebullets.length = 0;
  enemies.length = 0;
  explosions.length = 0;

  player.x = VIEW_W / 2 - 6;
  player.y = VIEW_H - 28;
  player.alive = true;
  player.lives = 3;
  player.score = 0;
  player.fireCd = 0;
  player.flash = 0;

  gameOver = false;

  spawnWave();
}
resetGame();

// -------------------- UPDATE --------------------
let last = performance.now();

function update(dt) {
  // restart
  if (gameOver && keys.has("enter")) resetGame();

  // stars
  for (const s of stars) {
    s.y += s.v * dt;
    if (s.y > VIEW_H) { s.y = 0; s.x = rand(0, VIEW_W); }
  }

  // formation sway
  formation.swayT += dt * formation.swaySpeed;
  const sway = Math.sin(formation.swayT * Math.PI * 2) * formation.swayAmp;

  // player
  if (!gameOver && player.alive) {
    const left  = keys.has("arrowleft") || keys.has("a");
    const right = keys.has("arrowright") || keys.has("d");
    const fire  = keys.has(" ");

    if (left)  player.x -= PLAYER_SPEED * dt;
    if (right) player.x += PLAYER_SPEED * dt;
    player.x = clamp(player.x, 6, VIEW_W - player.w - 6);

    player.fireCd = Math.max(0, player.fireCd - dt);
    if (fire && player.fireCd <= 0) {
      bullets.push({ x: player.x + player.w/2 - 1, y: player.y - 6, w: 2, h: 6, vy: -BULLET_SPEED });
      player.fireCd = FIRE_COOLDOWN;
    }
  }
  player.flash = Math.max(0, player.flash - dt);

  // player bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.y += b.vy * dt;
    if (b.y < -20) bullets.splice(i, 1);
  }

  // enemy bullets
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i];
    b.y += b.vy * dt;
    if (b.y > VIEW_H + 20) ebullets.splice(i, 1);
  }

  // enemies
  for (const e of enemies) {
    e.flash = Math.max(0, e.flash - dt);

    if (e.mode === "spawning") {
      e.spawnDelay -= dt;
      if (e.spawnDelay <= 0) e.mode = "path";
      continue;
    }

    if (e.mode === "path") {
      // Move along cubic segments; snap into formation at end.
      const seg = e.path[e.segIdx];
      e.t += dt / e.segDur;

      if (e.t >= 1) {
        e.t = 0;
        e.segIdx++;
        if (e.segIdx >= e.path.length) {
          e.mode = "formation";
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

    if (e.mode === "formation") {
      // stay in slot + sway
      const base = formationSlot(e.slotCol, e.slotRow);
      e.slotX = base.x;
      e.slotY = base.y;
      e.x = e.slotX + sway;
      e.y = e.slotY;

      // occasional fire
      if (!gameOver && player.alive) {
        // dt-scaled chance
        const chance = ENEMY_FIRE_CHANCE * dt * 60; // roughly stable across fps
        if (Math.random() < chance) {
          // only if roughly above player (simple “line-of-fire” bias)
          const dx = (player.x + player.w/2) - (e.x + e.w/2);
          if (Math.abs(dx) < 40) {
            ebullets.push({ x: e.x + e.w/2 - 1, y: e.y + e.h, w: 2, h: 6, vy: ENEMY_BULLET_SPEED });
          }
        }
      }
    }
  }

  // collisions: player bullets -> enemies
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    let hit = false;

    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (e.mode === "spawning") continue;

      if (aabb(b, e)) {
        hit = true;
        e.hp--;
        e.flash = HIT_FLASH;
        if (e.hp <= 0) {
          player.score += e.score;
          boom(e.x + e.w/2, e.y + e.h/2, e.kind === "boss" ? 14 : 10);
          enemies.splice(ei, 1);
        }
        break;
      }
    }

    if (hit) bullets.splice(bi, 1);
  }

  // collisions: enemy bullets -> player
  if (!gameOver && player.alive) {
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      if (aabb(b, player)) {
        ebullets.splice(i, 1);
        player.flash = 0.25;
        player.lives--;
        boom(player.x + player.w/2, player.y + player.h/2, 18);
        if (player.lives <= 0) {
          player.alive = false;
          gameOver = true;
        }
        break;
      }
    }
  }

  // explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    const p = explosions[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 120 * dt;
    if (p.life <= 0) explosions.splice(i, 1);
  }

  // wave refill if empty
  if (!gameOver && enemies.length === 0) spawnWave();
}

// -------------------- DRAW --------------------
function drawShip(x, y) {
  // simple “sprite” as pixels/rects (replace later with real spritesheet)
  ctx.fillRect(x + 5, y + 0, 2, 2);
  ctx.fillRect(x + 4, y + 2, 4, 2);
  ctx.fillRect(x + 2, y + 4, 8, 2);
  ctx.fillRect(x + 0, y + 6, 12, 2);
  ctx.fillRect(x + 3, y + 8, 6, 2);
}
function drawEnemy(e) {
  const x = Math.floor(e.x), y = Math.floor(e.y);
  // bee-ish / boss-ish blocks
  if (e.kind === "boss") {
    ctx.fillRect(x + 2, y + 1, 10, 2);
    ctx.fillRect(x + 1, y + 3, 12, 3);
    ctx.fillRect(x + 3, y + 6, 8, 3);
    ctx.fillRect(x + 5, y + 9, 4, 2);
  } else {
    ctx.fillRect(x + 3, y + 1, 6, 2);
    ctx.fillRect(x + 2, y + 3, 8, 3);
    ctx.fillRect(x + 4, y + 6, 4, 3);
  }
}

function render() {
  beginView();

  // bg
  ctx.fillStyle = "#05060f";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // stars
  ctx.fillStyle = "#ffffff";
  for (const s of stars) ctx.fillRect(s.x | 0, s.y | 0, s.r, s.r);

  // bullets
  ctx.fillStyle = "#7CFF6B";
  for (const b of bullets) ctx.fillRect(b.x | 0, b.y | 0, b.w, b.h);

  ctx.fillStyle = "#ff5a7a";
  for (const b of ebullets) ctx.fillRect(b.x | 0, b.y | 0, b.w, b.h);

  // enemies
  for (const e of enemies) {
    ctx.fillStyle = e.flash > 0 ? "#ffffff" : (e.kind === "boss" ? "#ffd14a" : "#6db6ff");
    drawEnemy(e);
  }

  // player
  if (player.alive) {
    ctx.fillStyle = player.flash > 0 ? "#ffffff" : "#7CFF6B";
    drawShip(player.x | 0, player.y | 0);
  }

  // explosions
  ctx.fillStyle = "#ffffff";
  for (const p of explosions) ctx.fillRect(p.x | 0, p.y | 0, 2, 2);

  // HUD
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(6, 6, 112, 18);
  ctx.fillStyle = "#ffffff";
  ctx.font = "10px monospace";
  ctx.fillText(`SCORE ${player.score}   LIVES ${player.lives}`, 10, 18);

  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.fillText("GAME OVER", VIEW_W/2 - 36, VIEW_H/2 - 6);
    ctx.font = "10px monospace";
    ctx.fillText("PRESS ENTER", VIEW_W/2 - 42, VIEW_H/2 + 12);
  }

  endView();
}

// -------------------- LOOP --------------------
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
