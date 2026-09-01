/** A well-formed number: "45" or "45.5", but not "1.2.3", "." or "" . */
const NUMBER = "\\d+(?:\\.\\d+)?";
const RATIO_RE = new RegExp(`^(${NUMBER})\\s*(?:\\/|of)\\s*(${NUMBER})$`, "i");
const SINGLE_RE = new RegExp(`^${NUMBER}$`);

/**
 * Parses a Google Forms score cell: "45", "45 / 50", "45.5/50", "45 of 50".
 *
 * Returns nulls for anything it cannot read with confidence. A previous
 * `^[\d.]+$` pattern matched "1.2.3" and parseFloat silently returned 1.2 --
 * a wrong grade written to a student record with no error surfaced.
 */
export function parseScoreString(
  rawScore: string,
  defaultMaxScore: number
): { score: number | null; maxScore: number | null } {
  if (!rawScore || typeof rawScore !== "string") {
    return { score: null, maxScore: null };
  }

  const cleaned = rawScore.trim();

  const ratioMatch = cleaned.match(RATIO_RE);
  if (ratioMatch) {
    const score = parseFloat(ratioMatch[1]);
    const maxScore = parseFloat(ratioMatch[2]);
    if (isFinite(score) && isFinite(maxScore) && maxScore > 0) {
      return { score, maxScore };
    }
    return { score: null, maxScore: null };
  }

  const singleMatch = cleaned.match(SINGLE_RE);
  if (singleMatch) {
    const score = parseFloat(singleMatch[0]);
    if (isFinite(score)) {
      return { score, maxScore: defaultMaxScore };
    }
  }

  return { score: null, maxScore: null };
}
