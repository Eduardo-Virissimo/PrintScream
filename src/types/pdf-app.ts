export interface PdfAppApi {
  chooseOutputPath: (defaultName: string) => Promise<string | null>;
  generatePdf: (payload: { url: string; outputPath: string; mobile?: boolean }) => Promise<string>;
}
