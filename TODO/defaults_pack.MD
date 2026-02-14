# Defaults Pack
Here’s a clean tweakable defaults pack you can drop straight into the shooter.
Replace your current CONFIG + buildWavePaths() with this.

## Getting Started
1. Central tweak block (the fun knobs)

// -------------------- TWEAKABLE GAME FEEL --------------------
```
const CFG = {
  // player
  playerSpeed: 140,
  fireCooldown: 0.16,
  lives: 3,

  // bullets
  bulletSpeed: 280,
  enemyBulletSpeed: 180,
  enemyFireRate: 0.02,   // higher = more bullets

  // enemies
  beeHP: 1,
  bossHP: 3,
  beeScore: 60,
  bossScore: 200,

  // formation sway
  swayAmp: 12,
  swaySpeed: 0.7,

  // bezier timing
  segDuration: 0.9,      // seconds per curve segment
  spawnStagger: 0.20,    // delay between enemies

  // difficulty ramp
  waveFireBonus: 0.004,  // added each cleared wave
};
```

2. Then change your constants to:
```
const PLAYER_SPEED = CFG.playerSpeed;
const BULLET_SPEED = CFG.bulletSpeed;
const ENEMY_BULLET_SPEED = CFG.enemyBulletSpeed;
const FIRE_COOLDOWN = CFG.fireCooldown;
const ENEMY_FIRE_CHANCE = CFG.enemyFireRate;
```

3. And in resetGame():
```
player.lives = CFG.lives;
```

4. And enemy creation:
```
hp: isBoss ? CFG.bossHP : CFG.beeHP,
score: isBoss ? CFG.bossScore : CFG.beeScore,
segDur: CFG.segDuration,
```

5. Formation sway:
formation.swayAmp = CFG.swayAmp;
formation.swaySpeed = CFG.swaySpeed;


## Default Bezier flight patterns (easy to tweak)

1. Replace buildWavePaths() with:
```
function buildWavePaths() {

  // wide swoop from left
  function leftSwoop(slotX, slotY) {
    return [{
      p0: { x: -30, y: -20 },
      p1: { x: 40,  y: 40 },
      p2: { x: 70,  y: 120 },
      p3: { x: slotX, y: slotY }
    }];
  }

  // mirrored from right
  function rightSwoop(slotX, slotY) {
    return [{
      p0: { x: VIEW_W + 30, y: -20 },
      p1: { x: VIEW_W - 40, y: 40 },
      p2: { x: VIEW_W - 70, y: 120 },
      p3: { x: slotX, y: slotY }
    }];
  }
  ```

  2. classic Galaga-style loop then dock
```  
  function loopDock(slotX, slotY, fromLeft = true) {

    const dir = fromLeft ? 1 : -1;
    const edge = fromLeft ? -20 : VIEW_W + 20;
    const mid  = fromLeft ? 60  : VIEW_W - 60;

    return [

      // entry curve
      {
        p0: { x: edge, y: 10 },
        p1: { x: mid,  y: 30 },
        p2: { x: mid,  y: 90 },
        p3: { x: mid,  y: 120 }
      },

      // vertical loop
      {
        p0: { x: mid, y: 120 },
        p1: { x: mid + 70 * dir, y: 140 },
        p2: { x: mid + 70 * dir, y: 60 },
        p3: { x: mid, y: 80 }
      },

      // settle into formation
      {
        p0: { x: mid,  y: 80 },
        p1: { x: mid,  y: 140 },
        p2: { x: slotX, y: 140 },
        p3: { x: slotX, y: slotY }
      }
    ];
  }

  return { leftSwoop, rightSwoop, loopDock };
}
```

3. Wave difficulty scaling (tiny but powerful)
```
// Add near top level:
let wave = 1;

// Update spawnWave() start:
const fireBoost = (wave - 1) * CFG.waveFireBonus;

// And when enemies shoot:
const chance = (ENEMY_FIRE_CHANCE + fireBoost) * dt * 60;

// After clearing wave:
if (!gameOver && enemies.length === 0) {
  wave++;
  spawnWave();
}
```
That gives you:
- Real Galaga-style curves
- Central tuning panel
- Difficulty ramp
- All numbers easy to tweak


