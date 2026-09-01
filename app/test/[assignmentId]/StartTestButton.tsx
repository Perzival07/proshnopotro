"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveSecureFormUrl, markStudentSubmission } from "./actions";
import { AtomMark } from "@/components/brand/AtomMark";
import { ExternalLink, AlertCircle, ShieldAlert, CheckCircle2 } from "lucide-react";

interface StartTestButtonProps {
  assignmentId: string;
}

export function StartTestButton({ assignmentId }: StartTestButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const handleConfirmSubmission = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await markStudentSubmission(assignmentId);
      if (res.error) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      // Redirect to student dashboard
      router.push("/");
      router.refresh();
    } catch (err) {
      setError("Failed to confirm submission.");
      setSubmitting(false);
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
        <div className="p-4 bg-sky-50 text-sky-950 border border-sky-200 rounded-xl flex items-start gap-3 text-left">
          <ShieldAlert className="h-5 w-5 shrink-0 text-brand-blue mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-brand-navy">Google Form Opened in a New Tab</p>
            <p className="text-brand-ink/80">
              Please complete all questions in the Google Form tab. Once you click <strong>Submit</strong> on Google Forms, click the button below to confirm and return to your dashboard.
            </p>
          </div>
        </div>
      )}

      {!opened ? (
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
              <span>Open Google Form</span>
              <ExternalLink className="h-4 w-4" />
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-2.5 pt-1">
          <Button
            onClick={handleConfirmSubmission}
            disabled={submitting}
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 shadow-md transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <AtomMark size={20} strokeColor="#FFFFFF" dotColor="#A7F3D0" animate />
                <span>Confirming Submission...</span>
              </div>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>I Have Submitted the Form</span>
              </>
            )}
          </Button>

          <Button
            onClick={handleOpenForm}
            disabled={loading}
            variant="outline"
            size="sm"
            className="w-full border-brand-border text-brand-navy hover:bg-brand-tint text-xs gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Re-Open Form Tab</span>
          </Button>
        </div>
      )}
    </div>
  );
}
