"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AtomMark } from "@/components/brand/AtomMark";
import { StudentPicker, type PickableStudent } from "@/components/admin/StudentPicker";
import { AlertCircle } from "lucide-react";
import { setClassroomMembers } from "./actions";
import type { ClassroomRow } from "./ClassroomsClient";

interface MembersModalProps {
  classroom: ClassroomRow | null;
  students: PickableStudent[];
  onClose: () => void;
  onSaved: () => void;
}

/** The tutor's editor for who is in a batch. */
export function MembersModal({ classroom, students, onClose, onSaved }: MembersModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(classroom ? classroom.memberEmails.map((e) => e.toLowerCase()) : []);
    setError(null);
  }, [classroom]);

  if (!classroom) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await setClassroomMembers(classroom.id, selected);
      if (res.error) {
        setError(res.error);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Students in {classroom.name}</DialogTitle>
          <DialogDescription>
            Everyone ticked here sees this classroom&apos;s notes, and can be given a test
            in one go from the Assign page.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <StudentPicker students={students} selected={selected} onChange={setSelected} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-brand-navy text-white hover:bg-brand-navy/90"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#87CEEB" animate />
                <span>Saving…</span>
              </span>
            ) : (
              `Save ${selected.length} student${selected.length === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