## Timed “pick an enemy in formation → dive toward player → return to slot”
Bezier dive paths with tweak knobs
1. Add these knobs to CFG:
```
  // dive attacks
  diveEvery: 2.2,          // seconds between dive attempts
  diveChance: 0.65,        // chance that an attempt actually launches
  diveMaxActive: 2,        // max simultaneous divers
  diveSegDuration: 0.45,   // sec per dive segment
  diveExitY: 330,          // how far down they dive (past bottom is fine)
  diveLead: 0.25,          // how much to lead player X (0..1)
```

2. Add state (near let gameOver = false;)
```
let diveTimer = 0;
```
3. Add helpers (near your other util fns)
```
function countDivers() {
  let n = 0;
  for (const e of enemies) if (e.mode === "dive" || e.mode === "return") n++;
  return n;
}

function pickDiver() {
  // prefer bees first; fall back to any in formation
  const inForm = enemies.filter(e => e.mode === "formation");
  if (inForm.length === 0) return null;

  const bees = inForm.filter(e => e.kind !== "boss");
  const pool = bees.length ? bees : inForm;
  return pool[(Math.random() * pool.length) | 0];
}

function makeDivePath(e) {
  // start at current formation pos
  const p0 = { x: e.x + e.w/2, y: e.y + e.h/2 };

  // aim near player, with slight lead
  const px = player.x + player.w/2;
  const leadX = (px - p0.x) * CFG.diveLead;
  const targetX = clamp(px + leadX, 12, VIEW_W - 12);

  // dive "down" beyond screen
  const p3 = { x: targetX, y: CFG.diveExitY };

  // control points: arc + tighten toward player
  const p1 = { x: clamp(p0.x + rand(-40, 40), 0, VIEW_W), y: p0.y + rand(30, 60) };
  const p2 = { x: clamp(targetX + rand(-25, 25), 0, VIEW_W), y: p0.y + rand(110, 160) };

  // return back to slot (soft S-curve)
  const slot = { x: e.slotX, y: e.slotY };
  const r0 = { x: p3.x, y: p3.y };
  const r3 = { x: slot.x, y: slot.y };
  const r1 = { x: clamp(p3.x + rand(-60, 60), 0, VIEW_W), y: p3.y - rand(80, 120) };
  const r2 = { x: clamp(slot.x + rand(-60, 60), 0, VIEW_W), y: slot.y + rand(60, 110) };

  return {
    dive: [{ p0, p1, p2, p3 }],
    ret:  [{ p0: r0, p1: r1, p2: r2, p3: r3 }],
  };
}
```

4. Launch logic (inside update(dt) after formation sway, before enemy loop is fine)
```
if (!gameOver && player.alive) {
  diveTimer -= dt;
  if (diveTimer <= 0) {
    diveTimer = CFG.diveEvery;

    if (countDivers() < CFG.diveMaxActive && Math.random() < CFG.diveChance) {
      const e = pickDiver();
      if (e) {
        const paths = makeDivePath(e);
        e.mode = "dive";
        e.path = paths.dive;
        e.segIdx = 0;
        e.t = 0;
        e.segDur = CFG.diveSegDuration;
        e._returnPath = paths.ret; // stash return
      }
    }
  }
}
```

