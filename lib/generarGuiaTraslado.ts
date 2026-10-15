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
  firmaAprobador?: string | null // imagen (data URL) de la firma de quien aprueba
  items: { descripcion: string, codigo: string, cantidad: number, unidad: string, procedencia: string, observacion: string }[]
}

export const numeroGuia = (n: number | null | undefined) => (n ? 'GT-' + String(n).padStart(4, '0') : 'Sin número')

// Datos de la empresa (mismo formato que las guías de despacho emitidas desde KAME)
const EMPRESA = {
  rut: '79.866.670-3',
  nombre: ['INDELI CONSTRUCCION Y', 'MONTAJE LIMITADA'],
  giro: 'CONSTRUCCION',
  matriz: 'FUNDO LA FAMA LOTE C3-3B- QUILLOTA, QUILLOTA, Tel: 332346205',
  email: 'ANGELA.SILVA@INDELI.CL',
}

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

// Re-dibuja la imagen en un canvas y la devuelve como PNG de 32 bits: jsPDF no maneja bien los PNG con paleta y transparencia.
async function normalizarImagen(data: string): Promise<{ data: string, w: number, h: number } | null> {
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image()
      const limite = setTimeout(() => reject(new Error('timeout')), 6000)
      i.onload = () => { clearTimeout(limite); resolve(i) }
      i.onerror = () => { clearTimeout(limite); reject(new Error('error')) }
      i.src = data
    })
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    c.getContext('2d')!.drawImage(img, 0, 0)
    return { data: c.toDataURL('image/png'), w: img.width, h: img.height }
  } catch { return null }
}

async function dimensionesImagen(data: string): Promise<{ w: number, h: number } | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      const limite = setTimeout(() => reject(new Error('timeout')), 6000)
      img.onload = () => { clearTimeout(limite); resolve({ w: img.width, h: img.height }) }
      img.onerror = () => { clearTimeout(limite); reject(new Error('error')) }
      img.src = data
    })
  } catch { return null }
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fechaLarga = (f: string) => {
  const p = (f || '').slice(0, 10).split('-')
  if (p.length !== 3) return ''
  return `${Number(p[2])} de ${MESES[Number(p[1]) - 1]} del ${p[0]}`
}

