// Where a dragged task lands (tasks and requirements view spec).

/**
 * The index a dragged row ends up at among the rows (dragged one included), given the pointer's y and
 * each row's vertical middle, in order. It goes before the first row whose middle is below the pointer.
 */
export function dropIndex(pointerY: number, rowMids: number[], fromIndex: number): number {
  const before = rowMids.filter((mid) => mid < pointerY).length;
  const index = before > fromIndex ? before - 1 : before;
  return Math.max(0, Math.min(index, rowMids.length - 1));
}

/** The reorderable rows of the list a grip belongs to, in order. */
export function reorderRows(from: Element): HTMLElement[] {
  const list = from.closest("[data-reorder-list]");
  return list ? [...list.querySelectorAll<HTMLElement>("[data-reorder-row]")] : [];
}