5. Enemy mode handling (modify your enemy update block)
```
// Find your enemy loop that handles spawning, path, formation. Add two more modes:
if (e.mode === "dive") {
  const segNow = e.path[e.segIdx];
  e.t += dt / e.segDur;

  if (e.t >= 1) {
    // finished dive: switch to return
    e.mode = "return";
    e.path = e._returnPath;
    e.segIdx = 0;
    e.t = 0;
    e.segDur = CFG.diveSegDuration;
  } else {
    const p = bezier3(segNow.p0, segNow.p1, segNow.p2, segNow.p3, clamp(e.t, 0, 1));
    e.x = p.x - e.w/2;
    e.y = p.y - e.h/2;
  }

  // optional: divers fire more
  if (!gameOver && player.alive) {
    const chance = (ENEMY_FIRE_CHANCE * 2.2) * dt * 60;
    if (Math.random() < chance) {
      ebullets.push({ x: e.x + e.w/2 - 1, y: e.y + e.h, w: 2, h: 6, vy: ENEMY_BULLET_SPEED });
    }
  }
}

if (e.mode === "return") {
  const segNow = e.path[e.segIdx];
  e.t += dt / e.segDur;

  if (e.t >= 1) {
    // snap back into formation
    e.mode = "formation";
    e.t = 0;
    e.segIdx = 0;
    delete e._returnPath;
  } else {
    const p = bezier3(segNow.p0, segNow.p1, segNow.p2, segNow.p3, clamp(e.t, 0, 1));
    e.x = p.x - e.w/2;
    e.y = p.y - e.h/2;
  }
}

/* Important: Put these dive/return blocks before your formation block (so formation doesn’t overwrite their positions).
```
Good first tweaks
- More frequent dives: diveEvery: 1.4
- Scarier dives: diveMaxActive: 3, diveChance: 0.85
- More “Galaga snap”: lower diveSegDuration (faster), increase diveExitY */


## Drop-in: dive path generator (defaults)
1. Paste this as-is (it assumes you already have bezier3, clamp, rand, VIEW_W, player, and CFG).
```
--- DEFAULT DIVE PATTERN (no prior bezier work needed) ---
// Produces 2 segments: dive (2 cubics) + return (1 cubic)

function makeDivePath(e) {
  // start at enemy center
  const sx = e.x + e.w / 2;
  const sy = e.y + e.h / 2;

  // target near player with slight lead
  const px = player.x + player.w / 2;
  const lead = (px - sx) * CFG.diveLead;                 // 0..1
  const tx = clamp(px + lead, 12, VIEW_W - 12);

  // tweak knobs
  const entryDx = CFG.diveEntryDx;       // sideways swoop amount
  const hookDx  = CFG.diveHookDx;        // how hard it hooks toward player
  const y1 = sy + CFG.diveY1;
  const y2 = sy + CFG.diveY2;
  const exitY = CFG.diveExitY;

  // choose left/right swoop based on which side of screen enemy is on
  const dir = (sx < VIEW_W / 2) ? 1 : -1;

  // Segment A: swoop down + inward
  const a0 = { x: sx,                 y: sy };
  const a1 = { x: sx + dir*entryDx,   y: sy + 10 };
  const a2 = { x: sx + dir*entryDx,   y: y1 };
  const a3 = { x: sx + dir*(entryDx*0.5), y: y1 + 20 };

  // Segment B: hook toward player + exit past bottom
  const b0 = a3;
  const b1 = { x: b0.x - dir*hookDx,  y: y2 - 20 };
  const b2 = { x: tx + rand(-12, 12), y: y2 + 20 };
  const b3 = { x: tx,                y: exitY };

  // Return: gentle curve back to formation slot
  const rx = e.slotX;
  const ry = e.slotY;

  const r0 = b3;
  const r1 = { x: clamp(tx + rand(-70, 70), 0, VIEW_W), y: exitY - 90 };
  const r2 = { x: clamp(rx + rand(-70, 70), 0, VIEW_W), y: ry + 90 };
  const r3 = { x: rx, y: ry };

  return {
    dive: [{ p0: a0, p1: a1, p2: a2, p3: a3 }, { p0: b0, p1: b1, p2: b2, p3: b3 }],
    ret:  [{ p0: r0, p1: r1, p2: r2, p3: r3 }],
  };
}
```
2. Add these default knobs to CFG
```
  // dive attacks
  diveEvery: 2.0,
  diveChance: 0.7,
  diveMaxActive: 2,
  diveSegDuration: 0.42,

  diveLead: 0.25,     // 0 = aim at current player x, 1 = full lead
  diveEntryDx: 48,    // initial sideways swoop
  diveHookDx: 70,     // how hard it hooks inward
  diveY1: 60,         // first swoop depth
  diveY2: 140,        // hook depth
  diveExitY: 330,     // how far down it goes (past VIEW_H is fine)
```
3. Minimal launch + mode handling (if you don’t already have it)
If you don’t have dive/return modes yet, paste this into your enemy update logic.
```
let diveTimer = 0;

function countDivers() {
  let n = 0;
  for (const e of enemies) if (e.mode === "dive" || e.mode === "return") n++;
  return n;
}
function pickDiver() {
  const inForm = enemies.filter(e => e.mode === "formation");
  if (!inForm.length) return null;
  return inForm[(Math.random() * inForm.length) | 0];
}

// in update(dt), before looping enemies:
if (!gameOver && player.alive) {
  diveTimer -= dt;
  if (diveTimer <= 0) {
    diveTimer = CFG.diveEvery;
    if (countDivers() < CFG.diveMaxActive && Math.random() < CFG.diveChance) {
      const e = pickDiver();
      if (e) {
        const paths = makeDivePath(e);
        e.mode = "dive";
        e.path = paths.dive;
        e._returnPath = paths.ret;
        e.segIdx = 0;
        e.t = 0;
        e.segDur = CFG.diveSegDuration;
      }
    }
  }
}

// inside enemy loop, handle dive/return BEFORE formation:
if (e.mode === "dive") {
  const seg = e.path[e.segIdx];
  e.t += dt / e.segDur;
  if (e.t >= 1) {
    e.t = 0;
    e.segIdx++;
    if (e.segIdx >= e.path.length) {
      e.mode = "return";
      e.path = e._returnPath;
      e.segIdx = 0;
    }
  }
  const cur = e.path[Math.min(e.segIdx, e.path.length - 1)];
  const p = bezier3(cur.p0, cur.p1, cur.p2, cur.p3, clamp(e.t, 0, 1));
  e.x = p.x - e.w/2; e.y = p.y - e.h/2;
}

if (e.mode === "return") {
  const cur = e.path[0];
  e.t += dt / e.segDur;
  if (e.t >= 1) {
    e.mode = "formation";
    e.t = 0; e.segIdx = 0;
    delete e._returnPath;
  } else {
    const p = bezier3(cur.p0, cur.p1, cur.p2, cur.p3, clamp(e.t, 0, 1));
    e.x = p.x - e.w/2; e.y = p.y - e.h/2;
  }
}
```

