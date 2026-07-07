import utils from './utils.js';

const form = document.getElementById('pdf-form') as HTMLFormElement;
const urlInput = document.getElementById('url') as HTMLInputElement;
const fileNameInput = document.getElementById('fileName') as HTMLInputElement;
const outputPathInput = document.getElementById('outputPath') as HTMLInputElement;
const choosePathButton = document.getElementById('choosePath') as HTMLButtonElement;
const mobile = document.getElementById('mobile') as HTMLInputElement;

choosePathButton.addEventListener('click', async () => {
  const defaultName = utils.normalizeFileName(fileNameInput.value);
  const selectedPath = await window.pdfApp.chooseOutputPath(defaultName);

  if (selectedPath) {
    outputPathInput.value = selectedPath;
    utils.setStatus('Output file successfully selected', 'neutral');
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  const fileName = utils.normalizeFileName(fileNameInput.value);
  let outputPath = outputPathInput.value.trim() || null;

  if (!url) {
    utils.setStatus('Please enter a valid URL', 'error');
    return;
  }

  if (!outputPath) {
    outputPath = await window.pdfApp.chooseOutputPath(fileName);
    if (!outputPath) {
      utils.setStatus('Output file selection is required', 'error');
      return;
    }
    outputPathInput.value = outputPath;
  }

  utils.setLoading(true);
  utils.setStatus('Generating PDF...', 'loading');

  try {
    const savedPath = await window.pdfApp.generatePdf({ url, outputPath, mobile: mobile.checked });
    utils.setStatus(`PDF successfully saved to: ${savedPath}`, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    utils.setStatus(`Error: ${message}`, 'error');
  } finally {
    utils.setLoading(false);
  }
});