export async function generarGuiaTraslado(g: GuiaPDF, ventana: Window | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()   // 210
  const H = doc.internal.pageSize.getHeight()  // 297
  const M = 12
  const ROJO: [number, number, number] = [255, 0, 0]
  const AZUL: [number, number, number] = [0, 0, 128]
  const GRIS: [number, number, number] = [170, 170, 170]
  const logo = await cargarLogo()
  let firmaImg: string | null = null
  let firmaDim: { w: number, h: number } | null = null
  if (g.firmaAprobador) {
    const n = await normalizarImagen(g.firmaAprobador)
    if (n) { firmaImg = n.data; firmaDim = { w: n.w, h: n.h } }
    else { firmaImg = g.firmaAprobador; firmaDim = await dimensionesImagen(g.firmaAprobador) }
  }

  // Encabezado: se repite en cada página
  const encabezado = () => {
    if (logo) doc.addImage(logo.data, 'JPEG', M + 2, 15, 36, 36 * logo.ratio)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...ROJO)
    doc.text(EMPRESA.nombre[0], 58, 21)
    doc.text(EMPRESA.nombre[1], 58, 26.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...AZUL)
    doc.text('Giro: ' + EMPRESA.giro, 58, 31)
    doc.text('Matriz: ' + EMPRESA.matriz, 58, 34.5, { maxWidth: 58 })
    doc.text('E-mail: ' + EMPRESA.email, 58, 42)

    // Recuadro rojo con el número
    const bx = 124, by = 8, bw = W - M - bx, bh = 36
    doc.setDrawColor(...ROJO); doc.setLineWidth(0.9)
    doc.rect(bx, by, bw, bh)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...ROJO)
    doc.setFontSize(11.5)
    doc.text('R.U.T.:' + EMPRESA.rut, bx + bw / 2, by + 9, { align: 'center' })
    doc.setFontSize(11.5)
    doc.setFontSize(13)
    doc.text('GUÍA DE TRASLADO', bx + bw / 2, by + 21.5, { align: 'center' })
    doc.setFontSize(12)
    doc.text('Nº ' + numeroGuia(g.numero), bx + bw / 2, by + 32.5, { align: 'center' })
  }

  // Marca de agua con el logo
  const marcaAgua = () => {
    if (!logo) return
    try {
      const w = 92
      const GS = (doc as any).GState
      if (GS) doc.setGState(new GS({ opacity: 0.13 }))
      doc.addImage(logo.data, 'JPEG', (W - w) / 2, 118, w, w * logo.ratio)
      if (GS) doc.setGState(new GS({ opacity: 1 }))
    } catch {}
  }

  encabezado()
  marcaAgua()

  let y = 58
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...AZUL)
  doc.text('Fecha Emisión:', M + 4, y)
  doc.setTextColor(30, 30, 30)
  doc.text(fechaLarga(g.fechaAprobacion || new Date().toISOString()), M + 25, y)
  y += 4
  doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 6

  // Datos del traslado (dos columnas, como la guía de despacho)
  const dato = (x: number, yy: number, etiqueta: string, valor: string, ancho: number, ancho0 = 28) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...AZUL)
    doc.text(etiqueta, x, yy)
    doc.setTextColor(30, 30, 30)
    const lineas = doc.splitTextToSize(valor || '—', ancho) as string[]
    doc.text(lineas, x + ancho0, yy)
    return lineas.length
  }
  const filasIzq: [string, string][] = [['ORIGEN:', g.origen], ['DESTINO:', g.destino], ['MOTIVO:', g.motivo], ['TRANSPORTISTA:', g.transportista]]
  const filasDer: [string, string][] = [['FECHA TRASLADO:', fechaLarga(g.fechaTraslado)], ['TRASLADO:', 'TRASLADO NO CONSTITUYE VENTA'], ['EMITE:', g.emitidoPor], ['APRUEBA:', g.aprobadoPor]]
  let yi = y, yd = y
  filasIzq.forEach(([e, v]) => { const n = dato(M + 4, yi, e, v, 62, 29); yi += 4.2 * n + 0.6 })
  filasDer.forEach(([e, v]) => { const n = dato(112, yd, e, v, 52, 31); yd += 4.2 * n + 0.6 })
  y = Math.max(yi, yd) + 1
  doc.line(M, y, W - M, y)
  y += 5

  // Ítems (cabecera gris, sin líneas, como la guía de despacho)
  autoTable(doc, {
    startY: y,
    head: [['Código', 'Descripción', 'Cantidad', 'Procedencia']],
    body: g.items.map(it => [
      it.codigo || '-',
      it.descripcion + (it.observacion ? '\n' + it.observacion : ''),
      `${String(it.cantidad).replace('.', ',')} ${it.unidad.toUpperCase()}`,
      it.procedencia,
    ]),
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 }, textColor: [45, 45, 45], valign: 'top' },
    headStyles: { fillColor: GRIS, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
    columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 28, halign: 'right' }, 3: { cellWidth: 46 } },
    margin: { left: M, right: M, top: 60, bottom: 66 },
    didDrawPage: (d: any) => { if (d.pageNumber > 1) { encabezado(); marcaAgua() } },
  })
  y = (doc as any).lastAutoTable.finalY + 6

  // Bloque final en la última página: datos del transporte y firmas
  if (y > H - 70) { doc.addPage(); encabezado(); marcaAgua(); y = 60 }
  const yBase = H - 62
  doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3)
  doc.line(M, yBase - 7, W - M, yBase - 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  let x = M + 2
  const campo = (e: string, v: string) => {
    doc.setTextColor(...AZUL); doc.text(e + ' ', x, yBase - 2)
    x += doc.getTextWidth(e + ' ')
    doc.setTextColor(30, 30, 30); doc.text(v || '—', x, yBase - 2)
    x += doc.getTextWidth(v || '—') + 5
  }
  campo('RUT CHOFER:', g.choferRut); campo('RUT TRANSPORTE:', g.transportistaRut); campo('PATENTE:', g.patente); campo('NOMBRE CHOFER:', g.choferNombre)

  const colW = (W - M * 2 - 12) / 3
  const yF = yBase + 24
  const firma = (cx: number, titulo: string, lineas: string[], imagen?: string | null) => {
    if (imagen && firmaDim) {
      const maxW = colW - 10, maxH = 20
      let w = maxW, h = (firmaDim.h / firmaDim.w) * w
      if (h > maxH) { h = maxH; w = (firmaDim.w / firmaDim.h) * h }
      try { doc.addImage(imagen, /^data:image\/jpe?g/i.test(imagen) ? 'JPEG' : 'PNG', cx + (colW - w) / 2, yF - h - 1, w, h) } catch {}
    }
    doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3)
    doc.line(cx, yF, cx + colW, yF)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AZUL)
    doc.text(titulo, cx + colW / 2, yF + 4.5, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 80)
    lineas.forEach((l, k) => doc.text(l, cx + colW / 2, yF + 9 + k * 3.8, { align: 'center', maxWidth: colW }))
  }
  firma(M, 'Emite / Aprueba', [g.aprobadoPor ? 'Aprueba: ' + g.aprobadoPor : '', g.emitidoPor ? 'Emite: ' + g.emitidoPor : ''].filter(Boolean), firmaImg)
  firma(M + colW + 6, 'Chofer', [g.choferNombre, g.choferRut ? 'RUT ' + g.choferRut : ''].filter(Boolean))
  firma(M + (colW + 6) * 2, 'Recibe conforme', ['Nombre:', 'RUT:', 'Fecha:'])

  // Pie
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...AZUL)
    doc.text('Documento generado por Sistema INDELI · Traslado no constituye venta', W / 2, H - 9, { align: 'center' })
    doc.setTextColor(120, 120, 120)
    doc.text(`${numeroGuia(g.numero)} · Página ${i} de ${total}`, W / 2, H - 5, { align: 'center' })
  }

  entregarPDF(doc, `Guia_Traslado_${numeroGuia(g.numero)}.pdf`, ventana)
}
