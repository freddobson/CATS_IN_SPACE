// Simple asset loader for SVG sprites (returns Image objects)
export async function loadAssets() {
  const base = 'assets/sprites/';
  const list = {
    // Player
    player: 'player.svg',
    gizmo: 'player_gizmo.svg',
    
    // Enemies - cat toys
    bee: 'enemy_bee.svg',        // Legacy (keeping for fallback)
    boss: 'enemy_boss.svg',      // Legacy (keeping for fallback)
    mouse: 'enemy_mouse.svg',
    feather: 'enemy_feather.svg',
    yarn: 'enemy_yarn.svg',
    laser: 'enemy_laser.svg',
    catnip: 'enemy_catnip.svg',
    
    // Powerups - cat treats
    treat: 'powerup_treat.svg',
    fish: 'powerup_fish.svg',
    heart: 'powerup_heart.svg',
  };

  const assets = {};

  const promises = Object.keys(list).map(key => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { assets[key] = img; resolve(); };
    img.onerror = (e) => reject(e);
    img.src = base + list[key];
  }));

  await Promise.all(promises);
  return assets;
}
