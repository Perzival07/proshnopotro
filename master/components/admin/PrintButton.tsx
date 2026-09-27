"use client";

import { Printer } from "lucide-react";
import { secondaryButtonClass } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={secondaryButtonClass}>
      <Printer className="h-4 w-4" /> Print or save as PDF
    </button>
  );
}
