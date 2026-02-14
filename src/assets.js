// Simple asset loader for SVG sprites (returns Image objects)
export async function loadAssets() {
  const base = 'assets/sprites/';
  const list = {
    player: 'player.svg',
    bee: 'enemy_bee.svg',
    boss: 'enemy_boss.svg',
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
