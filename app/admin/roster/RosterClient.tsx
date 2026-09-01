"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { saveStudentGradeAction, quickToggleSubmissionAction } from "./actions";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  Download,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  UserCheck,
  UserX,
  Edit3,
  Check,
  AlertCircle,
} from "lucide-react";

interface TestOption {
  id: string;
  title: string;
  subject: string;
}

export interface RosterAssignment {
  id: string;
  studentEmail: string;
  assignedAt: Date;
  dueAt: Date;
  status: "ASSIGNED" | "SUBMITTED";
  user: {
    id: string;
    name: string | null;
    className: string | null;
    phone: string | null;
    profileComplete: boolean;
  } | null;
  result: {
    id: string;
    score: number;
    maxScore: number;
    submittedAt: Date;
  } | null;
}

interface RosterClientProps {
  tests: TestOption[];
  selectedTestId: string;
  assignments: RosterAssignment[];
}

export function RosterClient({
  tests,
  selectedTestId,
  assignments,
}: RosterClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ASSIGNED" | "SUBMITTED" | "NOT_SIGNED_IN"
  >("ALL");
  const [sortField, setSortField] = useState<
    "email" | "name" | "class" | "status" | "score" | "assignedAt"
  >("assignedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Manual Grading Modal State
  const [gradingAssignment, setGradingAssignment] = useState<RosterAssignment | null>(null);
  const [gradeStatus, setGradeStatus] = useState<"ASSIGNED" | "SUBMITTED">("SUBMITTED");
  const [scoreInput, setScoreInput] = useState<string>("");
  const [maxScoreInput, setMaxScoreInput] = useState<string>("50");
  const [savingGrade, setSavingGrade] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const currentTest = tests.find((t) => t.id === selectedTestId);

  // Open Grading Modal
  const openGradingModal = (assignment: RosterAssignment) => {
    setGradingAssignment(assignment);
    setGradeStatus(assignment.status);
    setScoreInput(assignment.result ? String(assignment.result.score) : "");
    setMaxScoreInput(assignment.result ? String(assignment.result.maxScore) : "50");
    setModalError(null);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingAssignment) return;

    setSavingGrade(true);
    setModalError(null);

    let parsedScore: number | null = null;
    let parsedMaxScore: number | null = null;

    if (scoreInput.trim() !== "") {
      parsedScore = parseFloat(scoreInput.trim());
      parsedMaxScore = parseFloat(maxScoreInput.trim() || "50");

      if (isNaN(parsedScore) || isNaN(parsedMaxScore)) {
        setModalError("Please enter valid numerical marks.");
        setSavingGrade(false);
        return;
      }

      if (parsedScore < 0 || parsedScore > parsedMaxScore) {
        setModalError(`Score must be between 0 and ${parsedMaxScore}.`);
        setSavingGrade(false);
        return;
      }
    }

    const res = await saveStudentGradeAction({
      assignmentId: gradingAssignment.id,
      status: gradeStatus,
      score: parsedScore,
      maxScore: parsedMaxScore,
    });

    setSavingGrade(false);

    if (res.error) {
      setModalError(res.error);
    } else {
      setGradingAssignment(null);
      router.refresh();
    }
  };

  const handleQuickToggle = async (assignment: RosterAssignment) => {
    await quickToggleSubmissionAction(assignment.id, assignment.status);
    router.refresh();
  };

  // Filter Logic
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        a.studentEmail.toLowerCase().includes(q) ||
        (a.user?.name && a.user.name.toLowerCase().includes(q)) ||
        (a.user?.className && a.user.className.toLowerCase().includes(q)) ||
        (a.user?.phone && a.user.phone.toLowerCase().includes(q));

      let matchesStatus = true;
      if (statusFilter === "ASSIGNED") {
        matchesStatus = a.status === "ASSIGNED" && a.result === null;
      } else if (statusFilter === "SUBMITTED") {
        matchesStatus = a.status === "SUBMITTED" || a.result !== null;
      } else if (statusFilter === "NOT_SIGNED_IN") {
        matchesStatus = a.user === null;
      }

      return matchesSearch && matchesStatus;
    });
  }, [assignments, search, statusFilter]);

  // Sorting Logic
  const sortedAssignments = useMemo(() => {
    return [...filteredAssignments].sort((a, b) => {
      let valA: any = a[sortField as keyof RosterAssignment];
      let valB: any = b[sortField as keyof RosterAssignment];

      if (sortField === "email") {
        valA = a.studentEmail;
        valB = b.studentEmail;
      } else if (sortField === "name") {
        valA = a.user?.name || "zzz";
        valB = b.user?.name || "zzz";
      } else if (sortField === "class") {
        valA = a.user?.className || "zzz";
        valB = b.user?.className || "zzz";
      } else if (sortField === "score") {
        valA = a.result?.score ?? -1;
        valB = b.result?.score ?? -1;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredAssignments, sortField, sortOrder]);

  // 50 rows per page pagination
  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAssignments.slice(start, start + pageSize);
  }, [sortedAssignments, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedAssignments.length / pageSize) || 1;

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!currentTest || assignments.length === 0) return;

    const headers = [
      "Email",
      "Name",
      "Class",
      "Phone",
      "Signed In",
      "Status",
      "Score",
      "Max Score",
      "Submitted At",
      "Assigned At",
      "Deadline",
    ];

    const escapeCsv = (value: string | number | null | undefined) => {
      const str = value === null || value === undefined ? "" : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = assignments.map((a) => [
      a.studentEmail,
      a.user?.name || "",
      a.user?.className || "",
      a.user?.phone || "",
      a.user ? "Yes" : "No",
      a.status,
      a.result ? a.result.score : "",
      a.result ? a.result.maxScore : "",
      a.result ? new Date(a.result.submittedAt).toISOString() : "",
      new Date(a.assignedAt).toISOString(),
      new Date(a.dueAt).toISOString(),
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Roster_${currentTest.title.replace(/[^a-z0-9]/gi, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-navy">
            Test Rosters & Manual Grading
          </h1>
          <p className="text-body text-xs text-brand-ink/70 mt-1">
            Review submissions, manually enter test marks after checking copies, and update student completion status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleExportCSV}
            disabled={assignments.length === 0}
            variant="outline"
            className="border-brand-navy/30 text-brand-navy hover:bg-brand-tint flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Test Picker & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-brand-border shadow-card">
        {/* Test Selector */}
        <div>
          <label className="text-[11px] font-semibold text-brand-navy block mb-1">
            Select Test
          </label>
          <Select
            value={selectedTestId}
            onValueChange={(val) => {
              router.push(`/admin/roster?testId=${val}`);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Choose a test..." />
            </SelectTrigger>
            <SelectContent>
              {tests.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="font-medium text-brand-navy">{t.title}</span>
                  <span className="text-brand-ink/50 ml-1.5">({t.subject})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div>
          <label className="text-[11px] font-semibold text-brand-navy block mb-1">
            Search Roster
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-brand-ink/40" />
            <Input
              placeholder="Search by email, name, class..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div>
          <label className="text-[11px] font-semibold text-brand-navy block mb-1">
            Status Filter
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { key: "ALL", label: "All" },
                { key: "ASSIGNED", label: "Pending" },
                { key: "SUBMITTED", label: "Submitted" },
                { key: "NOT_SIGNED_IN", label: "Unregistered" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setStatusFilter(f.key);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  statusFilter === f.key
                    ? "bg-brand-navy text-white font-medium"
                    : "bg-brand-page text-brand-ink/70 hover:bg-brand-tint border border-brand-border"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="rounded-xl border border-brand-border bg-white shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("email")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Assigned Email</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Student Name</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("class")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Class</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>

              <TableHead className="text-center">Account</TableHead>

              <TableHead
                className="text-center cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Status</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>

              <TableHead
                className="text-right cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("score")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Score</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>

              <TableHead className="text-center w-28">Grading Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAssignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-brand-ink/60">
                  {assignments.length === 0
                    ? "No students have been assigned to this test yet. Click 'Assign Tests' to start."
                    : "No students match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedAssignments.map((a) => {
                const isSubmitted = a.status === "SUBMITTED" || a.result !== null;
                const hasSignedIn = a.user !== null;

                return (
                  <TableRow key={a.id} className="text-xs hover:bg-brand-tint/30 transition-colors">
                    {/* Email */}
                    <TableCell className="font-mono text-brand-navy font-medium">
                      {a.studentEmail}
                    </TableCell>

                    {/* Name */}
                    <TableCell className="font-medium">
                      {a.user?.name ? (
                        <span>{a.user.name}</span>
                      ) : (
                        <span className="text-brand-ink/40 italic">Not set</span>
                      )}
                    </TableCell>

                    {/* Class */}
                    <TableCell>
                      {a.user?.className ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-brand-tint text-brand-navy">
                          {a.user.className}
                        </span>
                      ) : (
                        <span className="text-brand-ink/40 italic">—</span>
                      )}
                    </TableCell>

                    {/* Signed-in status */}
                    <TableCell className="text-center">
                      {hasSignedIn ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-navy bg-brand-tint px-2 py-0.5 rounded-full border border-brand-blue/30">
                          <UserCheck className="h-3 w-3 text-brand-blue" />
                          Signed In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#444441] bg-[#F1EFE8] px-2 py-0.5 rounded-full border border-[#E2DFD6]">
                          <UserX className="h-3 w-3 opacity-60" />
                          Pending
                        </span>
                      )}
                    </TableCell>

                    {/* Submission status */}
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleQuickToggle(a)}
                        title="Click to toggle status"
                        className="transition-transform active:scale-95"
                      >
                        {isSubmitted ? (
                          <Badge variant="submitted" className="gap-1 shadow-xs cursor-pointer hover:opacity-90">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="available" className="gap-1 shadow-xs cursor-pointer hover:opacity-90">
                            <Clock className="h-3 w-3" />
                            Assigned
                          </Badge>
                        )}
                      </button>
                    </TableCell>

                    {/* Score */}
                    <TableCell className="text-right font-mono font-semibold">
                      {a.result ? (
                        <span className="text-[#085041] font-bold bg-[#E1F5EE] px-2 py-0.5 rounded border border-[#A2E2C8]">
                          {a.result.score} / {a.result.maxScore}
                        </span>
                      ) : (
                        <span className="text-brand-ink/30 italic font-normal">—</span>
                      )}
                    </TableCell>

                    {/* Grade & Edit Action */}
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openGradingModal(a)}
                        className="h-7 px-2.5 text-[11px] font-semibold border-brand-blue/40 text-brand-navy hover:bg-brand-blue hover:text-white transition-colors flex items-center gap-1 mx-auto"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>{a.result ? "Edit Marks" : "Enter Marks"}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border bg-brand-page/50 text-xs text-brand-ink/70">
          <div>
            Showing <strong>{Math.min(sortedAssignments.length, (currentPage - 1) * pageSize + 1)}</strong> to{" "}
            <strong>{Math.min(sortedAssignments.length, currentPage * pageSize)}</strong> of{" "}
            <strong>{sortedAssignments.length}</strong> assigned students
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="h-7 text-xs"
              >
                Previous
              </Button>
              <span className="px-2 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="h-7 text-xs"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Manual Grade Entry Dialog */}
      {gradingAssignment && (
        <Dialog open={Boolean(gradingAssignment)} onOpenChange={(open) => !open && setGradingAssignment(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-heading font-bold text-brand-navy">
                Grade Assessment & Submission
              </DialogTitle>
              <DialogDescription className="text-xs text-brand-ink/70">
                Enter checked marks and set completion status for this student.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveGrade} className="space-y-4 py-2">
              {modalError && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Student Summary Box */}
              <div className="p-3 bg-brand-page rounded-lg border border-brand-border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-brand-ink/60">Candidate Email:</span>
                  <span className="font-mono font-medium text-brand-navy">{gradingAssignment.studentEmail}</span>
                </div>
                {gradingAssignment.user?.name && (
                  <div className="flex justify-between">
                    <span className="text-brand-ink/60">Student Name:</span>
                    <span className="font-semibold text-brand-navy">{gradingAssignment.user.name}</span>
                  </div>
                )}
                {gradingAssignment.user?.className && (
                  <div className="flex justify-between">
                    <span className="text-brand-ink/60">Class / Batch:</span>
                    <span className="text-brand-navy">{gradingAssignment.user.className}</span>
                  </div>
                )}
              </div>

              {/* Submission Status Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-brand-navy">
                  Submission Status
                </Label>
                <Select
                  value={gradeStatus}
                  onValueChange={(val: "ASSIGNED" | "SUBMITTED") => setGradeStatus(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUBMITTED">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-medium">Completed / Submitted</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ASSIGNED">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="font-medium">Pending / Assigned</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Marks Entry Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-brand-navy">
                    Marks Obtained <span className="text-brand-ink/50 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 45"
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-brand-navy">
                    Total Maximum Marks
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="e.g. 50"
                    value={maxScoreInput}
                    onChange={(e) => setMaxScoreInput(e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                </div>
              </div>

              <p className="text-[11px] text-brand-ink/60 italic pt-1">
                Tip: If this is a non-graded assessment, leave Marks blank and keep status as "Completed".
              </p>

              <DialogFooter className="pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGradingAssignment(null)}
                  disabled={savingGrade}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingGrade}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-white font-semibold flex items-center gap-2"
                >
                  {savingGrade ? (
                    <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>Save Marks & Status</span>
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
