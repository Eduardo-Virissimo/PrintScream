export function normalizeFileName(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) return 'meu-pdf.pdf';

  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return trimmed;
  }

  return `${trimmed}.pdf`;
}

export function setLoading(isLoading: boolean) {
  const submitButton = document.getElementById('submitButton') as HTMLButtonElement;
  const choosePathButton = document.getElementById('choosePath') as HTMLButtonElement;

  submitButton.disabled = isLoading;
  choosePathButton.disabled = isLoading;
}

export function setStatus(message: string, type: 'neutral' | 'loading' | 'success' | 'error') {
  const statusBox = document.getElementById('statusBox') as HTMLDivElement;

  statusBox.textContent = message;
  statusBox.className = `status-box ${type}`;
}

export default {
  normalizeFileName,
  setLoading,
  setStatus,
};
