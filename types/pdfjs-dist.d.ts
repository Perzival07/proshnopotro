// The minified pdf.js build ships without its own declarations; it exports
// exactly what the unminified one does. The minified file is the one imported
// because the unminified bundle trips over webpack's own __webpack_require__.
declare module "pdfjs-dist/legacy/build/pdf.min.mjs" {
  export * from "pdfjs-dist/legacy/build/pdf.mjs";
}
