# Gizmos Revenge — Local dev & GH Pages

Small Galaga-style HTML5 canvas shooter. Uses ES modules, so files must be served over HTTP(S).

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