## loop swoop
loop-swoop is basically: peel out sideways → make a tight loop near top-mid → dive past player lane → re-dock.
Drop this in as your default loop-swoop dive generator.

1) CFG knobs (add/replace these)
```
// loop-swoop dive
diveEvery: 2.1,
diveChance: 0.75,
diveMaxActive: 2,
diveSegDuration: 0.40,

diveLead: 0.20,      // 0..1
loopDx: 60,          // loop width
loopTopDy: 18,       // loop "up" lift
loopDepthDy: 70,     // loop depth
peelDx: 40,          // initial sideways peel
exitY: 340,          // how far down they dive
returnBumpY: 110,    // return arc height
*/
```

2. Loop-swoop Bezier path (replace makeDivePath(e) with this)
```
function makeDivePath(e) {
  const sx = e.x + e.w / 2;
  const sy = e.y + e.h / 2;

  // player target (slight lead)
  const px = player.x + player.w / 2;
  const tx = clamp(px + (px - sx) * CFG.diveLead, 12, VIEW_W - 12);

  // choose loop direction by side (feels “Galaga”)
  const dir = (sx < VIEW_W / 2) ? 1 : -1;

  const peelX = sx + dir * CFG.peelDx;

  // Loop center-ish point (near upper third)
  const loopCx = clamp(sx + dir * (CFG.loopDx * 0.6), 24, VIEW_W - 24);
  const loopCy = sy + 30;

  // Segment A: peel out & down toward loop entry
  const a0 = { x: sx,    y: sy };
  const a1 = { x: peelX, y: sy + 10 };
  const a2 = { x: peelX, y: loopCy - 10 };
  const a3 = { x: loopCx, y: loopCy };

  // Segment B: top half of loop (up and across)
  const b0 = a3;
  const b1 = { x: loopCx + dir * CFG.loopDx, y: loopCy - CFG.loopTopDy };
  const b2 = { x: loopCx - dir * CFG.loopDx, y: loopCy - CFG.loopTopDy };
  const b3 = { x: loopCx, y: loopCy + (CFG.loopDepthDy * 0.45) };

  // Segment C: bottom half of loop into a dive lane
  const c0 = b3;
  const c1 = { x: loopCx + dir * CFG.loopDx, y: loopCy + CFG.loopDepthDy };
  const c2 = { x: tx,                     y: loopCy + CFG.loopDepthDy };
  const c3 = { x: tx,                     y: CFG.exitY };

  // Segment R: return to slot (gentle S)
  const rx = e.slotX;
  const ry = e.slotY;

  const r0 = c3;
  const r1 = { x: clamp(tx + rand(-70, 70), 0, VIEW_W), y: CFG.exitY - CFG.returnBumpY };
  const r2 = { x: clamp(rx + rand(-70, 70), 0, VIEW_W), y: ry + CFG.returnBumpY };
  const r3 = { x: rx, y: ry };

  return {
    dive: [
      { p0: a0, p1: a1, p2: a2, p3: a3 },
      { p0: b0, p1: b1, p2: b2, p3: b3 },
      { p0: c0, p1: c1, p2: c2, p3: c3 },
    ],
    ret: [
      { p0: r0, p1: r1, p2: r2, p3: r3 },
    ],
  };
}
```

