import puppeteer from 'puppeteer';
import path from 'path';

async function printScream(url: string, nomeArquivo: string): Promise<void> {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true, // rodando sem abrir janela
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1440, height: 900 });

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // espera a página carregar completamente

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // calcula a altura total da pagina para garantir que o PDF capture todo o conteudo
  const height = await page.evaluate(() => {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  });

  const filePath = path.resolve(process.cwd(), nomeArquivo);

  console.log(`Saving screenshot to ${filePath}...`);

  await page.pdf({
    path: filePath,
    width: '1440px',
    height: `${height}px`,
    printBackground: true,
    margin: {
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px',
    },
  });

  await browser.close();
  console.log('Browser closed. PDF saved successfully.');
}

const url = process.argv[2];
const archive = process.argv[3] || 'screenshot.pdf';

if (!url) {
  console.error('Use: node print-scream.js <URL> [archive.pdf]');
  process.exit(1);
}

printScream(url, archive);
