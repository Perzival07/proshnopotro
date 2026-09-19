"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { createTest, updateTest } from "./actions";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  AlertCircle,
  Link as LinkIcon,
  FileText,
  FileType2,
  ClipboardList,
  ListChecks,
  Timer,
} from "lucide-react";
import { SCHEME_PRESETS, type SchemePreset } from "@/lib/marking";
import { SUBJECTS } from "@/lib/subjects";
import { KIND_HINTS, KIND_LABELS, TEST_KINDS, type TestKind } from "@/lib/schedule";
import { BOARDS, CLASS_LEVELS } from "@/lib/syllabus";
import { detectTestFormat, toEmbedUrl, type LinkFormat, type TestFormat } from "@/lib/test-resource";
import { MAX_DURATION_MINUTES, MIN_DURATION_MINUTES } from "@/lib/exam-timer";

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
    durationMinutes: number | null;
    proctored: boolean;
    active: boolean;
    resultRelease?: "INSTANT" | "ON_RELEASE" | "AFTER_DEADLINE";
    answerSheets?: boolean;
    calculator?: boolean;
    board?: string | null;
    classLevel?: string | null;
    uploadMinutes?: number;
    kind?: "TEST" | "DPP" | "ASSIGNMENT";
  } | null;
}

type Mode = "LINK" | "QUESTIONS";

