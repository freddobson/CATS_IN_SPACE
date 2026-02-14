import { CFG } from './cfg.js';

const VIEW_W = CFG.viewW || 224;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Cubic Bezier (0..1)
export function bezier3(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t, uu = u * u;
  const uuu = uu * u, ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

// Build a few simple entry/loop wave paths (coordinates in VIEW space)
export function buildWavePaths() {
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

// Produce a two-segment dive and a single-segment return.
export function makeDivePath(e, player) {
  // start at enemy center
  const sx = e.x + e.w / 2;
  const sy = e.y + e.h / 2;
  // target near player with slight lead
  const px = player ? player.x + player.w / 2 : VIEW_W / 2;
  const lead = (px - sx) * CFG.diveLead;                 // 0..1
  const tx = clamp(px + lead, 12, VIEW_W - 12);

  const entryDx = CFG.diveEntryDx;
  const hookDx  = CFG.diveHookDx;
  const y1 = sy + CFG.diveY1;
  const y2 = sy + CFG.diveY2;
  const exitY = CFG.diveExitY;

  const dir = (sx < VIEW_W / 2) ? 1 : -1;

  const a0 = { x: sx,                 y: sy };
  const a1 = { x: sx + dir*entryDx,   y: sy + 10 };
  const a2 = { x: sx + dir*entryDx,   y: y1 };
  const a3 = { x: sx + dir*(entryDx*0.5), y: y1 + 20 };

  const b0 = a3;
  const b1 = { x: b0.x - dir*hookDx,  y: y2 - 20 };
  const b2 = { x: tx + rand(-12, 12), y: y2 + 20 };
  const b3 = { x: tx,                y: exitY };

  const rx = e.slotX;
  const ry = e.slotY;

  const r0 = b3;
  const r1 = { x: clamp(tx + rand(-70, 70), 0, VIEW_W), y: exitY - 90 };
  const r2 = { x: clamp(rx + rand(-70, 70), 0, VIEW_W), y: ry + 90 };
  const r3 = { x: rx, y: ry };

  const dive = [{ p0: a0, p1: a1, p2: a2, p3: a3 }, { p0: b0, p1: b1, p2: b2, p3: b3 }];
  const ret = [{ p0: r0, p1: r1, p2: r2, p3: r3 }];

  // attach approximate length to each segment for speed normalization
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

  for (const s of dive) s._len = segLength(s);
  for (const s of ret) s._len = segLength(s);

  return { dive, ret };
}
