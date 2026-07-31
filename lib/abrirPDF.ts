// En celular, jsPDF (.save()) suele abrir una pestaña en blanco antes de mostrar el documento,
// o mostrarlo como un link en vez de un PDF real. Para evitar eso, en celular abrimos
// una pestaña ANTES de generar el PDF (para que el navegador no la bloquee), y una vez listo el
// documento, la llenamos con el PDF real. En computador se mantiene la descarga normal.

export function esMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

// Llamar ANTES de generar el PDF (de forma sincrónica, apenas se hace clic), para que el
// navegador no bloquee la ventana por considerarla un popup no solicitado.
export function abrirVentanaPDF(): Window | null {
  if (!esMobile()) return null
  return window.open('', '_blank')
}

// Llamar DESPUÉS de generar el PDF (el doc de jsPDF), con la ventana que abrió abrirVentanaPDF().
export function entregarPDF(doc: any, nombreArchivo: string, ventana: Window | null) {
  if (esMobile()) {
    const blobUrl = doc.output('bloburl') as unknown as string
    if (ventana) {
      ventana.location.href = blobUrl
    } else {
      window.open(blobUrl, '_blank')
    }
  } else {
    doc.save(nombreArchivo)
  }
}
