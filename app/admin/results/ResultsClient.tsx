"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  previewResultsImport,
  commitResultsImport,
  ImportPreviewResult,
} from "./actions";
import { AtomMark } from "@/components/brand/AtomMark";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Check,
  RefreshCw,
} from "lucide-react";

interface TestOption {
  id: string;
  title: string;
  subject: string;
}

interface ResultsClientProps {
  tests: TestOption[];
}

export function ResultsClient({ tests }: ResultsClientProps) {
  const [selectedTestId, setSelectedTestId] = useState(tests[0]?.id || "");
  const [defaultMaxScore, setDefaultMaxScore] = useState<number>(50);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawCsvData, setRawCsvData] = useState<Record<string, any>[]>([]);
  const [emailColumn, setEmailColumn] = useState<string>("");
  const [scoreColumn, setScoreColumn] = useState<string>("");

  // Preview & Processing states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<"MATCHED" | "UNMATCHED" | "INVALID">("MATCHED");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccessMessage, setCommitSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle CSV File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewResult(null);
    setCommitSuccessMessage(null);
    setErrorMessage(null);
    // Clear the previous file's mapping -- headers may differ entirely.
    setCsvHeaders([]);
    setRawCsvData([]);
    setEmailColumn("");
    setScoreColumn("");

    // Allow re-selecting the same file later (onChange won't fire otherwise).
    e.target.value = "";

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields || []).filter(Boolean);

        if (headers.length === 0) {
          setErrorMessage(
            "That CSV has no readable header row. Export the responses sheet again."
          );
          return;
        }

        setCsvHeaders(headers);
        setRawCsvData(results.data as Record<string, any>[]);

        // Auto-detect columns
        const detectedEmail = headers.find((h) =>
          /email|username|mail/i.test(h)
        );
        const detectedScore = headers.find((h) =>
          /score|points|total|mark|grade/i.test(h)
        );

        if (detectedEmail) setEmailColumn(detectedEmail);
        if (detectedScore) setScoreColumn(detectedScore);
      },
      error: (err) => {
        setErrorMessage("Failed to parse CSV file: " + err.message);
      },
    });
  };

  // Generate Match Preview
  const handleAnalyzeAndPreview = async () => {
    if (!selectedTestId || !emailColumn || !scoreColumn || rawCsvData.length === 0) {
      setErrorMessage("Please select a test, email column, and score column.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    const rowsToProcess = rawCsvData.map((row) => ({
      email: String(row[emailColumn] || ""),
      score: String(row[scoreColumn] || ""),
    }));

    try {
      const res = await previewResultsImport(
        selectedTestId,
        rowsToProcess,
        defaultMaxScore
      );

      setIsAnalyzing(false);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to generate preview.");
      } else {
        setPreviewResult(res);
        if (res.matchedRows.length > 0) {
          setActiveTab("MATCHED");
        } else if (res.unmatchedRows.length > 0) {
          setActiveTab("UNMATCHED");
        }
      }
    } catch (err) {
      setIsAnalyzing(false);
      setErrorMessage("Server error while generating preview.");
    }
  };

  // Commit Matched Results
  const handleCommitResults = async () => {
    if (!previewResult || previewResult.matchedRows.length === 0) return;

    setIsCommitting(true);
    setErrorMessage(null);

    const itemsToCommit = previewResult.matchedRows.map((r) => ({
      assignmentId: r.assignmentId!,
      score: r.parsedScore!,
      maxScore: r.parsedMaxScore!,
      responseEmail: r.normalizedEmail,
    }));

    try {
      const res = await commitResultsImport(itemsToCommit);
      setIsCommitting(false);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setCommitSuccessMessage(
          `Successfully committed ${res.updatedCount} test results! Assignments marked as SUBMITTED.` +
            (res.duplicateCount
              ? ` ${res.duplicateCount} duplicate response${
                  res.duplicateCount === 1 ? "" : "s"
                } collapsed to the latest score per student.`
              : "")
        );
        setPreviewResult(null);
        setFile(null);
        setRawCsvData([]);
      }
    } catch (err) {
      setIsCommitting(false);
      setErrorMessage("Error occurred during commit.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-navy">
          Import Results from Google Forms
        </h1>
        <p className="text-body text-xs text-brand-ink/70 mt-1">
          Upload the exported response spreadsheet CSV to match scores with student assignments.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {commitSuccessMessage && (
        <div className="p-4 text-xs bg-[#E1F5EE] text-[#085041] border border-[#C2EBDB] rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#085041]" />
          <span className="font-medium">{commitSuccessMessage}</span>
        </div>
      )}

      {/* Upload and Configuration Box */}
      <div className="p-6 bg-white rounded-xl border border-brand-border shadow-card space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Target Test */}
          <div>
            <Label htmlFor="target-test" className="text-xs font-semibold text-brand-navy">
              1. Target Assessment Test <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedTestId} onValueChange={setSelectedTestId}>
              <SelectTrigger id="target-test" className="mt-1.5 h-10">
                <SelectValue placeholder="Select target test..." />
              </SelectTrigger>
              <SelectContent>
                {tests.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="font-medium text-brand-navy">{t.title}</span>
                    <span className="text-xs text-brand-ink/50 ml-2">({t.subject})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default Max Score */}
          <div>
            <Label htmlFor="max-score" className="text-xs font-semibold text-brand-navy">
              2. Default Max Score (if not specified in CSV)
            </Label>
            <Input
              id="max-score"
              type="number"
              value={defaultMaxScore}
              onChange={(e) => setDefaultMaxScore(Number(e.target.value) || 50)}
              className="mt-1.5 h-10 text-xs font-mono"
            />
            <p className="text-[11px] text-brand-ink/50 mt-1">
              Google Forms usually outputs &quot;45 / 50&quot; automatically.
            </p>
          </div>
        </div>

        {/* CSV File Upload Dropzone */}
        <div>
          <Label className="text-xs font-semibold text-brand-navy block mb-1.5">
            3. Upload Google Forms Responses CSV <span className="text-red-500">*</span>
          </Label>

          <label
            htmlFor="csv-upload"
            className="border-2 border-dashed border-brand-border hover:border-brand-blue rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-brand-page hover:bg-brand-tint/30 transition-all text-center"
          >
            <UploadCloud className="h-8 w-8 text-brand-blue mb-2" />
            <span className="text-xs font-semibold text-brand-navy">
              {file ? file.name : "Click to browse or drag & drop response CSV"}
            </span>
            <span className="text-[11px] text-brand-ink/50 mt-1">
              Exported directly from the Google Form&apos;s linked Google Sheet
            </span>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Column Mapping if file selected */}
        {csvHeaders.length > 0 && (
          <div className="p-4 bg-brand-page rounded-xl border border-brand-border space-y-3">
            <h3 className="font-heading font-semibold text-xs text-brand-navy">
              Detected CSV Column Mapping ({rawCsvData.length} rows found)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] text-brand-ink/75">Email Column</Label>
                <Select value={emailColumn} onValueChange={setEmailColumn}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select email column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-brand-ink/75">Score Column</Label>
                <Select value={scoreColumn} onValueChange={setScoreColumn}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select score column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleAnalyzeAndPreview}
              disabled={isAnalyzing || !emailColumn || !scoreColumn}
              className="mt-2 w-full bg-brand-navy hover:bg-brand-navy/90 text-white text-xs font-semibold h-9"
            >
              {isAnalyzing ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  <span>Matching Assignments with Database...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Preview Matched & Unmatched Records</span>
                </div>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Preview Section */}
      {previewResult && (
        <div className="space-y-4 bg-white rounded-xl border border-brand-border shadow-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-brand-navy">
                Import Preview & Verification
              </h2>
              <p className="text-xs text-brand-ink/70 mt-0.5">
                Review matched student assignments before committing scores to the database.
              </p>
            </div>

            {/* Commit Button */}
            <Button
              onClick={handleCommitResults}
              disabled={isCommitting || previewResult.matchedRows.length === 0}
              size="lg"
              className="bg-[#085041] hover:bg-[#064034] text-white shadow-sm flex items-center gap-2"
            >
              {isCommitting ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={18} strokeColor="#FFFFFF" dotColor="#2E9CD8" animate />
                  <span>Committing Results...</span>
                </div>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Commit {previewResult.matchedRows.length} Matched Scores</span>
                </>
              )}
            </Button>
          </div>

          {/* Tab Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("MATCHED")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "MATCHED"
                  ? "bg-[#E1F5EE] text-[#085041] border border-[#C2EBDB]"
                  : "bg-brand-page text-brand-ink/70 hover:bg-brand-tint border border-brand-border"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-[#085041]" />
              <span>Matched Rows ({previewResult.matchedRows.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("UNMATCHED")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "UNMATCHED"
                  ? "bg-[#FAEEDA] text-[#633806] border border-[#F3DCB5]"
                  : "bg-brand-page text-brand-ink/70 hover:bg-brand-tint border border-brand-border"
              }`}
            >
              <AlertTriangle className="h-4 w-4 text-[#E58A1F]" />
              <span>Unmatched Emails ({previewResult.unmatchedRows.length})</span>
            </button>

            {previewResult.invalidRows.length > 0 && (
              <button
                onClick={() => setActiveTab("INVALID")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "INVALID"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-brand-page text-brand-ink/70 border border-brand-border"
                }`}
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span>Invalid Rows ({previewResult.invalidRows.length})</span>
              </button>
            )}
          </div>

          {/* Matched Rows Table */}
          {activeTab === "MATCHED" && (
            <>
            {/* Below md the five columns are shown stacked, so nothing has to
                be scrolled to sideways to be read before committing scores. */}
            <div className="space-y-2 md:hidden">
              {previewResult.matchedRows.length === 0 ? (
                <div className="rounded-lg border border-brand-border bg-white p-4 text-center text-xs text-brand-ink/60">
                  No matched assignments found. Check if the CSV emails match the assigned emails.
                </div>
              ) : (
                previewResult.matchedRows.map((r) => (
                  <div
                    key={r.rowIndex}
                    className="rounded-lg border border-[#C2EBDB] bg-[#E1F5EE]/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-all font-mono text-[11px] font-medium text-brand-navy">
                          {r.normalizedEmail}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-brand-ink">
                          {r.studentName || (
                            <span className="italic text-brand-ink/40">Unregistered yet</span>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-bold text-[#085041]">
                        {r.parsedScore} / {r.parsedMaxScore}
                      </span>
                    </div>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#C2EBDB] bg-[#E1F5EE] px-2 py-0.5 text-[10px] font-semibold text-[#085041]">
                      <CheckCircle2 className="h-3 w-3" />
                      Will mark SUBMITTED
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block rounded-lg border border-brand-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Row</TableHead>
                    <TableHead>Student Email</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right">Parsed Score</TableHead>
                    <TableHead className="text-center">Status Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResult.matchedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-xs text-brand-ink/60">
                        No matched assignments found. Check if the CSV emails match the assigned emails.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewResult.matchedRows.map((r) => (
                      <TableRow key={r.rowIndex} className="text-xs bg-[#E1F5EE]/20">
                        <TableCell className="font-mono text-brand-ink/50">{r.rowIndex}</TableCell>
                        <TableCell className="font-mono font-medium text-brand-navy">
                          {r.normalizedEmail}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.studentName || <span className="italic text-brand-ink/40">Unregistered yet</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-[#085041]">
                          {r.parsedScore} / {r.parsedMaxScore}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#085041] bg-[#E1F5EE] px-2 py-0.5 rounded-full border border-[#C2EBDB]">
                            <CheckCircle2 className="h-3 w-3" />
                            Will mark SUBMITTED
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            </>
          )}

          {/* Unmatched Rows Table */}
          {activeTab === "UNMATCHED" && (
            <div className="space-y-3">
              <div className="p-3 bg-[#FAEEDA] border border-[#F3DCB5] rounded-lg text-xs text-[#633806] flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#E58A1F]" />
                <div>
                  <strong>Security Note:</strong> These emails exist in the response sheet but have <strong>no assignment record</strong> for this test. Per security requirements, they will be reported here and <strong>will not</strong> create new assignments.
                </div>
              </div>

              <div className="space-y-2 md:hidden">
                {previewResult.unmatchedRows.length === 0 ? (
                  <div className="rounded-lg border border-brand-border bg-white p-4 text-center text-xs text-brand-ink/60">
                    All rows in CSV matched valid student assignments!
                  </div>
                ) : (
                  previewResult.unmatchedRows.map((r) => (
                    <div
                      key={r.rowIndex}
                      className="rounded-lg border border-[#F3DCB5] bg-[#FAEEDA]/40 p-3 text-[11px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-all font-mono font-medium text-[#633806]">
                          {r.normalizedEmail}
                        </p>
                        <span className="shrink-0 font-mono">
                          {r.parsedScore} / {r.parsedMaxScore}
                        </span>
                      </div>
                      <p className="mt-1 italic text-brand-ink/70">{r.reason}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden md:block rounded-lg border border-brand-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Row</TableHead>
                      <TableHead>Response Email</TableHead>
                      <TableHead className="text-right">Parsed Score</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewResult.unmatchedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-xs text-brand-ink/60">
                          All rows in CSV matched valid student assignments!
                        </TableCell>
                      </TableRow>
                    ) : (
                      previewResult.unmatchedRows.map((r) => (
                        <TableRow key={r.rowIndex} className="text-xs bg-[#FAEEDA]/20">
                          <TableCell className="font-mono text-brand-ink/50">{r.rowIndex}</TableCell>
                          <TableCell className="font-mono font-medium text-[#633806]">
                            {r.normalizedEmail}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {r.parsedScore} / {r.parsedMaxScore}
                          </TableCell>
                          <TableCell className="text-brand-ink/70 italic text-[11px]">
                            {r.reason}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Invalid Rows Table */}
          {activeTab === "INVALID" && (
            <>
            <div className="space-y-2 md:hidden">
              {previewResult.invalidRows.map((r) => (
                <div
                  key={r.rowIndex}
                  className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-[11px]"
                >
                  <p className="break-all font-mono text-red-700">
                    {r.rawEmail || "(blank)"}
                  </p>
                  <p className="mt-0.5 font-mono text-red-700">
                    Score: {r.rawScore || "(blank)"}
                  </p>
                  <p className="mt-1 font-medium text-red-600">{r.reason}</p>
                </div>
              ))}
            </div>

            <div className="hidden md:block rounded-lg border border-brand-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Row</TableHead>
                    <TableHead>Raw Email</TableHead>
                    <TableHead>Raw Score</TableHead>
                    <TableHead>Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResult.invalidRows.map((r) => (
                    <TableRow key={r.rowIndex} className="text-xs bg-red-50/50">
                      <TableCell className="font-mono text-brand-ink/50">{r.rowIndex}</TableCell>
                      <TableCell className="font-mono text-red-700">{r.rawEmail || "(blank)"}</TableCell>
                      <TableCell className="font-mono text-red-700">{r.rawScore || "(blank)"}</TableCell>
                      <TableCell className="text-red-600 font-medium">{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Info(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
