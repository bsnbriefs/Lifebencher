export function downloadProjectZip() {
  try {
    const a = document.createElement('a');
    a.href = '/lifebencher-match.zip';
    a.download = 'lifebencher-match.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Download error:', err);
    window.open('/lifebencher-match.zip', '_blank');
  }
}
