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
};

// Export some convenience aliases (optional)
export const PLAYER_SPEED = CFG.playerSpeed;
export const BULLET_SPEED = CFG.bulletSpeed;
export const ENEMY_BULLET_SPEED = CFG.enemyBulletSpeed;
export const FIRE_COOLDOWN = CFG.fireCooldown;
export const ENEMY_FIRE_CHANCE = CFG.enemyFireRate;
export const HIT_FLASH = CFG.hitFlash;
export const STAR_COUNT = CFG.starCount;
