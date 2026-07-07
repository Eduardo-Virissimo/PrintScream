import path from 'node:path';
import { generatePdf } from './core/generatePdf.js';

const args = process.argv.slice(2);

const url = args[0];
const fileName = args[1] || 'screenshot.pdf';
const mobile = args.includes('--mobile');

if (!url) {
  console.error('Use: npm run cli -- <URL> [file.pdf] [--mobile]');
  process.exit(1);
}

const outputPath = path.resolve(process.cwd(), fileName);

generatePdf({
  url,
  outputPath,
  mobile,
})
  .then((savedPath: string) => {
    console.log(`PDF saved successfully at: ${savedPath}`);

    if (mobile) {
      console.log('Mobile version generated successfully.');
    }
  })
  .catch((error: Error) => {
    console.error('Error generating PDF:', error.message);
    process.exit(1);
  });
