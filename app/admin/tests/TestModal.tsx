"use client";

import React, { useState, useEffect } from "react";
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
import { AlertCircle, Link as LinkIcon, FileText, ClipboardList } from "lucide-react";
import type { TestFormat } from "@/lib/test-resource";

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
      setActive(testToEdit.active);
    } else {
      setTitle("");
      setSubject("Physics");
      setDescription("");
      setIconName("Atom");
      setFormat("GOOGLE_FORM");
      setFormUrl("");
      setActive(true);
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
      format,
      formUrl,
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Assessment Test" : "Create New Assessment Test"}
          </DialogTitle>
          <DialogDescription>
            Configure the test directory record and link your private Google Form URL.
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
            <div className="mt-1.5 grid grid-cols-2 gap-2">
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
                    hint: "Written paper, answers sent on WhatsApp",
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
              disabled={loading || !title.trim() || !formUrl.trim()}
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
