/**
 * Opening the assessment form in a new tab, correctly.
 *
 * Two browser rules drive this and both were violated before:
 *
 *  1. window.open is only exempt from the popup blocker while the click's
 *     transient user activation is live. Awaiting anything first spends that
 *     activation, so the tab must be opened synchronously in the handler and
 *     navigated later -- not opened once the URL is known.
 *
 *  2. Per the HTML standard (window open steps, step 18) window.open returns
 *     null whenever "noopener" is passed with a _blank target -- even on
 *     success. Code that passes noopener and then null-checks the result to
 *     detect failure therefore ALWAYS takes the failure path. The opener
 *     reference is severed by assignment instead, which is equivalent.
 *
 * And one product rule: when the popup really is blocked, the current tab must
 * not be navigated to the form. Doing so strips away the portal along with the
 * control that records the submission.
 */

export interface FormTabHandle {
  opener: unknown;
  location: { replace(url: string): void };
  focus(): void;
  close(): void;
}

export type OpenTab = () => FormTabHandle | null;

export type OpenFormOutcome =
  | { status: "opened" }
  | { status: "blocked"; url: string }
  | { status: "error"; error: string };

export async function openFormInNewTab(
  openTab: OpenTab,
  resolveUrl: () => Promise<{ url?: string; error?: string }>
): Promise<OpenFormOutcome> {
  // Synchronous, before any await: this is the whole point.
  const tab = openTab();

  if (tab) {
    // Sever the back-reference; equivalent to the "noopener" feature, but we
    // keep the handle needed to navigate the tab below.
    tab.opener = null;
  }

  let resolved: { url?: string; error?: string };
  try {
    resolved = await resolveUrl();
  } catch {
    tab?.close();
    return {
      status: "error",
      error: "Failed to launch form. Please check your connection.",
    };
  }

  if (resolved.error || !resolved.url) {
    tab?.close();
    return {
      status: "error",
      error: resolved.error || "Could not resolve the form link.",
    };
  }

  if (!tab) {
    return { status: "blocked", url: resolved.url };
  }

  // replace() keeps the placeholder out of the new tab's history.
  tab.location.replace(resolved.url);
  tab.focus();
  return { status: "opened" };
}
