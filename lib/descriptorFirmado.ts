import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { esMobile } from '@/lib/abrirPDF'

const fh = (f?: string | null) => f ? new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—'

// Descriptor de cargo firmado: el PDF original del descriptor + una hoja final con la firma del APR y la verificación de la jefatura.
export async function descargarDescriptorFirmado(d: { desc: any, nombre: string, faena: string, doc: any | null, verificador?: string }) {
  const ventana = esMobile() ? window.open('', '_blank') : null
  try {
    let pdf: PDFDocument
    if (d.doc?.path) {
      const { data, error } = await supabase.storage.from('hsec-documentos').download(d.doc.path)
      if (error || !data) throw new Error('No se pudo leer el documento del descriptor.')
      pdf = await PDFDocument.load(await data.arrayBuffer())
    } else pdf = await PDFDocument.create()

    const pag = pdf.addPage([595, 842])
    const f = await pdf.embedFont(StandardFonts.Helvetica), fb = await pdf.embedFont(StandardFonts.HelveticaBold)
    const azul = rgb(0.106, 0.31, 0.612), gris = rgb(0.4, 0.45, 0.52)
    let y = 790
    pag.drawText('CONSTANCIA DE FIRMA', { x: 50, y, size: 18, font: fb, color: azul }); y -= 22
    pag.drawText('Descriptor de cargo · Asesor(a) en Prevención de Riesgos', { x: 50, y, size: 12, font: f }); y -= 14
    pag.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: azul }); y -= 30
    const fila = (k: string, v: string) => { pag.drawText(k, { x: 50, y, size: 10, font: fb, color: gris }); pag.drawText(v || '—', { x: 190, y, size: 11, font: f }); y -= 20 }
    fila('Nombre', d.nombre)
    fila('Faena / ubicación', d.faena)
    fila('Documento', [d.doc?.codigo, d.doc?.revision ? `Rev. ${d.doc.revision}` : '', d.doc?.fecha_doc].filter(Boolean).join(' · '))
    fila('Firmado el', fh(d.desc.firmado_at))
    fila('Verificado por la jefatura', d.desc.estado === 'verificado' ? `${d.verificador || 'Jefatura'} · ${fh(d.desc.verificado_at)}` : 'Pendiente de verificación')
    y -= 10
    pag.drawText('Declaración', { x: 50, y, size: 10, font: fb, color: gris }); y -= 16
    for (const l of ['La persona indicada declara haber leído su descriptor de cargo y asume las responsabilidades', 'que en él se señalan. La firma fue registrada digitalmente en el Sistema INDELI.']) { pag.drawText(l, { x: 50, y, size: 10.5, font: f }); y -= 15 }
    y -= 20
    pag.drawText('Firma del APR', { x: 50, y, size: 10, font: fb, color: gris }); y -= 6
    if (d.desc.firma) {
      const img = await pdf.embedPng(d.desc.firma)
      const esc = Math.min(260 / img.width, 100 / img.height)
      const w = img.width * esc, h = img.height * esc
      pag.drawImage(img, { x: 50, y: y - h - 4, width: w, height: h }); y -= h + 8
    }
    pag.drawLine({ start: { x: 50, y }, end: { x: 330, y }, thickness: 0.8, color: gris }); y -= 14
    pag.drawText(d.nombre, { x: 50, y, size: 11, font: fb })
    pag.drawText('INDELI Construcción y Montaje Limitada · Sistema INDELI', { x: 50, y: 40, size: 8, font: f, color: gris })

    const bytes = await pdf.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    if (ventana) ventana.location.href = url
    else { const a = document.createElement('a'); a.href = url; a.download = `Descriptor_firmado_${d.nombre.replace(/\s+/g, '_')}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000) }
  } catch (e: any) {
    ventana?.close(); alert('No se pudo generar el PDF: ' + (e?.message || e))
  }
}
