import { CFG } from './cfg.js';

const VIEW_W = CFG.viewW || 224;

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
