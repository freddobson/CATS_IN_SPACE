// Central configuration for Gizmos Revenge
export const CFG = {
  // viewport
  viewW: 224,
  viewH: 288,

  // rendering
  tile: 1,
  starCount: 120,

  // player
  playerSpeed: 130,
  fireCooldown: 0.18,
  lives: 3,

  // bullets
  bulletSpeed: 260,
  enemyBulletSpeed: 170,

  // enemies
  enemyFireRate: 0.015,

  // effects
  hitFlash: 0.08,
  // dive attacks
  diveEvery: 2.0,
  diveChance: 0.7,
  diveMaxActive: 2,
  diveSegDuration: 0.42,
  diveLead: 0.25,
  diveEntryDx: 48,
  diveHookDx: 70,
  diveY1: 60,
  diveY2: 140,
  diveExitY: 330,

  // dive speed (pixels/sec) used to normalize bezier segment timing
  diveSpeed: 220,

  // beam (boss capture)
  beamChance: 0.12,
  beamDuration: 1.2,
  beamWidth: 10,
  beamPullSpeed: 90,
  capturedLockY: 120,
};

// Export some convenience aliases (optional)
export const PLAYER_SPEED = CFG.playerSpeed;
export const BULLET_SPEED = CFG.bulletSpeed;
export const ENEMY_BULLET_SPEED = CFG.enemyBulletSpeed;
export const FIRE_COOLDOWN = CFG.fireCooldown;
export const ENEMY_FIRE_CHANCE = CFG.enemyFireRate;
export const HIT_FLASH = CFG.hitFlash;
export const STAR_COUNT = CFG.starCount;
