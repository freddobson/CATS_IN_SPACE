// Entity factories and helpers
export function formationSlot(state, col, row) {
  const formation = state.formation;
  const x = formation.originX + (col - (formation.cols - 1) / 2) * formation.dx;
  const y = formation.originY + row * formation.dy;
  return { x, y };
}

export function makeEnemy({ kind, slotCol, slotRow, slotX, slotY, pathSegs, spawnDelay }) {
  const isBoss = kind === 'boss';
  return {
    kind,
    x: slotX, y: slotY,
    w: isBoss ? 14 : 12,
    h: isBoss ? 12 : 10,
    hp: isBoss ? 2 : 1,
    score: isBoss ? 150 : 50,

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
