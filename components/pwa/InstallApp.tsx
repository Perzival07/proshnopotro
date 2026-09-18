"use client";

import React, { useEffect, useState } from "react";
import { AtomMark } from "@/components/brand/AtomMark";
import { Button } from "@/components/ui/button";
import {
  detectInstallPlatform,
  INSTALL_STEPS,
  type InstallPlatform,
} from "@/lib/pwa-platform";
import { isRunningStandalone, promptInstall, useInstallPrompt } from "./PwaSetup";
import { Download } from "lucide-react";

/**
 * Everything the install offer needs to decide whether to show. Worked out
 * after mount: the user agent and display mode exist only in the browser, and
 * guessing during render would mismatch the server HTML.
 */
function useInstallOffer() {
  const { canPrompt, installed } = useInstallPrompt();
  const [env, setEnv] = useState<{
    platform: InstallPlatform;
    standalone: boolean;
  } | null>(null);

  useEffect(() => {
    setEnv({
      platform: detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
      standalone: isRunningStandalone(),
    });
  }, []);

  const hidden = !env || env.standalone || installed;
  const steps =
    env && env.platform !== "PROMPT_ONLY" ? INSTALL_STEPS[env.platform] : null;

  // Safari never offers a dialog, so on Apple's browsers the steps are the
  // only honest instruction, whatever else claims to be available.
  const appleManual = env?.platform === "IOS" || env?.platform === "MAC_SAFARI";

  return {
    ready: !hidden,
    canPrompt: canPrompt && !appleManual,
    steps,
    platform: env?.platform,
  };
}

/**
 * A card offering to install the portal, shown on the sign-in page and the
 * student dashboard. It cannot be dismissed: it stays until the portal is
 * installed, and is hidden only inside the installed app itself.
 */
export function InstallAppCard({ className = "" }: { className?: string }) {
  const offer = useInstallOffer();

  if (!offer.ready) return null;
  if (!offer.canPrompt && !offer.steps) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-brand-border bg-white p-4 text-left shadow-card ${className}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-navy">
        <AtomMark size={28} strokeColor="#FFFFFF" dotColor="#62BEF0" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-heading text-sm font-semibold text-brand-navy">
            Install the app
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-brand-ink/70">
            {offer.canPrompt
              ? "Open your tests straight from your home screen or desktop, in their own window."
              : offer.steps}
          </p>
        </div>

        {offer.canPrompt && (
          <Button
            size="sm"
            onClick={() => void promptInstall()}
            className="h-9 gap-1.5 bg-brand-navy text-xs font-semibold text-white hover:bg-brand-navy/90"
          >
            <Download className="h-3.5 w-3.5" />
            Install app
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The same offer as a permanent navigation item for the tutor's sidebar and
 * mobile drawer. Not dismissible, and it explains the manual steps inline
 * where the browser cannot open the dialog itself.
 */
export function InstallAppNavButton() {
  const offer = useInstallOffer();
  const [showSteps, setShowSteps] = useState(false);

  if (!offer.ready) return null;
  if (!offer.canPrompt && !offer.steps) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => (offer.canPrompt ? void promptInstall() : setShowSteps((s) => !s))}
        aria-expanded={offer.canPrompt ? undefined : showSteps}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white"
      >
        <Download className="h-4 w-4 shrink-0 text-[#87CEEB]" />
        <span>Install app</span>
      </button>
      {showSteps && offer.steps && (
        <p className="px-3 text-[11px] leading-relaxed text-white/70">{offer.steps}</p>
      )}
    </div>
  );
}
