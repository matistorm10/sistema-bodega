import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const ANCHO_LOGO = 28 // mm — mismo tamaño en los 3 documentos

function formatFecha(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

async function cargarImagenBase64(url: string): Promise<{ data: string, ratio: number }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar la imagen: ${url}`)
  const blob = await res.blob()
  const data: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  const dimensiones: { w: number, h: number } = await new Promise((resolve, reject) => {
    const img = new Image()
    const limite = setTimeout(() => reject(new Error('Tiempo de espera agotado cargando la imagen')), 6000)
    img.onload = () => { clearTimeout(limite); resolve({ w: img.width, h: img.height }) }
    img.onerror = () => { clearTimeout(limite); reject(new Error('No se pudo decodificar la imagen')) }
    img.src = data
  })
  return { data, ratio: dimensiones.h / dimensiones.w }
}

export async function generarChecklistPDF(params: {
  vehiculo: any
  items: { numero: number, texto: string, estado: 'bueno' | 'regular' | 'malo' }[]
  realizadoPor: string
  fecha: string
}) {
  const { vehiculo, items, fecha } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const alturaPagina = doc.internal.pageSize.getHeight()
  const margen = 12

  // Logo arriba a la derecha (mismo tamaño y posición en los 3 documentos)
  let logo: { data: string, ratio: number } | null = null
  try { logo = await cargarImagenBase64('/logo-indeli.jpg') } catch (e) { console.error('No se pudo cargar el logo:', e) }
  if (logo) {
    doc.addImage(logo.data, 'JPEG', anchoPagina - margen - ANCHO_LOGO, 8, ANCHO_LOGO, ANCHO_LOGO * logo.ratio)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('CHECK LIST', margen, 15)
  doc.setFontSize(10)
  doc.text(`${vehiculo.tipo}${vehiculo.patente ? ' ' + vehiculo.patente : vehiculo.codigo_interno ? ' ' + vehiculo.codigo_interno : ''}`, margen, 21)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const colIzq = margen
  const colDer = anchoPagina / 2 + 5
  let yInfo = 29
  doc.text(`Marca: ${vehiculo.marca || '—'}`, colIzq, yInfo)
  doc.text(`Chasis: ${vehiculo.chasis || '—'}`, colDer, yInfo)
  yInfo += 5
  doc.text(`Modelo: ${vehiculo.modelo || '—'}`, colIzq, yInfo)
  doc.text(`Motor: ${vehiculo.codigo_motor || '—'}`, colDer, yInfo)
  yInfo += 5
  doc.text(`Año: ${vehiculo.anio || '—'}`, colIzq, yInfo)
  doc.text(`Fecha: ${formatFecha(fecha)}`, colDer, yInfo)

  const filas = items.map(it => {
    const marcaB = it.estado === 'bueno' ? 'X' : ''
    const marcaR = it.estado === 'regular' ? 'X' : ''
    const marcaM = it.estado === 'malo' ? 'X' : ''
    return [String(it.numero), it.texto, marcaB, marcaR, marcaM]
  })

  autoTable(doc, {
    startY: yInfo + 5,
    head: [['N°', 'Ítem', 'BUENO', 'REG.', 'MALO']],
    body: filas,
    margin: { left: margen, right: margen },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.3, valign: 'middle' },
    headStyles: { fillColor: [27, 79, 156], textColor: 255, halign: 'center', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
    },
  })

  // @ts-ignore - lastAutoTable es agregado por el plugin en tiempo de ejecución
  let y = (doc as any).lastAutoTable.finalY + 7

  // Espacio real necesario: OBSERVACIONES + línea + fecha + firma, todo comprimido (~55mm)
  const espacioNecesario = 55
  if (y > alturaPagina - espacioNecesario) { doc.addPage(); y = 18 }

  doc.setFontSize(8.5)
  doc.text('OBSERVACIONES:', margen, y)
  doc.setDrawColor(200)
  doc.line(margen, y + 7, anchoPagina - margen, y + 7)
  y += 15

  doc.text(`Fecha: ${formatFecha(fecha)}`, margen, y)
  y += 6

  try {
    const firma = await cargarImagenBase64('/firma-jorge-brito.png')
    const anchoFirma = 35
    const altoFirma = anchoFirma * firma.ratio
    if (y + altoFirma > alturaPagina - 8) { doc.addPage(); y = 18 }
    doc.addImage(firma.data, 'PNG', margen, y, anchoFirma, altoFirma)
  } catch (e) { console.error('No se pudo cargar la firma:', e) }

  const nombreArchivo = `Checklist_${(vehiculo.patente || vehiculo.codigo_interno || 'vehiculo').replace(/\s+/g,'_')}_${fecha}.pdf`
  return { doc, nombreArchivo }
}
