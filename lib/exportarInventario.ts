import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { abrirVentanaPDF, entregarPDF } from '@/lib/abrirPDF'

// Datos que recibe la exportación: exactamente lo que el usuario está viendo en pantalla
// (ya filtrado por ubicación, categoría, tipo y clase).
export type FilaPropia = {
  ubicacion: string
  categoria: string
  tipo: string
  producto: string
  codigo: string
  cantidad: number | null
  estado: string
}

export type FilaArriendo = {
  ubicacion: string
  categoria: string
  tipo: string
  descripcion: string
  proveedor: string
  ordenCompra: string
  fechaInicio: string
  estado: string
}

export type DatosExportacion = {
  propias: FilaPropia[]
  arrendadas: FilaArriendo[]
  // Texto que describe los filtros activos, ej. "Ubicación: Faena Quillota · Categoría: Todas"
  filtros: string
  // Nombre de la ubicación si se filtró por una sola (se usa en el nombre del archivo)
  ubicacionNombre: string
}

function hoyISO() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function hoyLegible() {
  const [y, m, d] = hoyISO().split('-')
  return `${d}-${m}-${y}`
}

function formatFecha(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}-${m}-${y}` : iso
}

function nombreArchivo(base: string, ubicacionNombre: string, extension: string) {
  const ub = ubicacionNombre
    ? '_' + ubicacionNombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
    : ''
  return `${base}${ub}_${hoyISO()}.${extension}`
}

// ───────────────────────── EXCEL ─────────────────────────

export async function exportarInventarioExcel(datos: DatosExportacion) {
  // Se carga solo cuando se necesita, para no hacer pesada la carga normal de la página
  const ExcelJS = (await import('exceljs')).default
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Sistema INDELI'
  libro.created = new Date()

  const estiloEncabezado = (fila: any) => {
    fila.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    fila.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    fila.height = 22
    fila.eachCell((celda: any) => {
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F9C' } }
      celda.border = { bottom: { style: 'thin', color: { argb: 'FF123A75' } } }
    })
  }

  const agregarCabecera = (hoja: any, titulo: string, columnas: number) => {
    hoja.mergeCells(1, 1, 1, columnas)
    hoja.getCell(1, 1).value = titulo
    hoja.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF1B4F9C' } }
    hoja.mergeCells(2, 1, 2, columnas)
    hoja.getCell(2, 1).value = `Generado el ${hoyLegible()} · ${datos.filtros}`
    hoja.getCell(2, 1).font = { size: 10, color: { argb: 'FF666666' } }
  }

  if (datos.propias.length > 0 || datos.arrendadas.length === 0) {
    const hoja = libro.addWorksheet('Herramientas propias')
    const cols = [
      { h: 'Ubicación', w: 24 }, { h: 'Categoría', w: 22 }, { h: 'Tipo', w: 22 },
      { h: 'Descripción', w: 38 }, { h: 'Código', w: 14 }, { h: 'Cantidad', w: 10 },
      { h: 'Estado', w: 10 }, { h: 'Verificado en faena (Sí/No)', w: 16 }, { h: 'Observaciones', w: 34 },
    ]
    agregarCabecera(hoja, 'Inventario — Herramientas propias', cols.length)
    hoja.getRow(3).values = cols.map(c => c.h)
    estiloEncabezado(hoja.getRow(3))
    cols.forEach((c, i) => { hoja.getColumn(i + 1).width = c.w })
    datos.propias.forEach(f => {
      hoja.addRow([f.ubicacion, f.categoria, f.tipo, f.producto, f.codigo, f.cantidad ?? '', f.estado, '', ''])
    })
    hoja.views = [{ state: 'frozen', ySplit: 3 }]
    if (datos.propias.length > 0) {
      hoja.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + datos.propias.length, column: cols.length } }
    }
  }

  if (datos.arrendadas.length > 0) {
    const hoja = libro.addWorksheet('Equipos arrendados')
    const cols = [
      { h: 'Ubicación', w: 24 }, { h: 'Categoría', w: 22 }, { h: 'Tipo', w: 22 },
      { h: 'Descripción', w: 38 }, { h: 'Proveedor', w: 24 }, { h: 'N° OC', w: 14 },
      { h: 'Fecha inicio', w: 13 }, { h: 'Estado', w: 10 },
      { h: 'Verificado en faena (Sí/No)', w: 16 }, { h: 'Observaciones', w: 34 },
    ]
    agregarCabecera(hoja, 'Inventario — Equipos arrendados', cols.length)
    hoja.getRow(3).values = cols.map(c => c.h)
    estiloEncabezado(hoja.getRow(3))
    cols.forEach((c, i) => { hoja.getColumn(i + 1).width = c.w })
    datos.arrendadas.forEach(f => {
      hoja.addRow([f.ubicacion, f.categoria, f.tipo, f.descripcion, f.proveedor, f.ordenCompra, formatFecha(f.fechaInicio), f.estado, '', ''])
    })
    hoja.views = [{ state: 'frozen', ySplit: 3 }]
    hoja.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + datos.arrendadas.length, column: cols.length } }
  }

  const buffer = await libro.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo('Inventario', datos.ubicacionNombre, 'xlsx')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ───────────────────────── PDF ─────────────────────────

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
    return null // si el logo falla, el PDF se genera igual sin él
  }
}

// Llamar ANTES de cualquier "await" (apenas se hace clic) para que el celular no bloquee la ventana.
export function abrirVentanaExportacion() {
  return abrirVentanaPDF()
}

export async function exportarInventarioPDF(datos: DatosExportacion, ventana: Window | null) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const anchoPag = doc.internal.pageSize.getWidth()
  const MARGEN = 12
  const AZUL: [number, number, number] = [27, 79, 156]

  // Encabezado
  const logo = await cargarLogo()
  let y = MARGEN
  if (logo) {
    const w = 28
    doc.addImage(logo.data, 'JPEG', MARGEN, y, w, w * logo.ratio)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...AZUL)
  doc.text('Inventario — Hoja de verificación', anchoPag - MARGEN, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(`Fecha: ${hoyLegible()}`, anchoPag - MARGEN, y + 12, { align: 'right' })
  const filtrosLineas = doc.splitTextToSize(datos.filtros, anchoPag - MARGEN * 2 - 40)
  doc.text(filtrosLineas, anchoPag - MARGEN, y + 17, { align: 'right' })
  y += Math.max(logo ? 28 * logo.ratio : 10, 17 + filtrosLineas.length * 4) + 6

  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text('Marque "Sí" o "No" en cada ítem y anote observaciones. Devolver firmado.', MARGEN, y)
  y += 4

  const tablaBase = {
    theme: 'grid' as const,
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [210, 214, 222] as [number, number, number], lineWidth: 0.2, valign: 'middle' as const },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' as const },
    margin: { left: MARGEN, right: MARGEN, bottom: 22 },
  }

  // Herramientas propias, agrupadas por ubicación para que cada faena reciba su propia sección
  if (datos.propias.length > 0) {
    const grupos = new Map<string, FilaPropia[]>()
    datos.propias.forEach(f => {
      if (!grupos.has(f.ubicacion)) grupos.set(f.ubicacion, [])
      grupos.get(f.ubicacion)!.push(f)
    })
    const cuerpo: any[] = []
    grupos.forEach((filas, ubicacion) => {
      cuerpo.push([{ content: `${ubicacion}  (${filas.length} ${filas.length === 1 ? 'ítem' : 'ítems'})`, colSpan: 8, styles: { fillColor: [232, 240, 254], textColor: AZUL, fontStyle: 'bold' } }])
      filas.forEach(f => cuerpo.push([f.categoria, f.tipo, f.producto, f.codigo, f.cantidad ?? '—', f.estado, '', '']))
    })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30)
    doc.text('Herramientas propias', MARGEN, y + 5)
    autoTable(doc, {
      ...tablaBase,
      startY: y + 8,
      head: [['Categoría', 'Tipo', 'Descripción', 'Código', 'Cant.', 'Estado', 'Sí / No', 'Observaciones']],
      body: cuerpo,
      columnStyles: {
        0: { cellWidth: 32 }, 1: { cellWidth: 32 }, 3: { cellWidth: 22 },
        4: { cellWidth: 12, halign: 'center' }, 5: { cellWidth: 16 }, 6: { cellWidth: 16 }, 7: { cellWidth: 50 },
      },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  }

  if (datos.arrendadas.length > 0) {
    const grupos = new Map<string, FilaArriendo[]>()
    datos.arrendadas.forEach(f => {
      if (!grupos.has(f.ubicacion)) grupos.set(f.ubicacion, [])
      grupos.get(f.ubicacion)!.push(f)
    })
    const cuerpo: any[] = []
    grupos.forEach((filas, ubicacion) => {
      cuerpo.push([{ content: `${ubicacion}  (${filas.length} ${filas.length === 1 ? 'equipo' : 'equipos'})`, colSpan: 8, styles: { fillColor: [232, 240, 254], textColor: AZUL, fontStyle: 'bold' } }])
      filas.forEach(f => cuerpo.push([f.tipo, f.descripcion, f.proveedor, f.ordenCompra, formatFecha(f.fechaInicio), f.estado, '', '']))
    })
    const altoRestante = doc.internal.pageSize.getHeight() - y
    if (altoRestante < 40) { doc.addPage(); y = MARGEN }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30)
    doc.text('Equipos arrendados', MARGEN, y + 5)
    autoTable(doc, {
      ...tablaBase,
      startY: y + 8,
      head: [['Tipo', 'Descripción', 'Proveedor', 'N° OC', 'Inicio', 'Estado', 'Sí / No', 'Observaciones']],
      body: cuerpo,
      columnStyles: {
        0: { cellWidth: 30 }, 2: { cellWidth: 34 }, 3: { cellWidth: 20 }, 4: { cellWidth: 22 },
        5: { cellWidth: 16 }, 6: { cellWidth: 16 }, 7: { cellWidth: 46 },
      },
    })
  }

  if (datos.propias.length === 0 && datos.arrendadas.length === 0) {
    doc.setFontSize(11)
    doc.text('No hay inventario registrado con este filtro.', MARGEN, y + 10)
  }

  // Pie en cada página: número de página y espacio para firma
  const total = doc.getNumberOfPages()
  const altoPag = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 110, 110)
    doc.text(`Página ${i} de ${total}`, anchoPag - MARGEN, altoPag - 6, { align: 'right' })
    if (i === total) {
      doc.setDrawColor(150, 150, 150)
      doc.line(MARGEN, altoPag - 12, MARGEN + 70, altoPag - 12)
      doc.text('Nombre y firma de quien verificó', MARGEN, altoPag - 8)
      doc.line(MARGEN + 90, altoPag - 12, MARGEN + 130, altoPag - 12)
      doc.text('Fecha', MARGEN + 90, altoPag - 8)
    }
  }

  entregarPDF(doc, nombreArchivo('Inventario', datos.ubicacionNombre, 'pdf'), ventana)
}