## tiny bank/rotation add-on: compute the Bezier tangent, turn it into an angle, and draw the enemy rotated so it “faces” its motion.

1. Add these helpers (near bezier3)
```
function bezier3Tangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  // derivative of cubic bezier
  const dx =
    3 * u * u * (p1.x - p0.x) +
    6 * u * t * (p2.x - p1.x) +
    3 * t * t * (p3.x - p2.x);
  const dy =
    3 * u * u * (p1.y - p0.y) +
    6 * u * t * (p2.y - p1.y) +
    3 * t * t * (p3.y - p2.y);
  return { dx, dy };
}
```

2. When moving along a path, set e.ang
In your enemy update code, wherever you do:
```
const p = bezier3(...);
e.x = p.x - e.w/2;
e.y = p.y - e.h/2;
```

add this right after (for path, dive, and return modes):
```
const tan = bezier3Tangent(cur.p0, cur.p1, cur.p2, cur.p3, clamp(e.t, 0, 1));
e.ang = Math.atan2(tan.dy, tan.dx) + Math.PI / 2; // +90° so "up" is forward
```

Also initialize enemies with:
```
ang: 0,
```

3. Draw rotated enemies
Replace your drawEnemy(e) with this (keeps your blocky “sprite” but rotates it):
```
function drawEnemy(e) {
  const cx = Math.floor(e.x + e.w/2);
  const cy = Math.floor(e.y + e.h/2);

  ctx.save();
  ctx.translate(cx, cy);

  // optional: cap extreme spin a bit (feels more arcade)
  const a = e.ang ?? 0;
  ctx.rotate(a);

  // draw centered
  const x = -Math.floor(e.w/2);
  const y = -Math.floor(e.h/2);

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

  ctx.restore();
}
```

## formation wobble + dive roll, as small drop-ins.
1. Add knobs to CFG
rotation flavor
```
formWobbleAmp: 0.18,     // radians (~10°)
formWobbleSpeed: 2.2,    // Hz-ish feel
diveRollSpeed: 8.0,      // radians/sec (spin while diving)
diveRollDecay: 5.0,      // how fast roll stops on return
```

2. Add per-enemy rotation state
In makeEnemy(...), add:
```
ang: 0,
roll: 0,      // extra roll angle (used in dive)
wobT: Math.random() * 10, // per-enemy wobble offset
```

3. Update angles by mode
Where you currently set e.ang = atan2(...) + PI/2, keep doing that for path/dive/return, then layer these:
A) Formation wobble (inside if (e.mode === "formation") { ... })
Add:
```
e.wobT += dt * CFG.formWobbleSpeed * Math.PI * 2;
e.roll *= Math.exp(-CFG.diveRollDecay * dt); // bleed off any leftover roll
e.ang = Math.sin(e.wobT) * CFG.formWobbleAmp;
```
(So docked enemies gently “bob” without needing a tangent.)

