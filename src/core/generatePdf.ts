import path from 'node:path';
import puppeteer from 'puppeteer';

export interface GeneratePdfInput {
  url: string;
  outputPath: string;
  mobile?: boolean;
}

export async function generatePdf({ url, outputPath, mobile }: GeneratePdfInput): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true, // rodando sem abrir janela
  });

  try {
    const page = await browser.newPage();
    const mobilePage = await browser.newPage();

    await page.setViewport({ width: 1440, height: 900 });
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // espera a página carregar completamente
    await mobilePage.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // calcula a altura total da pagina para garantir que o PDF capture todo o conteudo
    const height = await page.evaluate(() => {
      return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    });

    const resolvedPath = path.resolve(outputPath);

    await page.pdf({
      path: resolvedPath,
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

    if (mobile) {
      const mobilePath = resolvedPath.replace(/\.pdf$/, '-mobile.pdf');

      await mobilePage.pdf({
        path: mobilePath,
        width: '390px',
        printBackground: true,
      });
    }

    return resolvedPath;
  } finally {
    await browser.close();
  }
}
