"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveSecureFormUrl, markStudentSubmission } from "./actions";
import { openFormInNewTab } from "@/lib/open-form-tab";
import { buildWhatsAppLink, answersMessage, TUTOR_WHATSAPP } from "@/lib/whatsapp";
import type { TestFormat } from "@/lib/test-resource";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  ExternalLink,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  MessageCircle,
  Maximize2,
} from "lucide-react";

interface StartTestButtonProps {
  assignmentId: string;
  testTitle: string;
  testFormat: TestFormat;
  studentName?: string | null;
}

export function StartTestButton({
  assignmentId,
  testTitle,
  testFormat,
  studentName,
}: StartTestButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  // Resolved only after the server has authorised this student, so the link
  // still never appears in the page's initial HTML.
  const [url, setUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const isDoc = testFormat === "GOOGLE_DOC";
  const paperNoun = isDoc ? "Question Paper" : "Google Form";
  const whatsappHref = buildWhatsAppLink(
    TUTOR_WHATSAPP,
    answersMessage(testTitle, studentName)
  );

  const handleOpen = async () => {
    setLoading(true);
    setError(null);

    // The tab is opened synchronously here in case the resource cannot be
    // embedded -- see lib/open-form-tab for why that ordering matters.
    let outcomeUrl: string | null = null;
    let outcomeEmbed: string | null = null;

    const res = await resolveSecureFormUrl(assignmentId);
    if (res.error || !res.url) {
      setError(res.error || "Could not resolve the question paper link.");
      setLoading(false);
      return;
    }
    outcomeUrl = res.url;
    outcomeEmbed = res.embedUrl ?? null;

    setUrl(outcomeUrl);
    setEmbedUrl(outcomeEmbed);
    setOpened(true);
    setLoading(false);

    // Nothing embeddable (a forms.gle shortlink, say) -- fall back to a tab.
    if (!outcomeEmbed) {
      const outcome = await openFormInNewTab(
        () => window.open("about:blank", "_blank"),
        async () => ({ url: outcomeUrl! })
      );
      if (outcome.status === "blocked") {
        setError(
          "Your browser blocked the new tab. Use the button below to open the paper."
        );
      }
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
      router.push("/");
      router.refresh();
    } catch {
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

      {!opened ? (
        <Button
          id="start-assessment-btn"
          onClick={handleOpen}
          disabled={loading}
          size="lg"
          className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white font-medium py-3 px-6 shadow-md transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <AtomMark size={20} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
              <span>Verifying &amp; Opening&hellip;</span>
            </div>
          ) : (
            <>
              <span>Open {paperNoun}</span>
              <ExternalLink className="h-4 w-4" />
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-4">
          {/* In-page preview */}
          {embedUrl && (
            <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-brand-border bg-brand-page px-3 py-2">
                <span className="text-[11px] font-semibold text-brand-navy">
                  {isDoc ? "Question paper" : "Assessment form"}
                </span>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-blue hover:underline"
                  >
                    <Maximize2 className="h-3 w-3" />
                    Open in new tab
                  </a>
                )}
              </div>
              <iframe
                src={embedUrl}
                title={isDoc ? "Question paper" : "Assessment form"}
                className="h-[70vh] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          )}

          {/* Always offer the tab, embedded or not */}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-brand-navy/90"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open {paperNoun} in a New Tab</span>
            </a>
          )}

          {/* WhatsApp the answers -- the submission route for a written paper */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 px-6 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp me the test answers</span>
          </a>

          <div className="p-4 bg-sky-50 text-sky-950 border border-sky-200 rounded-xl flex items-start gap-3 text-left">
            <ShieldAlert className="h-5 w-5 shrink-0 text-brand-blue mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-brand-navy">
                {isDoc ? "Written paper" : "Assessment opened"}
              </p>
              <p className="text-brand-ink/80">
                {isDoc
                  ? "Write your answers on paper, send them on WhatsApp using the button above, then confirm below."
                  : "Complete every question and press Submit inside the form, then confirm below."}
              </p>
            </div>
          </div>

          <Button
            onClick={handleConfirmSubmission}
            disabled={submitting}
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 shadow-md transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <AtomMark size={20} strokeColor="#FFFFFF" dotColor="#A7F3D0" animate />
                <span>Confirming Submission&hellip;</span>
              </div>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>
                  {isDoc ? "I Have Sent My Answers" : "I Have Submitted the Form"}
                </span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
