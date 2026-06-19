import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePdf } from '../core/generatePdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (app.isPackaged) {
  process.env.PUPPETEER_CACHE_DIR = path.join(process.resourcesPath, 'puppeteer');
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 980,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#f6efe7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

ipcMain.handle('dialog:save-pdf', async (_event, defaultName: string = 'meu-pdf.pdf') => {
  if (!mainWindow) {
    throw new Error('Main window is not available');
  }

  const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
    title: 'Salvar PDF',
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

ipcMain.handle(
  'pdf:generate',
  async (
    _event,
    payload: { url: string; outputPath: string; mobile?: boolean }
  ): Promise<string> => {
    if (!payload?.url || !payload?.outputPath) {
      throw new Error('URL and output path are required');
    }

    try {
      new URL(payload.url); // validação básica de URL
    } catch (error) {
      throw new Error('Invalid URL provided');
    }

    return generatePdf({
      url: payload.url,
      outputPath: payload.outputPath,
      mobile: payload.mobile,
    });
  }
);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
