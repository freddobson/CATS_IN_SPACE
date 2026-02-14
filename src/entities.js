// Entity factories and helpers
export function formationSlot(state, col, row) {
  const formation = state.formation;
  const x = formation.originX + (col - (formation.cols - 1) / 2) * formation.dx;
  const y = formation.originY + row * formation.dy;
  return { x, y };
}

export function makeEnemy({ kind, slotCol, slotRow, slotX, slotY, pathSegs, spawnDelay }) {
  // Enemy type stats: { width, height, hp, score, canBeam }
  const enemyStats = {
    // Fast, weak enemies (2x size)
    mouse: { w: 20, h: 20, hp: 1, score: 50, canBeam: false },
    feather: { w: 24, h: 24, hp: 1, score: 80, canBeam: false },
    
    // Medium enemies (2x size)
    yarn: { w: 24, h: 24, hp: 2, score: 100, canBeam: false },
    catnip: { w: 24, h: 24, hp: 2, score: 120, canBeam: false },
    
    // Boss enemies - can use beam (2x size)
    laser: { w: 24, h: 32, hp: 3, score: 200, canBeam: true },
    
    // Legacy enemies (2x size)
    bee: { w: 24, h: 20, hp: 1, score: 50, canBeam: false },
    boss: { w: 28, h: 24, hp: 2, score: 150, canBeam: true },
  };
  
  const stats = enemyStats[kind] || enemyStats.bee; // Default to bee if unknown
  
  return {
    id: (Math.random().toString(36).slice(2)),
    kind,
    x: slotX, y: slotY,
    w: stats.w,
    h: stats.h,
    hp: stats.hp,
    score: stats.score,
    canBeam: stats.canBeam,

    mode: 'spawning',
    spawnDelay,
    path: pathSegs,
    segIdx: 0,
    t: 0,
    segDur: 1.0,
    arrived: false,

    slotCol, slotRow,
    slotX, slotY,
    flash: 0,
  };
}
