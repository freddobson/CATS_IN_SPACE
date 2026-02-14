# Gizmo's Revenge Configuration Guide

A practical guide to tuning game balance and feel. All settings are in [`src/cfg.js`](../src/cfg.js).

---

## Quick Tuning Recipes

### Make it easier
```javascript
playerSpeed: 110          // faster dodging
fireCooldown: 0.20        // faster fire rate
enemyFireRate: 0.008      // enemies shoot less
diveEvery: 2.5            // fewer dive attacks
beamChance: 0.15          // less beam spam
```

### Make it harder
```javascript
playerSpeed: 85           // slower dodging
fireCooldown: 0.28        // slower fire
enemyFireRate: 0.014      // bullet hell mode
diveEvery: 1.5            // dive attacks more often
beamChance: 0.3           // beam pressure
```

### Speed up the game
```javascript
playerSpeed: 120
bulletSpeed: 220
enemyBulletSpeed: 145
diveSpeed: 160
```

### Slow it down
```javascript
playerSpeed: 75
bulletSpeed: 140
enemyBulletSpeed: 90
diveSpeed: 100
```

---

## Configuration Reference

### Viewport & Rendering
```javascript
viewW: 224              // Canvas width (fixed for pixel-perfect scaling)
viewH: 288              // Canvas height
tile: 1                 // Pixel scale factor
starCount: 120          // Background star count
```

### Player
```javascript
playerSpeed: 96         // Pixels per second horizontal movement
fireCooldown: 0.243     // Seconds between shots (lower = faster fire)
lives: 3                // Starting lives
```
**Tuning tips:**
- `playerSpeed` 80-120: Sweet spot for dodging
- `fireCooldown` 0.15-0.30: Balance between spam and strategy
- More lives = easier game, but less tension

### Bullets
```javascript
bulletSpeed: 174        // Player bullet speed (px/sec)
enemyBulletSpeed: 114   // Enemy bullet speed (px/sec)
```
**Tuning tips:**
- Faster player bullets = easier to hit distant enemies
- Slower enemy bullets = easier to dodge
- Ratio of 1.5x player:enemy feels fair

### Enemies
```javascript
enemyFireRate: 0.0105   // Base fire probability (per frame * 60)
```
**Tuning tips:**
- 0.008-0.012: Normal difficulty
- 0.015+: Bullet hell
- Combines with wave count for progressive difficulty

### Debug
```javascript
enemiesDontFire: true   // ⚠️ TURN OFF BEFORE RELEASE!
```
**Currently enabled for testing!**

### Visual Effects
```javascript
hitFlash: 0.08          // Duration of hit flash effect (seconds)
```

### Dive Attacks
Enemies periodically dive toward the player in Bezier curves.

```javascript
diveEvery: 2.0          // Seconds between dive attempts
diveChance: 0.7         // Probability that attempt triggers (0-1)
diveMaxActive: 2        // Max simultaneous divers
diveSegDuration: 0.42   // Speed of dive curve (lower = faster)
diveLead: 0.25          // How much to aim ahead of player (0-1)
diveEntryDx: 48         // Initial sideways offset
diveHookDx: 70          // How sharp the dive hooks
diveY1: 60              // First curve depth
diveY2: 140             // Hook depth
diveExitY: 330          // How far down (can exceed viewH)
diveSpeed: 125          // Path normalization speed
```
**Tuning tips:**
- Fast/scary dives: `diveEvery: 1.5`, `diveMaxActive: 3`, `diveSegDuration: 0.35`
- Slow/predictable: `diveEvery: 3.0`, `diveMaxActive: 1`, `diveSegDuration: 0.55`
- More lead = harder to dodge: `diveLead: 0.4`

### Beam Capture (Laser Pointer Bosses)
```javascript
beamChance: 0.2         // Probability boss attempts beam (per frame)
beamDuration: 1.2       // How long beam stays active (seconds)
beamWidth: 20           // Beam collision width (pixels)
beamPullSpeed: 60       // Speed player gets pulled up (px/sec)
capturedLockY: 120      // Y position where captured ship locks
beamDiveDown: 68        // How far boss dives to beam
beamDiveSpeed: 60       // Speed of beam dive
beamConeSpread: 120     // Visual cone spread (pixels)
```
**Tuning tips:**
- Scary beams: `beamChance: 0.3`, `beamWidth: 25`, `beamPullSpeed: 80`
- Easier to escape: `beamChance: 0.15`, `beamWidth: 15`, `beamPullSpeed: 45`
- `beamDuration` affects tension - longer = more desperate escape attempt

### Game Progression
```javascript
wavesForVictory: 10     // Total waves to complete the game
```

### Title Screen
```javascript
gameTitle: "TO THE DEATH STAR"
gameSubtitle: "AND BACK"
gameStory: [            // Array of story text lines
  "A mighty power station halfway across",
  "the galaxy is charging a weapon",
  "capable of destroying Earth.",
  "",
  "Debbie climbs into her starship,",
  "the GIZMO, to defend her family",
  "and cats from certain doom.",
]
```

---

## Understanding the Balance

### Current Balance Philosophy
The game has been tuned for **challenging but fair** gameplay:
- Sprites are 2x original size (easier to see, slower feel)
- All speeds reduced 33% from original template
- Player got +10% speed boost for responsive feel
- Fire rate +35% to compensate for slower bullets
- Enemy fire rate -30% to prevent overwhelming player

### Key Balance Relationships

**Player power vs. enemy threat:**
- `fireCooldown * bulletSpeed` = offensive pressure
- `playerSpeed / enemyBulletSpeed` = dodge effectiveness
- `enemyFireRate * diveChance` = incoming threat density

**Pacing:**
- Lower `diveEvery` + higher `diveMaxActive` = aggressive waves
- Higher `beamChance` = boss encounters more dangerous
- `diveSegDuration` affects whether dives feel "snappy" or "floaty"

**Feel:**
- Fast bullets + slow fire = precise shots (sniper)
- Slow bullets + fast fire = bullet spray (machinegun)  
- Current balance: moderate on both = tactical shooting

---

## Common Adjustments

### "The game feels too slow"
```javascript
playerSpeed: 115
bulletSpeed: 200
diveSpeed: 150
diveSegDuration: 0.38
```

### "I can't dodge anything"
```javascript
playerSpeed: 110
enemyBulletSpeed: 100
diveEvery: 2.5
```

### "Not enough action"
```javascript
diveEvery: 1.6
diveMaxActive: 3
enemyFireRate: 0.013
```

### "Beam attacks are frustrating"
```javascript
beamChance: 0.15
beamWidth: 15
beamDuration: 0.9
```

---

## Testing Tips

1. **Always test with `enemiesDontFire: false`** for real difficulty
2. Adjust one category at a time (don't change player + enemy + dive all at once)
3. Play at least 3-4 waves to feel the progression
4. Watch for "dead zones" where nothing happens for too long
5. Laser pointer bosses appear on waves 3, 5, 7, 8, 9, 10

---

## Before You Ship

✅ Set `enemiesDontFire: false`  
✅ Test full 10-wave run  
✅ Verify beam capture/rescue works  
✅ Check that victory screen appears
