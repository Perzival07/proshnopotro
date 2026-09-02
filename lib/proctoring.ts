/**
 * The tab guard.
 *
 * A browser cannot stop a student leaving the page -- no web page can trap
 * focus or disable the task switcher -- so this detects the departure and
 * makes it cost something instead. The student is told up front that it is
 * watching, which is what actually deters the casual glance at another tab.
 *
 * Counting lives on the server (`Assignment.tabSwitches`) because a tally held
 * in the page would reset on the reload that follows the very behaviour it is
 * meant to catch.
 */

/** Departures allowed before the attempt is submitted. The third ends it. */
export const MAX_TAB_SWITCHES = 3;

export interface SwitchOutcome {
  /** The tally after this departure. */
  count: number;
  /** Departures left before the attempt ends. */
  remaining: number;
  /** Whether this one ends the attempt. */
  shouldSubmit: boolean;
}

/** Applies one departure to a running tally. */
export function registerSwitch(previousCount: number): SwitchOutcome {
  const count = Math.max(0, previousCount) + 1;
  return {
    count,
    remaining: Math.max(0, MAX_TAB_SWITCHES - count),
    shouldSubmit: count >= MAX_TAB_SWITCHES,
  };
}

/** What the student is shown when they come back. */
export function warningMessage(outcome: SwitchOutcome): string {
  if (outcome.shouldSubmit) {
    return "You left the assessment once too often. Your test has been submitted automatically.";
  }
  const left = outcome.remaining;
  return `You left the assessment tab. This is warning ${outcome.count} of ${MAX_TAB_SWITCHES}. Leaving ${
    left === 1 ? "once more" : `${left} more times`
  } will submit your test automatically.`;
}

/** Whether an attempt should be watched at all. */
export function isProctored(assignment: { test: { proctored?: boolean | null } }): boolean {
  return assignment.test.proctored === true;
}
