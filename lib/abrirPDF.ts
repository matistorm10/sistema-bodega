// Entrega de PDFs generados en el navegador.
// En celular ya no se abre una pestaña con una dirección "blob:" (se veía el link en vez del documento y el
// archivo quedaba con el nombre "unknown"). Ahora se descarga directamente un archivo PDF con su nombre,
// igual que en computador; el celular lo guarda en Descargas / Archivos y se abre desde ahí.

export function esMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

// Se mantiene por compatibilidad con las pantallas que la llaman antes de generar el PDF: ya no abre ninguna pestaña.
export function abrirVentanaPDF(): Window | null {
  return null
}

// Descarga un archivo con nombre a partir de un Blob (funciona en computador, Android y iPhone).
export function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombreArchivo; a.rel = 'noopener'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// Llamar DESPUÉS de generar el PDF (el doc de jsPDF).
export function entregarPDF(doc: any, nombreArchivo: string, ventana?: Window | null) {
  try { ventana?.close() } catch {}
  const nombre = /\.pdf$/i.test(nombreArchivo) ? nombreArchivo : nombreArchivo + '.pdf'
  const blob = doc.output('blob') as Blob
  descargarBlob(new Blob([blob], { type: 'application/pdf' }), nombre)
}
