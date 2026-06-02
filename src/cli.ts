import path from 'node:path';
import { generatePdf } from './core/generatePdf';

const url = process.argv[2];
const fileName = process.argv[3] || 'screenshot.pdf';

if (!url) {
  console.error('Use: npm run cli -- <URL> [archive.pdf]');
  process.exit(1);
}

const outputPath = path.resolve(process.cwd(), fileName);

generatePdf({ url, outputPath })
  .then((savedPath) => {
    console.log(`PDF saved successfully at: ${savedPath}`);
  })
  .catch((error) => {
    console.error('Error generating PDF:', error);
    process.exit(1);
  });
