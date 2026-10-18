/**
 * Fisher-Yates shuffle. Returns a NEW array; the input is left untouched.
 * `random` is injectable so tests can be deterministic.
 */
export function shuffle(items, random = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
