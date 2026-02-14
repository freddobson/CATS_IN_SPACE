// Central configuration for Gizmos Revenge

// Game States
export const GAME_STATE = {
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
};

export const CFG = {
  // viewport
  viewW: 224,
  viewH: 288,

  // rendering
  tile: 1,
  starCount: 120,

  // player (speeds reduced 33% for bigger sprites, then +10%, fire rate +35%)
  playerSpeed: 96,
  fireCooldown: 0.243,
  lives: 3,

  // bullets (speeds reduced 33%)
  bulletSpeed: 174,
  enemyBulletSpeed: 114,

  // enemies (fire rate -30%)
  enemyFireRate: 0.0105,
  
  // debug
  enemiesDontFire: false, // Set to true to disable enemy shooting (for testing)

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

  // dive speed (pixels/sec) used to normalize bezier segment timing (reduced 33%, then -15%)
  diveSpeed: 125,

  // beam (boss capture, adjusted for bigger sprites)
  beamChance: 0.2,
  beamDuration: 1.2,
  beamWidth: 20,
  beamPullSpeed: 60,
  capturedLockY: 120,
  // beam dive and cone settings (adjusted for size and player position)
  beamDiveDown: 68,
  beamDiveSpeed: 60,
  beamConeSpread: 120,

  // game progression
  wavesForVictory: 10,

  // title screen
  gameTitle: "TO THE DEATH STAR",
  gameSubtitle: "AND BACK",
  gameStory: [
    "A mighty power station halfway across",
    "the galaxy is charging a weapon",
    "capable of destroying Earth.",
    "",
    "Debbie climbs into her starship,",
    "the GIZMO, to defend her family",
    "and cats from certain doom.",
  ],
};

// Export some convenience aliases (optional)
export const PLAYER_SPEED = CFG.playerSpeed;
export const BULLET_SPEED = CFG.bulletSpeed;
export const ENEMY_BULLET_SPEED = CFG.enemyBulletSpeed;
export const FIRE_COOLDOWN = CFG.fireCooldown;
export const ENEMY_FIRE_CHANCE = CFG.enemyFireRate;
export const HIT_FLASH = CFG.hitFlash;
export const STAR_COUNT = CFG.starCount;
