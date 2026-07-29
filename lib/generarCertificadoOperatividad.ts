import jsPDF from 'jspdf'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
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

export async function generarCertificadoOperatividad(params: {
  vehiculo: any
  valorActual: string
  valorProximo: string
}) {
  const { vehiculo, valorActual, valorProximo } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const alturaPagina = doc.internal.pageSize.getHeight()
  const margen = 25

  // Logo arriba a la derecha (mismo tamaño y posición en los 3 documentos)
  const margenLogo = 14
  try {
    const logo = await cargarImagenBase64('/logo-indeli.jpg')
    doc.addImage(logo.data, 'JPEG', anchoPagina - margenLogo - ANCHO_LOGO, 15, ANCHO_LOGO, ANCHO_LOGO * logo.ratio)
  } catch (e) { console.error('No se pudo cargar el logo:', e) }

  let y = 30

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('CERTIFICADO OPERATIVIDAD', margen, y)
  y += 16

  const hoy = new Date()
  const fechaTexto = `Quillota, ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(fechaTexto, margen, y)
  y += 12

  const parrafo = 'INDELI CONSTRUCCIÓN Y MONTAJE LTDA Certifica que el Equipo mencionado en este documento se encuentra en perfectas condiciones eléctricas, mecánicas e hidráulicas.'
  const lineas = doc.splitTextToSize(parrafo, anchoPagina - margen * 2)
  doc.text(lineas, margen, y)
  y += lineas.length * 6 + 8

  const unidad = vehiculo.tipo_medicion === 'horas' ? 'Hrs' : 'Km'
  const campos: [string, string][] = [
    ['Equipo', vehiculo.tipo || '—'],
    ['Marca', vehiculo.marca || '—'],
    ['Patente', vehiculo.patente || vehiculo.codigo_interno || '—'],
    ['Modelo', vehiculo.modelo || '—'],
    ['Año', vehiculo.anio ? String(vehiculo.anio) : '—'],
    ...(vehiculo.chasis ? [['N° Chasis', vehiculo.chasis] as [string, string]] : []),
    ...(vehiculo.codigo_motor ? [['N° Motor', vehiculo.codigo_motor] as [string, string]] : []),
    [`${unidad} actuales`, valorActual ? Number(valorActual).toLocaleString('es-CL') : '—'],
    ['Próxima Mantención', valorProximo ? Number(valorProximo).toLocaleString('es-CL') : '—'],
  ]

  doc.setFontSize(11)
  for (const [label, valor] of campos) {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, margen, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(valor), margen + 48, y)
    y += 8
  }

  y += 10
  doc.text('Atentamente', margen, y)
  y += 8

  try {
    const firma = await cargarImagenBase64('/firma-jorge-brito.png')
    const anchoFirma = 55
    const altoFirma = anchoFirma * firma.ratio
    if (y + altoFirma > alturaPagina - 10) { doc.addPage(); y = 20 }
    doc.addImage(firma.data, 'PNG', margen, y, anchoFirma, altoFirma)
  } catch (e) { console.error('No se pudo cargar la firma:', e) }

  const nombreArchivo = `Certificado_Operatividad_${(vehiculo.patente || vehiculo.codigo_interno || 'vehiculo').replace(/\s+/g,'_')}_${hoy.toISOString().split('T')[0]}.pdf`
  doc.save(nombreArchivo)
}
