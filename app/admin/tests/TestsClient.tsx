"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
import { SubjectIcon } from "@/components/SubjectIcon";
import { TestModal } from "./TestModal";
import { toggleTestActive } from "./actions";
import { formatDateShort } from "@/lib/utils";
import { formatDurationLabel } from "@/lib/exam-timer";
import type { TestFormat } from "@/lib/test-resource";
import {
  Plus,
  Search,
  FileText,
  ClipboardList,
  Edit2,
  Power,
  Users,
  UserPlus,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Timer,
} from "lucide-react";

interface TestItem {
  id: string;
  title: string;
  subject: string;
  description?: string | null;
  iconName: string;
  format: TestFormat;
  formUrl: string;
  durationMinutes: number | null;
  active: boolean;
  createdAt: Date;
  _count: {
    assignments: number;
  };
  submittedCount: number;
}

interface TestsClientProps {
  tests: TestItem[];
}

export function TestsClient({ tests }: TestsClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [sortField, setSortField] = useState<"title" | "subject" | "createdAt" | "assignments">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testToEdit, setTestToEdit] = useState<TestItem | null>(null);

  // Status-toggle feedback
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Filter & Search Logic
  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && t.active) ||
        (statusFilter === "INACTIVE" && !t.active);

      return matchesSearch && matchesStatus;
    });
  }, [tests, search, statusFilter]);

  // Sorting Logic
  const sortedTests = useMemo(() => {
    return [...filteredTests].sort((a, b) => {
      if (sortField === "assignments") {
        const valA = a._count.assignments;
        const valB = b._count.assignments;
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      const valA = a[sortField];
      const valB = b[sortField];

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTests, sortField, sortOrder]);

  // 50 rows per page pagination
  const paginatedTests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTests.slice(start, start + pageSize);
  }, [sortedTests, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedTests.length / pageSize) || 1;

  // If the list shrinks (filter, or a refresh after an edit) a stale currentPage
  // renders an empty table while the pager hides itself -- stranding the user.
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

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setToggleError(null);
    setTogglingId(id);
    try {
      const res = await toggleTestActive(id, !currentStatus);
      if (res?.error) setToggleError(res.error);
    } catch {
      setToggleError("Could not reach the server to update this test.");
    } finally {
      setTogglingId(null);
    }
  };

  const openCreateModal = () => {
    setTestToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (test: TestItem) => {
    setTestToEdit(test);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-navy">
            Assessment Tests Directory
          </h1>
          <p className="text-body text-xs text-brand-ink/70 mt-1">
            Configure Google Form assessment links, manage status, and monitor assignment rosters.
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="bg-brand-navy hover:bg-brand-navy/90 text-white shadow-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Assessment Test</span>
        </Button>
      </div>

      {toggleError && (
        <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{toggleError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-brand-border shadow-card">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-ink/40" />
          <Input
            placeholder="Search tests by title or subject..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-brand-ink/60 mr-1">Status:</span>
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setStatusFilter(filter);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                statusFilter === filter
                  ? "bg-brand-navy text-white shadow-xs"
                  : "bg-brand-page text-brand-ink/70 hover:bg-brand-tint hover:text-brand-navy border border-brand-border"
              }`}
            >
              {filter === "ALL" && `All (${tests.length})`}
              {filter === "ACTIVE" && `Active (${tests.filter((t) => t.active).length})`}
              {filter === "INACTIVE" && `Inactive (${tests.filter((t) => !t.active).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Dense Table */}
      <div className="rounded-xl border border-brand-border bg-white shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45px]">Icon</TableHead>
              <TableHead
                className="cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Test Title</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>
              <TableHead
                className="w-[140px] cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("subject")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Subject</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>
              <TableHead className="w-[100px] text-center">Status</TableHead>
              <TableHead
                className="w-[130px] text-center cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("assignments")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Assigned / Done</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>
              <TableHead
                className="w-[120px] cursor-pointer hover:text-brand-blue select-none"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Created</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </TableHead>
              <TableHead className="w-[190px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-brand-ink/60">
                  No assessment tests found matching current criteria.
                </TableCell>
              </TableRow>
            ) : (
              paginatedTests.map((test) => (
                <TableRow key={test.id} className="text-xs">
                  <TableCell>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-tint text-brand-navy">
                      <SubjectIcon name={test.iconName} className="h-4 w-4" />
                    </div>
                  </TableCell>

                  <TableCell className="font-medium text-brand-navy">
                    <div>
                      <span className="font-semibold text-[13px]">{test.title}</span>
                      {test.description && (
                        <p className="text-[11px] text-brand-ink/60 truncate max-w-md">
                          {test.description}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-[11px] font-medium bg-brand-tint text-brand-navy">
                        {test.subject}
                      </span>
                      <span className="inline-flex w-fit items-center gap-1 text-[10px] font-medium text-brand-ink/60">
                        {test.format === "GOOGLE_DOC" ? (
                          <>
                            <FileText className="h-3 w-3" />
                            Written
                          </>
                        ) : (
                          <>
                            <ClipboardList className="h-3 w-3" />
                            Form
                          </>
                        )}
                        {test.durationMinutes ? (
                          <span className="inline-flex items-center gap-1 text-brand-blue">
                            <Timer className="h-3 w-3" />
                            {formatDurationLabel(test.durationMinutes)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    {test.active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#085041] bg-[#E1F5EE] px-2 py-0.5 rounded-full border border-[#C2EBDB]">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#444441] bg-[#F1EFE8] px-2 py-0.5 rounded-full border border-[#E2DFD6]">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-center font-mono">
                    <span className="font-semibold text-brand-navy">
                      {test.submittedCount}
                    </span>
                    <span className="text-brand-ink/50"> / {test._count.assignments}</span>
                  </TableCell>

                  <TableCell className="text-brand-ink/70">
                    {formatDateShort(test.createdAt)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/admin/roster?testId=${test.id}`}
                        title="View Roster"
                        className="p-1.5 rounded-md hover:bg-brand-tint text-brand-navy transition-colors inline-flex items-center"
                      >
                        <Users className="h-3.5 w-3.5" />
                      </Link>

                      <Link
                        href={`/admin/assign?testId=${test.id}`}
                        title="Assign Students"
                        className="p-1.5 rounded-md hover:bg-brand-tint text-brand-blue transition-colors inline-flex items-center"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Link>

                      <button
                        onClick={() => openEditModal(test)}
                        title="Edit Test Details"
                        className="p-1.5 rounded-md hover:bg-brand-tint text-brand-ink/80 hover:text-brand-navy transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleActive(test.id, test.active)}
                        disabled={togglingId === test.id}
                        title={test.active ? "Deactivate Test" : "Activate Test"}
                        className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                          test.active
                            ? "hover:bg-red-50 text-red-600"
                            : "hover:bg-green-50 text-green-700"
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border bg-brand-page/50 text-xs text-brand-ink/70">
          <div>
            Showing <strong>{Math.min(sortedTests.length, (currentPage - 1) * pageSize + 1)}</strong> to{" "}
            <strong>{Math.min(sortedTests.length, currentPage * pageSize)}</strong> of{" "}
            <strong>{sortedTests.length}</strong> tests
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

      {/* Create / Edit Dialog */}
      <TestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        testToEdit={testToEdit}
      />
    </div>
  );
}
