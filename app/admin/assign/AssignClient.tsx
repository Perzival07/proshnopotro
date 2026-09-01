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
  
  // Default deadline: 7 days in future at 23:59 local time.
  // datetime-local expects a LOCAL wall-clock string, so build it from local
  // parts -- toISOString() would shift it into UTC (e.g. 23:59 IST -> 18:29).
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }, []);

  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [assignMode, setAssignMode] = useState<"TABLE" | "BULK_PASTE">("TABLE");

  // Mode A: Student Table Selection
  const [selectedStudentEmails, setSelectedStudentEmails] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Mode B: Bulk Paste
  const [bulkEmailText, setBulkEmailText] = useState("");

  // Submission & Summary States
  const [loading, setLoading] = useState(false);
  const [resultSummary, setResultSummary] = useState<AssignResult | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
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
        parsedDueDate.toISOString()
      );

      setLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to assign test.");
      } else {
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
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
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

              <div className="rounded-lg border border-brand-border overflow-hidden max-h-[350px] overflow-y-auto">
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
                  Duplicate emails and already assigned students will be skipped automatically.
                </span>
              </div>
            </div>
          )}

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

              {resultSummary.skippedCount > 0 && (
                <div className="p-3 bg-[#F1EFE8] border border-[#E2DFD6] rounded-lg text-[#444441] flex items-center justify-between">
                  <span>Skipped (Already Assigned):</span>
                  <span className="font-semibold">{resultSummary.skippedCount}</span>
                </div>
              )}

              {resultSummary.invalidCount > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Invalid Email Format:</span>
                    <span>{resultSummary.invalidCount}</span>
                  </div>
                  <p className="text-[11px] text-red-600 truncate">
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
