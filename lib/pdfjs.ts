/**
 * Loads pdf.js on demand, in the browser only.
 *
 * The library and its worker come to well over a megabyte, so they are fetched
 * the first time a PDF is actually compressed or shown -- never as part of a
 * page's bundle. The legacy build is used for the older phone browsers
 * students turn up with; the modern build needs APIs they do not have.
 *
 * One worker serves every document on the page.
 */

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.min.mjs");

let loading: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDFs can only be processed in the browser."));
  }
  if (!loading) {
    loading = import("pdfjs-dist/legacy/build/pdf.min.mjs")
      .then((pdfjs) => {
        if (!pdfjs.GlobalWorkerOptions.workerPort) {
          pdfjs.GlobalWorkerOptions.workerPort = new Worker(
            new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
            { type: "module" }
          );
        }
        return pdfjs;
      })
      .catch((err) => {
        // Let a later attempt (after a flaky connection recovers) try again.
        loading = null;
        throw err;
      });
  }
  return loading;
}
