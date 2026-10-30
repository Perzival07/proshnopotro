/**
 * Helpers that keep re-marking to a handful of database round trips.
 */

/** Responses that end up with the same marks and status, written in one statement. */
export interface MarkGroup {
  marks: number;
  status: string;
  questionIds: string[];
}

/**
 * Groups marked responses by what is written to them. A paper has a few
 * distinct outcomes (full marks, negative, zero, unattempted, ...), so this
 * turns one UPDATE per response into one per outcome.
 */
export function groupByOutcome(
  entries: { questionId: string; marks: number; status: string }[]
): MarkGroup[] {
  const groups = new Map<string, MarkGroup>();
  for (const e of entries) {
    const key = `${e.marks}|${e.status}`;
    const group = groups.get(key);
    if (group) group.questionIds.push(e.questionId);
    else groups.set(key, { marks: e.marks, status: e.status, questionIds: [e.questionId] });
  }
  return [...groups.values()];
}

/**
 * Runs `fn` over `items` with at most `limit` in flight. After a failure no
 * new item is started; the first error is thrown once the running ones settle.
 */
export async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  let failure: { error: unknown } | null = null;

  const worker = async () => {
    while (!failure && next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (error) {
        failure ??= { error };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw (failure as { error: unknown }).error;
}
