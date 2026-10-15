import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { abrirVentanaPDF, entregarPDF } from '@/lib/abrirPDF'

export type GuiaPDF = {
  numero: number
  fechaTraslado: string
  origen: string
  destino: string
  motivo: string
  choferNombre: string
  choferRut: string
  patente: string
  transportista: string
  transportistaRut: string
  emitidoPor: string
  aprobadoPor: string
  fechaAprobacion: string
  items: { descripcion: string, codigo: string, cantidad: number, unidad: string, procedencia: string, observacion: string }[]
}

export const numeroGuia = (n: number | null | undefined) => (n ? 'GT-' + String(n).padStart(4, '0') : 'Sin número')

// Llamar apenas se hace clic (antes de cualquier await) para que el celular no bloquee la ventana.
export function abrirVentanaGuia() {
  return abrirVentanaPDF()
}

async function cargarLogo(): Promise<{ data: string, ratio: number } | null> {
  try {
    const res = await fetch('/logo-indeli.jpg')
    if (!res.ok) return null
    const blob = await res.blob()
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
    const dim: { w: number, h: number } = await new Promise((resolve, reject) => {
      const img = new Image()
      const limite = setTimeout(() => reject(new Error('timeout')), 6000)
      img.onload = () => { clearTimeout(limite); resolve({ w: img.width, h: img.height }) }
      img.onerror = () => { clearTimeout(limite); reject(new Error('error')) }
      img.src = data
    })
    return { data, ratio: dim.h / dim.w }
  } catch {
    return null
  }
}

const fechaCL = (f: string) => (f ? f.slice(0, 10).split('-').reverse().join('-') : '')

export async function generarGuiaTraslado(g: GuiaPDF, ventana: Window | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const M = 14
  const AZUL: [number, number, number] = [27, 79, 156]

  // Encabezado
  const logo = await cargarLogo()
  let y = M
  if (logo) doc.addImage(logo.data, 'JPEG', M, y, 34, 34 * logo.ratio)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...AZUL)
  doc.text('GUÍA DE TRASLADO INTERNO', ancho - M, y + 7, { align: 'right' })
  doc.setFontSize(14); doc.setTextColor(30, 30, 30)
  doc.text('N° ' + numeroGuia(g.numero), ancho - M, y + 14, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90)
  doc.text('Fecha de traslado: ' + fechaCL(g.fechaTraslado), ancho - M, y + 20, { align: 'right' })
  y += Math.max(logo ? 34 * logo.ratio : 12, 24) + 4

  // Leyenda
  doc.setDrawColor(...AZUL); doc.setLineWidth(0.5)
  doc.setFillColor(232, 240, 254)
  doc.roundedRect(M, y, ancho - M * 2, 11, 1.5, 1.5, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZUL)
  doc.text('TRASLADO NO CONSTITUYE VENTA', ancho / 2, y + 5, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70, 70, 70)
  doc.text('Documento de uso interno, sin valor tributario.', ancho / 2, y + 9, { align: 'center' })
  y += 15

  const tablaDatos = (titulo: string, filas: [string, string][]) => {
    autoTable(doc, {
      startY: y,
      head: [[{ content: titulo, colSpan: 2 }]],
      body: filas.map(f => [f[0], f[1] || '—']),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.8, textColor: [40, 40, 40], lineColor: [200, 205, 215] },
      headStyles: { fillColor: AZUL, textColor: 255, fontSize: 9 },
      columnStyles: { 0: { cellWidth: 38, fontStyle: 'bold', fillColor: [246, 248, 251] } },
      margin: { left: M, right: M },
    })
    y = (doc as any).lastAutoTable.finalY + 4
  }

  tablaDatos('Traslado', [['Origen', g.origen], ['Destino', g.destino], ['Motivo / observaciones', g.motivo]])
  tablaDatos('Transporte', [
    ['Chofer', g.choferNombre], ['RUT chofer', g.choferRut], ['Patente', g.patente],
    ['Empresa transportista', g.transportista], ['RUT transportista', g.transportistaRut],
  ])

  // Ítems
  autoTable(doc, {
    startY: y,
    head: [['N°', 'Descripción', 'Código', 'Cant.', 'Unidad', 'Procedencia']],
    body: g.items.map((it, k) => [String(k + 1), it.descripcion + (it.observacion ? '\n' + it.observacion : ''), it.codigo || '—', String(it.cantidad).replace('.', ','), it.unidad, it.procedencia]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.8, textColor: [40, 40, 40], lineColor: [200, 205, 215], valign: 'middle' },
    headStyles: { fillColor: AZUL, textColor: 255, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 26 }, 3: { cellWidth: 15, halign: 'center' }, 4: { cellWidth: 17 }, 5: { cellWidth: 36 } },
    margin: { left: M, right: M, bottom: 60 },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // Firmas (siempre al final de la última página, con espacio para firmar a mano)
  if (y > alto - 62) { doc.addPage(); y = M }
  const yFirmas = Math.max(y + 6, alto - 56)
  const colW = (ancho - M * 2 - 8) / 3
  const firma = (x: number, titulo: string, lineas: string[]) => {
    doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3)
    doc.line(x, yFirmas + 14, x + colW, yFirmas + 14)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(40, 40, 40)
    doc.text(titulo, x + colW / 2, yFirmas + 18.5, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 90, 90)
    lineas.forEach((l, k) => doc.text(l, x + colW / 2, yFirmas + 23 + k * 4, { align: 'center', maxWidth: colW }))
  }
  firma(M, 'Emite / Aprueba', [g.emitidoPor ? 'Emite: ' + g.emitidoPor : '', g.aprobadoPor ? 'Aprueba: ' + g.aprobadoPor : '', g.fechaAprobacion ? 'Fecha: ' + fechaCL(g.fechaAprobacion) : ''].filter(Boolean))
  firma(M + colW + 4, 'Chofer', [g.choferNombre, g.choferRut ? 'RUT ' + g.choferRut : ''].filter(Boolean))
  firma(M + (colW + 4) * 2, 'Recibe conforme', ['Nombre:', 'RUT:', 'Fecha:'])

  // Pie
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
    doc.text(`${numeroGuia(g.numero)} · Traslado no constituye venta · Página ${i} de ${total}`, ancho / 2, alto - 6, { align: 'center' })
  }

  entregarPDF(doc, `Guia_Traslado_${numeroGuia(g.numero)}.pdf`, ventana)
}