B) Dive roll (inside if (e.mode === "dive") { ... })
After you compute tangent-based e.ang, add:
```
e.roll += CFG.diveRollSpeed * dt * (Math.random() < 0.5 ? 1 : -1); // pick a spin dir once-ish
e.ang += e.roll;
```
Better (stable spin direction): set e.rollDir once when dive starts.
Do this when launching a dive (where you set e.mode="dive"):
```
e.rollDir = Math.random() < 0.5 ? -1 : 1;
e.roll = 0;
```
Then in dive update:
```
e.roll += CFG.diveRollSpeed * dt * e.rollDir;
e.ang += e.roll;
```
C) Return (inside if (e.mode === "return") { ... })
After tangent-based e.ang, add:
```
e.roll *= Math.exp(-CFG.diveRollDecay * dt); // smooth unwind
e.ang += e.roll;
```
And when return finishes (switches to formation), you can clear:
```
e.roll = 0;
e.rollDir = 0;
```

## Group Dives (2-3 enemies)
1. Add knobs to CFG
```
// group dive
groupDiveChance: 0.55,     // when a dive triggers, chance it becomes a group
groupDiveSizeMin: 2,
groupDiveSizeMax: 3,
groupDiveXOffset: 14,      // spacing between divers
groupDiveDelay: 0.08,      // stagger within group
```
2. Add these helpers
```
function pickDiversForGroup() {
  const inForm = enemies.filter(e => e.mode === "formation");
  if (inForm.length < 2) return null;

  // prefer same row neighbors for that Galaga “pair peel”
  inForm.sort((a,b)=> (a.slotRow-b.slotRow) || (a.slotCol-b.slotCol));

  // pick a random seed in formation
  const seed = inForm[(Math.random() * inForm.length) | 0];
  const sameRow = inForm.filter(e => e.slotRow === seed.slotRow);

  // neighbors closest by column
  sameRow.sort((a,b)=>Math.abs(a.slotCol-seed.slotCol)-Math.abs(b.slotCol-seed.slotCol));

  const size = clamp(
    CFG.groupDiveSizeMin + ((Math.random()*(CFG.groupDiveSizeMax-CFG.groupDiveSizeMin+1))|0),
    2,
    Math.min(CFG.groupDiveSizeMax, sameRow.length)
  );

  return sameRow.slice(0, size);
}

// Deep copy a path and offset all points in X (so they fly “in formation” during dive)
function offsetPathX(pathSegs, dx) {
  return pathSegs.map(seg => ({
    p0: { x: seg.p0.x + dx, y: seg.p0.y },
    p1: { x: seg.p1.x + dx, y: seg.p1.y },
    p2: { x: seg.p2.x + dx, y: seg.p2.y },
    p3: { x: seg.p3.x + dx, y: seg.p3.y },
  }));
}

function launchDive(e, xOffset = 0, extraDelay = 0) {
  const paths = makeDivePath(e); // your loop-swoop generator
  e.mode = "dive";
  e.path = offsetPathX(paths.dive, xOffset);
  e._returnPath = offsetPathX(paths.ret, xOffset);
  e.segIdx = 0;
  e.t = 0;
  e.segDur = CFG.diveSegDuration;
  e.spawnDelay = extraDelay;     // reuse as “delay before moving”
  e.rollDir = Math.random() < 0.5 ? -1 : 1;
  e.roll = 0;
}
```

3. Modify your dive launch block
Where you currently do the “single diver” launch, replace that block with:
```
if (!gameOver && player.alive) {
  diveTimer -= dt;
  if (diveTimer <= 0) {
    diveTimer = CFG.diveEvery;

    if (countDivers() < CFG.diveMaxActive && Math.random() < CFG.diveChance) {

      const wantGroup = Math.random() < CFG.groupDiveChance;

      if (wantGroup) {
        const group = pickDiversForGroup();
        if (group && countDivers() + group.length <= CFG.diveMaxActive) {
          const mid = (group.length - 1) / 2;
          for (let i = 0; i < group.length; i++) {
            const e = group[i];
            const xOff = (i - mid) * CFG.groupDiveXOffset;
            const dly  = i * CFG.groupDiveDelay;
            launchDive(e, xOff, dly);
          }
          continue;
        }
      }

      // fallback: single
      const e = pickDiver();
      if (e) launchDive(e, 0, 0);
    }
  }
}
```

