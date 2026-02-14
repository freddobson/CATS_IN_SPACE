// Keyboard input handling (exports `keys` set)
export const keys = new Set();

addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

export function isPressed(key) {
  return keys.has(key.toLowerCase());
}
