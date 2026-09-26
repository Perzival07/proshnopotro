/**
 * Working out what happened when answer photos were deleted from Cloudinary.
 *
 * The files go first and the database rows only for files confirmed gone, so
 * a failure never leaves a stored file that nothing points to (which would
 * keep costing money and could never be found again).
 */

/** Cloudinary's answer for a batch delete: public id -> outcome. */
export type DeleteOutcome = Record<string, string>;

/** "deleted" and "not_found" both mean the file is no longer there. */
export function classifyDeletion(
  ids: string[],
  outcome: DeleteOutcome | null | undefined
): { gone: string[]; failed: string[] } {
  const gone: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    const r = outcome?.[id];
    if (r === "deleted" || r === "not_found") gone.push(id);
    else failed.push(id);
  }
  return { gone, failed };
}

/** Cloudinary takes at most 100 ids per call. */
export function inBatches<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
