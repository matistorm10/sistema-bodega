import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

const ITEMS_ESTANDAR = [
  'LAVADO GENERAL', 'CONTROL DE NIVELES', 'NEUMÁTICOS', 'FRENOS', 'DOCUMENTOS', 'LUCES', 'INSTRUMENTOS', 'ELEMENTOS DE SEGURIDAD',
]

const ANCHO_LOGO = 28 // mm — mismo tamaño en los 3 documentos

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

export async function generarProgramaMantencion(params: {
  vehiculo: any
  valorActual: string
  valorProximo: string
}) {
  const { vehiculo, valorActual, valorProximo } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const alturaPagina = doc.internal.pageSize.getHeight()
  const margen = 14

  let logo: { data: string, ratio: number } | null = null
  try { logo = await cargarImagenBase64('/logo-indeli.jpg') } catch (e) { console.error('No se pudo cargar el logo:', e) }
  if (logo) {
    doc.addImage(logo.data, 'JPEG', anchoPagina - margen - ANCHO_LOGO, 10, ANCHO_LOGO, ANCHO_LOGO * logo.ratio)
  }

  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('PROGRAMA DE MANTENCIÓN PROGRAMADA', margen, y)
  y += 6
  doc.setFontSize(10)
  doc.text('EQUIPOS INDELI CONSTRUCCIÓN Y MONTAJE LIMITADA', margen, y)
  y += 14

  const unidad = vehiculo.tipo_medicion === 'horas' ? 'Hrs' : 'Km'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const colIzq = margen
  const colDer = anchoPagina / 2 + 5
  doc.text(`Equipo: ${vehiculo.tipo || '—'}`, colIzq, y)
  doc.text(`Patente/Código: ${vehiculo.patente || vehiculo.codigo_interno || '—'}`, colDer, y)
  y += 6
  doc.text(`Marca: ${vehiculo.marca || '—'}`, colIzq, y)
  doc.text(`Modelo: ${vehiculo.modelo || '—'}`, colDer, y)
  y += 6
  doc.text(`Chasis: ${vehiculo.chasis || '—'}`, colIzq, y)
  doc.text(`Motor: ${vehiculo.codigo_motor || '—'}`, colDer, y)
  y += 6
  doc.text(`${unidad} actuales: ${valorActual ? Number(valorActual).toLocaleString('es-CL') : '—'}`, colIzq, y)
  doc.text(`Próxima mantención: ${valorProximo ? Number(valorProximo).toLocaleString('es-CL') : '—'}`, colDer, y)
  y += 6
  const frecuencia = vehiculo.tipo_medicion === 'horas' ? 'cada 250 horas' : 'cada 5.000 km'
  doc.setFont('helvetica', 'bold')
  doc.text(`Frecuencia de revisión: ${frecuencia}`, colIzq, y)
  doc.setFont('helvetica', 'normal')
  y += 10

  const hoy = new Date()
  const meses: string[] = []
  for (let i = 0; i < 6; i++) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    meses.push(MESES[f.getMonth()])
  }

  // Solo el mes actual (el primero) queda marcado con un check; los próximos 5 quedan como casilla vacía [ ]
  const filas = ITEMS_ESTANDAR.map(item => [item, ...meses.map((_, i) => i === 0 ? '' : '[ ]')])

  autoTable(doc, {
    startY: y,
    head: [['Ítem a revisar', ...meses]],
    body: filas,
    margin: { left: margen, right: margen },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: [27, 79, 156], textColor: 255 },
    columnStyles: { 0: { halign: 'left', cellWidth: 45 } },
    didDrawCell: (data) => {
      // Dibuja un check (✓) a mano en la columna del mes actual, ya que las fuentes estándar del PDF no traen ese símbolo
      if (data.section === 'body' && data.column.index === 1) {
        const { x, y: cy, width, height } = data.cell
        const cx = x + width / 2
        const centroY = cy + height / 2
        doc.setDrawColor(19, 115, 51)
        doc.setLineWidth(0.7)
        doc.line(cx - 2.2, centroY, cx - 0.5, centroY + 1.8)
        doc.line(cx - 0.5, centroY + 1.8, cx + 2.6, centroY - 2.2)
        doc.setDrawColor(0)
      }
    },
  })

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text('NOTA: Todas las mantenciones son de acuerdo a las especificaciones del fabricante.', margen, y)
  doc.setTextColor(0)
  y += 16

  doc.setFontSize(10)
  doc.text('JORGE BRITO VÁSQUEZ', anchoPagina / 2, y, { align: 'center' })
  y += 5
  doc.text('DEPARTAMENTO DE MANTENCIÓN', anchoPagina / 2, y, { align: 'center' })
  y += 5
  doc.text('INDELI', anchoPagina / 2, y, { align: 'center' })
  y += 6

  try {
    const firma = await cargarImagenBase64('/firma-jorge-brito.png')
    const anchoFirma = 45
    const altoFirma = anchoFirma * firma.ratio
    if (y + altoFirma > alturaPagina - 10) { doc.addPage(); y = 20 }
    doc.addImage(firma.data, 'PNG', (anchoPagina - anchoFirma) / 2, y, anchoFirma, altoFirma)
  } catch (e) { console.error('No se pudo cargar la firma:', e) }

  const nombreArchivo = `Programa_Mantencion_${(vehiculo.patente || vehiculo.codigo_interno || 'vehiculo').replace(/\s+/g,'_')}_${hoy.toISOString().split('T')[0]}.pdf`
  return { doc, nombreArchivo }
}