4. Tiny tweak to your dive/return update
At the top of your if (e.mode === "dive") { ... } block add:
```
if (e.spawnDelay > 0) { e.spawnDelay -= dt; return; }
```
Same for return if you want delayed returns too (optional).


## Boss capture beam
- This is a minimal capture mechanic:
- Only boss enemies can “beam”
- If beam hits player: player becomes captured (can’t shoot, pulled upward)
- After a short time, boss returns to formation, leaving player “stuck”

1. Add knobs to CFG
capture beam
```
beamChance: 0.12,        // per boss “attack attempt”
beamDuration: 1.2,       // seconds
beamWidth: 10,
beamPullSpeed: 90,       // px/sec pull upward
capturedLockY: 120,      // where the ship gets held
```

2. Add player capture state
Near player object:
```
player.captured = false;
player.captureT = 0;
```

3. Add beam storage
Near your arrays:
```
const beams = []; // { x, y0, y1, w, life, ownerId }
```

5. Give enemies IDs (once)
In makeEnemy(...) add:
```
id: (Math.random().toString(36).slice(2)),
```

6. Boss attack trigger (inside formation mode)
Inside your if (e.mode === "formation") { ... }, after sway/positioning, add:
```
if (!gameOver && player.alive && !player.captured && e.kind === "boss") {
  const chance = CFG.beamChance * dt * 60;
  if (Math.random() < chance) {
    // start a “beam attack”: boss does a short dive to align above player then beams
    const paths = makeDivePath(e); // reuse loop-swoop for entry
    e.mode = "beamDive";
    e.path = paths.dive.slice(0, 2); // just first 2 segments = peel + loop-ish
    e._returnPath = paths.ret;
    e.segIdx = 0;
    e.t = 0;
    e.segDur = CFG.diveSegDuration;
  }
}
```

6. Add new enemy modes: beamDive + beaming
Add these handlers (BEFORE formation) in your enemy loop:
```
if (e.mode === "beamDive") {
  const cur = e.path[Math.min(e.segIdx, e.path.length - 1)];
  e.t += dt / e.segDur;

  if (e.t >= 1) {
    e.t = 0;
    e.segIdx++;
    if (e.segIdx >= e.path.length) {
      e.mode = "beaming";
      e.beamT = CFG.beamDuration;
    }
  }

  const p = bezier3(cur.p0, cur.p1, cur.p2, cur.p3, clamp(e.t, 0, 1));
  e.x = p.x - e.w/2; e.y = p.y - e.h/2;

  const tan = bezier3Tangent(cur.p0, cur.p1, cur.p2, cur.p3, clamp(e.t, 0, 1));
  e.ang = Math.atan2(tan.dy, tan.dx) + Math.PI/2;
}

if (e.mode === "beaming") {
  e.beamT -= dt;

  // beam column under boss
  const bx = e.x + e.w/2;
  beams.push({
    x: bx,
    y0: e.y + e.h,
    y1: VIEW_H,
    w: CFG.beamWidth,
    life: 0.06,        // short-lived; re-added each frame while beaming
    ownerId: e.id
  });

  // capture check
  if (!player.captured) {
    const px = player.x + player.w/2;
    const inX = Math.abs(px - bx) <= CFG.beamWidth/2;
    const below = player.y > e.y + e.h;
    if (inX && below) {
      player.captured = true;
      player.captureT = 0;
    }
  }

  // while captured: pull player upward & disable shooting
  if (player.captured) {
    player.captureT += dt;
    player.y -= CFG.beamPullSpeed * dt;
    player.y = Math.max(CFG.capturedLockY, player.y);
    player.fireCd = 999; // effectively disables shooting while captured
  }

  // end beam -> boss returns
  if (e.beamT <= 0) {
    e.mode = "return";
    e.path = e._returnPath;
    e.segIdx = 0;
    e.t = 0;
    e.segDur = CFG.diveSegDuration;
    e.roll *= 0.2;
  }
}
```

