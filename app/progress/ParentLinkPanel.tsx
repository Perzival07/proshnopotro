"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { setParentLink } from "./actions";
import { Link2, Copy, Check } from "lucide-react";

/** Lets a student give a parent a read-only view of their progress. */
export function ParentLinkPanel({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/report/${token}` : token ? `/report/${token}` : null;

  const act = async (action: "create" | "reset" | "remove") => {
    if (action === "reset" && !window.confirm("Make a new link? The old one will stop working.")) return;
    if (action === "remove" && !window.confirm("Turn the link off? Anyone with it will no longer see your progress.")) return;
    setBusy(true);
    try {
      const res = await setParentLink(action);
      if (!res.error) setToken(res.token ?? null);
    } finally {
      setBusy(false);
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-brand-border bg-white p-4 text-xs shadow-card">
      <p className="flex items-center gap-1.5 font-semibold text-brand-navy">
        <Link2 className="h-4 w-4" /> Share with a parent
      </p>
      <p className="text-brand-ink/70">
        A private link to this page, read-only: scores, ranks and chapters, never your answers. Anyone with the link
        can open it, so send it only to your parents.
      </p>
      {url ? (
        <>
          <div className="flex items-center gap-2">
            <input readOnly value={url} className="h-8 min-w-0 flex-1 rounded-md border border-brand-border bg-brand-page px-2 font-mono text-[11px]" />
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 bg-brand-navy text-xs text-white"
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex gap-3">
            <button type="button" disabled={busy} onClick={() => act("reset")} className="text-[11px] font-semibold text-brand-blue hover:underline">
              Make a new link
            </button>
            <button type="button" disabled={busy} onClick={() => act("remove")} className="text-[11px] font-semibold text-red-700 hover:underline">
              Turn off
            </button>
          </div>
        </>
      ) : (
        <Button type="button" size="sm" disabled={busy} onClick={() => act("create")} className="h-8 bg-brand-navy text-xs text-white">
          Create a link
        </Button>
      )}
    </div>
  );
}
