"use client";

import React, { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { assignTestToStudents, AssignResult } from "./actions";
import { toDateTimeLocalValue } from "@/lib/utils";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  UserPlus,
  Calendar,
  Users,
  Mail,
  CheckCircle2,
  AlertCircle,
  Search,
  Info,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

interface TestOption {
  id: string;
  title: string;
  subject: string;
  active: boolean;
}

interface StudentOption {
  id: string;
  name: string | null;
  email: string;
  className: string | null;
  phone: string | null;
}

interface AssignClientProps {
  tests: TestOption[];
  students: StudentOption[];
}

export function AssignClient({ tests, students }: AssignClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTestId = searchParams.get("testId") || (tests[0]?.id ?? "");

  const [selectedTestId, setSelectedTestId] = useState(initialTestId);
  
  // Default deadline: 7 days out at 23:59 local time.
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    return toDateTimeLocalValue(d);
  }, []);

  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [assignMode, setAssignMode] = useState<"TABLE" | "BULK_PASTE">("TABLE");

  // Mode A: Student Table Selection
  const [selectedStudentEmails, setSelectedStudentEmails] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Mode B: Bulk Paste
  const [bulkEmailText, setBulkEmailText] = useState("");

  /**
   * Whether students who have already finished this test should get it back.
   * Off by default: the common case is handing a test to a new group, and a
   * reassignment resets an attempt and deletes its marks.
   */
  const [reassignSubmitted, setReassignSubmitted] = useState(false);

  // Submission & Summary States
  const [loading, setLoading] = useState(false);
  const [resultSummary, setResultSummary] = useState<AssignResult | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Emails whose recorded marks a confirmed reassignment would delete. */
  const [pendingGradedEmails, setPendingGradedEmails] = useState<string[] | null>(
    null
  );

  // Filter students in table
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = studentSearch.toLowerCase();
      return (
        s.email.toLowerCase().includes(q) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.className && s.className.toLowerCase().includes(q))
      );
    });
  }, [students, studentSearch]);

  const handleSelectAllStudents = (checked: boolean) => {
    if (checked) {
      const allEmails = filteredStudents.map((s) => s.email.toLowerCase());
      setSelectedStudentEmails(Array.from(new Set([...selectedStudentEmails, ...allEmails])));
    } else {
      const currentFilteredSet = new Set(filteredStudents.map((s) => s.email.toLowerCase()));
      setSelectedStudentEmails(selectedStudentEmails.filter((e) => !currentFilteredSet.has(e)));
    }
  };

  const handleToggleStudent = (email: string) => {
    const lower = email.toLowerCase();
    if (selectedStudentEmails.includes(lower)) {
      setSelectedStudentEmails(selectedStudentEmails.filter((e) => e !== lower));
    } else {
      setSelectedStudentEmails([...selectedStudentEmails, lower]);
    }
  };

  // Parse bulk text into array of emails
  const parsedBulkEmails = useMemo(() => {
    if (!bulkEmailText.trim()) return [];
    return bulkEmailText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
  }, [bulkEmailText]);

  // Reassigning graded students deletes their marks, so that batch comes back
  // as needsConfirmation with nothing written and routes through the dialog.
  const runAssign = async (clearMarks: boolean) => {
    setErrorMessage(null);
    setLoading(true);

    const emailsToProcess =
      assignMode === "TABLE" ? selectedStudentEmails : parsedBulkEmails;

    if (emailsToProcess.length === 0) {
      setErrorMessage("Please select or paste at least one email address.");
      setLoading(false);
      return;
    }

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      setErrorMessage("Please choose a valid submission deadline.");
      setLoading(false);
      return;
    }

    try {
      const res = await assignTestToStudents(
        selectedTestId,
        emailsToProcess,
        parsedDueDate.toISOString(),
        reassignSubmitted,
        clearMarks
      );

      setLoading(false);

      if (res.needsConfirmation) {
        setPendingGradedEmails(res.gradedEmails ?? []);
        return;
      }

      if (!res.success) {
        setErrorMessage(res.error || "Failed to assign test.");
      } else {
        setPendingGradedEmails(null);
        setResultSummary(res);
        setIsSummaryModalOpen(true);
        // Clear selections
        setSelectedStudentEmails([]);
        setBulkEmailText("");
      }
    } catch (err) {
      setErrorMessage("An unexpected error occurred while assigning tests.");
      setLoading(false);
    }
  };

  const handleSubmitAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    runAssign(false);
  };

  const selectedTest = tests.find((t) => t.id === selectedTestId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-navy">
          Assign Assessment Test
        </h1>
        <p className="text-body text-xs text-brand-ink/70 mt-1">
          Assign tests to enrolled students or pre-assign to unregistered candidate emails.
        </p>
      </div>

      <form onSubmit={handleSubmitAssignment} className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Select Test & Deadline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-white rounded-xl border border-brand-border shadow-card">
          <div>
            <Label htmlFor="select-test" className="text-xs font-semibold text-brand-navy">
              1. Choose Target Assessment Test <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedTestId} onValueChange={setSelectedTestId}>
              <SelectTrigger id="select-test" className="mt-1.5 h-10">
                <SelectValue placeholder="Select a test..." />
              </SelectTrigger>
              <SelectContent>
                {tests.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="font-medium text-brand-navy">{t.title}</span>
                    <span className="text-xs text-brand-ink/50 ml-2">({t.subject})</span>
                    {!t.active && (
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-2">
                        Inactive
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTest && !selectedTest.active && (
              <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                This test is currently inactive. Students won&apos;t be able to open it until activated.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="due-date" className="text-xs font-semibold text-brand-navy flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-brand-blue" />
              <span>2. Submission Deadline (Date & Time) <span className="text-red-500">*</span></span>
            </Label>
            <Input
              id="due-date"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="mt-1.5 h-10 text-xs"
            />
            <p className="text-[11px] text-brand-ink/50 mt-1">
              After this deadline, the student card switches to &ldquo;Closed&rdquo;.
            </p>
          </div>
        </div>

        {/* Step 2: Choose Assignment Method */}
        <div className="p-5 bg-white rounded-xl border border-brand-border shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-3">
            <div>
              <h2 className="font-heading font-semibold text-sm text-brand-navy">
                3. Select Student Recipients
              </h2>
              <p className="text-xs text-brand-ink/60 mt-0.5">
                Pick from registered roster or paste a batch list of emails.
              </p>
            </div>

            {/* Mode Switcher Buttons */}
            <div className="flex items-center gap-1 bg-brand-page p-1 rounded-lg border border-brand-border">
              <button
                type="button"
                onClick={() => setAssignMode("TABLE")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  assignMode === "TABLE"
                    ? "bg-white text-brand-navy font-semibold shadow-xs border border-brand-border"
                    : "text-brand-ink/70 hover:text-brand-navy"
                }`}
              >
                <Users className="h-3.5 w-3.5 text-brand-blue" />
                <span>Registered Students ({students.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignMode("BULK_PASTE")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  assignMode === "BULK_PASTE"
                    ? "bg-white text-brand-navy font-semibold shadow-xs border border-brand-border"
                    : "text-brand-ink/70 hover:text-brand-navy"
                }`}
              >
                <Mail className="h-3.5 w-3.5 text-brand-navy" />
                <span>Bulk Email Paste</span>
              </button>
            </div>
          </div>

          {/* Option A: Table of Registered Students */}
          {assignMode === "TABLE" && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-brand-ink/40" />
                  <Input
                    placeholder="Search by student name, email, or class..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <span className="text-xs font-medium text-brand-navy">
                  <strong>{selectedStudentEmails.length}</strong> selected
                </span>
              </div>

              {/* On a phone the five-column picker cut the email -- the one
                  field that identifies who is being assigned -- so below md it
                  becomes a tappable list with the email wrapped in full. */}
              <div className="max-h-[350px] space-y-2 overflow-y-auto md:hidden">
                {filteredStudents.length === 0 ? (
                  <div className="rounded-lg border border-brand-border bg-white p-4 text-center text-xs text-brand-ink/60">
                    {students.length === 0
                      ? "No registered students found. You can still use 'Bulk Email Paste' below."
                      : "No students matching your search query."}
                  </div>
                ) : (
                  filteredStudents.map((student) => {
                    const isSelected = selectedStudentEmails.includes(
                      student.email.toLowerCase()
                    );
                    return (
                      // A div, not a button: Radix's Checkbox renders its own
                      // <button>, and a button inside a button is invalid HTML
                      // that fails hydration. The checkbox stays the real
                      // control; the row is just a larger tap target for it.
                      <div
                        key={student.id}
                        role="group"
                        onClick={() => handleToggleStudent(student.email)}
                        className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-brand-blue bg-brand-tint/60"
                            : "border-brand-border bg-white"
                        }`}
                      >
                        <span className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleStudent(student.email)}
                            aria-label={`Select ${student.name || student.email}`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-brand-navy">
                            {student.name || "Student"}
                          </span>
                          <span className="mt-0.5 block break-all font-mono text-[11px] text-brand-ink/75">
                            {student.email}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-brand-ink/60">
                            {student.className && (
                              <span className="rounded bg-brand-tint px-2 py-0.5 font-medium text-brand-navy">
                                {student.className}
                              </span>
                            )}
                            {student.phone && <span>{student.phone}</span>}
                          </span>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hidden md:block rounded-lg border border-brand-border overflow-hidden max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={
                            filteredStudents.length > 0 &&
                            filteredStudents.every((s) =>
                              selectedStudentEmails.includes(s.email.toLowerCase())
                            )
                          }
                          onCheckedChange={handleSelectAllStudents}
                        />
                      </TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Email Address</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-xs text-brand-ink/60">
                          {students.length === 0
                            ? "No registered students found in database. You can still use 'Bulk Email Paste' below!"
                            : "No students matching your search query."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => {
                        const isSelected = selectedStudentEmails.includes(student.email.toLowerCase());
                        return (
                          <TableRow
                            key={student.id}
                            className={`cursor-pointer text-xs ${isSelected ? "bg-brand-tint/50" : ""}`}
                            onClick={() => handleToggleStudent(student.email)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleStudent(student.email)}
                              />
                            </TableCell>
                            <TableCell className="font-semibold text-brand-navy">
                              {student.name || "Student"}
                            </TableCell>
                            <TableCell className="font-mono text-brand-ink/80">
                              {student.email}
                            </TableCell>
                            <TableCell>
                              {student.className ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-brand-tint text-brand-navy">
                                  {student.className}
                                </span>
                              ) : (
                                <span className="text-brand-ink/40 italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-brand-ink/70">
                              {student.phone || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Option B: Bulk Email Paste */}
          {assignMode === "BULK_PASTE" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="bulk-emails" className="text-xs font-semibold text-brand-navy">
                  Paste Student Emails (Comma, semicolon, or newline separated)
                </Label>
                <textarea
                  id="bulk-emails"
                  rows={6}
                  placeholder={`rahul.sharma@gmail.com\npriya.patel@gmail.com\namit.kumar@example.com`}
                  value={bulkEmailText}
                  onChange={(e) => setBulkEmailText(e.target.value)}
                  className="mt-1.5 flex w-full rounded-md border border-brand-border bg-white p-3 font-mono text-xs text-brand-ink placeholder:text-brand-ink/40 focus-ring"
                />
              </div>

              <div className="flex items-center justify-between text-xs p-3 bg-brand-page rounded-lg border border-brand-border">
                <span className="text-brand-ink/70">
                  Detected Emails: <strong>{parsedBulkEmails.length}</strong>
                </span>
                <span className="text-brand-ink/50 text-[11px]">
                  Duplicates are skipped, as are students who already hold this
                  test unless you reassign them below.
                </span>
              </div>
            </div>
          )}

          {/* Reassignment toggle: the one control that can overwrite an
              existing attempt, so it sits with the button that acts on it
              rather than up with the deadline. */}
          <div className="rounded-lg border border-brand-border bg-brand-page p-3">
            <div
              role="group"
              onClick={() => setReassignSubmitted(!reassignSubmitted)}
              className="flex cursor-pointer items-start gap-3"
            >
              <span className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  id="reassign-submitted"
                  checked={reassignSubmitted}
                  onCheckedChange={(checked) =>
                    setReassignSubmitted(checked === true)
                  }
                  aria-label="Reassign students who have already submitted"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy">
                  <RotateCcw className="h-3.5 w-3.5 text-brand-blue" />
                  <span>Reassign students who have already submitted</span>
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-brand-ink/65">
                  Gives a fresh attempt at the deadline above to anyone on this
                  list who already handed the test in or was auto-submitted by
                  the timer or the tab guard. Their countdown and tab-switch
                  tally restart, and any marks recorded for the old attempt are
                  deleted. Students still working on the test are never touched.
                </span>
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-3 flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={loading || !selectedTestId}
              className="bg-brand-navy hover:bg-brand-navy/90 text-white font-medium px-6 flex items-center gap-2 shadow-sm"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={18} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  <span>Assigning Test...</span>
                </div>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>
                    Assign to{" "}
                    {assignMode === "TABLE"
                      ? `${selectedStudentEmails.length} Selected Students`
                      : `${parsedBulkEmails.length} Email Addresses`}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Confirm destructive reassignment: reopening deletes recorded marks */}
      <Dialog
        open={Boolean(pendingGradedEmails)}
        onOpenChange={(open) => !open && setPendingGradedEmails(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-red-700">
                Delete recorded marks?
              </DialogTitle>
            </div>
            <DialogDescription>
              {pendingGradedEmails && (
                <>
                  <strong>{pendingGradedEmails.length}</strong> of these
                  students have marks recorded for{" "}
                  <strong>{selectedTest?.title}</strong>. Reassigning the test
                  deletes those scores, because a saved result keeps the test
                  locked for them. This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {pendingGradedEmails && pendingGradedEmails.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3">
              {/* break-all rather than truncate: a run of long emails would
                  otherwise stretch the dialog past the screen. */}
              <p className="break-all font-mono text-[11px] text-red-700">
                {pendingGradedEmails.join(", ")}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingGradedEmails(null)}
              disabled={loading}
            >
              Keep marks
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={() => runAssign(true)}
              className="bg-red-600 font-semibold text-white hover:bg-red-700"
            >
              {loading ? "Reassigning..." : "Delete marks & reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      <Dialog
        open={isSummaryModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSummaryModalOpen(false);
            router.push(`/admin/roster?testId=${selectedTestId}`);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#085041]">
              <CheckCircle2 className="h-5 w-5" />
              <DialogTitle className="text-[#085041]">
                Assignment Process Completed
              </DialogTitle>
            </div>
            <DialogDescription>
              Summary of assigned test invitations for <strong>{selectedTest?.title}</strong>.
            </DialogDescription>
          </DialogHeader>

          {resultSummary && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-[#E1F5EE] border border-[#C2EBDB] rounded-lg text-[#085041] flex items-center justify-between">
                <span className="font-semibold">Newly Assigned:</span>
                <span className="font-heading font-bold text-sm">
                  +{resultSummary.newlyAssignedCount} students
                </span>
              </div>

              {resultSummary.reassignedCount > 0 && (
                <div className="p-3 bg-brand-tint border border-brand-blue/30 rounded-lg text-brand-navy space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Reassigned a fresh attempt:</span>
                    <span className="font-heading font-bold text-sm">
                      {resultSummary.reassignedCount} students
                    </span>
                  </div>
                  {resultSummary.clearedMarksCount > 0 && (
                    <p className="text-[11px] text-brand-ink/70">
                      {resultSummary.clearedMarksCount} recorded{" "}
                      {resultSummary.clearedMarksCount === 1 ? "score was" : "scores were"}{" "}
                      deleted along with the old attempt.
                    </p>
                  )}
                </div>
              )}

              {resultSummary.skippedCount > 0 && (
                <div className="p-3 bg-[#F1EFE8] border border-[#E2DFD6] rounded-lg text-[#444441] flex items-center justify-between">
                  <span>Skipped (test still open for them):</span>
                  <span className="font-semibold">{resultSummary.skippedCount}</span>
                </div>
              )}

              {/* The one skip a tutor may not have meant, so it says what to
                  do about it rather than only reporting the number. */}
              {resultSummary.alreadySubmittedCount > 0 && (
                <div className="p-3 bg-[#F1EFE8] border border-[#E2DFD6] rounded-lg text-[#444441] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Skipped (already submitted):</span>
                    <span className="font-semibold">
                      {resultSummary.alreadySubmittedCount}
                    </span>
                  </div>
                  <p className="text-[11px]">
                    To give them another go, tick &ldquo;Reassign students who
                    have already submitted&rdquo; and assign again.
                  </p>
                </div>
              )}

              {resultSummary.invalidCount > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Invalid Email Format:</span>
                    <span>{resultSummary.invalidCount}</span>
                  </div>
                  {/* break-all rather than truncate: a run of long emails
                      would otherwise stretch the dialog past the screen. */}
                  <p className="text-[11px] text-red-600 break-all">
                    {resultSummary.invalidEmails.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              onClick={() => {
                setIsSummaryModalOpen(false);
                router.push(`/admin/roster?testId=${selectedTestId}`);
              }}
              className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white"
            >
              View Test Roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
