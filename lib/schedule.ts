/**
 * When an assignment opens. A tutor can schedule a test for a whole batch:
 * it appears on their cards straight away as "Opens ...", cannot be opened
 * before then, and closes at its deadline like any other.
 *
 * Pure, and used by the dashboard, the test page and the server action that
 * opens the paper, so they never disagree about whether it is open yet.
 */

export function isNotYetOpen(
  assignment: { opensAt?: Date | string | null },
  now: Date = new Date()
): boolean {
  return !!assignment.opensAt && new Date(assignment.opensAt).getTime() > now.getTime();
}

/** null when the pair is fine, otherwise what is wrong. */
export function scheduleError(opensAt: Date | null, dueAt: Date): string | null {
  if (opensAt && opensAt.getTime() >= dueAt.getTime()) {
    return "The test must open before its deadline.";
  }
  return null;
}

export const TEST_KINDS = ["TEST", "DPP", "ASSIGNMENT"] as const;
export type TestKind = (typeof TEST_KINDS)[number];

export const KIND_LABELS: Record<TestKind, string> = {
  TEST: "Test",
  DPP: "DPP",
  ASSIGNMENT: "Assignment",
};

export const KIND_HINTS: Record<TestKind, string> = {
  TEST: "A timed or untimed test",
  DPP: "Daily practice problems, a short set to do each day",
  ASSIGNMENT: "Homework with a deadline",
};
