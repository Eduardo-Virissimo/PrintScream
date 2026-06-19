import type { PdfAppApi } from './pdf-app';

export {};

declare global {
  interface Window {
    pdfApp: PdfAppApi;
  }
}
