import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { esMobile } from '@/lib/abrirPDF'

const fechaCL = (f?: string | null) => f ? new Date(f).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : ''

// Descriptor de cargo firmado: el mismo PDF del descriptor con los datos y la firma estampados en el punto IX (última página).
export async function descargarDescriptorFirmado(d: { desc: any, nombre: string, faena: string, doc: any | null, verificador?: string }) {
  const ventana = esMobile() ? window.open('', '_blank') : null
  try {
    if (!d.doc?.path) throw new Error('No hay documento de descriptor cargado.')
    const { data, error } = await supabase.storage.from('hsec-documentos').download(d.doc.path)
    if (error || !data) throw new Error('No se pudo leer el documento del descriptor.')
    const pdf = await PDFDocument.load(await data.arrayBuffer())
    const pag = pdf.getPage(pdf.getPageCount() - 1)
    const { height: H } = pag.getSize()
    const f = await pdf.embedFont(StandardFonts.Helvetica)
    const negro = rgb(0.06, 0.12, 0.3)

    // Posiciones de la tabla del punto IX (formato DC-APR Rev. 01, medidas desde el borde superior de la hoja)
    const X = 312, maxW = 238
    const escribir = (texto: string, topCentro: number) => {
      let size = 10.5
      while (size > 6 && f.widthOfTextAtSize(texto, size) > maxW) size -= 0.5
      pag.drawText(texto, { x: X, y: H - topCentro - size * 0.35, size, font: f, color: negro })
    }
    escribir(d.desc.nombre_firma || d.nombre, 427.7)
    escribir(d.desc.rut_firma || '', 446.8)
    escribir(d.desc.faena_contrato || d.faena, 465.9)
    escribir(fechaCL(d.desc.firmado_at), 485)
    if (d.desc.firma) {
      const img = await pdf.embedPng(d.desc.firma)
      const esc = Math.min(maxW / img.width, 44 / img.height)
      const w = img.width * esc, h = img.height * esc
      pag.drawImage(img, { x: X, y: H - 496 - 46 + (46 - h) / 2, width: w, height: h })
    }

    const bytes = await pdf.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    if (ventana) ventana.location.href = url
    else { const a = document.createElement('a'); a.href = url; a.download = `Descriptor_firmado_${d.nombre.replace(/\s+/g, '_')}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000) }
  } catch (e: any) {
    ventana?.close(); alert('No se pudo generar el PDF: ' + (e?.message || e))
  }
}
