"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AtomMark } from "@/components/brand/AtomMark";
import { ShieldCheck, UserCheck, AlertCircle } from "lucide-react";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [devEmail, setDevEmail] = useState("student1@example.com");
  const [devRole, setDevRole] = useState<"STUDENT" | "ADMIN">("STUDENT");
  const [showDevAuth, setShowDevAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (err) {
      setError("Unable to initiate Google Sign In. Please try again.");
      setLoading(false);
    }
  };

  const handleDevSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: devEmail,
        role: devRole,
        name: devRole === "ADMIN" ? "Koustav Tutor (Admin)" : "Rahul Sharma",
        callbackUrl: devRole === "ADMIN" ? "/admin/tests" : "/",
        redirect: true,
      });
      if (res?.error) {
        setError("Dev sign in failed: " + res.error);
        setLoading(false);
      }
    } catch (err) {
      setError("Sign in error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary: Continue with Google */}
      <Button
        id="google-signin-btn"
        type="button"
        variant="default"
        size="lg"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-brand-navy hover:bg-brand-navy/90 text-white font-medium py-2.5 px-4 rounded-md shadow transition-all duration-200"
      >
        {loading ? (
          <AtomMark size={20} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.19 0 10.03 0 12s.45 3.81 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
        )}
        <span>Continue with Google</span>
      </Button>

      {/* Development Quick-Switch Box */}
      <div className="pt-4 border-t border-brand-border/60">
        <button
          type="button"
          onClick={() => setShowDevAuth(!showDevAuth)}
          className="text-xs text-brand-blue hover:underline font-medium"
        >
          {showDevAuth ? "Hide Quick Dev Login" : "⚡ Switch to Quick Dev Mode (Instant Test)"}
        </button>

        {showDevAuth && (
          <form
            onSubmit={handleDevSignIn}
            className="mt-3 p-3.5 bg-brand-page rounded-lg border border-brand-border text-left space-y-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-brand-navy">
              <span>Quick Test Access</span>
              <span className="text-[10px] text-brand-ink/50">Local Auth</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDevEmail("student1@example.com");
                  setDevRole("STUDENT");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 px-2 rounded border transition-colors ${
                  devRole === "STUDENT"
                    ? "bg-white border-brand-blue text-brand-navy font-semibold shadow-xs"
                    : "bg-transparent border-brand-border text-brand-ink/70"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5 text-brand-blue" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDevEmail("koustav@classesbykoustav.com");
                  setDevRole("ADMIN");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 px-2 rounded border transition-colors ${
                  devRole === "ADMIN"
                    ? "bg-white border-brand-blue text-brand-navy font-semibold shadow-xs"
                    : "bg-transparent border-brand-border text-brand-ink/70"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-brand-navy" />
                <span>Tutor Admin</span>
              </button>
            </div>

            <div>
              <Label className="text-xs text-brand-ink/75">Simulated Email</Label>
              <Input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                required
                className="h-8 text-xs mt-1"
              />
            </div>

            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={loading}
              className="w-full text-xs font-semibold text-brand-navy border-brand-navy/30 hover:bg-brand-tint"
            >
              Sign In as {devRole}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
