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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AtomMark } from "@/components/brand/AtomMark";
import { SubjectIcon, SUBJECT_ICONS } from "@/components/SubjectIcon";
import { AlertCircle, Info } from "lucide-react";
import { MAX_CLASSROOM_NAME } from "@/lib/classrooms";
import { createClassroom, updateClassroom } from "./actions";
import type { ClassroomRow } from "./ClassroomsClient";

interface ClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomToEdit?: ClassroomRow | null;
  onSaved: (classroomId?: string) => void;
}

export function ClassroomModal({
  isOpen,
  onClose,
  classroomToEdit,
  onSaved,
}: ClassroomModalProps) {
  const isEditing = Boolean(classroomToEdit);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState("GraduationCap");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (classroomToEdit) {
      setName(classroomToEdit.name);
      setSubject(classroomToEdit.subject || "");
      setDescription(classroomToEdit.description || "");
      setIconName(classroomToEdit.iconName || "GraduationCap");
      setActive(classroomToEdit.active);
    } else {
      setName("");
      setSubject("");
      setDescription("");
      setIconName("GraduationCap");
      setActive(true);
    }
    setError(null);
  }, [classroomToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = { name, subject, description, iconName, active };

    try {
      if (classroomToEdit) {
        const res = await updateClassroom(classroomToEdit.id, payload);
        if (res.error) {
          setError(res.error);
          return;
        }
        onSaved(classroomToEdit.id);
      } else {
        const res = await createClassroom(payload);
        if (res.error) {
          setError(res.error);
          return;
        }
        onSaved(res.classroomId);
      }

      onClose();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit classroom" : "New classroom"}</DialogTitle>
          <DialogDescription>
            A classroom is a batch you teach together. Everyone in it gets the same
            notes, and can be given the same test in one go.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Label htmlFor="classroom-name" className="text-xs font-semibold text-brand-navy">
              Classroom name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="classroom-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_CLASSROOM_NAME}
              placeholder="e.g. Physics Batch A — Mon/Wed"
              required
              className="mt-1.5 h-10 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="classroom-subject" className="text-xs font-semibold text-brand-navy">
                Subject
              </Label>
              <Input
                id="classroom-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Physics"
                className="mt-1.5 h-10 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="classroom-icon" className="text-xs font-semibold text-brand-navy">
                Icon
              </Label>
              <Select value={iconName} onValueChange={setIconName}>
                <SelectTrigger id="classroom-icon" className="mt-1.5 h-10">
                  <SelectValue>
                    <span className="flex items-center gap-2 text-sm">
                      <SubjectIcon name={iconName} className="h-4 w-4 text-brand-blue" />
                      <span>{iconName}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SUBJECT_ICONS).map((key) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <SubjectIcon name={key} className="h-4 w-4 text-brand-blue" />
                        <span>{key}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="classroom-description" className="text-xs font-semibold text-brand-navy">
              Description
            </Label>
            <textarea
              id="classroom-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="When this batch meets, what it covers — students see this."
              className="mt-1.5 w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm text-brand-ink outline-none transition-colors placeholder:text-brand-ink/40 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-border bg-brand-page p-3">
            <input
              type="checkbox"
              checked={!active}
              onChange={(e) => setActive(!e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-navy"
            />
            <span className="text-xs">
              <span className="font-semibold text-brand-navy">Archive this classroom</span>
              <span className="mt-0.5 flex items-start gap-1 text-[11px] text-brand-ink/60">
                <Info className="mt-px h-3 w-3 shrink-0" />
                <span>
                  An archived batch disappears from the assign picker and from students&apos;
                  dashboards. Notes already shared with it stay readable.
                </span>
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-brand-navy text-white hover:bg-brand-navy/90"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#87CEEB" animate />
                  <span>Saving…</span>
                </span>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Create classroom"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
