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
import { AlertCircle, Info } from "lucide-react";
import { CLASS_OPTIONS } from "@/lib/students";
import { createStudent, updateStudent } from "./actions";
import type { StudentRow } from "./StudentsClient";

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentToEdit?: StudentRow | null;
  onSaved: () => void;
}

const NO_CLASS = "__none__";

export function StudentModal({
  isOpen,
  onClose,
  studentToEdit,
  onSaved,
}: StudentModalProps) {
  const isEditing = Boolean(studentToEdit);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [className, setClassName] = useState<string>(NO_CLASS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studentToEdit) {
      setName(studentToEdit.name || "");
      setEmail(studentToEdit.email);
      setPhone(studentToEdit.phone || "");
      setClassName(studentToEdit.className || NO_CLASS);
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setClassName(NO_CLASS);
    }
    setError(null);
  }, [studentToEdit, isOpen]);

  const emailChanged =
    isEditing &&
    studentToEdit != null &&
    email.trim().toLowerCase() !== studentToEdit.email.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name,
      email,
      phone,
      className: className === NO_CLASS ? "" : className,
    };

    const res =
      isEditing && studentToEdit
        ? await updateStudent(studentToEdit.id, payload)
        : await createStudent(payload);

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Student" : "Add Student"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this student's details. They see the change the next time they sign in."
              : "Add a student before they have signed in. Their assessments can be assigned straight away."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Label htmlFor="student-name" className="text-xs font-semibold text-brand-navy">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="student-name"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="student-email" className="text-xs font-semibold text-brand-navy">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="student-email"
              type="email"
              placeholder="e.g. rahul@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-brand-ink/55">
              This must be the Google account they sign in with — assessments are
              matched to students by this address.
            </p>
          </div>

          {emailChanged && (
            <div className="flex items-start gap-2 rounded-md border border-[#F3DCB5] bg-[#FAEEDA] p-3 text-[11px] text-[#633806]">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-[#E58A1F]" />
              <span>
                Their {studentToEdit?.assignmentCount ?? 0} assigned test
                {studentToEdit?.assignmentCount === 1 ? "" : "s"} will move to the
                new address, and they will need to sign in with it from now on.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="student-phone" className="text-xs font-semibold text-brand-navy">
                Phone
              </Label>
              <Input
                id="student-phone"
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="student-class" className="text-xs font-semibold text-brand-navy">
                Class
              </Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger id="student-class" className="mt-1">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLASS}>Not set</SelectItem>
                  {CLASS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !email.trim()}
              className="bg-brand-navy text-white hover:bg-brand-navy/90"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  <span>Saving...</span>
                </div>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Add Student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