7. Update beams & draw them
In update(dt) add beam aging:
```
for (let i = beams.length - 1; i >= 0; i--) {
  beams[i].life -= dt;
  if (beams[i].life <= 0) beams.splice(i, 1);
}
```

In render(), draw beams (before player is fine):
```
for (const b of beams) {
  ctx.fillStyle = "rgba(120, 210, 255, 0.35)";
  ctx.fillRect((b.x - b.w/2) | 0, b.y0 | 0, b.w | 0, (b.y1 - b.y0) | 0);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect((b.x - 1) | 0, b.y0 | 0, 2, (b.y1 - b.y0) | 0);
}
```

8. Player control tweak (so captured can’t move)
In player update:
```
if (!gameOver && player.alive && !player.captured) {
  // normal move + fire
}
```
And when you reset/respawn:
```
player.captured = false;
player.captureT = 0;
player.fireCd = 0;
```

## Rescue + Dual Fighter
What it does
- If you’re captured, a boss will “hold” you.
- Shoot that boss while it’s holding → rescued ship drops.
- Fly into the dropped ship → dual mode (2 shots, wider spread).
- Dual ends when you die (easy to change).

1. Add CFG Knobs
rescue + dual
```
rescueDropSpeed: 70,
rescueCatchRadius: 10,
dualShotSpacing: 6,
dualFireCooldownMul: 0.85,
dualScoreBonus: 200,
```

2. Add player state
Add to player:
```
captured: false,
dual: false,
```

When you reset:
```
player.captured = false;
player.dual = false;
```

3. Track “captor boss” + dropped ship
Near your arrays:
```
let captorId = null;        // boss id currently holding player
let rescueShip = null;      // {x,y,v}
```
Reset them:
```
captorId = null;
rescueShip = null;
```

4. Change capture beam to “hold” the player
In your beaming mode, where you set player.captured = true, also set:
```
captorId = e.id;
```
Also, when beam ends (boss switches to return), if player is captured, keep them captured and “stuck”:
```
if (e.beamT <= 0) {
  e.mode = "formation"; // or return if you prefer; formation is simpler for holding
  e.t = 0; e.segIdx = 0;
  // boss stays in formation but holds the ship
}
```
And in formation mode for a boss, if it’s the captor, position the captured ship under it:
```
if (player.captured && captorId === e.id) {
  player.x = (e.x + e.w/2) - player.w/2;
  player.y = CFG.capturedLockY;
}
```

5. Allow the player to shoot only if not captured
Where you handle player fire:
```
if (fire && player.fireCd <= 0 && !player.captured) {
  // ...
}
```

6. Dual-fire bullets
Replace your single-bullet spawn with:
```
if (fire && player.fireCd <= 0 && !player.captured) {
  if (!player.dual) {
    bullets.push({ x: player.x + player.w/2 - 1, y: player.y - 6, w: 2, h: 6, vy: -BULLET_SPEED });
    player.fireCd = FIRE_COOLDOWN;
  } else {
    const cx = player.x + player.w/2;
    bullets.push({ x: cx - CFG.dualShotSpacing - 1, y: player.y - 6, w: 2, h: 6, vy: -BULLET_SPEED });
    bullets.push({ x: cx + CFG.dualShotSpacing - 1, y: player.y - 6, w: 2, h: 6, vy: -BULLET_SPEED });
    player.fireCd = FIRE_COOLDOWN * CFG.dualFireCooldownMul;
  }
}
```

7. Rescue: shoot the captor boss to drop a ship
In your player bullet → enemy collision, when an enemy dies, add this right before you splice it:
```
if (e.hp <= 0) {
  // rescue trigger
  if (player.captured && e.id === captorId) {
    captorId = null;

    // spawn falling rescue ship at boss location
    rescueShip = {
      x: e.x + e.w/2,
      y: e.y + e.h,
      v: CFG.rescueDropSpeed
    };

    // release player into control (still single until you catch the drop)
    player.captured = false;
  }

  player.score += e.score;
  if (player.dual) player.score += 0; // optional
  boom(e.x + e.w/2, e.y + e.h/2, e.kind === "boss" ? 14 : 10);
  enemies.splice(ei, 1);
}
```

