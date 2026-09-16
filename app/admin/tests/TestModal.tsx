"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SubjectIcon, SUBJECT_ICONS } from "@/components/SubjectIcon";
import {
  createTest,
  getPaperPreviewUrl,
  getPaperUploadSignature,
  updateTest,
} from "./actions";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  AlertCircle,
  Link as LinkIcon,
  FileText,
  FileType2,
  ClipboardList,
  Timer,
  Upload,
  ExternalLink,
} from "lucide-react";
import type { TestFormat } from "@/lib/test-resource";
import { MAX_DURATION_MINUTES, MIN_DURATION_MINUTES } from "@/lib/exam-timer";
import type { UploadedPaper } from "@/lib/question-paper";
import type { CompressProgress } from "@/lib/compress-pdf";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { MAX_PDF_BYTES, describeSaving, looksLikePdf } from "@/lib/pdf-compression";
import { formatBytes } from "@/lib/notes";

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  testToEdit?: {
    id: string;
    title: string;
    subject: string;
    description?: string | null;
    iconName: string;
    format: TestFormat;
    formUrl: string;
    paperPublicId: string | null;
    paperVersion: number | null;
    paperName: string | null;
    paperBytes: number | null;
    durationMinutes: number | null;
    proctored: boolean;
    active: boolean;
  } | null;
}

