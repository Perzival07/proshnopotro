"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { resolveSecureFormUrl } from "./actions";
import { AtomMark } from "@/components/brand/AtomMark";
import { ExternalLink, AlertCircle, ShieldAlert } from "lucide-react";

interface StartTestButtonProps {
  assignmentId: string;
}

export function StartTestButton({ assignmentId }: StartTestButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  const handleOpenForm = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await resolveSecureFormUrl(assignmentId);

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      if (res.url) {
        setOpened(true);
        // Open Google Form securely in new tab
        const formWindow = window.open(res.url, "_blank", "noopener,noreferrer");
        if (!formWindow) {
          // In case popup was blocked by browser
          window.location.href = res.url;
        }
      }
    } catch (err) {
      setError("Failed to launch form. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3.5 text-xs bg-red-50 text-red-800 border border-red-200 rounded-lg flex items-center gap-2.5 text-left">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {opened && (
        <div className="p-3.5 text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-lg flex items-start gap-2.5 text-left">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            Google Form opened in a new tab. Please complete and submit it before closing the form window.
          </span>
        </div>
      )}

      <Button
        id="start-assessment-btn"
        onClick={handleOpenForm}
        disabled={loading}
        size="lg"
        className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white font-medium py-3 px-6 shadow-md transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <AtomMark size={20} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
            <span>Verifying & Opening Test...</span>
          </div>
        ) : (
          <>
            <span>{opened ? "Re-Open Google Form" : "Open Google Form"}</span>
            <ExternalLink className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