export function TestModal({ isOpen, onClose, testToEdit }: TestModalProps) {
  const isEditing = Boolean(testToEdit);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("LINK");
  const [schemePreset, setSchemePreset] = useState<SchemePreset>("JEE_MAIN");
  const [resultRelease, setResultRelease] = useState<"INSTANT" | "ON_RELEASE" | "AFTER_DEADLINE">("ON_RELEASE");
  const [answerSheets, setAnswerSheets] = useState(false);
  const [calculator, setCalculator] = useState(false);
  const [board, setBoard] = useState<string>("");
  const [uploadMinutes, setUploadMinutes] = useState("2");
  const [kind, setKind] = useState<TestKind>("TEST");
  const [classLevel, setClassLevel] = useState<string>("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState("Atom");
  const [formUrl, setFormUrl] = useState("");
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
      setFormUrl(testToEdit.formUrl);
      setDurationMinutes(
        testToEdit.durationMinutes ? String(testToEdit.durationMinutes) : ""
      );
      setProctored(testToEdit.proctored);
      setActive(testToEdit.active);
      setMode(testToEdit.format === "QUESTIONS" ? "QUESTIONS" : "LINK");
      setResultRelease(testToEdit.resultRelease ?? "ON_RELEASE");
      setAnswerSheets(testToEdit.answerSheets ?? false);
      setCalculator(testToEdit.calculator ?? false);
      setBoard(testToEdit.board ?? "");
      setUploadMinutes(String(testToEdit.uploadMinutes ?? 2));
      setKind(testToEdit.kind ?? "TEST");
      setClassLevel(testToEdit.classLevel ?? "");
    } else {
      setTitle("");
      setSubject("Physics");
      setDescription("");
      setIconName("Atom");
      setFormUrl("");
      setDurationMinutes("");
      setProctored(true);
      setActive(true);
      setMode("LINK");
      setSchemePreset("JEE_MAIN");
      setResultRelease("ON_RELEASE");
      setAnswerSheets(false);
      setCalculator(false);
      setBoard("");
      setClassLevel("");
      setUploadMinutes("2");
      setKind("TEST");
    }
    setError(null);
  }, [testToEdit, isOpen]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title,
      subject,
      description,
      iconName,
      mode,
      formUrl,
      schemePreset,
      resultRelease,
      answerSheets: mode === "QUESTIONS" ? answerSheets : undefined,
      calculator: mode === "QUESTIONS" ? calculator : undefined,
      board: mode === "QUESTIONS" ? board || null : undefined,
      uploadMinutes: mode === "LINK" || answerSheets ? uploadMinutes : undefined,
      kind,
      classLevel: mode === "QUESTIONS" ? classLevel || null : undefined,
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
      // A new portal paper has no questions yet; take the tutor straight to
      // where they are written.
      if (!isEditing && "testId" in res && res.testId && mode === "QUESTIONS") {
        router.push(`/admin/tests/${res.testId}/questions`);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Assessment Test" : "Create New Assessment Test"}
          </DialogTitle>
          <DialogDescription>
            Link a Google Form, Google Doc or Drive PDF, or write the questions in the portal so they are marked automatically.
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

          <div>
            <Label className="text-xs font-semibold text-brand-navy">Kind of work</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {TEST_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  title={KIND_HINTS[k]}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                    kind === k ? "border-brand-blue bg-brand-tint text-brand-navy" : "border-brand-border bg-white text-brand-ink/70 hover:border-brand-blue/50"
                  }`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-brand-ink/55">{KIND_HINTS[kind]}. Shown on the student&apos;s card.</p>
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
                  {SUBJECTS.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
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
              Question Paper <span className="text-red-500">*</span>
            </Label>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "LINK" as const,
                    icon: LinkIcon,
                    title: "Link to a paper",
                    hint: "Google Form, Google Doc or a PDF on Drive",
                  },
                  {
                    value: "QUESTIONS" as const,
                    icon: ListChecks,
                    title: "Write questions here",
                    hint: "MCQ and numerical, marked automatically",
                  },
                ]
              ).map((opt) => {
                const Icon = opt.icon;
                const selected = mode === opt.value;
                // A test keeps the kind it was created as.
                const locked = isEditing && !selected;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={locked}
                    onClick={() => setMode(opt.value)}
                    className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected
                        ? "border-brand-blue bg-brand-tint text-brand-navy shadow-xs"
                        : "border-brand-border bg-white text-brand-ink/70 hover:border-brand-blue/50"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className="h-3.5 w-3.5 text-brand-blue" />
                      {opt.title}
                    </span>
                    <span className="text-[10px] leading-snug text-brand-ink/60">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "LINK" ? (
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="form-url" className="text-xs font-semibold text-brand-navy flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5 text-brand-blue" />
                <span>
                  Question Paper Link <span className="text-red-500">*</span>
                </span>
              </Label>
              <span className="text-[10px] text-brand-ink/50 italic">
                Never leaked to student HTML
              </span>
            </div>
            <Input
              id="form-url"
              type="url"
              placeholder="Paste a Google Form, Google Doc or Google Drive PDF link"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              required
              className="mt-1 font-mono text-xs"
            />
            <LinkTypeHint url={formUrl} />
          </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-brand-border bg-brand-page p-3">
              {!isEditing && (
                <div>
                  <Label htmlFor="test-scheme" className="text-xs font-semibold text-brand-navy">
                    Marking Scheme
                  </Label>
                  <Select value={schemePreset} onValueChange={(v) => setSchemePreset(v as SchemePreset)}>
                    <SelectTrigger id="test-scheme" className="mt-1 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SCHEME_PRESETS) as SchemePreset[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {SCHEME_PRESETS[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-brand-ink/55">
                    A starting point. You can change the marks for each question type, section
                    or question on the paper&apos;s page.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold text-brand-navy">Show Students Their Results</Label>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: "ON_RELEASE" as const, title: "When I release them", hint: "Nobody sees answers while others are still writing" },
                      { value: "AFTER_DEADLINE" as const, title: "After the deadline", hint: "Solutions and videos open when the test closes" },
                      { value: "INSTANT" as const, title: "Right after submitting", hint: "Score and solutions at once" },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setResultRelease(opt.value)}
                      className={`flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors ${
                        resultRelease === opt.value
                          ? "border-brand-blue bg-white text-brand-navy shadow-xs"
                          : "border-brand-border bg-white/60 text-brand-ink/70 hover:border-brand-blue/50"
                      }`}
                    >
                      <span className="text-xs font-semibold">{opt.title}</span>
                      <span className="text-[10px] leading-snug text-brand-ink/60">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="answer-sheets"
                  checked={answerSheets}
                  onCheckedChange={(checked) => setAnswerSheets(Boolean(checked))}
                  className="mt-0.5"
                />
                <label htmlFor="answer-sheets" className="cursor-pointer leading-tight">
                  <span className="text-xs font-medium text-brand-ink">
                    Also collect photos of written answers
                  </span>
                  <span className="block text-[11px] text-brand-ink/55">
                    For papers with a subjective part, like ISI or CMI proofs. Students
                    photograph their sheets after the objective questions.
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-brand-navy">
                  Board
                  <Select value={board || "none"} onValueChange={(v) => setBoard(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {BOARDS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-xs font-semibold text-brand-navy">
                  Class
                  <Select value={classLevel || "none"} onValueChange={(v) => setClassLevel(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {CLASS_LEVELS.map((c) => (
                        <SelectItem key={c} value={c}>Class {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <p className="col-span-2 -mt-1 text-[11px] text-brand-ink/55">
                  Optional. With both set, questions can be tagged by chapter from the Syllabus page, and results
                  are broken down by chapter.
                </p>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="calculator"
                  checked={calculator}
                  onCheckedChange={(checked) => setCalculator(Boolean(checked))}
                  className="mt-0.5"
                />
                <label htmlFor="calculator" className="cursor-pointer leading-tight">
                  <span className="text-xs font-medium text-brand-ink">Allow an on-screen calculator</span>
                  <span className="block text-[11px] text-brand-ink/55">
                    A scientific calculator, as on GATE&apos;s computer-based test. Leave it off for
                    JEE Main and NEET, which do not allow one.
                  </span>
                </label>
              </div>
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

          {(mode === "LINK" || answerSheets) && (
            <div>
              <Label htmlFor="upload-minutes" className="text-xs font-semibold text-brand-navy">
                Minutes to upload answer photos
              </Label>
              <Input
                id="upload-minutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                step={1}
                value={uploadMinutes}
                onChange={(e) => setUploadMinutes(e.target.value)}
                className="mt-1 w-28"
              />
              <p className="mt-1 text-[11px] text-brand-ink/55">
                Counted from when the paper closes. Short stops students writing after time; allow about 10
                minutes for a board paper&apos;s long answer booklet. Leaving the page still ends it at once.
              </p>
            </div>
          )}

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
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || (mode === "LINK" && !formUrl.trim())}
              className="bg-brand-navy hover:bg-brand-navy/90 text-white"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  <span>Saving...</span>
                </div>
              ) : isEditing ? (
                "Save Changes"
              ) : mode === "QUESTIONS" ? (
                "Create & Add Questions"
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

const LINK_TYPES: Record<
  LinkFormat,
  { icon: React.ElementType; title: string; hint: string; share: string }
> = {
  GOOGLE_FORM: {
    icon: ClipboardList,
    title: "Google Form",
    hint: "answered online in the form",
    share: "Share the form so anyone with the link can respond.",
  },
  GOOGLE_DOC: {
    icon: FileText,
    title: "Google Doc",
    hint: "written paper, answers uploaded as photos",
    share: "Share the doc as \u201cAnyone with the link \u2192 Viewer\u201d, or students will see a permission error.",
  },
  PDF: {
    icon: FileType2,
    title: "PDF on Google Drive",
    hint: "written paper, read in the portal",
    share: "Share the file as \u201cAnyone with the link \u2192 Viewer\u201d. PDFs are not uploaded to the portal.",
  },
};

/**
 * Says what kind of paper the pasted link is, as the tutor types. Display
 * only: the server reads the type from the link again when the test is saved.
 */
function LinkTypeHint({ url }: { url: string }) {
  if (!url.trim()) {
    return (
      <p className="mt-1 text-[11px] text-brand-ink/55">
        The test type is worked out from the link: a Google Form is answered online; a
        Google Doc or a PDF on Google Drive is a written paper.
      </p>
    );
  }

  const format = detectTestFormat(url);
  if (!format) {
    return (
      <p className="mt-1 flex items-start gap-1.5 text-[11px] text-red-700">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Not a Google Form, Google Doc or Google Drive file link. Paste the full
          docs.google.com/forms/&hellip;, docs.google.com/document/&hellip; or
          drive.google.com/file/d/&hellip; address.
        </span>
      </p>
    );
  }

  const type = LINK_TYPES[format];
  const Icon = type.icon;
  const embeddable = toEmbedUrl(url, format) !== null;

  return (
    <div className="mt-1.5 space-y-1">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-tint px-2.5 py-1 text-[11px] font-medium text-brand-navy">
        <Icon className="h-3.5 w-3.5 text-brand-blue" />
        <span>
          <strong className="font-semibold">{type.title}</strong> &middot; {type.hint}
        </span>
      </span>
      <p className={`text-[11px] ${embeddable ? "text-brand-ink/55" : "text-red-700"}`}>
        {embeddable
          ? type.share
          : "A forms.gle short link cannot be shown inside the portal. Open the form, choose Send \u2192 link, and paste the full docs.google.com/forms/\u2026 address."}
      </p>
    </div>
  );
}
