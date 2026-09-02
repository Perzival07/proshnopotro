"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentModal } from "./StudentModal";
import { deleteStudent, getStudentFootprint } from "./actions";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";

export interface StudentRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  className: string | null;
  profileComplete: boolean;
  createdAt: Date;
  assignmentCount: number;
}

interface StudentsClientProps {
  students: StudentRow[];
}

export function StudentsClient({ students }: StudentsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<StudentRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deletion is two-stage: the footprint is fetched first so the confirmation
  // can state exactly what goes with the student.
  const [pendingDelete, setPendingDelete] = useState<StudentRow | null>(null);
  const [footprint, setFootprint] = useState<{ assignments: number; results: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.className || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q)
    );
  }, [students, search]);

  const openCreate = () => {
    setStudentToEdit(null);
    setIsModalOpen(true);
  };

  const openEdit = (student: StudentRow) => {
    setStudentToEdit(student);
    setIsModalOpen(true);
  };

  const askDelete = async (student: StudentRow) => {
    setError(null);
    setPendingDelete(student);
    setFootprint(null);
    const res = await getStudentFootprint(student.id);
    if ("error" in res) {
      setError(res.error);
      setPendingDelete(null);
      return;
    }
    setFootprint(res);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteStudent(pendingDelete.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPendingDelete(null);
      router.refresh();
    } catch {
      setError("Could not reach the server to remove this student.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-navy">
            Students
          </h1>
          <p className="text-body mt-1 text-xs text-brand-ink/70">
            Add students before they sign in, correct their details, or remove them
            from the portal.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 bg-brand-navy text-white shadow-sm hover:bg-brand-navy/90 sm:w-auto"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Student</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-brand-border bg-white p-4 shadow-card">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-ink/40" />
          <Input
            placeholder="Search by name, email, class or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      {/* Mobile: one card per student. */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-white p-6 text-center text-xs text-brand-ink/60 shadow-card">
            {students.length === 0
              ? "No students yet. Add one to get started."
              : "No students match your search."}
          </div>
        ) : (
          filtered.map((s) => (
            <div key={s.id} className="rounded-xl border border-brand-border bg-white p-4 shadow-card">
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold text-brand-navy">
                  {s.name || <span className="italic text-brand-ink/40">Name not set</span>}
                </p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-brand-ink/70">
                  {s.email}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                {s.className && (
                  <span className="rounded bg-brand-tint px-2 py-0.5 font-medium text-brand-navy">
                    {s.className}
                  </span>
                )}
                {s.phone && <span className="text-brand-ink/60">{s.phone}</span>}
                <span className="text-brand-ink/60">
                  {s.assignmentCount} test{s.assignmentCount === 1 ? "" : "s"}
                </span>
                {s.profileComplete ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-blue/30 bg-brand-tint px-2 py-0.5 font-medium text-brand-navy">
                    <UserCheck className="h-3 w-3 text-brand-blue" />
                    Registered
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#E2DFD6] bg-[#F1EFE8] px-2 py-0.5 font-medium text-[#444441]">
                    <UserX className="h-3 w-3 opacity-60" />
                    Not signed in
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-end gap-1 border-t border-brand-border/60 pt-3">
                <button
                  onClick={() => openEdit(s)}
                  aria-label={`Edit ${s.name || s.email}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-ink/80 transition-colors hover:bg-brand-tint hover:text-brand-navy"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => askDelete(s)}
                  aria-label={`Remove ${s.name || s.email}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-card">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead className="w-[150px]">Class</TableHead>
                <TableHead className="w-[140px]">Phone</TableHead>
                <TableHead className="w-[90px] text-center">Tests</TableHead>
                <TableHead className="w-[130px] text-center">Account</TableHead>
                <TableHead className="w-[110px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-brand-ink/60">
                    {students.length === 0
                      ? "No students yet. Use 'Add Student' to create one."
                      : "No students match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id} className="text-xs">
                    <TableCell className="font-semibold text-brand-navy">
                      {s.name || <span className="italic text-brand-ink/40">Not set</span>}
                    </TableCell>
                    <TableCell className="font-mono text-brand-ink/80">{s.email}</TableCell>
                    <TableCell>
                      {s.className ? (
                        <span className="inline-flex items-center rounded bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand-navy">
                          {s.className}
                        </span>
                      ) : (
                        <span className="italic text-brand-ink/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-brand-ink/70">{s.phone || "—"}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-brand-navy">
                      {s.assignmentCount}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.profileComplete ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-blue/30 bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand-navy">
                          <UserCheck className="h-3 w-3 text-brand-blue" />
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#E2DFD6] bg-[#F1EFE8] px-2 py-0.5 text-[11px] font-medium text-[#444441]">
                          <UserX className="h-3 w-3 opacity-60" />
                          Not signed in
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(s)}
                          title="Edit student"
                          className="rounded-md p-1.5 text-brand-ink/80 transition-colors hover:bg-brand-tint hover:text-brand-navy"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => askDelete(s)}
                          title="Remove student"
                          className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-brand-border bg-brand-page/50 px-4 py-3 text-xs text-brand-ink/70">
          Showing <strong>{filtered.length}</strong> of <strong>{students.length}</strong> students
        </div>
      </div>

      <StudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        studentToEdit={studentToEdit}
        onSaved={() => router.refresh()}
      />

      {/* Delete confirmation: names the cost before it is paid. */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Remove this student?
            </DialogTitle>
            <DialogDescription>
              {pendingDelete?.name || pendingDelete?.email} will be removed from the
              portal. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            {footprint === null ? (
              <p className="text-brand-ink/60">Checking what this affects…</p>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                <p className="font-semibold">This also deletes:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>
                    {footprint.assignments} assigned test
                    {footprint.assignments === 1 ? "" : "s"}
                  </li>
                  <li>
                    {footprint.results} recorded score
                    {footprint.results === 1 ? "" : "s"}
                  </li>
                </ul>
                <p className="mt-2 text-[11px] text-red-700/90">
                  Assignments are held against the student&apos;s email address, so
                  leaving them behind would put the tests straight back in their hands
                  the next time they signed in.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting || footprint === null}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#FCA5A5" animate />
                  <span>Removing…</span>
                </div>
              ) : (
                "Remove Student"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
