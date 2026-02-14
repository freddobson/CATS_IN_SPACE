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

function drawShip(ctx, x, y) {
  ctx.fillRect(x + 5, y + 0, 2, 2);
  ctx.fillRect(x + 4, y + 2, 4, 2);
  ctx.fillRect(x + 2, y + 4, 8, 2);
  ctx.fillRect(x + 0, y + 6, 12, 2);
  ctx.fillRect(x + 3, y + 8, 6, 2);
}

function drawEnemy(ctx, e) {
  const x = Math.floor(e.x), y = Math.floor(e.y);
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

export function render(state, ctx, VIEW_W, VIEW_H) {
  beginView(ctx, VIEW_W, VIEW_H);

  // bg
  ctx.fillStyle = "#05060f";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // stars
  ctx.fillStyle = "#ffffff";
  for (const s of state.stars) ctx.fillRect(s.x | 0, s.y | 0, s.r, s.r);

  // bullets
  ctx.fillStyle = "#7CFF6B";
  for (const b of state.bullets) ctx.fillRect(b.x | 0, b.y | 0, b.w, b.h);

  ctx.fillStyle = "#ff5a7a";
  for (const b of state.ebullets) ctx.fillRect(b.x | 0, b.y | 0, b.w, b.h);

  // enemies
  for (const e of state.enemies) {
    ctx.fillStyle = e.flash > 0 ? "#ffffff" : (e.kind === "boss" ? "#ffd14a" : "#6db6ff");
    drawEnemy(ctx, e);
  }

  // player
  if (state.player.alive) {
    ctx.fillStyle = state.player.flash > 0 ? "#ffffff" : "#7CFF6B";
    drawShip(ctx, state.player.x | 0, state.player.y | 0);
  }

  // explosions
  ctx.fillStyle = "#ffffff";
  for (const p of state.explosions) ctx.fillRect(p.x | 0, p.y | 0, 2, 2);

  // HUD
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(6, 6, 112, 18);
  ctx.fillStyle = "#ffffff";
  ctx.font = "10px monospace";
  ctx.fillText(`SCORE ${state.player.score}   LIVES ${state.player.lives}`, 10, 18);

  if (state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.fillText("GAME OVER", VIEW_W/2 - 36, VIEW_H/2 - 6);
    ctx.font = "10px monospace";
    ctx.fillText("PRESS ENTER", VIEW_W/2 - 42, VIEW_H/2 + 12);
  }

  endView(ctx);
}
