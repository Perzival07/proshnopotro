"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { completeProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AtomMark } from "@/components/brand/AtomMark";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface OnboardingFormProps {
  defaultName?: string | null;
  email: string;
}

export function OnboardingForm({ defaultName, email }: OnboardingFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultName || "");
  const [phone, setPhone] = useState("");
  const [className, setClassName] = useState("Class 10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await completeProfile({
      name,
      phone,
      className,
    });

    if (res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-left">
      {error && (
        <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="email" className="text-xs font-semibold text-brand-navy">
          Signed In Email
        </Label>
        <Input
          id="email"
          value={email}
          disabled
          className="mt-1 bg-brand-page text-brand-ink/70 cursor-not-allowed text-sm"
        />
        <p className="text-[11px] text-brand-ink/50 mt-1">
          Your tutor will assign assessments directly to this email address.
        </p>
      </div>

      <div>
        <Label htmlFor="name" className="text-xs font-semibold text-brand-navy">
          Full Student Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          placeholder="e.g. Rahul Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 text-sm"
        />
      </div>

      <div>
        <Label htmlFor="phone" className="text-xs font-semibold text-brand-navy">
          Contact Phone Number <span className="text-red-500">*</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="e.g. +91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="mt-1 text-sm"
        />
      </div>

      <div>
        <Label htmlFor="class" className="text-xs font-semibold text-brand-navy">
          Current Academic Class / Standard <span className="text-red-500">*</span>
        </Label>
        <Select value={className} onValueChange={setClassName}>
          <SelectTrigger id="class" className="mt-1">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Class 8">Class 8</SelectItem>
            <SelectItem value="Class 9">Class 9</SelectItem>
            <SelectItem value="Class 10">Class 10</SelectItem>
            <SelectItem value="Class 11 - Science">Class 11 - Science</SelectItem>
            <SelectItem value="Class 12 - Science">Class 12 - Science</SelectItem>
            <SelectItem value="NEET / JEE Repeater">NEET / JEE Repeater</SelectItem>
            <SelectItem value="Foundation Batch">Foundation Batch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        disabled={loading || !name.trim() || !phone.trim()}
        className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white font-medium py-2.5 mt-2"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <AtomMark size={18} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
            <span>Saving Profile...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Complete Setup & Enter Dashboard</span>
          </div>
        )}
      </Button>
    </form>
  );
}
