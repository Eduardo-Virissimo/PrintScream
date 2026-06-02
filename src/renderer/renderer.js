const form = document.getElementById('pdf-form');
const urlInput = document.getElementById('url');
const fileNameInput = document.getElementById('fileName');
const outputPathInput = document.getElementById('outputPath');
const choosePathButton = document.getElementById('choosePath');
const submitButton = document.getElementById('submitButton');
const statusBox = document.getElementById('statusBox');

function setStatus(message, type = 'neutral') {
  statusBox.textContent = message;
  statusBox.className = `status-box ${type}`;
}

function normalizeFileName(name) {
  const trimmed = name.trim();

  if (!trimmed) return 'meu-pdf.pdf';

  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return trimmed;
  }

  return `${trimmed}.pdf`;
}

choosePathButton.addEventListener('click', async () => {
  const defaultName = normalizeFileName(fileNameInput.value);
  const selectedPath = await window.pdfApp.chooseOutputPath(defaultName);

  if (selectedPath) {
    outputPathInput.value = selectedPath;
    setStatus('Output file successfully selected', 'neutral');
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  const fileName = normalizeFileName(fileNameInput.value);
  let outputPath = outputPathInput.value.trim();

  if (!url) {
    setStatus('Please enter a valid URL', 'error');
    return;
  }

  if (!outputPath) {
    outputPath = await window.pdfApp.chooseOutputPath(fileName);
    if (!outputPath) {
      setStatus('Output file selection is required', 'error');
      return;
    }
    outputPathInput.value = outputPath;
  }

  submitButton.disabled = true;
  choosePathButton.disabled = true;
  setStatus('Generating PDF...', 'loading');

  try {
    const savedPath = await window.pdfApp.generatePdf({ url, outputPath });
    setStatus(`PDF successfully saved to: ${savedPath}`, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    setStatus(`Error: ${message}`, 'error');
  } finally {
    submitButton.disabled = false;
    choosePathButton.disabled = false;
  }
});
