/**
 * When a student may see their result -- score, answers and solutions -- for
 * a paper written in the portal. One rule, used by the result page and the
 * dashboard alike.
 */
export function resultsVisible(
  test: { resultRelease: "INSTANT" | "ON_RELEASE" | "AFTER_DEADLINE"; resultsReleasedAt: Date | string | null },
  assignment: { dueAt: Date | string },
  now: Date = new Date()
): boolean {
  if (test.resultRelease === "INSTANT") return true;
  if (test.resultRelease === "ON_RELEASE") return test.resultsReleasedAt !== null;
  // After the deadline -- or earlier, if the tutor released them by hand.
  return test.resultsReleasedAt !== null || now.getTime() > new Date(assignment.dueAt).getTime();
}
