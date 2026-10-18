/**
 * Card ordering helpers.
 *
 * Cards store a numeric `order`. Inserting or moving a card sets its order to
 * the midpoint of its new neighbours, so ONE record is written per move
 * instead of renumbering the whole deck (which would be slow at 1,000+ cards).
 * Floats have ~50 halvings of headroom between two neighbours, far more than
 * a person will ever hit; `needsRenumber` lets the caller reset if they do.
 */

const STEP = 1024;

/** Order value that sorts between `prev` and `next` (either may be undefined = list edge). */
export function orderBetween(prev, next) {
  if (prev === undefined && next === undefined) return STEP;
  if (prev === undefined) return next - STEP;
  if (next === undefined) return prev + STEP;
  return (prev + next) / 2;
}

/** True when two neighbouring orders are too close to split again safely. */
export function needsRenumber(prev, next) {
  return prev !== undefined && next !== undefined && next - prev < 1e-6;
}

/**
 * New `order` for the item at `from` once it is dropped so it ends at index `to`
 * (index in the list AFTER removal, like Array.splice). `items` are sorted by order.
 */
export function orderForMove(items, from, to) {
  const rest = items.filter((_, i) => i !== from);
  return orderBetween(rest[to - 1]?.order, rest[to]?.order);
}

/** Evenly spaced orders for `count` cards, used when creating/renumbering. */
export function initialOrders(count) {
  return Array.from({ length: count }, (_, i) => (i + 1) * STEP);
}
