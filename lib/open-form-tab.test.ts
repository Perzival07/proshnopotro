import { describe, it, expect, vi } from "vitest";
import { openFormInNewTab, type FormTabHandle } from "./open-form-tab";

function makeTab() {
  const tab = {
    opener: {} as unknown,
    location: { replace: vi.fn() },
    focus: vi.fn(),
    close: vi.fn(),
  };
  return tab as FormTabHandle & typeof tab;
}

const URL = "https://docs.google.com/forms/d/e/abc/viewform";

describe("openFormInNewTab", () => {
  it("opens the tab BEFORE awaiting the URL, preserving user activation", async () => {
    const order: string[] = [];
    const tab = makeTab();
    const openTab = vi.fn(() => {
      order.push("open");
      return tab;
    });
    const resolveUrl = vi.fn(async () => {
      order.push("resolve");
      return { url: URL };
    });

    await openFormInNewTab(openTab, resolveUrl);

    // Regression: opening after the await spends the click's transient user
    // activation and the popup blocker catches it.
    expect(order).toEqual(["open", "resolve"]);
  });

  it("severs the opener back-reference", async () => {
    const tab = makeTab();
    await openFormInNewTab(() => tab, async () => ({ url: URL }));
    expect(tab.opener).toBeNull();
  });

  it("navigates the opened tab and reports success", async () => {
    const tab = makeTab();
    const res = await openFormInNewTab(() => tab, async () => ({ url: URL }));

    expect(res).toEqual({ status: "opened" });
    expect(tab.location.replace).toHaveBeenCalledWith(URL);
    expect(tab.focus).toHaveBeenCalled();
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("uses replace(), so the placeholder is not left in the tab's history", async () => {
    const tab = makeTab();
    await openFormInNewTab(() => tab, async () => ({ url: URL }));
    expect(tab.location.replace).toHaveBeenCalledTimes(1);
  });

  it("treats a null tab as blocked and hands back the URL for a link", async () => {
    // Regression: the old code navigated the CURRENT tab here, destroying the
    // portal and the control that records the submission. A blocked popup must
    // surface a link instead -- note there is no window/location to navigate in
    // this helper at all, which is what makes that impossible by construction.
    const res = await openFormInNewTab(
      () => null,
      async () => ({ url: URL })
    );
    expect(res).toEqual({ status: "blocked", url: URL });
  });

  it("closes the tab and reports the server's error", async () => {
    const tab = makeTab();
    const res = await openFormInNewTab(() => tab, async () => ({
      error: "The deadline for this assessment has passed.",
    }));

    expect(res).toEqual({
      status: "error",
      error: "The deadline for this assessment has passed.",
    });
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
  });

  it("closes the tab when the action throws", async () => {
    const tab = makeTab();
    const res = await openFormInNewTab(() => tab, async () => {
      throw new Error("network down");
    });

    expect(res.status).toBe("error");
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
  });

  it("closes the tab when the action returns neither url nor error", async () => {
    const tab = makeTab();
    const res = await openFormInNewTab(() => tab, async () => ({}));
    expect(res.status).toBe("error");
    expect(tab.close).toHaveBeenCalled();
  });

  it("does not leave a blocked popup reported as opened", async () => {
    const res = await openFormInNewTab(
      () => null,
      async () => ({ error: "Unauthorized" })
    );
    // An error still wins over "blocked": nothing was opened to link to.
    expect(res).toEqual({ status: "error", error: "Unauthorized" });
  });
});