export function TestModal({ isOpen, onClose, testToEdit }: TestModalProps) {
  const isEditing = Boolean(testToEdit);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState("Atom");
  const [format, setFormat] = useState<TestFormat>("GOOGLE_FORM");
  const [formUrl, setFormUrl] = useState("");
  // The uploaded PDF paper, once it is safely in Cloudinary.
  const [paper, setPaper] = useState<UploadedPaper | null>(null);
  // "8.2 MB → 1.4 MB" for a paper uploaded in this sitting.
  const [paperSaving, setPaperSaving] = useState<string | null>(null);
  // What the PDF upload is doing right now; null when idle.
  const [paperStatus, setPaperStatus] = useState<string | null>(null);
  const [openingPaper, setOpeningPaper] = useState(false);
  const paperInputRef = useRef<HTMLInputElement>(null);
  // Held as a string so the field can be genuinely empty, which is what
  // "no time limit" means -- a number state would coerce that to 0.
  const [durationMinutes, setDurationMinutes] = useState("");
  const [proctored, setProctored] = useState(true);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (testToEdit) {
      setTitle(testToEdit.title);
      setSubject(testToEdit.subject);
      setDescription(testToEdit.description || "");
      setIconName(testToEdit.iconName || "BookOpen");
      setFormat(testToEdit.format || "GOOGLE_FORM");
      setFormUrl(testToEdit.formUrl);
      setPaper(
        testToEdit.paperPublicId && testToEdit.paperVersion
          ? {
              publicId: testToEdit.paperPublicId,
              version: testToEdit.paperVersion,
              name: testToEdit.paperName || "question-paper.pdf",
              bytes: testToEdit.paperBytes ?? 0,
            }
          : null
      );
      setDurationMinutes(
        testToEdit.durationMinutes ? String(testToEdit.durationMinutes) : ""
      );
      setProctored(testToEdit.proctored);
      setActive(testToEdit.active);
    } else {
      setTitle("");
      setSubject("Physics");
      setDescription("");
      setIconName("Atom");
      setFormat("GOOGLE_FORM");
      setFormUrl("");
      setPaper(null);
      setDurationMinutes("");
      setProctored(true);
      setActive(true);
    }
    setPaperSaving(null);
    setPaperStatus(null);
    setError(null);
  }, [testToEdit, isOpen]);

  const handlePaperFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!looksLikePdf(file)) {
      setError(`${file.name} is not a PDF.`);
      return;
    }

    setPaperStatus("Reading the PDF\u2026");
    try {
      // Compressed before it leaves the browser: a scanned paper is often
      // several MB a page, and every student downloads it on a phone.
      // Loaded on demand: pdf-lib and pdf.js are heavy, and most visits to
      // this page never touch a PDF.
      const { compressPdf } = await import("@/lib/compress-pdf");
      const compressed = await compressPdf(file, (p) => setPaperStatus(progressText(p)));

      setPaperStatus("Uploading\u2026");
      const signed = await getPaperUploadSignature();
      if (signed.error || !signed.upload) {
        setError(signed.error || "Could not start the upload.");
        return;
      }
      const body = await uploadToCloudinary(signed.upload, compressed.blob, file.name, "raw");

      setPaper({
        publicId: body.public_id,
        version: body.version,
        name: file.name,
        bytes: body.bytes ?? compressed.bytes,
      });
      setPaperSaving(describeSaving(compressed.originalBytes, compressed.bytes));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "The PDF could not be uploaded.");
    } finally {
      setPaperStatus(null);
    }
  };

  const openSavedPaper = async () => {
    if (!testToEdit) return;
    // Opened before the await so pop-up blockers see it as the tap's own window.
    const tab = window.open("", "_blank");
    setOpeningPaper(true);
    try {
      const res = await getPaperPreviewUrl(testToEdit.id);
      if (res.url && tab) tab.location.href = res.url;
      else {
        tab?.close();
        setError(res.error || "Could not open the paper.");
      }
    } finally {
      setOpeningPaper(false);
    }
  };

  const isPdf = format === "PDF";
  const paperBusy = paperStatus !== null;
  // Only the paper already saved on this test can be opened from here; a fresh
  // upload is the file the tutor just picked, so they have it in hand.
  const paperIsSaved = Boolean(
    paper && testToEdit?.paperPublicId && paper.publicId === testToEdit.paperPublicId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title,
      subject,
      description,
      iconName,
      format,
      formUrl,
      paper: isPdf ? paper : null,
      durationMinutes,
      proctored,
      active,
    };

    const res = isEditing && testToEdit
      ? await updateTest(testToEdit.id, payload)
      : await createTest(payload);

    if (res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !paperBusy && onClose()}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Assessment Test" : "Create New Assessment Test"}
          </DialogTitle>
          <DialogDescription>
            Configure the test record, then link a Google Form or Doc, or upload the paper as a PDF.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Label htmlFor="test-title" className="text-xs font-semibold text-brand-navy">
              Test Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="test-title"
              placeholder="e.g. Unit 3: Kinematics & Motion (Class 11)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="test-subject" className="text-xs font-semibold text-brand-navy">
                Subject <span className="text-red-500">*</span>
              </Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="test-subject" className="mt-1">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Physics">Physics</SelectItem>
                  <SelectItem value="Chemistry">Chemistry</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                  <SelectItem value="Biology">Biology</SelectItem>
                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                  <SelectItem value="General Science">General Science</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="test-icon" className="text-xs font-semibold text-brand-navy">
                Card Icon <span className="text-red-500">*</span>
              </Label>
              <Select value={iconName} onValueChange={setIconName}>
                <SelectTrigger id="test-icon" className="mt-1">
                  <div className="flex items-center gap-2">
                    <SubjectIcon name={iconName} className="h-4 w-4 text-brand-navy" />
                    <span>{iconName}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SUBJECT_ICONS).map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      <div className="flex items-center gap-2">
                        <SubjectIcon name={icon} className="h-4 w-4 text-brand-navy" />
                        <span>{icon}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="test-desc" className="text-xs font-semibold text-brand-navy">
              Description / Instructions (Optional)
            </Label>
            <textarea
              id="test-desc"
              rows={2}
              placeholder="e.g. 30 Multiple Choice Questions. Time limit: 45 minutes."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 flex w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink/40 focus-ring"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-brand-navy">
              Test Type <span className="text-red-500">*</span>
            </Label>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    value: "GOOGLE_FORM" as const,
                    icon: ClipboardList,
                    title: "Google Form",
                    hint: "Answered online in the form",
                  },
                  {
                    value: "GOOGLE_DOC" as const,
                    icon: FileText,
                    title: "Google Doc",
                    hint: "Written paper, answers uploaded as photos",
                  },
                  {
                    value: "PDF" as const,
                    icon: FileType2,
                    title: "PDF upload",
                    hint: "Upload the paper; it is compressed first",
                  },
                ]
              ).map((opt) => {
                const Icon = opt.icon;
                const selected = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? "border-brand-blue bg-brand-tint text-brand-navy shadow-xs"
                        : "border-brand-border bg-white text-brand-ink/70 hover:border-brand-blue/50"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className="h-3.5 w-3.5 text-brand-blue" />
                      {opt.title}
                    </span>
                    <span className="text-[10px] leading-snug text-brand-ink/60">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isPdf ? (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-brand-navy flex items-center gap-1.5">
                  <FileType2 className="h-3.5 w-3.5 text-brand-blue" />
                  <span>
                    Question Paper PDF <span className="text-red-500">*</span>
                  </span>
                </Label>
                <span className="text-[10px] text-brand-ink/50 italic">
                  Only students sitting the test can open it
                </span>
              </div>

              <input
                ref={paperInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  void handlePaperFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />

              {paperBusy ? (
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-brand-border bg-brand-page p-3 text-xs text-brand-ink/75">
                  <AtomMark size={16} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
                  <span>{paperStatus}</span>
                </div>
              ) : paper ? (
                <div className="mt-1 flex items-center gap-3 rounded-lg border border-brand-border bg-white p-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-page">
                    <FileType2 className="h-5 w-5 text-brand-blue" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-brand-ink">{paper.name}</p>
                    <p className="text-[11px] text-brand-ink/55">
                      {paperSaving
                        ? `Compressed: ${paperSaving}`
                        : formatBytes(paper.bytes) || "Uploaded"}
                    </p>
                  </div>
                  {paperIsSaved && (
                    <button
                      type="button"
                      onClick={openSavedPaper}
                      disabled={openingPaper}
                      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-brand-blue hover:bg-brand-tint disabled:opacity-60"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => paperInputRef.current?.click()}
                    className="inline-flex h-9 shrink-0 items-center rounded-md px-2 text-[11px] font-medium text-brand-navy hover:bg-brand-tint"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => paperInputRef.current?.click()}
                  className="mt-1 flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-brand-border bg-brand-page p-4 text-center transition-colors hover:border-brand-blue/60 hover:bg-brand-tint"
                >
                  <Upload className="h-5 w-5 text-brand-blue" />
                  <span className="text-xs font-semibold text-brand-navy">Choose a PDF</span>
                </button>
              )}
              <p className="mt-1 text-[11px] text-brand-ink/55">
                The PDF is compressed in your browser before it uploads, and must come
                out under {formatBytes(MAX_PDF_BYTES)}. Students read it inside the
                portal and cannot download it from there.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="form-url" className="text-xs font-semibold text-brand-navy flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-brand-blue" />
                  <span>
                    {format === "GOOGLE_FORM" ? "Google Form URL" : "Google Doc URL"}{" "}
                    <span className="text-red-500">*</span>
                  </span>
                </Label>
                <span className="text-[10px] text-brand-ink/50 italic">
                  Never leaked to student HTML
                </span>
              </div>
              <Input
                id="form-url"
                type="url"
                placeholder={
                  format === "GOOGLE_FORM"
                    ? "https://docs.google.com/forms/d/e/.../viewform"
                    : "https://docs.google.com/document/d/.../edit"
                }
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                required
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-brand-ink/55">
                {format === "GOOGLE_FORM"
                  ? "Share the form so anyone with the link can respond, and paste the full docs.google.com/forms/\u2026 address \u2014 forms.gle short links cannot be shown inside the portal."
                  : "Share the doc as \u201cAnyone with the link \u2192 Viewer\u201d, or students will see a permission error."}
              </p>
            </div>
          )}

          <div>
            <Label
              htmlFor="test-duration"
              className="text-xs font-semibold text-brand-navy flex items-center gap-1.5"
            >
              <Timer className="h-3.5 w-3.5 text-brand-blue" />
              <span>Time Limit (minutes)</span>
            </Label>
            <Input
              id="test-duration"
              type="number"
              inputMode="numeric"
              min={MIN_DURATION_MINUTES}
              max={MAX_DURATION_MINUTES}
              step={1}
              placeholder="Leave blank for no time limit"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-brand-ink/55">
              The countdown starts when the student first opens the paper, not when
              you assign it, and the test submits itself automatically when it
              reaches zero. It never runs past the submission deadline.
            </p>
          </div>

          <div className="flex items-start space-x-2 pt-2">
            <Checkbox
              id="proctored"
              checked={proctored}
              onCheckedChange={(checked) => setProctored(Boolean(checked))}
              className="mt-0.5"
            />
            <label htmlFor="proctored" className="cursor-pointer leading-tight">
              <span className="text-xs font-medium text-brand-ink">
                Lock students to the exam tab
              </span>
              <span className="block text-[11px] text-brand-ink/55">
                Warn them when they switch to another tab, window or app, and submit
                the assessment automatically on the second time.
              </span>
            </label>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="active"
              checked={active}
              onCheckedChange={(checked) => setActive(Boolean(checked))}
            />
            <label
              htmlFor="active"
              className="text-xs font-medium text-brand-ink leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Active (Students with assignments can access this test)
            </label>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading || paperBusy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                paperBusy ||
                !title.trim() ||
                (isPdf ? !paper : !formUrl.trim())
              }
              className="bg-brand-navy hover:bg-brand-navy/90 text-white"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  <span>Saving...</span>
                </div>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Test Record"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function progressText(progress: CompressProgress): string {
  switch (progress.stage) {
    case "reading":
      return "Reading the PDF\u2026";
    case "optimizing":
      return "Compressing\u2026";
    case "redrawing":
      return `Compressing page ${progress.page} of ${progress.pages}\u2026`;
  }
}
