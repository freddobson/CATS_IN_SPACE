# Gizmo's Revenge

**A Valentine's Day Gift for Debbie** ❤️

## The Story: To the Death Star and Back

Earth's cats are in mortal danger! An alien armada of sentient cat toys has invaded, determined to enslave our feline friends. But there's hope — Debbie, Earth's greatest pilot, commands the experimental fighter **Gizmo** (a sleek black cat-themed ship).

Armed with determination and her trusty laser cannons, Debbie must face waves of enemies:
- **Toy Mice** - Fast and erratic
- **Feathers** - Swooping dive bombers  
- **Yarn Balls** - Tangling mid-tier threats
- **Catnip Clouds** - Disorienting hazards
- **Laser Pointers** - Boss enemies that deploy tractor beams to capture Gizmo!

Rescue your captured ship by destroying the laser pointer boss, then fight with **dual ships** for devastating firepower!

---

## Technical Details

A Galaga-style HTML5 canvas shooter with custom cat-themed sprites. Uses ES modules, so files must be served over HTTP(S).

Run locally (recommended):

Python 3 (quick):
```bash
python3 -m http.server 8000

# then open http://localhost:8000
```

Node (optional):
```bash
npx serve -s . -l 8000
```

Deploy to GitHub Pages:

- Push the repo to GitHub.
- In the repository settings -> Pages, choose `main` branch / `root` and save.
- GitHub Pages will serve the files over HTTPS (imports will work).

Notes:
- `index.html` uses `<script type="module">` and `game.js` imports `./src/cfg.js`.
- If you prefer a simple file:// workflow, revert to a single-file non-module `game.js`.
