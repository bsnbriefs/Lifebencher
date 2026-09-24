import { ZIP_BASE64 } from './zipData';

export function downloadProjectZip() {
  try {
    const byteCharacters = atob(ZIP_BASE64);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifebencher-match.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error('Download error:', err);
    // Fallback to data URI
    window.location.href = `data:application/zip;base64,${ZIP_BASE64}`;
  }
}
