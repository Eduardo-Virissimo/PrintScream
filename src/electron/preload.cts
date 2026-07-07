import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pdfApp', {
  chooseOutputPath: (defaultName: string) => ipcRenderer.invoke('dialog:save-pdf', defaultName),
  generatePdf: (payload: { url: string; outputPath: string; mobile?: boolean }) =>
    ipcRenderer.invoke('pdf:generate', payload),
});