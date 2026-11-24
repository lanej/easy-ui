/** Stable within the supplied candidate order, independent of selection and focus. */
export function dashedRoute(index: number) {
  return index % 2 === 1;
}

/** Display groups use stable candidate IDs, irrespective of labels or ordering. */
export function sameRouteMembership(
  left: readonly string[] = [],
  right: readonly string[] = [],
) {
  return left.length === right.length && left.every((id) => right.includes(id));
}
